import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SHOPIFY_STORE_DOMAIN = "lovable-project-yf43m.myshopify.com";
const SHOPIFY_API_VERSION = "2025-07";
const MAX_PAGES = 20; // safety cap: 20 * 250 = 5000 orders per window

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

function parseNextPageInfo(linkHeader: string | null): string | null {
  if (!linkHeader) return null;
  // Example: <https://.../orders.json?page_info=abc&limit=250>; rel="next"
  const parts = linkHeader.split(",");
  for (const p of parts) {
    const m = p.match(/<([^>]+)>;\s*rel="next"/);
    if (m) {
      const url = new URL(m[1]);
      return url.searchParams.get("page_info");
    }
  }
  return null;
}

interface OrderLine {
  title?: string;
  name?: string;
  quantity?: number;
  price?: string;
  product_id?: number | null;
}

interface Order {
  id: number;
  created_at: string;
  total_price: string;
  currency: string;
  financial_status: string;
  cancelled_at: string | null;
  line_items: OrderLine[];
}

async function fetchOrdersSince(
  token: string,
  sinceIso: string,
): Promise<{ orders: Order[]; error?: any; status?: number }> {
  const collected: Order[] = [];
  const base = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}`;
  const headers = {
    "X-Shopify-Access-Token": token,
    "Content-Type": "application/json",
  };

  // First page uses created_at_min filter; subsequent pages use page_info only.
  let firstUrl =
    `${base}/orders.json?status=any&limit=250` +
    `&created_at_min=${encodeURIComponent(sinceIso)}` +
    `&fields=id,created_at,total_price,currency,financial_status,cancelled_at,line_items`;

  let url: string | null = firstUrl;
  let pages = 0;
  let pageInfo: string | null = null;

  while (url && pages < MAX_PAGES) {
    const res = await fetch(url, { headers });
    if (!res.ok) {
      const body = await res.text();
      return {
        orders: collected,
        status: res.status,
        error: body.slice(0, 500),
      };
    }
    const json = await res.json();
    const batch: Order[] = json.orders || [];
    collected.push(...batch);
    pages += 1;
    pageInfo = parseNextPageInfo(res.headers.get("link"));
    url = pageInfo
      ? `${base}/orders.json?limit=250&page_info=${encodeURIComponent(pageInfo)}`
      : null;
  }
  return { orders: collected };
}

function aggregate(orders: Order[]) {
  let totalSales = 0;
  let orderCount = 0;
  const byProduct = new Map<
    string,
    { product_title: string; product_id: number | null; total_sales: number; units: number }
  >();

  for (const o of orders) {
    if (o.cancelled_at) continue;
    orderCount += 1;
    totalSales += Number(o.total_price || 0);
    for (const li of o.line_items || []) {
      const title = li.title || li.name || "Unknown";
      const qty = Number(li.quantity || 0);
      const revenue = Number(li.price || 0) * qty;
      const key = String(li.product_id ?? title);
      const cur =
        byProduct.get(key) ||
        { product_title: title, product_id: li.product_id ?? null, total_sales: 0, units: 0 };
      cur.total_sales += revenue;
      cur.units += qty;
      byProduct.set(key, cur);
    }
  }

  const topProducts = Array.from(byProduct.values())
    .sort((a, b) => b.total_sales - a.total_sales)
    .slice(0, 5);

  return { total_sales: totalSales, order_count: orderCount, top_products: topProducts };
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

    const now = Date.now();
    const since30 = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
    const since7 = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Fetch 30-day window once; 7-day is a subset.
    const { orders, error, status } = await fetchOrdersSince(token, since30);
    if (error) {
      return new Response(
        JSON.stringify({
          error: "Shopify orders fetch failed",
          shopify_status: status,
          shopify_error: error,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const since7Time = new Date(since7).getTime();
    const last7 = orders.filter(
      (o) => new Date(o.created_at).getTime() >= since7Time,
    );

    const currency = orders[0]?.currency ?? null;

    const result = {
      store_domain: SHOPIFY_STORE_DOMAIN,
      api_version: SHOPIFY_API_VERSION,
      fetched_at: new Date().toISOString(),
      currency,
      orders_fetched: orders.length,
      last_7_days: {
        since: since7,
        ...aggregate(last7),
      },
      last_30_days: {
        since: since30,
        ...aggregate(orders),
      },
    };

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
