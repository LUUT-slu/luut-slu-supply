import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const REPLICATE_API_KEY = Deno.env.get('REPLICATE_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const ALLOWED_RATIOS = new Set(['1:1', '9:16', '16:9', '4:3', '3:4']);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Unauthorized' }, 401);
    }
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return json({ error: 'Unauthorized' }, 401);
    }

    if (!REPLICATE_API_KEY) {
      return json({ error: 'REPLICATE_API_KEY is not configured' }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
    const aspect_ratio = typeof body?.aspect_ratio === 'string' ? body.aspect_ratio : '1:1';

    if (!prompt || prompt.length < 2) {
      return json({ error: 'Prompt is required' }, 400);
    }
    if (prompt.length > 2000) {
      return json({ error: 'Prompt is too long' }, 400);
    }
    if (!ALLOWED_RATIOS.has(aspect_ratio)) {
      return json({ error: 'Invalid aspect_ratio' }, 400);
    }

    // Call Replicate ideogram-v3-turbo with style_type: design
    const createRes = await fetch(
      'https://api.replicate.com/v1/models/ideogram-ai/ideogram-v3-turbo/predictions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${REPLICATE_API_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'wait',
        },
        body: JSON.stringify({
          input: {
            prompt,
            aspect_ratio,
            style_type: 'design',
          },
        }),
      },
    );

    const createJson = await createRes.json().catch(() => ({}));

    if (createRes.status === 402 || /insufficient credit/i.test(JSON.stringify(createJson))) {
      return json({ error: 'Replicate is out of credit.' }, 402);
    }

    if (!createRes.ok) {
      return json({ error: createJson?.detail || createJson?.error || 'Replicate request failed' }, createRes.status);
    }

    let prediction = createJson;

    // Poll if not yet terminal
    const POLL_URL = (id: string) => `https://api.replicate.com/v1/predictions/${id}`;
    const terminal = (s?: string) => s === 'succeeded' || s === 'failed' || s === 'canceled';
    let tries = 0;
    while (!terminal(prediction?.status) && prediction?.id && tries < 60) {
      await new Promise((r) => setTimeout(r, 2000));
      const pollRes = await fetch(POLL_URL(prediction.id), {
        headers: { Authorization: `Bearer ${REPLICATE_API_KEY}` },
      });
      prediction = await pollRes.json();
      tries++;
    }

    if (prediction?.status !== 'succeeded') {
      return json({ error: prediction?.error || 'Generation failed' }, 500);
    }

    const output = prediction.output;
    const imageUrl = Array.isArray(output) ? output[0] : output;
    if (!imageUrl || typeof imageUrl !== 'string') {
      return json({ error: 'No image returned' }, 500);
    }

    return json({ imageUrl });
  } catch (e) {
    console.error('[text-to-image]', e);
    return json({ error: (e as Error)?.message || 'Unknown error' }, 500);
  }
});
