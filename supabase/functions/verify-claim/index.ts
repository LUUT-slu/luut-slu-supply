// Verify a claim token + phone, then issue a Supabase session for that user.
// Public function. Rate-limited per token.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { normalizePhone } from "../_shared/phone.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 60;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function randomPassword() {
  const bytes = new Uint8Array(24);
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
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  let body: { token?: string; phone?: string };
  try { body = await req.json(); } catch { return json(400, { error: "Invalid JSON" }); }

  const token = (body.token || "").trim();
  const phoneNorm = normalizePhone(body.phone || "");
  if (!token || token.length < 16) return json(400, { error: "Invalid token" });
  if (!phoneNorm) return json(400, { error: "Enter a valid phone number" });

  const ip = req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || null;
  const ua = req.headers.get("user-agent") || null;
  const tokenPrefix = token.slice(0, 8);

  const { data: profile, error: pErr } = await admin
    .from("customer_profiles")
    .select("id, user_id, phone, full_name, claim_attempts, claim_locked_until, claimed_at")
    .eq("claim_token", token)
    .maybeSingle();

  if (pErr) return json(500, { error: "Lookup failed" });
  if (!profile) {
    await admin.from("claim_attempts").insert({ token_prefix: tokenPrefix, ok: false, ip, user_agent: ua });
    return json(404, { error: "Claim link not found or already used" });
  }

  if (profile.claim_locked_until && new Date(profile.claim_locked_until).getTime() > Date.now()) {
    return json(429, {
      error: "Too many attempts. Try again in an hour or contact Luut on WhatsApp.",
      locked_until: profile.claim_locked_until,
    });
  }

  const phoneMatches = normalizePhone(profile.phone) === phoneNorm;

  if (!phoneMatches) {
    const nextAttempts = (profile.claim_attempts || 0) + 1;
    const locked = nextAttempts >= MAX_ATTEMPTS;
    await admin.from("customer_profiles").update({
      claim_attempts: nextAttempts,
      claim_locked_until: locked ? new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString() : null,
    }).eq("id", profile.id);
    await admin.from("claim_attempts").insert({ profile_id: profile.id, token_prefix: tokenPrefix, ok: false, ip, user_agent: ua });
    return json(401, {
      error: locked
        ? "Too many attempts. This link is locked for an hour."
        : `Phone doesn't match. ${MAX_ATTEMPTS - nextAttempts} attempts left.`,
      attempts_left: Math.max(0, MAX_ATTEMPTS - nextAttempts),
    });
  }

  const password = randomPassword();
  const emailAlias = `claim-${phoneNorm.replace(/\D/g, "")}@luutslu.internal`;
  let userId = profile.user_id as string | null;

  if (!userId) {
    const { data: existing } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const match = existing?.users?.find(
      (u: any) => normalizePhone(u.phone || u.user_metadata?.phone || "") === phoneNorm,
    );

    if (match) {
      userId = match.id;
      await admin.auth.admin.updateUserById(userId!, { password });
    } else {
      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        phone: phoneNorm,
        phone_confirm: true,
        password,
        email: emailAlias,
        email_confirm: true,
        user_metadata: {
          full_name: profile.full_name || undefined,
          claimed_via: "phone_token",
        },
      });
      if (cErr || !created?.user) {
        return json(500, { error: cErr?.message || "Could not create your account. Please contact support." });
      }
      userId = created.user.id;
    }

    await admin.from("customer_profiles").update({
      user_id: userId,
      claimed_at: new Date().toISOString(),
      claim_token: null,
      claim_attempts: 0,
      claim_locked_until: null,
    }).eq("id", profile.id);

    await admin.from("orders").update({ customer_user_id: userId })
      .eq("customer_phone", phoneNorm).is("customer_user_id", null);
  } else {
    await admin.auth.admin.updateUserById(userId, { password });
  }

  await admin.from("claim_attempts").insert({ profile_id: profile.id, token_prefix: tokenPrefix, ok: true, ip, user_agent: ua });

  const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
  const { data: sess, error: sErr } = await anon.auth.signInWithPassword({ phone: phoneNorm, password });
  if (sErr || !sess?.session) {
    return json(500, { error: "Could not start your session. Please try again." });
  }

  return json(200, {
    success: true,
    session: {
      access_token: sess.session.access_token,
      refresh_token: sess.session.refresh_token,
    },
    user_id: userId,
  });
});
