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
const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_KEY")!;
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const CLAUDE_MODEL = "claude-sonnet-4-6";
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

interface PosterPlan {
  background: string;
  accent: string;
  text: string;
  muted: string;
  surface: string;
  mood: string;
  layout: "portrait" | "square" | "wide";
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

async function planPosterWithClaude(input: PosterInput, prompt: string): Promise<{ prompt: string; plan: PosterPlan }> {
  if (!ANTHROPIC_KEY) throw new Error("Claude is not configured");

  const aspect = mapAspect(input.aspectRatio);
  const fallbackPlan: PosterPlan = {
    background: input.posterStyle === "clean" ? "#f8fafc" : input.posterStyle === "luxury" ? "#07111f" : "#050505",
    accent: input.posterStyle === "luxury" ? "#c9a84c" : input.posterStyle === "bold" ? "#ff2d78" : "#39ff7a",
    text: input.posterStyle === "clean" ? "#111827" : "#ffffff",
    muted: input.posterStyle === "clean" ? "#6b7280" : "#d1d5db",
    surface: input.posterStyle === "clean" ? "#ffffff" : "#111111",
    mood: input.posterStyle,
    layout: aspect.ratio === "16:9" ? "wide" : aspect.ratio === "1:1" ? "square" : "portrait",
  };

  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 1000,
      temperature: 0.3,
      system:
        "You are the only AI brain for Luut SLU marketing automation. Convert poster requests into a concrete design plan. Return only valid JSON with keys prompt and plan. plan must include background, accent, text, muted, surface, mood, and layout. Use hex colors. Preserve required text exactly.",
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Claude ${res.status}: ${text}`);
  }

  const data = await res.json();
  const text = data?.content
    ?.filter((part: { type?: string; text?: string }) => part?.type === "text" && part.text)
    .map((part: { text: string }) => part.text)
    .join("\n")
    .trim();

  if (!text) return { prompt, plan: fallbackPlan };

  try {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    const parsed = JSON.parse(start >= 0 && end > start ? text.slice(start, end + 1) : text);
    return {
      prompt: typeof parsed.prompt === "string" ? parsed.prompt : prompt,
      plan: { ...fallbackPlan, ...(parsed.plan || {}) },
    };
  } catch {
    return { prompt: text || prompt, plan: fallbackPlan };
  }
}

async function fetchProductDataUrl(productImageUrl?: string): Promise<string | null> {
  if (!productImageUrl) return null;
  try {
    const res = await fetch(productImageUrl);
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "image/png";
    const bytes = new Uint8Array(await res.arrayBuffer());
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return `data:${contentType};base64,${btoa(binary)}`;
  } catch {
    return null;
  }
}

function escapeXml(value: string | null | undefined): string {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function generatePosterSvg(input: PosterInput, plan: PosterPlan, productDataUrl: string | null): string {
  const aspect = mapAspect(input.aspectRatio);
  const [width, height] = aspect.dimensions.split("×").map((n) => Number(n));
  const isWide = width > height;
  const pad = isWide ? 72 : 86;
  const heroSize = isWide ? Math.min(width * 0.42, height * 0.74) : Math.min(width * 0.72, height * 0.44);
  const titleSize = isWide ? 78 : input.aspectRatio === "1:1" ? 82 : 104;
  const titleY = isWide ? pad + 92 : pad + 132;
  const heroX = isWide ? width - pad - heroSize : (width - heroSize) / 2;
  const heroY = isWide ? (height - heroSize) / 2 : height * 0.34;
  const textWidth = isWide ? width * 0.48 : width - pad * 2;
  const ctaY = height - pad - 86;

  const bg = escapeXml(plan.background);
  const accent = escapeXml(plan.accent);
  const text = escapeXml(plan.text);
  const muted = escapeXml(plan.muted);
  const surface = escapeXml(plan.surface);
  const title = escapeXml(input.productTitle);
  const brand = escapeXml(input.brandName);
  const price = escapeXml(input.productPrice);
  const cta = escapeXml(input.ctaText);
  const meetup = escapeXml(input.meetupText);
  const urgency = escapeXml(input.urgencyText);
  const tagline = escapeXml(input.tagline || "");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <radialGradient id="glow" cx="50%" cy="42%" r="70%"><stop offset="0%" stop-color="${accent}" stop-opacity="0.35"/><stop offset="48%" stop-color="${bg}" stop-opacity="0.88"/><stop offset="100%" stop-color="${bg}"/></radialGradient>
    <filter id="shadow" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy="28" stdDeviation="28" flood-color="#000000" flood-opacity="0.42"/></filter>
  </defs>
  <rect width="${width}" height="${height}" fill="${bg}"/>
  <rect width="${width}" height="${height}" fill="url(#glow)"/>
  <text x="${pad}" y="${pad}" fill="${text}" font-family="Inter,Arial,sans-serif" font-size="34" font-weight="900" letter-spacing="4">${brand.toUpperCase()}</text>
  <rect x="${width - pad - 285}" y="${pad - 34}" width="285" height="58" rx="29" fill="${accent}"/>
  <text x="${width - pad - 142}" y="${pad + 5}" text-anchor="middle" fill="${bg}" font-family="Inter,Arial,sans-serif" font-size="22" font-weight="900">${urgency.toUpperCase()}</text>
  <foreignObject x="${pad}" y="${titleY}" width="${textWidth}" height="${isWide ? 230 : 330}"><div xmlns="http://www.w3.org/1999/xhtml" style="font-family:Inter,Arial,sans-serif;color:${text};font-size:${titleSize}px;line-height:.92;font-weight:900;text-transform:uppercase;letter-spacing:0;word-break:break-word;">${title}</div></foreignObject>
  ${tagline ? `<text x="${pad}" y="${titleY + (isWide ? 260 : 360)}" fill="${muted}" font-family="Inter,Arial,sans-serif" font-size="34" font-weight="700">${tagline}</text>` : ""}
  <circle cx="${heroX + heroSize / 2}" cy="${heroY + heroSize / 2}" r="${heroSize / 1.9}" fill="${accent}" opacity="0.18"/>
  <rect x="${heroX}" y="${heroY}" width="${heroSize}" height="${heroSize}" rx="${Math.round(heroSize * 0.08)}" fill="${surface}" filter="url(#shadow)"/>
  ${productDataUrl ? `<image href="${productDataUrl}" x="${heroX + 26}" y="${heroY + 26}" width="${heroSize - 52}" height="${heroSize - 52}" preserveAspectRatio="xMidYMid meet"/>` : `<text x="${heroX + heroSize / 2}" y="${heroY + heroSize / 2}" text-anchor="middle" fill="${muted}" font-family="Inter,Arial,sans-serif" font-size="34" font-weight="800">${title}</text>`}
  <rect x="${pad}" y="${ctaY - 108}" width="${Math.min(350, textWidth)}" height="76" rx="20" fill="${accent}"/>
  <text x="${pad + Math.min(350, textWidth) / 2}" y="${ctaY - 58}" text-anchor="middle" fill="${bg}" font-family="Inter,Arial,sans-serif" font-size="42" font-weight="900">${price}</text>
  <text x="${pad}" y="${ctaY - 4}" fill="${muted}" font-family="Inter,Arial,sans-serif" font-size="28" font-weight="700">${meetup}</text>
  <rect x="${pad}" y="${ctaY + 20}" width="${width - pad * 2}" height="86" rx="43" fill="${accent}"/>
  <text x="${width / 2}" y="${ctaY + 75}" text-anchor="middle" fill="${bg}" font-family="Inter,Arial,sans-serif" font-size="34" font-weight="900">${cta.toUpperCase()}</text>
</svg>`;
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

    const { prompt: fullPrompt, plan } = await planPosterWithClaude(body, buildPrompt(body));
    const productDataUrl = await fetchProductDataUrl(body.productImageUrl);
    const svg = generatePosterSvg(body, plan, productDataUrl);
    const bytes = new TextEncoder().encode(svg);
    const path = `ai-poster-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.png`;

    const upload = await admin.storage.from(BUCKET).upload(path, bytes, {
      contentType: "image/svg+xml",
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
