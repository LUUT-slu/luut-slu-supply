// Generate a short product marketing video via Replicate (Kling v2.1 image-to-video).
// Admin-only. Uses REPLICATE_API_TOKEN secret.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const REPLICATE_API_TOKEN = Deno.env.get("REPLICATE_API_TOKEN");
const REPLICATE_API = "https://api.replicate.com/v1";
const MODEL = "kwaivgi/kling-v2.1";

type MotionStyle = "subtle" | "dynamic" | "cinematic";

function buildPrompt(style: MotionStyle, productTitle: string): string {
  if (style === "dynamic") {
    return `High-energy product reveal of ${productTitle}. Quick cinematic cuts, dramatic lighting sweep across the product, bold motion. Caribbean fashion brand energy — confident, clean, premium. No people, no text overlays.`;
  }
  if (style === "cinematic") {
    return `Cinematic product film of ${productTitle}. Slow pull-back shot revealing the full product, depth-of-field blur, premium fashion editorial style. Moody, aspirational. Shot like a luxury brand commercial. No people, no text overlays.`;
  }
  return `Product showcase video of ${productTitle}. Slow, smooth camera orbit around the product. Soft studio lighting. The product rotates gently to reveal all angles. Clean background. Professional e-commerce style. No people, no text overlays, no sudden movements.`;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!REPLICATE_API_TOKEN) return json({ error: "REPLICATE_API_TOKEN not configured" }, 500);

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

    const body = await req.json().catch(() => ({}));

    // Poll mode: if a predictionId is provided, just return current status.
    const predictionId: string | undefined = body.predictionId;
    if (predictionId) {
      const pollRes = await fetch(`${REPLICATE_API}/predictions/${predictionId}`, {
        headers: { Authorization: `Token ${REPLICATE_API_TOKEN}` },
      });
      if (!pollRes.ok) {
        const text = await pollRes.text().catch(() => "");
        return json({ error: `Replicate poll ${pollRes.status}: ${text.slice(0, 200)}` }, 502);
      }
      const prediction = await pollRes.json();
      if (prediction.status === "succeeded") {
        const output = prediction.output;
        const videoUrl = Array.isArray(output) ? String(output[0]) : typeof output === "string" ? output : null;
        if (!videoUrl) return json({ error: "Replicate did not return a video" }, 502);
        return json({ status: "succeeded", videoUrl });
      }
      if (prediction.status === "failed" || prediction.status === "canceled") {
        return json({ status: prediction.status, error: prediction.error || `Prediction ${prediction.status}` }, 200);
      }
      return json({ status: prediction.status ?? "processing", predictionId });
    }

    const productImageUrl: string | undefined = body.productImageUrl;
    const endImageUrl: string | undefined = body.endImageUrl;
    const productTitle: string = body.productTitle ?? "this product";
    const motionStyle: MotionStyle = (body.motionStyle ?? "subtle") as MotionStyle;
    const duration: number = body.duration === 10 ? 10 : 5;
    const allowedRatios = ["9:16", "1:1", "16:9", "4:3", "3:4", "21:9"];
    const aspectRatio: string = allowedRatios.includes(body.aspectRatio) ? body.aspectRatio : "9:16";

    const prompt = buildPrompt(motionStyle, productTitle);

    const input: Record<string, unknown> = {
      prompt,
      duration,
      aspect_ratio: aspectRatio,
      negative_prompt:
        "blurry, distorted, watermark, text, logo, people, faces, hands, low quality, artifacts",
    };
    if (!productImageUrl) {
      return json({ error: "start_image is required — pass productImageUrl" }, 400);
    }
    input.start_image = productImageUrl;
    if (endImageUrl) input.end_image = endImageUrl;

    const createRes = await fetch(`${REPLICATE_API}/models/${MODEL}/predictions`, {
      method: "POST",
      headers: {
        Authorization: `Token ${REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ input }),
    });

    if (!createRes.ok) {
      const text = await createRes.text().catch(() => "");
      console.error("Replicate create error", createRes.status, text);
      return json({ error: `Replicate ${createRes.status}: ${text.slice(0, 300)}` }, 502);
    }

    const prediction = await createRes.json();
    // Return immediately — the client polls via predictionId to avoid edge function timeouts.
    return json({ status: prediction.status ?? "starting", predictionId: prediction.id, prompt });
  } catch (e) {
    console.error("generate-product-video error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
