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

type PosterStyleKey = "default" | "hype" | "clean" | "luxury" | "bold";

interface PosterInput {
  productTitle: string;
  productPrice: string;
  productImageUrl: string;       // http(s) URL OR data: URL (user override)
  ctaText?: string;
  brandName?: string;
  meetupText?: string;
  customInstructions?: string | null;
  posterStyle?: PosterStyleKey;
}

interface StylePreset {
  sceneBackground: string;
  paletteText: string;
  headlineColor: string;
  priceChip: string;
  ctaRibbon: string;
  brandText: string;
  typography: string;
  aesthetic: string;
}

const STYLE_PRESETS: Record<PosterStyleKey, StylePreset> = {
  default: {
    sceneBackground:
      "a deep matte-black studio backdrop with subtle neon green (#39FF14) glow CONFINED to the background wall behind and around the product, plus soft volumetric haze in the far background — the coloured glow must stay BEHIND the product and never wrap onto it or tint it",
    paletteText:
      "pitch-black background, neon green accent color (#39FF14), white headline text",
    headlineColor: "large white condensed uppercase headline",
    priceChip: "solid neon green (#39FF14) pill with black text",
    ctaRibbon: "bold neon green (#39FF14) ribbon with black text",
    brandText: "neon green (#39FF14), condensed uppercase, slightly wider letter spacing",
    typography:
      "heavy condensed sans-serif typography in the style of Bebas Neue, sharp uppercase, tight letter spacing",
    aesthetic: "LUUT SLU brand canonical: premium Caribbean streetwear resale",
  },
  hype: {
    sceneBackground:
      "a gritty dark concrete / asphalt urban backdrop with aggressive neon green (#39FF14) glow RESTRICTED to the background wall behind the product, plus smoke haze and graffiti energy in the far background — coloured light must stay BEHIND the product and never tint or recolour the product itself",
    paletteText:
      "near-black background with neon green (#39FF14) accents, off-white headline text, subtle spray-paint texture",
    headlineColor: "huge off-white condensed uppercase headline with slight grunge edge",
    priceChip: "solid neon green (#39FF14) pill with black text, slightly tilted sticker feel",
    ctaRibbon: "bold neon green (#39FF14) ribbon with black text, stencil-style",
    brandText: "neon green (#39FF14), condensed uppercase, graffiti-tag energy",
    typography:
      "heavy condensed display type (Bebas Neue / Druk), sharp uppercase, tight tracking, streetwear poster energy",
    aesthetic: "streetwear hype-drop flyer, raw, high-energy",
  },
  clean: {
    sceneBackground:
      "a bright neutral off-white seamless studio backdrop with soft diffused neutral daylight and a gentle long shadow",
    paletteText:
      "clean white (#FAFAFA) background, charcoal grey (#1F1F1F) text, a single thin black hairline accent — absolutely no neon green",
    headlineColor: "large charcoal (#1F1F1F) modern sans-serif headline, normal case",
    priceChip: "thin black outlined chip with charcoal text on white",
    ctaRibbon: "slim charcoal underline beneath the CTA text — no coloured ribbon",
    brandText: "charcoal (#1F1F1F), modern sans-serif, generous letter spacing",
    typography:
      "refined modern sans-serif (Inter / Söhne / Helvetica Neue), mixed case, calm hierarchy",
    aesthetic: "minimal editorial product page, lots of negative space",
  },
  luxury: {
    sceneBackground:
      "a warm champagne-gold gradient backdrop with soft golden glow CONTAINED to the background only, subtle marble or velvet surface beneath the product — keep the key light on the product itself NEUTRAL white so the product's true colours, materials and branding are preserved exactly",
    paletteText:
      "deep ivory / warm cream background, metallic gold (#C9A24B) accents, dark espresso (#2A1E14) headline text — no neon green anywhere",
    headlineColor: "elegant dark espresso (#2A1E14) serif headline",
    priceChip: "thin gold (#C9A24B) outlined chip with espresso text on cream",
    ctaRibbon: "slim gold (#C9A24B) underline / wordmark — no bold ribbon",
    brandText: "metallic gold (#C9A24B) refined serif, wide letter spacing",
    typography:
      "elegant high-contrast serif headlines (Playfair Display / Didone) paired with a fine sans-serif for small text",
    aesthetic: "premium boutique / luxury fashion campaign",
  },
  bold: {
    sceneBackground:
      "a stark editorial backdrop with dramatic single-source NEUTRAL white lighting, deep crisp shadows, absolutely no colour cast on the product — let the product's real colours lead",
    paletteText:
      "pure black (#000) and pure white (#FFF) palette with a single high-impact red (#E5251D) accent — no neon green",
    headlineColor: "massive black-on-white (or white-on-black) condensed headline with extreme scale contrast",
    priceChip: "solid red (#E5251D) block with white text",
    ctaRibbon: "solid red (#E5251D) bar with white text, full bleed across the bottom",
    brandText: "black or white depending on background, condensed uppercase, maximum weight",
    typography:
      "ultra-bold condensed display type, brutalist scale contrast, maximum visual punch",
    aesthetic: "high-contrast editorial poster, brutalist fashion campaign",
  },
};

function resolveStyle(key?: PosterStyleKey): { key: PosterStyleKey; preset: StylePreset } {
  const k: PosterStyleKey = key && STYLE_PRESETS[key] ? key : "default";
  return { key: k, preset: STYLE_PRESETS[k] };
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

function buildScenePrompt(title: string, preset: StylePreset): string {
  return [
    `Premium marketing scene featuring the exact product shown in the reference image: ${title}.`,
    `Keep the product 100% accurate — same colors, shape, branding, logos, materials, proportions. Do NOT modify, restyle, or replace the product.`,
    `Place the product as the dramatic hero against ${preset.sceneBackground}.`,
    `Aesthetic: ${preset.aesthetic}. Cinematic product photography, sharp focus on the product, shallow depth of field.`,
    `No text, no logos other than what's on the product, no watermarks, no humans. Square 1:1 framing with generous negative space for typography overlays around the product.`,
  ].join(" ");
}

function buildOverlayPrompt(i: PosterInput, preset: StylePreset): string {
  const brand = (i.brandName || "LUUT SLU").toUpperCase();
  const cta = (i.ctaText || "DM TO COP").toUpperCase();
  const pickup = i.meetupText || "Castries · Gros Islet · Vieux Fort";
  return [
    `Marketing poster using the reference image as the background scene — preserve the product, lighting, composition, and background exactly as shown.`,
    `Visual identity: ${preset.paletteText}. Typography: ${preset.typography}.`,
    `Top of poster: product name "${i.productTitle.toUpperCase()}" as ${preset.headlineColor}.`,
    `Just below the headline: price "${i.productPrice}" as ${preset.priceChip}.`,
    `Center-bottom CTA "${cta}" as ${preset.ctaRibbon}.`,
    `Small uppercase line above the brand: "${pickup}" in a muted tone consistent with the palette.`,
    `Bottom of poster: brand name "${brand}" centered in ${preset.brandText}.`,
    `Stay strictly within the stated palette — do NOT introduce colours outside it (in particular, do not add neon green unless the palette specifies it).`,
    `All text crisp, perfectly spelled, legible, contained inside the poster bounds. No extra captions, no lorem ipsum, no duplicate text.`,
    `Square 1:1 poster. Aesthetic: ${preset.aesthetic}.`,
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

    const { key: styleKey, preset } = resolveStyle(body.posterStyle);

    // -------- Step 1: Flux Kontext -- styled scene around the real product
    const scenePrompt = buildScenePrompt(body.productTitle, preset);
    const fluxOutput = await runReplicate(FLUX_MODEL, {
      prompt: scenePrompt,
      input_image: sourceImageUrl,
      aspect_ratio: "1:1",
      output_format: "png",
      safety_tolerance: 2,
    });
    const sceneUrl = pickUrl(fluxOutput);
    if (!sceneUrl) return json({ error: "Flux Kontext returned no image" }, 502);

    // -------- Step 2: Ideogram v3 Turbo -- add styled text overlay
    const overlayPrompt = buildOverlayPrompt(body, preset);
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
        style: `${styleKey}|flux-kontext+ideogram`,
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
