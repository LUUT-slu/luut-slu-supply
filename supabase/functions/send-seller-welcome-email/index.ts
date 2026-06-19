import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";
const SITE_URL = "https://luut-slu-supply.lovable.app";
const DASHBOARD_URL = `${SITE_URL}/seller/dashboard`;
const WHATSAPP_URL = "https://wa.me/17587185478";

function buildSellerWelcomeHtml(): string {
  const liveFeature = (icon: string, title: string, body: string) => `
    <tr><td style="padding:12px 0;">
      <p style="margin:0 0 4px;font-size:15px;font-weight:600;color:#0D0D0D;">${icon} ${title}</p>
      <p style="margin:0;font-size:14px;color:#555;line-height:1.6;">${body}</p>
    </td></tr>`;

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
          <h2 style="margin:0 0 12px;font-size:22px;font-weight:700;">Welcome to your seller dashboard.</h2>
          <p style="margin:0 0 16px;font-size:15px;color:#444;line-height:1.6;">Everything you need to run your business on LUUT is in one place. Here's what's available to you right now — and what's coming next.</p>
        </td></tr>

        <tr><td style="padding:8px 32px 8px;">
          <p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:1.5px;color:#D4A017;">WHAT'S LIVE NOW</p>
          <table width="100%" cellpadding="0" cellspacing="0">
            ${liveFeature("📦", "Order Management", "Every order placed for your products comes straight into your dashboard. Confirm orders, message customers on WhatsApp, track pickup status, and mark orders complete — all without leaving the platform.")}
            ${liveFeature("🗼", "Product Listings", "Add your products with photos, prices, categories, and stock levels. Your listings go live on the LUUT storefront immediately. Customers can browse, save, and order directly.")}
            ${liveFeature("📊", "Sales Analytics", "See how your products are performing — views, clicks, orders placed, and revenue earned. Know your best sellers and your slow movers at a glance.")}
            ${liveFeature("👤", "Seller Profile", "Your profile is your digital storefront. Add your logo, banner, and description. Customers see your profile when they browse your products and can follow your store directly.")}
            ${liveFeature("🤖", "AI Seller Assistant", "Your dashboard includes a built-in AI assistant trained on your store data. Ask it to summarise your orders, draft customer messages, rewrite your listings, or give you selling tips — all in seconds.")}
          </table>
        </td></tr>

        <tr><td style="padding:24px 32px 8px;">
          <p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:1.5px;color:#D4A017;">COMING SOON</p>
          <p style="margin:0 0 12px;font-size:13px;color:#888;font-style:italic;">These features are already in development and will be rolling out to sellers shortly.</p>
          <table width="100%" cellpadding="0" cellspacing="0">
            ${liveFeature("🎨", "AI Marketing Studio", "Generate professional product posters, display images, and short video ads directly from your product photos — in seconds, no design skills needed. Built-in AI creates luxury lifestyle scenes around your products with your price and branding added automatically. Export directly to Instagram, TikTok, and Facebook.")}
            ${liveFeature("📝", "AI Marketing Copy", "Generate ready-to-post captions, WhatsApp broadcast messages, Facebook Marketplace descriptions, and paid ad copy for any product — all written in the right tone for the Saint Lucian market. One click, done.")}
            ${liveFeature("🔗", "Your LUUT Seller Link", "Every seller gets a unique LUUT link to share on social media, run ads, or send directly to customers. Traffic from your link comes directly to your store page inside LUUT — you bring the audience, LUUT handles the rest.")}
            ${liveFeature("⭐", "Reviews & Ratings", "Customers will be able to leave reviews on your products and profile. Good reviews build trust and drive more sales automatically. The stronger your reputation on LUUT, the more visibility your store gets.")}
            ${liveFeature("🏷️", "Promoted Listings", "Boost your products to the top of the LUUT storefront and reach more customers across the platform.")}
          </table>
        </td></tr>

        <tr><td style="padding:28px 32px 8px;">
          <h3 style="margin:0 0 8px;font-size:18px;font-weight:700;">Ready to start selling?</h3>
          <p style="margin:0 0 20px;font-size:14px;color:#444;line-height:1.6;">Your dashboard is live. Add your products, set your prices, and start taking orders today.</p>
        </td></tr>

        <tr><td style="padding:0 32px 32px;text-align:center;">
          <a href="${DASHBOARD_URL}" style="display:inline-block;background-color:#D4A017;color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:8px;font-size:15px;font-weight:600;letter-spacing:0.5px;">Go to My Dashboard →</a>
        </td></tr>

        <tr><td style="padding:0 32px 28px;">
          <p style="margin:0;font-size:14px;color:#444;line-height:1.6;">Questions? Reach out to the LUUT team on <a href="${WHATSAPP_URL}" style="color:#D4A017;text-decoration:none;font-weight:600;">WhatsApp</a> — we're here to help you grow.</p>
          <p style="margin:16px 0 0;font-size:14px;color:#666;font-style:italic;">— The LUUT Team</p>
        </td></tr>

        <tr><td style="background:#f8f8f8;padding:20px 32px;text-align:center;border-top:1px solid #eee;">
          <p style="margin:0;font-size:11px;color:#999;">LUUT SLU · Saint Lucia's Digital Marketplace</p>
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
      console.error("send-seller-welcome-email: missing env config");
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


    const body = await req.json().catch(() => ({}));
    let { email, userId, sellerId } = body as {
      email?: string;
      userId?: string;
      sellerId?: string;
    };

    // Resolve email from seller_profiles / auth.users if not provided
    if (!email && (userId || sellerId)) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      let resolvedUserId = userId;
      if (!resolvedUserId && sellerId) {
        const { data: sp } = await supabase
          .from("seller_profiles")
          .select("user_id, owner_email")
          .eq("id", sellerId)
          .maybeSingle();
        resolvedUserId = sp?.user_id ?? undefined;
        if (sp?.owner_email) email = sp.owner_email;
      }
      if (!email && resolvedUserId) {
        const { data: u } = await supabase.auth.admin.getUserById(resolvedUserId);
        email = u?.user?.email ?? undefined;
      }
    }

    if (!email) {
      console.error("send-seller-welcome-email: could not resolve recipient email");
      return new Response(JSON.stringify({ skipped: true, reason: "no_email" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const html = buildSellerWelcomeHtml();
    const subject = "Your LUUT seller dashboard — everything you need to sell smarter 🖤";
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
      return new Response(JSON.stringify({ success: false, error: resendData }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Seller welcome email sent:", resendData.id || resendData);
    return new Response(JSON.stringify({ success: true, emailId: resendData.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("send-seller-welcome-email error:", error);
    return new Response(JSON.stringify({ success: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
