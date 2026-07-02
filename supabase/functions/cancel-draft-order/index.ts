import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SHOPIFY_STORE_DOMAIN = "lovable-project-yf43m.myshopify.com";
const SHOPIFY_API_VERSION = "2025-01";
const WHATSAPP_NUMBER = "17587185478";

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const shopifyAccessToken = Deno.env.get("SHOPIFY_ADMIN_TOKEN");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!shopifyAccessToken) {
      throw new Error("Missing Shopify access token");
    }

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { draftOrderId, localOrderId, orderToken } = await req.json();

    if (!draftOrderId && !localOrderId) {
      return new Response(
        JSON.stringify({ error: "Either draftOrderId or localOrderId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Cancelling order:", { draftOrderId, localOrderId });

    // Track Shopify cancellation outcome so we can record it on the local order row.
    // Values: 'cancelled' (deleted OK or already not-open), 'cancel_failed' (any error),
    // 'skipped' (no draft id supplied). null if not attempted.
    let shopifySyncStatus: string | null = null;
    let shopifySyncError: string | null = null;
    let shopifyDraftStatus: string | null = null;

    // Cancel draft order in Shopify if we have the ID
    if (draftOrderId) {
      try {
        const getUrl = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/draft_orders/${draftOrderId}.json`;

        const getResponse = await fetch(getUrl, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": shopifyAccessToken,
          },
        });

        if (!getResponse.ok) {
          const body = await getResponse.text();
          if (getResponse.status === 404) {
            // Draft already gone — treat as cancelled.
            shopifySyncStatus = "cancelled";
            shopifyDraftStatus = "not_found";
            console.log("Shopify draft order not found (already gone):", draftOrderId);
          } else {
            shopifySyncStatus = "cancel_failed";
            shopifySyncError = `GET draft_order ${getResponse.status}: ${body}`.slice(0, 500);
            console.error("Failed to fetch Shopify draft order:", shopifySyncError);
          }
        } else {
          const orderData = await getResponse.json();
          const draftOrder = orderData.draft_order;
          shopifyDraftStatus = draftOrder?.status ?? null;

          if (draftOrder?.status === "open") {
            const deleteUrl = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/draft_orders/${draftOrderId}.json`;
            const deleteResponse = await fetch(deleteUrl, {
              method: "DELETE",
              headers: {
                "X-Shopify-Access-Token": shopifyAccessToken,
              },
            });

            if (!deleteResponse.ok) {
              const body = await deleteResponse.text();
              shopifySyncStatus = "cancel_failed";
              shopifySyncError = `DELETE draft_order ${deleteResponse.status}: ${body}`.slice(0, 500);
              console.error("Failed to delete Shopify draft order:", shopifySyncError);
            } else {
              shopifySyncStatus = "cancelled";
              console.log("Shopify draft order deleted:", draftOrderId);
            }
          } else {
            // Already completed/invoiced — nothing to delete, but note it.
            shopifySyncStatus = "cancel_failed";
            shopifySyncError = `Draft order not open (status: ${draftOrder?.status}); cannot delete. Manual review required.`;
            console.log("Draft order not open, status:", draftOrder?.status);
          }
        }
      } catch (netErr) {
        shopifySyncStatus = "cancel_failed";
        shopifySyncError = `network error: ${String(netErr)}`.slice(0, 500);
        console.error("Network error cancelling Shopify draft:", netErr);
      }
    } else {
      shopifySyncStatus = "skipped";
    }

    // Update local order status if we have the ID
    let localOrder = null;
    if (localOrderId) {
      // Verify order token for security
      const { data: existingOrder, error: fetchError } = await supabase
        .from("orders")
        .select("*")
        .eq("id", localOrderId)
        .single();

      if (fetchError || !existingOrder) {
        return new Response(
          JSON.stringify({ error: "Order not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify token if provided
      if (orderToken && existingOrder.order_token !== orderToken) {
        return new Response(
          JSON.stringify({ error: "Invalid order token" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const updatePayload: Record<string, unknown> = {
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      if (shopifySyncStatus) {
        updatePayload.shopify_sync_status = shopifySyncStatus;
        updatePayload.shopify_sync_error = shopifySyncError;
      }

      const { data: updatedOrder, error: updateError } = await supabase
        .from("orders")
        .update(updatePayload)
        .eq("id", localOrderId)
        .select("*")
        .single();

      if (updateError) {
        console.error("Database update error:", updateError);
        throw new Error("Failed to update order status");
      }

      localOrder = updatedOrder;

      // Audit event for Shopify sync failure so it's visible in order history.
      if (shopifySyncStatus === "cancel_failed") {
        await supabase.from("order_events").insert({
          order_id: localOrderId,
          event_type: "shopify_sync_failed",
          payload: {
            operation: "cancel_draft_order",
            draft_order_id: draftOrderId,
            error: shopifySyncError,
            shopify_draft_status: shopifyDraftStatus,
          },
        });
      }

      console.log("Local order cancelled:", localOrderId, "shopify:", shopifySyncStatus);
    } else if (draftOrderId && shopifySyncStatus) {
      // No local order id supplied, but we may still be able to record on the row keyed by draft id.
      await supabase
        .from("orders")
        .update({
          shopify_sync_status: shopifySyncStatus,
          shopify_sync_error: shopifySyncError,
          updated_at: new Date().toISOString(),
        })
        .eq("shopify_draft_order_id", String(draftOrderId));
    }


    // Generate WhatsApp notification for merchant
    const cancelMessage = `❌ *ORDER CANCELLED*\n\nOrder has been cancelled by the customer.\n\n${localOrder ? `Order #L${String(localOrder.order_number).padStart(4, '0')}\nCustomer: ${localOrder.customer_name}\nPhone: ${localOrder.customer_phone}` : `Shopify Draft Order ID: ${draftOrderId}`}`;
    const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(cancelMessage)}`;

    return new Response(
      JSON.stringify({
        success: true,
        message: "Order cancelled successfully",
        localOrder,
        whatsappUrl,
        shopifySyncStatus,
        shopifySyncError,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("Error cancelling order:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Failed to cancel order" 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
