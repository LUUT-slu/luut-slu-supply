// Marketing Studio unified generation endpoint.
// One entry point — the client tells us the routed { model, prompt, ... }
// and we call Replicate, persist the result to `marketing-assets`, and
// register it in `marketing_generated_images`.
//
// Supported models (all via Replicate):
//   - ideogram-ai/ideogram-v3-quality
//   - google/imagen-4
//   - sourceful/riverflow-2.0-pro
//   - google/nano-banana-pro
//
// Admin-only.

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
const BUCKET = "marketing-assets";
const SIGNED_URL_TTL = 60 * 60 * 24 * 365 * 10;

const SUPPORTED_MODELS = new Set([
  "ideogram-ai/ideogram-v3-quality",
  "google/imagen-4",
  "sourceful/riverflow-2.0-pro",
  "google/nano-banana-pro",
]);

interface ReqBody {
  task: "poster" | "display";
  model: string;
  prompt: string;
  aspectRatio?: string;
  referenceImages?: string[]; // http(s) URL or data: URL
  // Bookkeeping for the library row:
  productTitle?: string;
  productHandle?: string;
  campaignType?: string | null;
  style?: string | null;
}

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
    const retryAfter = createRes.headers.get("retry-after");
    let waitMs = 0;
    if (retryAfter) waitMs = parseInt(retryAfter, 10) * 1000;
    if (!waitMs) {
      const m = lastText.match(/"retry_after":\s*(\d+)/);
      if (m) waitMs = parseInt(m[1], 10) * 1000;
    }
    if (!waitMs) waitMs = Math.min(2000 * Math.pow(2, attempt), 16000);
    await new Promise((r) => setTimeout(r, waitMs + 250));
  }

  if (!createRes || !createRes.ok) {
    const text = createRes ? await createRes.text().catch(() => lastText) : lastText;
    throw new Error(`Replicate ${createRes?.status ?? 0}: ${text}`);
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
  if (Array.isArray(output)) {
    const first = output[0];
    if (typeof first === "string") return first;
    if (first && typeof first === "object" && "url" in (first as any)) {
      return String((first as any).url);
    }
  }
  if (typeof output === "string") return output;
  if (output && typeof output === "object") {
    const anyOut = output as Record<string, unknown>;
    if (typeof anyOut.url === "string") return anyOut.url;
    if (Array.isArray(anyOut.images) && typeof anyOut.images[0] === "string") {
      return anyOut.images[0] as string;
    }
  }
  return null;
}

async function dataUrlToHosted(
  admin: ReturnType<typeof createClient>,
  dataUrl: string,
): Promise<string> {
  const m = dataUrl.match(/^data:([^;,]+);base64,(.+)$/);
  if (!m) throw new Error("Invalid reference data URL");
  const contentType = m[1] || "image/png";
  const bin = atob(m[2]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const ext = contentType.includes("jpeg") ? "jpg" : contentType.includes("webp") ? "webp" : "png";
  const path = `mkt-src-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  const up = await admin.storage.from(BUCKET).upload(path, bytes, { contentType, upsert: true });
  if (up.error) throw new Error(`Upload failed: ${up.error.message}`);
  const { data: signed, error } = await admin.storage
    .from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL);
  if (error || !signed?.signedUrl) {
    throw new Error(`Signed URL failed: ${error?.message || "unknown"}`);
  }
  return signed.signedUrl;
}

async function normalizeRef(admin: ReturnType<typeof createClient>, url: string): Promise<string> {
  if (url.startsWith("data:")) return dataUrlToHosted(admin, url);
  if (/^https?:\/\//i.test(url)) return url;
  throw new Error("Reference must be http(s) or data URL");
}

const PRESERVE_INSTRUCTION =
  " IMPORTANT: Use the provided reference image(s) as the EXACT product. Preserve the product's identity, shape, color, branding, logos, materials, labels, and proportions precisely as shown. Do not redesign, restyle, or alter the product itself. Only change the surrounding scene, lighting, background, and composition.";

// Per-model input shape.
function buildModelInput(
  model: string,
  prompt: string,
  aspect: string,
  refs: string[],
): Record<string, unknown> {
  const primaryRef = refs[0];
  const enhancedPrompt = refs.length ? `${prompt}${PRESERVE_INSTRUCTION}` : prompt;
  switch (model) {
    case "ideogram-ai/ideogram-v3-quality": {
      const input: Record<string, unknown> = {
        prompt: enhancedPrompt,
        aspect_ratio: aspect,
        magic_prompt_option: "Auto",
      };
      if (primaryRef) {
        input.style_reference_images = refs.slice(0, 4);
      }
      return input;
    }
    case "google/imagen-4": {
      // Imagen-4 on Replicate is text-to-image only; no ref support.
      return {
        prompt: enhancedPrompt,
        aspect_ratio: aspect,
        output_format: "png",
        safety_filter_level: "block_only_high",
      };
    }
    case "sourceful/riverflow-2.0-pro": {
      const input: Record<string, unknown> = {
        instruction: enhancedPrompt,
        aspect_ratio: aspect,
      };
      if (primaryRef) input.image = primaryRef;
      return input;
    }
    case "google/nano-banana-pro": {
      const input: Record<string, unknown> = {
        prompt: enhancedPrompt,
        aspect_ratio: aspect,
        output_format: "png",
      };
      if (refs.length) input.image_input = refs.slice(0, 4);
      return input;
    }
    default:
      return { prompt: enhancedPrompt, aspect_ratio: aspect };
  }
}

// Reroute models that can't accept reference images when refs are provided.
function resolveModel(model: string, refs: string[]): string {
  if (refs.length && model === "google/imagen-4") {
    // Imagen-4 ignores image inputs; nano-banana-pro preserves product identity from refs.
    return "google/nano-banana-pro";
  }
  return model;
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

    const { data: roles } = await admin
      .from("user_roles").select("role").eq("user_id", userId);
    const isAdmin = roles?.some((r: { role: string }) => r.role === "admin");
    if (!isAdmin) return json({ error: "Admin access required" }, 403);

    const body = (await req.json().catch(() => ({}))) as ReqBody;
    const {
      task,
      model,
      prompt,
      aspectRatio = "1:1",
      referenceImages = [],
      productTitle,
      productHandle,
      campaignType,
      style,
    } = body;

    if (!task || (task !== "poster" && task !== "display")) {
      return json({ error: "task must be poster or display" }, 400);
    }
    if (!model || !SUPPORTED_MODELS.has(model)) {
      return json({ error: `Unsupported model: ${model}` }, 400);
    }
    if (!prompt || prompt.trim().length < 4) {
      return json({ error: "prompt is required" }, 400);
    }

    // Normalize refs (uploads data: refs to storage).
    const hostedRefs: string[] = [];
    for (const r of referenceImages.slice(0, 4)) {
      if (!r) continue;
      hostedRefs.push(await normalizeRef(admin, r));
    }

    const input = buildModelInput(model, prompt, aspectRatio, hostedRefs);
    const output = await runReplicate(model, input);
    const srcUrl = pickUrl(output);
    if (!srcUrl) throw new Error("Replicate returned no image URL");

    // Persist the result to our bucket so it doesn't expire.
    const imgRes = await fetch(srcUrl);
    if (!imgRes.ok) throw new Error(`Could not fetch generated image (${imgRes.status})`);
    const contentType = imgRes.headers.get("content-type") || "image/png";
    const bytes = new Uint8Array(await imgRes.arrayBuffer());
    const ext = contentType.includes("jpeg") ? "jpg" : contentType.includes("webp") ? "webp" : "png";
    const path = `${task}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
    const up = await admin.storage.from(BUCKET).upload(path, bytes, { contentType, upsert: true });
    if (up.error) throw new Error(`Storage upload failed: ${up.error.message}`);
    const { data: signed, error: signErr } = await admin.storage
      .from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL);
    if (signErr || !signed?.signedUrl) {
      throw new Error(`Signed URL failed: ${signErr?.message || "unknown"}`);
    }
    const publicUrl = signed.signedUrl;

    const { data: inserted, error: insErr } = await admin
      .from("marketing_generated_images")
      .insert({
        image_url: publicUrl,
        thumbnail_url: publicUrl,
        generation_type: task,
        product_title: productTitle || null,
        product_handle: productHandle || null,
        style: style || null,
        aspect_ratio: aspectRatio,
        prompt_used: prompt,
        reference_image_url: hostedRefs[0] || null,
        campaign_type: campaignType || null,
        created_by: userId,
      })
      .select("id")
      .single();
    if (insErr) throw new Error(`DB insert failed: ${insErr.message}`);

    return json({
      url: publicUrl,
      id: inserted.id,
      model,
      task,
      prompt,
      aspectRatio,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[marketing-generate]", msg);
    return json({ error: msg }, 500);
  }
});
