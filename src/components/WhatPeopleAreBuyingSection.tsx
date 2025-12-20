import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { ShopifyProduct, fetchProducts } from "@/lib/shopify";
import { Loader2 } from "lucide-react";

const BADGES = ["Trending", "Moving Fast", "Popular", "Seen Around Town"] as const;

function getBadgeForProduct(productId: string): string {
  // Use product ID to deterministically assign a badge (feels organic but consistent)
  const hash = productId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return BADGES[hash % BADGES.length];
}

function formatPrice(amount: string, currencyCode: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
  }).format(parseFloat(amount));
}

interface ProductCardProps {
  product: ShopifyProduct;
  index: number;
}

function ProductCard({ product, index }: ProductCardProps) {
  const { node } = product;
  const imageUrl = node.images.edges[0]?.node.url;
  const price = node.priceRange.minVariantPrice;
  const badge = getBadgeForProduct(node.id);

  return (
    <Link
      to={`/product/${node.handle}`}
      className="group relative flex-shrink-0 w-[70vw] sm:w-[45vw] md:w-auto snap-start"
      style={{ 
        animationDelay: `${index * 100}ms`,
        animationFillMode: "forwards" 
      }}
    >
      <div className="relative overflow-hidden rounded-xl bg-card border border-border/30 transition-all duration-300 group-hover:border-primary/40 group-hover:shadow-[0_0_30px_hsl(43_74%_49%/0.15)] group-hover:-translate-y-1">
        {/* Badge */}
        <div className="absolute top-3 right-3 z-10">
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-medium uppercase tracking-wider bg-primary/20 text-primary border border-primary/30 backdrop-blur-sm">
            {badge}
          </span>
        </div>

        {/* Image */}
        <div className="aspect-square overflow-hidden bg-muted">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={node.title}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <span className="text-muted-foreground text-sm">No image</span>
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="p-4">
          <h3 className="font-body text-sm font-medium text-foreground line-clamp-1 mb-1">
            {node.title}
          </h3>
          <p className="font-display text-lg text-primary">
            {formatPrice(price.amount, price.currencyCode)}
          </p>
        </div>

        {/* Subtle neon glow effect on hover */}
        <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-primary/0 transition-all duration-300 group-hover:ring-primary/20 pointer-events-none" />
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
        // Fetch products - we'll take a random selection of 6
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

  // Shuffle and limit to 6 products for variety
  const displayProducts = useMemo(() => {
    if (products.length === 0) return [];
    const shuffled = [...products].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 6);
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

  if (displayProducts.length === 0) {
    return null;
  }

  return (
    <section className="py-12 md:py-16 bg-background overflow-hidden">
      <div className="container">
        {/* Section Header */}
        <div className="mb-8">
          <h2 className="font-display text-2xl md:text-3xl text-foreground">
            WHAT PEOPLE ARE BUYING
          </h2>
          <p className="mt-2 font-body text-sm text-muted-foreground">
            See what's moving in your community right now
          </p>
        </div>

        {/* Mobile: Horizontal Scroll Carousel */}
        <div className="md:hidden -mx-4 px-4">
          <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide">
            {displayProducts.map((product, index) => (
              <ProductCard key={product.node.id} product={product} index={index} />
            ))}
          </div>
        </div>

        {/* Desktop: Grid Layout */}
        <div className="hidden md:grid md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {displayProducts.map((product, index) => (
            <ProductCard key={product.node.id} product={product} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
