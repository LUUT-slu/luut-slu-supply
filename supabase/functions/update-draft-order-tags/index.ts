import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SHOPIFY_STORE_DOMAIN = "lovable-project-yf43m.myshopify.com";
const SHOPIFY_API_VERSION = "2025-01";

interface Body {
  orderId: string;
  addTags?: string[];
  removeTags?: string[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const adminToken = Deno.env.get("SHOPIFY_ADMIN_TOKEN");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { orderId, addTags = [], removeTags = [] } = (await req.json()) as Body;
    if (!orderId) {
      return new Response(JSON.stringify({ error: "orderId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: order, error } = await supabase
      .from("orders").select("shopify_draft_order_id").eq("id", orderId).single();
    if (error || !order?.shopify_draft_order_id) {
      return new Response(JSON.stringify({ error: "No Shopify draft order linked" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!adminToken) {
      return new Response(JSON.stringify({ error: "Shopify not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch existing draft to get current tags
    const url = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/draft_orders/${order.shopify_draft_order_id}.json`;
    const getRes = await fetch(url, { headers: { "X-Shopify-Access-Token": adminToken } });
    if (!getRes.ok) {
      const t = await getRes.text();
      return new Response(JSON.stringify({ error: `Shopify GET failed: ${t}` }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const current = (await getRes.json()).draft_order;
    const tags = new Set(
      String(current.tags || "").split(",").map((s: string) => s.trim()).filter(Boolean)
    );
    for (const t of removeTags) tags.delete(t);
    for (const t of addTags) tags.add(t);

    const putRes = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": adminToken },
      body: JSON.stringify({ draft_order: { id: current.id, tags: Array.from(tags).join(", ") } }),
    });
    if (!putRes.ok) {
      const t = await putRes.text();
      return new Response(JSON.stringify({ error: `Shopify PUT failed: ${t}` }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, tags: Array.from(tags) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
