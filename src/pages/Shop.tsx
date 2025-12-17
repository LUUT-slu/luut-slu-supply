import { useSearchParams, Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ProductGrid } from "@/components/ProductGrid";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { Button } from "@/components/ui/button";

const categories = [
  { name: "All", path: "/shop" },
  { name: "Beanies", path: "/shop/beanies" },
  { name: "Hats", path: "/shop/hats" },
  { name: "Facewear", path: "/shop/facewear" },
  { name: "Shirts", path: "/shop/shirts" },
  { name: "Jackets", path: "/shop/jackets" },
  { name: "Hoodies", path: "/shop/hoodies" },
  { name: "Pants", path: "/shop/pants" },
  { name: "Shorts", path: "/shop/shorts" },
  { name: "Boxers", path: "/shop/boxers" },
  { name: "Bags", path: "/shop/bags" },
  { name: "Shoes", path: "/shop/shoes" },
  { name: "Slippers", path: "/shop/slippers" },
  { name: "Sandals", path: "/shop/sandals" },
  { name: "Socks", path: "/shop/socks" },
];

export default function Shop() {
  const [searchParams] = useSearchParams();
  const filter = searchParams.get("filter");

  const getTitle = () => {
    switch (filter) {
      case "new":
        return "NEW ARRIVALS";
      case "best":
        return "BEST SELLERS";
      default:
        return "SHOP ALL OUTFITS";
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="border-b border-border bg-card px-4 py-8 md:py-12">
          <div className="container">
            <h1 className="font-display text-3xl md:text-5xl">{getTitle()}</h1>
            <p className="mt-2 font-body text-muted-foreground">
              Browse outfits from verified Saint Lucian vendors
            </p>
          </div>
        </section>

        {/* Category filters - horizontal scroll on mobile */}
        <section className="border-b border-border py-4">
          <div className="container">
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {categories.map((cat) => (
                <Button
                  key={cat.path}
                  asChild
                  variant="outline"
                  size="sm"
                  className="flex-shrink-0 whitespace-nowrap"
                >
                  <Link to={cat.path}>{cat.name}</Link>
                </Button>
              ))}
            </div>
          </div>
        </section>

        {/* Products */}
        <section className="py-8 md:py-12">
          <div className="container">
            <ProductGrid limit={50} />
          </div>
        </section>
      </main>

      <Footer />
      <WhatsAppButton variant="floating" />
    </div>
  );
}
