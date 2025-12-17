import { useParams, Link, useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { ProductGrid } from "@/components/ProductGrid";
import { ShieldCheck, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

// Seller data - in production, this would fetch from a vendor database
const getSellerInfo = (id: string) => {
  if (id === "luut-slu") {
    return {
      id: "luut-slu",
      name: "Luut SLU",
      badge: "Certified Seller",
      description:
        "As the platform owner, Luut SLU also operates as a certified seller with our own curated streetwear collection. Shop directly from the source with platform-guaranteed quality.",
      isCertified: true,
      vendorQuery: "vendor:Luut SLU",
    };
  }
  return null;
};

export default function SellerProfile() {
  const { sellerId } = useParams<{ sellerId: string }>();
  const navigate = useNavigate();
  const seller = sellerId ? getSellerInfo(sellerId) : null;

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
                  {seller.name} {seller.isCertified && "(Certified Seller)"}
                </h1>
                {seller.isCertified && (
                  <div className="mt-2 flex items-center gap-2 text-trust">
                    <ShieldCheck className="h-5 w-5" />
                    <span className="font-body text-sm">{seller.badge}</span>
                  </div>
                )}
              </div>
            </div>
            <p className="mt-4 max-w-2xl font-body text-muted-foreground">
              {seller.description}
            </p>
            <div className="mt-6">
              <WhatsAppButton
                message={`Hi! I'm interested in products from ${seller.name}.`}
              >
                Contact Seller
              </WhatsAppButton>
            </div>
          </div>
        </section>

        {/* Seller products */}
        <section className="py-12">
          <div className="container">
            <h2 className="mb-8 font-display text-2xl">
              PRODUCTS BY {seller.name.toUpperCase()}
            </h2>
            <ProductGrid query={seller.vendorQuery} limit={50} />
          </div>
        </section>
      </main>

      <Footer />
      <WhatsAppButton variant="floating" />
    </div>
  );
}
