import { useParams, Link, useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ChatButton } from "@/components/ChatButton";
import { ShieldCheck, ArrowLeft, MapPin, Phone, Package, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function SellerProfile() {
  const { sellerId } = useParams<{ sellerId: string }>();
  const navigate = useNavigate();

  // Fetch seller profile from seller_profiles
  const { data: seller, isLoading } = useQuery({
    queryKey: ["seller-profile", sellerId],
    queryFn: async () => {
      if (!sellerId) return null;

      // Try UUID lookup first
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sellerId);

      if (isUUID) {
        const { data, error } = await supabase
          .from("public_seller_profiles" as any)
          .select("*")
          .eq("id", sellerId)
          .eq("is_approved", true)
          .single();
        if (!error && data) return data as any;
      }

      // Try seller_id lookup (e.g. S1A2B3)
      const { data: bySellerIdData } = await supabase
        .from("public_seller_profiles" as any)
        .select("*")
        .eq("seller_id", sellerId.toUpperCase())
        .eq("is_approved", true)
        .maybeSingle();
      if (bySellerIdData) return bySellerIdData as any;

      // Fallback: slug-based lookup (e.g., "luut-slu-hub" -> match seller_name)
      const { data: allSellers } = await supabase
        .from("public_seller_profiles" as any)
        .select("*")
        .eq("is_approved", true);

      if (allSellers) {
        const slug = sellerId.toLowerCase();
        const match = (allSellers as any[]).find(
          (s: any) => s.seller_name?.toLowerCase().replace(/\s+/g, "-") === slug
        );
        if (match) return match;
      }

      return null;
    },
    enabled: !!sellerId,
  });

  // Fetch seller's products
  const { data: products = [] } = useQuery({
    queryKey: ["seller-products-public", sellerId],
    queryFn: async () => {
      if (!sellerId) return [];
      
      const { data, error } = await supabase
        .from("seller_products")
        .select("id, name, price, images, description, category")
        .eq("seller_id", sellerId)
        .eq("status", "active")
        .order("created_at", { ascending: false });
      
      if (error) return [];
      return data;
    },
    enabled: !!sellerId,
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "XCD",
      minimumFractionDigits: 0,
    }).format(amount);
  };

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
              {seller.logo_url ? (
                <img
                  src={seller.logo_url}
                  alt={seller.seller_name}
                  className="h-20 w-20 rounded-full object-cover aspect-square"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 font-display text-3xl text-primary aspect-square">
                  {seller.seller_name.charAt(0)}
                </div>
              )}
              <div>
                <h1 className="font-display text-3xl md:text-4xl">
                  {seller.seller_name}
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

            {seller.shop_description && (
              <p className="mt-4 max-w-2xl font-body text-muted-foreground">
                {seller.shop_description}
              </p>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
              {seller.whatsapp ? (
                <Button asChild>
                  <a
                    href={`https://wa.me/${seller.whatsapp.replace(/[\s\-\(\)]/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MessageCircle className="mr-2 h-4 w-4" />
                    Contact Seller
                  </a>
                </Button>
              ) : (
                <ChatButton>
                  Contact Seller
                </ChatButton>
              )}
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

        {/* Seller products */}
        <section className="py-12">
          <div className="container">
            <h2 className="mb-6 font-display text-2xl">PRODUCTS</h2>
            {products.length > 0 ? (
              <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {products.map((product) => (
                  <Link
                    key={product.id}
                    to={`/product/local/${product.id}`}
                    className="group rounded-lg border border-border bg-card overflow-hidden transition-colors active:bg-muted/30"
                  >
                    <div className="aspect-square bg-muted relative overflow-hidden">
                      {product.images?.[0] ? (
                        <img
                          src={product.images[0]}
                          alt={product.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Package className="h-10 w-10 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="font-medium text-sm line-clamp-1">{product.name}</p>
                      {product.category && (
                        <p className="text-xs text-muted-foreground mt-0.5">{product.category}</p>
                      )}
                      <p className="text-sm font-bold text-primary mt-1">
                        {formatCurrency(product.price)}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-border bg-card p-8 text-center">
                <p className="text-muted-foreground">
                  No products listed yet. Contact the seller directly for available items.
                </p>
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
