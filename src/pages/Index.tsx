import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, MapPin, ShieldCheck, Users, Package, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ProductGrid } from "@/components/ProductGrid";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import storefrontHero from "@/assets/storefront-hero.png";

const heroImages = [
  storefrontHero,
  storefrontHero, // Add more images here as you upload them
  storefrontHero,
];

const meetupLocations = [
  { name: "Castries", description: "Capital city, central location" },
  { name: "Gros Islet", description: "Northern area, Friday night street party" },
  { name: "Rodney Bay", description: "Tourist area, shopping centers" },
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
        <section className="relative min-h-[90vh] flex flex-col overflow-hidden">
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
          {/* Dark gradient overlay - stronger at top and bottom, lighter in center */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/20 to-black/80" />
          
          {/* Top Content - Tagline */}
          <div className="container relative z-10 px-4 pt-24 md:pt-32">
            <div className="mx-auto max-w-3xl text-center">
              <p className="font-body text-lg font-medium text-white md:text-xl" style={{ textShadow: '0 0 20px rgba(200, 210, 255, 0.25), 0 0 40px rgba(180, 190, 255, 0.15)' }}>
                Saint Lucia's streetwear marketplace. We connect you with verified local sellers — they handle meetups & delivery, you pay on pickup.
              </p>
            </div>
          </div>
          
          {/* Bottom Content - Buttons, Link */}
          <div className="container relative z-10 px-4 pb-8 md:pb-12 mt-auto">
            <div className="mx-auto max-w-3xl text-center">
              <div className="flex flex-col gap-4 sm:flex-row sm:justify-center sm:items-center">
                <Button asChild size="lg" className="font-body text-base px-8 py-6 shadow-lg">
                  <Link to="/shop">
                    Shop Outfits
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                <Button asChild variant="ghost" size="sm" className="font-body text-white/80 hover:text-white hover:bg-white/10">
                  <Link to="/shop?filter=new">New Arrivals</Link>
                </Button>
                <Button asChild variant="ghost" size="sm" className="font-body text-white/80 hover:text-white hover:bg-white/10">
                  <Link to="/shop?filter=best">Best Sellers</Link>
                </Button>
              </div>
              <div className="mt-5">
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

        {/* Meet-up Locations */}
        <section className="border-b border-border py-12 md:py-16">
          <div className="container">
            <h2 className="mb-8 text-center font-display text-2xl md:text-3xl">
              MEET-UP LOCATIONS
            </h2>
            <div className="grid gap-4 md:grid-cols-3">
              {meetupLocations.map((location) => (
                <div
                  key={location.name}
                  className="flex items-center gap-4 rounded-lg border border-border bg-card p-6 transition-colors hover:border-primary/50"
                >
                  <MapPin className="h-8 w-8 flex-shrink-0 text-primary" />
                  <div>
                    <h3 className="font-display text-lg">{location.name}</h3>
                    <p className="font-body text-sm text-muted-foreground">
                      {location.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it Works */}
        <section className="border-b border-border bg-card py-12 md:py-16">
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

        {/* CTA Section */}
        <section className="border-t border-border py-12 md:py-16">
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
