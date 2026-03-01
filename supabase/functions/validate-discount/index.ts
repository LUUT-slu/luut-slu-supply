import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SHOPIFY_STORE_DOMAIN = "lovable-project-yf43m.myshopify.com";
const SHOPIFY_API_VERSION = "2025-01";

// Known price rules mapped by discount code (workaround for token scope limitation)
const KNOWN_DISCOUNT_CODES: Record<string, { priceRuleId: number }> = {
  "1KPROMO": { priceRuleId: 1879602397289 },
};

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
    const knownCode = KNOWN_DISCOUNT_CODES[trimmedCode];

    if (!knownCode) {
      return new Response(
        JSON.stringify({ valid: false, error: "Invalid discount code" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch price rule details using known ID
    const priceRuleUrl = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/price_rules/${knownCode.priceRuleId}.json`;
    const priceRuleResponse = await fetch(priceRuleUrl, {
      method: "GET",
      headers: { "X-Shopify-Access-Token": shopifyAdminToken },
    });

    if (!priceRuleResponse.ok) {
      console.error("Shopify price_rule error:", priceRuleResponse.status);
      return new Response(
        JSON.stringify({ valid: false, error: "Could not validate discount code" }),
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

    // Return discount info
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
