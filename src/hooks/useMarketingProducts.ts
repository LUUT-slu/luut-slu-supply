import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchHybridProducts } from "@/lib/products";
import { MarketingProduct, PosterType, getPosterTypeMeta } from "@/lib/marketingPosterTypes";

interface Options {
  limit?: number;
  enabled?: boolean;
  campaignId?: string; // for promotions: pull from a specific campaign
}

// ---------- Universal product pool ----------
// Merges Shopify hybrid catalog + local seller products into a single list.
async function fetchUniversalPool(): Promise<
  Array<MarketingProduct & { _createdAt?: string; _updatedAt?: string; _quantity?: number }>
> {
  const [hybrid, { data: local }] = await Promise.all([
    fetchHybridProducts({ limit: 100 }).catch(() => []),
    supabase
      .from("seller_products")
      .select("id,name,price,images,created_at,updated_at,quantity,shopify_product_id")
      .eq("status", "active")
      .is("shopify_product_id", null)
      .order("created_at", { ascending: false }),
  ]);

  const shopifyItems = hybrid
    .filter((p) => p.source === "shopify")
    .map((p) => ({
      id: p.id,
      title: p.title,
      imageUrl: p.images?.[0]?.url,
      price: p.price?.amount,
    }));

  const localItems = (local || []).map((p: any) => ({
    id: p.id,
    title: p.name,
    imageUrl: p.images?.[0],
    price: p.price ? String(p.price) : undefined,
    _createdAt: p.created_at,
    _updatedAt: p.updated_at,
    _quantity: p.quantity,
  }));

  return [...localItems, ...shopifyItems];
}

async function fetchByType(
  type: PosterType,
  limit: number,
  campaignId?: string,
): Promise<MarketingProduct[]> {
  const meta = getPosterTypeMeta(type);

  switch (type) {
    case "bestsellers": {
      // Try weekly view first
      const { data } = await supabase
        .from("weekly_best_sellers")
        .select("*")
        .limit(limit);

      if (data && data.length > 0) {
        return data.map((r: any) => ({
          id: r.product_id,
          title: r.product_title,
          imageUrl: r.product_image_url || undefined,
          // intentionally omit price for best sellers
          badge: meta.badge || undefined,
          hint: r.total_sold ? `${r.total_sold} sold` : undefined,
        }));
      }

      // Fallback: aggregate all-time sales
      const { data: sales } = await supabase
        .from("product_sales")
        .select("product_id,product_title,product_image_url,quantity");

      if (sales && sales.length > 0) {
        const agg = new Map<string, { title: string; image?: string; sold: number }>();
        for (const s of sales as any[]) {
          const cur = agg.get(s.product_id) || { title: s.product_title, image: s.product_image_url, sold: 0 };
          cur.sold += s.quantity || 0;
          agg.set(s.product_id, cur);
        }
        return Array.from(agg.entries())
          .sort((a, b) => b[1].sold - a[1].sold)
          .slice(0, limit)
          .map(([id, v]) => ({
            id,
            title: v.title,
            imageUrl: v.image,
            badge: meta.badge || undefined,
            hint: `${v.sold} sold`,
          }));
      }

      // Truly no sales data — return empty (best sellers must stay accurate)
      return [];
    }

    case "new-arrivals": {
      const pool = await fetchUniversalPool();
      // Local items already sorted desc by created_at; Shopify items inherit storefront order (newest-ish).
      return pool.slice(0, limit).map((p) => ({
        id: p.id,
        title: p.title,
        imageUrl: p.imageUrl,
        price: p.price,
        badge: meta.badge || undefined,
        hint: p._createdAt ? "Just added" : "New in",
      }));
    }

    case "restocked": {
      // Primary: stock movements last 30 days
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const { data: moves } = await supabase
        .from("partner_stock_movements")
        .select("product_id,created_at,movement_type")
        .eq("movement_type", "stock_added")
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: false })
        .limit(50);

      const restockedIds = Array.from(
        new Set((moves || []).map((m: any) => m.product_id).filter(Boolean)),
      );

      const pool = await fetchUniversalPool();
      const byId = new Map(pool.map((p) => [p.id, p]));

      const result: MarketingProduct[] = [];

      // Primary
      for (const id of restockedIds) {
        const p = byId.get(id);
        if (!p) continue;
        result.push({
          id: p.id,
          title: p.title,
          imageUrl: p.imageUrl,
          price: p.price,
          badge: meta.badge || undefined,
          hint: "Just restocked",
        });
        if (result.length >= limit) break;
      }

      if (result.length >= limit) return result;

      // Fallback 1: local products updated more recently than created
      const recentUpdates = pool
        .filter(
          (p) =>
            p._updatedAt &&
            p._createdAt &&
            new Date(p._updatedAt).getTime() > new Date(p._createdAt).getTime() + 60_000 &&
            new Date(p._updatedAt).getTime() > since.getTime(),
        )
        .sort((a, b) => new Date(b._updatedAt!).getTime() - new Date(a._updatedAt!).getTime());

      for (const p of recentUpdates) {
        if (result.find((r) => r.id === p.id)) continue;
        result.push({
          id: p.id,
          title: p.title,
          imageUrl: p.imageUrl,
          price: p.price,
          badge: meta.badge || undefined,
          hint: "Back in stock",
        });
        if (result.length >= limit) break;
      }

      if (result.length >= limit) return result;

      // Final fallback: newest items badged "Back in Stock" so the poster is never empty
      for (const p of pool) {
        if (result.find((r) => r.id === p.id)) continue;
        result.push({
          id: p.id,
          title: p.title,
          imageUrl: p.imageUrl,
          price: p.price,
          badge: meta.badge || undefined,
          hint: "Back in stock",
        });
        if (result.length >= limit) break;
      }
      return result;
    }

    case "low-stock": {
      const pool = await fetchUniversalPool();

      // Primary: local quantity 1-5
      const lowLocal = pool
        .filter((p) => p._quantity !== undefined && p._quantity > 0 && p._quantity <= 5)
        .sort((a, b) => (a._quantity ?? 99) - (b._quantity ?? 99))
        .map((p) => ({
          id: p.id,
          title: p.title,
          imageUrl: p.imageUrl,
          price: p.price,
          badge: meta.badge || undefined,
          hint: `${p._quantity} left`,
        }));

      // Shopify low_stock from hybrid
      const hybrid = await fetchHybridProducts({ limit: 100 }).catch(() => []);
      const lowShopify = hybrid
        .filter((p) => p.source === "shopify" && p.stockStatus === "low_stock")
        .map((p) => ({
          id: p.id,
          title: p.title,
          imageUrl: p.images?.[0]?.url,
          price: p.price?.amount,
          badge: meta.badge || undefined,
          hint: "Almost gone",
        }));

      const primary = [...lowLocal, ...lowShopify].slice(0, limit);
      if (primary.length >= limit) return primary;

      // Fallback: bottom-N by quantity (any > 0) so the poster always has content
      const bottomByQty = pool
        .filter((p) => p._quantity === undefined || p._quantity > 0)
        .slice(0, limit * 2)
        .map((p) => ({
          id: p.id,
          title: p.title,
          imageUrl: p.imageUrl,
          price: p.price,
          badge: meta.badge || undefined,
          hint: p._quantity ? `${p._quantity} left` : "Limited",
        }));

      const merged: MarketingProduct[] = [...primary];
      for (const p of bottomByQty) {
        if (merged.find((r) => r.id === p.id)) continue;
        merged.push(p);
        if (merged.length >= limit) break;
      }
      return merged;
    }

    case "promotions": {
      // If a specific campaign was selected, return its product_refs as-is.
      if (campaignId) {
        const { data } = await supabase
          .from("promotion_campaigns" as any)
          .select("product_refs,promo_label")
          .eq("id", campaignId)
          .maybeSingle();
        const c: any = data;
        if (c?.product_refs && Array.isArray(c.product_refs)) {
          return c.product_refs.slice(0, limit).map((r: any) => ({
            id: r.id,
            title: r.title,
            imageUrl: r.image,
            price: r.price,
            badge: (c.promo_label || meta.badge || "SALE").toUpperCase(),
            hint: "On sale",
          }));
        }
      }

      // Otherwise: fall back to active promotions' merged product list
      const { data: actives } = await supabase
        .from("promotion_campaigns" as any)
        .select("product_refs,promo_label,is_active,start_date,end_date")
        .eq("is_active", true);

      const now = Date.now();
      const liveItems: MarketingProduct[] = [];
      for (const c of (actives as any[]) || []) {
        const start = c.start_date ? new Date(c.start_date).getTime() : null;
        const end = c.end_date ? new Date(c.end_date).getTime() : null;
        if (start !== null && start > now) continue;
        if (end !== null && end < now) continue;
        for (const r of c.product_refs || []) {
          if (liveItems.find((x) => x.id === r.id)) continue;
          liveItems.push({
            id: r.id,
            title: r.title,
            imageUrl: r.image,
            price: r.price,
            badge: (c.promo_label || meta.badge || "SALE").toUpperCase(),
            hint: "On sale",
          });
        }
      }

      if (liveItems.length > 0) return liveItems.slice(0, limit);

      // Final fallback: in-stock products tagged generic "On Sale"
      const pool = await fetchUniversalPool();
      return pool
        .filter((p) => p._quantity === undefined || p._quantity > 0)
        .slice(0, limit)
        .map((p) => ({
          id: p.id,
          title: p.title,
          imageUrl: p.imageUrl,
          price: p.price,
          badge: meta.badge || undefined,
          hint: "On sale",
        }));
    }

    default: {
      // Single — return universal pool so admin can pick freely
      const pool = await fetchUniversalPool();
      return pool.slice(0, limit).map((p) => ({
        id: p.id,
        title: p.title,
        imageUrl: p.imageUrl,
        price: p.price,
      }));
    }
  }
}

export function useMarketingProducts(type: PosterType, options: Options = {}) {
  const { limit = 12, enabled = true, campaignId } = options;
  return useQuery({
    queryKey: ["marketing-products", type, limit, campaignId ?? null],
    queryFn: () => fetchByType(type, limit, campaignId),
    staleTime: type === "bestsellers" ? 1000 * 60 * 5 : 1000 * 60 * 2,
    enabled: enabled && type !== "single" ? true : enabled,
  });
}
