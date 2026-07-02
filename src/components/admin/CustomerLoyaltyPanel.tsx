import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Crown, Star, Sparkles, Tag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

type Tier = "VIP" | "Regular" | "New";

interface LoyaltyRow {
  user_id: string;
  name: string;
  email: string | null;
  completed_orders: number;
  tier: Tier;
  codes: { code: string; amount: number; type: string }[];
}

function tierFor(count: number): Tier {
  if (count >= 5) return "VIP";
  if (count >= 3) return "Regular";
  return "New";
}

const tierStyle: Record<Tier, { icon: typeof Crown; className: string }> = {
  VIP: { icon: Crown, className: "bg-amber-500/15 text-amber-600 border-amber-500/30" },
  Regular: { icon: Star, className: "bg-blue-500/15 text-blue-600 border-blue-500/30" },
  New: { icon: Sparkles, className: "bg-muted text-muted-foreground border-border" },
};

function useCustomerLoyalty() {
  return useQuery({
    queryKey: ["admin-customer-loyalty"],
    queryFn: async (): Promise<LoyaltyRow[]> => {
      const [profilesRes, ordersRes, discountsRes] = await Promise.all([
        supabase.from("customer_profiles").select("user_id, full_name, email"),
        supabase
          .from("orders")
          .select("customer_user_id, customer_email, order_status, status")
          .or("order_status.eq.COMPLETED,status.eq.completed"),
        supabase
          .from("customer_discounts")
          .select("user_id, discount_type, discount_amount, shopify_code")
          .eq("is_used", false)
          .not("shopify_code", "is", null),
      ]);

      const profiles = profilesRes.data || [];
      const orders = ordersRes.data || [];
      const discounts = discountsRes.data || [];

      const byUser = new Map<string, number>();
      const byEmail = new Map<string, number>();
      for (const o of orders) {
        if (o.customer_user_id) byUser.set(o.customer_user_id, (byUser.get(o.customer_user_id) || 0) + 1);
        if (o.customer_email) {
          const k = o.customer_email.toLowerCase();
          byEmail.set(k, (byEmail.get(k) || 0) + 1);
        }
      }

      const codesByUser = new Map<string, LoyaltyRow["codes"]>();
      for (const d of discounts) {
        const cur = codesByUser.get(d.user_id) || [];
        cur.push({
          code: d.shopify_code as string,
          amount: Number(d.discount_amount || 0),
          type: d.discount_type,
        });
        codesByUser.set(d.user_id, cur);
      }

      const rows: LoyaltyRow[] = profiles.map((p) => {
        const count =
          (byUser.get(p.user_id) || 0) ||
          (p.email ? byEmail.get(p.email.toLowerCase()) || 0 : 0);
        return {
          user_id: p.user_id,
          name: p.full_name || p.email || "Unnamed",
          email: p.email,
          completed_orders: count,
          tier: tierFor(count),
          codes: codesByUser.get(p.user_id) || [],
        };
      });

      // Show customers with something interesting: a tier, or an active code.
      return rows
        .filter((r) => r.completed_orders > 0 || r.codes.length > 0)
        .sort((a, b) => {
          const rank = { VIP: 3, Regular: 2, New: 1 } as const;
          if (rank[b.tier] !== rank[a.tier]) return rank[b.tier] - rank[a.tier];
          return b.completed_orders - a.completed_orders;
        })
        .slice(0, 12);
    },
  });
}

export function CustomerLoyaltyPanel() {
  const { data: rows = [], isLoading } = useCustomerLoyalty();

  return (
    <Card className="mb-5">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Crown className="h-4 w-4 text-amber-500" />
              Customer Loyalty
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Tiers, completed orders, and active discount codes.
            </CardDescription>
          </div>
          <Link to="/admin/customers" className="text-xs text-primary hover:underline shrink-0">
            View all →
          </Link>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-2">
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">
            No customers with completed orders yet.
          </p>
        ) : (
          <div className="divide-y divide-border/60">
            {rows.map((r) => {
              const { icon: Icon, className } = tierStyle[r.tier];
              return (
                <Link
                  key={r.user_id}
                  to={`/admin/customers/${r.user_id}`}
                  className="flex items-center gap-3 py-2 hover:bg-accent/40 rounded-md px-1 -mx-1 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{r.name}</span>
                      <Badge variant="outline" className={`text-[10px] h-5 gap-1 ${className}`}>
                        <Icon className="h-3 w-3" />
                        {r.tier}
                      </Badge>
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {r.completed_orders} completed {r.completed_orders === 1 ? "order" : "orders"}
                      {r.email ? ` · ${r.email}` : ""}
                    </div>
                  </div>
                  <div className="flex flex-wrap justify-end gap-1 max-w-[55%]">
                    {r.codes.length === 0 ? (
                      <span className="text-[11px] text-muted-foreground italic">No active codes</span>
                    ) : (
                      r.codes.map((c) => (
                        <Badge
                          key={c.code}
                          variant="secondary"
                          className="text-[10px] h-5 gap-1 font-mono"
                          title={`${c.type} · EC$${c.amount.toFixed(2)} off`}
                        >
                          <Tag className="h-3 w-3" />
                          {c.code}
                        </Badge>
                      ))
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
