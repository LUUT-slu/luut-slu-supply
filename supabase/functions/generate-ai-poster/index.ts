// Two-step poster pipeline with product-derived palette:
//   1) Flux Kontext Pro — wraps the real product image in a styled scene
//      using the product's own colours (no neon green / gold / red unless
//      they actually exist in the product).
//   2) Ideogram v3 Turbo — overlays LUUT SLU branded text using the same
//      product-derived palette.
//
// Square 1:1 only for now. Admin-only.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decode as decodeImage, Image } from "https://deno.land/x/imagescript@1.2.17/mod.ts";

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
  productImageUrl: string;
  productImageUrls?: string[]; // optional multi-reference (up to 4)
  ctaText?: string;
  brandName?: string;
  meetupText?: string;
  customInstructions?: string | null;
  posterStyle?: PosterStyleKey;
}

interface ProductPalette {
  dominant: string;   // hex e.g. "#1a1a1a"
  secondary: string;
  accent: string;
  isDark: boolean;    // dominant luminance < 0.5
  description: string; // human-readable colour name for prompt clarity
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

// ---------- Palette extraction ----------

function toHex(r: number, g: number, b: number): string {
  const h = (n: number) => n.toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`.toUpperCase();
}

function luminance(r: number, g: number, b: number): number {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function rgbFromHex(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function saturation(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  if (max === 0) return 0;
  return (max - min) / max;
}

function describeColor(hex: string): string {
  const [r, g, b] = rgbFromHex(hex);
  const lum = luminance(r, g, b);
  const sat = saturation(r, g, b);
  if (sat < 0.12) {
    if (lum < 0.12) return "near-black";
    if (lum < 0.35) return "dark grey";
    if (lum > 0.88) return "near-white";
    if (lum > 0.65) return "light grey";
    return "mid grey";
  }
  const max = Math.max(r, g, b);
  let hue = "";
  if (max === r && g >= b) hue = g > 150 ? "yellow-orange" : "red";
  else if (max === r) hue = "red-magenta";
  else if (max === g && r >= b) hue = "yellow-green";
  else if (max === g) hue = "green";
  else if (max === b && r >= g) hue = "purple";
  else hue = "blue";
  const tone = lum < 0.3 ? "deep" : lum > 0.7 ? "light" : "mid";
  return `${tone} ${hue}`;
}

async function extractPalette(imageUrl: string): Promise<ProductPalette> {
  const fallback: ProductPalette = {
    dominant: "#1A1A1A",
    secondary: "#FAFAFA",
    accent: "#888888",
    isDark: true,
    description: "neutral dark",
  };
  try {
    const res = await fetch(imageUrl);
    if (!res.ok) return fallback;
    const buf = new Uint8Array(await res.arrayBuffer());
    const decoded = await decodeImage(buf);
    const img = decoded instanceof Image ? decoded : (decoded as unknown as Image);
    // downscale for speed
    const target = 64;
    img.resize(target, target);

    // Bucketed histogram (4-bit per channel = 4096 buckets)
    const buckets = new Map<number, { count: number; r: number; g: number; b: number }>();
    const w = img.width, h = img.height;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const px = img.getPixelAt(x + 1, y + 1); // imagescript is 1-indexed
        const r = (px >>> 24) & 0xff;
        const g = (px >>> 16) & 0xff;
        const b = (px >>> 8) & 0xff;
        const a = px & 0xff;
        if (a < 128) continue;
        // skip near-white / near-black backdrop pixels around outer edge
        const edge = x < 4 || y < 4 || x > w - 5 || y > h - 5;
        const lum = luminance(r, g, b);
        if (edge && (lum > 0.92 || lum < 0.06)) continue;
        const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
        const cur = buckets.get(key);
        if (cur) {
          cur.count++; cur.r += r; cur.g += g; cur.b += b;
        } else {
          buckets.set(key, { count: 1, r, g, b });
        }
      }
    }
    const sorted = [...buckets.values()]
      .map((v) => ({
        count: v.count,
        r: Math.round(v.r / v.count),
        g: Math.round(v.g / v.count),
        b: Math.round(v.b / v.count),
      }))
      .sort((a, b) => b.count - a.count);

    if (sorted.length === 0) return fallback;

    const dom = sorted[0];
    // secondary: most different by RGB distance from dominant, within top 12
    const distinct = (a: typeof dom, b: typeof dom) =>
      Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b);
    const pool = sorted.slice(1, 12);
    const sec = pool.sort((a, b) => distinct(b, dom) - distinct(a, dom))[0] || dom;
    // accent: most saturated within top 20 (excluding dominant)
    const acc = sorted.slice(1, 20)
      .map((c) => ({ ...c, s: saturation(c.r, c.g, c.b) }))
      .sort((a, b) => b.s - a.s)[0] || sec;

    const domHex = toHex(dom.r, dom.g, dom.b);
    const secHex = toHex(sec.r, sec.g, sec.b);
    const accHex = toHex(acc.r, acc.g, acc.b);
    return {
      dominant: domHex,
      secondary: secHex,
      accent: accHex,
      isDark: luminance(dom.r, dom.g, dom.b) < 0.5,
      description: describeColor(domHex),
    };
  } catch (e) {
    console.warn("extractPalette failed", e);
    return fallback;
  }
}

// ---------- Style presets (palette-driven) ----------

function stylePreset(key: PosterStyleKey, p: ProductPalette): StylePreset {
  const bgContrast = p.isDark ? "#FAFAFA" : "#0E0E0E";
  const textOnBg = p.isDark ? "off-white" : "near-black";

  switch (key) {
    case "default":
      return {
        sceneBackground: p.isDark
          ? `a deep matte studio backdrop in a darker shade of the product's dominant colour (${p.dominant}), with a soft glow tinted ${p.accent} CONFINED to the wall behind the product — never wrapping onto the product`
          : `a clean studio backdrop in a slightly darker, desaturated version of the product's dominant colour (${p.dominant}), with a soft ${p.accent} glow on the backdrop only`,
        paletteText: `palette strictly derived from the product itself — dominant ${p.dominant}, secondary ${p.secondary}, accent ${p.accent}. NO neon green, NO gold, NO red unless those colours are already in the palette.`,
        headlineColor: `large condensed uppercase headline in ${textOnBg} (${bgContrast})`,
        priceChip: `solid pill in ${p.accent} with contrasting text`,
        ctaRibbon: `bold ribbon in ${p.accent} with contrasting text`,
        brandText: `${p.accent}, condensed uppercase, slightly wider letter spacing`,
        typography: "heavy condensed sans-serif (Bebas Neue style), sharp uppercase, tight letter spacing",
        aesthetic: "LUUT SLU brand canonical: premium Caribbean streetwear resale",
      };
    case "hype":
      return {
        sceneBackground: `a gritty dark concrete / asphalt urban backdrop tinted with the product's dominant colour (${p.dominant}), with an aggressive ${p.accent} glow RESTRICTED to the background wall — coloured light never tints the product itself`,
        paletteText: `palette strictly from the product — dominant ${p.dominant}, accent ${p.accent}, neutrals for text. NO neon green unless the product is actually neon green.`,
        headlineColor: `huge ${textOnBg} condensed uppercase headline with slight grunge edge`,
        priceChip: `solid pill in ${p.accent} with contrasting text, slightly tilted sticker feel`,
        ctaRibbon: `bold stencil-style ribbon in ${p.accent}`,
        brandText: `${p.accent}, condensed uppercase, graffiti-tag energy`,
        typography: "heavy condensed display type (Bebas Neue / Druk), tight tracking, streetwear poster energy",
        aesthetic: "streetwear hype-drop flyer, raw, high-energy",
      };
    case "clean":
      return {
        sceneBackground: `a bright neutral off-white (#FAFAFA) seamless studio backdrop with soft diffused neutral daylight and a gentle long shadow — no colour cast`,
        paletteText: `palette: clean white (#FAFAFA) background, charcoal (#1F1F1F) text, single thin hairline accent in ${p.accent} (derived from the product). NO other colours.`,
        headlineColor: `large charcoal (#1F1F1F) modern sans-serif headline, normal case`,
        priceChip: `thin charcoal-outlined chip with charcoal text on white`,
        ctaRibbon: `slim ${p.accent} underline beneath the CTA text — no full ribbon`,
        brandText: `charcoal (#1F1F1F), modern sans-serif, generous letter spacing`,
        typography: "refined modern sans-serif (Inter / Söhne / Helvetica Neue), mixed case, calm hierarchy",
        aesthetic: "minimal editorial product page, lots of negative space",
      };
    case "luxury":
      return {
        sceneBackground: `a soft gradient backdrop built from a desaturated, slightly warmed version of the product's dominant colour (${p.dominant}), with a subtle marble or velvet surface beneath the product — keep the key light on the product itself NEUTRAL white. NO forced gold unless ${p.dominant} or ${p.accent} are actually gold/warm.`,
        paletteText: `palette: muted desaturated ${p.dominant} background, refined ${p.accent} accents, ${p.isDark ? "ivory" : "deep espresso"} text. Stay strictly inside this product-derived palette.`,
        headlineColor: `elegant ${p.isDark ? "ivory" : "deep espresso (#2A1E14)"} serif headline`,
        priceChip: `thin ${p.accent} outlined chip with ${p.isDark ? "ivory" : "espresso"} text`,
        ctaRibbon: `slim ${p.accent} underline / wordmark — no bold ribbon`,
        brandText: `${p.accent} refined serif, wide letter spacing`,
        typography: "elegant high-contrast serif headlines (Playfair Display / Didone) paired with a fine sans-serif for small text",
        aesthetic: "premium boutique / luxury fashion campaign",
      };
    case "bold":
      return {
        sceneBackground: `a stark editorial backdrop in ${p.isDark ? "pure white (#FFFFFF)" : "pure black (#000000)"} with dramatic single-source NEUTRAL white lighting and deep crisp shadows — no colour cast on the product, let the product's real colours lead`,
        paletteText: `palette: pure ${p.isDark ? "white (#FFF) and near-black for type" : "black (#000) and white (#FFF)"} with a SINGLE high-impact accent in ${p.accent} (taken from the product itself). NO red unless ${p.accent} is red.`,
        headlineColor: `massive ${p.isDark ? "black-on-white" : "white-on-black"} condensed headline with extreme scale contrast`,
        priceChip: `solid block in ${p.accent} with contrasting text`,
        ctaRibbon: `solid bar in ${p.accent} with contrasting text, full bleed across the bottom`,
        brandText: `${p.isDark ? "black" : "white"}, condensed uppercase, maximum weight`,
        typography: "ultra-bold condensed display type, brutalist scale contrast, maximum visual punch",
        aesthetic: "high-contrast editorial poster, brutalist fashion campaign",
      };
  }
}

function resolveStyleKey(key?: PosterStyleKey): PosterStyleKey {
  return key && ["default", "hype", "clean", "luxury", "bold"].includes(key) ? key : "default";
}

// ---------- Replicate ----------

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function runReplicate(model: string, input: Record<string, unknown>): Promise<unknown> {
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

// Normalize any incoming reference (data: or http(s)) to a hosted https URL.
async function normalizeRefUrl(
  admin: ReturnType<typeof createClient>,
  url: string,
): Promise<string> {
  if (url.startsWith("data:")) return dataUrlToHostedUrl(admin, url);
  if (/^https?:\/\//i.test(url)) return url;
  throw new Error("Reference image must be an http(s) URL or data URL");
}

// Composite up to 4 reference images into a single 1024x1024 grid so
// Flux Kontext can see every angle / detail in a single input_image.
// Returns a hosted signed URL.
async function compositeReferences(
  admin: ReturnType<typeof createClient>,
  urls: string[],
): Promise<string> {
  const size = 1024;
  const canvas = new Image(size, size);
  // Fill with white background — use the built-in fill (single native op) instead
  // of a 1M-iteration JS loop that blows past the edge runtime CPU limit.
  canvas.fill(0xffffffff);

  // Decide grid based on count
  const n = Math.min(urls.length, 4);
  const cells: Array<{ x: number; y: number; w: number; h: number }> = [];
  if (n === 1) {
    cells.push({ x: 0, y: 0, w: size, h: size });
  } else if (n === 2) {
    cells.push({ x: 0, y: 0, w: size / 2, h: size });
    cells.push({ x: size / 2, y: 0, w: size / 2, h: size });
  } else {
    // 3 or 4 -> 2x2 grid (3 leaves the 4th cell blank/white)
    cells.push({ x: 0, y: 0, w: size / 2, h: size / 2 });
    cells.push({ x: size / 2, y: 0, w: size / 2, h: size / 2 });
    cells.push({ x: 0, y: size / 2, w: size / 2, h: size / 2 });
    cells.push({ x: size / 2, y: size / 2, w: size / 2, h: size / 2 });
  }

  for (let i = 0; i < n; i++) {
    const cell = cells[i];
    try {
      const res = await fetch(urls[i]);
      if (!res.ok) continue;
      const buf = new Uint8Array(await res.arrayBuffer());
      const decoded = await decodeImage(buf);
      const ref = decoded instanceof Image ? decoded : (decoded as unknown as Image);
      // Contain-fit into the cell, preserve aspect ratio.
      const scale = Math.min(cell.w / ref.width, cell.h / ref.height);
      const dw = Math.max(1, Math.round(ref.width * scale));
      const dh = Math.max(1, Math.round(ref.height * scale));
      ref.resize(dw, dh);
      const ox = Math.round(cell.x + (cell.w - dw) / 2);
      const oy = Math.round(cell.y + (cell.h - dh) / 2);
      canvas.composite(ref, ox, oy);
    } catch (e) {
      console.warn("compositeReferences cell failed", i, e);
    }
  }

  const png = await canvas.encode();
  return uploadBytesToBucket(admin, png, "image/png", "poster-refsheet");
}

// ---------- Prompts ----------

function buildScenePrompt(title: string, preset: StylePreset, p: ProductPalette): string {
  return [
    `Premium marketing scene featuring the EXACT product shown in the reference image: ${title}.`,
    `CRITICAL PRODUCT FIDELITY: the product must appear pixel-accurate to the reference. Preserve its exact colours, hue, saturation, brightness, material, texture, logos, branding, stitching, shape and proportions. Do NOT recolour, restyle, retexture, or replace the product.`,
    `Light the product with a NEUTRAL white softbox key light (around 5500K) so its true colours are preserved. Any coloured ambient light, glow, haze or gel from the scene must stay BEHIND the product on the backdrop only — never wrapping onto the product surface.`,
    `Scene / backdrop (around and behind the product): ${preset.sceneBackground}.`,
    `PRODUCT-DERIVED PALETTE (do not violate): dominant ${p.dominant} (${p.description}), secondary ${p.secondary}, accent ${p.accent}. Do NOT introduce colours outside this palette — specifically no neon green, no gold, no red unless those hexes are already in this palette.`,
    `Aesthetic: ${preset.aesthetic}. Cinematic product photography, sharp focus on the product, shallow depth of field.`,
    `No text, no extra logos, no watermarks, no humans, no props that obscure the product. Square 1:1 framing with generous negative space for typography overlays.`,
  ].join(" ");
}

function buildOverlayPrompt(i: PosterInput, preset: StylePreset, p: ProductPalette): string {
  const brand = (i.brandName || "LUUT SLU").toUpperCase();
  const cta = (i.ctaText || "DM TO COP").toUpperCase();
  const pickup = i.meetupText || "Castries · Gros Islet · Vieux Fort";
  return [
    `Marketing poster using the reference image as the background scene — preserve the product, lighting, composition and background exactly as shown.`,
    `PRODUCT-DERIVED PALETTE (mandatory): dominant ${p.dominant} (${p.description}), secondary ${p.secondary}, accent ${p.accent}. Use ONLY these colours plus neutral black/white for typography. Do NOT introduce any other colour — no neon green, no gold, no red unless those hexes appear above.`,
    `Visual identity: ${preset.paletteText}. Typography: ${preset.typography}.`,
    `Top of poster: product name "${i.productTitle.toUpperCase()}" as ${preset.headlineColor}.`,
    `Just below the headline: price "${i.productPrice}" as ${preset.priceChip}.`,
    `Center-bottom CTA "${cta}" as ${preset.ctaRibbon}.`,
    `Small uppercase line above the brand: "${pickup}" in a muted tone consistent with the palette.`,
    `Bottom of poster: brand name "${brand}" centered in ${preset.brandText}.`,
    `All text crisp, perfectly spelled, legible, contained inside the poster bounds. No extra captions, no lorem ipsum, no duplicate text.`,
    `Square 1:1 poster. Aesthetic: ${preset.aesthetic}.`,
    i.customInstructions?.trim() ? i.customInstructions.trim() : "",
  ].filter(Boolean).join(" ");
}

// ---------- Handler ----------

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

    // Collect all reference images. Prefer productImageUrls when provided,
    // otherwise fall back to the single productImageUrl.
    const rawRefs = Array.isArray(body.productImageUrls) && body.productImageUrls.length > 0
      ? body.productImageUrls.slice(0, 4)
      : [body.productImageUrl];

    const hostedRefs: string[] = [];
    for (const r of rawRefs) {
      try {
        hostedRefs.push(await normalizeRefUrl(admin, r));
      } catch (e) {
        console.warn("skip bad ref", e);
      }
    }
    if (hostedRefs.length === 0) {
      return json({ error: "No valid reference images" }, 400);
    }

    // Build the Flux input image: composite multiple refs into a single sheet
    // so Flux Kontext sees every angle. Single-ref case stays as the raw URL.
    const fluxInputImage =
      hostedRefs.length === 1
        ? hostedRefs[0]
        : await compositeReferences(admin, hostedRefs);

    // Palette extracted from the first (primary) reference — that's the
    // canonical product photo.
    const styleKey = resolveStyleKey(body.posterStyle);
    const palette = await extractPalette(hostedRefs[0]);
    const preset = stylePreset(styleKey, palette);

    // Step 1: Flux Kontext — styled scene around the real product
    const multiRefNote =
      hostedRefs.length > 1
        ? ` The reference image is a sheet of ${hostedRefs.length} photos of the SAME product from different angles — combine them into a single coherent product in the scene.`
        : "";
    const scenePrompt = buildScenePrompt(body.productTitle, preset, palette) + multiRefNote;
    const fluxOutput = await runReplicate(FLUX_MODEL, {
      prompt: scenePrompt,
      input_image: fluxInputImage,
      aspect_ratio: "1:1",
      output_format: "png",
      safety_tolerance: 2,
    });
    const sceneUrl = pickUrl(fluxOutput);
    if (!sceneUrl) return json({ error: "Flux Kontext returned no image" }, 502);

    // Step 2: Ideogram v3 Turbo — typography overlay
    const overlayPrompt = buildOverlayPrompt(body, preset, palette);
    const ideogramOutput = await runReplicate(IDEOGRAM_MODEL, {
      prompt: overlayPrompt,
      aspect_ratio: "1:1",
      style_type: "Auto",
      magic_prompt_option: "On",
      style_reference_images: [sceneUrl],
    });
    const finalUrl = pickUrl(ideogramOutput);
    if (!finalUrl) return json({ error: "Ideogram returned no image" }, 502);

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
        campaign_type: "ai_poster",
        product_title: body.productTitle,
        style: `${styleKey}|${palette.dominant},${palette.accent}|flux-kontext+ideogram`,
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
      palette,
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
