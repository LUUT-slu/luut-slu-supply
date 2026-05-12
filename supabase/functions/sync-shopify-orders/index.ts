import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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
          customer { id email phone firstName lastName }
          shippingAddress { address1 city }
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

  // Auth: allow either an admin user OR cron (service-role calls itself via net.http_post w/ anon).
  // For UI calls we require an admin role.
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
  const isCron = body?.trigger === "cron";
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

    // Full resync = all-time backfill. Otherwise use last watermark or first-run 365d.
    const since = fullResync
      ? new Date("2000-01-01T00:00:00Z")
      : state?.last_synced_at
        ? new Date(state.last_synced_at)
        : new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);

    // No status/financial/fulfillment filter — import every order Shopify returns.
    const queryStr = `updated_at:>=${since.toISOString()}`;

    let cursor: string | null = null;
    let maxUpdated = since;

    // Counters
    let fetched = 0;
    let paidCount = 0;
    let completedCount = 0;
    let posCount = 0;
    let onlineCount = 0;
    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    const skipReasons: string[] = [];

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
        const customerName =
          [customer?.firstName, customer?.lastName].filter(Boolean).join(" ").trim() ||
          customer?.email ||
          "Shopify customer";
        const total = Number(node.totalPriceSet?.shopMoney?.amount ?? 0);
        const discounts = Number(node.totalDiscountsSet?.shopMoney?.amount ?? 0);
        const lineItems = (node.lineItems?.edges ?? []).map((e: any) => e.node);

        const fulfillment = (node.displayFulfillmentStatus || "").toUpperCase();
        const financial = (node.displayFinancialStatus || "").toUpperCase();
        if (financial === "PAID") paidCount++;

        // Derive local status — preserve completed state but never block import.
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

        // Customer profile linkage (best-effort; never block sync)
        let customerUserId: string | null = null;
        if (customer?.email || customer?.phone) {
          try {
            const { data: existing } = await admin
              .from("customer_profiles")
              .select("user_id, email, phone")
              .or([
                customer?.email ? `email.ilike.${customer.email}` : null,
                customer?.phone ? `phone.eq.${customer.phone}` : null,
              ].filter(Boolean).join(","))
              .limit(1)
              .maybeSingle();
            if (existing?.user_id) customerUserId = existing.user_id;
          } catch { /* ignore */ }
        }

        // Detect existing local order (created vs updated)
        const { data: existingOrder } = await admin
          .from("orders")
          .select("id")
          .eq("shopify_order_id", node.id)
          .maybeSingle();
        const isNew = !existingOrder;

        const orderPayload: Record<string, unknown> = {
          source,
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
          customer_phone: customer?.phone ?? null,
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

        // Upsert by shopify_order_id
        const { data: upserted, error: upErr } = await admin
          .from("orders")
          .upsert(orderPayload, { onConflict: "shopify_order_id" })
          .select("id")
          .single();

        if (upErr) {
          skippedCount++;
          if (skipReasons.length < 20) skipReasons.push(`${node.name}: ${upErr.message}`);
          console.error("[sync-shopify-orders] upsert order failed", upErr, node.id);
          continue;
        }

        if (isNew) createdCount++; else updatedCount++;

        // Replace order_items for this order with the latest snapshot
        await admin.from("order_items").delete().eq("order_id", upserted.id);
        if (lineItems.length) {
          const items = lineItems.map((li: any) => ({
            order_id: upserted.id,
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
          }));
          await admin.from("order_items").insert(items);
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
      skip_reasons: skipReasons,
      mode: fullResync ? "full" : "incremental",
    };

    await admin.from("shopify_sync_state").update({
      last_synced_at: maxUpdated.toISOString(),
      last_status: "ok",
      last_error: skippedCount > 0 ? `Skipped ${skippedCount}: ${skipReasons.slice(0, 3).join("; ")}` : null,
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
