// Admin-only: mint or rotate a claim token for a customer profile.
// Returns { url, message } ready to paste into WhatsApp.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { normalizePhone } from "../_shared/phone.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SITE_URL = Deno.env.get("SITE_URL") || "https://luut-slu-supply.lovable.app";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json(401, { error: "Unauthorized" });

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: claims } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
  const uid = claims?.claims?.sub;
  if (!uid) return json(401, { error: "Unauthorized" });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const { data: isAdmin } = await admin.rpc("has_role", { _user_id: uid, _role: "admin" });
  if (!isAdmin) return json(403, { error: "Admin only" });

  let body: { profile_id?: string; phone?: string; rotate?: boolean };
  try { body = await req.json(); } catch { return json(400, { error: "Invalid JSON" }); }

  // Locate profile by id or phone
  let profile: any = null;
  if (body.profile_id) {
    const { data } = await admin.from("customer_profiles")
      .select("id, phone, full_name, claim_token, claimed_at").eq("id", body.profile_id).maybeSingle();
    profile = data;
  } else if (body.phone) {
    const norm = normalizePhone(body.phone);
    if (!norm) return json(400, { error: "Invalid phone" });
    const { data } = await admin.from("customer_profiles")
      .select("id, phone, full_name, claim_token, claimed_at").eq("phone", norm).maybeSingle();
    profile = data;
    if (!profile) {
      const { data: created, error: cErr } = await admin.from("customer_profiles")
        .insert({ user_id: null, phone: norm, signup_source: "admin_shadow" })
        .select("id, phone, full_name, claim_token, claimed_at").single();
      if (cErr) return json(500, { error: cErr.message });
      profile = created;
    }
  } else {
    return json(400, { error: "profile_id or phone required" });
  }

  if (!profile) return json(404, { error: "Customer not found" });

  let token = profile.claim_token as string | null;
  if (!token || body.rotate) {
    token = randomToken();
    await admin.from("customer_profiles").update({
      claim_token: token,
      claim_token_issued_at: new Date().toISOString(),
      claim_attempts: 0,
      claim_locked_until: null,
    }).eq("id", profile.id);
  }

  const url = `${SITE_URL}/claim/${token}`;
  const name = profile.full_name ? `Hi ${profile.full_name.split(" ")[0]}, ` : "Hey! ";
  const message =
    `${name}this is Luut SLU 👋 Here's your private link to see all your past orders, exclusive discounts, and get faster checkout next time:\n\n${url}\n\nJust enter your phone number to unlock. This link is only for you — don't share it.`;

  return json(200, {
    success: true,
    profile_id: profile.id,
    token,
    url,
    message,
    already_claimed: !!profile.claimed_at,
  });
});
