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
  vendor?: string;
  source?: 'shopify' | 'lovable';
}

interface DraftOrderRequest {
  customerName: string;
  customerPhone: string;
  location: string;
  preferredDate: string;
  note?: string;
  lineItems: LineItem[];
  totalPrice: number;
  sellerVendor?: string;
  discountCode?: string | null;
}

const SHOPIFY_STORE_DOMAIN = "lovable-project-yf43m.myshopify.com";
const SHOPIFY_API_VERSION = "2025-01";
const WHATSAPP_NUMBER = "17587185478";

// Normalize vendor names to canonical form (matches frontend normalizeVendorName)
function normalizeVendorName(vendor: string): string {
  if (vendor.toLowerCase().includes("luut slu")) return "LUUT SLU";
  return vendor;
}

// Format WhatsApp message for merchant notification
function formatMerchantMessage(draftOrder: any, localOrder: any, preferredDate: string, location: string, note?: string): string {
  const orderNumber = draftOrder?.name || `#L${String(localOrder.order_number).padStart(4, '0')}`;
  
  const itemsList = (draftOrder?.line_items || localOrder.line_items).map((item: any) => 
    `• ${item.title} x${item.quantity} — EC$${parseFloat(item.price).toFixed(2)}`
  ).join('\n');

  let message = `🆕 *NEW ORDER ${orderNumber}*\n\n`;
  message += `👤 Name: ${localOrder.customer_name}\n`;
  message += `📱 Phone: ${localOrder.customer_phone || 'Not provided'}\n`;
  message += `📍 Location: ${location}\n`;
  message += `📅 Date: ${preferredDate}\n\n`;
  message += `📦 *Items:*\n${itemsList}\n\n`;
  message += `💰 *Total: EC$${parseFloat(draftOrder?.total_price || localOrder.total_price).toFixed(2)}*`;
  message += `\n\n💳 Payment: Pay on pickup`;
  
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
    const shopifyAdminToken = Deno.env.get("SHOPIFY_ADMIN_TOKEN");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const body: DraftOrderRequest = await req.json();
    const { customerName, customerPhone, location, preferredDate, note, lineItems, totalPrice, discountCode } = body;

    // Validate required fields
    if (!customerName || !customerPhone || !location || !preferredDate || !lineItems?.length) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: name, phone, location, date, and items are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Creating order for:", customerName, "phone:", customerPhone, "at", location);

    // Separate Shopify and Lovable products
    const shopifyItems = lineItems.filter(item => 
      !item.source || item.source === 'shopify' || item.variant_id.startsWith('gid://shopify/')
    );
    const lovableItems = lineItems.filter(item => 
      item.source === 'lovable' || item.variant_id.startsWith('lovable-variant-')
    );

    console.log(`Processing ${shopifyItems.length} Shopify items and ${lovableItems.length} Lovable items`);

    // First, save to local database
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
      throw new Error(`Failed to create order: ${insertError.message}`);
    }

    console.log("Local order created:", localOrder.id);

    // ============================================================
    // Create order_items for ALL products (both Shopify & Lovable)
    // This ensures seller dashboards can see and manage orders
    // ============================================================

    // Step 1: Build seller lookup maps
    // For Shopify items: look up seller_products by shopify_product_id
    const shopifyProductIds = shopifyItems
      .map(item => item.product_id)
      .filter(Boolean);

    let shopifyProductMap: Record<string, { id: string; seller_id: string }> = {};
    if (shopifyProductIds.length > 0) {
      const { data: matchedProducts } = await supabase
        .from("seller_products")
        .select("id, seller_id, shopify_product_id")
        .in("shopify_product_id", shopifyProductIds);

      if (matchedProducts) {
        for (const p of matchedProducts) {
          if (p.shopify_product_id) {
            shopifyProductMap[p.shopify_product_id] = { id: p.id, seller_id: p.seller_id };
          }
        }
      }
    }

    // For Lovable items: look up seller_products by product UUID
    const lovableProductIds = lovableItems
      .map(item => item.variant_id.replace('lovable-variant-', ''))
      .filter(Boolean);

    let lovableProductMap: Record<string, string> = {};
    if (lovableProductIds.length > 0) {
      const { data: matchedProducts } = await supabase
        .from("seller_products")
        .select("id, seller_id")
        .in("id", lovableProductIds);

      if (matchedProducts) {
        for (const p of matchedProducts) {
          lovableProductMap[p.id] = p.seller_id;
        }
      }
    }

    // Fallback: look up seller_profiles by vendor name for items without a match
    const uniqueVendors = [...new Set(
      lineItems
        .map(item => item.vendor ? normalizeVendorName(item.vendor) : null)
        .filter(Boolean) as string[]
    )];

    let vendorToSellerId: Record<string, string> = {};
    if (uniqueVendors.length > 0) {
      const { data: sellerProfiles } = await supabase
        .from("seller_profiles")
        .select("id, seller_name");

      if (sellerProfiles) {
        for (const vendor of uniqueVendors) {
          const match = sellerProfiles.find(
            sp => sp.seller_name.toLowerCase() === vendor.toLowerCase()
          );
          if (match) {
            vendorToSellerId[vendor] = match.id;
          }
        }
      }
    }

    // Step 2: Build order_items for all line items
    const orderItemsToInsert = lineItems.map(item => {
      const isLovable = item.source === 'lovable' || item.variant_id.startsWith('lovable-variant-');

      let productId: string | null = null;
      let sellerId: string | null = null;

      if (isLovable) {
        // Lovable product: use UUID from variant_id
        productId = item.variant_id.replace('lovable-variant-', '');
        sellerId = lovableProductMap[productId] || null;
      } else {
        // Shopify product: look up by shopify_product_id
        const match = shopifyProductMap[item.product_id];
        if (match) {
          productId = match.id;
          sellerId = match.seller_id;
        }
      }

      // Fallback to vendor name lookup if no seller_id found
      if (!sellerId && item.vendor) {
        const normalizedVendor = normalizeVendorName(item.vendor);
        sellerId = vendorToSellerId[normalizedVendor] || null;
      }

      return {
        order_id: localOrder.id,
        product_id: productId,
        product_name: item.title,
        unit_price: parseFloat(item.price),
        quantity: item.quantity,
        total_price: parseFloat(item.price) * item.quantity,
        product_image_url: item.image_url || null,
        seller_id: sellerId,
      };
    });

    if (orderItemsToInsert.length > 0) {
      const { error: orderItemsError } = await supabase
        .from("order_items")
        .insert(orderItemsToInsert);

      if (orderItemsError) {
        console.error("Failed to create order_items:", orderItemsError);
        // Non-fatal - continue with order
      } else {
        console.log(`Created ${orderItemsToInsert.length} order_items (${shopifyItems.length} Shopify, ${lovableItems.length} Lovable)`);
      }
    }

    let draftOrder = null;

    // Only create Shopify draft order if there are Shopify products AND admin token is available
    if (shopifyAdminToken && shopifyItems.length > 0) {
      try {
        // Build the note for Shopify
        let shopifyNote = `📍 Pickup Location: ${location}\n📅 Preferred Date: ${preferredDate}\n👤 Customer: ${customerName}\n📱 Phone: ${customerPhone}`;
        if (note) {
          shopifyNote += `\n📝 Note: ${note}`;
        }
        if (discountCode) {
          shopifyNote += `\n🏷️ Discount Code: ${discountCode}`;
        }
        shopifyNote += `\n\n💳 Payment: Pay on pickup`;
        shopifyNote += `\n\nLocal Order ID: ${localOrder.id}`;
        
        // Note if there are also Lovable products
        if (lovableItems.length > 0) {
          shopifyNote += `\n\n⚠️ This order also contains ${lovableItems.length} local seller product(s) not in Shopify.`;
        }

        // Convert line items to Shopify format
        const shopifyLineItems = shopifyItems.map(item => {
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
        
        const draftOrderPayload: any = {
          draft_order: {
            line_items: shopifyLineItems,
            note: shopifyNote,
            customer: {
              first_name: customerName.split(' ')[0],
              last_name: customerName.split(' ').slice(1).join(' ') || '',
              phone: customerPhone,
            },
            use_customer_default_address: false,
            tags: `pickup-${location.toLowerCase().replace(/\s+/g, '-').slice(0, 25)}, pending-pickup`,
          }
        };

        // Apply discount code if provided — look up price rule from Shopify
        if (discountCode) {
          try {
            // Look up the discount code to get its price rule
            const lookupUrl = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/discount_codes/lookup.json?code=${encodeURIComponent(discountCode)}`;
            const lookupRes = await fetch(lookupUrl, {
              headers: { "X-Shopify-Access-Token": shopifyAdminToken },
              redirect: "follow",
            });

            if (lookupRes.ok) {
              const lookupData = await lookupRes.json();
              const priceRuleId = lookupData.discount_code?.price_rule_id;

              if (priceRuleId) {
                const priceRuleUrl = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/price_rules/${priceRuleId}.json`;
                const priceRuleRes = await fetch(priceRuleUrl, {
                  headers: { "X-Shopify-Access-Token": shopifyAdminToken },
                });

                if (priceRuleRes.ok) {
                  const priceRuleData = await priceRuleRes.json();
                  const rule = priceRuleData.price_rule;

                  draftOrderPayload.draft_order.applied_discount = {
                    description: rule.title || discountCode,
                    value_type: rule.value_type, // "percentage" or "fixed_amount"
                    value: String(Math.abs(parseFloat(rule.value))),
                    title: discountCode,
                  };
                  console.log(`Applied discount: ${discountCode} (${rule.value_type}: ${rule.value})`);
                }
              }
            }
          } catch (discountErr) {
            console.error("Failed to look up discount for draft order (non-fatal):", discountErr);
          }
          // Tag the discount code used
          draftOrderPayload.draft_order.tags += `, discount-${discountCode.toLowerCase()}`;
        }

        console.log("Sending to Shopify Draft Order API...");

        const shopifyResponse = await fetch(shopifyUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": shopifyAdminToken,
          },
          body: JSON.stringify(draftOrderPayload),
        });

        const shopifyData = await shopifyResponse.json();

        if (shopifyResponse.ok && shopifyData.draft_order) {
          draftOrder = shopifyData.draft_order;
          console.log("Shopify draft order created:", draftOrder.id, draftOrder.name);
        } else {
          console.error("Shopify API error (non-fatal):", shopifyData);
          // Continue without Shopify draft order - local order is still valid
        }
      } catch (shopifyError) {
        console.error("Shopify draft order creation failed (non-fatal):", shopifyError);
        // Continue without Shopify draft order
      }
    } else if (lovableItems.length > 0 && shopifyItems.length === 0) {
      console.log("Order contains only Lovable products - skipping Shopify draft order");
    } else {
      console.log("No Shopify admin token configured, skipping draft order creation");
    }

    // Format order number
    const formattedOrderNumber = draftOrder?.name || `#L${String(localOrder.order_number).padStart(4, '0')}`;

    // Generate WhatsApp URL for merchant notification
    const merchantMessage = formatMerchantMessage(draftOrder, localOrder, preferredDate, location, note);
    const merchantWhatsAppUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(merchantMessage)}`;

    console.log("Order complete. Local:", localOrder.id, "Shopify:", draftOrder?.id || "none");

    // Return order confirmation
    return new Response(
      JSON.stringify({
        success: true,
        draftOrder: {
          id: draftOrder?.id || localOrder.id,
          name: formattedOrderNumber,
          status: draftOrder?.status || localOrder.status,
          totalPrice: (draftOrder?.total_price || localOrder.total_price).toString(),
          currency: draftOrder?.currency || localOrder.currency_code,
          createdAt: draftOrder?.created_at || localOrder.created_at,
          invoiceUrl: draftOrder?.invoice_url || null,
          lineItems: draftOrder?.line_items || localOrder.line_items,
          shopifyDraftOrderId: draftOrder?.id || null,
        },
        localOrderId: localOrder.id,
        localOrderToken: localOrder.order_token,
        merchantWhatsAppUrl,
        customerMessage: merchantMessage,
        hasShopifyProducts: shopifyItems.length > 0,
        hasLovableProducts: lovableItems.length > 0,
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