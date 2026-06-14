// Generate a polished product display/marketing image from an existing product
// photo using Replicate's flux-kontext-pro (image-to-image with reference).
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

type Style = "studio" | "lifestyle" | "minimal";
type Format = "square" | "portrait" | "landscape";

const ASPECT_RATIO: Record<Format, string> = {
  square: "1:1",
  portrait: "4:5",
  landscape: "16:9",
};

function buildPrompt(style: Style, productTitle: string): string {
  switch (style) {
    case "lifestyle":
      return `Lifestyle product photo of ${productTitle} in a modern Caribbean setting. Natural light, clean environment, the product is the clear hero of the shot. Authentic, aspirational, fashion-forward. Same product exactly — same colors, shape, branding.`;
    case "minimal":
      return `Minimal product photo of ${productTitle} on a pure white background. Perfect centering, even lighting, no shadows, no props, e-commerce ready. Same product exactly as the reference.`;
    case "studio":
    default:
      return `Professional studio product photo of ${productTitle}. Clean white or light grey background, soft box lighting from the left, subtle shadow below the product, sharp focus, high resolution, commercial photography quality. The product must look exactly as in the reference image — same colors, shape, branding. No text, no people, no props.`;
  }
}

async function runReplicate(
  model: string,
  input: Record<string, unknown>,
): Promise<unknown> {
  const createRes = await fetch(`${REPLICATE_API}/models/${model}/predictions`, {
    method: "POST",
    headers: {
      Authorization: `Token ${REPLICATE_API_TOKEN}`,
      "Content-Type": "application/json",
      Prefer: "wait",
    },
    body: JSON.stringify({ input }),
  });

  if (!createRes.ok) {
    const text = await createRes.text().catch(() => "");
    const err: any = new Error(`Replicate ${createRes.status}: ${text}`);
    err.status = createRes.status;
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
      const text = await pollRes.text().catch(() => "");
      throw new Error(`Replicate poll ${pollRes.status}: ${text}`);
    }
    prediction = await pollRes.json();
  }
  if (prediction.status !== "succeeded") {
    throw new Error(prediction.error || `Prediction ${prediction.status}`);
  }
  return prediction.output;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!REPLICATE_API_TOKEN) {
      return json({ error: "REPLICATE_API_TOKEN not configured" }, 500);
    }

    // Auth: verify caller is admin
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
    const {
      productImageUrl,
      productTitle,
      productCategory,
      style = "studio",
      format = "square",
    } = body as {
      productImageUrl?: string;
      productTitle?: string;
      productCategory?: string;
      style?: Style;
      format?: Format;
    };

    if (!productImageUrl || typeof productImageUrl !== "string") {
      return json({ error: "productImageUrl is required" }, 400);
    }
    if (!productTitle || typeof productTitle !== "string") {
      return json({ error: "productTitle is required" }, 400);
    }
    if (!productCategory || typeof productCategory !== "string") {
      return json({ error: "productCategory is required" }, 400);
    }
    if (!["studio", "lifestyle", "minimal"].includes(style)) {
      return json({ error: "Invalid style" }, 400);
    }
    if (!["square", "portrait", "landscape"].includes(format)) {
      return json({ error: "Invalid format" }, 400);
    }

    const prompt = buildPrompt(style, productTitle);

    let output: unknown;
    try {
      output = await runReplicate("black-forest-labs/flux-kontext-pro", {
        prompt,
        input_image: productImageUrl,
        aspect_ratio: ASPECT_RATIO[format],
        output_format: "png",
        safety_tolerance: 2,
      });
    } catch (e: any) {
      if (e?.status === 429) return json({ error: "Rate limited. Try again shortly." }, 429);
      console.error("Replicate error", e);
      return json({ error: "Replicate API error — check your usage at replicate.com" }, 502);
    }

    const url = Array.isArray(output)
      ? String(output[0])
      : typeof output === "string" ? output : null;

    if (!url) return json({ error: "Replicate did not return an image" }, 502);

    return json({ url, prompt });
  } catch (e) {
    console.error("generate-product-display-image error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
