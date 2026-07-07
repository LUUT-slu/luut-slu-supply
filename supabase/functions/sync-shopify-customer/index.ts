import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { normalizePhone } from "../_shared/phone.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SHOPIFY_DOMAIN = "lovable-project-yf43m.myshopify.com";
const SHOPIFY_API_VERSION = "2025-07";


async function searchShopifyCustomer(
  domain: string,
  token: string,
  version: string,
  query: string,
): Promise<{ ok: boolean; customer?: any; error?: string }> {
  try {
    const res = await fetch(
      `https://${domain}/admin/api/${version}/customers/search.json?query=${encodeURIComponent(query)}`,
      { headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json" } },
    );
    if (!res.ok) {
      const body = await res.text();
      return { ok: false, error: `search "${query}" ${res.status}: ${body}`.slice(0, 400) };
    }
    const data = await res.json();
    return { ok: true, customer: data?.customers?.[0] ?? null };
  } catch (err) {
    return { ok: false, error: `search "${query}" network: ${String(err)}`.slice(0, 400) };
  }
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SHOPIFY_TOKEN = Deno.env.get("SHOPIFY_ADMIN_TOKEN");

    if (!SHOPIFY_TOKEN) {
      return new Response(
        JSON.stringify({ error: "SHOPIFY_ADMIN_TOKEN not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Authenticate caller
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace("Bearer ", "");
    const supabaseAuth = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: userRes, error: userErr } = await supabaseAuth.auth.getUser(jwt);
    if (userErr || !userRes?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const targetUserId = body.user_id ?? userRes.user.id;
    if (targetUserId !== userRes.user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: profile, error: profErr } = await admin
      .from("customer_profiles")
      .select("user_id, email, full_name, phone, shopify_customer_id")
      .eq("user_id", targetUserId)
      .maybeSingle();

    if (profErr || !profile) {
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!profile.email) {
      return new Response(JSON.stringify({ error: "Email required for Shopify sync" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [firstName, ...rest] = (profile.full_name ?? "").trim().split(/\s+/);
    const lastName = rest.join(" ") || null;
    const normalizedPhone = normalizePhone(profile.phone);

    const customerPayload: Record<string, unknown> = {
      email: profile.email,
      first_name: firstName || null,
      last_name: lastName,
      phone: normalizedPhone,
      tags: "lovable-signup",
      accepts_marketing: false,
    };

    let shopifyCustomerId = profile.shopify_customer_id;
    let response: Response;

    if (shopifyCustomerId) {
      response = await fetch(
        `https://${SHOPIFY_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/customers/${shopifyCustomerId}.json`,
        {
          method: "PUT",
          headers: {
            "X-Shopify-Access-Token": SHOPIFY_TOKEN,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ customer: { id: Number(shopifyCustomerId), ...customerPayload } }),
        }
      );
    } else {
      // Phone-primary lookup, email-secondary. Prevents duplicate customers for repeat orderers.
      if (normalizedPhone) {
        const phoneSearch = await searchShopifyCustomer(
          SHOPIFY_DOMAIN, SHOPIFY_TOKEN, SHOPIFY_API_VERSION, `phone:${normalizedPhone}`,
        );
        if (!phoneSearch.ok) {
          console.error("[sync-shopify-customer] phone search failed:", phoneSearch.error);
          return new Response(
            JSON.stringify({ error: "Shopify customer lookup failed", detail: phoneSearch.error }),
            { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        if (phoneSearch.customer?.id) shopifyCustomerId = String(phoneSearch.customer.id);
      }

      if (!shopifyCustomerId && profile.email) {
        const emailSearch = await searchShopifyCustomer(
          SHOPIFY_DOMAIN, SHOPIFY_TOKEN, SHOPIFY_API_VERSION, `email:${profile.email}`,
        );
        if (!emailSearch.ok) {
          console.error("[sync-shopify-customer] email search failed:", emailSearch.error);
          return new Response(
            JSON.stringify({ error: "Shopify customer lookup failed", detail: emailSearch.error }),
            { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        if (emailSearch.customer?.id) shopifyCustomerId = String(emailSearch.customer.id);
      }

      if (shopifyCustomerId) {
        response = await fetch(
          `https://${SHOPIFY_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/customers/${shopifyCustomerId}.json`,
          {
            method: "PUT",
            headers: {
              "X-Shopify-Access-Token": SHOPIFY_TOKEN,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ customer: { id: Number(shopifyCustomerId), ...customerPayload } }),
          }
        );
      } else {
        response = await fetch(
          `https://${SHOPIFY_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/customers.json`,
          {
            method: "POST",
            headers: {
              "X-Shopify-Access-Token": SHOPIFY_TOKEN,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ customer: customerPayload }),
          }
        );
      }
    }


    const responseText = await response.text();
    if (!response.ok) {
      console.error("[sync-shopify-customer] Shopify error", response.status, responseText);
      return new Response(
        JSON.stringify({ error: "Shopify request failed", status: response.status, detail: responseText }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const json = JSON.parse(responseText);
    const newId = String(json?.customer?.id ?? shopifyCustomerId ?? "");
    if (newId && newId !== profile.shopify_customer_id) {
      await admin
        .from("customer_profiles")
        .update({ shopify_customer_id: newId })
        .eq("user_id", targetUserId);
    }

    return new Response(JSON.stringify({ ok: true, shopify_customer_id: newId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[sync-shopify-customer] error", e);
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
