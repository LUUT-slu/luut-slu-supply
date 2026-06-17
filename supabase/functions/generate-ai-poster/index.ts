// Generate a full marketing poster via Ideogram v3 Turbo on Replicate and
// store it in the `marketing-assets` Storage bucket. Admin-only.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const REPLICATE_API_TOKEN = Deno.env.get("REPLICATE_API_TOKEN")!;
const BUCKET = "marketing-assets";
const REPLICATE_API = "https://api.replicate.com/v1";

type PosterStyle = "hype" | "clean" | "luxury" | "bold";
type AspectRatio = "9:16" | "1:1" | "4:5" | "16:9";

interface PosterInput {
  productTitle: string;
  productPrice: string;
  productImageUrl: string;
  ctaText: string;
  brandName: string;
  meetupText: string;
  urgencyText: string;
  tagline: string | null;
  posterStyle: PosterStyle;
  aspectRatio: AspectRatio;
  customInstructions: string | null;
}

function mapAspect(r: AspectRatio): string {
  // Ideogram v3 Turbo accepts plain ratio strings.
  // Valid: "1:1","16:9","9:16","4:3","3:4","3:2","2:3","16:10","10:16","1:3","3:1".
  switch (r) {
    case "9:16": return "9:16";
    case "1:1": return "1:1";
    case "4:5": return "3:4"; // 4:5 not supported by Ideogram v3; closest valid portrait ratio
    case "16:9": return "16:9";
    default: return "1:1";
  }
}

function buildPrompt(i: PosterInput): string {
  const {
    productTitle, productPrice, productImageUrl, ctaText, brandName,
    meetupText, urgencyText, tagline, posterStyle, customInstructions,
  } = i;

  let base = "";
  if (posterStyle === "hype") {
    base = `Dark moody fashion marketing poster for ${brandName}.
Black background with vivid neon green accent glow effects.
Large bold product photo of ${productTitle} as the hero, dramatically lit from below.
Top-left badge reads "${urgencyText}".
Top-right brand mark reads "${brandName}".
Large headline text "${productTitle}" in heavy white uppercase font.
Price badge "${productPrice}" in solid neon green box with dark text.
Bottom row small pills showing "In Stock" and "${meetupText}".
Full-width rounded button at bottom reads "${ctaText}".
${tagline ? `Tagline text "${tagline}" in small muted text below headline.` : ""}
Style: streetwear brand, Gen Z energy, high contrast, premium dark aesthetic.`;
  } else if (posterStyle === "clean") {
    base = `Clean minimal product poster with white background for ${brandName}.
Professional product photo of ${productTitle} centered with generous white space around it.
Top-right corner text "${brandName}" in small dark grey sans-serif.
Large headline "${productTitle}" in bold dark uppercase text below product.
Price "${productPrice}" in a solid dark chip.
Small text "${meetupText}" in light grey.
Rounded button "${ctaText}" in solid dark color.
${tagline ? `Tagline "${tagline}" in italic grey below headline.` : ""}
Style: modern luxury minimal, lots of breathing room, editorial.`;
  } else if (posterStyle === "luxury") {
    base = `Premium luxury fashion poster for ${brandName}.
Deep navy background with subtle gold gradient accents.
Product ${productTitle} photographed with gold-toned lighting.
Brand name "${brandName}" in elegant spaced gold serif letters at top.
Product title "${productTitle}" in refined uppercase with wide letter spacing.
Price "${productPrice}" in gold outlined chip.
Location text "${meetupText}" in small gold text.
CTA button "${ctaText}" with gold outline.
${tagline ? `Tagline "${tagline}" in italic gold script.` : ""}
Style: high-end fashion house, aspirational, Caribbean luxury.`;
  } else {
    base = `High impact bold marketing poster for ${brandName}.
Vibrant gradient background, maximum contrast.
Product ${productTitle} shown large, punchy angles.
Massive headline "${productTitle}" taking up the upper half.
Price badge "${productPrice}" in giant bold accent color chip.
"${urgencyText}" in a bright ribbon banner.
Meetup info "${meetupText}" in white text.
Big loud button "${ctaText}" at the bottom.
${tagline ? `"${tagline}" in bold supporting text.` : ""}
Style: attention-grabbing street market energy, Caribbean hustle aesthetic.`;
  }

  let full = base + ` The product image at ${productImageUrl} should be the hero visual — reference it for the product appearance. This is a marketing poster for a Caribbean fashion resale brand based in Saint Lucia. All text must be clearly legible.`;

  if (customInstructions && customInstructions.trim()) {
    full += ` ${customInstructions.trim()}`;
  }
  return full;
}

async function createPrediction(prompt: string, aspectRatio: string): Promise<string> {
  const res = await fetch(`${REPLICATE_API}/models/ideogram-ai/ideogram-v3-turbo/predictions`, {
    method: "POST",
    headers: {
      Authorization: `Token ${REPLICATE_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: {
        prompt,
        aspect_ratio: aspectRatio,
        style_type: "Design",
        magic_prompt_option: "On",
      },
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Replicate create ${res.status}: ${text}`);
  }
  const data = await res.json();
  return data.id as string;
}

async function pollPrediction(id: string): Promise<string> {
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const res = await fetch(`${REPLICATE_API}/predictions/${id}`, {
      headers: { Authorization: `Token ${REPLICATE_API_TOKEN}` },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Replicate poll ${res.status}: ${text}`);
    }
    const data = await res.json();
    if (data.status === "succeeded") {
      const out = data.output;
      const url = Array.isArray(out) ? out[0] : typeof out === "string" ? out : null;
      if (!url) throw new Error("Replicate succeeded but no output URL");
      return url;
    }
    if (data.status === "failed" || data.status === "canceled") {
      throw new Error(data.error || `Prediction ${data.status}`);
    }
  }
  throw new Error("Generation timed out after 120s");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth: caller must be admin
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: userRes } = await admin.auth.getUser(token);
    const userId = userRes?.user?.id;
    if (!userId) return json({ error: "Unauthorized" }, 401);

    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", userId);
    const isAdmin = roles?.some((r: { role: string }) => r.role === "admin");
    if (!isAdmin) return json({ error: "Admin access required" }, 403);

    const body = (await req.json().catch(() => ({}))) as PosterInput;
    const required: (keyof PosterInput)[] = [
      "productTitle", "ctaText", "brandName", "posterStyle", "aspectRatio",
    ];
    for (const k of required) {
      if (!body[k]) return json({ error: `Missing required field: ${k}` }, 400);
    }

    const fullPrompt = buildPrompt(body);
    const aspect = mapAspect(body.aspectRatio);

    let imageUrl: string;
    try {
      const predId = await createPrediction(fullPrompt, aspect);
      imageUrl = await pollPrediction(predId);
    } catch (e: any) {
      console.error("Replicate error", e);
      return json({ error: e?.message || "Generation failed" }, 502);
    }

    // Persist to storage
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) return json({ error: "Failed to fetch generated image" }, 502);
    const bytes = new Uint8Array(await imgRes.arrayBuffer());
    const path = `ai-poster-${Date.now()}.png`;

    const upload = await admin.storage.from(BUCKET).upload(path, bytes, {
      contentType: "image/png",
      upsert: true,
    });
    if (upload.error) {
      const msg = upload.error.message || "";
      if (/not.?found/i.test(msg) || /bucket/i.test(msg)) {
        return json({ error: "Storage not configured — run the marketing_assets migration first" }, 500);
      }
      console.error("Storage upload error", upload.error);
      return json({ error: "Failed to store image" }, 500);
    }

    const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path);
    const publicUrl = pub.publicUrl;

    // Insert audit row (skip gracefully if table missing)
    try {
      await admin.from("marketing_generated_images").insert({
        image_url: publicUrl,
        generation_type: "poster",
        product_title: body.productTitle,
        style: body.posterStyle,
        aspect_ratio: body.aspectRatio,
        prompt_used: fullPrompt,
        created_by: userId,
      });
    } catch (e) {
      console.warn("marketing_generated_images insert skipped", e);
    }

    return json({ url: publicUrl, prompt: fullPrompt });
  } catch (e) {
    console.error("generate-ai-poster error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
