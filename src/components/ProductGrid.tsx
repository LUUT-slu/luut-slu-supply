import { useEffect, useState } from "react";
import { ShopifyProduct, fetchProducts } from "@/lib/shopify";
import { ProductCard } from "./ProductCard";
import { Loader2 } from "lucide-react";

interface ProductGridProps {
  query?: string;
  limit?: number;
  title?: string;
}

export function ProductGrid({ query, limit = 20, title }: ProductGridProps) {
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProducts() {
      try {
        setLoading(true);
        const data = await fetchProducts(limit, query);
        setProducts(data);
      } catch (err) {
        setError("Failed to load products");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    loadProducts();
  }, [query, limit]);

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="flex min-h-[300px] flex-col items-center justify-center text-center">
        <p className="mb-2 font-body text-lg text-muted-foreground">
          No products found
        </p>
        <p className="text-sm text-muted-foreground">
          Check back soon for new arrivals!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {title && (
        <h2 className="font-display text-2xl md:text-3xl">{title}</h2>
      )}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {products.map((product) => (
          <ProductCard key={product.node.id} product={product} />
        ))}
      </div>
    </div>
  );
}
