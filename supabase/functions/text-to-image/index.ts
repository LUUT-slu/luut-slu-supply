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

async function requireAuth(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return false;
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.replace('Bearer ', '');
  const { data, error } = await supabase.auth.getClaims(token);
  return !error && !!data?.claims;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    if (!(await requireAuth(req))) return json({ error: 'Unauthorized' }, 401);
    if (!REPLICATE_API_KEY) return json({ error: 'REPLICATE_API_KEY is not configured' }, 500);

    const body = await req.json().catch(() => ({}));
    const action = body?.action === 'status' ? 'status' : 'start';

    if (action === 'status') {
      const id = typeof body?.id === 'string' ? body.id : '';
      if (!id) return json({ error: 'Missing id' }, 400);
      const res = await fetch(`https://api.replicate.com/v1/predictions/${id}`, {
        headers: { Authorization: `Bearer ${REPLICATE_API_KEY}` },
      });
      const pred = await res.json().catch(() => ({}));
      if (!res.ok) return json({ error: pred?.detail || 'Status failed' }, res.status);
      const output = pred?.output;
      const imageUrl = Array.isArray(output) ? output[0] : output;
      return json({
        id: pred?.id,
        status: pred?.status,
        imageUrl: typeof imageUrl === 'string' ? imageUrl : null,
        error: pred?.error || null,
      });
    }

    // action === 'start'
    const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
    const aspect_ratio = typeof body?.aspect_ratio === 'string' ? body.aspect_ratio : '1:1';
    if (!prompt || prompt.length < 2) return json({ error: 'Prompt is required' }, 400);
    if (prompt.length > 2000) return json({ error: 'Prompt is too long' }, 400);
    if (!ALLOWED_RATIOS.has(aspect_ratio)) return json({ error: 'Invalid aspect_ratio' }, 400);

    const createRes = await fetch(
      'https://api.replicate.com/v1/models/ideogram-ai/ideogram-v3-turbo/predictions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${REPLICATE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: { prompt, aspect_ratio, style_type: 'design' },
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

    return json({ id: createJson?.id, status: createJson?.status || 'starting' });
  } catch (e) {
    console.error('[text-to-image]', e);
    return json({ error: (e as Error)?.message || 'Unknown error' }, 500);
  }
});
