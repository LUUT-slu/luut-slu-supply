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
    const shopifyAdminToken = Deno.env.get("SHOPIFY_ADMIN_TOKEN");
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

    // Search for discount code via Shopify Admin API
    // First, look up the discount code to find its price rule
    const searchUrl = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/discount_codes/lookup.json?code=${encodeURIComponent(trimmedCode)}`;

    const searchResponse = await fetch(searchUrl, {
      method: "GET",
      headers: {
        "X-Shopify-Access-Token": shopifyAdminToken,
      },
      redirect: "follow",
    });

    if (searchResponse.status === 404) {
      return new Response(
        JSON.stringify({ valid: false, error: "Invalid discount code" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!searchResponse.ok) {
      console.error("Shopify lookup error:", searchResponse.status);
      return new Response(
        JSON.stringify({ valid: false, error: "Could not validate discount code" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const discountData = await searchResponse.json();
    const discountCode = discountData.discount_code;

    if (!discountCode) {
      return new Response(
        JSON.stringify({ valid: false, error: "Invalid discount code" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch the associated price rule for details
    const priceRuleId = discountCode.price_rule_id;
    const priceRuleUrl = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/price_rules/${priceRuleId}.json`;

    const priceRuleResponse = await fetch(priceRuleUrl, {
      method: "GET",
      headers: {
        "X-Shopify-Access-Token": shopifyAdminToken,
      },
    });

    if (!priceRuleResponse.ok) {
      return new Response(
        JSON.stringify({ valid: false, error: "Could not retrieve discount details" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const priceRuleData = await priceRuleResponse.json();
    const priceRule = priceRuleData.price_rule;

    // Check if discount is currently active
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

    // Check usage limits
    if (priceRule.usage_limit && discountCode.usage_count >= priceRule.usage_limit) {
      return new Response(
        JSON.stringify({ valid: false, error: "This discount has reached its usage limit" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Return discount info
    return new Response(
      JSON.stringify({
        valid: true,
        discount: {
          code: trimmedCode,
          title: priceRule.title,
          valueType: priceRule.value_type, // "percentage" or "fixed_amount"
          value: priceRule.value, // e.g. "-10.0" for 10% off or "-5.00" for $5 off
          targetType: priceRule.target_type, // "line_item" or "shipping_line"
          targetSelection: priceRule.target_selection, // "all" or "entitled"
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
