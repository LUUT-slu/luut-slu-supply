import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { normalizePhone, last10Digits } from "../_shared/phone.ts";


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

// (phone normalization comes from ../_shared/phone.ts)


// Look up or create a Shopify customer. Phone (normalized) is the primary identity,
// email is the secondary identity. Returns { id } on success; { id: null, error }
// on hard failure so callers can record it and refuse to proceed without a link.
async function findOrCreateShopifyCustomer(
  adminToken: string,
  firstName: string,
  lastName: string,
  phone: string,
  email: string | null,
  knownShopifyCustomerId?: string | null,
): Promise<{ id: number | null; error?: string }> {
  const normalizedPhone = normalizePhone(phone);
  const last10 = last10Digits(phone);

  const searchByQuery = async (query: string): Promise<{ ok: boolean; customer?: any; error?: string }> => {
    try {
      const url = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/customers/search.json?query=${encodeURIComponent(query)}`;
      const res = await fetch(url, { headers: { "X-Shopify-Access-Token": adminToken } });
      if (!res.ok) {
        const body = await res.text();
        return { ok: false, error: `search "${query}" ${res.status}: ${body}`.slice(0, 400) };
      }
      const data = await res.json();
      return { ok: true, customer: data?.customers?.[0] ?? null };
    } catch (err) {
      return { ok: false, error: `search "${query}" network: ${String(err)}`.slice(0, 400) };
    }
  };

  const fetchById = async (id: string): Promise<any | null> => {
    try {
      const res = await fetch(
        `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/customers/${id}.json`,
        { headers: { "X-Shopify-Access-Token": adminToken } },
      );
      if (!res.ok) return null;
      const data = await res.json();
      return data?.customer ?? null;
    } catch { return null; }
  };

  let existing: any = null;

  // Step 0: Fast-path — known Shopify customer id from our local profile.
  if (knownShopifyCustomerId) {
    const byId = await fetchById(knownShopifyCustomerId);
    if (byId?.id) existing = byId;
  }

  // Step 1: Primary identity — phone (normalized).
  if (!existing && normalizedPhone) {
    const phoneSearch = await searchByQuery(`phone:${normalizedPhone}`);
    if (!phoneSearch.ok) {
      return { id: null, error: phoneSearch.error };
    }
    existing = phoneSearch.customer;
  }

  // Step 1b: Secondary phone search using the last 10 digits, in case
  // Shopify stored the customer's phone without a leading '+1'.
  if (!existing && last10) {
    const altSearch = await searchByQuery(`phone:${last10}`);
    if (!altSearch.ok) {
      return { id: null, error: altSearch.error };
    }
    existing = altSearch.customer;
  }

  // Step 2: Secondary identity — email.
  if (!existing && email) {
    const emailSearch = await searchByQuery(`email:${email}`);
    if (!emailSearch.ok) {
      return { id: null, error: emailSearch.error };
    }
    existing = emailSearch.customer;
  }

  if (existing?.id) {
    console.log("Matched existing Shopify customer:", existing.id);
    // Ensure phone is set on the customer record (needed for future phone-primary matching).
    // Never overwrite first_name/last_name on match — the existing customer wins.
    if (normalizedPhone && (!existing.phone || existing.phone !== normalizedPhone)) {
      try {
        await fetch(
          `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/customers/${existing.id}.json`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              "X-Shopify-Access-Token": adminToken,
            },
            body: JSON.stringify({ customer: { id: existing.id, phone: normalizedPhone } }),
          }
        );
      } catch (e) {
        console.warn("Could not patch existing customer phone (non-fatal):", e);
      }
    }
    return { id: existing.id };
  }

  // Step 3: Create new customer with normalized phone.
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
          email: email || undefined,
          tags: "luut-connect",
          verified_email: false,
          send_email_invite: false,
        },
      }),
    });

    if (createRes.ok) {
      const createData = await createRes.json();
      console.log("Created new Shopify customer:", createData.customer?.id);
      return { id: createData.customer?.id || null };
    }

    const errBody = await createRes.text();
    console.error("Customer creation failed:", createRes.status, errBody);

    // 422 duplicate — someone else owns this phone/email; retry lookups to find them.
    if (createRes.status === 422) {
      if (normalizedPhone) {
        const retryPhone = await searchByQuery(`phone:${normalizedPhone}`);
        if (retryPhone.ok && retryPhone.customer?.id) {
          return { id: retryPhone.customer.id };
        }
      }
      if (last10) {
        const retryLast10 = await searchByQuery(`phone:${last10}`);
        if (retryLast10.ok && retryLast10.customer?.id) {
          return { id: retryLast10.customer.id };
        }
      }
      if (email) {
        const retryEmail = await searchByQuery(`email:${email}`);
        if (retryEmail.ok && retryEmail.customer?.id) {
          return { id: retryEmail.customer.id };
        }
      }
    }

    return { id: null, error: `create ${createRes.status}: ${errBody}`.slice(0, 400) };
  } catch (err) {
    return { id: null, error: `create network: ${String(err)}`.slice(0, 400) };
  }
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
    const {
      customerName, customerPhone, customerEmail, location, preferredDate,
      pickupTime, note, lineItems, totalPrice, discountCode,
      orderSource = 'customer_checkout',
      createdBySellerId = null,
      sellerName = null,
      existingOrderId = null,
    } = body;

    // Only enforce required fields for NEW orders. Resyncs (existingOrderId)
    // reuse the already-persisted row, so missing/empty payload fields are fine.
    if (!existingOrderId) {
      if (!customerName || !customerPhone || !location || !preferredDate || !lineItems?.length) {
        return new Response(
          JSON.stringify({ error: "Missing required fields: name, phone, location, date, and items are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }


    console.log(`[${orderSource}] Creating order for:`, customerName, "phone:", customerPhone, "at", location);

    // ============================================================
    // Match returning customer by normalized phone (primary key).
    // Never overwrites the profile's name — the customer typing a
    // different name should not create a duplicate identity.
    // ============================================================
    const canonicalPhone = normalizePhone(customerPhone);
    let matchedCustomerUserId: string | null = null;
    let matchedShopifyCustomerId: string | null = null;
    if (canonicalPhone) {
      const { data: matchedProfile, error: matchErr } = await supabase
        .from("customer_profiles")
        .select("user_id, shopify_customer_id")
        .eq("phone", canonicalPhone)
        .maybeSingle();
      if (matchErr) {
        console.warn("customer_profiles phone match failed (non-fatal):", matchErr.message);
      } else if (matchedProfile?.user_id) {
        matchedCustomerUserId = matchedProfile.user_id;
        matchedShopifyCustomerId = matchedProfile.shopify_customer_id || null;
        console.log(
          "Matched returning customer by phone:", canonicalPhone,
          "user_id:", matchedCustomerUserId,
          "shopify_customer_id:", matchedShopifyCustomerId,
        );
      }
    }

    // Separate Shopify and Lovable products
    const shopifyItems = lineItems.filter(item => 
      !item.source || item.source === 'shopify' || item.variant_id.startsWith('gid://shopify/')
    );
    const lovableItems = lineItems.filter(item => 
      item.source === 'lovable' || item.variant_id.startsWith('lovable-variant-')
    );

    console.log(`Processing ${shopifyItems.length} Shopify items and ${lovableItems.length} Lovable items`);

    // ============================================================
    // Save / load local order (idempotency)
    // ============================================================
    let localOrder: any = null;

    if (existingOrderId) {
      const { data: existing, error: existingErr } = await supabase
        .from("orders").select("*").eq("id", existingOrderId).single();
      if (existingErr || !existing) {
        return new Response(
          JSON.stringify({ error: `Order not found: ${existingOrderId}` }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      localOrder = existing;
      console.log("Resyncing existing order:", localOrder.id, "draft:", localOrder.shopify_draft_order_id);
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from("orders")
        .insert({
          customer_name: customerName,
          customer_phone: canonicalPhone ?? customerPhone,
          customer_email: customerEmail || null,
          customer_user_id: matchedCustomerUserId,
          location: location,
          preferred_date: preferredDate,
          pickup_time: pickupTime || null,
          note: note || null,
          total_price: totalPrice,
          currency_code: "XCD",
          line_items: lineItems,
          status: "pending",
          order_source: orderSource,
          created_by_seller_id: createdBySellerId,
          communication_status: 'pending_whatsapp',
          shopify_sync_status: 'not_synced',
        })
        .select("*")
        .single();

      if (insertError) {
        console.error("Database error:", insertError);
        throw new Error(`Failed to create order: ${insertError.message}`);
      }
      localOrder = inserted;
      console.log("Local order created:", localOrder.id, "linked user:", matchedCustomerUserId ?? "(guest)");
    }


    // ============================================================
    // Create order_items (skip when resyncing existing order)
    // ============================================================
    if (!existingOrderId) {

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
    } // end if (!existingOrderId)

    let draftOrder = null;

    // Create Shopify draft order when:
    // - Admin token is configured AND
    // - There are Shopify items, OR the order originates from the seller dashboard with lovable items
    const isSellerCreated = orderSource === 'seller_dashboard';
    const shouldCreateDraft = !!shopifyAdminToken && (shopifyItems.length > 0 || (isSellerCreated && lovableItems.length > 0));
    if (shouldCreateDraft) {
      try {
        const firstName = customerName.split(' ')[0];
        const lastName = customerName.split(' ').slice(1).join(' ') || '';
        const normalizedPhone = normalizePhone(customerPhone);

        // ========== CUSTOMER LOOKUP/CREATE (phone-primary, email-secondary) ==========
        const customerResult = await findOrCreateShopifyCustomer(
          shopifyAdminToken, firstName, lastName, customerPhone, customerEmail || null,
          matchedShopifyCustomerId,
        );

        const shopifyCustomerId = customerResult.id;

        // If customer sync hard-failed, refuse to create a draft with no/wrong customer.
        // Record the failure on the order so it's visible in the same shopify sync columns.
        if (!shopifyCustomerId) {
          const errMsg = `customer_sync_failed: ${customerResult.error ?? "unknown"}`.slice(0, 500);
          console.error("Shopify customer sync failed — skipping draft order:", errMsg);
          await supabase.from("orders").update({
            shopify_sync_status: 'customer_sync_failed',
            shopify_sync_error: errMsg,
            updated_at: new Date().toISOString(),
          }).eq("id", localOrder.id);
          await supabase.from("order_events").insert({
            order_id: localOrder.id,
            event_type: 'shopify_sync_failed',
            event_payload: { operation: 'customer_sync', error: customerResult.error ?? null },
          });
          // Fall through past the draft creation block by throwing into the outer catch,
          // which is a no-op here (we've already recorded), so use an explicit skip.
          throw new Error('__skip_draft_customer_sync_failed__');
        }


        // ========== BUILD NOTE (per spec, source-aware) ==========
        const intro = isSellerCreated
          ? 'Created by seller from Luut SLU seller dashboard. Awaiting customer confirmation.'
          : 'Created from Luut SLU website checkout. Awaiting WhatsApp confirmation.';
        let shopifyNote = `${intro}\n\n`;
        shopifyNote += `Website Order ID: ${localOrder.id}\n`;
        shopifyNote += `Order #: #L${String(localOrder.order_number).padStart(4, '0')}\n`;
        shopifyNote += `👤 Customer: ${customerName}\n`;
        shopifyNote += `📱 Phone: ${normalizedPhone}\n`;
        shopifyNote += `📍 Pickup: ${location}\n`;
        shopifyNote += `📅 Date: ${preferredDate}`;
        if (pickupTime) shopifyNote += ` ⏰ ${pickupTime}`;
        if (isSellerCreated && sellerName) {
          shopifyNote += `\n🏪 Seller: ${sellerName}`;
          if (createdBySellerId) shopifyNote += ` (${createdBySellerId})`;
        }
        shopifyNote += `\nCommunication: pending_whatsapp`;
        if (note) shopifyNote += `\n📝 Note: ${note}`;
        if (discountCode) shopifyNote += `\n🏷️ Discount Code: ${discountCode}`;
        shopifyNote += `\n💳 Payment: Pay on pickup`;
        if (lovableItems.length > 0 && !isSellerCreated) {
          shopifyNote += `\n\n⚠️ This order also contains ${lovableItems.length} local seller product(s) not in Shopify.`;
        }

        // ========== TAGS (per spec) ==========
        const tagSet = new Set<string>([
          'Website Order',
          'Luut SLU',
          'Pending WhatsApp Confirmation',
          'Pickup',
          `pickup-${location.toLowerCase().replace(/\s+/g, '-').slice(0, 25)}`,
        ]);
        if (isSellerCreated) {
          tagSet.add('Seller Created Order');
          if (sellerName) tagSet.add(`Seller: ${sellerName}`);
        } else {
          tagSet.add('Customer Checkout');
        }
        if (discountCode) tagSet.add(`discount-${discountCode.toLowerCase()}`);

        // ========== LINE ITEMS ==========
        // Shopify products → variant_id line items
        const shopifyLineItems: any[] = shopifyItems.map(item => {
          const variantIdMatch = item.variant_id.match(/\/(\d+)$/);
          const variantId = variantIdMatch ? variantIdMatch[1] : item.variant_id;
          return { variant_id: parseInt(variantId), quantity: item.quantity };
        });
        // For seller-dashboard orders, include Lovable products as CUSTOM line items
        // (title + price, no variant_id) so they appear on the draft.
        if (isSellerCreated && lovableItems.length > 0) {
          for (const item of lovableItems) {
            shopifyLineItems.push({
              title: item.title,
              price: item.price,
              quantity: item.quantity,
              requires_shipping: false,
              taxable: false,
              properties: [
                { name: "Source", value: "Luut SLU local seller product" },
                ...(item.vendor ? [{ name: "Vendor", value: item.vendor }] : []),
              ],
            });
          }
        }

        // ========== STRUCTURED NOTE ATTRIBUTES (appear as "Additional details" in Shopify draft) ==========
        const noteAttributes: Array<{ name: string; value: string }> = [
          { name: "Pickup Location", value: location },
          { name: "Pickup Date", value: preferredDate },
          { name: "Customer Name", value: customerName },
          { name: "Customer Phone", value: normalizedPhone },
          { name: "Order Source", value: orderSource },
          { name: "Website Order ID", value: localOrder.id },
          { name: "Website Order #", value: `#L${String(localOrder.order_number).padStart(4, '0')}` },
          { name: "Payment", value: "Pay on pickup" },
          { name: "Communication Status", value: "pending_whatsapp" },
        ];
        if (pickupTime) noteAttributes.push({ name: "Pickup Time", value: pickupTime });
        if (customerEmail) noteAttributes.push({ name: "Customer Email", value: customerEmail });
        if (note) noteAttributes.push({ name: "Customer Note", value: note });
        if (discountCode) noteAttributes.push({ name: "Discount Code", value: discountCode });
        if (isSellerCreated && sellerName) noteAttributes.push({ name: "Seller", value: sellerName });
        if (createdBySellerId) noteAttributes.push({ name: "Seller ID", value: createdBySellerId });

        // ========== BUILD PAYLOAD ==========
        const draftOrderPayload: any = {
          draft_order: {
            line_items: shopifyLineItems,
            note: shopifyNote,
            email: customerEmail || undefined,
            phone: normalizedPhone,
            customer: shopifyCustomerId ? { id: shopifyCustomerId } : {
              first_name: firstName,
              last_name: lastName,
              phone: normalizedPhone,
              email: customerEmail || undefined,
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
            billing_address: {
              first_name: firstName,
              last_name: lastName,
              phone: normalizedPhone,
              address1: "Pickup",
              city: location,
              country: "Saint Lucia",
              country_code: "LC",
            },
            use_customer_default_address: false,
            tags: Array.from(tagSet).join(', '),
            note_attributes: noteAttributes,
            metafields: [
              { namespace: "pickup", key: "location", value: location, type: "single_line_text_field" },
              { namespace: "pickup", key: "date", value: preferredDate, type: "single_line_text_field" },
              { namespace: "pickup", key: "phone", value: normalizedPhone, type: "single_line_text_field" },
              { namespace: "luut", key: "order_source", value: orderSource, type: "single_line_text_field" },
              { namespace: "luut", key: "website_order_id", value: localOrder.id, type: "single_line_text_field" },
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
          } else {
            console.warn(`Could not resolve discount "${discountCode}" — draft order will be created without discount`);
          }
        }

        // ========== CREATE OR UPDATE DRAFT ORDER (idempotent) ==========
        const existingDraftId = localOrder.shopify_draft_order_id;
        const isUpdate = !!existingDraftId;
        const shopifyUrl = isUpdate
          ? `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/draft_orders/${existingDraftId}.json`
          : `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/draft_orders.json`;
        console.log(`${isUpdate ? 'Updating' : 'Creating'} Shopify Draft Order...`);

        const shopifyResponse = await fetch(shopifyUrl, {
          method: isUpdate ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": shopifyAdminToken,
          },
          body: JSON.stringify(draftOrderPayload),
        });

        const shopifyData = await shopifyResponse.json();

        if (shopifyResponse.ok && shopifyData.draft_order) {
          draftOrder = shopifyData.draft_order;
          console.log("Shopify draft order ok:", draftOrder.id, draftOrder.name);

          // Persist draft metadata back to website order
          await supabase.from("orders").update({
            shopify_draft_order_id: String(draftOrder.id),
            shopify_draft_order_name: draftOrder.name || null,
            shopify_draft_order_invoice_url: draftOrder.invoice_url || null,
            shopify_sync_status: isUpdate ? 'draft_updated' : 'draft_created',
            shopify_sync_error: null,
            shopify_synced_at: new Date().toISOString(),
          }).eq("id", localOrder.id);

          // Backfill shopify_customer_id on the matched profile so future
          // orders can hit the fast-path.
          if (matchedCustomerUserId && shopifyCustomerId && !matchedShopifyCustomerId) {
            await supabase
              .from("customer_profiles")
              .update({ shopify_customer_id: String(shopifyCustomerId) })
              .eq("user_id", matchedCustomerUserId);
          }

        } else {
          const errMsg = JSON.stringify(shopifyData?.errors || shopifyData).slice(0, 500);
          console.error("Shopify API error:", errMsg);
          await supabase.from("orders").update({
            shopify_sync_status: 'draft_failed',
            shopify_sync_error: errMsg,
          }).eq("id", localOrder.id);
        }
      } catch (shopifyError) {
        const errMsg = shopifyError instanceof Error ? shopifyError.message : String(shopifyError);
        // Customer-sync-failed skip signal: preserve the more specific status we already wrote.
        if (errMsg === '__skip_draft_customer_sync_failed__') {
          console.log("Draft order skipped due to customer sync failure (already recorded).");
        } else {
          console.error("Shopify draft order creation failed:", errMsg);
          await supabase.from("orders").update({
            shopify_sync_status: 'draft_failed',
            shopify_sync_error: errMsg,
          }).eq("id", localOrder.id);
        }
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
          shopifyDraftOrderId: draftOrder?.id ? String(draftOrder.id) : null,
          shopifyDraftOrderName: draftOrder?.name || null,
          shopifyInvoiceUrl: draftOrder?.invoice_url || null,
        },
        localOrderId: localOrder.id,
        localOrderToken: localOrder.order_token,
        orderSource,
        shopifySyncStatus: draftOrder ? (localOrder.shopify_draft_order_id ? 'draft_updated' : 'draft_created') : (shopifyAdminToken && (shopifyItems.length > 0 || orderSource === 'seller_dashboard') ? 'draft_failed' : 'not_synced'),
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
