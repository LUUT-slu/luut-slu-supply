const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are a professional poster designer writing image generation prompts for Ideogram. Your job is to take structured poster information and write a single detailed prompt that describes the poster as a fully composed, designed scene — not a list of elements.

Think like a creative director. Every poster you describe must have:

1. A SCENE OR SETTING — a real environment or atmospheric backdrop appropriate to the campaign. For a clearance sale: a packed streetwear store, clothing racks, urban environment. For a new drop: dramatic studio lighting, dark showroom. For brand awareness: lifestyle environment. The scene must feel alive, not like a flat background.

2. LIGHTING AND ATMOSPHERE — describe the mood through light. Dramatic spotlights, neon glow, natural daylight, golden hour, dark moody studio. The lighting must match the campaign energy.

3. TYPOGRAPHY COMPOSITION — describe exactly how the text is laid out. Which text is biggest and where it sits. Which text is secondary. Font personality — bold condensed, elegant serif, grunge distressed, clean sans-serif. Text must feel designed for this specific poster, not dropped on top.

4. GRAPHIC ELEMENTS — price tags, banners, badges, label overlays, brush strokes, geometric shapes, anything that adds design structure between the background and the text.

5. BRAND PLACEMENT — LUUT SLU always appears, either at the bottom or top corner, styled to match the poster mood.

6. HOW EVERYTHING CONNECTS — the background, graphic elements, and typography must feel like one cohesive designed piece. Nothing floating. Nothing random.

RULES:
- Write ONE flowing paragraph prompt, not a list
- Always end with: "professional commercial poster design, full bleed, no borders, high resolution"
- Never use the words "create" or "generate" in the prompt
- The color palette, font style, and setting must all match the campaign type and style selected
- If style is Bold: heavy condensed fonts, high contrast, aggressive energy
- If style is Luxury: elegant typography, rich lighting, premium feel
- If style is Clean: minimal layout, plenty of breathing room, modern sans-serif
- If style is Hype: streetwear energy, graffiti elements, urban setting, layered graphics
- If style is Minimal: one strong visual, sparse text, lots of negative space
- If style is Modern: sharp layout, geometric elements, contemporary feel
- Realism level affects the scene: Standard means graphic/illustrated, Premium means photorealistic, Hyper Realistic means indistinguishable from a real photo shoot

Output only the prompt, nothing else.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const {
      campaignType = "",
      headline = "",
      subheadline = "",
      keyDetail = "",
      dateRange = "",
      locations = "",
      style = "",
      realism = "Standard",
      brandStyle = "",
      brandSnippet = "",
      additionalNotes = "",
    } = body ?? {};

    const userMessage = [
      `Campaign Type: ${campaignType || "(not set)"}`,
      `Headline: ${headline || "(none)"}`,
      `Subheadline: ${subheadline || "(none)"}`,
      `Key Detail: ${keyDetail || "(none)"}`,
      `Date Range: ${dateRange || "(none)"}`,
      `Locations: ${locations || "(none)"}`,
      `Style: ${style || "(not set)"}`,
      `Realism Level: ${realism || "Standard"}`,
      `Brand Style from Marketing Studio: ${brandStyle || "default"}${brandSnippet ? ` — ${brandSnippet}` : ""}`,
      additionalNotes ? `Additional notes: ${additionalNotes}` : "",
    ].filter(Boolean).join("\n");

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
      }),
    });

    if (!resp.ok) {
      const txt = await resp.text().catch(() => "");
      if (resp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit hit — try again shortly" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (resp.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted — top up to continue" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: `AI gateway error ${resp.status}: ${txt}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const prompt = data?.choices?.[0]?.message?.content?.trim();
    if (!prompt) {
      return new Response(JSON.stringify({ error: "Empty AI response" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ prompt }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
