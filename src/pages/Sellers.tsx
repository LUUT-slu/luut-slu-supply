import { Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { BackButton } from "@/components/BackButton";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { ShieldCheck, MapPin } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function Sellers() {
  const { data: sellers = [], isLoading } = useQuery({
    queryKey: ["verified-sellers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("verified_sellers")
        .select("*")
        .eq("is_active", true)
        .order("name");
      
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className="flex-1">
        <section className="border-b border-border bg-card px-4 py-12">
          <div className="container">
            <BackButton />
            <h1 className="font-display text-3xl md:text-5xl">OUR SELLERS</h1>
            <p className="mt-4 font-body text-muted-foreground">
              Browse verified vendors on the Luut SLU marketplace. Each seller handles their own meetups & delivery.
            </p>
          </div>
        </section>

        <section className="py-12">
          <div className="container">
            {isLoading ? (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-40 animate-pulse rounded-lg bg-muted" />
                ))}
              </div>
            ) : sellers.length > 0 ? (
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
                        <div className="flex items-center gap-1 text-xs text-trust">
                          <ShieldCheck className="h-3 w-3" />
                          Verified Seller
                        </div>
                      </div>
                    </div>
                    {seller.location && (
                      <div className="mb-2 flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {seller.location}
                      </div>
                    )}
                    {seller.description && (
                      <p className="font-body text-sm text-muted-foreground line-clamp-2">
                        {seller.description}
                      </p>
                    )}
                  </Link>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-border bg-card p-8 text-center">
                <p className="text-muted-foreground">No sellers available yet.</p>
              </div>
            )}

            <div className="mt-12 rounded-lg border border-border bg-card p-8 text-center">
              <h3 className="mb-2 font-display text-xl">
                WANT TO JOIN AS A SELLER?
              </h3>
              <p className="mb-4 font-body text-muted-foreground">
                We're always looking for quality vendors to join our marketplace.
              </p>
              <WhatsAppButton message="Hi! I'm interested in becoming a vendor on Luut SLU.">
                Apply to Sell
              </WhatsAppButton>
            </div>
          </div>
        </section>
      </main>

      <Footer />
      <WhatsAppButton variant="floating" />
    </div>
  );
}
