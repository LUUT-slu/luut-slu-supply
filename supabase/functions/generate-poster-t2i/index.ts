import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const REPLICATE_API_KEY = Deno.env.get('REPLICATE_API_KEY') || Deno.env.get('REPLICATE_API_TOKEN');
const REPLICATE_API = 'https://api.replicate.com/v1';

const ASPECT_MAP: Record<string, string> = {
  '1:1': '1:1',
  '9:16': '9:16',
  '16:9': '16:9',
  '4:3': '4:3',
  '3:4': '3:4',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function requireAuth(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return false;
  const token = authHeader.replace('Bearer ', '');
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data, error } = await supabase.auth.getClaims(token);
  return !error && Boolean(data?.claims);
}

function pickImageUrl(output: unknown): string | null {
  if (Array.isArray(output)) {
    const first = output[0];
    if (typeof first === 'string') return first;
    if (first && typeof first === 'object' && 'url' in first) return String((first as { url: unknown }).url);
  }
  if (typeof output === 'string') return output;
  if (output && typeof output === 'object' && 'url' in output) return String((output as { url: unknown }).url);
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    if (!(await requireAuth(req))) return json({ error: 'Unauthorized' }, 401);
    if (!REPLICATE_API_KEY) return json({ error: 'REPLICATE_API_KEY is not configured' }, 500);

    const body = await req.json().catch(() => ({}));
    const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
    const aspectRatio = typeof body?.aspectRatio === 'string' ? body.aspectRatio : '1:1';
    const ideogramAspectRatio = ASPECT_MAP[aspectRatio];

    if (!prompt) return json({ error: 'Prompt is required' }, 400);
    if (prompt.length > 2000) return json({ error: 'Prompt is too long' }, 400);
    if (!ideogramAspectRatio) return json({ error: 'Invalid aspect ratio' }, 400);

    const createRes = await fetch(`${REPLICATE_API}/models/ideogram-ai/ideogram-v3-turbo/predictions`, {
      method: 'POST',
      headers: {
        Authorization: `Token ${REPLICATE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: {
          prompt,
          aspect_ratio: ideogramAspectRatio,
          style_type: 'Design',
        },
      }),
    });

    const created = await createRes.json().catch(() => ({}));
    if (createRes.status === 402 || /insufficient credit|out of credit/i.test(JSON.stringify(created))) {
      return json({ error: 'Replicate is out of credit.' }, 402);
    }
    if (!createRes.ok) {
      console.error('[generate-poster-t2i] create failed', createRes.status, created);
      return json({ error: created?.detail || created?.error || 'Replicate request failed' }, createRes.status);
    }

    let prediction = created;
    const startedAt = Date.now();
    while (!['succeeded', 'failed', 'canceled'].includes(prediction?.status)) {
      if (Date.now() - startedAt > 180_000) return json({ error: 'Generation timed out' }, 504);
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const pollRes = await fetch(`${REPLICATE_API}/predictions/${prediction.id}`, {
        headers: { Authorization: `Token ${REPLICATE_API_KEY}` },
      });
      const polled = await pollRes.json().catch(() => ({}));
      if (!pollRes.ok) return json({ error: polled?.detail || 'Replicate polling failed' }, pollRes.status);
      prediction = polled;
    }

    if (prediction.status !== 'succeeded') return json({ error: prediction.error || 'Generation failed' }, 502);
    const imageUrl = pickImageUrl(prediction.output);
    if (!imageUrl) return json({ error: 'Replicate returned no image URL' }, 502);

    return json({ imageUrl });
  } catch (error) {
    console.error('[generate-poster-t2i]', error);
    return json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});