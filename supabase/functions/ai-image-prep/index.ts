// Edge function: AI-assisted image preparation for Marketing Studio.
// Powered by the Lovable AI Gateway (Nano Banana / Gemini image editing).
//
// Modes:
//   - "remove-bg" : remove background, keep product intact
//   - "expand"    : outpaint to fit a target aspect ratio
//
// Persists the result to the `marketing-assets` bucket and registers it
// in `marketing_generated_images` with the supplied campaign_type
// ('poster' or 'display'). Admin-only.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const AI_GATEWAY_CHAT = "https://ai.gateway.lovable.dev/v1/chat/completions";
const IMAGE_MODEL = "google/gemini-3-pro-image";
const BUCKET = "marketing-assets";
const SIGNED_URL_TTL = 60 * 60 * 24 * 365 * 10;

type PrepMode = "remove-bg" | "expand";
type Format = "story" | "post" | "ad" | "portrait";
type CampaignType = "poster" | "display";

const ASPECT_RATIO: Record<Format, string> = {
  story: "9:16",
  post: "1:1",
  ad: "16:9",
  portrait: "4:5",
};

function buildPrompt(mode: PrepMode, format: Format): string {
  if (mode === "remove-bg") {
    return "Remove the background completely and replace it with a clean, solid pure white background (#FFFFFF). Preserve the product's exact identity — same shape, colors, branding, logos, materials, proportions, and details. Do not alter, restyle, or redesign the product. Edge-clean cutout, no halo, soft natural shadow optional.";
  }
  // expand
  const ar = ASPECT_RATIO[format];
  return `Outpaint the image so the final composition fits a ${ar} aspect ratio. Naturally extend the existing background, lighting, and scene to fill the new canvas. Do not alter the product itself — same position, size, colors, shape, branding, and proportions. The product must remain the clear hero. Seamless background continuation only.`;
}

async function generateGemini(
  model: string,
  prompt: string,
  imageUrl: string,
): Promise<Uint8Array> {
  // Gemini image editing uses chat-completions multimodal shape.
  const res = await fetch(AI_GATEWAY_CHAT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
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
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err: any = new Error(`AI Gateway ${res.status}: ${text}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();

  // Normalized OpenAI-images shape.
  const directB64 = data?.data?.[0]?.b64_json;
  if (typeof directB64 === "string" && directB64.length > 0) {
    return base64ToBytes(directB64);
  }
  // Chat-completion shape: image is on choices[0].message.images[].image_url.url
  const choice = data?.choices?.[0]?.message;
  const imgFromImages = choice?.images?.[0]?.image_url?.url;
  if (typeof imgFromImages === "string") return dataUrlOrUrlToBytes(imgFromImages);
  if (Array.isArray(choice?.content)) {
    for (const block of choice.content) {
      const url = block?.image_url?.url;
      if (typeof url === "string") return dataUrlOrUrlToBytes(url);
    }
  }
  throw new Error("Gemini image edit returned no image data");
}

async function generateImage(
  prompt: string,
  imageUrl: string,
): Promise<Uint8Array> {
  return generateGemini(IMAGE_MODEL, prompt, imageUrl);
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function dataUrlOrUrlToBytes(url: string): Promise<Uint8Array> {
  if (url.startsWith("data:")) {
    const m = url.match(/^data:[^;,]+;base64,(.+)$/);
    if (!m) throw new Error("Malformed data URL from AI Gateway");
    return base64ToBytes(m[1]);
  }
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Failed to fetch generated image (${r.status})`);
  return new Uint8Array(await r.arrayBuffer());
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!LOVABLE_API_KEY) {
      return json({ error: "LOVABLE_API_KEY is not configured" }, 500);
    }

    // Admin auth via bearer token.
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: userRes } = await admin.auth.getUser(token);
    const userId = userRes?.user?.id;
    if (!userId) return json({ error: "Unauthorized" }, 401);

    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const isAdmin = roles?.some((r: { role: string }) => r.role === "admin");
    if (!isAdmin) return json({ error: "Admin access required" }, 403);

    const body = await req.json().catch(() => null);
    const imageUrl: string | undefined = body?.imageUrl;
    const mode: PrepMode | undefined = body?.mode;
    const format: Format = body?.format ?? "post";
    const rawCampaign = (body?.campaignType ?? "").toString().toLowerCase();
    const campaignType: CampaignType = rawCampaign === "display" ? "display" : "poster";
    const productTitle: string | undefined = body?.productTitle;
    const promptOverride: string | undefined =
      typeof body?.prompt === "string" && body.prompt.trim() ? body.prompt.trim() : undefined;
    const aspectOverride: string | undefined =
      typeof body?.aspectRatio === "string" && /^\d+:\d+$/.test(body.aspectRatio)
        ? body.aspectRatio
        : undefined;

    if (!imageUrl || typeof imageUrl !== "string") {
      return json({ error: "imageUrl is required" }, 400);
    }
    if (mode !== "remove-bg" && mode !== "expand") {
      return json({ error: "mode must be 'remove-bg' or 'expand'" }, 400);
    }

    const basePrompt = promptOverride ?? buildPrompt(mode, format);
    const resolvedAspect = aspectOverride ?? ASPECT_RATIO[format];
    const prompt =
      mode === "expand" && !/aspect ratio/i.test(basePrompt)
        ? `${basePrompt} Compose the final image strictly in a ${resolvedAspect} aspect ratio frame.`
        : basePrompt;
    const bytes = await generateImage(prompt, imageUrl);

    // Persist to storage.
    const path = `prep-${mode}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.png`;
    const { error: uploadErr } = await admin.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: "image/png", upsert: true });
    if (uploadErr) throw new Error(`Storage upload failed: ${uploadErr.message}`);

    const { data: signed, error: signErr } = await admin.storage
      .from(BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL);
    if (signErr || !signed?.signedUrl) {
      throw new Error(`Signed URL failed: ${signErr?.message || "unknown"}`);
    }
    const publicUrl = signed.signedUrl;

    // Register in library — always set campaign_type ('poster' or 'display').
    try {
      await admin.from("marketing_generated_images").insert({
        image_url: publicUrl,
        thumbnail_url: publicUrl,
        generation_type: mode === "remove-bg" ? "prep-remove-bg" : "prep-expand",
        campaign_type: campaignType,
        product_title: productTitle || null,
        style: mode,
        aspect_ratio: resolvedAspect,
        prompt_used: prompt,
        reference_image_url: imageUrl.startsWith("http") ? imageUrl : null,
        model_used: IMAGE_MODEL,
        created_by: userId,
      });
    } catch (e) {
      console.warn("[ai-image-prep] library insert skipped", e);
    }

    return json({ url: publicUrl });
  } catch (e: any) {
    console.error("ai-image-prep error:", e);
    const status = e?.status === 429 ? 429 : 500;
    const msg = e?.status === 429
      ? "Rate limited. Please try again in a moment."
      : e?.status === 402
        ? "Lovable AI credits exhausted. Please top up your workspace credits."
        : "AI image preparation failed";
    return json({ error: msg, detail: e?.message }, status);
  }
});
