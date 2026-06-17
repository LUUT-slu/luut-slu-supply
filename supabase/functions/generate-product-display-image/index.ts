// Generate a polished product display/marketing image via Replicate
// (black-forest-labs/flux-kontext-pro), persist it to the private
// `marketing-assets` storage bucket, register it in
// `marketing_generated_images`, and return a long-lived signed URL.
// Admin-only.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/images/generations";
const BUCKET = "marketing-assets";
const SIGNED_URL_TTL = 60 * 60 * 24 * 365 * 10; // ~10 years

type Style = "studio" | "lifestyle" | "minimal";

function buildPrompt(
  style: Style,
  productTitle: string,
  textOverlay?: string | null,
  customPrompt?: string | null,
): string {
  let base: string;
  switch (style) {
    case "lifestyle":
      base = `Lifestyle product photo of ${productTitle} in a modern Caribbean setting. Natural light, clean environment, the product is the clear hero. Authentic, aspirational, fashion-forward. Exact same product — same colors, shape, branding.`;
      break;
    case "minimal":
      base = `Minimal product photo of ${productTitle} on a pure white background. Perfect centering, even lighting, no shadows, no props. E-commerce ready. Exact same product as the reference.`;
      break;
    case "studio":
    default:
      base = `Professional studio product photo of ${productTitle}. Clean white or light grey background, soft box lighting, sharp focus, commercial photography quality, e-commerce ready. The product must look exactly as in the reference — same colors, shape, branding, details.`;
      break;
  }
  if (textOverlay && textOverlay.trim().length > 0) {
    base += ` Include the text "${textOverlay.trim()}" rendered cleanly on the image in a modern sans-serif font. Place it in the lower third, clear and legible, not overlapping the product.`;
  }
  if (customPrompt && customPrompt.trim().length > 0) {
    base += ` ${customPrompt.trim()}`;
  }
  return base;
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
    throw new Error(`Replicate ${createRes.status}: ${text}`);
  }
  let prediction = await createRes.json();
  const start = Date.now();
  while (
    prediction.status !== "succeeded" &&
    prediction.status !== "failed" &&
    prediction.status !== "canceled"
  ) {
    if (Date.now() - start > 120_000) throw new Error("Replicate prediction timed out");
    await new Promise((r) => setTimeout(r, 3000));
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

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth — service-role client + getUser from bearer token, then check user_roles
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

    const body = await req.json().catch(() => ({}));
    const {
      productImageUrl,
      productTitle,
      productCategory,
      style,
      aspectRatio,
      textOverlay,
      referenceImageUrl,
      customPrompt,
    } = body as {
      productImageUrl?: string;
      productTitle?: string;
      productCategory?: string;
      style?: Style;
      aspectRatio?: string;
      textOverlay?: string | null;
      referenceImageUrl?: string | null;
      customPrompt?: string | null;
    };

    if (!productImageUrl || !productTitle) {
      return json({ error: "productImageUrl and productTitle are required" }, 400);
    }
    const resolvedStyle: Style =
      style === "lifestyle" || style === "minimal" ? style : "studio";
    const resolvedAspect = aspectRatio && /^\d+:\d+$/.test(aspectRatio) ? aspectRatio : "1:1";

    const fullPrompt = buildPrompt(resolvedStyle, productTitle, textOverlay, customPrompt);

    const replicateInput: Record<string, unknown> = {
      prompt: fullPrompt,
      input_image: productImageUrl,
      aspect_ratio: resolvedAspect,
      output_format: "png",
      safety_tolerance: 2,
    };
    if (referenceImageUrl && referenceImageUrl.length > 0) {
      replicateInput.reference_image = referenceImageUrl;
    }

    const output = await runReplicate(
      "black-forest-labs/flux-kontext-pro",
      replicateInput,
    );
    const replicateUrl = Array.isArray(output) ? String(output[0]) : String(output);
    if (!replicateUrl || !replicateUrl.startsWith("http")) {
      throw new Error("Replicate returned no image URL");
    }

    // Download and upload to storage
    const imgRes = await fetch(replicateUrl);
    if (!imgRes.ok) throw new Error(`Failed to fetch generated image: ${imgRes.status}`);
    const bytes = new Uint8Array(await imgRes.arrayBuffer());
    const path = `display-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.png`;

    const { error: uploadErr } = await admin.storage
      .from(BUCKET)
      .upload(path, bytes, {
        contentType: "image/png",
        upsert: true,
      });
    if (uploadErr) throw new Error(`Storage upload failed: ${uploadErr.message}`);

    const { data: signed, error: signedErr } = await admin.storage
      .from(BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL);
    if (signedErr || !signed?.signedUrl) {
      throw new Error(`Could not create signed URL: ${signedErr?.message || "unknown"}`);
    }
    const publicUrl = signed.signedUrl;

    const { data: inserted, error: insertErr } = await admin
      .from("marketing_generated_images")
      .insert({
        image_url: publicUrl,
        thumbnail_url: publicUrl,
        generation_type: "display",
        product_title: productTitle,
        style: resolvedStyle,
        aspect_ratio: resolvedAspect,
        prompt_used: fullPrompt,
        reference_image_url: referenceImageUrl || null,
        created_by: userId,
      })
      .select("id")
      .single();
    if (insertErr) throw new Error(`DB insert failed: ${insertErr.message}`);

    return json({ url: publicUrl, id: inserted.id, prompt: fullPrompt, path });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[generate-product-display-image]", msg);
    return json({ error: msg }, 500);
  }
});
