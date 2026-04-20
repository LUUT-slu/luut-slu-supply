import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_EMAIL = "usual.suspect.118@gmail.com";
const RESEND_URL = "https://api.resend.com/emails";
const SITE_URL = "https://luut-slu-supply.lovable.app";

type AdminAlertType =
  | "seller_application"
  | "customer_signup"
  | "review_submitted"
  | "seller_product"
  | "low_stock"
  | "payment_issue"
  | "order_status_change";

interface AdminAlertRequest {
  type: AdminAlertType;
  payload: Record<string, any>;
}

function escape(s: any): string {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function row(label: string, value: any): string {
  if (value == null || value === "") return "";
  return `<tr><td style="padding:8px 0;color:#666;width:140px;font-size:13px;">${escape(label)}</td><td style="padding:8px 0;font-size:14px;">${escape(value)}</td></tr>`;
}

function shell(title: string, intro: string, rowsHtml: string, ctaUrl: string, ctaLabel: string): string {
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;max-width:600px;width:100%;">
        <tr><td style="background:#000;padding:20px 24px;">
          <div style="color:#d4af37;font-weight:700;font-size:18px;letter-spacing:2px;">LUUT SLU</div>
          <div style="color:#fff;font-size:14px;margin-top:4px;">Admin Alert</div>
        </td></tr>
        <tr><td style="padding:24px;">
          <h2 style="margin:0 0 4px;font-size:20px;">${escape(title)}</h2>
          <p style="margin:0 0 20px;color:#666;font-size:14px;">${escape(intro)}</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;margin-bottom:20px;">
            ${rowsHtml}
          </table>
          ${ctaUrl ? `<a href="${ctaUrl}" style="display:inline-block;background:#000;color:#d4af37;text-decoration:none;padding:12px 20px;border-radius:6px;font-weight:700;font-size:14px;">${escape(ctaLabel)} →</a>` : ""}
        </td></tr>
        <tr><td style="background:#fafafa;padding:16px 24px;color:#888;font-size:12px;text-align:center;">
          Luut SLU — Admin Notification
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function buildTemplate(type: AdminAlertType, p: Record<string, any>): { subject: string; html: string } {
  switch (type) {
    case "seller_application": {
      const name = p.business_name || p.name || "Unknown";
      const subject = `New Seller Request – ${name}`;
      const rows =
        row("Name", p.name) +
        row("Business", p.business_name) +
        row("WhatsApp", p.whatsapp) +
        row("Location", p.location) +
        row("Instagram", p.instagram_url) +
        row("Email", p.email);
      return {
        subject,
        html: shell(
          `🧑‍💼 New Seller Request`,
          `${name} just applied to sell on Luut.`,
          rows,
          `${SITE_URL}/admin/sellers`,
          "Review Application",
        ),
      };
    }

    case "customer_signup": {
      const label = p.full_name || p.email || "New customer";
      const subject = `New Customer Signup – ${label}`;
      const rows =
        row("Name", p.full_name || "—") +
        row("Email", p.email) +
        row("Signed up", new Date().toLocaleString("en-US"));
      return {
        subject,
        html: shell(
          `👋 New Customer Signup`,
          `A new customer just created an account on Luut.`,
          rows,
          `${SITE_URL}/admin`,
          "Open Admin",
        ),
      };
    }

    case "review_submitted": {
      const stars = "★".repeat(Math.max(1, Math.min(5, Number(p.rating) || 0)));
      const subjectName = p.product_title || "general feedback";
      const subject = `New Review – ${stars} ${subjectName}`;
      const rows =
        row("Rating", `${p.rating} / 5`) +
        row("Reviewer", p.reviewer_name || "Anonymous") +
        row("Product", p.product_title || "General review") +
        row("Comment", p.comment || "—");
      return {
        subject,
        html: shell(
          `⭐ New Review Submitted`,
          `A customer just left a review.`,
          rows,
          `${SITE_URL}/admin/reviews`,
          "Moderate Review",
        ),
      };
    }

    case "seller_product": {
      const name = p.product_name || "Unnamed product";
      const subject = `New Product Submission – ${name}`;
      const rows =
        row("Product", name) +
        row("Seller", p.seller_name || "—") +
        row("Price", p.price != null ? `EC$${Number(p.price).toFixed(2)}` : "—") +
        row("Quantity", p.quantity ?? "—") +
        row("Category", p.category || "—");
      return {
        subject,
        html: shell(
          `📦 New Product Submission`,
          `A seller just added a new product.`,
          rows,
          `${SITE_URL}/admin`,
          "Review Product",
        ),
      };
    }

    case "low_stock": {
      const name = p.product_name || "Product";
      const subject = `Low Stock Alert – ${name}`;
      const rows =
        row("Product", name) +
        row("Stock left", p.qty_on_hand ?? 0) +
        row("Partner", p.partner_name || p.partner_id || "—");
      return {
        subject,
        html: shell(
          `⚠️ Low Stock Alert`,
          `Inventory is running low and may need restocking.`,
          rows,
          `${SITE_URL}/admin`,
          "Manage Stock",
        ),
      };
    }

    case "order_status_change": {
      const orderNum = p.order_number ? `#L${String(p.order_number).padStart(4, "0")}` : (p.order_id || "");
      const status = String(p.new_status || "updated").toUpperCase();
      const subject = status === "CANCELLED"
        ? `Order Cancelled – ${orderNum}`
        : `Order ${status} – ${orderNum}`;
      const rows =
        row("Order", orderNum) +
        row("New Status", status) +
        row("Customer", p.customer_name || "—") +
        row("Reason", p.reason || "—");
      return {
        subject,
        html: shell(
          `🔁 Order Status Changed`,
          `An order's status changed and may need attention.`,
          rows,
          p.order_id ? `${SITE_URL}/admin/orders/${p.order_id}` : `${SITE_URL}/admin/orders`,
          "View Order",
        ),
      };
    }

    case "payment_issue": {
      const orderNum = p.order_number ? `#L${String(p.order_number).padStart(4, "0")}` : (p.order_id || "—");
      const subject = `Payment Issue – ${orderNum}`;
      const rows =
        row("Order", orderNum) +
        row("Customer", p.customer_name || "—") +
        row("Issue", p.issue || "Unknown payment problem") +
        row("Amount", p.amount != null ? `EC$${Number(p.amount).toFixed(2)}` : "—");
      return {
        subject,
        html: shell(
          `💳 Payment Issue`,
          `An order has a payment problem that needs review.`,
          rows,
          p.order_id ? `${SITE_URL}/admin/orders/${p.order_id}` : `${SITE_URL}/admin/orders`,
          "View Order",
        ),
      };
    }

    default:
      return {
        subject: `Admin Alert`,
        html: shell(`Admin Alert`, `Unknown alert type.`, "", `${SITE_URL}/admin`, "Open Admin"),
      };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = (await req.json()) as AdminAlertRequest;
    const { type, payload } = body || ({} as AdminAlertRequest);

    if (!type) {
      return new Response(JSON.stringify({ error: "type required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      console.error("send-admin-alert: missing RESEND_API_KEY");
      // Return 200 so caller never breaks the user flow
      return new Response(JSON.stringify({ ok: false, skipped: "no_api_key" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { subject, html } = buildTemplate(type, payload || {});

    const resp = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: Deno.env.get("RESEND_FROM_EMAIL") || "Luut SLU <onboarding@resend.dev>",
        to: [ADMIN_EMAIL],
        subject,
        html,
      }),
    });

    const result = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      console.error(`send-admin-alert[${type}] resend error:`, resp.status, result);
      // Always return 200 so the caller never throws
      return new Response(JSON.stringify({ ok: false, status: resp.status, detail: result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`send-admin-alert[${type}] sent id=${result.id}`);
    return new Response(JSON.stringify({ ok: true, id: result.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-admin-alert exception:", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
