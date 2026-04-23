import { useState } from "react";
import { Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { BackButton } from "@/components/BackButton";
import { ChatButton } from "@/components/ChatButton";
import { ShieldCheck, MapPin, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function Sellers() {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: sellers = [], isLoading } = useQuery({
    queryKey: ["approved-sellers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("public_seller_profiles" as any)
        .select("id, seller_name, seller_id, shop_description, location, logo_url")
        .eq("is_approved", true)
        .order("seller_name");
      
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  const filteredSellers = sellers.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      s.seller_name.toLowerCase().includes(q) ||
      (s.seller_id && s.seller_id.toLowerCase().includes(q)) ||
      (s.location && s.location.toLowerCase().includes(q))
    );
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
            {/* Search bar */}
            <div className="mt-6 relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or seller ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
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
            ) : filteredSellers.length > 0 ? (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filteredSellers.map((seller) => (
                  <Link
                    key={seller.id}
                    to={`/seller/${seller.id}`}
                    className="rounded-lg border border-border bg-card p-6 transition-colors active:bg-muted/30"
                  >
                    <div className="mb-4 flex items-center gap-3">
                      {seller.logo_url ? (
                        <img
                          src={seller.logo_url}
                          alt={seller.seller_name}
                          className="h-12 w-12 rounded-full object-cover aspect-square"
                        />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 font-display text-xl text-primary aspect-square">
                          {seller.seller_name.charAt(0)}
                        </div>
                      )}
                      <div>
                        <h3 className="font-display text-lg">{seller.seller_name}</h3>
                        <div className="flex items-center gap-2 mt-0.5">
                          <div className="flex items-center gap-1 text-xs text-trust">
                            <ShieldCheck className="h-3 w-3" />
                            Verified
                          </div>
                          {seller.seller_id && (
                            <span className="text-xs text-muted-foreground">ID: {seller.seller_id}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    {seller.location && (
                      <div className="mb-2 flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {seller.location}
                      </div>
                    )}
                    {seller.shop_description && (
                      <p className="font-body text-sm text-muted-foreground line-clamp-2">
                        {seller.shop_description}
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
              <ChatButton>
                Apply to Sell
              </ChatButton>
            </div>
          </div>
        </section>
      </main>

      <Footer />
      <ChatButton variant="floating" />
    </div>
  );
}
