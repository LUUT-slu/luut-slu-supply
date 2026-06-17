// Generate a full AI marketing poster via Replicate (ideogram-v3-turbo),
// store it in the `marketing-assets` Storage bucket, register it in
// `marketing_generated_images`, and return a long-lived signed URL. Admin-only.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const REPLICATE_API_TOKEN = Deno.env.get("REPLICATE_API_TOKEN")!;
const REPLICATE_API = "https://api.replicate.com/v1";
const REPLICATE_MODEL = "ideogram-ai/ideogram-v3-turbo";
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

function mapAspect(r: AspectRatio): string {
  // Ideogram v3 Turbo accepts plain ratio strings. 4:5 isn't supported -> fall back to 3:4.
  switch (r) {
    case "9:16": return "9:16";
    case "1:1": return "1:1";
    case "4:5": return "3:4";
    case "16:9": return "16:9";
    default: return "1:1";
  }
}

function buildPrompt(i: PosterInput): string {
  const {
    productTitle, productPrice, ctaText, brandName,
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

  const anchor = `Use the provided reference image as the exact product to feature in this poster. Do not invent or replace the product appearance. Reproduce the product accurately including its colors, shape, branding, and logo.`;
  let full = `${anchor} ${base} This is a marketing poster for a Caribbean fashion resale brand based in Saint Lucia. All text must be clearly legible, correctly spelled, and placed inside the poster bounds.`;

  if (customInstructions && customInstructions.trim()) {
    full += ` ${customInstructions.trim()}`;
  }
  return full;
}

async function runReplicate(
  model: string,
  input: Record<string, unknown>,
): Promise<unknown> {
  const createRes = await fetch(`${REPLICATE_API}/models/${model}/predictions`, {
    method: "POST",
    headers: {
      Authorization: `Token ${REPLICATE_API_TOKEN}`,
      "Content-Type": "application/json",
      Prefer: "wait",
    },
    body: JSON.stringify({ input }),
  });

  if (!createRes.ok) {
    const text = await createRes.text().catch(() => "");
    const err: any = new Error(`Replicate ${createRes.status}: ${text}`);
    err.status = createRes.status;
    throw err;
  }

  let prediction = await createRes.json();
  const start = Date.now();
  while (
    prediction.status !== "succeeded" &&
    prediction.status !== "failed" &&
    prediction.status !== "canceled"
  ) {
    if (Date.now() - start > 120_000) throw new Error("Replicate prediction timed out");
    await new Promise((r) => setTimeout(r, 1500));
    const pollRes = await fetch(`${REPLICATE_API}/predictions/${prediction.id}`, {
      headers: { Authorization: `Token ${REPLICATE_API_TOKEN}` },
    });
    if (!pollRes.ok) {
      const text = await pollRes.text().catch(() => "");
      throw new Error(`Replicate poll ${pollRes.status}: ${text}`);
    }
    prediction = await pollRes.json();
  }
  if (prediction.status !== "succeeded") {
    throw new Error(prediction.error || `Prediction ${prediction.status}`);
  }
  return prediction.output;
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
    const aspect_ratio = mapAspect(body.aspectRatio);

    const replicateInput: Record<string, unknown> = {
      prompt: fullPrompt,
      aspect_ratio,
      style_type: "AUTO",
      magic_prompt_option: "On",
    };
    if (body.productImageUrl && /^https?:\/\//i.test(body.productImageUrl)) {
      replicateInput.style_reference_images = [body.productImageUrl];
    }

    const output = await runReplicate(REPLICATE_MODEL, replicateInput);

    // Ideogram returns either a string URL or an array of URLs.
    const imageUrl = Array.isArray(output)
      ? String(output[0])
      : typeof output === "string"
        ? output
        : null;
    if (!imageUrl) return json({ error: "Replicate returned no image" }, 502);

    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) return json({ error: `Failed to download generated image: ${imgRes.status}` }, 502);
    const contentType = imgRes.headers.get("content-type") || "image/png";
    const ext = contentType.includes("jpeg") ? "jpg" : contentType.includes("webp") ? "webp" : "png";
    const bytes = new Uint8Array(await imgRes.arrayBuffer());
    const path = `ai-poster-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;

    const upload = await admin.storage.from(BUCKET).upload(path, bytes, {
      contentType,
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
  } catch (e: any) {
    console.error("generate-ai-poster error", e);
    const message = e instanceof Error ? e.message : "Unknown error";
    if (e?.status === 402 || /insufficient credit|billing/i.test(message)) {
      return json({ error: "Replicate account has insufficient credit. Top up at https://replicate.com/account/billing" }, 402);
    }
    return json({ error: message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
