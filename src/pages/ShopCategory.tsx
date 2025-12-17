import { useParams } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ProductGrid } from "@/components/ProductGrid";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { BackButton } from "@/components/BackButton";

const categoryMap: Record<string, { title: string; query: string }> = {
  beanies: { title: "BEANIES", query: "product_type:beanies OR title:beanie" },
  hats: { title: "HATS", query: "product_type:hats OR title:hat" },
  facewear: { title: "SKI MASKS / FACEWEAR", query: "product_type:facewear OR title:ski mask OR title:face" },
  shirts: { title: "SHIRTS", query: "product_type:shirts OR title:shirt OR title:tee" },
  jackets: { title: "JACKETS", query: "product_type:jackets OR title:jacket" },
  hoodies: { title: "HOODIES", query: "product_type:hoodies OR title:hoodie" },
  pants: { title: "PANTS", query: "product_type:pants OR title:pants OR title:jeans" },
  shorts: { title: "SHORTS", query: "product_type:shorts OR title:shorts" },
  boxers: { title: "BOXERS", query: "product_type:boxers OR title:boxers OR title:underwear" },
  bags: { title: "BAGS", query: "product_type:bags OR title:bag OR title:backpack" },
  shoes: { title: "SHOES", query: "product_type:shoes OR title:shoes OR title:sneakers" },
  slippers: { title: "SLIPPERS", query: "product_type:slippers OR title:slippers" },
  sandals: { title: "SANDALS", query: "product_type:sandals OR title:sandals" },
  socks: { title: "SOCKS", query: "product_type:socks OR title:socks" },
};

export default function ShopCategory() {
  const { category } = useParams<{ category: string }>();
  const cat = category ? categoryMap[category] : null;

  if (!cat) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <main className="flex flex-1 items-center justify-center">
          <p className="text-muted-foreground">Category not found</p>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className="flex-1">
        <section className="border-b border-border bg-card px-4 py-8 md:py-12">
          <div className="container">
            <BackButton />
            <h1 className="font-display text-3xl md:text-5xl">{cat.title}</h1>
            <p className="mt-2 font-body text-muted-foreground">
              Shop {cat.title.toLowerCase()} from local vendors
            </p>
          </div>
        </section>

        <section className="py-8 md:py-12">
          <div className="container">
            <ProductGrid query={cat.query} limit={50} />
          </div>
        </section>
      </main>

      <Footer />
      <WhatsAppButton variant="floating" />
    </div>
  );
}
