// Marketing copy generator using Lovable AI Gateway
// Returns structured JSON via tool-calling for: ad_copy, instagram_caption, whatsapp_promo, facebook_marketplace

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type CopyType =
  | "ad_copy"
  | "instagram_caption"
  | "whatsapp_promo"
  | "facebook_marketplace";

interface ProductPayload {
  name: string;
  price?: string | number;
  description?: string;
  category?: string;
  stockStatus?: string;
  brandName?: string;
  meetupLocations?: string;
  cta?: string;
  urgencyText?: string;
}

const TOOL_SCHEMAS: Record<CopyType, any> = {
  ad_copy: {
    type: "function",
    function: {
      name: "return_ad_copy",
      description: "Return ad copy fields for a paid social ad.",
      parameters: {
        type: "object",
        properties: {
          headline: { type: "string", description: "Short punchy headline, max 40 chars" },
          primary_text: { type: "string", description: "Main ad body, 1-3 sentences" },
          short_description: { type: "string", description: "1-line description under 90 chars" },
          cta: { type: "string", description: "Call to action, 2-4 words" },
        },
        required: ["headline", "primary_text", "short_description", "cta"],
        additionalProperties: false,
      },
    },
  },
  instagram_caption: {
    type: "function",
    function: {
      name: "return_instagram_caption",
      description: "Return an Instagram caption with hashtags.",
      parameters: {
        type: "object",
        properties: {
          caption: { type: "string", description: "Caption text, max 200 chars, can include emojis" },
          hashtags: {
            type: "array",
            items: { type: "string" },
            description: "5-10 relevant hashtags without # prefix",
          },
        },
        required: ["caption", "hashtags"],
        additionalProperties: false,
      },
    },
  },
  whatsapp_promo: {
    type: "function",
    function: {
      name: "return_whatsapp_promo",
      description: "Return a short WhatsApp promo message.",
      parameters: {
        type: "object",
        properties: {
          text: { type: "string", description: "Friendly WhatsApp blast message, max 280 chars, can include emojis" },
        },
        required: ["text"],
        additionalProperties: false,
      },
    },
  },
  facebook_marketplace: {
    type: "function",
    function: {
      name: "return_facebook_marketplace",
      description: "Return a Facebook Marketplace style description.",
      parameters: {
        type: "object",
        properties: {
          description: { type: "string", description: "Plain, informative listing description, 2-4 short paragraphs" },
        },
        required: ["description"],
        additionalProperties: false,
      },
    },
  },
};

function buildSystemPrompt(p: ProductPayload): string {
  return `You are a marketing copywriter for ${p.brandName || "Luut SLU"}, a Saint Lucia marketplace.
Voice: confident, local, hype-aware, never corporate. Use light Caribbean energy without overdoing slang.
Payment model: Pay on Meetup (cash, in-person at ${p.meetupLocations || "Castries · Gros Islet · Vieux Fort"}).
Default CTA: "${p.cta || "DM to Cop"}".
${p.urgencyText ? `Urgency cue: "${p.urgencyText}".` : ""}
Always reference the product naturally. Never invent specs not in the product info.`;
}

function buildUserPrompt(p: ProductPayload, type: CopyType): string {
  const lines = [
    `Product: ${p.name}`,
    p.price ? `Price: EC$${p.price}` : null,
    p.category ? `Category: ${p.category}` : null,
    p.stockStatus ? `Stock: ${p.stockStatus}` : null,
    p.description ? `Description: ${p.description}` : null,
  ].filter(Boolean);

  const intent: Record<CopyType, string> = {
    ad_copy: "Generate ad copy for a paid Instagram/Facebook ad.",
    instagram_caption: "Generate an Instagram feed/story caption with hashtags.",
    whatsapp_promo: "Generate a WhatsApp broadcast promo.",
    facebook_marketplace: "Generate a Facebook Marketplace style description.",
  };

  return `${intent[type]}\n\n${lines.join("\n")}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, product } = await req.json() as {
      type: CopyType;
      product: ProductPayload;
    };

    if (!type || !TOOL_SCHEMAS[type]) {
      return new Response(JSON.stringify({ error: "Invalid type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!product?.name) {
      return new Response(JSON.stringify({ error: "Product name required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tool = TOOL_SCHEMAS[type];

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: buildSystemPrompt(product) },
          { role: "user", content: buildUserPrompt(product, type) },
        ],
        tools: [tool],
        tool_choice: { type: "function", function: { name: tool.function.name } },
      }),
    });

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      console.error("AI gateway error", aiRes.status, txt);
      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit. Try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiRes.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add funds in Workspace > Usage." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI generation failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiRes.json();
    const call = data?.choices?.[0]?.message?.tool_calls?.[0];
    if (!call?.function?.arguments) {
      return new Response(JSON.stringify({ error: "AI returned no structured output" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let parsed: Record<string, any>;
    try {
      parsed = JSON.parse(call.function.arguments);
    } catch {
      return new Response(JSON.stringify({ error: "AI output not parseable" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ type, result: parsed }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-marketing-copy error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
