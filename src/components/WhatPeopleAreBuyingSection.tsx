import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { ShopifyProduct, fetchProducts, getOptimizedImageUrl, normalizeVendorName } from "@/lib/shopify";
import { Loader2 } from "lucide-react";

const BADGES = ["Trending", "Moving Fast", "Popular", "Seen Around Town"] as const;

function getBadgeForProduct(productId: string): string {
  const hash = productId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return BADGES[hash % BADGES.length];
}

function formatPrice(amount: string, currencyCode: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode
  }).format(parseFloat(amount));
}

interface ProductCardProps {
  product: ShopifyProduct;
  index: number;
}

function ProductCard({ product, index }: ProductCardProps) {
  const { node } = product;
  const rawImageUrl = node.images.edges[0]?.node.url;
  const imageUrl = rawImageUrl ? getOptimizedImageUrl(rawImageUrl, 400) : undefined;
  const price = node.priceRange.minVariantPrice;
  const badge = getBadgeForProduct(node.id);
  const anyAvailable = node.variants.edges.some(v => v.node.availableForSale);

  return (
    <Link
      to={`/product/${node.handle}`}
      className={`group relative flex-shrink-0 w-[70vw] sm:w-[45vw] md:w-auto snap-start ${!anyAvailable ? 'opacity-60' : ''}`}
    >
      <div className="relative overflow-hidden rounded-lg bg-card border border-border transition-all duration-200 hover:shadow-[var(--shadow-elevated)]">
        {/* Badge */}
        <div className="absolute top-2 right-2 z-10">
          {anyAvailable ? (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium uppercase tracking-wider bg-card/90 text-muted-foreground border border-border backdrop-blur-sm">
              {badge}
            </span>
          ) : (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider bg-destructive text-white">
              Sold Out
            </span>
          )}
        </div>

        {/* Image */}
        <div className="aspect-square overflow-hidden bg-muted">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={node.title}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
              width={400}
              height={400}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <span className="text-muted-foreground text-sm">No image</span>
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="p-3">
          <h3 className="font-body text-sm font-medium text-foreground line-clamp-1 mb-1">
            {node.title}
          </h3>
          <p className="text-base font-bold text-foreground mb-1">
            {formatPrice(price.amount, price.currencyCode)}
          </p>
          <p className="text-[10px] text-muted-foreground">
            Sold by:{" "}
            <span
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const normalized = normalizeVendorName(node.vendor || 'Luut SLU');
                window.location.href = `/seller/${encodeURIComponent(normalized.toLowerCase().replace(/\s+/g, '-'))}`;
              }}
              className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
            >
              {normalizeVendorName(node.vendor || "Luut SLU")}
            </span>
          </p>
        </div>
      </div>
    </Link>
  );
}

export function WhatPeopleAreBuyingSection() {
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProducts() {
      try {
        setLoading(true);
        const data = await fetchProducts(20);
        setProducts(data);
      } catch (err) {
        console.error("Failed to load products:", err);
      } finally {
        setLoading(false);
      }
    }
    loadProducts();
  }, []);

  const displayProducts = useMemo(() => {
    if (products.length === 0) return [];
    const inStock = products.filter(p =>
      p.node.variants.edges.some(v => v.node.availableForSale)
    );
    const pool = inStock.length > 0 ? inStock : products;
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 6);
  }, [products]);

  if (loading) {
    return (
      <section className="py-10 md:py-14 bg-background border-t border-border">
        <div className="container">
          <div className="flex min-h-[200px] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </div>
      </section>
    );
  }

  if (displayProducts.length === 0) return null;

  return (
    <section className="bg-background border-t border-border py-10 md:py-14">
      <div className="container">
        <div className="mb-6">
          <h2 className="text-lg font-bold tracking-tight text-foreground uppercase md:text-xl">
            What's Trending
          </h2>
          <p className="mt-1 font-body text-xs text-muted-foreground">
            See what's moving in your community right now
          </p>
        </div>

        {/* Mobile: Horizontal Scroll */}
        <div className="md:hidden -mx-4 px-4">
          <div className="flex gap-3 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide">
            {displayProducts.map((product, index) => (
              <ProductCard key={product.node.id} product={product} index={index} />
            ))}
          </div>
        </div>

        {/* Desktop: Grid */}
        <div className="hidden md:grid md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          {displayProducts.map((product, index) => (
            <ProductCard key={product.node.id} product={product} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
