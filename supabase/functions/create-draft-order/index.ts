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
  customerEmail?: string | null;
  location: string;
  preferredDate: string;
  pickupTime?: string;
  note?: string;
  lineItems: LineItem[];
  totalPrice: number;
  sellerVendor?: string;
  discountCode?: string | null;
  orderSource?: 'customer_checkout' | 'seller_dashboard';
  createdBySellerId?: string | null;
  sellerName?: string | null;
  existingOrderId?: string | null;
}

const SHOPIFY_STORE_DOMAIN = "lovable-project-yf43m.myshopify.com";
const SHOPIFY_API_VERSION = "2025-01";
const WHATSAPP_NUMBER = "17587185478";

// Normalize vendor names to canonical form
function normalizeVendorName(vendor: string): string {
  if (vendor.toLowerCase().includes("luut slu")) return "LUUT SLU";
  return vendor;
}

// Normalize phone to E.164 format for Saint Lucia
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 7) return `+1758${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (phone.startsWith('+')) return phone;
  return `+${digits}`;
}

// Look up or create a Shopify customer by phone, returns customer ID
async function findOrCreateShopifyCustomer(
  adminToken: string,
  firstName: string,
  lastName: string,
  phone: string
): Promise<number | null> {
  const normalizedPhone = normalizePhone(phone);
  
  // Step 1: Search for existing customer by phone
  try {
    const searchUrl = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/customers/search.json?query=phone:${encodeURIComponent(normalizedPhone)}`;
    const searchRes = await fetch(searchUrl, {
      headers: { "X-Shopify-Access-Token": adminToken },
    });

    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.customers && searchData.customers.length > 0) {
        console.log("Found existing Shopify customer:", searchData.customers[0].id);
        return searchData.customers[0].id;
      }
    } else {
      console.error("Customer search failed:", searchRes.status, await searchRes.text());
    }
  } catch (err) {
    console.error("Customer search error (non-fatal):", err);
  }

  // Step 2: Create new customer
  try {
    const createUrl = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/customers.json`;
    const createRes = await fetch(createUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": adminToken,
      },
      body: JSON.stringify({
        customer: {
          first_name: firstName,
          last_name: lastName,
          phone: normalizedPhone,
          tags: "luut-connect",
          verified_email: false,
          send_email_invite: false,
        },
      }),
    });

    if (createRes.ok) {
      const createData = await createRes.json();
      console.log("Created new Shopify customer:", createData.customer?.id);
      return createData.customer?.id || null;
    } else {
      const errBody = await createRes.text();
      console.error("Customer creation failed:", createRes.status, errBody);
      // If phone already taken (422), try search again with looser query
      if (createRes.status === 422 && errBody.includes("phone")) {
        try {
          const retryUrl = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/customers/search.json?query=${encodeURIComponent(normalizedPhone)}`;
          const retryRes = await fetch(retryUrl, {
            headers: { "X-Shopify-Access-Token": adminToken },
          });
          if (retryRes.ok) {
            const retryData = await retryRes.json();
            if (retryData.customers?.length > 0) {
              console.log("Found customer on retry:", retryData.customers[0].id);
              return retryData.customers[0].id;
            }
          }
        } catch (_) { /* ignore */ }
      }
    }
  } catch (err) {
    console.error("Customer creation error (non-fatal):", err);
  }

  return null;
}

// Look up discount code and return applied_discount object
async function resolveDiscountForDraftOrder(
  adminToken: string,
  discountCode: string
): Promise<{ description: string; value_type: string; value: string; title: string } | null> {
  // Handle internal WELCOME5 discount directly (EC$5 fixed)
  if (discountCode.toUpperCase() === "WELCOME5") {
    console.log("Applying internal WELCOME5 discount directly (EC$5 fixed)");
    return {
      description: "Welcome Discount",
      value_type: "fixed_amount",
      value: "5.00",
      title: "WELCOME5",
    };
  }

  try {
    // Use redirect: "manual" to handle Shopify's 303 redirect properly
    const lookupUrl = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/discount_codes/lookup.json?code=${encodeURIComponent(discountCode)}`;
    console.log("Looking up discount code:", discountCode);
    
    const lookupRes = await fetch(lookupUrl, {
      headers: { "X-Shopify-Access-Token": adminToken },
      redirect: "manual",
    });

    let discountData: any = null;

    if (lookupRes.status === 303 || lookupRes.status === 301 || lookupRes.status === 302) {
      // Follow redirect manually with auth header
      const redirectUrl = lookupRes.headers.get("Location");
      if (redirectUrl) {
        const fullUrl = redirectUrl.startsWith("http") ? redirectUrl : `https://${SHOPIFY_STORE_DOMAIN}${redirectUrl}`;
        console.log("Following discount redirect to:", fullUrl);
        const redirectRes = await fetch(fullUrl, {
          headers: { "X-Shopify-Access-Token": adminToken },
        });
        if (redirectRes.ok) {
          discountData = await redirectRes.json();
        } else {
          console.error("Discount redirect fetch failed:", redirectRes.status);
        }
      }
    } else if (lookupRes.ok) {
      discountData = await lookupRes.json();
    } else {
      console.error("Discount lookup failed:", lookupRes.status, await lookupRes.text());
    }

    if (!discountData?.discount_code?.price_rule_id) {
      console.error("No price_rule_id found in discount data");
      return null;
    }

    const priceRuleId = discountData.discount_code.price_rule_id;
    const priceRuleUrl = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/price_rules/${priceRuleId}.json`;
    const priceRuleRes = await fetch(priceRuleUrl, {
      headers: { "X-Shopify-Access-Token": adminToken },
    });

    if (!priceRuleRes.ok) {
      console.error("Price rule fetch failed:", priceRuleRes.status);
      return null;
    }

    const priceRuleData = await priceRuleRes.json();
    const rule = priceRuleData.price_rule;

    console.log(`Resolved discount: ${discountCode} → ${rule.value_type}: ${rule.value}`);
    return {
      description: rule.title || discountCode,
      value_type: rule.value_type,
      value: String(Math.abs(parseFloat(rule.value))),
      title: discountCode,
    };
  } catch (err) {
    console.error("Discount resolution error (non-fatal):", err);
    return null;
  }
}

// Format WhatsApp message for merchant notification
function formatMerchantMessage(draftOrder: any, localOrder: any, preferredDate: string, location: string, pickupTime?: string, note?: string): string {
  const orderNumber = draftOrder?.name || `#L${String(localOrder.order_number).padStart(4, '0')}`;
  
  const itemsList = (draftOrder?.line_items || localOrder.line_items).map((item: any) => 
    `• ${item.title} x${item.quantity} — EC$${parseFloat(item.price).toFixed(2)}`
  ).join('\n');

  let message = `🆕 *NEW ORDER ${orderNumber}*\n\n`;
  message += `👤 Name: ${localOrder.customer_name}\n`;
  message += `📱 Phone: ${localOrder.customer_phone || 'Not provided'}\n`;
  message += `📍 Location: ${location}\n`;
  message += `📅 Date: ${preferredDate}\n`;
  if (pickupTime) {
    message += `⏰ Time: ${pickupTime}\n`;
  }
  message += `\n📦 *Items:*\n${itemsList}\n\n`;
  message += `💰 *Total: EC$${parseFloat(draftOrder?.total_price || localOrder.total_price).toFixed(2)}*`;
  message += `\n\n💳 Payment: Pay on pickup`;
  
  if (note) {
    message += `\n\n📝 Note: ${note}`;
  }

  return message;
}

serve(async (req) => {
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
    const { customerName, customerPhone, customerEmail, location, preferredDate, pickupTime, note, lineItems, totalPrice, discountCode } = body;

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

    // Save to local database
    const { data: localOrder, error: insertError } = await supabase
      .from("orders")
      .insert({
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_email: customerEmail || null,
        location: location,
        preferred_date: preferredDate,
        pickup_time: pickupTime || null,
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
    // ============================================================

    const shopifyProductIds = shopifyItems.map(item => item.product_id).filter(Boolean);
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
          if (match) vendorToSellerId[vendor] = match.id;
        }
      }
    }

    const orderItemsToInsert = lineItems.map(item => {
      const isLovable = item.source === 'lovable' || item.variant_id.startsWith('lovable-variant-');
      let productId: string | null = null;
      let sellerId: string | null = null;

      if (isLovable) {
        productId = item.variant_id.replace('lovable-variant-', '');
        sellerId = lovableProductMap[productId] || null;
      } else {
        const match = shopifyProductMap[item.product_id];
        if (match) {
          productId = match.id;
          sellerId = match.seller_id;
        }
      }

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
      } else {
        console.log(`Created ${orderItemsToInsert.length} order_items`);
      }
    }

    let draftOrder = null;

    // Only create Shopify draft order if there are Shopify products AND admin token
    if (shopifyAdminToken && shopifyItems.length > 0) {
      try {
        const firstName = customerName.split(' ')[0];
        const lastName = customerName.split(' ').slice(1).join(' ') || '';
        const normalizedPhone = normalizePhone(customerPhone);

        // ========== CUSTOMER LOOKUP/CREATE ==========
        const shopifyCustomerId = await findOrCreateShopifyCustomer(
          shopifyAdminToken, firstName, lastName, customerPhone
        );

        // ========== BUILD NOTE ==========
        let shopifyNote = `📍 Pickup: ${location} | 📅 Date: ${preferredDate}`;
        if (pickupTime) shopifyNote += ` | ⏰ Time: ${pickupTime}`;
        shopifyNote += ` | 📱 Phone: ${normalizedPhone}`;
        shopifyNote += `\n👤 Customer: ${customerName}`;
        if (note) shopifyNote += `\n📝 Note: ${note}`;
        if (discountCode) shopifyNote += `\n🏷️ Discount Code: ${discountCode}`;
        shopifyNote += `\n\n💳 Payment: Pay on pickup`;
        shopifyNote += `\nLocal Order ID: ${localOrder.id}`;
        if (lovableItems.length > 0) {
          shopifyNote += `\n\n⚠️ This order also contains ${lovableItems.length} local seller product(s) not in Shopify.`;
        }

        // ========== LINE ITEMS ==========
        const shopifyLineItems = shopifyItems.map(item => {
          const variantIdMatch = item.variant_id.match(/\/(\d+)$/);
          const variantId = variantIdMatch ? variantIdMatch[1] : item.variant_id;
          return { variant_id: parseInt(variantId), quantity: item.quantity };
        });

        // ========== BUILD PAYLOAD ==========
        const draftOrderPayload: any = {
          draft_order: {
            line_items: shopifyLineItems,
            note: shopifyNote,
            customer: shopifyCustomerId ? { id: shopifyCustomerId } : {
              first_name: firstName,
              last_name: lastName,
              phone: normalizedPhone,
            },
            shipping_address: {
              first_name: firstName,
              last_name: lastName,
              phone: normalizedPhone,
              address1: "Pickup",
              city: location,
              country: "Saint Lucia",
              country_code: "LC",
            },
            use_customer_default_address: false,
            tags: `pickup-${location.toLowerCase().replace(/\s+/g, '-').slice(0, 25)}, pending-pickup`,
            metafields: [
              { namespace: "pickup", key: "location", value: location, type: "single_line_text_field" },
              { namespace: "pickup", key: "date", value: preferredDate, type: "single_line_text_field" },
              { namespace: "pickup", key: "phone", value: normalizedPhone, type: "single_line_text_field" },
            ],
          }
        };

        // Add pickup time metafield if provided
        if (pickupTime) {
          draftOrderPayload.draft_order.metafields.push({
            namespace: "pickup", key: "time", value: pickupTime, type: "single_line_text_field"
          });
        }

        // ========== DISCOUNT APPLICATION ==========
        if (discountCode) {
          const appliedDiscount = await resolveDiscountForDraftOrder(shopifyAdminToken, discountCode);
          if (appliedDiscount) {
            draftOrderPayload.draft_order.applied_discount = appliedDiscount;
            console.log(`Discount applied to draft order: ${appliedDiscount.title} (${appliedDiscount.value_type}: ${appliedDiscount.value})`);
          } else {
            console.warn(`Could not resolve discount "${discountCode}" — draft order will be created without discount`);
          }
          draftOrderPayload.draft_order.tags += `, discount-${discountCode.toLowerCase()}`;
        }

        // ========== CREATE DRAFT ORDER ==========
        console.log("Sending to Shopify Draft Order API...");
        const shopifyUrl = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/draft_orders.json`;

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
          console.log("Shopify draft order created:", draftOrder.id, draftOrder.name, 
            "Customer:", draftOrder.customer?.id || "none",
            "Discount:", draftOrder.applied_discount ? "yes" : "none");
        } else {
          console.error("Shopify API error (non-fatal):", JSON.stringify(shopifyData));
        }
      } catch (shopifyError) {
        console.error("Shopify draft order creation failed (non-fatal):", shopifyError);
      }
    } else if (lovableItems.length > 0 && shopifyItems.length === 0) {
      console.log("Order contains only Lovable products — skipping Shopify draft order");
    } else {
      console.log("No Shopify admin token configured, skipping draft order creation");
    }

    const formattedOrderNumber = draftOrder?.name || `#L${String(localOrder.order_number).padStart(4, '0')}`;
    const merchantMessage = formatMerchantMessage(draftOrder, localOrder, preferredDate, location, pickupTime, note);
    const merchantWhatsAppUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(merchantMessage)}`;

    console.log("Order complete. Local:", localOrder.id, "Shopify:", draftOrder?.id || "none");

    // Trigger merchant notification email after successful order creation (fire-and-forget)
    try {
      const merchantEmailUrl = `${supabaseUrl}/functions/v1/send-merchant-order-email`;
      fetch(merchantEmailUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({ orderId: localOrder.id }),
      }).then(async (res) => {
        if (!res.ok) {
          const detail = await res.text();
          console.error("Merchant email failed:", res.status, detail);
        } else {
          console.log("Merchant email triggered for order", localOrder.id);
        }
      }).catch(err => console.error("Merchant email error:", err));
    } catch (merchantEmailErr) {
      console.error("Merchant email trigger error (non-fatal):", merchantEmailErr);
    }

    // Trigger order confirmation email (fire-and-forget)
    if (localOrder.customer_email) {
      try {
        const emailUrl = `${supabaseUrl}/functions/v1/send-order-email`;
        fetch(emailUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({ orderId: localOrder.id, type: "order_confirmation" }),
        }).then(res => {
          if (!res.ok) console.error("Confirmation email failed:", res.status);
          else console.log("Confirmation email triggered for order", localOrder.id);
        }).catch(err => console.error("Confirmation email error:", err));
      } catch (emailErr) {
        console.error("Email trigger error (non-fatal):", emailErr);
      }
    }

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
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error creating order:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Failed to create order" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
