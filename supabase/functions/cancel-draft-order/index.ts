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

    // Cancel draft order in Shopify if we have the ID
    if (draftOrderId) {
      // First get the draft order details
      const getUrl = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/draft_orders/${draftOrderId}.json`;
      
      const getResponse = await fetch(getUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": shopifyAccessToken,
        },
      });

      if (getResponse.ok) {
        const orderData = await getResponse.json();
        const draftOrder = orderData.draft_order;
        
        // Only delete if not already completed/invoiced
        if (draftOrder.status === 'open') {
          const deleteUrl = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/draft_orders/${draftOrderId}.json`;
          
          const deleteResponse = await fetch(deleteUrl, {
            method: "DELETE",
            headers: {
              "X-Shopify-Access-Token": shopifyAccessToken,
            },
          });

          if (!deleteResponse.ok) {
            console.error("Failed to delete Shopify draft order:", await deleteResponse.text());
          } else {
            console.log("Shopify draft order deleted:", draftOrderId);
          }
        } else {
          console.log("Draft order not open, status:", draftOrder.status);
        }
      }
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

      // Update status to cancelled
      const { data: updatedOrder, error: updateError } = await supabase
        .from("orders")
        .update({
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
        })
        .eq("id", localOrderId)
        .select("*")
        .single();

      if (updateError) {
        console.error("Database update error:", updateError);
        throw new Error("Failed to update order status");
      }

      localOrder = updatedOrder;
      console.log("Local order cancelled:", localOrderId);
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
