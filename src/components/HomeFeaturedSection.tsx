import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { UnifiedProductCard } from "@/components/UnifiedProductCard";
import { UnifiedProduct } from "@/lib/products";
import { sortByStockStatus } from "@/lib/stockSort";
import { shuffleArray } from "@/lib/utils";

interface HomeFeaturedSectionProps {
  label: string;
  productIds: string[];
  limit?: number;
}

export function HomeFeaturedSection({ label, productIds, limit = 4 }: HomeFeaturedSectionProps) {
  const [products, setProducts] = useState<UnifiedProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (productIds.length === 0) { setLoading(false); return; }
    (async () => {
      const { data } = await supabase
        .from("seller_products")
        .select("*")
        .in("id", productIds.slice(0, limit))
        .eq("status", "active");

      const mapped: UnifiedProduct[] = (data || []).map((p: any) => ({
        id: p.id,
        source: "lovable" as const,
        title: p.name,
        description: p.description || "",
        handle: p.id,
        vendor: "",
        category: p.category || null,
        stockStatus: p.quantity > 0 ? ("in_stock" as const) : ("out_of_stock" as const),
        quantity: p.quantity,
        price: { amount: String(p.price), currencyCode: "XCD" },
        images: (p.images || []).map((url: string) => ({ url, altText: null })),
        variants: [{
          id: p.id,
          title: "Default",
          price: { amount: String(p.price), currencyCode: "XCD" },
          availableForSale: p.quantity > 0,
          selectedOptions: [],
        }],
      }));

      // Preserve admin-defined order from productIds, then push sold-out to end (stable).
      const ordered = productIds
        .map((id) => mapped.find((m) => m.id === id))
        .filter((p): p is UnifiedProduct => Boolean(p));
      setProducts(sortByStockStatus(ordered));
      setLoading(false);
    })();
  }, [productIds, limit]);

  if (loading || products.length === 0) return null;

  return (
    <section className="border-t border-border/50 py-10 md:py-14">
      <div className="container">
        <h2 className="mb-6 text-xl font-semibold tracking-tight md:text-2xl">{label}</h2>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 rounded-sm">
          {products.map((product, idx) => (
            <UnifiedProductCard key={product.id} product={product} priority={idx < 4} />
          ))}
        </div>
      </div>
    </section>
  );
}
