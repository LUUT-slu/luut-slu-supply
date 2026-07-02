// Grants LUUT loyalty rewards when a customer's order is marked COMPLETED.
// Idempotent — safe to call multiple times per order.
//
// Thresholds:
//   3rd completed order  → LUUT Regular  → EC$5 off code (type: 'regular')
//   5th completed order  → LUUT VIP      → EC$10 off code (type: 'vip')
//   1st completed order + referral row exists → EC$10 off codes for BOTH referrer and referred
//
// The Shopify code is created via the Admin API using the same pattern as
// supabase/functions/manage-discounts/index.ts.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SHOPIFY_STORE_DOMAIN = "lovable-project-yf43m.myshopify.com";
const SHOPIFY_API_VERSION = "2025-01";

function shopifyHeaders() {
  const token = Deno.env.get("SHOPIFY_ADMIN_TOKEN");
  if (!token) throw new Error("SHOPIFY_ADMIN_TOKEN not configured");
  return { "X-Shopify-Access-Token": token, "Content-Type": "application/json" };
}
const shopifyUrl = (p: string) =>
  `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}${p}`;

type RewardType =
  | "regular"
  | "vip"
  | "referral_referrer"
  | "referral_referred";

const REWARD_META: Record<RewardType, { amount: number; prefix: string; title: string }> = {
  regular: { amount: 5, prefix: "REG", title: "LUUT Regular EC$5 Off" },
  vip: { amount: 10, prefix: "VIP", title: "LUUT VIP EC$10 Off" },
  referral_referrer: { amount: 10, prefix: "REFR", title: "LUUT Referral Reward EC$10" },
  referral_referred: { amount: 10, prefix: "REFD", title: "LUUT Welcome Referral EC$10" },
};

async function createShopifyDiscount(
  userId: string,
  type: RewardType,
): Promise<{ code: string; price_rule_id: number }> {
  const meta = REWARD_META[type];
  const short = userId.replace(/-/g, "").slice(0, 8).toUpperCase();
  const code = `LUUT-${meta.prefix}-${short}`;

  const prRes = await fetch(shopifyUrl("/price_rules.json"), {
    method: "POST",
    headers: shopifyHeaders(),
    body: JSON.stringify({
      price_rule: {
        title: `${meta.title} (${short})`,
        value_type: "fixed_amount",
        value: `-${meta.amount}.00`,
        customer_selection: "all",
        target_type: "line_item",
        target_selection: "all",
        allocation_method: "across",
        once_per_customer: false,
        usage_limit: null,
        starts_at: new Date().toISOString(),
      },
    }),
  });
  if (!prRes.ok) {
    throw new Error(`Shopify price_rule failed: ${prRes.status} ${await prRes.text()}`);
  }
  const { price_rule } = await prRes.json();

  const dcRes = await fetch(
    shopifyUrl(`/price_rules/${price_rule.id}/discount_codes.json`),
    {
      method: "POST",
      headers: shopifyHeaders(),
      body: JSON.stringify({ discount_code: { code } }),
    },
  );
  if (!dcRes.ok) {
    throw new Error(`Shopify discount_code failed: ${dcRes.status} ${await dcRes.text()}`);
  }
  return { code, price_rule_id: price_rule.id as number };
}

async function grantReward(
  admin: ReturnType<typeof createClient>,
  userId: string,
  type: RewardType,
): Promise<{ granted: boolean; code?: string; reason?: string }> {
  // Idempotency: unique index on (user_id, discount_type) covers regular/vip/referral_*
  const { data: existing } = await admin
    .from("customer_discounts")
    .select("id, shopify_code")
    .eq("user_id", userId)
    .eq("discount_type", type)
    .maybeSingle();
  if (existing) return { granted: false, reason: "already_granted", code: existing.shopify_code ?? undefined };

  const meta = REWARD_META[type];
  const { code, price_rule_id } = await createShopifyDiscount(userId, type);

  const { error: insErr } = await admin.from("customer_discounts").insert({
    user_id: userId,
    discount_type: type,
    discount_amount: meta.amount,
    currency_code: "XCD",
    shopify_code: code,
    shopify_price_rule_id: price_rule_id,
  });
  if (insErr) {
    // Insert lost race — clean up Shopify to avoid orphan
    await fetch(shopifyUrl(`/price_rules/${price_rule_id}.json`), {
      method: "DELETE",
      headers: shopifyHeaders(),
    }).catch(() => {});
    return { granted: false, reason: `insert_failed:${insErr.message}` };
  }
  return { granted: true, code };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("authorization") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);

    const bearer = authHeader.replace(/^Bearer\s+/i, "");
    let callerIsService = bearer && bearer === serviceKey;
    let callerUserId: string | null = null;
    if (!callerIsService) {
      if (!bearer) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: u, error: uErr } = await admin.auth.getUser(bearer);
      if (uErr || !u?.user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      callerUserId = u.user.id;
    }

    const { order_id } = await req.json().catch(() => ({}));
    if (!order_id || typeof order_id !== "string") {
      return new Response(JSON.stringify({ error: "order_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load the order
    const { data: order, error: ordErr } = await admin
      .from("orders")
      .select("id, order_status, customer_user_id, completed_at")
      .eq("id", order_id)
      .maybeSingle();
    if (ordErr || !order) {
      return new Response(JSON.stringify({ error: "Order not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (order.order_status !== "COMPLETED") {
      return new Response(
        JSON.stringify({ ok: true, skipped: "order_not_completed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!order.customer_user_id) {
      return new Response(
        JSON.stringify({ ok: true, skipped: "guest_order" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const customerId = order.customer_user_id as string;

    // Count completed orders for this customer
    const { count: completedCount, error: cntErr } = await admin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("customer_user_id", customerId)
      .eq("order_status", "COMPLETED");
    if (cntErr) throw new Error(`Count failed: ${cntErr.message}`);
    const n = completedCount ?? 0;

    const rewards: Array<{ type: RewardType; user_id: string; result: Awaited<ReturnType<typeof grantReward>> }> = [];

    // Loyalty tier grants
    if (n >= 3) {
      rewards.push({ type: "regular", user_id: customerId, result: await grantReward(admin, customerId, "regular") });
    }
    if (n >= 5) {
      rewards.push({ type: "vip", user_id: customerId, result: await grantReward(admin, customerId, "vip") });
    }

    // Referral: on FIRST completed order, if this customer used a referral code
    if (n === 1) {
      const { data: ref } = await admin
        .from("customer_referrals")
        .select("id, referrer_user_id, reward_granted")
        .eq("referred_user_id", customerId)
        .eq("reward_granted", false)
        .maybeSingle();
      if (ref) {
        const referredRes = await grantReward(admin, customerId, "referral_referred");
        const referrerRes = await grantReward(admin, ref.referrer_user_id as string, "referral_referrer");
        rewards.push({ type: "referral_referred", user_id: customerId, result: referredRes });
        rewards.push({ type: "referral_referrer", user_id: ref.referrer_user_id as string, result: referrerRes });
        await admin
          .from("customer_referrals")
          .update({
            reward_granted: true,
            rewarded_at: new Date().toISOString(),
            status: "rewarded",
          })
          .eq("id", ref.id);
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        completed_orders: n,
        caller: callerIsService ? "service" : callerUserId,
        rewards,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("grant-loyalty-rewards error:", err);
    return new Response(
      JSON.stringify({ error: err?.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
