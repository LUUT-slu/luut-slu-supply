import { Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ChatButton } from "@/components/ChatButton";
import { BackButton } from "@/components/BackButton";
import { useBestSellers } from "@/hooks/useBestSellers";
import { Package } from "lucide-react";

export default function BestSellers() {
  const { data: bestSellers = [], isLoading: loading } = useBestSellers();

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "XCD",
      minimumFractionDigits: 0,
    }).format(amount);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className="flex-1">
        <section className="border-b border-border bg-card px-4 py-8 md:py-12">
          <div className="container">
            <BackButton />
            <h1 className="font-display text-3xl md:text-5xl">BEST SELLERS</h1>
            <p className="mt-2 font-body text-muted-foreground">
              Top products ranked by real sales performance
            </p>
          </div>
        </section>

        <section className="py-8 md:py-12">
          <div className="container">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : bestSellers.length === 0 ? (
              <div className="text-center py-12">
                <Package className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                <p className="text-muted-foreground">
                  No best sellers data yet. Check back after more sales!
                </p>
              </div>
            ) : (
              <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {bestSellers.map((item) => (
                  <Link
                    key={item.product_id}
                    to={`/product/${item.product_handle}`}
                    className="group rounded-lg border border-border bg-card overflow-hidden transition-colors active:bg-muted/30"
                  >
                    <div className="aspect-square bg-muted relative overflow-hidden">
                      {item.product_image_url ? (
                        <img
                          src={item.product_image_url}
                          alt={item.product_title || "Product"}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Package className="h-10 w-10 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="font-medium text-sm line-clamp-1">{item.product_title}</p>
                      <p className="text-sm font-bold text-primary mt-1">
                        {formatCurrency(item.price || 0)}
                      </p>
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
