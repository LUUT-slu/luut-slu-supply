import { useParams } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { HybridProductGrid } from "@/components/HybridProductGrid";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { BackButton } from "@/components/BackButton";
import { getCategoryBySlug } from "@/lib/categories";

export default function ShopCategory() {
  const { category } = useParams<{ category: string }>();
  
  // Handle "all" category - show all products
  const isAllProducts = category === "all";
  
  // Get category info from our unified system
  const categoryInfo = category ? getCategoryBySlug(category) : undefined;

  // Format title from handle (e.g., "beanies-tams" -> "BEANIES & TAMS")
  const formatTitle = (handle: string) => {
    // Use category label if available, otherwise format the handle
    if (categoryInfo) {
      return categoryInfo.label.toUpperCase();
    }
    return handle.replace(/-/g, ' ').toUpperCase();
  };

  const title = isAllProducts ? "ALL PRODUCTS" : formatTitle(category || '');
  const description = isAllProducts 
    ? "Browse our complete collection from local vendors" 
    : `Shop ${title.toLowerCase()} from local vendors`;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className="flex-1">
        <section className="border-b border-border bg-card px-4 py-8 md:py-12">
          <div className="container">
            <BackButton />
            <h1 className="font-display text-3xl md:text-5xl">{title}</h1>
            <p className="mt-2 font-body text-muted-foreground">
              {description}
            </p>
          </div>
        </section>

        <section className="py-8 md:py-12">
          <div className="container">
            <HybridProductGrid 
              categorySlug={category} 
              limit={100} 
            />
          </div>
        </section>
      </main>

      <Footer />
      <WhatsAppButton variant="floating" />
    </div>
  );
}
