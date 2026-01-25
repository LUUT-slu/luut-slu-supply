import { useParams } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { HybridProductGrid } from "@/components/HybridProductGrid";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { BackButton } from "@/components/BackButton";

// Map URL slugs to Shopify product type queries
// The category handle from collections becomes the slug
const categoryQueryMap: Record<string, string> = {
  beanies: "product_type:beanies OR title:beanie",
  hats: "product_type:hats OR title:hat",
  facewear: 'product_type:"Ski Masks / Facewear" OR product_type:facewear OR title:ski mask OR title:face',
  shirts: "product_type:shirts OR title:shirt OR title:tee",
  jackets: "product_type:jackets OR title:jacket",
  hoodies: "product_type:hoodies OR title:hoodie",
  pants: "product_type:pants OR title:pants OR title:jeans",
  shorts: "product_type:shorts OR title:shorts",
  boxers: "product_type:boxers OR title:boxers OR title:underwear",
  bags: "product_type:bags OR title:bag OR title:backpack",
  shoes: "product_type:shoes OR title:shoes OR title:sneakers",
  slippers: "product_type:slippers OR title:slippers",
  sandals: "product_type:sandals OR title:sandals",
  socks: "product_type:socks OR title:socks",
};

export default function ShopCategory() {
  const { category } = useParams<{ category: string }>();
  
  // Handle "all" category - show all products
  const isAllProducts = category === "all";
  const shopifyQuery = category && !isAllProducts ? categoryQueryMap[category] : undefined;

  // Format title from handle (e.g., "ski-masks" -> "SKI MASKS")
  const formatTitle = (handle: string) => {
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
              category={category} 
              shopifyQuery={shopifyQuery} 
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
