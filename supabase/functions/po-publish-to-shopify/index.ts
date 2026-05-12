import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SHOPIFY_DOMAIN = Deno.env.get("SHOPIFY_STORE_DOMAIN") || "lovable-project-yf43m.myshopify.com";
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
  try { json = text ? JSON.parse(text) : null; } catch {}
  if (!r.ok) throw new Error(`Shopify ${r.status}: ${text}`);
  return json;
}

async function getPrimaryLocationId(): Promise<string> {
  const data = await shopifyAdmin(`/locations.json`);
  const loc = data?.locations?.find((l: any) => l.active) || data?.locations?.[0];
  return String(loc?.id);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") || "";
    const token = auth.replace("Bearer ", "");
    if (!token) return json(401, { success: false, error: "Unauthorized" });

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: userData } = await admin.auth.getUser(token);
    const uid = userData?.user?.id;
    if (!uid) return json(401, { success: false, error: "Unauthorized" });

    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", uid);
    const isAdmin = (roles || []).some((r: any) => r.role === "admin");

    const body = await req.json();
    const { item_id, confirm_price_change } = body;
    let { sync_mode, publish_state } = body;
    // Back-compat: map legacy publish_state -> sync_mode
    if (!sync_mode) {
      if (publish_state === "hidden") sync_mode = "po_only";
      else sync_mode = "create_new";
    }

    if (!item_id || !sync_mode) return json(400, { success: false, error: "Missing item_id/sync_mode" });

    // Role gates
    if (!isAdmin && !["po_only", "inventory_only"].includes(sync_mode)) {
      return json(403, { success: false, error: "Admin approval required for Shopify price/variant changes" });
    }

    const { data: item, error } = await admin.from("purchase_order_items").select("*").eq("id", item_id).maybeSingle();
    if (error || !item) throw new Error("Item not found");

    const { data: variants } = await admin.from("purchase_order_item_variants")
      .select("*").eq("item_id", item_id).eq("included", true);

    if (sync_mode === "po_only") {
      await admin.from("purchase_order_items").update({
        shopify_publish_state: "hidden", shopify_sync_status: "skipped", shopify_synced_at: new Date().toISOString(),
      }).eq("id", item_id);
      return json(200, { success: true, skipped: true });
    }

    if (!SHOPIFY_DOMAIN) throw new Error("SHOPIFY_STORE_DOMAIN not configured");

    // ---------- Restock flows ----------
    const productId: string | null = item.shopify_product_id || (item.source_type === "shopify" ? item.source_product_ref : null);

    if (sync_mode === "inventory_only" || sync_mode === "inventory_price" || sync_mode === "inventory_variants") {
      if (!productId) return json(400, { success: false, error: "No linked Shopify product" });
      const locationId = await getPrimaryLocationId();
      const variantList = (variants || []).filter((v: any) => v.shopify_variant_id || v.is_new_variant);

      for (const v of variantList) {
        let variantId = v.shopify_variant_id;

        // Create new variant first if needed (variants mode only)
        if (!variantId && v.is_new_variant && sync_mode === "inventory_variants") {
          const created = await shopifyAdmin(`/products/${productId}/variants.json`, {
            method: "POST",
            body: JSON.stringify({ variant: {
              option1: v.option_color || v.option_size || v.option_other || "Default",
              option2: v.option_size && v.option_color ? v.option_size : undefined,
              price: String(v.selling_price || 0),
              inventory_management: "shopify",
            }}),
          });
          variantId = String(created?.variant?.id);
          await admin.from("purchase_order_item_variants")
            .update({ shopify_variant_id: variantId, is_new_variant: false }).eq("id", v.id);
        }
        if (!variantId) continue;

        // Inventory adjust by arrived qty
        const arrivedQty = Number(v.quantity_arrived || v.quantity_ordered || 0);
        if (arrivedQty > 0) {
          // Lookup inventory_item_id
          const variantData = await shopifyAdmin(`/variants/${variantId}.json`);
          const inventoryItemId = variantData?.variant?.inventory_item_id;
          if (inventoryItemId) {
            await shopifyAdmin(`/inventory_levels/adjust.json`, {
              method: "POST",
              body: JSON.stringify({
                location_id: Number(locationId),
                inventory_item_id: Number(inventoryItemId),
                available_adjustment: arrivedQty,
              }),
            });
          }
        }

        // Price update
        if (sync_mode === "inventory_price" && confirm_price_change) {
          await shopifyAdmin(`/variants/${variantId}.json`, {
            method: "PUT",
            body: JSON.stringify({ variant: { id: Number(variantId), price: String(v.selling_price || 0),
              compare_at_price: v.compare_at_price ? String(v.compare_at_price) : null } }),
          });
        }

        // Variant option updates
        if (sync_mode === "inventory_variants") {
          await shopifyAdmin(`/variants/${variantId}.json`, {
            method: "PUT",
            body: JSON.stringify({ variant: {
              id: Number(variantId),
              option1: v.option_color || v.option_size || v.option_other || undefined,
              option2: v.option_size && v.option_color ? v.option_size : undefined,
            }}),
          });
        }
      }

      await writeMetafields(productId, item);
      await admin.from("purchase_order_items").update({
        shopify_product_id: productId,
        shopify_publish_state: "active",
        shopify_sync_status: "synced",
        shopify_synced_at: new Date().toISOString(),
      }).eq("id", item_id);

      return json(200, { success: true, product_id: productId, variants_synced: variantList.length });
    }

    // ---------- create_new (legacy create flow) ----------
    const status = "draft";
    const productPayload: any = {
      product: {
        title: item.product_name,
        product_type: item.category || undefined,
        vendor: "Luut SLU",
        status,
        tags: "luut_purchase",
        variants: (variants && variants.length > 0)
          ? variants.map((v: any) => ({
              option1: v.option_color || v.option_size || "Default",
              option2: v.option_size && v.option_color ? v.option_size : undefined,
              price: String(v.selling_price || 0),
              inventory_management: "shopify",
              inventory_quantity: Number(v.quantity_arrived || 0),
            }))
          : [{
              price: String(item.selling_price || 0),
              inventory_management: "shopify",
              inventory_quantity: Number(item.quantity_arrived || 0),
            }],
        ...(item.image_url ? { images: [{ src: item.image_url }] } : {}),
      },
    };

    const created = await shopifyAdmin(`/products.json`, { method: "POST", body: JSON.stringify(productPayload) });
    const newProductId = String(created?.product?.id);
    const newVariantId = String(created?.product?.variants?.[0]?.id);

    await writeMetafields(newProductId, item);
    await admin.from("purchase_order_items").update({
      shopify_product_id: newProductId,
      shopify_variant_id: newVariantId,
      shopify_publish_state: "draft",
      shopify_sync_status: "synced",
      shopify_synced_at: new Date().toISOString(),
    }).eq("id", item_id);

    return json(200, { success: true, product_id: newProductId, variant_id: newVariantId });

    async function writeMetafields(pid: string, it: any) {
      const mfs = [
        { namespace: "luut_purchase", key: "cost_per_item", type: "number_decimal", value: String(it.cost_per_item || 0) },
        { namespace: "luut_purchase", key: "qty_ordered", type: "number_integer", value: String(it.quantity_ordered || 0) },
        { namespace: "luut_purchase", key: "qty_arrived", type: "number_integer", value: String(it.quantity_arrived || 0) },
        { namespace: "luut_purchase", key: "expected_profit", type: "number_decimal", value: String(it.expected_profit || 0) },
        { namespace: "luut_purchase", key: "margin", type: "number_decimal", value: String(it.profit_margin || 0) },
      ];
      for (const mf of mfs) {
        try { await shopifyAdmin(`/products/${pid}/metafields.json`, { method: "POST", body: JSON.stringify({ metafield: mf }) }); }
        catch {}
      }
    }
  } catch (e) {
    return json(500, { success: false, error: (e as Error).message });
  }
});

function json(status: number, body: any) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
