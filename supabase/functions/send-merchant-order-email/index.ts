import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MERCHANT_EMAIL = "usual.suspect118@gmail.com";
const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";

interface LineItem {
  title: string;
  quantity: number;
  price: string;
  seller_name?: string;
}

function buildHtml(order: any): string {
  const orderNumber = `#L${String(order.order_number).padStart(4, "0")}`;
  const items: LineItem[] = Array.isArray(order.line_items) ? order.line_items : [];

  const rows = items
    .map((it) => {
      const qty = it.quantity || 1;
      const unit = parseFloat(it.price || "0");
      const lineTotal = (qty * unit).toFixed(2);
      return `
        <tr>
          <td style="padding:10px;border-bottom:1px solid #eee;">${escape(it.title)}${it.seller_name ? `<br/><span style="color:#888;font-size:12px;">Sold by ${escape(it.seller_name)}</span>` : ""}</td>
          <td style="padding:10px;border-bottom:1px solid #eee;text-align:center;">${qty}</td>
          <td style="padding:10px;border-bottom:1px solid #eee;text-align:right;">EC$${unit.toFixed(2)}</td>
          <td style="padding:10px;border-bottom:1px solid #eee;text-align:right;">EC$${lineTotal}</td>
        </tr>`;
    })
    .join("");

  const pickupTime = order.pickup_time || order.pickup_time_window || "";
  const noteRow = order.note
    ? `<tr><td style="padding:8px 0;color:#666;">Note</td><td style="padding:8px 0;">${escape(order.note)}</td></tr>`
    : "";

  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;max-width:600px;width:100%;">
        <tr><td style="background:#000;padding:20px 24px;">
          <div style="color:#d4af37;font-weight:700;font-size:18px;letter-spacing:2px;">LUUT SLU</div>
          <div style="color:#fff;font-size:14px;margin-top:4px;">New Order Notification</div>
        </td></tr>
        <tr><td style="padding:24px;">
          <h2 style="margin:0 0 4px;font-size:20px;">🆕 New Order ${orderNumber}</h2>
          <p style="margin:0 0 20px;color:#666;font-size:14px;">A new order just came in through the website checkout.</p>

          <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;margin-bottom:20px;">
            <tr><td style="padding:8px 0;color:#666;width:140px;">Order ID</td><td style="padding:8px 0;font-family:monospace;">${orderNumber}</td></tr>
            <tr><td style="padding:8px 0;color:#666;">Customer</td><td style="padding:8px 0;">${escape(order.customer_name)}</td></tr>
            <tr><td style="padding:8px 0;color:#666;">Phone</td><td style="padding:8px 0;"><a href="tel:${escape(order.customer_phone || "")}" style="color:#111;">${escape(order.customer_phone || "—")}</a></td></tr>
            <tr><td style="padding:8px 0;color:#666;">Pickup location</td><td style="padding:8px 0;">${escape(order.location)}</td></tr>
            <tr><td style="padding:8px 0;color:#666;">Pickup date</td><td style="padding:8px 0;">${escape(order.preferred_date)}</td></tr>
            ${pickupTime ? `<tr><td style="padding:8px 0;color:#666;">Pickup time</td><td style="padding:8px 0;">${escape(pickupTime)}</td></tr>` : ""}
            ${noteRow}
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
        </td></tr>
        <tr><td style="background:#fafafa;padding:16px 24px;color:#888;font-size:12px;text-align:center;">
          Luut SLU — Marketplace, Saint Lucia
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { orderId } = await req.json();
    if (!orderId) {
      return new Response(JSON.stringify({ error: "orderId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    const resendKey = Deno.env.get("RESEND_API_KEY");

    if (!lovableKey || !resendKey) {
      console.error("Missing email gateway secrets");
      return new Response(JSON.stringify({ error: "Email not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);
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

    const orderNumber = `#L${String(order.order_number).padStart(4, "0")}`;
    const firstItem =
      Array.isArray(order.line_items) && order.line_items[0]
        ? (order.line_items[0] as any).title
        : "New Order";
    const subject = `New Order ${orderNumber} — ${firstItem}`;
    const html = buildHtml(order);

    const resp = await fetch(`${GATEWAY_URL}/emails`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": resendKey,
      },
      body: JSON.stringify({
        from: "Luut SLU <onboarding@resend.dev>",
        to: [MERCHANT_EMAIL],
        subject,
        html,
      }),
    });

    const result = await resp.json();
    if (!resp.ok) {
      console.error("Resend error:", resp.status, result);
      return new Response(JSON.stringify({ error: "Email send failed", detail: result }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Merchant email sent for order", orderNumber, "id:", result.id);
    return new Response(JSON.stringify({ success: true, id: result.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-merchant-order-email error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
