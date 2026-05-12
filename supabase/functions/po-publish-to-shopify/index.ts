import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SHOPIFY_DOMAIN = Deno.env.get("SHOPIFY_STORE_DOMAIN") || "";
const SHOPIFY_TOKEN = Deno.env.get("SHOPIFY_ADMIN_TOKEN")!;
const API_VERSION = "2025-07";

async function shopifyAdmin(path: string, init: RequestInit = {}) {
  const url = `https://${SHOPIFY_DOMAIN}/admin/api/${API_VERSION}${path}`;
  const r = await fetch(url, {
    ...init,
    headers: {
      "X-Shopify-Access-Token": SHOPIFY_TOKEN,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await r.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* ignore */ }
  if (!r.ok) throw new Error(`Shopify ${r.status}: ${text}`);
  return json;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") || "";
    const token = auth.replace("Bearer ", "");
    if (!token) return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: userData } = await admin.auth.getUser(token);
    const uid = userData?.user?.id;
    if (!uid) return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", uid);
    const isAdmin = (roles || []).some((r: any) => r.role === "admin");
    if (!isAdmin) return new Response(JSON.stringify({ success: false, error: "Admin only" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { item_id, publish_state } = await req.json();
    if (!item_id || !publish_state) {
      return new Response(JSON.stringify({ success: false, error: "Missing item_id or publish_state" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: item, error } = await admin.from("purchase_order_items").select("*").eq("id", item_id).maybeSingle();
    if (error || !item) throw new Error("Item not found");

    if (publish_state === "hidden") {
      await admin.from("purchase_order_items").update({ shopify_publish_state: "hidden", shopify_sync_status: "skipped", shopify_synced_at: new Date().toISOString() }).eq("id", item_id);
      return new Response(JSON.stringify({ success: true, skipped: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!SHOPIFY_DOMAIN) throw new Error("SHOPIFY_STORE_DOMAIN not configured");

    const status = publish_state === "active" ? "active" : "draft";
    const tags: string[] = ["luut_purchase"];
    if (publish_state === "coming_soon") tags.push("coming_soon");

    const productPayload: any = {
      product: {
        title: item.product_name,
        product_type: item.category || undefined,
        vendor: "Luut SLU",
        status,
        tags: tags.join(", "),
        variants: [{
          price: String(item.selling_price || 0),
          inventory_management: "shopify",
          inventory_quantity: Number(item.quantity_arrived || 0),
        }],
        ...(item.image_url ? { images: [{ src: item.image_url }] } : {}),
      },
    };

    let productId: string | null = item.shopify_product_id;
    let variantId: string | null = item.shopify_variant_id;

    if (productId) {
      const updated = await shopifyAdmin(`/products/${productId}.json`, {
        method: "PUT",
        body: JSON.stringify({ product: { id: Number(productId), ...productPayload.product } }),
      });
      variantId = String(updated?.product?.variants?.[0]?.id || variantId);
    } else {
      const created = await shopifyAdmin(`/products.json`, { method: "POST", body: JSON.stringify(productPayload) });
      productId = String(created?.product?.id);
      variantId = String(created?.product?.variants?.[0]?.id);
    }

    // Write private metafields (admin namespace)
    const metafields = [
      { namespace: "luut_purchase", key: "cost_per_item", type: "number_decimal", value: String(item.cost_per_item || 0) },
      { namespace: "luut_purchase", key: "qty_ordered", type: "number_integer", value: String(item.quantity_ordered || 0) },
      { namespace: "luut_purchase", key: "qty_arrived", type: "number_integer", value: String(item.quantity_arrived || 0) },
      { namespace: "luut_purchase", key: "expected_profit", type: "number_decimal", value: String(item.expected_profit || 0) },
      { namespace: "luut_purchase", key: "margin", type: "number_decimal", value: String(item.profit_margin || 0) },
    ];
    for (const mf of metafields) {
      try {
        await shopifyAdmin(`/products/${productId}/metafields.json`, { method: "POST", body: JSON.stringify({ metafield: mf }) });
      } catch (_) { /* ignore individual metafield errors */ }
    }

    await admin.from("purchase_order_items").update({
      shopify_product_id: productId,
      shopify_variant_id: variantId,
      shopify_publish_state: publish_state,
      shopify_sync_status: "synced",
      shopify_synced_at: new Date().toISOString(),
    }).eq("id", item_id);

    return new Response(JSON.stringify({ success: true, product_id: productId, variant_id: variantId }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
