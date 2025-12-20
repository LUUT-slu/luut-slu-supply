import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface LineItem {
  variant_id: string;
  quantity: number;
  title: string;
  price: string;
}

interface OrderRequest {
  customerName: string;
  location: string;
  preferredDate: string;
  note?: string;
  lineItems: LineItem[];
  totalPrice: number;
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

    const body: OrderRequest = await req.json();
    const { customerName, location, preferredDate, note, lineItems, totalPrice } = body;

    // Validate required fields
    if (!customerName || !location || !preferredDate || !lineItems?.length) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Creating order for:", customerName, "at", location);

    // Insert order into database
    const { data: order, error: insertError } = await supabase
      .from("orders")
      .insert({
        customer_name: customerName,
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

    // Return order confirmation
    return new Response(
      JSON.stringify({
        success: true,
        orderId: order.id, // For localStorage tracking
        order: {
          id: order.id,
          name: formattedOrderNumber,
          orderNumber: order.order_number,
          status: order.status,
          totalPrice: order.total_price.toString(),
          currency: order.currency_code,
          createdAt: order.created_at,
          customerName: order.customer_name,
          location: order.location,
          preferredDate: order.preferred_date,
          note: order.note,
          lineItems: order.line_items,
        },
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