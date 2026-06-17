// Two-step poster pipeline:
//   1) Flux Kontext Pro — wraps the real product image in a premium dark scene
//      while keeping the product accurate.
//   2) Ideogram v3 Turbo — overlays LUUT SLU branded text (title, price, CTA,
//      pickup locations, brand) on the styled scene.
//
// Square 1:1 only for now. Admin-only.

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
const FLUX_MODEL = "black-forest-labs/flux-kontext-pro";
const IDEOGRAM_MODEL = "ideogram-ai/ideogram-v3-turbo";
const BUCKET = "marketing-assets";
const SIGNED_URL_TTL = 60 * 60 * 24 * 365 * 10;

interface PosterInput {
  productTitle: string;
  productPrice: string;
  productImageUrl: string;       // http(s) URL OR data: URL (user override)
  ctaText?: string;
  brandName?: string;
  meetupText?: string;
  customInstructions?: string | null;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function runReplicate(
  model: string,
  input: Record<string, unknown>,
): Promise<unknown> {
  const maxAttempts = 5;
  let createRes: Response | null = null;
  let lastText = "";
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    createRes = await fetch(`${REPLICATE_API}/models/${model}/predictions`, {
      method: "POST",
      headers: {
        Authorization: `Token ${REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json",
        Prefer: "wait",
      },
      body: JSON.stringify({ input }),
    });
    if (createRes.status !== 429) break;
    lastText = await createRes.text().catch(() => "");
    const retryAfterHeader = createRes.headers.get("retry-after");
    let waitMs = 0;
    if (retryAfterHeader) waitMs = parseInt(retryAfterHeader, 10) * 1000;
    if (!waitMs) {
      const m = lastText.match(/"retry_after":\s*(\d+)/);
      if (m) waitMs = parseInt(m[1], 10) * 1000;
    }
    if (!waitMs) waitMs = Math.min(2000 * Math.pow(2, attempt), 16000);
    await new Promise((r) => setTimeout(r, waitMs + 250));
  }

  if (!createRes || !createRes.ok) {
    const text = createRes ? await createRes.text().catch(() => lastText) : lastText;
    const err: any = new Error(`Replicate ${createRes?.status ?? 0}: ${text}`);
    err.status = createRes?.status ?? 0;
    throw err;
  }

  let prediction = await createRes.json();
  const start = Date.now();
  while (
    prediction.status !== "succeeded" &&
    prediction.status !== "failed" &&
    prediction.status !== "canceled"
  ) {
    if (Date.now() - start > 180_000) throw new Error("Replicate prediction timed out");
    await new Promise((r) => setTimeout(r, 1500));
    const pollRes = await fetch(`${REPLICATE_API}/predictions/${prediction.id}`, {
      headers: { Authorization: `Token ${REPLICATE_API_TOKEN}` },
    });
    if (!pollRes.ok) {
      throw new Error(`Replicate poll ${pollRes.status}: ${await pollRes.text().catch(() => "")}`);
    }
    prediction = await pollRes.json();
  }
  if (prediction.status !== "succeeded") {
    throw new Error(prediction.error || `Prediction ${prediction.status}`);
  }
  return prediction.output;
}

function pickUrl(output: unknown): string | null {
  if (Array.isArray(output)) return output[0] ? String(output[0]) : null;
  if (typeof output === "string") return output;
  return null;
}

async function uploadBytesToBucket(
  admin: ReturnType<typeof createClient>,
  bytes: Uint8Array,
  contentType: string,
  prefix: string,
): Promise<string> {
  const ext = contentType.includes("jpeg") ? "jpg" : contentType.includes("webp") ? "webp" : "png";
  const path = `${prefix}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  const up = await admin.storage.from(BUCKET).upload(path, bytes, { contentType, upsert: true });
  if (up.error) throw new Error(`Storage upload failed: ${up.error.message}`);
  const { data: signed, error: signedErr } = await admin.storage
    .from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL);
  if (signedErr || !signed?.signedUrl) {
    throw new Error(`Could not create signed URL: ${signedErr?.message || "unknown"}`);
  }
  return signed.signedUrl;
}

async function dataUrlToHostedUrl(
  admin: ReturnType<typeof createClient>,
  dataUrl: string,
): Promise<string> {
  const m = dataUrl.match(/^data:([^;,]+);base64,(.+)$/);
  if (!m) throw new Error("Invalid data URL for product image override");
  const contentType = m[1] || "image/png";
  const b64 = m[2];
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return uploadBytesToBucket(admin, bytes, contentType, "poster-src");
}

function buildScenePrompt(title: string): string {
  return [
    `Premium streetwear marketing scene featuring the exact product shown in the reference image: ${title}.`,
    `Keep the product 100% accurate — same colors, shape, branding, logos, materials, proportions. Do NOT modify, restyle, or replace the product.`,
    `Place the product as the dramatic hero against a deep black studio background with subtle neon green rim lighting and soft volumetric haze.`,
    `Cinematic moody product photography, high contrast, glossy reflections on the floor, sharp focus on the product, shallow depth of field.`,
    `No text, no logos other than what's on the product, no watermarks, no humans. Square 1:1 framing with generous negative space for typography overlays around the product.`,
  ].join(" ");
}

function buildOverlayPrompt(i: PosterInput): string {
  const brand = (i.brandName || "LUUT SLU").toUpperCase();
  const cta = (i.ctaText || "DM TO COP").toUpperCase();
  const pickup = i.meetupText || "Castries · Gros Islet · Vieux Fort";
  return [
    `Marketing poster using the reference image as the background scene — preserve the product, lighting, composition, and dark background exactly as shown.`,
    `Add bold text overlays in the LUUT SLU visual identity: pitch-black background, neon green accent color (#39FF14), heavy condensed sans-serif typography in the style of Bebas Neue, sharp uppercase, tight letter spacing.`,
    `Top of poster: large product name "${i.productTitle.toUpperCase()}" in big white condensed uppercase headline.`,
    `Just below the headline: price chip "${i.productPrice}" in a solid neon green pill with black text.`,
    `Center-bottom CTA in a bold neon green ribbon: "${cta}".`,
    `Small uppercase line above the brand: "${pickup}" in light grey.`,
    `Bottom of poster: brand name "${brand}" centered in neon green, condensed uppercase, slightly wider letter spacing.`,
    `All text crisp, perfectly spelled, legible, contained inside the poster bounds. No extra captions, no lorem ipsum, no duplicate text.`,
    `Square 1:1 poster, premium streetwear / Caribbean resale aesthetic.`,
    i.customInstructions?.trim() ? i.customInstructions.trim() : "",
  ].filter(Boolean).join(" ");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: userRes } = await admin.auth.getUser(token);
    const userId = userRes?.user?.id;
    if (!userId) return json({ error: "Unauthorized" }, 401);

    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", userId);
    if (!roles?.some((r: { role: string }) => r.role === "admin")) {
      return json({ error: "Admin access required" }, 403);
    }

    const body = (await req.json().catch(() => ({}))) as PosterInput;
    if (!body.productTitle) return json({ error: "Missing productTitle" }, 400);
    if (!body.productImageUrl) return json({ error: "Missing productImageUrl" }, 400);
    if (!body.productPrice) return json({ error: "Missing productPrice" }, 400);

    // Normalize product image into a hosted URL Replicate can fetch.
    let sourceImageUrl = body.productImageUrl;
    if (sourceImageUrl.startsWith("data:")) {
      sourceImageUrl = await dataUrlToHostedUrl(admin, sourceImageUrl);
    } else if (!/^https?:\/\//i.test(sourceImageUrl)) {
      return json({ error: "productImageUrl must be an http(s) URL or data URL" }, 400);
    }

    // -------- Step 1: Flux Kontext -- styled scene around the real product
    const scenePrompt = buildScenePrompt(body.productTitle);
    const fluxOutput = await runReplicate(FLUX_MODEL, {
      prompt: scenePrompt,
      input_image: sourceImageUrl,
      aspect_ratio: "1:1",
      output_format: "png",
      safety_tolerance: 2,
    });
    const sceneUrl = pickUrl(fluxOutput);
    if (!sceneUrl) return json({ error: "Flux Kontext returned no image" }, 502);

    // -------- Step 2: Ideogram v3 Turbo -- add LUUT-styled text overlay
    const overlayPrompt = buildOverlayPrompt(body);
    const ideogramOutput = await runReplicate(IDEOGRAM_MODEL, {
      prompt: overlayPrompt,
      aspect_ratio: "1:1",
      style_type: "Auto",
      magic_prompt_option: "On",
      style_reference_images: [sceneUrl],
    });
    const finalUrl = pickUrl(ideogramOutput);
    if (!finalUrl) return json({ error: "Ideogram returned no image" }, 502);

    // -------- Persist the final poster in our bucket
    const imgRes = await fetch(finalUrl);
    if (!imgRes.ok) return json({ error: `Failed to download generated image: ${imgRes.status}` }, 502);
    const contentType = imgRes.headers.get("content-type") || "image/png";
    const bytes = new Uint8Array(await imgRes.arrayBuffer());
    const publicUrl = await uploadBytesToBucket(admin, bytes, contentType, "ai-poster");

    try {
      await admin.from("marketing_generated_images").insert({
        image_url: publicUrl,
        thumbnail_url: publicUrl,
        generation_type: "poster",
        product_title: body.productTitle,
        style: "flux-kontext+ideogram",
        aspect_ratio: "1:1",
        prompt_used: `[scene] ${scenePrompt}\n[overlay] ${overlayPrompt}`,
        created_by: userId,
      });
    } catch (e) {
      console.warn("marketing_generated_images insert skipped", e);
    }

    return json({
      url: publicUrl,
      sceneUrl,
      prompt: overlayPrompt,
    });
  } catch (e: any) {
    console.error("generate-ai-poster error", e);
    const message = e instanceof Error ? e.message : "Unknown error";
    if (e?.status === 402 || /insufficient credit|billing/i.test(message)) {
      return json({ error: "Replicate account has insufficient credit. Top up at https://replicate.com/account/billing" }, 402);
    }
    return json({ error: message }, 500);
  }
});
