import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const jwt = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: userRes, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !userRes?.user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const { refresh_token } = body;
    if (!refresh_token || typeof refresh_token !== "string") {
      return json({ error: "refresh_token required" }, 400);
    }

    const userId = userRes.user.id;

    const { error: upsertErr } = await admin
      .from("google_tokens")
      .upsert(
        { user_id: userId, refresh_token, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );

    if (upsertErr) {
      console.error("[store-calendar-token]", upsertErr);
      return json({ error: "Failed to store token" }, 500);
    }

    await admin
      .from("customer_profiles")
      .update({ calendar_connected: true })
      .eq("user_id", userId);

    return json({ ok: true });
  } catch (e) {
    console.error("[store-calendar-token] error", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
