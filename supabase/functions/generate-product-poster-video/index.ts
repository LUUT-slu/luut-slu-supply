// Animate a finished poster image into a video via Replicate (Wan 2.2 I2V Fast).
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
const MODEL = "wan-video/wan-2.2-i2v-480p";

const POSTER_PROMPT =
  "The marketing poster animates to life. Text elements fade in sequentially. Product image pulses with a subtle glow. Background has a slow, smooth gradient shift. Professional, eye-catching social media motion graphic. No camera shake, no distortion.";

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
    const posterImageUrl: string | undefined = body.posterImageUrl;
    const endImageUrl: string | undefined = body.endImageUrl;
    const allowedRatios = ["9:16", "1:1", "16:9", "4:3", "3:4", "21:9"];
    const aspectRatio: string = allowedRatios.includes(body.aspectRatio) ? body.aspectRatio : "9:16";
    const prompt: string = (typeof body.prompt === "string" && body.prompt.trim()) || POSTER_PROMPT;

    const input: Record<string, unknown> = {
      prompt,
      num_frames: 81,
      aspect_ratio: aspectRatio,
    };
    if (posterImageUrl) input.image = posterImageUrl;
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

    let prediction = await createRes.json();
    for (let i = 0; i < 40; i++) {
      if (
        prediction.status === "succeeded" ||
        prediction.status === "failed" ||
        prediction.status === "canceled"
      ) break;
      await new Promise((r) => setTimeout(r, 3000));
      const pollRes = await fetch(`${REPLICATE_API}/predictions/${prediction.id}`, {
        headers: { Authorization: `Token ${REPLICATE_API_TOKEN}` },
      });
      if (!pollRes.ok) {
        const text = await pollRes.text().catch(() => "");
        return json({ error: `Replicate poll ${pollRes.status}: ${text.slice(0, 200)}` }, 502);
      }
      prediction = await pollRes.json();
    }

    if (prediction.status !== "succeeded") {
      if (prediction.status === "failed" || prediction.status === "canceled") {
        return json({ error: prediction.error || `Prediction ${prediction.status}` }, 502);
      }
      return json({ error: "Generation timed out" }, 504);
    }

    const output = prediction.output;
    const videoUrl = Array.isArray(output) ? String(output[0]) : typeof output === "string" ? output : null;
    if (!videoUrl) return json({ error: "Replicate did not return a video" }, 502);

    return json({ videoUrl });
  } catch (e) {
    console.error("generate-product-poster-video error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
