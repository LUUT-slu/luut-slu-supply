// Edge function: AI-assisted image preparation for Marketing Studio.
// Modes:
//   - "remove-bg" : remove background, keep product intact (Replicate: 851-labs/background-remover)
//   - "expand"    : outpaint to target aspect ratio (Replicate: black-forest-labs/flux-fill-pro)

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type PrepMode = "remove-bg" | "expand";
type Format = "story" | "post" | "ad" | "portrait";

const ASPECT_RATIO: Record<Format, string> = {
  story: "9:16",
  post: "1:1",
  ad: "16:9",
  portrait: "4:5",
};

const EXPAND_PROMPT =
  "Clean continuation of the existing background. Do not alter the product in any way — same position, colors, shape, branding. Natural background extension only.";

const REPLICATE_API = "https://api.replicate.com/v1";

async function runReplicate(
  token: string,
  model: string,
  input: Record<string, unknown>,
): Promise<unknown> {
  const createRes = await fetch(
    `${REPLICATE_API}/models/${model}/predictions`,
    {
      method: "POST",
      headers: {
        Authorization: `Token ${token}`,
        "Content-Type": "application/json",
        Prefer: "wait",
      },
      body: JSON.stringify({ input }),
    },
  );

  if (!createRes.ok) {
    const text = await createRes.text().catch(() => "");
    const err: any = new Error(`Replicate ${createRes.status}: ${text}`);
    err.status = createRes.status;
    throw err;
  }

  let prediction = await createRes.json();

  // Poll if not terminal.
  const start = Date.now();
  while (
    prediction.status !== "succeeded" &&
    prediction.status !== "failed" &&
    prediction.status !== "canceled"
  ) {
    if (Date.now() - start > 120_000) {
      throw new Error("Replicate prediction timed out");
    }
    await new Promise((r) => setTimeout(r, 1500));
    const pollRes = await fetch(`${REPLICATE_API}/predictions/${prediction.id}`, {
      headers: { Authorization: `Token ${token}` },
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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const REPLICATE_API_TOKEN = Deno.env.get("REPLICATE_API_TOKEN");
    if (!REPLICATE_API_TOKEN) {
      return json({ error: "REPLICATE_API_TOKEN not configured" }, 500);
    }

    const body = await req.json().catch(() => null);
    const imageUrl: string | undefined = body?.imageUrl;
    const mode: PrepMode | undefined = body?.mode;
    const format: Format = body?.format ?? "post";

    if (!imageUrl || typeof imageUrl !== "string") {
      return json({ error: "imageUrl is required" }, 400);
    }
    if (mode !== "remove-bg" && mode !== "expand") {
      return json({ error: "mode must be 'remove-bg' or 'expand'" }, 400);
    }

    let outputUrl: string | undefined;

    if (mode === "remove-bg") {
      const output = await runReplicate(
        REPLICATE_API_TOKEN,
        "851-labs/background-remover",
        { image: imageUrl },
      );
      outputUrl = typeof output === "string"
        ? output
        : Array.isArray(output) ? String(output[0]) : undefined;
    } else {
      const output = await runReplicate(
        REPLICATE_API_TOKEN,
        "black-forest-labs/flux-fill-pro",
        {
          image: imageUrl,
          prompt: EXPAND_PROMPT,
          aspect_ratio: ASPECT_RATIO[format],
        },
      );
      outputUrl = Array.isArray(output)
        ? String(output[0])
        : typeof output === "string" ? output : undefined;
    }

    if (!outputUrl) {
      return json({ error: "Replicate did not return an image" }, 502);
    }

    return json({ url: outputUrl });
  } catch (e: any) {
    console.error("ai-image-prep error:", e);
    const status = e?.status === 429 ? 429 : 500;
    const msg = e?.status === 429
      ? "Rate limited. Please try again in a moment."
      : "Replicate API error — check your usage at replicate.com";
    return json({ error: msg, detail: e?.message }, status);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
