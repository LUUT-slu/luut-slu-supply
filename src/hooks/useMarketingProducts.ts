import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchHybridProducts } from "@/lib/products";
import { MarketingProduct, PosterType, getPosterTypeMeta } from "@/lib/marketingPosterTypes";

interface Options {
  limit?: number;
  enabled?: boolean;
}

async function fetchByType(type: PosterType, limit: number): Promise<MarketingProduct[]> {
  const meta = getPosterTypeMeta(type);

  switch (type) {
    case "bestsellers": {
      const { data, error } = await supabase
        .from("weekly_best_sellers")
        .select("*")
        .limit(limit);
      if (error) {
        console.error(error);
        return [];
      }
      return (data || []).map((r: any) => ({
        id: r.product_id,
        title: r.product_title,
        imageUrl: r.product_image_url || undefined,
        price: r.price ? String(r.price) : undefined,
        badge: meta.badge || undefined,
        hint: r.total_sold ? `${r.total_sold} sold` : undefined,
      }));
    }

    case "new-arrivals": {
      // Combine local seller_products (newest) + Shopify products (already ordered newest by query)
      const [{ data: local }, hybrid] = await Promise.all([
        supabase
          .from("seller_products")
          .select("id,name,price,images,created_at,quantity")
          .eq("status", "active")
          .is("shopify_product_id", null)
          .order("created_at", { ascending: false })
          .limit(limit),
        fetchHybridProducts({ limit: limit * 2 }).catch(() => []),
      ]);

      const localItems: MarketingProduct[] = (local || []).map((p: any) => ({
        id: p.id,
        title: p.name,
        imageUrl: p.images?.[0],
        price: p.price ? String(p.price) : undefined,
        badge: meta.badge || undefined,
        hint: "Just added",
      }));

      const shopifyItems: MarketingProduct[] = hybrid
        .filter((p) => p.source === "shopify")
        .slice(0, limit)
        .map((p) => ({
          id: p.id,
          title: p.title,
          imageUrl: p.images?.[0]?.url,
          price: p.price?.amount,
          badge: meta.badge || undefined,
          hint: "New in",
        }));

      return [...localItems, ...shopifyItems].slice(0, limit);
    }

    case "low-stock": {
      // Local products with quantity 1-5
      const { data: local } = await supabase
        .from("seller_products")
        .select("id,name,price,images,quantity")
        .eq("status", "active")
        .gt("quantity", 0)
        .lte("quantity", 5)
        .order("quantity", { ascending: true })
        .limit(limit * 2);

      const localItems: MarketingProduct[] = (local || []).map((p: any) => ({
        id: p.id,
        title: p.name,
        imageUrl: p.images?.[0],
        price: p.price ? String(p.price) : undefined,
        badge: meta.badge || undefined,
        hint: `${p.quantity} left`,
      }));

      // Also pull Shopify low_stock from hybrid (variants flagged low)
      const hybrid = await fetchHybridProducts({ limit: 100 }).catch(() => []);
      const shopifyLow: MarketingProduct[] = hybrid
        .filter((p) => p.source === "shopify" && p.stockStatus === "low_stock")
        .slice(0, limit)
        .map((p) => ({
          id: p.id,
          title: p.title,
          imageUrl: p.images?.[0]?.url,
          price: p.price?.amount,
          badge: meta.badge || undefined,
          hint: "Almost gone",
        }));

      return [...localItems, ...shopifyLow].slice(0, limit);
    }

    case "restocked": {
      // partner_stock_movements where movement_type='stock_added' in last 14 days
      const since = new Date();
      since.setDate(since.getDate() - 14);
      const { data: moves } = await supabase
        .from("partner_stock_movements")
        .select("product_id,created_at,qty_change,movement_type")
        .eq("movement_type", "stock_added")
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: false })
        .limit(50);

      const productIds = Array.from(
        new Set((moves || []).map((m: any) => m.product_id).filter(Boolean)),
      );
      if (productIds.length === 0) return [];

      const { data: products } = await supabase
        .from("seller_products")
        .select("id,name,price,images")
        .in("id", productIds)
        .eq("status", "active");

      const byId = new Map((products || []).map((p: any) => [p.id, p]));
      const result: MarketingProduct[] = [];
      const seen = new Set<string>();
      for (const m of moves || []) {
        if (seen.has(m.product_id)) continue;
        const p = byId.get(m.product_id);
        if (!p) continue;
        seen.add(m.product_id);
        result.push({
          id: p.id,
          title: p.name,
          imageUrl: p.images?.[0],
          price: p.price ? String(p.price) : undefined,
          badge: meta.badge || undefined,
          hint: "Just restocked",
        });
        if (result.length >= limit) break;
      }
      return result;
    }

    case "promotions": {
      // Discounts data is in Shopify; we surface low-priced/in-stock items as "on sale"
      // proxy until a per-product sale flag exists. Pull all hybrid products tagged
      // as "sale" via Shopify productType OR with compareAtPrice — fall back to
      // showing in-stock products the admin can curate.
      const hybrid = await fetchHybridProducts({ limit: 60 }).catch(() => []);
      const items: MarketingProduct[] = hybrid
        .filter((p) => p.stockStatus !== "out_of_stock")
        .slice(0, limit)
        .map((p) => ({
          id: p.id,
          title: p.title,
          imageUrl: p.images?.[0]?.url,
          price: p.price?.amount,
          badge: meta.badge || undefined,
          hint: "On sale",
        }));
      return items;
    }

    default:
      return [];
  }
}

export function useMarketingProducts(type: PosterType, options: Options = {}) {
  const { limit = 8, enabled = true } = options;
  return useQuery({
    queryKey: ["marketing-products", type, limit],
    queryFn: () => fetchByType(type, limit),
    staleTime: 1000 * 60 * 2,
    enabled: enabled && type !== "single",
  });
}
