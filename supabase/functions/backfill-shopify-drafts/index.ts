import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SHOPIFY_STORE_DOMAIN = "lovable-project-yf43m.myshopify.com";
const SHOPIFY_API_VERSION = "2025-01";

function normalizePhone(phone: string): string {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 7) return `+1758${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (phone.startsWith("+")) return phone;
  return `+${digits}`;
}

async function findOrCreateShopifyCustomer(
  adminToken: string,
  firstName: string,
  lastName: string,
  phone: string,
  email?: string | null,
): Promise<number | null> {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) return null;
  try {
    const searchUrl = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/customers/search.json?query=phone:${encodeURIComponent(normalizedPhone)}`;
    const r = await fetch(searchUrl, { headers: { "X-Shopify-Access-Token": adminToken } });
    if (r.ok) {
      const d = await r.json();
      if (d.customers?.length > 0) {
        const existing = d.customers[0];
        if (!existing.phone) {
          try {
            await fetch(
              `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/customers/${existing.id}.json`,
              {
                method: "PUT",
                headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": adminToken },
                body: JSON.stringify({ customer: { id: existing.id, phone: normalizedPhone } }),
              },
            );
          } catch (_) { /* noop */ }
        }
        return existing.id;
      }
    }
  } catch (_) { /* noop */ }

  try {
    const createUrl = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/customers.json`;
    const r = await fetch(createUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": adminToken },
      body: JSON.stringify({
        customer: {
          first_name: firstName,
          last_name: lastName,
          phone: normalizedPhone,
          email: email || undefined,
          tags: "luut-connect",
          verified_email: false,
          send_email_invite: false,
        },
      }),
    });
    if (r.ok) {
      const d = await r.json();
      return d.customer?.id || null;
    }
    const errBody = await r.text();
    if (r.status === 422 && errBody.includes("phone")) {
      const retryUrl = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/customers/search.json?query=${encodeURIComponent(normalizedPhone)}`;
      const rr = await fetch(retryUrl, { headers: { "X-Shopify-Access-Token": adminToken } });
      if (rr.ok) {
        const dd = await rr.json();
        if (dd.customers?.length > 0) return dd.customers[0].id;
      }
    }
  } catch (_) { /* noop */ }
  return null;
}

async function resolveDiscount(adminToken: string, discountCode: string) {
  if (discountCode.toUpperCase() === "WELCOME5") {
    return { description: "Welcome Discount", value_type: "fixed_amount", value: "5.00", title: "WELCOME5" };
  }
  try {
    const lookupUrl = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/discount_codes/lookup.json?code=${encodeURIComponent(discountCode)}`;
    const lookupRes = await fetch(lookupUrl, { headers: { "X-Shopify-Access-Token": adminToken }, redirect: "manual" });
    let discountData: any = null;
    if ([301, 302, 303].includes(lookupRes.status)) {
      const loc = lookupRes.headers.get("Location");
      if (loc) {
        const full = loc.startsWith("http") ? loc : `https://${SHOPIFY_STORE_DOMAIN}${loc}`;
        const r = await fetch(full, { headers: { "X-Shopify-Access-Token": adminToken } });
        if (r.ok) discountData = await r.json();
      }
    } else if (lookupRes.ok) {
      discountData = await lookupRes.json();
    }
    const priceRuleId = discountData?.discount_code?.price_rule_id;
    if (!priceRuleId) return null;
    const ruleRes = await fetch(`https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/price_rules/${priceRuleId}.json`, {
      headers: { "X-Shopify-Access-Token": adminToken },
    });
    if (!ruleRes.ok) return null;
    const rule = (await ruleRes.json()).price_rule;
    return {
      description: rule.title || discountCode,
      value_type: rule.value_type,
      value: String(Math.abs(parseFloat(rule.value))),
      title: discountCode,
    };
  } catch (_) {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const shopifyAdminToken = Deno.env.get("SHOPIFY_ADMIN_TOKEN");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!shopifyAdminToken) throw new Error("SHOPIFY_ADMIN_TOKEN not configured");
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch(() => ({}));
    const onlyOrderId: string | undefined = body.orderId;
    const dryRun: boolean = !!body.dryRun;

    let query = supabase
      .from("orders")
      .select("*")
      .not("shopify_draft_order_id", "is", null)
      .neq("shopify_sync_status", "completed")
      .neq("order_status", "CANCELLED");
    if (onlyOrderId) query = query.eq("id", onlyOrderId);

    const { data: orders, error } = await query;
    if (error) throw new Error(error.message);

    const results: Array<{ id: string; draftId: string; ok: boolean; note?: string }> = [];

    for (const order of orders ?? []) {
      const draftId = order.shopify_draft_order_id;
      if (!draftId) continue;

      try {
        const firstName = (order.customer_name || "").split(" ")[0] || "Customer";
        const lastName = (order.customer_name || "").split(" ").slice(1).join(" ") || "";
        const normalizedPhone = normalizePhone(order.customer_phone || "");

        const customerId = await findOrCreateShopifyCustomer(
          shopifyAdminToken, firstName, lastName, order.customer_phone || "", order.customer_email,
        );

        const noteAttributes: Array<{ name: string; value: string }> = [];
        if (order.location) noteAttributes.push({ name: "Pickup Location", value: order.location });
        if (order.preferred_date) noteAttributes.push({ name: "Pickup Date", value: order.preferred_date });
        if (order.pickup_time) noteAttributes.push({ name: "Pickup Time", value: order.pickup_time });
        if (order.customer_name) noteAttributes.push({ name: "Customer Name", value: order.customer_name });
        if (normalizedPhone) noteAttributes.push({ name: "Customer Phone", value: normalizedPhone });
        if (order.customer_email) noteAttributes.push({ name: "Customer Email", value: order.customer_email });
        if (order.order_source) noteAttributes.push({ name: "Order Source", value: order.order_source });
        noteAttributes.push({ name: "Website Order ID", value: order.id });
        if (order.order_number) {
          noteAttributes.push({ name: "Website Order #", value: `#L${String(order.order_number).padStart(4, "0")}` });
        }
        noteAttributes.push({ name: "Payment", value: "Pay on pickup" });
        if (order.communication_status) {
          noteAttributes.push({ name: "Communication Status", value: order.communication_status });
        }
        if (order.note) noteAttributes.push({ name: "Customer Note", value: order.note });

        const payload: any = {
          draft_order: {
            note_attributes: noteAttributes,
            email: order.customer_email || undefined,
            phone: normalizedPhone || undefined,
          },
        };
        if (customerId) payload.draft_order.customer = { id: customerId };
        if (normalizedPhone && order.location) {
          payload.draft_order.shipping_address = {
            first_name: firstName,
            last_name: lastName,
            phone: normalizedPhone,
            address1: "Pickup",
            city: order.location,
            country: "Saint Lucia",
            country_code: "LC",
          };
        }

        // Backfill discount if order has one and draft hasn't been invoiced/paid
        // (Shopify rejects applied_discount edits on completed drafts.)
        // We pull discount info from line_items meta or customer_discounts if available — best-effort.
        // If the order has a discount_code column it would be used here; otherwise skipped.
        const discountCode = (order as any).discount_code || null;
        if (discountCode) {
          const ad = await resolveDiscount(shopifyAdminToken, discountCode);
          if (ad) payload.draft_order.applied_discount = ad;
        }

        if (dryRun) {
          results.push({ id: order.id, draftId, ok: true, note: "dryRun" });
          continue;
        }

        const r = await fetch(
          `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/draft_orders/${draftId}.json`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": shopifyAdminToken },
            body: JSON.stringify(payload),
          },
        );
        const ok = r.ok;
        const detail = ok ? undefined : (await r.text()).slice(0, 300);
        if (ok) {
          await supabase
            .from("orders")
            .update({ shopify_sync_status: "draft_updated", shopify_synced_at: new Date().toISOString(), shopify_sync_error: null })
            .eq("id", order.id);
        } else {
          await supabase
            .from("orders")
            .update({ shopify_sync_error: `backfill: ${detail}` })
            .eq("id", order.id);
        }
        results.push({ id: order.id, draftId, ok, note: detail });
      } catch (e) {
        results.push({ id: order.id, draftId, ok: false, note: e instanceof Error ? e.message : String(e) });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        scanned: orders?.length ?? 0,
        updated: results.filter((r) => r.ok).length,
        failed: results.filter((r) => !r.ok).length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
