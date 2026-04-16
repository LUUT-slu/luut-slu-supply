import { Link } from "react-router-dom";
import { ArrowRight, MapPin, ShieldCheck, Users, Package, MessageCircle, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ChatButton } from "@/components/ChatButton";
import { BestSellersSection } from "@/components/BestSellersSection";
import { WhatPeopleAreBuyingSection } from "@/components/WhatPeopleAreBuyingSection";
import { HomeCategorySection } from "@/components/HomeCategorySection";
import { HomeFeaturedSection } from "@/components/HomeFeaturedSection";
import { HomeNewArrivalsSection } from "@/components/HomeNewArrivalsSection";
import { useSiteSettings, DEFAULT_HERO } from "@/hooks/useSiteSettings";
import storefrontHero from "@/assets/storefront-hero.webp";
import { SignupDiscountPopup } from "@/components/SignupDiscountPopup";
import { HomepageReviews } from "@/components/HomepageReviews";
import { AIChatWidget } from "@/components/AIChatWidget";

const howItWorks = [
  { step: 1, title: "Browse Products", description: "Explore outfits from verified local sellers on our marketplace", icon: Package },
  { step: 2, title: "Message the Seller", description: "Contact the seller on WhatsApp to confirm details and arrange meetup", icon: MessageCircle },
  { step: 3, title: "Meet & Pay", description: "The seller meets you at a safe location — pay them directly in cash", icon: MapPin },
];

const trustPoints = [
  { icon: ShieldCheck, title: "Verified Sellers", description: "Every vendor is vetted before joining" },
  { icon: Users, title: "Marketplace Platform", description: "We connect you with local sellers" },
  { icon: Package, title: "Luut Certified", description: "Luut SLU is also a certified vendor" },
];

export default function Index() {
  const { data: settings } = useSiteSettings();
  const layout = settings?.homepageLayout;
  const hero = layout?.hero || DEFAULT_HERO;
  const heroImage = hero.imageUrl || storefrontHero;
  const sections = layout?.sections?.filter(s => s.enabled) || [];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className="flex-1">
        {/* Trust bar — DHgate inspired horizontal strip */}
        <div className="border-b border-border bg-card">
          <div className="container py-2.5">
            <div className="flex items-center justify-center gap-6 md:gap-10 text-xs text-muted-foreground overflow-x-auto scrollbar-hide">
              {trustPoints.map(({ icon: Icon, title, description }) => (
                <div key={title} className="flex items-center gap-2 shrink-0">
                  <Icon className="h-4 w-4 text-trust shrink-0" />
                  <span className="font-medium text-foreground">{title}</span>
                  <span className="hidden sm:inline">— {description}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Hero Section — compact marketplace style */}
        <section className="relative overflow-hidden bg-foreground">
          <div className="absolute inset-0">
            <img
              src={heroImage}
              alt="Luut SLU storefront"
              className="w-full h-full object-cover opacity-60"
              width={1920}
              height={1080}
              fetchPriority="high"
              decoding="sync"
              sizes="100vw"
            />
          </div>
          <div className="container relative z-10 py-16 md:py-24 px-4">
            <div className="max-w-xl">
              {hero.heading && (
                <h1 className="mb-3 font-display text-2xl text-white md:text-4xl font-bold">{hero.heading}</h1>
              )}
              {hero.subheading && (
                <p className="mb-5 font-body text-sm text-white/70 md:text-base max-w-md">{hero.subheading}</p>
              )}
              <div className="flex-wrap gap-3 text-left flex items-center justify-center">
                {hero.buttonText && (
                  <Button asChild size="default" className="font-body shadow-lg">
                    <Link to={hero.buttonLink || "/shop"}>
                      {hero.buttonText}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                )}
                <Button asChild variant="outline" size="default" className="font-body bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white">
                  <Link to="/shop/best-sellers">Best Sellers</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Dynamic sections — each in its own block */}
        {sections.map((section) => {
          switch (section.type) {
            case "trending":
              return <WhatPeopleAreBuyingSection key={section.id} />;
            case "best_sellers":
              return <BestSellersSection key={section.id} />;
            case "new_arrivals":
              return <HomeNewArrivalsSection key={section.id} label={section.label} limit={section.limit} />;
            case "featured":
              return (
                <HomeFeaturedSection
                  key={section.id}
                  label={section.label}
                  productIds={section.featuredProductIds || []}
                  limit={section.limit}
                />
              );
            case "category":
              return (
                <HomeCategorySection
                  key={section.id}
                  slug={section.slug || ""}
                  label={section.label}
                  limit={section.limit}
                />
              );
            default:
              return null;
          }
        })}

        {/* Customer Reviews */}
        <HomepageReviews />

        {/* How it Works — structured block */}
        <section className="bg-card border-t border-border">
          <div className="container py-10 md:py-14">
            <h2 className="mb-8 text-center text-lg font-bold tracking-tight text-foreground md:text-xl uppercase">
              How It Works
            </h2>
            <div className="grid gap-6 md:grid-cols-3">
              {howItWorks.map(({ step, title, description, icon: Icon }) => (
                <div key={step} className="flex items-start gap-4 rounded-lg border border-border bg-background p-5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold text-muted-foreground/50 uppercase mb-0.5">Step {step}</div>
                    <h3 className="text-sm font-semibold text-foreground mb-1">{title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="border-t border-border bg-background py-10 md:py-14">
          <div className="container">
            <div className="mx-auto max-w-lg rounded-xl border border-border bg-card p-6 text-center md:p-10 shadow-[var(--shadow-card)]">
              <h2 className="mb-2 text-lg font-bold tracking-tight text-foreground md:text-xl">
                Ready to Shop?
              </h2>
              <p className="mb-5 text-sm text-muted-foreground">
                Browse our collection or start a chat with us
              </p>
              <div className="flex flex-col gap-2.5 sm:flex-row sm:justify-center">
                <Button asChild size="default">
                  <Link to="/shop">Browse Outfits</Link>
                </Button>
                <ChatButton size="default" />
              </div>
              <div className="mt-4">
                <Link to="/sell" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                  Want to sell? Join as a vendor →
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
      <SignupDiscountPopup />
      <ChatButton variant="floating" />
      <AIChatWidget />
    </div>
  );
}
