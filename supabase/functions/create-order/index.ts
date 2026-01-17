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
  product_id?: string;
}

interface OrderRequest {
  customerName: string;
  location: string;
  preferredDate: string;
  note?: string;
  lineItems: LineItem[];
  totalPrice: number;
}

// Convert Shopify global ID to numeric ID
function extractNumericId(globalId: string): string {
  // Format: gid://shopify/ProductVariant/12345678901234
  const parts = globalId.split('/');
  return parts[parts.length - 1];
}

async function createShopifyDraftOrder(
  orderData: OrderRequest,
  shopifyAccessToken: string,
  shopDomain: string
): Promise<{ id: number; name: string } | null> {
  const apiVersion = "2025-07";
  const url = `https://${shopDomain}/admin/api/${apiVersion}/draft_orders.json`;

  // Build line items for Shopify
  const shopifyLineItems = orderData.lineItems.map(item => ({
    variant_id: parseInt(extractNumericId(item.variant_id)),
    quantity: item.quantity,
  }));

  // Build note with meetup details
  let orderNote = `📍 Meetup Location: ${orderData.location}\n📅 Preferred Date: ${orderData.preferredDate}\n👤 Customer: ${orderData.customerName}`;
  if (orderData.note) {
    orderNote += `\n📝 Note: ${orderData.note}`;
  }

  const draftOrderPayload = {
    draft_order: {
      line_items: shopifyLineItems,
      note: orderNote,
      tags: "luut-order,pay-on-meetup",
      shipping_address: {
        first_name: orderData.customerName,
        address1: orderData.location,
        city: orderData.location,
        country: "Saint Lucia",
        country_code: "LC",
      },
    },
  };

  console.log("Creating Shopify draft order:", JSON.stringify(draftOrderPayload));

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": shopifyAccessToken,
      },
      body: JSON.stringify(draftOrderPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Shopify API error:", response.status, errorText);
      return null;
    }

    const data = await response.json();
    console.log("Shopify draft order created:", data.draft_order.id, data.draft_order.name);
    
    return {
      id: data.draft_order.id,
      name: data.draft_order.name,
    };
  } catch (error) {
    console.error("Error creating Shopify draft order:", error);
    return null;
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const shopifyAccessToken = Deno.env.get("SHOPIFY_ACCESS_TOKEN");
    const shopDomain = "lovable-project-yf43m.myshopify.com";
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase configuration");
    }

    if (!shopifyAccessToken) {
      console.warn("SHOPIFY_ACCESS_TOKEN not configured - skipping Shopify order creation");
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

    // Create Shopify draft order first (if token available)
    let shopifyOrder = null;
    if (shopifyAccessToken) {
      shopifyOrder = await createShopifyDraftOrder(body, shopifyAccessToken, shopDomain);
    }

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
        orderId: order.id,
        shopifyOrderId: shopifyOrder?.id || null,
        shopifyOrderName: shopifyOrder?.name || null,
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
