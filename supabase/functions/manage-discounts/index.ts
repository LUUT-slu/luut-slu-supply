import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SHOPIFY_STORE_DOMAIN = "lovable-project-yf43m.myshopify.com";
const SHOPIFY_API_VERSION = "2025-01";

function getShopifyHeaders() {
  const token = Deno.env.get("SHOPIFY_ADMIN_TOKEN") || Deno.env.get("SHOPIFY_ACCESS_TOKEN");
  if (!token) throw new Error("Shopify admin token not configured");
  return {
    "X-Shopify-Access-Token": token,
    "Content-Type": "application/json",
  };
}

function shopifyUrl(path: string) {
  return `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}${path}`;
}

async function verifyAdmin(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) throw new Error("Unauthorized");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { authorization: authHeader } } }
  );

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Unauthorized");

  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  if (!roles?.some((r: any) => r.role === "admin")) throw new Error("Admin access required");

  return user;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    await verifyAdmin(req);
    const headers = getShopifyHeaders();

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // ─── LIST ALL PRICE RULES + THEIR DISCOUNT CODES ───
    if (req.method === "GET" && action === "list") {
      const prRes = await fetch(shopifyUrl("/price_rules.json?limit=50"), { headers });
      if (!prRes.ok) {
        const err = await prRes.text();
        console.error("Shopify list error:", err);
        throw new Error("Failed to fetch price rules from Shopify");
      }
      const { price_rules } = await prRes.json();

      // Fetch discount codes for each price rule
      const enriched = await Promise.all(
        (price_rules || []).map(async (pr: any) => {
          try {
            const codeRes = await fetch(
              shopifyUrl(`/price_rules/${pr.id}/discount_codes.json`),
              { headers }
            );
            const { discount_codes } = codeRes.ok ? await codeRes.json() : { discount_codes: [] };
            return { ...pr, discount_codes: discount_codes || [] };
          } catch {
            return { ...pr, discount_codes: [] };
          }
        })
      );

      return new Response(JSON.stringify({ price_rules: enriched }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── CREATE PRICE RULE + DISCOUNT CODE ───
    if (req.method === "POST" && action === "create") {
      const body = await req.json();
      const {
        title, code, value_type, value, target_type = "line_item",
        target_selection = "all", once_per_customer = true,
        usage_limit, starts_at, ends_at, enabled = true,
      } = body;

      const priceRulePayload = {
        price_rule: {
          title,
          value_type,
          value: String(value).startsWith("-") ? value : `-${value}`,
          customer_selection: "all",
          target_type,
          target_selection,
          allocation_method: target_type === "line_item" ? "across" : "each",
          once_per_customer,
          usage_limit: usage_limit || null,
          starts_at: starts_at || new Date().toISOString(),
          ends_at: ends_at || null,
        },
      };

      const prRes = await fetch(shopifyUrl("/price_rules.json"), {
        method: "POST",
        headers,
        body: JSON.stringify(priceRulePayload),
      });

      if (!prRes.ok) {
        const err = await prRes.text();
        console.error("Create price rule error:", err);
        throw new Error("Failed to create price rule in Shopify");
      }

      const { price_rule } = await prRes.json();

      // Create discount code
      const codeRes = await fetch(
        shopifyUrl(`/price_rules/${price_rule.id}/discount_codes.json`),
        {
          method: "POST",
          headers,
          body: JSON.stringify({ discount_code: { code: code.toUpperCase() } }),
        }
      );

      let discount_code = null;
      if (codeRes.ok) {
        const codeData = await codeRes.json();
        discount_code = codeData.discount_code;
      }

      return new Response(
        JSON.stringify({ success: true, price_rule, discount_code }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── UPDATE PRICE RULE ───
    if (req.method === "PUT" && action === "update") {
      const body = await req.json();
      const { price_rule_id, ...updates } = body;

      if (updates.value && !String(updates.value).startsWith("-")) {
        updates.value = `-${updates.value}`;
      }

      const prRes = await fetch(shopifyUrl(`/price_rules/${price_rule_id}.json`), {
        method: "PUT",
        headers,
        body: JSON.stringify({ price_rule: updates }),
      });

      if (!prRes.ok) {
        const err = await prRes.text();
        console.error("Update price rule error:", err);
        throw new Error("Failed to update price rule");
      }

      const { price_rule } = await prRes.json();
      return new Response(
        JSON.stringify({ success: true, price_rule }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── TOGGLE (enable/disable via dates) ───
    if (req.method === "PUT" && action === "toggle") {
      const { price_rule_id, enabled } = await req.json();

      const updatePayload: any = {};
      if (!enabled) {
        // Disable by setting ends_at to past
        updatePayload.ends_at = new Date(Date.now() - 60000).toISOString();
      } else {
        // Enable by removing ends_at
        updatePayload.ends_at = null;
        updatePayload.starts_at = new Date().toISOString();
      }

      const prRes = await fetch(shopifyUrl(`/price_rules/${price_rule_id}.json`), {
        method: "PUT",
        headers,
        body: JSON.stringify({ price_rule: updatePayload }),
      });

      if (!prRes.ok) throw new Error("Failed to toggle discount");

      return new Response(
        JSON.stringify({ success: true, enabled }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── DELETE PRICE RULE ───
    if (req.method === "DELETE" && action === "delete") {
      const { price_rule_id } = await req.json();

      const prRes = await fetch(shopifyUrl(`/price_rules/${price_rule_id}.json`), {
        method: "DELETE",
        headers,
      });

      if (!prRes.ok && prRes.status !== 404) throw new Error("Failed to delete price rule");

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("manage-discounts error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
