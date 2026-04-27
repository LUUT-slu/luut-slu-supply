import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Aggregates analytics_events to find which product categories each customer
 * has shown interest in (≥3 product_view or product_click events).
 * Returns a map: user_id -> top 3 categories.
 */
export function useCustomerInterests() {
  return useQuery({
    queryKey: ["customer-interests"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Record<string, string[]>> => {
      const { data } = await supabase
        .from("analytics_events")
        .select("user_id, product_category, event_type")
        .not("user_id", "is", null)
        .not("product_category", "is", null)
        .in("event_type", ["product_view", "product_click", "view_product"])
        .limit(5000);

      const counts = new Map<string, Map<string, number>>();
      for (const row of data || []) {
        const uid = row.user_id as string;
        const cat = (row.product_category as string)?.trim();
        if (!uid || !cat) continue;
        if (!counts.has(uid)) counts.set(uid, new Map());
        const m = counts.get(uid)!;
        m.set(cat, (m.get(cat) ?? 0) + 1);
      }

      const out: Record<string, string[]> = {};
      for (const [uid, m] of counts) {
        const top = Array.from(m.entries())
          .filter(([, n]) => n >= 3)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([cat]) => cat);
        if (top.length) out[uid] = top;
      }

      // Persist as customer_tags (idempotent via unique constraint)
      const inserts: { user_id: string; tag: string; tag_type: string }[] = [];
      for (const [uid, cats] of Object.entries(out)) {
        for (const cat of cats) {
          inserts.push({ user_id: uid, tag: `${cat} interest`, tag_type: "interest" });
        }
      }
      if (inserts.length > 0) {
        await supabase
          .from("customer_tags")
          .upsert(inserts, { onConflict: "user_id,tag", ignoreDuplicates: true });
      }

      return out;
    },
  });
}
