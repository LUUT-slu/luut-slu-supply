import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SHOPIFY_STORE_DOMAIN = "lovable-project-yf43m.myshopify.com";
const SHOPIFY_API_VERSION = "2025-01";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const shopifyAdminToken = Deno.env.get("SHOPIFY_ADMIN_TOKEN") || Deno.env.get("SHOPIFY_ACCESS_TOKEN");

    if (!shopifyAdminToken) {
      return new Response(
        JSON.stringify({ valid: false, error: "Discount validation not available" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { code } = await req.json();
    if (!code || typeof code !== "string") {
      return new Response(
        JSON.stringify({ valid: false, error: "Discount code is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const trimmedCode = code.trim().toUpperCase();
    const shopifyHeaders = {
      "X-Shopify-Access-Token": shopifyAdminToken,
      "Content-Type": "application/json",
    };

    // Step 1: Dynamic lookup — resolve discount code to its price rule
    const lookupUrl = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/discount_codes/lookup.json?code=${encodeURIComponent(trimmedCode)}`;
    console.log("Looking up discount code:", trimmedCode);

    const lookupRes = await fetch(lookupUrl, {
      method: "GET",
      headers: shopifyHeaders,
      redirect: "manual", // lookup returns a 303 redirect
    });

    console.log("Lookup response status:", lookupRes.status);

    let priceRuleId: string | null = null;

    if (lookupRes.status === 303) {
      // Extract price rule ID from the Location header redirect URL
      const location = lookupRes.headers.get("location");
      console.log("Redirect location:", location);
      if (location) {
        const match = location.match(/price_rules\/(\d+)/);
        if (match) priceRuleId = match[1];
      }
    } else if (lookupRes.ok) {
      // Some API versions return the discount code directly
      const lookupData = await lookupRes.json();
      if (lookupData.discount_code?.price_rule_id) {
        priceRuleId = String(lookupData.discount_code.price_rule_id);
      }
    } else {
      const errBody = await lookupRes.text();
      console.error("Lookup failed:", lookupRes.status, errBody);

      if (lookupRes.status === 404) {
        return new Response(
          JSON.stringify({ valid: false, error: "Invalid discount code" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ valid: false, error: "Could not validate discount code" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!priceRuleId) {
      return new Response(
        JSON.stringify({ valid: false, error: "Invalid discount code" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 2: Fetch the price rule details
    const priceRuleUrl = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/price_rules/${priceRuleId}.json`;
    console.log("Fetching price rule:", priceRuleId);

    const priceRuleResponse = await fetch(priceRuleUrl, {
      method: "GET",
      headers: shopifyHeaders,
    });

    if (!priceRuleResponse.ok) {
      const errorBody = await priceRuleResponse.text();
      console.error("Price rule fetch error:", priceRuleResponse.status, errorBody);
      return new Response(
        JSON.stringify({ valid: false, error: "Could not validate discount code" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const priceRuleData = await priceRuleResponse.json();
    const priceRule = priceRuleData.price_rule;

    // Step 3: Check if discount is currently active
    const now = new Date();
    if (priceRule.starts_at && new Date(priceRule.starts_at) > now) {
      return new Response(
        JSON.stringify({ valid: false, error: "This discount is not yet active" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (priceRule.ends_at && new Date(priceRule.ends_at) < now) {
      return new Response(
        JSON.stringify({ valid: false, error: "This discount has expired" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        valid: true,
        discount: {
          code: trimmedCode,
          title: priceRule.title,
          valueType: priceRule.value_type,
          value: priceRule.value,
          targetType: priceRule.target_type,
          targetSelection: priceRule.target_selection,
          prerequisiteSubtotalMin: priceRule.prerequisite_subtotal_range?.greater_than_or_equal_to || null,
          oncePerCustomer: priceRule.once_per_customer,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Discount validation error:", error);
    return new Response(
      JSON.stringify({ valid: false, error: "Failed to validate discount code" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
