import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SHOPIFY_STORE_DOMAIN = "lovable-project-yf43m.myshopify.com";
const SHOPIFY_API_VERSION = "2025-01";

interface TestResult {
  name: string;
  status: "pass" | "fail";
  message: string;
  details?: any;
  duration_ms: number;
}

async function verifyAdmin(req: Request): Promise<boolean> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return false;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const token = authHeader.replace("Bearer ", "");
    // Cryptographically verify the JWT via Supabase Auth.
    const { data: userRes, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userRes?.user) return false;
    const userId = userRes.user.id;

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    return roles?.some((r: any) => r.role === "admin") || false;
  } catch {
    return false;
  }
}

// Read token fresh every invocation (no module-level caching).
// Priority: SHOPIFY_ADMIN_TOKEN (shpat_) → never use SHOPIFY_ACCESS_TOKEN (that's a storefront token).
function getShopifyAdminToken(): string | null {
  return Deno.env.get("SHOPIFY_ADMIN_TOKEN") || null;
}

function getShopifyHeaders(): { headers: Record<string, string>; token: string; source: string } | null {
  const token = getShopifyAdminToken();
  if (!token) return null;
  return {
    token,
    source: "SHOPIFY_ADMIN_TOKEN",
    headers: {
      "X-Shopify-Access-Token": token,
      "Content-Type": "application/json",
    },
  };
}

function shopifyUrl(path: string) {
  return `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}${path}`;
}

async function runTest(name: string, fn: () => Promise<{ message: string; details?: any }>): Promise<TestResult> {
  const start = Date.now();
  try {
    const result = await fn();
    return { name, status: "pass", message: result.message, details: result.details, duration_ms: Date.now() - start };
  } catch (error) {
    return { name, status: "fail", message: error.message || "Unknown error", duration_ms: Date.now() - start };
  }
}

async function sha256Short(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 8);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const isAdmin = await verifyAdmin(req);
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const shopify = getShopifyHeaders();
    
    // Also check what SHOPIFY_ACCESS_TOKEN contains for debug comparison
    const storefrontToken = Deno.env.get("SHOPIFY_ACCESS_TOKEN");

    if (!shopify) {
      return new Response(
        JSON.stringify({
          connected: false,
          error: "No SHOPIFY_ADMIN_TOKEN configured. SHOPIFY_ACCESS_TOKEN is a storefront token (shpss) and cannot be used for Admin API.",
          tests: [],
          granted_scopes: [],
          debug_auth: {
            admin_token_present: false,
            storefront_token_present: !!storefrontToken,
            storefront_token_prefix: storefrontToken ? storefrontToken.substring(0, 5) : "N/A",
            shop_domain: SHOPIFY_STORE_DOMAIN,
            note: "SHOPIFY_ACCESS_TOKEN has prefix 'shpss' = Storefront token. Admin API needs 'shpat_' prefix.",
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const url = new URL(req.url);
    const testFilter = url.searchParams.get("test");

    const tokenHash = await sha256Short(shopify.token);
    const debugAuth = {
      token_prefix: shopify.token.substring(0, 5),
      token_length: shopify.token.length,
      token_hash: tokenHash,
      shop_domain: SHOPIFY_STORE_DOMAIN,
      env_var_used: shopify.source,
      header_used: "X-Shopify-Access-Token",
      storefront_token_present: !!storefrontToken,
      storefront_token_prefix: storefrontToken ? storefrontToken.substring(0, 5) : "N/A",
    };

    const allTests: Record<string, () => Promise<{ message: string; details?: any }>> = {
      connection: async () => {
        const res = await fetch(shopifyUrl("/shop.json"), { headers: shopify.headers });
        if (!res.ok) {
          const body = await res.text();
          throw new Error(`HTTP ${res.status}: ${body.substring(0, 200)}`);
        }
        const data = await res.json();
        return { message: `Connected to ${data.shop.name}`, details: { name: data.shop.name, domain: data.shop.domain, plan: data.shop.plan_name } };
      },

      scopes: async () => {
        const res = await fetch(`https://${SHOPIFY_STORE_DOMAIN}/admin/oauth/access_scopes.json`, { headers: shopify.headers });
        if (!res.ok) {
          const body = await res.text();
          throw new Error(`HTTP ${res.status}: ${body.substring(0, 200)}`);
        }
        const data = await res.json();
        const scopes = (data.access_scopes || []).map((s: any) => s.handle);
        return { message: `${scopes.length} scopes granted`, details: { scopes } };
      },

      products: async () => {
        const res = await fetch(shopifyUrl("/products.json?limit=5"), { headers: shopify.headers });
        if (!res.ok) {
          const body = await res.text();
          throw new Error(`HTTP ${res.status}: ${body.substring(0, 200)}`);
        }
        const data = await res.json();
        return { message: `${data.products?.length || 0} products fetched`, details: { count: data.products?.length } };
      },

      discounts: async () => {
        const res = await fetch(shopifyUrl("/price_rules.json?limit=5"), { headers: shopify.headers });
        if (!res.ok) {
          const body = await res.text();
          throw new Error(`HTTP ${res.status}: ${body.substring(0, 200)}`);
        }
        const data = await res.json();
        return { message: `${data.price_rules?.length || 0} price rules fetched`, details: { count: data.price_rules?.length } };
      },

      draft_orders: async () => {
        const res = await fetch(shopifyUrl("/draft_orders.json?limit=1"), { headers: shopify.headers });
        if (!res.ok) {
          const body = await res.text();
          throw new Error(`HTTP ${res.status}: ${body.substring(0, 200)}`);
        }
        const data = await res.json();
        return { message: `Draft orders accessible (${data.draft_orders?.length || 0} found)`, details: { count: data.draft_orders?.length } };
      },

      inventory: async () => {
        const res = await fetch(shopifyUrl("/locations.json"), { headers: shopify.headers });
        if (!res.ok) {
          const body = await res.text();
          throw new Error(`HTTP ${res.status}: ${body.substring(0, 200)}`);
        }
        const data = await res.json();
        return { message: `${data.locations?.length || 0} locations found`, details: { locations: data.locations?.map((l: any) => l.name) } };
      },

      metafields: async () => {
        const res = await fetch(shopifyUrl("/metafields.json?limit=1"), { headers: shopify.headers });
        if (!res.ok) {
          const body = await res.text();
          throw new Error(`HTTP ${res.status}: ${body.substring(0, 200)}`);
        }
        await res.json();
        return { message: "Metafields accessible" };
      },
    };

    const testsToRun = testFilter ? { [testFilter]: allTests[testFilter] } : allTests;
    const results: TestResult[] = [];

    for (const [name, fn] of Object.entries(testsToRun)) {
      if (fn) results.push(await runTest(name, fn));
    }

    const scopesResult = results.find((r) => r.name === "scopes");
    const grantedScopes: string[] = scopesResult?.details?.scopes || [];

    return new Response(
      JSON.stringify({
        connected: results.some((r) => r.name === "connection" && r.status === "pass"),
        store_domain: SHOPIFY_STORE_DOMAIN,
        api_version: SHOPIFY_API_VERSION,
        tested_at: new Date().toISOString(),
        granted_scopes: grantedScopes,
        tests: results,
        debug_auth: debugAuth,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Health check error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
