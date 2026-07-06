import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_GATEWAY_URL = "https://connector-gateway.lovable.dev/resend/emails";
const SITE_URL = "https://luut-slu-supply.lovable.app";

interface EmailRequest {
  orderId: string;
  type?: "order_confirmation" | "order_confirmed" | "order_ready";
}

function escape(s: string | null | undefined): string {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildHtml(order: any, viewUrl: string): { subject: string; html: string } {
  const orderNum = `#L${String(order.order_number).padStart(4, "0")}`;
  const items: any[] = Array.isArray(order.line_items) ? order.line_items : [];

  const rows = items
    .map((it) => {
      const qty = it.quantity || 1;
      const unit = parseFloat(it.price || "0");
      const lineTotal = (qty * unit).toFixed(2);
      return `
        <tr>
          <td style="padding:10px;border-bottom:1px solid #eee;">${escape(it.title)}</td>
          <td style="padding:10px;border-bottom:1px solid #eee;text-align:center;">${qty}</td>
          <td style="padding:10px;border-bottom:1px solid #eee;text-align:right;">EC$${unit.toFixed(2)}</td>
          <td style="padding:10px;border-bottom:1px solid #eee;text-align:right;">EC$${lineTotal}</td>
        </tr>`;
    })
    .join("");

  const pickupTime = order.pickup_time || order.pickup_time_window || "";

  const subject = `Order ${orderNum} received — Luut SLU`;

  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;max-width:600px;width:100%;">
        <tr><td style="background:#000;padding:20px 24px;">
          <div style="color:#d4af37;font-weight:700;font-size:18px;letter-spacing:2px;">LUUT SLU</div>
          <div style="color:#fff;font-size:14px;margin-top:4px;">Order Confirmation</div>
        </td></tr>
        <tr><td style="padding:24px;">
          <h2 style="margin:0 0 4px;font-size:22px;">Thank you, ${escape(order.customer_name)}! 🎉</h2>
          <p style="margin:0 0 20px;color:#666;font-size:14px;">We've received your order and it's being prepared. Pay on meetup.</p>

          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
            <tr>
              <td>
                <a href="${viewUrl}" style="display:inline-block;background:#000;color:#d4af37;text-decoration:none;padding:12px 22px;border-radius:6px;font-weight:700;font-size:14px;">View My Order →</a>
              </td>
            </tr>
          </table>

          <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;margin-bottom:20px;">
            <tr><td style="padding:8px 0;color:#666;width:140px;">Order ID</td><td style="padding:8px 0;font-family:monospace;">${orderNum}</td></tr>
            <tr><td style="padding:8px 0;color:#666;">Pickup location</td><td style="padding:8px 0;">${escape(order.location)}</td></tr>
            <tr><td style="padding:8px 0;color:#666;">Pickup date</td><td style="padding:8px 0;">${escape(order.preferred_date)}</td></tr>
            ${pickupTime ? `<tr><td style="padding:8px 0;color:#666;">Pickup time</td><td style="padding:8px 0;">${escape(pickupTime)}</td></tr>` : ""}
          </table>

          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:6px;overflow:hidden;font-size:14px;">
            <thead>
              <tr style="background:#fafafa;">
                <th align="left" style="padding:10px;font-size:12px;text-transform:uppercase;color:#666;">Item</th>
                <th style="padding:10px;font-size:12px;text-transform:uppercase;color:#666;">Qty</th>
                <th align="right" style="padding:10px;font-size:12px;text-transform:uppercase;color:#666;">Price</th>
                <th align="right" style="padding:10px;font-size:12px;text-transform:uppercase;color:#666;">Total</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
            <tfoot>
              <tr><td colspan="3" align="right" style="padding:14px 10px;font-weight:700;">Total</td>
                  <td align="right" style="padding:14px 10px;font-weight:700;">EC$${parseFloat(order.total_price).toFixed(2)}</td></tr>
            </tfoot>
          </table>

          <p style="margin:24px 0 0;color:#666;font-size:13px;">Questions? Reply to this email or message us on WhatsApp.</p>
        </td></tr>
        <tr><td style="background:#fafafa;padding:16px 24px;color:#888;font-size:12px;text-align:center;">
          Luut SLU — Marketplace, Saint Lucia
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  return { subject, html };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    // Auth: require user JWT or service-role key
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    let authed = token === serviceKey;
    const adminClient = createClient(supabaseUrl, serviceKey);
    if (!authed && token) {
      const { data, error } = await adminClient.auth.getUser(token);
      authed = !error && !!data?.user;
    }
    if (!authed) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { orderId }: EmailRequest = await req.json();
    if (!orderId) {
      return new Response(JSON.stringify({ error: "orderId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!resendKey || !lovableApiKey) {
      console.error("Missing email connector configuration", {
        hasResendKey: !!resendKey,
        hasLovableApiKey: !!lovableApiKey,
      });
      return new Response(JSON.stringify({ error: "Email not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = adminClient;
    const { data: order, error } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (error || !order) {
      console.error("Order fetch failed:", error);
      return new Response(JSON.stringify({ error: "Order not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!order.customer_email) {
      console.log("No customer_email — skipping send for order", orderId);
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "no_email" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const viewUrl = `${SITE_URL}/order-status/${order.id}?token=${order.order_token}`;
    const { subject, html } = buildHtml(order, viewUrl);

    console.log(`Sending customer email to ${order.customer_email} for order #L${String(order.order_number).padStart(4, "0")}`);

    const resp = await fetch(RESEND_GATEWAY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableApiKey}`,
        "X-Connection-Api-Key": resendKey,
      },
      body: JSON.stringify({
        from: Deno.env.get("RESEND_FROM_EMAIL") || "Luut SLU <onboarding@resend.dev>",
        to: [order.customer_email],
        subject,
        html,
      }),
    });

    const responseText = await resp.text();
    let result: any = null;
    try {
      result = responseText ? JSON.parse(responseText) : {};
    } catch (_) {
      result = { message: responseText || "Email provider returned an unreadable response" };
    }
    if (!resp.ok) {
      console.error("Resend error:", resp.status, result);
      return new Response(JSON.stringify({ error: "Email send failed", detail: result }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Customer email sent, id:", result.id);
    return new Response(JSON.stringify({ success: true, id: result.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-order-email error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
