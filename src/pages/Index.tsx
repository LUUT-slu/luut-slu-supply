import { lazy, Suspense } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Link } from "react-router-dom";
import { ArrowRight, MapPin, ShieldCheck, Users, Package, MessageCircle } from "lucide-react";
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
import storefrontHeroDesktop from "@/assets/storefront-hero-desktop.webp";
import storefrontHeroMobile from "@/assets/storefront-hero-mobile.webp";
import { SignupDiscountPopup } from "@/components/SignupDiscountPopup";
import { HomepageReviews } from "@/components/HomepageReviews";
import { AIChatWidget } from "@/components/AIChatWidget";
import { HeroSlider } from "@/components/home/HeroSlider";
import { InStockNowSection } from "@/components/home/InStockNowSection";
import { MobileBottomNav } from "@/components/home/MobileBottomNav";

const howItWorks = [
  { step: 1, title: "Browse Products", description: "Explore outfits from verified local sellers on our marketplace", icon: Package },
  { step: 2, title: "Message the Seller", description: "Contact the seller on WhatsApp to confirm details and arrange meetup", icon: MessageCircle },
  { step: 3, title: "Meet & Pay", description: "The seller meets you at a safe location — pay them directly in cash", icon: MapPin },
];

const trustPoints = [
  { icon: ShieldCheck, title: "Verified Sellers", description: "Every vendor is vetted before joining our marketplace" },
  { icon: Users, title: "Marketplace Platform", description: "We connect you with local sellers who handle meetups & delivery" },
  { icon: Package, title: "Luut Certified", description: "Luut SLU also sells as a certified vendor on the platform" },
];

export default function Index() {
  const isMobile = useIsMobile();
  const { data: settings } = useSiteSettings();
  const layout = settings?.homepageLayout;
  const hero = layout?.hero || DEFAULT_HERO;
  const customHeroImage = hero.imageUrl;
  const heroImageDesktop = customHeroImage || storefrontHeroDesktop;
  const heroImageMobile = customHeroImage || storefrontHeroMobile;
  const sections = layout?.sections?.filter(s => s.enabled) || [];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className={`flex-1 ${isMobile ? "pb-20" : ""}`}>
        {/* HERO — mobile uses cinematic slider; desktop keeps existing layout */}
        {isMobile ? (
          <HeroSlider />
        ) : (
          <section className="relative min-h-[90vh] flex flex-col justify-end overflow-hidden">
            <div className="absolute inset-0">
              <picture>
                <source media="(max-width: 768px)" srcSet={heroImageMobile} />
                <img
                  src={heroImageDesktop}
                  alt="Luut SLU storefront"
                  className="w-full h-full object-cover opacity-70"
                  width={1600}
                  height={1600}
                  fetchPriority="high"
                  decoding="async"
                  sizes="100vw"
                />
              </picture>
            </div>
            <div className="container relative z-10 px-4 pb-8 md:pb-12" style={{ background: 'linear-gradient(to top, hsl(0 0% 0% / 0.85) 0%, hsl(0 0% 0% / 0.4) 60%, transparent 100%)' }}>
              <div className="mx-auto max-w-3xl text-center">
                {hero.heading && <h1 className="mb-3 font-display text-3xl text-white md:text-5xl">{hero.heading}</h1>}
                {hero.subheading && <p className="mb-5 font-body text-base text-white/70 md:text-lg">{hero.subheading}</p>}
                <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
                  {hero.buttonText && (
                    <Button asChild size="default" className="w-auto font-body shadow-lg">
                      <Link to={hero.buttonLink || "/shop"}>{hero.buttonText}<ArrowRight className="ml-2 h-4 w-4" /></Link>
                    </Button>
                  )}
                  {hero.secondaryButtonText && (
                    <Button asChild variant="ghost" size="sm" className="w-auto font-body text-white/80 hover:text-white hover:bg-white/10">
                      <Link to={hero.secondaryButtonLink || "/shop"}>{hero.secondaryButtonText}</Link>
                    </Button>
                  )}
                  <Button asChild variant="ghost" size="sm" className="w-auto font-body text-white/80 hover:text-white hover:bg-white/10">
                    <Link to="/shop/best-sellers">Best Sellers</Link>
                  </Button>
                </div>
                <div className="mt-5">
                  <Link to="/sell" className="font-body text-sm text-primary underline-offset-4 hover:underline">
                    Want to sell? Join as a vendor →
                  </Link>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* IN STOCK NOW — mobile-first pill-filtered section */}
        {isMobile && <InStockNowSection />}

        {/* Dynamic sections — rendered in order from settings */}
        {sections.map((section) => {
          switch (section.type) {
            case "trending":
              return <WhatPeopleAreBuyingSection key={section.id} />;
            case "best_sellers":
              return <BestSellersSection key={section.id} limit={section.limit} />;
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
                  subtitle={section.subtitle}
                  limit={section.limit}
                />
              );
            default:
              return null;
          }
        })}

        {/* Customer Reviews */}
        <HomepageReviews />

        {/* Trust Section */}
        <section className="border-t border-border bg-card py-12 md:py-16">
          <div className="container">
            <h2 className="mb-10 text-center text-xl font-semibold tracking-tight md:text-2xl">
              WHY SHOP WITH LUUT
            </h2>
            <div className="grid gap-6 md:grid-cols-3">
              {trustPoints.map(({ icon: Icon, title, description }) => (
                <div key={title} className="rounded-lg border border-border bg-background p-6 text-center">
                  <Icon className="mx-auto mb-4 h-10 w-10 text-trust" />
                  <h3 className="mb-2 text-base font-semibold">{title}</h3>
                  <p className="font-body text-sm text-muted-foreground">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it Works */}
        <section className="border-y border-border py-12 md:py-16">
          <div className="container">
            <h2 className="mb-10 text-center text-xl font-semibold tracking-tight md:text-2xl">HOW IT WORKS</h2>
            <div className="grid gap-8 md:grid-cols-3">
              {howItWorks.map(({ step, title, description, icon: Icon }) => (
                <div key={step} className="text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                    <Icon className="h-8 w-8 text-primary" />
                  </div>
                  <div className="mb-2 text-4xl font-bold text-primary/30">0{step}</div>
                  <h3 className="mb-2 text-lg font-semibold">{title}</h3>
                  <p className="font-body text-sm text-muted-foreground">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-12 md:py-16">
          <div className="container">
            <div className="mx-auto max-w-2xl rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 p-8 text-center md:p-12">
              <h2 className="mb-4 text-xl font-semibold tracking-tight md:text-2xl">READY TO SHOP?</h2>
              <p className="mb-6 font-body text-muted-foreground">Browse our collection or start a chat with us</p>
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                <Button asChild size="lg"><Link to="/shop">Browse Outfits</Link></Button>
                <ChatButton size="lg" />
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
      <SignupDiscountPopup />
      <ChatButton variant="floating" />
      <AIChatWidget />
      <MobileBottomNav />
    </div>
  );
}
