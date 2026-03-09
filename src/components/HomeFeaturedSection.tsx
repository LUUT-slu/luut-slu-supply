import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { UnifiedProductCard } from "@/components/UnifiedProductCard";

interface HomeFeaturedSectionProps {
  label: string;
  productIds: string[];
  limit?: number;
}

export function HomeFeaturedSection({ label, productIds, limit = 4 }: HomeFeaturedSectionProps) {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (productIds.length === 0) { setLoading(false); return; }
    (async () => {
      const { data } = await supabase
        .from("seller_products")
        .select("*")
        .in("id", productIds.slice(0, limit))
        .eq("status", "active");
      setProducts(data || []);
      setLoading(false);
    })();
  }, [productIds, limit]);

  if (loading || products.length === 0) return null;

  // Map to UnifiedProductCard format
  const mapped = products.map(p => ({
    id: p.id,
    title: p.name,
    handle: p.id,
    price: String(p.price),
    currencyCode: "XCD",
    imageUrl: p.images?.[0] || null,
    stockStatus: p.quantity > 0 ? "in_stock" as const : "out_of_stock" as const,
    source: "local" as const,
    vendor: null,
    productType: p.category || null,
    variantId: null,
    variantTitle: null,
  }));

  return (
    <section className="border-t border-border/50 py-10 md:py-14">
      <div className="container">
        <h2 className="mb-6 text-xl font-semibold tracking-tight md:text-2xl">{label}</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 rounded-sm">
          {mapped.map(product => (
            <UnifiedProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </section>
  );
}
