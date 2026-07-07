import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { normalizePhone } from "../_shared/phone.ts";
import { sanitizeText, looksLikePhone } from "../_shared/text.ts";



const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SHOPIFY_DOMAIN = "lovable-project-yf43m.myshopify.com";
const SHOPIFY_API_VERSION = "2025-07";

const ORDERS_QUERY = `
  query SyncOrders($first: Int!, $query: String!, $cursor: String) {
    orders(first: $first, query: $query, sortKey: UPDATED_AT, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          id
          name
          createdAt
          updatedAt
          displayFinancialStatus
          displayFulfillmentStatus
          sourceName
          currencyCode
          totalPriceSet { shopMoney { amount } }
          totalDiscountsSet { shopMoney { amount } }
          customer {
            id email phone firstName lastName
            defaultAddress { phone }
            addresses(first: 5) { phone }
          }
          shippingAddress { address1 city phone }
          billingAddress { phone }
          retailLocation { id name }
          channelInformation { displayName channelDefinition { handle } }
          lineItems(first: 50) {
            edges {
              node {
                id
                title
                quantity
                originalUnitPriceSet { shopMoney { amount } }
                variant { id sku image { url } product { id featuredMedia { preview { image { url } } } } }
              }
            }
          }
        }
      }
    }
  }
`;

/**
 * Extract a usable customer phone from a Shopify order, falling back through:
 *   1. customer.phone
 *   2. shipping / billing / default address phone
 *   3. any address on the customer that carries a phone
 *   4. digits stashed in firstName / lastName (POS operators sometimes type
 *      the customer's number straight into the name field)
 */
function extractPhone(node: any, customer: any): string | null {
  const direct = [
    customer?.phone,
    node?.shippingAddress?.phone,
    node?.billingAddress?.phone,
    customer?.defaultAddress?.phone,
    ...((customer?.addresses ?? []).map((a: any) => a?.phone)),
  ];
  for (const c of direct) {
    const n = normalizePhone(c);
    if (n) return n;
  }
  for (const s of [customer?.firstName, customer?.lastName, `${customer?.firstName ?? ""} ${customer?.lastName ?? ""}`]) {
    if (!s) continue;
    const digits = String(s).replace(/\D/g, "");
    if (digits.length === 7 || digits.length === 10 || (digits.length === 11 && digits.startsWith("1"))) {
      const n = normalizePhone(digits);
      if (n) return n;
    }
  }
  return null;
}

/**
 * If Shopify's customer name is literally a phone number (a known quirk on
 * this store), don't let it poison the customer directory.
 */
function cleanCustomerName(name: string | null | undefined, source: string): string {
  const fallback = source === "shopify_pos" ? "Walk-in Customer" : "Shopify Customer";
  if (!name) return fallback;
  const trimmed = name.trim();
  if (!trimmed) return fallback;
  const digits = trimmed.replace(/\D/g, "");
  if (/^[\d\s\-().+]+$/.test(trimmed) && digits.length >= 7) return fallback;
  return trimmed;
}

async function shopifyAdmin(token: string, query: string, variables: Record<string, unknown>) {
  const r = await fetch(
    `https://${SHOPIFY_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
    }
  );
  const text = await r.text();
  if (!r.ok) throw new Error(`Shopify ${r.status}: ${text.slice(0, 500)}`);
  const json = JSON.parse(text);
  if (json.errors) throw new Error(`Shopify GraphQL: ${JSON.stringify(json.errors).slice(0, 500)}`);
  return json.data;
}

function classifySource(node: any): { source: string; channel: string | null } {
  const channel =
    node.channelInformation?.channelDefinition?.handle ??
    node.channelInformation?.displayName ??
    node.sourceName ??
    null;
  const isPos =
    (node.sourceName || "").toLowerCase() === "pos" ||
    !!node.retailLocation ||
    (channel || "").toLowerCase().includes("pos");
  return { source: isPos ? "shopify_pos" : "shopify_online", channel };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const SHOPIFY_TOKEN = Deno.env.get("SHOPIFY_ADMIN_TOKEN");

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace("Bearer ", "");
  let isAdminCall = false;
  if (jwt) {
    const { data: userRes } = await admin.auth.getUser(jwt).catch(() => ({ data: null as any }));
    const userId = userRes?.user?.id;
    if (userId) {
      const { data: roleRow } = await admin
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();
      if (roleRow) isAdminCall = true;
    }
  }
  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }
  const cronSecret = Deno.env.get("CRON_SECRET");
  const providedCronSecret = req.headers.get("x-cron-secret");
  const isCron = !!(cronSecret && providedCronSecret && providedCronSecret === cronSecret);
  const fullResync = body?.mode === "full";
  if (!isAdminCall && !isCron) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!SHOPIFY_TOKEN) {
    await admin.from("shopify_sync_state").update({
      last_status: "error",
      last_error: "SHOPIFY_ADMIN_TOKEN not configured",
      updated_at: new Date().toISOString(),
    }).eq("id", "orders");
    return new Response(
      JSON.stringify({ error: "SHOPIFY_ADMIN_TOKEN not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const { data: state } = await admin
      .from("shopify_sync_state")
      .select("*")
      .eq("id", "orders")
      .maybeSingle();

    const since = fullResync
      ? new Date("2000-01-01T00:00:00Z")
      : state?.last_synced_at
        ? new Date(state.last_synced_at)
        : new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);

    const queryStr = `updated_at:>=${since.toISOString()}`;

    let cursor: string | null = null;
    let maxUpdated = since;

    let fetched = 0;
    let paidCount = 0;
    let completedCount = 0;
    let posCount = 0;
    let onlineCount = 0;
    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    let lineItemsTotal = 0;
    let lineItemsMatched = 0;
    let lineItemsUnassigned = 0;
    const sellerOrderPairs = new Set<string>();
    const skipDetails: Array<Record<string, unknown>> = [];
    const unassignedSamples: Array<Record<string, unknown>> = [];

    // Per-run cache for seller_products lookups
    const sellerByShopifyProductId = new Map<string, { seller_id: string; product_id: string }>();
    const sellerByName = new Map<string, { seller_id: string; product_id: string }>();

    async function resolveSellerForLineItem(li: any): Promise<{ seller_id: string | null; product_id: string | null }> {
      const shopifyProductId: string | null = li.variant?.product?.id ?? null;
      const title: string = (li.title || "").trim();

      if (shopifyProductId) {
        const cached = sellerByShopifyProductId.get(shopifyProductId);
        if (cached) return cached;
        const { data } = await admin
          .from("seller_products")
          .select("id, seller_id")
          .eq("shopify_product_id", shopifyProductId)
          .limit(1)
          .maybeSingle();
        if (data?.seller_id) {
          const v = { seller_id: data.seller_id as string, product_id: data.id as string };
          sellerByShopifyProductId.set(shopifyProductId, v);
          return v;
        }
      }

      if (title) {
        const key = title.toLowerCase();
        const cached = sellerByName.get(key);
        if (cached) return cached;
        const { data } = await admin
          .from("seller_products")
          .select("id, seller_id")
          .ilike("name", title)
          .limit(1)
          .maybeSingle();
        if (data?.seller_id) {
          const v = { seller_id: data.seller_id as string, product_id: data.id as string };
          sellerByName.set(key, v);
          return v;
        }
      }

      return { seller_id: null, product_id: null };
    }

    const maxPages = fullResync ? 200 : 40;

    for (let page = 0; page < maxPages; page++) {
      const data: any = await shopifyAdmin(SHOPIFY_TOKEN, ORDERS_QUERY, {
        first: 50, query: queryStr, cursor,
      });
      const edges = data.orders?.edges ?? [];
      for (const edge of edges) {
        const node = edge.node;
        fetched++;
        const updated = new Date(node.updatedAt);
        if (updated > maxUpdated) maxUpdated = updated;

        const { source, channel } = classifySource(node);
        if (source === "shopify_pos") posCount++;
        else onlineCount++;

        const customer = node.customer;
        const rawName =
          [customer?.firstName, customer?.lastName].filter(Boolean).join(" ").trim() ||
          customer?.email ||
          null;
        const customerName = cleanCustomerName(rawName, source);
        const total = Number(node.totalPriceSet?.shopMoney?.amount ?? 0);
        const discounts = Number(node.totalDiscountsSet?.shopMoney?.amount ?? 0);
        const lineItems = (node.lineItems?.edges ?? []).map((e: any) => e.node);

        const fulfillment = (node.displayFulfillmentStatus || "").toUpperCase();
        const financial = (node.displayFinancialStatus || "").toUpperCase();
        if (financial === "PAID") paidCount++;

        let derivedStatus = "NEW";
        if (financial === "REFUNDED" || financial === "VOIDED") {
          derivedStatus = "CANCELLED";
        } else if (
          source === "shopify_pos" ||
          fulfillment === "FULFILLED" ||
          financial === "PAID"
        ) {
          derivedStatus = "COMPLETED";
        }
        if (derivedStatus === "COMPLETED") completedCount++;

        // Customer linkage (best-effort). Match by normalized phone first, email as fallback.
        const normalizedCustomerPhone = extractPhone(node, customer);
        let customerUserId: string | null = null;
        if (customer?.email || normalizedCustomerPhone) {
          try {
            const { data: existing } = await admin
              .from("customer_profiles")
              .select("user_id")
              .or([
                normalizedCustomerPhone ? `phone.eq.${normalizedCustomerPhone}` : null,
                customer?.email ? `email.ilike.${customer.email}` : null,
              ].filter(Boolean).join(","))
              .limit(1)
              .maybeSingle();
            if (existing?.user_id) customerUserId = existing.user_id;
          } catch { /* ignore */ }
        }


        // Look up existing by shopify_order_id (the only dedupe key)
        const { data: existingOrder, error: lookupErr } = await admin
          .from("orders")
          .select("id")
          .eq("shopify_order_id", node.id)
          .maybeSingle();

        if (lookupErr) {
          skippedCount++;
          if (skipDetails.length < 100) skipDetails.push({
            shopify_order_id: node.id,
            shopify_order_name: node.name,
            source, financial_status: node.displayFinancialStatus,
            fulfillment_status: node.displayFulfillmentStatus,
            created_at: node.createdAt,
            reason: `lookup failed: ${lookupErr.message}`,
          });
          console.error("[sync-shopify-orders] lookup failed", lookupErr, node.id);
          continue;
        }

        const orderPayload: Record<string, unknown> = {
          source,
          communication_status: "confirmed",
          shopify_order_id: node.id,
          shopify_order_name: node.name,
          shopify_channel: channel,
          shopify_pos_location_id: node.retailLocation?.id ?? null,
          shopify_pos_location_name: node.retailLocation?.name ?? null,
          shopify_financial_status: node.displayFinancialStatus ?? null,
          shopify_fulfillment_status: node.displayFulfillmentStatus ?? null,
          shopify_total_discounts: discounts,
          shopify_synced_at: new Date().toISOString(),
          customer_name: customerName,
          customer_email: customer?.email ?? null,
          customer_phone: normalizedCustomerPhone ?? customer?.phone ?? null,
          customer_user_id: customerUserId,
          location: node.retailLocation?.name ?? node.shippingAddress?.city ?? "Shopify",

          preferred_date: new Date(node.createdAt).toISOString(),
          total_price: total,
          currency_code: node.currencyCode ?? "XCD",
          line_items: lineItems.map((li: any) => ({
            title: li.title,
            quantity: li.quantity,
            price: Number(li.originalUnitPriceSet?.shopMoney?.amount ?? 0),
            variant_id: li.variant?.id ?? null,
            sku: li.variant?.sku ?? null,
          })),
          status: derivedStatus.toLowerCase(),
          order_status: derivedStatus,
          updated_at: new Date().toISOString(),
        };
        if (derivedStatus === "COMPLETED") {
          orderPayload.completed_at = node.updatedAt;
        }
        if (derivedStatus === "CANCELLED") {
          orderPayload.cancelled_at = node.updatedAt;
        }

        let savedOrderId: string | null = null;

        if (existingOrder?.id) {
          const { error: updErr } = await admin
            .from("orders")
            .update(orderPayload)
            .eq("id", existingOrder.id);
          if (updErr) {
            skippedCount++;
            if (skipDetails.length < 100) skipDetails.push({
              shopify_order_id: node.id,
              shopify_order_name: node.name,
              source, financial_status: node.displayFinancialStatus,
              fulfillment_status: node.displayFulfillmentStatus,
              created_at: node.createdAt,
              reason: `update failed: ${updErr.message}`,
            });
            console.error("[sync-shopify-orders] update failed", updErr, node.id);
            continue;
          }
          savedOrderId = existingOrder.id;
          updatedCount++;
        } else {
          const { data: inserted, error: insErr } = await admin
            .from("orders")
            .insert(orderPayload)
            .select("id")
            .single();
          if (insErr) {
            skippedCount++;
            if (skipDetails.length < 100) skipDetails.push({
              shopify_order_id: node.id,
              shopify_order_name: node.name,
              source, financial_status: node.displayFinancialStatus,
              fulfillment_status: node.displayFulfillmentStatus,
              created_at: node.createdAt,
              reason: `insert failed: ${insErr.message}`,
            });
            console.error("[sync-shopify-orders] insert failed", insErr, node.id);
            continue;
          }
          savedOrderId = inserted.id;
          createdCount++;
        }

        // Replace order_items snapshot with seller attribution
        if (savedOrderId) {
          await admin.from("order_items").delete().eq("order_id", savedOrderId);
          if (lineItems.length) {
            const items: Array<Record<string, unknown>> = [];
            for (const li of lineItems) {
              lineItemsTotal++;
              const { seller_id, product_id } = await resolveSellerForLineItem(li);
              if (seller_id) {
                lineItemsMatched++;
                sellerOrderPairs.add(`${savedOrderId}::${seller_id}`);
              } else {
                lineItemsUnassigned++;
                if (unassignedSamples.length < 50) {
                  unassignedSamples.push({
                    shopify_order_name: node.name,
                    line_title: li.title,
                    shopify_product_id: li.variant?.product?.id ?? null,
                    shopify_variant_id: li.variant?.id ?? null,
                    reason: "Product not assigned to seller",
                  });
                }
              }
              items.push({
                order_id: savedOrderId,
                product_name: li.title,
                quantity: li.quantity,
                unit_price: Number(li.originalUnitPriceSet?.shopMoney?.amount ?? 0),
                total_price: Number(li.originalUnitPriceSet?.shopMoney?.amount ?? 0) * (li.quantity ?? 1),
                product_image_url:
                  li.variant?.image?.url ??
                  li.variant?.product?.featuredMedia?.preview?.image?.url ??
                  null,
                shopify_line_id: li.id,
                shopify_variant_id: li.variant?.id ?? null,
                shopify_product_id: li.variant?.product?.id ?? null,
                seller_id,
                product_id,
              });
            }
            await admin.from("order_items").insert(items);
          }
        }
      }

      if (!data.orders?.pageInfo?.hasNextPage) break;
      cursor = data.orders.pageInfo.endCursor;
    }

    const summary = {
      fetched,
      paid: paidCount,
      completed: completedCount,
      pos: posCount,
      online: onlineCount,
      created: createdCount,
      updated: updatedCount,
      skipped: skippedCount,
      line_items_total: lineItemsTotal,
      line_items_matched_to_seller: lineItemsMatched,
      line_items_unassigned: lineItemsUnassigned,
      seller_orders_touched: sellerOrderPairs.size,
      unassigned_samples: unassignedSamples,
      skip_details: skipDetails,
      mode: fullResync ? "full" : "incremental",
    };

    await admin.from("shopify_sync_state").update({
      last_synced_at: maxUpdated.toISOString(),
      last_status: "ok",
      last_error: skippedCount > 0
        ? `Skipped ${skippedCount}: ${skipDetails.slice(0, 3).map((d) => `${d.shopify_order_name}: ${d.reason}`).join("; ")}`
        : null,
      last_run_count: createdCount + updatedCount,
      updated_at: new Date().toISOString(),
    }).eq("id", "orders");

    return new Response(JSON.stringify({ ok: true, processed: createdCount + updatedCount, ...summary }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[sync-shopify-orders] error", msg);
    await admin.from("shopify_sync_state").update({
      last_status: "error",
      last_error: msg.slice(0, 1000),
      updated_at: new Date().toISOString(),
    }).eq("id", "orders");
    return new Response(JSON.stringify({ error: msg }), {
      status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
