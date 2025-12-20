import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, MapPin, ShieldCheck, Users, Package, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ProductGrid } from "@/components/ProductGrid";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { BestSellersSection } from "@/components/BestSellersSection";
import { WhatPeopleAreBuyingSection } from "@/components/WhatPeopleAreBuyingSection";
import storefrontHero from "@/assets/storefront-hero.png";

const heroImages = [
  storefrontHero,
  storefrontHero, // Add more images here as you upload them
  storefrontHero,
];

const howItWorks = [
  {
    step: 1,
    title: "Browse Products",
    description: "Explore outfits from verified local sellers on our marketplace",
    icon: Package,
  },
  {
    step: 2,
    title: "Message the Seller",
    description: "Contact the seller on WhatsApp to confirm details and arrange meetup",
    icon: MessageCircle,
  },
  {
    step: 3,
    title: "Meet & Pay",
    description: "The seller meets you at a safe location — pay them directly in cash",
    icon: MapPin,
  },
];

const trustPoints = [
  {
    icon: ShieldCheck,
    title: "Verified Sellers",
    description: "Every vendor is vetted before joining our marketplace",
  },
  {
    icon: Users,
    title: "Marketplace Platform",
    description: "We connect you with local sellers who handle meetups & delivery",
  },
  {
    icon: Package,
    title: "Luut Certified",
    description: "Luut SLU also sells as a certified vendor on the platform",
  },
];

export default function Index() {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % heroImages.length);
    }, 5000); // Change image every 5 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative min-h-[90vh] flex flex-col justify-end overflow-hidden">
          {/* Background Images - Dynamic with crossfade */}
          {heroImages.map((image, index) => (
            <div
              key={index}
              className={`absolute inset-0 transition-opacity duration-1000 ${
                index === currentImageIndex ? "opacity-100" : "opacity-0"
              }`}
            >
              <img 
                src={image} 
                alt={`Luut SLU storefront ${index + 1}`} 
                className="w-full h-full object-cover"
              />
            </div>
          ))}
          {/* Dark gradient overlay - lighter at top, stronger at bottom */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/40 to-black/90" />
          
          {/* Bottom Content - Description, Buttons, Link */}
          <div className="container relative z-10 px-4 pb-8 md:pb-12">
            <div className="mx-auto max-w-3xl text-center">
              <div className="flex flex-col gap-4 sm:flex-row sm:justify-center sm:items-center">
                <Button asChild size="lg" className="font-body text-base px-8 py-6 shadow-lg animate-fade-in opacity-0" style={{ animationDelay: "0.2s", animationFillMode: "forwards" }}>
                  <Link to="/shop">
                    Shop Outfits
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                <Button asChild variant="ghost" size="sm" className="font-body text-white/80 hover:text-white hover:bg-white/10 animate-fade-in opacity-0" style={{ animationDelay: "0.4s", animationFillMode: "forwards" }}>
                  <Link to="/shop?filter=new">New Arrivals</Link>
                </Button>
                <Button asChild variant="ghost" size="sm" className="font-body text-white/80 hover:text-white hover:bg-white/10 animate-fade-in opacity-0" style={{ animationDelay: "0.6s", animationFillMode: "forwards" }}>
                  <Link to="/shop?filter=best">Best Sellers</Link>
                </Button>
              </div>
              <div className="mt-5 animate-fade-in opacity-0" style={{ animationDelay: "0.8s", animationFillMode: "forwards" }}>
                <Link
                  to="/sell"
                  className="font-body text-sm text-primary underline-offset-4 hover:underline"
                >
                  Want to sell? Join as a vendor →
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* What People Are Buying - Social proof section */}
        <WhatPeopleAreBuyingSection />

        {/* Products */}
        <section className="py-12 md:py-16">
          <div className="container">
            <div className="mb-8 flex items-center justify-between">
              <h2 className="font-display text-2xl md:text-3xl">LATEST DROPS</h2>
              <Button asChild variant="ghost" className="font-body">
                <Link to="/shop">
                  View All
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
            <ProductGrid limit={8} />
          </div>
        </section>

        {/* Luut SLU Products */}
        <section className="py-12 md:py-16 bg-card/50">
          <div className="container">
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h2 className="font-display text-2xl md:text-3xl">FROM LUUT SLU</h2>
                <p className="mt-1 font-body text-sm text-muted-foreground">
                  Our own curated collection
                </p>
              </div>
              <Button asChild variant="ghost" className="font-body">
                <Link to="/shop?vendor=luut-slu">
                  View All
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
            <ProductGrid query="vendor:Luut SLU" limit={4} />
          </div>
        </section>

        {/* Trust Section */}
        <section className="border-t border-border bg-card py-12 md:py-16">
          <div className="container">
            <h2 className="mb-10 text-center font-display text-2xl md:text-3xl">
              WHY SHOP WITH LUUT
            </h2>
            <div className="grid gap-6 md:grid-cols-3">
              {trustPoints.map(({ icon: Icon, title, description }) => (
                <div
                  key={title}
                  className="rounded-lg border border-border bg-background p-6 text-center"
                >
                  <Icon className="mx-auto mb-4 h-10 w-10 text-trust" />
                  <h3 className="mb-2 font-display text-lg">{title}</h3>
                  <p className="font-body text-sm text-muted-foreground">
                    {description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Best Sellers This Week */}
        <BestSellersSection />

        {/* How it Works */}
        <section className="border-y border-border py-12 md:py-16">
          <div className="container">
            <h2 className="mb-10 text-center font-display text-2xl md:text-3xl">
              HOW IT WORKS
            </h2>
            <div className="grid gap-8 md:grid-cols-3">
              {howItWorks.map(({ step, title, description, icon: Icon }) => (
                <div key={step} className="text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                    <Icon className="h-8 w-8 text-primary" />
                  </div>
                  <div className="mb-2 font-display text-4xl text-primary/30">
                    0{step}
                  </div>
                  <h3 className="mb-2 font-display text-xl">{title}</h3>
                  <p className="font-body text-sm text-muted-foreground">
                    {description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-12 md:py-16">
          <div className="container">
            <div className="mx-auto max-w-2xl rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 p-8 text-center md:p-12">
              <h2 className="mb-4 font-display text-2xl md:text-3xl">
                READY TO SHOP?
              </h2>
              <p className="mb-6 font-body text-muted-foreground">
                Browse our collection or message us directly on WhatsApp
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                <Button asChild size="lg">
                  <Link to="/shop">Browse Outfits</Link>
                </Button>
                <WhatsAppButton size="lg" />
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
      <WhatsAppButton variant="floating" />
    </div>
  );
}
