// Extract design tokens (palette, layout, badge, cta, background) from a
// reference image. Returns ONLY structured tokens — never image content,
// never product/brand text. Uses Lovable AI gateway with vision + tool calling.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are a design-token extractor. Given a poster reference image, output a JSON object describing ONLY its visual design system.

CRITICAL RULES:
- Do NOT describe what the image shows.
- Do NOT include any product names, brand names, headlines, or text from the reference.
- Only extract abstract design tokens: colors, layout density, badge shape, CTA shape, background type.
- Output via the provided tool call.

Color tokens must be hex (#RRGGBB) or rgba(...). Pick one dominant accent color. Glow should be a translucent rgba derived from accent.`;

const PRESET_TOOL = {
  type: "function",
  function: {
    name: "save_preset",
    description: "Save the extracted design tokens as a reusable preset.",
    parameters: {
      type: "object",
      properties: {
        palette: {
          type: "object",
          properties: {
            bg: { type: "string", description: "Base background hex color" },
            surface: { type: "string", description: "Card/tile background color (hex or rgba)" },
            accent: { type: "string", description: "Dominant accent hex color" },
            glow: { type: "string", description: "Translucent glow rgba color derived from accent" },
            text: { type: "string", description: "Primary text hex color" },
            muted: { type: "string", description: "Muted/secondary text hex color" },
          },
          required: ["bg", "surface", "accent", "glow", "text", "muted"],
        },
        layout: {
          type: "object",
          properties: {
            density: { type: "string", enum: ["tight", "normal", "spaced"] },
            radius: { type: "number", description: "Corner radius in pixels (0-48)" },
            gridGap: { type: "number", description: "Grid gap in pixels (0-40)" },
          },
          required: ["density", "radius", "gridGap"],
        },
        typography: {
          type: "object",
          properties: {
            headlineWeight: {
              type: "string",
              enum: ["700", "800", "900"],
              description: "Headline font weight as a string: 700, 800, or 900",
            },
            headlineCase: { type: "string", enum: ["upper", "title"] },
            scale: { type: "number", description: "Headline scale 0.85..1.15" },
          },
          required: ["headlineWeight", "headlineCase", "scale"],
        },
        badge: {
          type: "object",
          properties: {
            shape: { type: "string", enum: ["pill", "ribbon", "chip"] },
            fill: { type: "string", enum: ["glow", "solid", "outline"] },
          },
          required: ["shape", "fill"],
        },
        cta: {
          type: "object",
          properties: {
            shape: { type: "string", enum: ["pill", "block", "outline"] },
            fill: { type: "string", enum: ["glow", "solid", "outline"] },
          },
          required: ["shape", "fill"],
        },
        background: {
          type: "object",
          properties: {
            type: { type: "string", enum: ["dark", "gradient", "glow", "minimal"] },
            noise: { type: "boolean" },
          },
          required: ["type", "noise"],
        },
      },
      required: ["palette", "layout", "typography", "badge", "cta", "background"],
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageDataUrl } = await req.json();
    if (!imageDataUrl || typeof imageDataUrl !== "string") {
      return new Response(JSON.stringify({ error: "imageDataUrl is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const REPLICATE_API_TOKEN = Deno.env.get("REPLICATE_API_TOKEN");
    if (!REPLICATE_API_TOKEN) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch("https://openai-compat.replicate.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "meta/llama-3.2-90b-vision-instruct",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extract the design tokens from this reference poster. Output ONLY tokens via the save_preset tool.",
              },
              { type: "image_url", image_url: { url: imageDataUrl } },
            ],
          },
        ],
        tools: [PRESET_TOOL],
        tool_choice: { type: "function", function: { name: "save_preset" } },
      }),
    });

    if (response.status === 429) {
      return new Response(
        JSON.stringify({ error: "Rate limited — please try again in a moment." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (response.status === 402) {
      return new Response(
        JSON.stringify({ error: "AI credits exhausted — top up in Settings → Workspace → Usage." }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!response.ok) {
      const text = await response.text();
      console.error("AI gateway error", response.status, text);
      return new Response(JSON.stringify({ error: "AI extraction failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      return new Response(JSON.stringify({ error: "AI did not return preset tokens" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let tokens: unknown;
    try {
      tokens = JSON.parse(toolCall.function.arguments);
    } catch {
      return new Response(JSON.stringify({ error: "AI returned invalid JSON" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ tokens }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-preset error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
