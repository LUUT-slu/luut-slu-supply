import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ChatButton } from "@/components/ChatButton";
import { BackButton } from "@/components/BackButton";
import { ProductGrid } from "@/components/ProductGrid";

export default function NewArrivals() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className="flex-1">
        <section className="border-b border-border bg-card px-4 py-8 md:py-12">
          <div className="container">
            <BackButton />
            <h1 className="font-display text-3xl md:text-5xl">NEW ARRIVALS</h1>
            <p className="mt-2 font-body text-muted-foreground">
              The latest products added to our marketplace
            </p>
          </div>
        </section>

        <section className="py-8 md:py-12">
          <div className="container">
            <ProductGrid limit={20} sortKey="CREATED_AT" reverse={true} />
          </div>
        </section>
      </main>

      <Footer />
      <ChatButton variant="floating" />
    </div>
  );
}
