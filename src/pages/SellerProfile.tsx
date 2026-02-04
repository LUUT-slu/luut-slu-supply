import { useParams, Link, useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ChatButton } from "@/components/ChatButton";
import { ShieldCheck, ArrowLeft, MapPin, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function SellerProfile() {
  const { sellerId } = useParams<{ sellerId: string }>();
  const navigate = useNavigate();

  const { data: seller, isLoading } = useQuery({
    queryKey: ["seller", sellerId],
    queryFn: async () => {
      if (!sellerId) return null;
      
      const { data, error } = await supabase
        .from("verified_sellers")
        .select("*")
        .eq("id", sellerId)
        .eq("is_active", true)
        .single();
      
      if (error) return null;
      return data;
    },
    enabled: !!sellerId,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <main className="flex flex-1 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </main>
        <Footer />
      </div>
    );
  }

  if (!seller) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <main className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <p className="mb-4 text-muted-foreground">Seller not found</p>
            <Button asChild>
              <Link to="/sellers">View All Sellers</Link>
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className="flex-1">
        {/* Seller header */}
        <section className="border-b border-border bg-card px-4 py-12">
          <div className="container">
            <Button variant="ghost" className="mb-6" onClick={() => navigate(-1)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>

            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 font-display text-3xl text-primary">
                {seller.name.charAt(0)}
              </div>
              <div>
                <h1 className="font-display text-3xl md:text-4xl">
                  {seller.name}
                </h1>
                <div className="mt-2 flex items-center gap-2 text-trust">
                  <ShieldCheck className="h-5 w-5" />
                  <span className="font-body text-sm">Verified Seller</span>
                </div>
              </div>
            </div>

            {seller.location && (
              <div className="mt-4 flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span className="font-body">{seller.location}</span>
              </div>
            )}

            {seller.description && (
              <p className="mt-4 max-w-2xl font-body text-muted-foreground">
                {seller.description}
              </p>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
              <ChatButton>
                Contact Seller
              </ChatButton>
              {seller.phone && (
                <Button variant="outline" asChild>
                  <a href={`tel:${seller.phone}`}>
                    <Phone className="mr-2 h-4 w-4" />
                    Call Seller
                  </a>
                </Button>
              )}
            </div>
          </div>
        </section>

        {/* Seller info section */}
        <section className="py-12">
          <div className="container">
            <div className="rounded-lg border border-border bg-card p-8 text-center">
              <h2 className="mb-2 font-display text-xl">SELLER PRODUCTS</h2>
              <p className="text-muted-foreground">
                Product listings coming soon. Contact the seller directly for available items.
              </p>
            </div>
          </div>
        </section>
      </main>

      <Footer />
      <ChatButton variant="floating" />
    </div>
  );
}
