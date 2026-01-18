import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface LineItem {
  variant_id: string;
  product_id: string;
  quantity: number;
  title: string;
  price: string;
  image_url?: string | null;
}

interface DraftOrderRequest {
  customerName: string;
  customerPhone: string;
  location: string;
  preferredDate: string;
  note?: string;
  lineItems: LineItem[];
  totalPrice: number;
}

const WHATSAPP_NUMBER = "17587185478";

// Format WhatsApp message for merchant notification
function formatMerchantMessage(order: any, action: "NEW" | "CANCELLED" | "UPDATED"): string {
  const orderNumber = `#L${String(order.order_number).padStart(4, '0')}`;
  
  const itemsList = order.line_items.map((item: LineItem) => 
    `• ${item.title} x${item.quantity} — EC$${parseFloat(item.price).toFixed(2)}`
  ).join('\n');

  let emoji = action === "NEW" ? "🆕" : action === "CANCELLED" ? "❌" : "📝";
  let prefix = action === "NEW" ? "NEW ORDER" : action === "CANCELLED" ? "ORDER CANCELLED" : "ORDER UPDATED";

  let message = `${emoji} *${prefix} ${orderNumber}*\n\n`;
  message += `👤 Name: ${order.customer_name}\n`;
  message += `📱 Phone: ${order.customer_phone || 'Not provided'}\n`;
  message += `📍 Location: ${order.location}\n`;
  message += `📅 Date: ${order.preferred_date}\n\n`;
  message += `📦 *Items:*\n${itemsList}\n\n`;
  message += `💰 *Total: EC$${parseFloat(order.total_price).toFixed(2)}*`;
  message += `\n\n💳 Payment: Pay on pickup`;
  
  if (order.note) {
    message += `\n\n📝 Note: ${order.note}`;
  }

  return message;
}

serve(async (req) => {
  // Handle CORS preflight
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

    const body: DraftOrderRequest = await req.json();
    const { customerName, customerPhone, location, preferredDate, note, lineItems, totalPrice } = body;

    // Validate required fields
    if (!customerName || !customerPhone || !location || !preferredDate || !lineItems?.length) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: name, phone, location, date, and items are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Creating order for:", customerName, "phone:", customerPhone, "at", location);

    // Insert order into database
    const { data: order, error: insertError } = await supabase
      .from("orders")
      .insert({
        customer_name: customerName,
        customer_phone: customerPhone,
        location: location,
        preferred_date: preferredDate,
        note: note || null,
        total_price: totalPrice,
        currency_code: "XCD",
        line_items: lineItems,
        status: "pending",
      })
      .select("*")
      .single();

    if (insertError) {
      console.error("Database error:", insertError);
      throw new Error(`Failed to create order: ${insertError.message}`);
    }

    console.log("Order created:", order);

    // Format order number as #L0001, #L0002, etc.
    const formattedOrderNumber = `#L${String(order.order_number).padStart(4, '0')}`;

    // Generate WhatsApp URL for merchant notification
    const merchantMessage = formatMerchantMessage(order, "NEW");
    const merchantWhatsAppUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(merchantMessage)}`;

    console.log("Order token:", order.order_token);

    // Return order confirmation with format matching what CartDrawer expects
    return new Response(
      JSON.stringify({
        success: true,
        // For compatibility with CartDrawer expecting draftOrder
        draftOrder: {
          id: order.id,
          name: formattedOrderNumber,
          status: order.status,
          totalPrice: order.total_price.toString(),
          currency: order.currency_code,
          createdAt: order.created_at,
          lineItems: order.line_items,
        },
        localOrderId: order.id,
        localOrderToken: order.order_token,
        merchantWhatsAppUrl,
        customerMessage: merchantMessage,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error creating order:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Failed to create order" 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});