import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_ADMIN_EMAIL = "usual.suspect.118@gmail.com";
const RESEND_URL = "https://api.resend.com/emails";
const SITE_URL = "https://luut-slu-supply.lovable.app";

type AdminAlertType =
  | "new_order"
  | "seller_application"
  | "customer_signup"
  | "review_submitted"
  | "seller_product"
  | "low_stock"
  | "payment_issue"
  | "order_status_change"
  | "contact_form"
  | "general";

interface AdminAlertRequest {
  type: AdminAlertType;
  payload?: Record<string, any>;
  /** When true, bypass enabled-checks (used by Test buttons in admin UI). */
  test?: boolean;
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

function shell(title: string, intro: string, rowsHtml: string, ctaUrl: string, ctaLabel: string, isTest = false): string {
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;max-width:600px;width:100%;">
        <tr><td style="background:#000;padding:20px 24px;">
          <div style="color:#d4af37;font-weight:700;font-size:18px;letter-spacing:2px;">LUUT SLU</div>
          <div style="color:#fff;font-size:14px;margin-top:4px;">Admin Alert${isTest ? " · TEST" : ""}</div>
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
          Luut SLU — Admin Notification${isTest ? " (Test)" : ""}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function buildTemplate(type: AdminAlertType, p: Record<string, any>, isTest = false): { subject: string; html: string } {
  const testTag = isTest ? "[TEST] " : "";
  switch (type) {
    case "new_order": {
      const orderNum = p.order_number ? `#L${String(p.order_number).padStart(4, "0")}` : (p.order_id || "new order");
      const subject = `${testTag}New Order – ${orderNum}`;
      const rows =
        row("Order", orderNum) +
        row("Customer", p.customer_name || "—") +
        row("Total", p.total_price != null ? `EC$${Number(p.total_price).toFixed(2)}` : "—") +
        row("Pickup", p.pickup_time || p.preferred_date || "—") +
        row("Location", p.location || "—");
      return {
        subject,
        html: shell(`🛒 New Order`, `A customer just placed an order.`, rows,
          p.order_id ? `${SITE_URL}/admin/orders/${p.order_id}` : `${SITE_URL}/admin/orders`,
          "View Order", isTest),
      };
    }
    case "seller_application": {
      const name = p.business_name || p.name || "Unknown";
      const subject = `${testTag}New Seller Request – ${name}`;
      const rows =
        row("Name", p.name) + row("Business", p.business_name) + row("WhatsApp", p.whatsapp) +
        row("Location", p.location) + row("Instagram", p.instagram_url) + row("Email", p.email);
      return { subject, html: shell(`🧑‍💼 New Seller Request`, `${name} just applied to sell on Luut.`, rows, `${SITE_URL}/admin/sellers`, "Review Application", isTest) };
    }
    case "customer_signup": {
      const label = p.full_name || p.email || "New customer";
      const subject = `${testTag}New Customer Signup – ${label}`;
      const rows = row("Name", p.full_name || "—") + row("Email", p.email) + row("Signed up", new Date().toLocaleString("en-US"));
      return { subject, html: shell(`👋 New Customer Signup`, `A new customer just created an account on Luut.`, rows, `${SITE_URL}/admin`, "Open Admin", isTest) };
    }
    case "review_submitted": {
      const stars = "★".repeat(Math.max(1, Math.min(5, Number(p.rating) || 0)));
      const subjectName = p.product_title || "general feedback";
      const subject = `${testTag}New Review – ${stars} ${subjectName}`;
      const rows = row("Rating", `${p.rating} / 5`) + row("Reviewer", p.reviewer_name || "Anonymous") + row("Product", p.product_title || "General review") + row("Comment", p.comment || "—");
      return { subject, html: shell(`⭐ New Review Submitted`, `A customer just left a review.`, rows, `${SITE_URL}/admin/reviews`, "Moderate Review", isTest) };
    }
    case "seller_product": {
      const name = p.product_name || "Unnamed product";
      const subject = `${testTag}New Product Submission – ${name}`;
      const rows = row("Product", name) + row("Seller", p.seller_name || "—") + row("Price", p.price != null ? `EC$${Number(p.price).toFixed(2)}` : "—") + row("Quantity", p.quantity ?? "—") + row("Category", p.category || "—");
      return { subject, html: shell(`📦 New Product Submission`, `A seller just added a new product.`, rows, `${SITE_URL}/admin`, "Review Product", isTest) };
    }
    case "low_stock": {
      const name = p.product_name || "Product";
      const subject = `${testTag}Low Stock Alert – ${name}`;
      const rows = row("Product", name) + row("Stock left", p.qty_on_hand ?? 0) + row("Partner", p.partner_name || p.partner_id || "—");
      return { subject, html: shell(`⚠️ Low Stock Alert`, `Inventory is running low and may need restocking.`, rows, `${SITE_URL}/admin`, "Manage Stock", isTest) };
    }
    case "order_status_change": {
      const orderNum = p.order_number ? `#L${String(p.order_number).padStart(4, "0")}` : (p.order_id || "");
      const status = String(p.new_status || "updated").toUpperCase();
      const subject = `${testTag}${status === "CANCELLED" ? `Order Cancelled – ${orderNum}` : `Order ${status} – ${orderNum}`}`;
      const rows = row("Order", orderNum) + row("New Status", status) + row("Customer", p.customer_name || "—") + row("Reason", p.reason || "—");
      return { subject, html: shell(`🔁 Order Status Changed`, `An order's status changed and may need attention.`, rows, p.order_id ? `${SITE_URL}/admin/orders/${p.order_id}` : `${SITE_URL}/admin/orders`, "View Order", isTest) };
    }
    case "payment_issue": {
      const orderNum = p.order_number ? `#L${String(p.order_number).padStart(4, "0")}` : (p.order_id || "—");
      const subject = `${testTag}Payment Issue – ${orderNum}`;
      const rows = row("Order", orderNum) + row("Customer", p.customer_name || "—") + row("Issue", p.issue || "Unknown payment problem") + row("Amount", p.amount != null ? `EC$${Number(p.amount).toFixed(2)}` : "—");
      return { subject, html: shell(`💳 Payment Issue`, `An order has a payment problem that needs review.`, rows, p.order_id ? `${SITE_URL}/admin/orders/${p.order_id}` : `${SITE_URL}/admin/orders`, "View Order", isTest) };
    }
    case "contact_form": {
      const subject = `${testTag}New Contact Form – ${p.name || p.email || "Anonymous"}`;
      const rows = row("Name", p.name || "—") + row("Email", p.email || "—") + row("Subject", p.subject || "—") + row("Message", p.message || "—");
      return { subject, html: shell(`📨 New Contact Form`, `Someone just submitted the contact form.`, rows, `${SITE_URL}/admin`, "Open Admin", isTest) };
    }
    case "general":
    default: {
      const subject = `${testTag}${p.subject || "Admin Alert"}`;
      const rows = row("Message", p.message || "—") + row("Source", p.source || "—");
      return { subject, html: shell(`🔔 ${p.title || "Admin Alert"}`, p.intro || "Admin event from Luut SLU.", rows, `${SITE_URL}/admin`, "Open Admin", isTest) };
    }
  }
}

async function loadNotificationSettings(supabase: any) {
  try {
    const { data } = await supabase
      .from("site_settings")
      .select("value")
      .eq("id", "notifications")
      .maybeSingle();
    return (data?.value as any) || null;
  } catch {
    return null;
  }
}

async function logAttempt(supabase: any, alert_type: string, recipient: string, subject: string, status: string, error_message: string | null, metadata: Record<string, any>) {
  try {
    await supabase.from("admin_alert_logs").insert({
      alert_type, recipient, subject, status, error_message, metadata,
    });
  } catch (e) {
    console.error("admin_alert_logs insert failed", e);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseAnon);

  try {
    const body = (await req.json()) as AdminAlertRequest;
    const { type, payload, test } = body || ({} as AdminAlertRequest);

    if (!type) {
      return new Response(JSON.stringify({ error: "type required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const settings = await loadNotificationSettings(supabase);
    const adminEmail = (settings?.adminEmail && String(settings.adminEmail).includes("@"))
      ? settings.adminEmail
      : DEFAULT_ADMIN_EMAIL;

    // Master kill switch
    if (settings && settings.masterEnabled === false && !test) {
      console.log(`send-admin-alert[${type}] skipped: master disabled`);
      await logAttempt(supabase, type, adminEmail, "(skipped)", "skipped", "master_disabled", payload || {});
      return new Response(JSON.stringify({ ok: false, skipped: "master_disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Per-type toggle
    const alertEnabled = settings?.alerts ? settings.alerts[type] !== false : true;
    if (!alertEnabled && !test) {
      console.log(`send-admin-alert[${type}] skipped: type disabled`);
      await logAttempt(supabase, type, adminEmail, "(skipped)", "skipped", "type_disabled", payload || {});
      return new Response(JSON.stringify({ ok: false, skipped: "type_disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      console.error("send-admin-alert: missing RESEND_API_KEY");
      await logAttempt(supabase, type, adminEmail, "(no api key)", "failed", "missing_api_key", payload || {});
      return new Response(JSON.stringify({ ok: false, skipped: "no_api_key" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { subject, html } = buildTemplate(type, payload || {}, !!test);
    const fromEmail = (settings?.senderEmail && String(settings.senderEmail).trim())
      || Deno.env.get("RESEND_FROM_EMAIL")
      || "Luut SLU <onboarding@resend.dev>";

    const resp = await fetch(RESEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
      body: JSON.stringify({ from: fromEmail, to: [adminEmail], subject, html }),
    });

    const result = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      console.error(`send-admin-alert[${type}] resend error:`, resp.status, result);
      await logAttempt(supabase, type, adminEmail, subject, "failed", `resend_${resp.status}: ${JSON.stringify(result).slice(0, 300)}`, payload || {});
      return new Response(JSON.stringify({ ok: false, status: resp.status, detail: result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`send-admin-alert[${type}] sent id=${result.id}`);
    await logAttempt(supabase, type, adminEmail, subject, "sent", null, { ...(payload || {}), resend_id: result.id, test: !!test });
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
