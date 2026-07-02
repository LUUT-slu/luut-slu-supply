import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SHOPIFY_STORE_DOMAIN = "lovable-project-yf43m.myshopify.com";
const SHOPIFY_API_VERSION = "2025-01";

async function verifyAdmin(req: Request): Promise<boolean> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return false;
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  try {
    const token = authHeader.replace("Bearer ", "");
    const { data: userRes, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userRes?.user) return false;
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userRes.user.id);
    return roles?.some((r: any) => r.role === "admin") || false;
  } catch {
    return false;
  }
}

function getAdminToken(): string | null {
  return Deno.env.get("SHOPIFY_ADMIN_TOKEN") || null;
}

async function shopifyql(token: string, query: string) {
  const url = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;
  const gql = `
    query RunQL($q: String!) {
      shopifyqlQuery(query: $q) {
        __typename
        ... on TableResponse {
          tableData {
            rowData
            columns { name dataType }
          }
          parseErrors { code message range { start { line character } end { line character } } }
        }
      }
    }
  `;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "X-Shopify-Access-Token": token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: gql, variables: { q: query } }),
  });
  const body = await res.text();
  let json: any;
  try {
    json = JSON.parse(body);
  } catch {
    return { ok: false, status: res.status, error: body.slice(0, 500) };
  }
  if (!res.ok || json.errors) {
    return {
      ok: false,
      status: res.status,
      error: json.errors ?? body.slice(0, 500),
    };
  }
  const payload = json.data?.shopifyqlQuery;
  if (payload?.parseErrors?.length) {
    return { ok: false, status: 200, error: payload.parseErrors, query };
  }
  const columns = (payload?.tableData?.columns || []).map((c: any) => c.name);
  const rows: any[] = (payload?.tableData?.rowData || []).map((row: string[]) => {
    const obj: Record<string, any> = {};
    columns.forEach((name: string, i: number) => (obj[name] = row[i]));
    return obj;
  });
  return { ok: true, columns, rows, query };
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

    const token = getAdminToken();
    if (!token) {
      return new Response(
        JSON.stringify({ error: "SHOPIFY_ADMIN_TOKEN not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Build queries for two windows.
    const windows = [
      { key: "last_7_days", since: "-7d" },
      { key: "last_30_days", since: "-30d" },
    ];

    const result: Record<string, any> = {
      store_domain: SHOPIFY_STORE_DOMAIN,
      api_version: SHOPIFY_API_VERSION,
      fetched_at: new Date().toISOString(),
    };

    for (const w of windows) {
      const totalsQ =
        `FROM sales SHOW total_sales, orders SINCE ${w.since} UNTIL today`;
      const topQ =
        `FROM sales SHOW total_sales, orders GROUP BY product_title ` +
        `ORDER BY total_sales DESC SINCE ${w.since} UNTIL today LIMIT 5`;

      const [totals, top] = await Promise.all([
        shopifyql(token, totalsQ),
        shopifyql(token, topQ),
      ]);

      if (!totals.ok) {
        return new Response(
          JSON.stringify({
            error: "Shopify analytics query failed",
            window: w.key,
            query: totalsQ,
            shopify_error: totals.error,
            status: totals.status,
          }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (!top.ok) {
        return new Response(
          JSON.stringify({
            error: "Shopify analytics query failed (top products)",
            window: w.key,
            query: topQ,
            shopify_error: top.error,
            status: top.status,
          }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const totalsRow = totals.rows[0] || {};
      result[w.key] = {
        total_sales: Number(totalsRow.total_sales ?? 0),
        order_count: Number(totalsRow.orders ?? 0),
        top_products: top.rows.map((r: any) => ({
          product_title: r.product_title,
          total_sales: Number(r.total_sales ?? 0),
          orders: Number(r.orders ?? 0),
        })),
      };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("shopify-analytics error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
