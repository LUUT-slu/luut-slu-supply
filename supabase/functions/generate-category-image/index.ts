// Generate a category/subcategory image via Lovable AI Gateway and store it
// in the `category-images` Storage bucket. Admin-only.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const BUCKET = "category-images";

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

function dataUrlToBytes(dataUrl: string): { bytes: Uint8Array; contentType: string } {
  const match = dataUrl.match(/^data:(.+?);base64,(.*)$/);
  if (!match) throw new Error("Invalid data URL");
  const contentType = match[1];
  const b64 = match[2];
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { bytes, contentType };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth: verify caller is admin
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) {
      return json({ error: "Unauthorized" }, 401);
    }

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

    // Call Lovable AI Gateway image model
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
        modalities: ["image", "text"],
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text().catch(() => "");
      console.error("AI gateway error", aiResp.status, errText);
      if (aiResp.status === 429) return json({ error: "Rate limited. Try again shortly." }, 429);
      if (aiResp.status === 402) return json({ error: "AI credits exhausted. Top up your Lovable AI workspace." }, 402);
      return json({ error: "AI gateway request failed" }, 502);
    }

    const data = await aiResp.json();
    const dataUrl: string | undefined = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!dataUrl) return json({ error: "AI did not return an image" }, 502);

    const { bytes, contentType } = dataUrlToBytes(dataUrl);
    const ext = contentType.includes("jpeg") ? "jpg" : "png";
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
