// Returns health/status for Lovable AI and Replicate. Admin-only.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const REPLICATE_API_TOKEN = Deno.env.get("REPLICATE_API_TOKEN");

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: userRes } = await admin.auth.getUser(token);
    const userId = userRes?.user?.id;
    if (!userId) return json({ error: "Unauthorized" }, 401);

    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", userId);
    if (!roles?.some((r: { role: string }) => r.role === "admin")) {
      return json({ error: "Admin access required" }, 403);
    }

    // --- Lovable AI: tiny ping (1 token) to detect configured / 402 / 429 / down.
    let lovable: Record<string, unknown> = { configured: !!LOVABLE_API_KEY };
    if (!LOVABLE_API_KEY) {
      lovable = { configured: false, status: "missing", message: "LOVABLE_API_KEY not set" };
    } else {
      try {
        const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [{ role: "user", content: "ping" }],
            max_tokens: 1,
          }),
        });
        if (r.ok) {
          lovable = { configured: true, status: "healthy", message: "AI Gateway responding" };
        } else if (r.status === 402) {
          lovable = { configured: true, status: "out_of_credits", message: "Not enough credits" };
        } else if (r.status === 429) {
          lovable = { configured: true, status: "rate_limited", message: "Rate limited" };
        } else {
          const t = await r.text().catch(() => "");
          lovable = { configured: true, status: "error", message: `Gateway ${r.status}: ${t.slice(0, 120)}` };
        }
      } catch (e) {
        lovable = { configured: true, status: "error", message: (e as Error).message };
      }
    }

    // --- Replicate: GET /v1/account returns { username, name, type, github_url }.
    let replicate: Record<string, unknown> = { configured: !!REPLICATE_API_TOKEN };
    if (!REPLICATE_API_TOKEN) {
      replicate = { configured: false, status: "missing", message: "REPLICATE_API_TOKEN not set" };
    } else {
      try {
        const r = await fetch("https://api.replicate.com/v1/account", {
          headers: { Authorization: `Token ${REPLICATE_API_TOKEN}` },
        });
        if (r.ok) {
          const acct = await r.json();
          replicate = {
            configured: true,
            status: "healthy",
            message: `Connected as ${acct.username ?? acct.name ?? "account"}`,
            username: acct.username ?? null,
            name: acct.name ?? null,
            type: acct.type ?? null,
          };
        } else if (r.status === 401 || r.status === 403) {
          replicate = { configured: true, status: "error", message: "Invalid Replicate token" };
        } else if (r.status === 402) {
          replicate = { configured: true, status: "out_of_credits", message: "Not enough credits" };
        } else {
          const t = await r.text().catch(() => "");
          replicate = { configured: true, status: "error", message: `Replicate ${r.status}: ${t.slice(0, 120)}` };
        }
      } catch (e) {
        replicate = { configured: true, status: "error", message: (e as Error).message };
      }
    }

    return json({ lovable, replicate, checkedAt: new Date().toISOString() });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unknown" }, 500);
  }
});
