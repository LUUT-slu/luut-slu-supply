// Image-to-image poster generation via Lovable AI Gateway -> openai/gpt-image-2.
// Takes a product image + prompt and returns an edited poster image directly.
// Saves to marketing_generated_images with campaign_type = 'poster' and
// model_used = 'openai/gpt-image-2'.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/images/edits";
const IMAGE_MODEL = "openai/gpt-image-2";
const BUCKET = "marketing-assets";
const SIGNED_URL_TTL = 60 * 60 * 24 * 365 * 10;

const ALLOWED_ASPECTS = new Set(["1:1", "4:5", "9:16", "16:9", "3:4", "3:2", "2:3"]);

// gpt-image-2 supports a discrete set of canvas sizes; map aspect → nearest.
const SIZE_FOR_ASPECT: Record<string, string> = {
  "1:1": "1024x1024",
  "4:5": "1024x1536",
  "2:3": "1024x1536",
  "3:4": "1024x1536",
  "9:16": "1024x1536",
  "16:9": "1536x1024",
  "3:2": "1536x1024",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function fetchAsBlob(url: string): Promise<Blob> {
  if (url.startsWith("data:")) {
    const m = url.match(/^data:([^;,]+);base64,(.+)$/);
    if (!m) throw new Error("Invalid data URL");
    const ct = m[1] || "image/png";
    const bin = atob(m[2]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: ct });
  }
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Failed to fetch input image (${r.status})`);
  const ct = r.headers.get("content-type") || "image/png";
  const buf = await r.arrayBuffer();
  return new Blob([buf], { type: ct });
}

async function generateViaGateway(
  prompt: string,
  inputImage: Blob,
  size: string,
): Promise<Uint8Array> {
  const ext = inputImage.type.includes("jpeg") ? "jpg"
    : inputImage.type.includes("webp") ? "webp" : "png";
  const form = new FormData();
  form.append("model", IMAGE_MODEL);
  form.append("prompt", prompt);
  form.append("size", size);
  form.append("n", "1");
  form.append("quality", "low");
  form.append("image", inputImage, `input.${ext}`);

  const res = await fetch(AI_GATEWAY, {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}` },
    body: form,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err: any = new Error(`AI Gateway ${res.status}: ${text}`);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  const b64 = data?.data?.[0]?.b64_json;
  if (typeof b64 === "string" && b64.length > 0) return base64ToBytes(b64);

  const url = data?.data?.[0]?.url;
  if (typeof url === "string") {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`Failed to fetch generated image (${r.status})`);
    return new Uint8Array(await r.arrayBuffer());
  }

  throw new Error("AI Gateway returned no image data");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY is not configured" }, 500);

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

    const body = (await req.json().catch(() => ({}))) as {
      imageUrl?: string;
      prompt?: string;
      aspectRatio?: string;
      productTitle?: string;
      campaignType?: string;
      style?: string;
    };

    if (!body.imageUrl) return json({ error: "Missing imageUrl" }, 400);
    if (!body.prompt) return json({ error: "Missing prompt" }, 400);

    const aspectRatio = body.aspectRatio && ALLOWED_ASPECTS.has(body.aspectRatio)
      ? body.aspectRatio
      : "1:1";
    const size = SIZE_FOR_ASPECT[aspectRatio] ?? "1024x1024";

    const inputDataUrl = await fetchAsDataUrl(body.imageUrl);
    const bytes = await generateViaGateway(body.prompt, inputDataUrl, size);

    const path = `poster-i2i-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.png`;
    const up = await admin.storage.from(BUCKET).upload(path, bytes, {
      contentType: "image/png",
      upsert: true,
    });
    if (up.error) throw new Error(`Storage upload failed: ${up.error.message}`);

    const { data: signed, error: signedErr } = await admin.storage
      .from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL);
    if (signedErr || !signed?.signedUrl) {
      throw new Error(`Could not create signed URL: ${signedErr?.message || "unknown"}`);
    }
    const publicUrl = signed.signedUrl;

    try {
      await admin.from("marketing_generated_images").insert({
        image_url: publicUrl,
        thumbnail_url: publicUrl,
        generation_type: "poster",
        campaign_type: "poster",
        product_title: body.productTitle ?? null,
        style: body.style ?? "gpt-image-2|img2img",
        aspect_ratio: aspectRatio,
        prompt_used: body.prompt,
        reference_image_url: body.imageUrl.startsWith("http") ? body.imageUrl : null,
        model_used: IMAGE_MODEL,
        created_by: userId,
      });
    } catch (e) {
      console.warn("marketing_generated_images insert skipped", e);
    }

    return json({ url: publicUrl });
  } catch (e: any) {
    console.error("poster-img2img-gpt error", e);
    const message = e instanceof Error ? e.message : "Unknown error";
    const status = e?.status === 429 ? 429 : e?.status === 402 ? 402 : 500;
    const friendly = e?.status === 429
      ? "Rate limited. Please try again in a moment."
      : e?.status === 402
        ? "Lovable AI credits exhausted. Please top up your workspace credits."
        : message;
    return json({ error: friendly, detail: message }, status);
  }
});
