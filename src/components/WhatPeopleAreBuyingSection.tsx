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
  const imageSrcSet = rawImageUrl
    ? `${getOptimizedImageUrl(rawImageUrl, 300)} 300w, ${getOptimizedImageUrl(rawImageUrl, 500)} 500w, ${getOptimizedImageUrl(rawImageUrl, 800)} 800w`
    : undefined;
  const price = node.priceRange.minVariantPrice;
  const badge = getBadgeForProduct(node.id);
  const anyAvailable = node.variants.edges.some(v => v.node.availableForSale);
  const priority = index < 4;

  return (
    <Link
      to={`/product/${node.handle}`}
      className={`group relative flex-shrink-0 w-[70vw] sm:w-[45vw] md:w-auto snap-start ${!anyAvailable ? 'opacity-[0.65]' : ''}`}
      style={{ animationDelay: `${index * 100}ms`, animationFillMode: "forwards" }}
    >
      <div className="relative overflow-hidden rounded-lg bg-card/50 border border-border/20 transition-all duration-300 group-hover:border-primary/20 group-hover:-translate-y-0.5">
        {/* Badge */}
        <div className="absolute top-3 right-3 z-10">
          {anyAvailable ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-medium uppercase tracking-wider bg-primary/10 text-primary/80 border border-primary/15 backdrop-blur-sm">
              {badge}
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wider bg-destructive/90 text-white">
              Sold Out
            </span>
          )}
        </div>

        {/* Image */}
        <div className="aspect-square overflow-hidden bg-muted/30">
          {imageUrl ? (
            <img
              src={imageUrl}
              srcSet={imageSrcSet}
              sizes="(max-width: 640px) 70vw, (max-width: 768px) 45vw, 16vw"
              alt={node.title}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-103"
              loading={priority ? "eager" : "lazy"}
              fetchPriority={priority ? "high" : "auto"}
              decoding="async"
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
        <div className="p-4">
          <h3 className="font-body text-base font-semibold text-foreground/90 line-clamp-1 mb-1">
            {node.title}
          </h3>
          <p className="text-lg font-bold text-primary/90 mb-1">
            {formatPrice(price.amount, price.currencyCode)}
          </p>
          <p className="text-[10px] text-muted-foreground/60">
            <span className="text-muted-foreground/40">·</span>{" "}
            Sold by:{" "}
            <span
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const normalized = normalizeVendorName(node.vendor || 'Luut SLU');
                window.location.href = `/seller/${encodeURIComponent(normalized.toLowerCase().replace(/\s+/g, '-'))}`;
              }}
              className="text-muted-foreground/70 hover:text-muted-foreground cursor-pointer transition-colors"
            >
              {normalizeVendorName(node.vendor || "Luut SLU")}
            </span>
          </p>
        </div>

        <div className="absolute inset-0 rounded-lg ring-1 ring-inset ring-primary/0 transition-all duration-300 group-hover:ring-primary/10 pointer-events-none" />
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

  // Stable daily-seeded shuffle: prevents reorder thrash on re-renders
  // and keeps a consistent above-the-fold image order across the session.
  // Sold-out products stay visible but are pushed to the end of the strip.
  const displayProducts = useMemo(() => {
    if (products.length === 0) return [];
    // Seed = day-of-year so order is deterministic per day per visitor.
    const today = new Date();
    let seed = today.getFullYear() * 1000 + today.getMonth() * 31 + today.getDate();
    const rand = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    const shuffled = [...products].sort(() => rand() - 0.5);
    // Stable partition: in-stock first (preserving shuffled order), sold-out last.
    const inStock = shuffled.filter(p =>
      p.node.variants.edges.some(v => v.node.availableForSale)
    );
    const soldOut = shuffled.filter(p =>
      !p.node.variants.edges.some(v => v.node.availableForSale)
    );
    return [...inStock, ...soldOut].slice(0, 6);
  }, [products]);

  if (loading) {
    return (
      <section className="py-12 md:py-16 bg-background">
        <div className="container">
          <div className="flex min-h-[300px] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </div>
      </section>
    );
  }

  if (displayProducts.length === 0) return null;

  return (
    <section className="relative md:py-16 overflow-hidden py-[30px]">
      <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.02] via-transparent to-transparent pointer-events-none" />
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

      <div className="container relative">
        <div className="mb-10">
          <h2 className="text-xl font-semibold tracking-tight text-center md:text-2xl">
            WHAT'S TRENDING
          </h2>
          <p className="mt-3 font-body text-sm text-muted-foreground/70 text-center">
            See what's moving in your community right now
          </p>
        </div>

        {/* Mobile: Horizontal Scroll */}
        <div className="md:hidden -mx-4 px-4">
          <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide">
            {displayProducts.map((product, index) => (
              <ProductCard key={product.node.id} product={product} index={index} />
            ))}
          </div>
        </div>

        {/* Desktop: Grid */}
        <div className="hidden md:grid md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {displayProducts.map((product, index) => (
            <ProductCard key={product.node.id} product={product} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
