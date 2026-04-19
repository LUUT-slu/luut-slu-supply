import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";

function buildWelcomeEmailHtml(customerName: string, hasDiscount: boolean): string {
  const name = customerName || "there";
  const discountSection = hasDiscount
    ? `<tr><td style="padding:0 32px 24px;">
        <div style="background:#FFF8E1;border:2px solid #D4A017;border-radius:8px;padding:20px;text-align:center;">
          <p style="margin:0 0 4px;font-size:12px;color:#999;text-transform:uppercase;letter-spacing:1px;">Your Welcome Gift</p>
          <p style="margin:0 0 8px;font-size:28px;font-weight:700;color:#D4A017;">EC$10 OFF</p>
          <p style="margin:0;font-size:14px;color:#555;">Your first order — applied automatically at checkout</p>
        </div>
      </td></tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:'Inter',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4;padding:20px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
        
        <!-- Header -->
        <tr><td style="background-color:#0D0D0D;padding:24px 32px;text-align:center;">
          <h1 style="margin:0;font-size:22px;font-weight:700;color:#D4A017;letter-spacing:1px;">LUUT SLU</h1>
          <p style="margin:4px 0 0;font-size:12px;color:#999;letter-spacing:0.5px;">Your Caribbean Marketplace</p>
        </td></tr>

        <!-- Welcome -->
        <tr><td style="padding:32px 32px 16px;">
          <h2 style="margin:0 0 8px;font-size:22px;color:#0D0D0D;font-weight:700;">Welcome to Luut SLU 👋</h2>
          <p style="margin:0;font-size:14px;color:#555;line-height:1.6;">Glad to have you here, ${name}. You now have access to products from verified local sellers across Saint Lucia.</p>
        </td></tr>

        ${discountSection}

        <!-- What You Can Do -->
        <tr><td style="padding:0 32px 24px;">
          <p style="margin:0 0 12px;font-size:14px;font-weight:600;color:#333;">What you can do</p>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding:6px 0;font-size:14px;color:#555;">🛍️ Browse products from different sellers</td></tr>
            <tr><td style="padding:6px 0;font-size:14px;color:#555;">📦 Order and schedule meetups</td></tr>
            <tr><td style="padding:6px 0;font-size:14px;color:#555;">🔥 Discover new drops and limited items</td></tr>
            <tr><td style="padding:6px 0;font-size:14px;color:#555;">🇱🇨 Shop locally with trusted sellers</td></tr>
          </table>
        </td></tr>

        <!-- How It Works -->
        <tr><td style="padding:0 32px 24px;">
          <div style="background:#f8f8f8;border-radius:8px;padding:20px;">
            <p style="margin:0 0 16px;font-size:14px;font-weight:600;color:#333;">How ordering works</p>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:8px 0;font-size:14px;color:#555;vertical-align:top;width:32px;"><strong style="color:#D4A017;">1.</strong></td>
                <td style="padding:8px 0;font-size:14px;color:#555;">Choose your item</td>
              </tr>
              <tr>
                <td style="padding:8px 0;font-size:14px;color:#555;vertical-align:top;"><strong style="color:#D4A017;">2.</strong></td>
                <td style="padding:8px 0;font-size:14px;color:#555;">Place your order</td>
              </tr>
              <tr>
                <td style="padding:8px 0;font-size:14px;color:#555;vertical-align:top;"><strong style="color:#D4A017;">3.</strong></td>
                <td style="padding:8px 0;font-size:14px;color:#555;">Select pickup location (Castries / Gros Islet / Rodney Bay)</td>
              </tr>
              <tr>
                <td style="padding:8px 0;font-size:14px;color:#555;vertical-align:top;"><strong style="color:#D4A017;">4.</strong></td>
                <td style="padding:8px 0;font-size:14px;color:#555;">Meet and pay on pickup</td>
              </tr>
            </table>
          </div>
        </td></tr>

        <!-- Important Info -->
        <tr><td style="padding:0 32px 24px;">
          <div style="background:#FFF3CD;border-radius:8px;padding:16px;">
            <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#856404;">Important info</p>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td style="padding:4px 0;font-size:13px;color:#856404;">• Meetups only (no delivery unless stated)</td></tr>
              <tr><td style="padding:4px 0;font-size:13px;color:#856404;">• Payment on pickup</td></tr>
              <tr><td style="padding:4px 0;font-size:13px;color:#856404;">• Confirm your pickup time</td></tr>
              <tr><td style="padding:4px 0;font-size:13px;color:#856404;">• Items move fast, so don't delay</td></tr>
            </table>
          </div>
        </td></tr>

        <!-- CTA -->
        <tr><td style="padding:0 32px 32px;text-align:center;">
          <a href="https://luut-slu-supply.lovable.app/shop/best-sellers" style="display:inline-block;background-color:#D4A017;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:16px;font-weight:600;letter-spacing:0.5px;">Start Shopping</a>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#f8f8f8;padding:24px 32px;text-align:center;border-top:1px solid #eee;">
          <p style="margin:0 0 4px;font-size:12px;color:#999;">Need help? Message us on WhatsApp</p>
          <p style="margin:0;font-size:11px;color:#bbb;">© ${new Date().getFullYear()} Luut SLU · Saint Lucia</p>
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

    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY is not configured");
    if (!supabaseUrl || !supabaseKey) throw new Error("Missing Supabase configuration");

    const { userId, email } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Missing email" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    let customerName = "";
    let hasDiscount = false;

    if (userId) {
      // Get customer name from profile
      const { data: profile } = await supabase
        .from("customer_profiles")
        .select("full_name")
        .eq("user_id", userId)
        .maybeSingle();

      customerName = profile?.full_name || "";

      // Check for welcome discount
      const { data: discount } = await supabase
        .from("customer_discounts")
        .select("id, discount_amount")
        .eq("user_id", userId)
        .eq("discount_type", "welcome")
        .eq("is_used", false)
        .maybeSingle();

      hasDiscount = !!discount;
    } else {
      // User ID not available yet (email confirmation pending)
      // Assume discount exists since grant_welcome_discount trigger fires on auth.users insert
      hasDiscount = true;
    }

    const html = buildWelcomeEmailHtml(customerName, hasDiscount);
    const subject = "Welcome to Luut SLU 👋";

    console.log(`Sending welcome email to ${email}`);

    const response = await fetch(`${GATEWAY_URL}/emails`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": RESEND_API_KEY,
      },
      body: JSON.stringify({
        from: Deno.env.get("RESEND_FROM_EMAIL") || "Luut SLU <onboarding@resend.dev>",
        to: [email],
        subject,
        html,
      }),
    });

    const resendData = await response.json();

    if (!response.ok) {
      console.error(`Resend API error [${response.status}]:`, JSON.stringify(resendData));
      return new Response(
        JSON.stringify({ error: "Failed to send welcome email", details: resendData }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Welcome email sent successfully:", resendData.id || resendData);

    return new Response(
      JSON.stringify({ success: true, emailId: resendData.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("send-welcome-email error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
