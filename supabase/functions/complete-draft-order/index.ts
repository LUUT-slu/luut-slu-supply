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
  paymentPending?: boolean; // when true, mark order as pending payment; default false = paid
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const adminToken = Deno.env.get("SHOPIFY_ADMIN_TOKEN");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller is authenticated (admin, partner, or seller for the order)
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") || serviceKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const uid = userData?.user?.id;
    if (!uid) {
      return new Response(JSON.stringify({ error: "Unauthenticated" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(supabaseUrl, serviceKey);

    const { orderId, paymentPending = true } = (await req.json()) as Body;
    if (!orderId) {
      return new Response(JSON.stringify({ error: "orderId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!adminToken) {
      return new Response(JSON.stringify({ error: "Shopify not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: order, error } = await supabase
      .from("orders").select("shopify_draft_order_id").eq("id", orderId).single();
    if (error || !order?.shopify_draft_order_id) {
      return new Response(JSON.stringify({ error: "No Shopify draft order linked" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/draft_orders/${order.shopify_draft_order_id}/complete.json?payment_pending=${paymentPending}`;
    const res = await fetch(url, {
      method: "PUT",
      headers: { "X-Shopify-Access-Token": adminToken, "Content-Type": "application/json" },
    });
    const data = await res.json();
    if (!res.ok || !data.draft_order) {
      const errMsg = JSON.stringify(data?.errors || data).slice(0, 500);
      await supabase.from("orders").update({
        shopify_sync_status: "draft_failed",
        shopify_sync_error: `complete failed: ${errMsg}`,
      }).eq("id", orderId);
      return new Response(JSON.stringify({ error: errMsg }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const completedDraft = data.draft_order;
    await supabase.from("orders").update({
      shopify_order_id: completedDraft.order_id ? String(completedDraft.order_id) : null,
      shopify_order_name: completedDraft.name || null,
      shopify_sync_status: "completed",
      shopify_sync_error: null,
      shopify_synced_at: new Date().toISOString(),
      order_status: "COMPLETED",
      status: "completed",
      completed_at: new Date().toISOString(),
    }).eq("id", orderId);

    await supabase.from("order_events").insert({
      order_id: orderId,
      actor_user_id: uid,
      event_type: "shopify_draft_completed",
      event_payload: { shopify_order_id: completedDraft.order_id, payment_pending: paymentPending },
    });

    return new Response(JSON.stringify({
      success: true,
      shopifyOrderId: completedDraft.order_id,
      shopifyOrderName: completedDraft.name,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
