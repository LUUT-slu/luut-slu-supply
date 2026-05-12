import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: items } = await admin.from("purchase_order_items").select("id, product_name, category, shopify_product_id, shopify_variant_id, linked_seller_product_id");
    if (!items?.length) return new Response(JSON.stringify({ success: true, updated: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    let updated = 0;
    for (const it of items as any[]) {
      let qty = 0; let revenue = 0; let firstSold: string | null = null; let lastSold: string | null = null;

      // Match by shopify_product_id from product_sales
      if (it.shopify_product_id) {
        const { data: ps } = await admin.from("product_sales")
          .select("quantity, price_amount, sold_at")
          .eq("product_id", it.shopify_product_id);
        for (const r of ps || []) {
          qty += Number(r.quantity || 0);
          revenue += Number(r.price_amount || 0) * Number(r.quantity || 0);
          if (!firstSold || r.sold_at < firstSold) firstSold = r.sold_at as string;
          if (!lastSold || r.sold_at > lastSold) lastSold = r.sold_at as string;
        }
      }

      // Also match by order_items.product_name (case-insensitive)
      const { data: oi } = await admin.from("order_items")
        .select("quantity, unit_price, created_at")
        .ilike("product_name", it.product_name);
      for (const r of oi || []) {
        qty += Number(r.quantity || 0);
        revenue += Number(r.unit_price || 0) * Number(r.quantity || 0);
        if (!firstSold || r.created_at < firstSold) firstSold = r.created_at as string;
        if (!lastSold || r.created_at > lastSold) lastSold = r.created_at as string;
      }

      await admin.from("purchase_order_items").update({
        qty_sold_cached: qty,
        revenue_cached: revenue,
        first_sold_at: firstSold,
        last_sold_at: lastSold,
      }).eq("id", it.id);
      updated++;
    }

    return new Response(JSON.stringify({ success: true, updated }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
