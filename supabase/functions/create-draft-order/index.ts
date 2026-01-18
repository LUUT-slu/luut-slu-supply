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

const SHOPIFY_STORE_DOMAIN = "lovable-project-yf43m.myshopify.com";
const SHOPIFY_API_VERSION = "2025-01";
const WHATSAPP_NUMBER = "17587185478";

// Format WhatsApp message for merchant notification
function formatMerchantMessage(draftOrder: any, orderNumber: string, preferredDate: string, location: string, note?: string): string {
  const itemsList = draftOrder.line_items.map((item: any) => 
    `• ${item.title} x${item.quantity} — EC$${parseFloat(item.price).toFixed(2)}`
  ).join('\n');

  let message = `🆕 *NEW ORDER ${orderNumber}*\n\n`;
  message += `👤 Name: ${draftOrder.customer?.first_name || 'Customer'}\n`;
  message += `📱 Phone: ${draftOrder.customer?.phone || draftOrder.note?.match(/Phone: ([^\n]+)/)?.[1] || 'Not provided'}\n`;
  message += `📍 Location: ${location}\n`;
  message += `📅 Date: ${preferredDate}\n\n`;
  message += `📦 *Items:*\n${itemsList}\n\n`;
  message += `💰 *Total: EC$${parseFloat(draftOrder.total_price).toFixed(2)}*`;
  
  if (note) {
    message += `\n\n📝 Note: ${note}`;
  }

  return message;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const shopifyAccessToken = Deno.env.get("SHOPIFY_ACCESS_TOKEN");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!shopifyAccessToken) {
      throw new Error("Missing Shopify access token");
    }

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

    console.log("Creating draft order for:", customerName, "phone:", customerPhone);

    // Build the note for Shopify
    let shopifyNote = `📍 Pickup Location: ${location}\n📅 Preferred Date: ${preferredDate}\n👤 Customer: ${customerName}\n📱 Phone: ${customerPhone}`;
    if (note) {
      shopifyNote += `\n📝 Note: ${note}`;
    }
    shopifyNote += `\n\n💳 Payment: Pay on pickup`;

    // Convert line items to Shopify format
    const shopifyLineItems = lineItems.map(item => {
      // Extract numeric variant ID from global ID (gid://shopify/ProductVariant/123456)
      const variantIdMatch = item.variant_id.match(/\/(\d+)$/);
      const variantId = variantIdMatch ? variantIdMatch[1] : item.variant_id;
      
      return {
        variant_id: parseInt(variantId),
        quantity: item.quantity,
      };
    });

    // Create draft order via Shopify Admin API
    const shopifyUrl = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/draft_orders.json`;
    
    const draftOrderPayload = {
      draft_order: {
        line_items: shopifyLineItems,
        note: shopifyNote,
        customer: {
          first_name: customerName.split(' ')[0],
          last_name: customerName.split(' ').slice(1).join(' ') || '',
          phone: customerPhone,
        },
        use_customer_default_address: false,
        tags: `pickup-${location.toLowerCase().replace(/\s+/g, '-')}, pending-pickup`,
      }
    };

    console.log("Sending to Shopify:", JSON.stringify(draftOrderPayload, null, 2));

    const shopifyResponse = await fetch(shopifyUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": shopifyAccessToken,
      },
      body: JSON.stringify(draftOrderPayload),
    });

    const shopifyData = await shopifyResponse.json();

    if (!shopifyResponse.ok) {
      console.error("Shopify API error:", shopifyData);
      throw new Error(shopifyData.errors ? JSON.stringify(shopifyData.errors) : "Failed to create draft order");
    }

    const draftOrder = shopifyData.draft_order;
    console.log("Draft order created:", draftOrder.id, draftOrder.name);

    // Also save to our local orders table for My Orders tracking
    const { data: localOrder, error: insertError } = await supabase
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
      // Don't fail the whole request if local save fails - draft order was created in Shopify
    }

    // Generate WhatsApp URL for merchant notification
    const merchantMessage = formatMerchantMessage(draftOrder, draftOrder.name, preferredDate, location, note);
    const merchantWhatsAppUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(merchantMessage)}`;

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        draftOrder: {
          id: draftOrder.id,
          name: draftOrder.name,
          status: draftOrder.status,
          totalPrice: draftOrder.total_price,
          currency: draftOrder.currency,
          createdAt: draftOrder.created_at,
          invoiceUrl: draftOrder.invoice_url,
          lineItems: draftOrder.line_items,
        },
        localOrderId: localOrder?.id,
        localOrderToken: localOrder?.order_token,
        merchantWhatsAppUrl,
        customerMessage: merchantMessage,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error creating draft order:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Failed to create draft order" 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
