import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";
const SITE_URL = "https://luut-slu-supply.lovable.app";
const WHATSAPP_URL = "https://wa.me/17587185478";

function buildCustomerWelcomeHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:'Inter',Arial,sans-serif;color:#0D0D0D;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4;padding:20px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
        <tr><td style="background-color:#0D0D0D;padding:28px 32px;text-align:center;">
          <h1 style="margin:0;font-size:24px;font-weight:700;color:#D4A017;letter-spacing:2px;">LUUT SLU</h1>
        </td></tr>

        <tr><td style="padding:32px 32px 8px;">
          <h2 style="margin:0 0 12px;font-size:22px;font-weight:700;">Welcome to LUUT SLU.</h2>
          <p style="margin:0 0 16px;font-size:15px;color:#444;line-height:1.6;">Saint Lucia's cleanest spot for fashion, accessories, and more — all in one place.</p>
          <p style="margin:0 0 20px;font-size:15px;color:#444;line-height:1.6;">Here's how it works:</p>
          <p style="margin:0 0 24px;font-size:15px;color:#444;line-height:1.6;">Browse the store, place your order online, and we meet you at your closest pickup spot — Castries, Rodney Bay, or Gros Islet. Pay on pickup. No stress.</p>
        </td></tr>

        <tr><td style="padding:0 32px 24px;">
          <p style="margin:0 0 12px;font-size:15px;font-weight:600;">What's waiting for you:</p>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding:6px 0;font-size:14px;color:#444;">→ New drops added regularly</td></tr>
            <tr><td style="padding:6px 0;font-size:14px;color:#444;">→ Real products, real prices, no fluff</td></tr>
            <tr><td style="padding:6px 0;font-size:14px;color:#444;">→ Fast WhatsApp support if you need anything</td></tr>
          </table>
        </td></tr>

        <tr><td style="padding:0 32px 32px;text-align:center;">
          <a href="${SITE_URL}" style="display:inline-block;background-color:#D4A017;color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:8px;font-size:15px;font-weight:600;letter-spacing:0.5px;">Start browsing → Shop Now</a>
        </td></tr>

        <tr><td style="padding:0 32px 28px;">
          <p style="margin:0;font-size:14px;color:#444;line-height:1.6;">Got a question? <a href="${WHATSAPP_URL}" style="color:#D4A017;text-decoration:none;font-weight:600;">Hit us on WhatsApp</a> — the team is ready.</p>
          <p style="margin:16px 0 0;font-size:14px;color:#666;font-style:italic;">— The LUUT Team</p>
        </td></tr>

        <tr><td style="background:#f8f8f8;padding:20px 32px;text-align:center;border-top:1px solid #eee;">
          <p style="margin:0;font-size:11px;color:#999;">© ${new Date().getFullYear()} LUUT SLU · Saint Lucia's Digital Marketplace</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!LOVABLE_API_KEY || !RESEND_API_KEY || !supabaseUrl || !supabaseKey) {
      console.error("send-welcome-email: missing env config");
      return new Response(JSON.stringify({ skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Auth: require a valid user JWT or the service-role key.
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    let authed = token === supabaseKey;
    if (!authed && token) {
      const admin = createClient(supabaseUrl, supabaseKey);
      const { data, error } = await admin.auth.getUser(token);
      authed = !error && !!data?.user;
    }
    if (!authed) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { userId, email } = await req.json();
    if (!email) {
      return new Response(JSON.stringify({ error: "Missing email" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Skip if user has a seller profile — they get the seller welcome email instead.
    if (userId) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { data: seller } = await supabase
        .from("seller_profiles")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();
      if (seller) {
        console.log(`Skipping customer welcome: ${email} is a seller`);
        return new Response(JSON.stringify({ skipped: true, reason: "seller" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const html = buildCustomerWelcomeHtml();
    const subject = "You're in. Welcome to LUUT SLU 🖤";
    const from = Deno.env.get("RESEND_FROM_EMAIL")
      ? `LUUT SLU <${Deno.env.get("RESEND_FROM_EMAIL")!.replace(/^.*<|>$/g, "")}>`
      : "LUUT SLU <onboarding@resend.dev>";

    const response = await fetch(`${GATEWAY_URL}/emails`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": RESEND_API_KEY,
      },
      body: JSON.stringify({ from, to: [email], subject, html }),
    });

    const resendData = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error(`Resend API error [${response.status}]:`, JSON.stringify(resendData));
      // Fail silently — never throw, never block signup flow.
      return new Response(JSON.stringify({ success: false, error: resendData }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Customer welcome email sent:", resendData.id || resendData);
    return new Response(JSON.stringify({ success: true, emailId: resendData.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("send-welcome-email error:", error);
    // Fail silently
    return new Response(JSON.stringify({ success: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
