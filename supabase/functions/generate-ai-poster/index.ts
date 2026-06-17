// Generate a full AI marketing poster, store it in the `marketing-assets`
// Storage bucket, register it in `marketing_generated_images`, and return a
// long-lived signed URL. Admin-only.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/images/generations";
const BUCKET = "marketing-assets";
const SIGNED_URL_TTL = 60 * 60 * 24 * 365 * 10;

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

function mapAspect(r: AspectRatio): { ratio: string; dimensions: string } {
  switch (r) {
    case "9:16": return { ratio: "9:16", dimensions: "1080×1920" };
    case "1:1": return { ratio: "1:1", dimensions: "1080×1080" };
    case "4:5": return { ratio: "4:5", dimensions: "1080×1350" };
    case "16:9": return { ratio: "16:9", dimensions: "1920×1080" };
    default: return { ratio: "1:1", dimensions: "1080×1080" };
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

  const aspect = mapAspect(i.aspectRatio);
  let full = base + ` Compose as a ${aspect.ratio} poster (${aspect.dimensions}). The product reference image should be the hero visual — preserve the product appearance, colors, shape, and branding. This is a marketing poster for a Caribbean fashion resale brand based in Saint Lucia. All text must be clearly legible, correctly spelled, and placed inside the poster bounds.`;

  if (customInstructions && customInstructions.trim()) {
    full += ` ${customInstructions.trim()}`;
  }
  return full;
}

async function generateViaGateway(prompt: string, productImageUrl?: string): Promise<Uint8Array> {
  if (!LOVABLE_API_KEY) throw new Error("AI image generation is not configured");

  const content: Array<Record<string, unknown>> = [{ type: "text", text: prompt }];
  if (productImageUrl) {
    content.push({ type: "image_url", image_url: { url: productImageUrl } });
  }

  const res = await fetch(AI_GATEWAY, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-image",
      messages: [{ role: "user", content }],
      modalities: ["image", "text"],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`AI Gateway ${res.status}: ${text}`);
  }

  const data = await res.json();
  const first = data?.data?.[0];
  const b64 = first?.b64_json ?? first?.image?.b64_json;
  if (b64 && typeof b64 === "string") {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  const outputUrl = first?.url ?? first?.image_url ?? (Array.isArray(data?.output) ? data.output[0] : data?.output);
  if (typeof outputUrl === "string") {
    const imgRes = await fetch(outputUrl);
    if (!imgRes.ok) throw new Error("Failed to fetch generated image");
    return new Uint8Array(await imgRes.arrayBuffer());
  }

  throw new Error("AI Gateway returned no image data");
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
    const bytes = await generateViaGateway(fullPrompt, body.productImageUrl);
    const path = `ai-poster-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.png`;

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

    const { data: signed, error: signedErr } = await admin.storage
      .from(BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL);
    if (signedErr || !signed?.signedUrl) {
      return json({ error: `Could not create signed URL: ${signedErr?.message || "unknown"}` }, 500);
    }
    const publicUrl = signed.signedUrl;

    // Insert audit row (skip gracefully if table missing)
    try {
      await admin.from("marketing_generated_images").insert({
        image_url: publicUrl,
        thumbnail_url: publicUrl,
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
