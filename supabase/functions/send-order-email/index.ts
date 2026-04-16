import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";

interface EmailRequest {
  orderId: string;
  type: "order_confirmation" | "order_confirmed" | "order_ready";
}

function buildEmailHtml(
  type: string,
  order: {
    order_number: number;
    customer_name: string;
    location: string;
    preferred_date: string;
    pickup_time?: string;
    total_price: number;
    line_items: Array<{ title: string; quantity: number; price: string }>;
    note?: string;
  }
): { subject: string; html: string } {
  const orderNum = `#L${String(order.order_number).padStart(4, "0")}`;

  const itemsHtml = order.line_items
    .map(
      (item) => `
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #eee;font-size:14px;color:#333;">${item.title}</td>
        <td style="padding:8px 0;border-bottom:1px solid #eee;font-size:14px;color:#333;text-align:center;">×${item.quantity}</td>
        <td style="padding:8px 0;border-bottom:1px solid #eee;font-size:14px;color:#333;text-align:right;">EC$${parseFloat(item.price).toFixed(2)}</td>
      </tr>`
    )
    .join("");

  const pickupTimeHtml = order.pickup_time
    ? `<p style="margin:0 0 8px;font-size:14px;color:#333;">⏰ <strong>Time:</strong> ${order.pickup_time}</p>`
    : "";

  const noteHtml = order.note
    ? `<div style="margin-top:16px;padding:12px;background:#f9f9f9;border-radius:8px;">
        <p style="margin:0;font-size:13px;color:#666;">📝 <strong>Note:</strong> ${order.note}</p>
      </div>`
    : "";

  let title: string;
  let subtitle: string;
  let subject: string;
  let accentColor: string;

  switch (type) {
    case "order_confirmation":
      title = "Order Received! 🎉";
      subtitle = `Thank you, ${order.customer_name}! We've received your order and it's being reviewed.`;
      subject = `Order ${orderNum} Received — Luut SLU`;
      accentColor = "#D4A017";
      break;
    case "order_confirmed":
      title = "Order Confirmed ✅";
      subtitle = `Great news, ${order.customer_name}! Your order has been confirmed. See your pickup details below.`;
      subject = `Order ${orderNum} Confirmed — Luut SLU`;
      accentColor = "#2563EB";
      break;
    case "order_ready":
      title = "Order Ready for Pickup 📦";
      subtitle = `${order.customer_name}, your order is ready! Head to your pickup location at the scheduled time.`;
      subject = `Order ${orderNum} Ready for Pickup — Luut SLU`;
      accentColor = "#16A34A";
      break;
    default:
      title = "Order Update";
      subtitle = `Hi ${order.customer_name}, here's an update on your order.`;
      subject = `Order ${orderNum} Update — Luut SLU`;
      accentColor = "#D4A017";
  }

  const html = `<!DOCTYPE html>
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

        <!-- Title -->
        <tr><td style="padding:32px 32px 16px;">
          <h2 style="margin:0 0 8px;font-size:22px;color:${accentColor};font-weight:700;">${title}</h2>
          <p style="margin:0;font-size:14px;color:#555;line-height:1.5;">${subtitle}</p>
        </td></tr>

        <!-- Order Number -->
        <tr><td style="padding:0 32px 24px;">
          <div style="background:#f8f8f8;border-radius:8px;padding:16px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#999;text-transform:uppercase;letter-spacing:1px;">Order Number</p>
            <p style="margin:4px 0 0;font-size:24px;font-weight:700;color:#0D0D0D;">${orderNum}</p>
          </div>
        </td></tr>

        <!-- Items -->
        <tr><td style="padding:0 32px 24px;">
          <p style="margin:0 0 12px;font-size:14px;font-weight:600;color:#333;">Items Ordered</p>
          <table width="100%" cellpadding="0" cellspacing="0">
            <thead><tr>
              <th style="text-align:left;padding:8px 0;border-bottom:2px solid #eee;font-size:12px;color:#999;text-transform:uppercase;">Item</th>
              <th style="text-align:center;padding:8px 0;border-bottom:2px solid #eee;font-size:12px;color:#999;text-transform:uppercase;">Qty</th>
              <th style="text-align:right;padding:8px 0;border-bottom:2px solid #eee;font-size:12px;color:#999;text-transform:uppercase;">Price</th>
            </tr></thead>
            <tbody>${itemsHtml}</tbody>
          </table>
          <div style="text-align:right;padding-top:12px;">
            <span style="font-size:18px;font-weight:700;color:#0D0D0D;">Total: EC$${order.total_price.toFixed(2)}</span>
          </div>
        </td></tr>

        <!-- Pickup Details -->
        <tr><td style="padding:0 32px 24px;">
          <div style="background:${accentColor}10;border:1px solid ${accentColor}30;border-radius:8px;padding:20px;">
            <p style="margin:0 0 12px;font-size:14px;font-weight:600;color:#333;">📍 Pickup Details</p>
            <p style="margin:0 0 8px;font-size:14px;color:#333;">📍 <strong>Location:</strong> ${order.location}</p>
            <p style="margin:0 0 8px;font-size:14px;color:#333;">📅 <strong>Date:</strong> ${order.preferred_date}</p>
            ${pickupTimeHtml}
            <p style="margin:0;font-size:14px;color:#333;">💳 <strong>Payment:</strong> Cash on meetup</p>
          </div>
        </td></tr>

        ${noteHtml ? `<tr><td style="padding:0 32px 24px;">${noteHtml}</td></tr>` : ""}

        ${type === "order_confirmed" || type === "order_ready" ? `
        <tr><td style="padding:0 32px 24px;">
          <div style="background:#FFF3CD;border-radius:8px;padding:16px;">
            <p style="margin:0;font-size:13px;color:#856404;line-height:1.5;">
              ⚠️ <strong>Reminder:</strong> Please arrive at the pickup location on time. If you can't make it, message us on WhatsApp as early as possible.
            </p>
          </div>
        </td></tr>` : ""}

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

  return { subject, html };
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

    const { orderId, type }: EmailRequest = await req.json();

    if (!orderId || !type) {
      return new Response(
        JSON.stringify({ error: "Missing orderId or type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      console.error("Order fetch error:", orderError);
      return new Response(
        JSON.stringify({ error: "Order not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!order.customer_email) {
      console.log("No customer email on order", orderId, "— skipping email send");
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "no_email" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const lineItems = Array.isArray(order.line_items)
      ? order.line_items.map((item: any) => ({
          title: item.title || "Item",
          quantity: item.quantity || 1,
          price: String(item.price || "0"),
        }))
      : [];

    const { subject, html } = buildEmailHtml(type, {
      order_number: order.order_number,
      customer_name: order.customer_name,
      location: order.location,
      preferred_date: order.preferred_date,
      pickup_time: order.pickup_time || order.pickup_time_window || undefined,
      total_price: order.total_price,
      line_items: lineItems,
      note: order.note || undefined,
    });

    console.log(`Sending ${type} email to ${order.customer_email} for order #L${String(order.order_number).padStart(4, "0")}`);

    const response = await fetch(`${GATEWAY_URL}/emails`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": RESEND_API_KEY,
      },
      body: JSON.stringify({
        from: "Luut SLU <onboarding@resend.dev>",
        to: [order.customer_email],
        subject,
        html,
      }),
    });

    const resendData = await response.json();

    if (!response.ok) {
      console.error(`Resend API error [${response.status}]:`, JSON.stringify(resendData));
      return new Response(
        JSON.stringify({ error: "Failed to send email", details: resendData }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Email sent successfully:", resendData.id || resendData);

    return new Response(
      JSON.stringify({ success: true, emailId: resendData.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("send-order-email error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
