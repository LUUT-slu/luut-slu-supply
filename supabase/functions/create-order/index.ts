import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SHOPIFY_STORE_DOMAIN = "lovable-project-yf43m.myshopify.com";
const SHOPIFY_API_VERSION = "2025-01";

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
    const accessToken = Deno.env.get("SHOPIFY_ACCESS_TOKEN");
    if (!accessToken) {
      throw new Error("SHOPIFY_ACCESS_TOKEN not configured");
    }

    const body: OrderRequest = await req.json();
    const { customerName, location, preferredDate, note, lineItems, totalPrice } = body;

    // Validate required fields
    if (!customerName || !location || !preferredDate || !lineItems?.length) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract numeric variant IDs from GraphQL IDs
    const formattedLineItems = lineItems.map((item) => {
      // Extract numeric ID from gid://shopify/ProductVariant/123456
      const variantIdMatch = item.variant_id.match(/ProductVariant\/(\d+)/);
      const numericVariantId = variantIdMatch ? variantIdMatch[1] : item.variant_id;
      
      return {
        variant_id: parseInt(numericVariantId),
        quantity: item.quantity,
        title: item.title,
        price: item.price,
      };
    });

    // Create draft order via Shopify Admin API
    const draftOrderPayload = {
      draft_order: {
        line_items: formattedLineItems,
        note: `📍 Meetup Location: ${location}\n📅 Preferred Date: ${preferredDate}${note ? `\n📝 Note: ${note}` : ""}`,
        tags: "meetup-order, luut-slu",
        shipping_address: {
          first_name: customerName.split(" ")[0],
          last_name: customerName.split(" ").slice(1).join(" ") || "-",
          address1: location,
          city: location,
          country: "Saint Lucia",
          country_code: "LC",
        },
        billing_address: {
          first_name: customerName.split(" ")[0],
          last_name: customerName.split(" ").slice(1).join(" ") || "-",
          address1: location,
          city: location,
          country: "Saint Lucia",
          country_code: "LC",
        },
      },
    };

    console.log("Creating draft order:", JSON.stringify(draftOrderPayload, null, 2));

    const response = await fetch(
      `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/draft_orders.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": accessToken,
        },
        body: JSON.stringify(draftOrderPayload),
      }
    );

    const responseText = await response.text();
    console.log("Shopify response status:", response.status);
    console.log("Shopify response:", responseText);

    if (!response.ok) {
      throw new Error(`Shopify API error: ${response.status} - ${responseText}`);
    }

    const data = JSON.parse(responseText);
    const draftOrder = data.draft_order;

    // Return order confirmation details
    return new Response(
      JSON.stringify({
        success: true,
        order: {
          id: draftOrder.id,
          name: draftOrder.name, // This is the order number like #D1
          status: draftOrder.status,
          totalPrice: draftOrder.total_price,
          currency: draftOrder.currency,
          createdAt: draftOrder.created_at,
          customerName,
          location,
          preferredDate,
          note: note || null,
          lineItems: draftOrder.line_items.map((item: any) => ({
            title: item.title,
            quantity: item.quantity,
            price: item.price,
          })),
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
