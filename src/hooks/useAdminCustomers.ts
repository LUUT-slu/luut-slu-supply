import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CustomerListItem {
  user_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  preferred_location: string | null;
  signup_source: string | null;
  last_contacted_at: string | null;
  created_at: string;
  total_orders: number;
  total_spent: number;
  last_order_at: string | null;
  tags: string[];
  has_active_discount: boolean;
  avatar_url: string | null;
  auth_provider: string | null;
  shopify_customer_id: string | null;
}

export interface CustomerDetail extends CustomerListItem {
  meetup_notes: string | null;
  document_url: string | null;
}

/** List all customers with order aggregates + tags */
export function useAdminCustomers() {
  return useQuery({
    queryKey: ["admin-customers"],
    queryFn: async (): Promise<CustomerListItem[]> => {
      const [profilesRes, ordersRes, tagsRes, discountsRes] = await Promise.all([
        supabase.from("customer_profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("orders").select("customer_user_id, customer_email, total_price, created_at"),
        supabase.from("customer_tags").select("user_id, tag"),
        supabase.from("customer_discounts").select("user_id, is_used").eq("is_used", false),
      ]);

      const profiles = profilesRes.data || [];
      const orders = ordersRes.data || [];
      const tags = tagsRes.data || [];
      const discounts = discountsRes.data || [];

      const ordersByUser = new Map<string, { count: number; spent: number; last: string | null }>();
      const ordersByEmail = new Map<string, { count: number; spent: number; last: string | null }>();

      for (const o of orders) {
        const total = Number(o.total_price || 0);
        if (o.customer_user_id) {
          const cur = ordersByUser.get(o.customer_user_id) || { count: 0, spent: 0, last: null };
          cur.count += 1;
          cur.spent += total;
          if (!cur.last || o.created_at > cur.last) cur.last = o.created_at;
          ordersByUser.set(o.customer_user_id, cur);
        }
        if (o.customer_email) {
          const key = o.customer_email.toLowerCase();
          const cur = ordersByEmail.get(key) || { count: 0, spent: 0, last: null };
          cur.count += 1;
          cur.spent += total;
          if (!cur.last || o.created_at > cur.last) cur.last = o.created_at;
          ordersByEmail.set(key, cur);
        }
      }

      const tagsByUser = new Map<string, string[]>();
      for (const t of tags) {
        const cur = tagsByUser.get(t.user_id) || [];
        cur.push(t.tag);
        tagsByUser.set(t.user_id, cur);
      }

      const discountUsers = new Set(discounts.map((d) => d.user_id));

      return profiles.map((p) => {
        const byUser = ordersByUser.get(p.user_id);
        const byEmail = p.email ? ordersByEmail.get(p.email.toLowerCase()) : undefined;
        // prefer user_id match, fall back to email
        const agg = byUser || byEmail || { count: 0, spent: 0, last: null };
        return {
          user_id: p.user_id,
          full_name: p.full_name,
          email: p.email,
          phone: p.phone,
          preferred_location: p.preferred_location,
          signup_source: (p as any).signup_source ?? null,
          last_contacted_at: (p as any).last_contacted_at ?? null,
          created_at: p.created_at,
          total_orders: agg.count,
          total_spent: agg.spent,
          last_order_at: agg.last,
          tags: tagsByUser.get(p.user_id) || [],
          has_active_discount: discountUsers.has(p.user_id),
          avatar_url: (p as any).avatar_url ?? null,
          auth_provider: (p as any).auth_provider ?? null,
          shopify_customer_id: (p as any).shopify_customer_id ?? null,
        };
      });
    },
  });
}

export function useAdminCustomerDetail(userId: string | undefined) {
  return useQuery({
    queryKey: ["admin-customer-detail", userId],
    enabled: !!userId,
    queryFn: async (): Promise<CustomerDetail | null> => {
      if (!userId) return null;
      const { data: profile } = await supabase
        .from("customer_profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (!profile) return null;

      const [ordersRes, tagsRes, discountsRes] = await Promise.all([
        supabase
          .from("orders")
          .select("id, total_price, created_at")
          .or(`customer_user_id.eq.${userId}${profile.email ? `,customer_email.eq.${profile.email}` : ""}`),
        supabase.from("customer_tags").select("tag").eq("user_id", userId),
        supabase.from("customer_discounts").select("user_id, is_used").eq("user_id", userId).eq("is_used", false),
      ]);

      const orders = ordersRes.data || [];
      const total_orders = orders.length;
      const total_spent = orders.reduce((s, o) => s + Number(o.total_price || 0), 0);
      const last_order_at = orders.reduce<string | null>((acc, o) => (!acc || o.created_at > acc ? o.created_at : acc), null);

      return {
        user_id: profile.user_id,
        full_name: profile.full_name,
        email: profile.email,
        phone: profile.phone,
        preferred_location: profile.preferred_location,
        meetup_notes: profile.meetup_notes,
        document_url: profile.document_url,
        signup_source: (profile as any).signup_source ?? null,
        last_contacted_at: (profile as any).last_contacted_at ?? null,
        created_at: profile.created_at,
        total_orders,
        total_spent,
        last_order_at,
        tags: (tagsRes.data || []).map((t) => t.tag),
        has_active_discount: (discountsRes.data || []).length > 0,
        avatar_url: (profile as any).avatar_url ?? null,
        auth_provider: (profile as any).auth_provider ?? null,
        shopify_customer_id: (profile as any).shopify_customer_id ?? null,
      };
    },
  });
}

export async function markCustomerContacted(userId: string) {
  await supabase
    .from("customer_profiles")
    .update({ last_contacted_at: new Date().toISOString() })
    .eq("user_id", userId);
}
