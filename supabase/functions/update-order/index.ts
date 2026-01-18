import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UpdateOrderRequest {
  orderId: string;
  orderToken: string;
  action: "cancel" | "update";
  // For updates
  location?: string;
  preferredDate?: string;
  note?: string;
}

const WHATSAPP_NUMBER = "17587185478";

function formatMerchantMessage(order: any, action: "CANCELLED" | "UPDATED"): string {
  const orderNumber = `#L${String(order.order_number).padStart(4, '0')}`;
  
  const itemsList = order.line_items.map((item: any) => 
    `• ${item.title} x${item.quantity} — EC$${parseFloat(item.price).toFixed(2)}`
  ).join('\n');

  const emoji = action === "CANCELLED" ? "❌" : "📝";
  const prefix = action === "CANCELLED" ? "ORDER CANCELLED" : "ORDER UPDATED";

  let message = `${emoji} *${prefix} ${orderNumber}*\n\n`;
  message += `👤 Name: ${order.customer_name}\n`;
  message += `📱 Phone: ${order.customer_phone || 'Not provided'}\n`;
  message += `📍 Location: ${order.location}\n`;
  message += `📅 Date: ${order.preferred_date}\n\n`;
  message += `📦 *Items:*\n${itemsList}\n\n`;
  message += `💰 *Total: EC$${parseFloat(order.total_price).toFixed(2)}*`;
  
  if (order.note) {
    message += `\n\n📝 Note: ${order.note}`;
  }

  if (action === "CANCELLED") {
    message += `\n\n⚠️ Customer cancelled this order.`;
  }

  return message;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const body: UpdateOrderRequest = await req.json();
    const { orderId, orderToken, action, location, preferredDate, note } = body;

    if (!orderId || !orderToken) {
      return new Response(
        JSON.stringify({ error: "Order ID and token are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // First, verify the order exists and token matches
    const { data: existingOrder, error: fetchError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .eq("order_token", orderToken)
      .single();

    if (fetchError || !existingOrder) {
      console.error("Order not found or token mismatch:", fetchError);
      return new Response(
        JSON.stringify({ error: "Order not found or access denied" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if order can be modified (only pending/confirmed can be cancelled/updated)
    if (existingOrder.status === "completed" || existingOrder.status === "cancelled") {
      return new Response(
        JSON.stringify({ error: `Cannot modify a ${existingOrder.status} order` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let updateData: any = {};
    let actionType: "CANCELLED" | "UPDATED" = "UPDATED";

    if (action === "cancel") {
      updateData = {
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
      };
      actionType = "CANCELLED";
      console.log("Cancelling order:", orderId);
    } else if (action === "update") {
      if (location) updateData.location = location;
      if (preferredDate) updateData.preferred_date = preferredDate;
      if (note !== undefined) updateData.note = note || null;
      
      if (Object.keys(updateData).length === 0) {
        return new Response(
          JSON.stringify({ error: "No update fields provided" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.log("Updating order:", orderId, updateData);
    }

    // Update the order
    const { data: updatedOrder, error: updateError } = await supabase
      .from("orders")
      .update(updateData)
      .eq("id", orderId)
      .eq("order_token", orderToken)
      .select("*")
      .single();

    if (updateError) {
      console.error("Update error:", updateError);
      throw new Error(`Failed to update order: ${updateError.message}`);
    }

    console.log("Order updated:", updatedOrder);

    // Generate notification message
    const merchantMessage = formatMerchantMessage(updatedOrder, actionType);
    const merchantWhatsAppUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(merchantMessage)}`;

    const formattedOrderNumber = `#L${String(updatedOrder.order_number).padStart(4, '0')}`;

    return new Response(
      JSON.stringify({
        success: true,
        action: actionType.toLowerCase(),
        order: {
          id: updatedOrder.id,
          name: formattedOrderNumber,
          orderNumber: updatedOrder.order_number,
          status: updatedOrder.status,
          totalPrice: updatedOrder.total_price.toString(),
          currency: updatedOrder.currency_code,
          createdAt: updatedOrder.created_at,
          updatedAt: updatedOrder.updated_at,
          customerName: updatedOrder.customer_name,
          customerPhone: updatedOrder.customer_phone,
          location: updatedOrder.location,
          preferredDate: updatedOrder.preferred_date,
          note: updatedOrder.note,
          lineItems: updatedOrder.line_items,
          cancelledAt: updatedOrder.cancelled_at,
        },
        merchantWhatsAppUrl,
        merchantMessage,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error updating order:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Failed to update order" 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
