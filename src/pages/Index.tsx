import { useIsMobile } from "@/hooks/use-mobile";
import { Link } from "react-router-dom";
import { MapPin, ShieldCheck, Users, Package, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ChatButton } from "@/components/ChatButton";
import { BestSellersSection } from "@/components/BestSellersSection";
import { WhatPeopleAreBuyingSection } from "@/components/WhatPeopleAreBuyingSection";
import { HomeCategorySection } from "@/components/HomeCategorySection";
import { HomeFeaturedSection } from "@/components/HomeFeaturedSection";
import { HomeNewArrivalsSection } from "@/components/HomeNewArrivalsSection";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { SignupDiscountPopup } from "@/components/SignupDiscountPopup";
import { HomepageReviews } from "@/components/HomepageReviews";
import { HeroSlider } from "@/components/home/HeroSlider";
import { MarketplaceFeed } from "@/components/home/MarketplaceFeed";
import { MobileBottomNav } from "@/components/home/MobileBottomNav";
import { PromoCollectionSection } from "@/components/home/PromoCollectionSection";
import { useActivePromotionCampaigns } from "@/hooks/usePromotionCampaigns";
import { LocaleDetectBanner } from "@/components/locale/LocaleDetectBanner";

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
  const { data: activeCampaigns } = useActivePromotionCampaigns();
  const layout = settings?.homepageLayout;
  const enabledSections = layout?.sections?.filter(s => s.enabled) || [];


  // Find best-matching active campaign for a promo_collection section
  const matchCampaign = (handle?: string) => {
    if (!handle || !activeCampaigns?.length) return undefined;
    const h = handle.toLowerCase();
    const matches = activeCampaigns.filter(
      (c) =>
        c.target_mode === "collections" &&
        Array.isArray(c.target_collections) &&
        c.target_collections.some((th) => th.toLowerCase() === h),
    );
    if (!matches.length) return undefined;
    return matches.sort((a, b) => (Number(b.priority) || 0) - (Number(a.priority) || 0))[0];
  };

  // PROMOS is pinned to a fixed slot directly below the hero and above the
  // category chip scroll / desktop sections. We always render the first
  // enabled promo_collection section there, and skip it in the regular
  // sections loop so it never duplicates.
  const promoSection = enabledSections.find((s) => s.type === "promo_collection");
  const sections = enabledSections;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <LocaleDetectBanner />


      <main className={`flex-1 ${isMobile ? "pb-20" : ""}`}>
        {/* HERO — unified cinematic slider on all viewports */}
        <HeroSlider />

        {/* PROMOS — pinned slot directly below the hero, above the marketplace feed */}
        {promoSection && (() => {
          const handle = promoSection.promoCollectionHandle || promoSection.slug || "";
          return (
            <PromoCollectionSection
              slug={handle}
              label={promoSection.label}
              subtitle={promoSection.subtitle}
              limit={promoSection.limit}
              badgeLabel={promoSection.badgeLabel}
              matchedCampaign={matchCampaign(handle)}
              showEmptyState={promoSection.showEmptyState}
              emptyStateMessage={promoSection.emptyStateMessage}
              autoScan={promoSection.autoScan !== false}
            />
          );
        })()}

        {/* MARKETPLACE FEED — Shopify-synced unified feed on all viewports */}
        <MarketplaceFeed />

        {/* Dynamic admin-configured sections — render on mobile and desktop */}
        {sections.map((section) => {
          switch (section.type) {
            case "trending":
              return <WhatPeopleAreBuyingSection key={section.id} />;
            case "promo_collection":
              // Rendered in the pinned slot above — skip here to avoid duplicating
              return null;
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
      <MobileBottomNav />
    </div>
  );
}
