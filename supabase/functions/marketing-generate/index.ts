// Marketing Studio unified generation endpoint.
// One entry point — the client tells us the routed { model, prompt, ... }
// and we call Replicate, persist the result to `marketing-assets`, and
// register it in `marketing_generated_images`.
//
// Supported models (all via Replicate, all image-to-image capable):
//   - ideogram-ai/ideogram-v3-quality
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
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const REPLICATE_API = "https://api.replicate.com/v1";
const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const BUCKET = "marketing-assets";
const SIGNED_URL_TTL = 60 * 60 * 24 * 365 * 10;

const SUPPORTED_MODELS = new Set([
  "ideogram-ai/ideogram-v3-quality",
  "sourceful/riverflow-2.0-pro",
  "google/nano-banana-pro",
]);

interface ReqBody {
  task: "poster" | "display";
  model: string;
  prompt: string;
  aspectRatio?: string;
  referenceImages?: string[]; // product refs — http(s) URL or data: URL
  styleReferenceImage?: string; // brand-style donor ref — http(s) URL or data: URL
  seed?: number; // optional deterministic seed for reproducible generations
  // Two-stage poster (Gemini background → Ideogram text overlay):
  backgroundPrompt?: string;
  textPrompt?: string;
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
  " IMPORTANT: The FIRST reference image is the EXACT product — preserve its identity, shape, color, branding, logos, materials, labels, and proportions precisely. Do not redesign, restyle, or alter the product itself. Only change the surrounding scene, lighting, background, and composition.";

const STYLE_REF_INSTRUCTION =
  " The LAST reference image is a STYLE DONOR ONLY — adopt its color palette, lighting mood, composition rhythm, background treatment, and typography feel, but DO NOT copy, reproduce, or borrow any object, product, person, logo, or text from it.";

// Per-model input shape.
function buildModelInput(
  model: string,
  prompt: string,
  aspect: string,
  productRefs: string[],
  styleRef: string | null,
  seed?: number,
): Record<string, unknown> {
  // Combined ref list: product refs first, style donor last.
  const combined = [...productRefs];
  if (styleRef) combined.push(styleRef);

  let enhancedPrompt = prompt;
  if (productRefs.length) enhancedPrompt += PRESERVE_INSTRUCTION;
  if (styleRef) enhancedPrompt += STYLE_REF_INSTRUCTION;

  const withSeed = (o: Record<string, unknown>) => {
    if (typeof seed === "number" && Number.isFinite(seed)) o.seed = seed;
    return o;
  };

  switch (model) {
    case "ideogram-ai/ideogram-v3-quality": {
      const input: Record<string, unknown> = {
        prompt: enhancedPrompt,
        aspect_ratio: aspect,
        magic_prompt_option: "Auto",
      };
      if (combined.length) input.style_reference_images = combined.slice(0, 4);
      return withSeed(input);
    }
    case "sourceful/riverflow-2.0-pro": {
      const input: Record<string, unknown> = {
        instruction: enhancedPrompt,
        aspect_ratio: aspect,
      };
      const primary = productRefs[0] || styleRef;
      if (primary) input.image = primary;
      return withSeed(input);
    }
    case "google/nano-banana-pro": {
      const input: Record<string, unknown> = {
        prompt: enhancedPrompt,
        aspect_ratio: aspect,
        output_format: "png",
      };
      if (combined.length) input.image_input = combined.slice(0, 4);
      return withSeed(input);
    }
    default:
      return withSeed({ prompt: enhancedPrompt, aspect_ratio: aspect });
  }
}

// All supported models accept reference images; no rerouting needed.
function resolveModel(model: string, _refs: string[]): string {
  return model;
}

// ---------- Two-stage poster helpers ----------

async function uploadBytesAndSign(
  admin: ReturnType<typeof createClient>,
  bytes: Uint8Array,
  contentType: string,
  prefix: string,
): Promise<string> {
  const ext = contentType.includes("jpeg") ? "jpg" : contentType.includes("webp") ? "webp" : "png";
  const path = `${prefix}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  const up = await admin.storage.from(BUCKET).upload(path, bytes, { contentType, upsert: true });
  if (up.error) throw new Error(`Storage upload failed: ${up.error.message}`);
  const { data: signed, error } = await admin.storage
    .from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL);
  if (error || !signed?.signedUrl) {
    throw new Error(`Signed URL failed: ${error?.message || "unknown"}`);
  }
  return signed.signedUrl;
}

async function runGeminiImage(
  geminiModel: string,
  promptText: string,
  refUrls: string[],
): Promise<{ bytes: Uint8Array; contentType: string }> {
  const content: Array<Record<string, unknown>> = [{ type: "text", text: promptText }];
  for (const u of refUrls.slice(0, 4)) {
    content.push({ type: "image_url", image_url: { url: u } });
  }

  const res = await fetch(LOVABLE_AI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: geminiModel,
      messages: [{ role: "user", content }],
      modalities: ["image", "text"],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Gemini ${res.status}: ${text}`);
  }
  const data = await res.json();
  const msg = data?.choices?.[0]?.message;
  const images: Array<{ image_url?: { url?: string } }> = msg?.images || [];
  const imgUrl = images[0]?.image_url?.url;
  if (!imgUrl) {
    throw new Error("Gemini returned no image");
  }
  // Data URL: data:<ct>;base64,<b64>
  const m = imgUrl.match(/^data:([^;,]+);base64,(.+)$/);
  if (m) {
    const contentType = m[1] || "image/png";
    const bin = atob(m[2]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return { bytes, contentType };
  }
  // Remote URL fallback
  const r = await fetch(imgUrl);
  if (!r.ok) throw new Error(`Could not fetch Gemini image (${r.status})`);
  const contentType = r.headers.get("content-type") || "image/png";
  return { bytes: new Uint8Array(await r.arrayBuffer()), contentType };
}

async function runPosterTwoStage(
  admin: ReturnType<typeof createClient>,
  backgroundPrompt: string,
  textPrompt: string,
  aspectRatio: string,
  productRefs: string[],
  seed?: number,
): Promise<{ finalUrl: string; geminiUrl: string; modelLabel: string }> {
  // Stage 1: Gemini background (try Pro, fall back to Flash image).
  let gemini: { bytes: Uint8Array; contentType: string } | null = null;
  let geminiModelUsed = "google/gemini-3-pro-image-preview";
  try {
    gemini = await runGeminiImage(geminiModelUsed, backgroundPrompt, productRefs);
  } catch (e) {
    console.warn("[poster-two-stage] Pro failed, falling back to Flash:", (e as Error).message);
    geminiModelUsed = "google/gemini-2.5-flash-image";
    gemini = await runGeminiImage(geminiModelUsed, backgroundPrompt, productRefs);
  }
  const geminiUrl = await uploadBytesAndSign(admin, gemini.bytes, gemini.contentType, "poster-bg");

  // Stage 2: Ideogram v3 Turbo with text overlay, base image = geminiUrl.
  const ideogramInput: Record<string, unknown> = {
    prompt: textPrompt,
    aspect_ratio: aspectRatio,
    style_type: "DESIGN",
    magic_prompt_option: "Off",
    image: geminiUrl,
    style_reference_images: [geminiUrl],
  };
  if (typeof seed === "number" && Number.isFinite(seed)) ideogramInput.seed = seed;

  const output = await runReplicate("ideogram-ai/ideogram-v3-turbo", ideogramInput);
  const finalUrl = pickUrl(output);
  if (!finalUrl) throw new Error("Ideogram returned no image URL");

  return { finalUrl, geminiUrl, modelLabel: `${geminiModelUsed} -> ideogram-v3-turbo` };
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
      styleReferenceImage,
      seed,
      backgroundPrompt,
      textPrompt,
      productTitle,
      productHandle,
      campaignType,
      style,
    } = body;

    if (!task || (task !== "poster" && task !== "display")) {
      return json({ error: "task must be poster or display" }, 400);
    }

    const isTwoStagePoster =
      task === "poster" &&
      typeof backgroundPrompt === "string" && backgroundPrompt.trim().length >= 4 &&
      typeof textPrompt === "string" && textPrompt.trim().length >= 4;

    if (!isTwoStagePoster) {
      if (!model || !SUPPORTED_MODELS.has(model)) {
        return json({ error: `Unsupported model: ${model}` }, 400);
      }
      if (!prompt || prompt.trim().length < 4) {
        return json({ error: "prompt is required" }, 400);
      }
    }

    // Normalize product refs (uploads data: refs to storage).
    const hostedRefs: string[] = [];
    for (const r of referenceImages.slice(0, 4)) {
      if (!r) continue;
      hostedRefs.push(await normalizeRef(admin, r));
    }
    // Normalize the brand-style donor ref, if any.
    let hostedStyleRef: string | null = null;
    if (styleReferenceImage) {
      hostedStyleRef = await normalizeRef(admin, styleReferenceImage);
    }

    let srcUrl: string | null = null;
    let effectiveModel: string;
    let promptForLog: string;

    if (isTwoStagePoster) {
      const refsForGemini = [...hostedRefs];
      if (hostedStyleRef) refsForGemini.push(hostedStyleRef);
      const stage = await runPosterTwoStage(
        admin,
        backgroundPrompt!,
        textPrompt!,
        aspectRatio,
        refsForGemini,
        seed,
      );
      srcUrl = stage.finalUrl;
      effectiveModel = stage.modelLabel;
      promptForLog = `[BACKGROUND]\n${backgroundPrompt}\n\n[TEXT]\n${textPrompt}`;
    } else {
      effectiveModel = resolveModel(model, hostedRefs);
      const input = buildModelInput(effectiveModel, prompt, aspectRatio, hostedRefs, hostedStyleRef, seed);
      const output = await runReplicate(effectiveModel, input);
      srcUrl = pickUrl(output);
      promptForLog = prompt;
    }
    if (!srcUrl) throw new Error("Generator returned no image URL");

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
        prompt_used: promptForLog,
        model_used: effectiveModel,

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
      model: effectiveModel,
      task,
      prompt: promptForLog,
      aspectRatio,
      seed: seed ?? null,
    });
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    console.error("[marketing-generate]", raw);
    const friendly = /insufficient credit/i.test(raw)
      ? "The image provider has insufficient credit. Top up billing and try again."
      : /timed out|timeout/i.test(raw)
        ? "The image provider took too long to respond. Please try again."
        : /Gemini\s+4\d\d/i.test(raw)
          ? "Background generation failed. Please try again."
          : raw;
    return json({ error: friendly }, 500);
  }
});
