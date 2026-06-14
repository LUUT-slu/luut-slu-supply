// Generate a category/subcategory image via Replicate (flux-1.1-pro) and store
// it in the `category-images` Storage bucket. Admin-only.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const REPLICATE_API_TOKEN = Deno.env.get("REPLICATE_API_TOKEN")!;
const BUCKET = "category-images";
const REPLICATE_API = "https://api.replicate.com/v1";

function buildPrompt(displayName: string, parentName: string | null, samples: string[]): string {
  const subject = displayName;
  const ctx = parentName && parentName !== displayName ? ` (a ${parentName} subcategory)` : "";
  const examples = samples.length
    ? ` Real example items in this category include: ${samples.slice(0, 5).join(", ")}.`
    : "";
  return [
    `A premium marketplace product photo specifically of ${subject}${ctx}.`,
    `Show 1 to 3 real ${subject} clearly as the hero subject — no other product types.`,
    examples,
    `Style: modern, clean, sharp studio lighting, dark premium background, mobile-friendly square crop, marketplace-quality, photoreal.`,
    `Strict rules: do NOT include text, captions, watermarks, brand logos, or human faces. The product type must be unmistakably ${subject}.`,
  ].join(" ");
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
    if (Date.now() - start > 120_000) throw new Error("Replicate prediction timed out");
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
      categoryKey,
      mainSlug,
      subSlug,
      displayName,
      parentName,
      sampleTitles,
      promptOverride,
      autoApprove,
    } = body as {
      categoryKey: string;
      mainSlug: string;
      subSlug?: string | null;
      displayName: string;
      parentName?: string | null;
      sampleTitles?: string[];
      promptOverride?: string | null;
      autoApprove?: boolean;
    };

    if (!categoryKey || !mainSlug || !displayName) {
      return json({ error: "categoryKey, mainSlug, displayName required" }, 400);
    }

    const samples = Array.isArray(sampleTitles) ? sampleTitles.filter(Boolean) : [];
    const prompt = (promptOverride && promptOverride.trim().length > 0)
      ? promptOverride
      : buildPrompt(displayName, parentName ?? null, samples);

    let output: unknown;
    try {
      output = await runReplicate("black-forest-labs/flux-1.1-pro", {
        prompt,
        aspect_ratio: "1:1",
        output_format: "png",
        output_quality: 90,
      });
    } catch (e: any) {
      if (e?.status === 429) return json({ error: "Rate limited. Try again shortly." }, 429);
      console.error("Replicate error", e);
      return json({ error: "Replicate API error — check your usage at replicate.com" }, 502);
    }

    const imageRemoteUrl = Array.isArray(output)
      ? String(output[0])
      : typeof output === "string" ? output : null;

    if (!imageRemoteUrl) return json({ error: "Replicate did not return an image" }, 502);

    // Fetch the generated image and persist to our storage bucket.
    const imgRes = await fetch(imageRemoteUrl);
    if (!imgRes.ok) {
      return json({ error: "Failed to fetch generated image" }, 502);
    }
    const buffer = await imgRes.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const contentType = "image/png";
    const ext = "png";
    const path = `${categoryKey.replace(/[^a-z0-9_:-]/gi, "_")}-${Date.now()}.${ext}`;

    const upload = await admin.storage.from(BUCKET).upload(path, bytes, {
      contentType,
      upsert: true,
    });
    if (upload.error) {
      console.error("Storage upload error", upload.error);
      return json({ error: "Failed to store image" }, 500);
    }

    const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path);
    const imageUrl = pub.publicUrl;

    // Upsert row
    const upsert = await admin.from("category_images").upsert({
      category_key: categoryKey,
      main_slug: mainSlug,
      sub_slug: subSlug ?? null,
      display_name: displayName,
      image_url: imageUrl,
      image_source: "ai",
      prompt_used: prompt,
      sample_titles: samples,
      status: autoApprove ? "approved" : "pending",
      last_generated_at: new Date().toISOString(),
      updated_by: userId,
    }, { onConflict: "category_key" });

    if (upsert.error) {
      console.error("Upsert error", upsert.error);
      return json({ error: upsert.error.message }, 500);
    }

    return json({ ok: true, imageUrl, prompt });
  } catch (e) {
    console.error("generate-category-image error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
