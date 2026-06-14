import { Link } from "react-router-dom";
import { SEO } from "@/components/SEO";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { BackButton } from "@/components/BackButton";
import { ChatButton } from "@/components/ChatButton";
import { useShopifyCollections, getCollectionPath } from "@/hooks/useShopifyCollections";
import { Loader2 } from "lucide-react";

// Fallback categories if Shopify collections aren't available
const fallbackCategories = [
  { handle: "beanies", title: "Beanies", image: "https://images.unsplash.com/photo-1576871337632-b9aef4c17ab9?w=600&h=600&fit=crop" },
  { handle: "hats", title: "Hats", image: "https://images.unsplash.com/photo-1521369909029-2afed882baee?w=600&h=600&fit=crop" },
  { handle: "facewear", title: "Ski Masks / Facewear", image: "https://images.unsplash.com/photo-1544966503-7cc5ac882d5a?w=600&h=600&fit=crop" },
  { handle: "shirts", title: "Shirts", image: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600&h=600&fit=crop" },
  { handle: "jackets", title: "Jackets", image: "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=600&h=600&fit=crop" },
  { handle: "hoodies", title: "Hoodies", image: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=600&h=600&fit=crop" },
  { handle: "pants", title: "Pants", image: "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=600&h=600&fit=crop" },
  { handle: "shorts", title: "Shorts", image: "https://images.unsplash.com/photo-1591195853828-11db59a44f6b?w=600&h=600&fit=crop" },
  { handle: "boxers", title: "Boxers", image: "https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=600&h=600&fit=crop" },
  { handle: "bags", title: "Bags", image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&h=600&fit=crop" },
  { handle: "shoes", title: "Shoes", image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&h=600&fit=crop" },
  { handle: "slippers", title: "Slippers", image: "https://images.unsplash.com/photo-1603487742131-4160ec999306?w=600&h=600&fit=crop" },
  { handle: "sandals", title: "Sandals", image: "https://images.unsplash.com/photo-1603487742131-4160ec999306?w=600&h=600&fit=crop&sat=-100" },
  { handle: "socks", title: "Socks", image: "https://images.unsplash.com/photo-1586350977771-b3b0abd50c82?w=600&h=600&fit=crop" },
];

export default function Shop() {
  const { collections, loading, error } = useShopifyCollections();

  // Use Shopify collections if available, otherwise fallback
  const categories = collections.length > 0
    ? collections.map(c => ({
        handle: c.handle,
        title: c.title,
        image: c.image?.url || `https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=600&h=600&fit=crop`,
      }))
    : fallbackCategories;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SEO title="Shop All — Luut SLU Streetwear Marketplace" description="Browse every category — hats, hoodies, shoes, bags and more — from local Saint Lucia sellers on Luut SLU." path="/shop" />
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="border-b border-border bg-card px-4 py-10 md:py-14">
          <div className="container">
            <BackButton />
            <div className="mx-auto max-w-2xl text-center">
              <h1 className="font-display text-4xl tracking-wider md:text-5xl lg:text-6xl">
                CREATE A <span className="text-primary">FIT</span>
              </h1>
              <p className="mt-3 font-body text-muted-foreground md:text-lg">
                Pick your pieces. Build your look.
              </p>
            </div>
          </div>
        </section>

        {/* All Products Link */}
        <section className="px-4 pt-8 md:pt-12">
          <div className="container">
            <Link
              to="/shop/all"
              className="group relative block w-full overflow-hidden rounded-lg bg-gradient-to-r from-primary/20 via-primary/10 to-primary/20 ring-1 ring-primary/30 transition-all duration-300 hover:ring-2 hover:ring-primary hover:shadow-lg hover:shadow-primary/20 animate-fade-in"
            >
              <div className="flex items-center justify-center gap-3 px-6 py-5 md:py-6">
                <span className="font-display text-lg tracking-wider text-foreground transition-colors group-hover:text-primary md:text-xl">
                  VIEW ALL PRODUCTS
                </span>
                <svg 
                  className="h-5 w-5 text-primary transition-transform duration-300 group-hover:translate-x-1" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </div>
            </Link>
          </div>
        </section>

        {/* Visual Grid Gallery */}
        <section className="px-4 py-6 md:py-8">
          <div className="container">
            {loading ? (
              <div className="flex min-h-[300px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 md:gap-4">
                {categories.map((category, index) => (
                  <Link
                    key={category.handle}
                    to={getCollectionPath(category.handle)}
                    className="group relative aspect-square overflow-hidden rounded-lg bg-muted ring-1 ring-border/50 transition-all duration-300 hover:ring-2 hover:ring-primary/50 hover:shadow-lg hover:shadow-primary/10 animate-fade-in opacity-0"
                    style={{ animationDelay: `${index * 80}ms`, animationFillMode: 'forwards' }}
                  >
                    {/* Image with zoom effect */}
                    <img
                      src={category.image}
                      alt={category.title}
                      className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-110"
                    />
                    
                    {/* Gradient overlay - intensifies on hover */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent transition-opacity duration-300 group-hover:from-black/70" />
                    
                    {/* Category label with animation */}
                    <div className="absolute bottom-3 left-3 right-3 transition-transform duration-300 ease-out group-hover:translate-y-[-4px]">
                      <span className="inline-block rounded-full bg-background/90 px-3 py-1.5 font-display text-xs tracking-wide text-foreground backdrop-blur-sm transition-all duration-300 group-hover:bg-primary group-hover:text-primary-foreground md:text-sm">
                        {category.title}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      <Footer />
      <ChatButton variant="floating" />
    </div>
  );
}
