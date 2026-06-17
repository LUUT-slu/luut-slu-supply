// Extract design tokens (palette, layout, badge, cta, background) from a
// reference image. Returns ONLY structured tokens — never image content,
// never product/brand text. Uses Claude vision.

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

Color tokens must be hex (#RRGGBB) or rgba(...). Pick one dominant accent color. Glow should be a translucent rgba derived from accent.

Return ONLY valid JSON with this exact shape:
{"palette":{"bg":"#000000","surface":"#111111","accent":"#39ff7a","glow":"rgba(57,255,122,0.5)","text":"#ffffff","muted":"#cccccc"},"layout":{"density":"normal","radius":16,"gridGap":16},"typography":{"headlineWeight":"900","headlineCase":"upper","scale":1},"badge":{"shape":"pill","fill":"glow"},"cta":{"shape":"pill","fill":"glow"},"background":{"type":"glow","noise":false}}`;

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const CLAUDE_MODEL = "claude-sonnet-4-6";

function parseDataUrl(dataUrl: string): { mediaType: string; data: string } | null {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return null;
  return { mediaType: match[1], data: match[2] };
}

function extractJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(text.slice(start, end + 1));
    throw new Error("AI returned invalid JSON");
  }
}

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

    const image = parseDataUrl(imageDataUrl);
    if (!image) {
      return new Response(JSON.stringify({ error: "imageDataUrl must be a base64 image data URL" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_KEY");
    if (!ANTHROPIC_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 1200,
        temperature: 0.1,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Extract reusable poster design tokens from this reference. Return only the JSON object." },
              { type: "image", source: { type: "base64", media_type: image.mediaType, data: image.data } },
            ],
          },
        ],
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
      console.error("Claude preset extraction error", response.status, text);
      return new Response(JSON.stringify({ error: "AI extraction failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const text = data?.content
      ?.filter((part: { type?: string; text?: string }) => part?.type === "text" && part.text)
      .map((part: { text: string }) => part.text)
      .join("\n")
      .trim();
    if (!text) {
      return new Response(JSON.stringify({ error: "AI did not return preset tokens" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let tokens: unknown;
    try {
      tokens = extractJson(text);
    } catch (e) {
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
