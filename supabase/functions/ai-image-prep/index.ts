// Edge function: AI-assisted image preparation for Marketing Studio.
// Modes:
//   - "remove-bg" : remove background, keep product 100% intact
//   - "expand"    : outpaint to extend canvas to a target aspect ratio
//
// Uses Lovable AI Gateway with google/gemini-3.1-flash-image-preview (Nano Banana 2).
// Returns a base64 data URL of the prepared image.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type PrepMode = "remove-bg" | "expand";
type Format = "story" | "post" | "ad" | "portrait";

const ASPECT_LABEL: Record<Format, string> = {
  story: "9:16 vertical",
  post: "1:1 square",
  ad: "1.91:1 horizontal banner",
  portrait: "4:5 portrait",
};

function buildPrompt(mode: PrepMode, format: Format): string {
  if (mode === "remove-bg") {
    return [
      "Remove the background completely from this product photo.",
      "Output the product on a fully transparent background (alpha channel).",
      "CRITICAL — DO NOT change the product in any way:",
      "- Keep all colors, shapes, textures, branding, logos, and details EXACTLY as in the source.",
      "- Do not crop, distort, recolor, restyle, replace, or beautify the product.",
      "- Do not add reflections, shadows, props, or new elements.",
      "Return ONLY the cleanly cut-out product, centered, with generous transparent margin around it.",
    ].join(" ");
  }
  // expand
  return [
    `Extend (outpaint) this image to a ${ASPECT_LABEL[format]} aspect ratio.`,
    "Fill the new edges with a clean, realistic continuation of the existing background only.",
    "CRITICAL — DO NOT alter the product:",
    "- Keep the product in the same position, scale, color, shape, branding, and details — pixel-faithful.",
    "- Do not add new objects, text, props, or stylized effects.",
    "- The added space must look like a natural background extension, not a new scene.",
    "Return the full extended image at the requested aspect ratio.",
  ].join(" ");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json().catch(() => null);
    const imageUrl: string | undefined = body?.imageUrl;
    const mode: PrepMode | undefined = body?.mode;
    const format: Format = body?.format ?? "post";

    if (!imageUrl || typeof imageUrl !== "string") {
      return new Response(
        JSON.stringify({ error: "imageUrl is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (mode !== "remove-bg" && mode !== "expand") {
      return new Response(
        JSON.stringify({ error: "mode must be 'remove-bg' or 'expand'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const prompt = buildPrompt(mode, format);

    const aiResp = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3.1-flash-image-preview",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                { type: "image_url", image_url: { url: imageUrl } },
              ],
            },
          ],
          modalities: ["image", "text"],
        }),
      },
    );

    if (!aiResp.ok) {
      const errText = await aiResp.text().catch(() => "");
      console.error("AI gateway error:", aiResp.status, errText);
      if (aiResp.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limited. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (aiResp.status === 402) {
        return new Response(
          JSON.stringify({
            error: "AI credits exhausted. Top up your Lovable AI workspace.",
          }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({ error: "AI gateway request failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await aiResp.json();
    const dataUrl: string | undefined =
      data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!dataUrl) {
      console.error("No image returned from AI", JSON.stringify(data).slice(0, 500));
      return new Response(
        JSON.stringify({ error: "AI did not return an image" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ url: dataUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-image-prep error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
