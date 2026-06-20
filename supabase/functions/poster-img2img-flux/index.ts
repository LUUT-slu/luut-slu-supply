// Image-to-image poster generation via Replicate flux-kontext-pro.
// Takes a product image + prompt, returns a styled poster image directly.
// Saves to marketing_generated_images with campaign_type = 'poster'.

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
const BUCKET = "marketing-assets";
const SIGNED_URL_TTL = 60 * 60 * 24 * 365 * 10;

const ALLOWED_ASPECTS = new Set(["1:1", "4:5", "9:16", "16:9", "3:4", "3:2", "2:3"]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function runReplicate(model: string, input: Record<string, unknown>) {
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
    const retryAfter = createRes.headers.get("retry-after");
    let waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 0;
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
  if (!m) throw new Error("Invalid data URL for image");
  const contentType = m[1] || "image/png";
  const bin = atob(m[2]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return uploadBytesToBucket(admin, bytes, contentType, "poster-src");
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

    const body = await req.json().catch(() => ({})) as {
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

    let inputImage = body.imageUrl;
    if (inputImage.startsWith("data:")) {
      inputImage = await dataUrlToHostedUrl(admin, inputImage);
    } else if (!/^https?:\/\//i.test(inputImage)) {
      return json({ error: "imageUrl must be http(s) or data URL" }, 400);
    }

    const output = await runReplicate(FLUX_MODEL, {
      prompt: body.prompt,
      input_image: inputImage,
      aspect_ratio: aspectRatio,
      output_format: "png",
      safety_tolerance: 2,
    });
    const resultUrl = pickUrl(output);
    if (!resultUrl) return json({ error: "Flux Kontext returned no image" }, 502);

    const imgRes = await fetch(resultUrl);
    if (!imgRes.ok) return json({ error: `Failed to download generated image: ${imgRes.status}` }, 502);
    const contentType = imgRes.headers.get("content-type") || "image/png";
    const bytes = new Uint8Array(await imgRes.arrayBuffer());
    const publicUrl = await uploadBytesToBucket(admin, bytes, contentType, "poster-i2i");

    try {
      await admin.from("marketing_generated_images").insert({
        image_url: publicUrl,
        thumbnail_url: publicUrl,
        generation_type: "poster",
        campaign_type: "poster",
        product_title: body.productTitle ?? null,
        style: body.style ?? "flux-kontext-pro|img2img",
        aspect_ratio: aspectRatio,
        prompt_used: body.prompt,
        created_by: userId,
      });
    } catch (e) {
      console.warn("marketing_generated_images insert skipped", e);
    }

    return json({ url: publicUrl });
  } catch (e: any) {
    console.error("poster-img2img-flux error", e);
    const message = e instanceof Error ? e.message : "Unknown error";
    if (e?.status === 402 || /insufficient credit|billing/i.test(message)) {
      return json({ error: "Replicate account has insufficient credit. Top up at https://replicate.com/account/billing" }, 402);
    }
    return json({ error: message }, 500);
  }
});
