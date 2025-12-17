import { Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { ProductGrid } from "@/components/ProductGrid";
import { ShieldCheck } from "lucide-react";

// Sellers on the marketplace - in production, this would come from vendor data
const sellers = [
  {
    id: "luut-slu",
    name: "Luut SLU",
    badge: "Certified Seller",
    description: "The official Luut SLU collection. As the platform owner, we also operate as a certified seller with our own curated streetwear.",
    isCertified: true,
  },
];

export default function Sellers() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className="flex-1">
        <section className="border-b border-border bg-card px-4 py-12">
          <div className="container">
            <h1 className="font-display text-3xl md:text-5xl">OUR SELLERS</h1>
            <p className="mt-4 font-body text-muted-foreground">
              Browse verified vendors on the Luut SLU marketplace. Each seller handles their own meetups & delivery.
            </p>
          </div>
        </section>

        <section className="py-12">
          <div className="container">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {sellers.map((seller) => (
                <Link
                  key={seller.id}
                  to={`/seller/${seller.id}`}
                  className="rounded-lg border border-border bg-card p-6 transition-colors hover:border-primary/50"
                >
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 font-display text-xl text-primary">
                      {seller.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-display text-lg">{seller.name}</h3>
                      {seller.isCertified && (
                        <div className="flex items-center gap-1 text-xs text-trust">
                          <ShieldCheck className="h-3 w-3" />
                          {seller.badge}
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="font-body text-sm text-muted-foreground">
                    {seller.description}
                  </p>
                </Link>
              ))}
            </div>

            {sellers.length === 1 && (
              <div className="mt-12 rounded-lg border border-border bg-card p-8 text-center">
                <h3 className="mb-2 font-display text-xl">
                  WANT TO JOIN AS A SELLER?
                </h3>
                <p className="mb-4 font-body text-muted-foreground">
                  We're always looking for quality vendors to join our
                  marketplace.
                </p>
                <WhatsAppButton message="Hi! I'm interested in becoming a vendor on Luut SLU.">
                  Apply to Sell
                </WhatsAppButton>
              </div>
            )}
          </div>
        </section>
      </main>

      <Footer />
      <WhatsAppButton variant="floating" />
    </div>
  );
}
