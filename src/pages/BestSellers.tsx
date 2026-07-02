import { useState, useEffect, useRef } from "react";
import { SEO } from "@/components/SEO";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ChatButton } from "@/components/ChatButton";
import { BackButton } from "@/components/BackButton";
import { ReviewPopup } from "@/components/ReviewPopup";
import { UnifiedProductCard } from "@/components/UnifiedProductCard";
import { BestSellerCard } from "@/components/BestSellerCard";
import { useBestSellersUnified } from "@/hooks/useBestSellersUnified";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { Package, Star } from "lucide-react";
import { ProductGridSkeleton } from "@/components/skeletons/ProductGridSkeleton";

interface Review {
  id: string;
  reviewer_name: string | null;
  rating: number;
  comment: string | null;
  image_urls: string[] | null;
  created_at: string;
}

export default function BestSellers() {
  const { entries: bestSellerEntries, isLoading: loading, source } = useBestSellersUnified(24);
  const isMobile = useIsMobile();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const loggedRef = useRef(false);

  useEffect(() => {
    if (!loggedRef.current && source !== 'none') {
      console.info(`[best-sellers] source=${source}`);
      loggedRef.current = true;
    }
  }, [source]);

  useEffect(() => {
    supabase
      .from("reviews")
      .select("id, reviewer_name, rating, comment, image_urls, created_at")
      .eq("status", "approved")
      .order("rating", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        setReviews((data as Review[]) || []);
        setReviewsLoading(false);
      });
  }, []);

  const avgRating = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SEO title="Best Sellers — Luut SLU" description="Top-selling streetwear, footwear and accessories on Luut SLU, ranked by what Saint Lucia shoppers are buying." path="/shop/best-sellers" />
      <Header />

      <main className="flex-1">
        <section className="border-b border-border bg-card px-4 py-8 md:py-12">
          <div className="container">
            <BackButton />
            <h1 className="font-display text-3xl md:text-5xl">BEST SELLERS</h1>
            <p className="mt-2 font-body text-muted-foreground">
              Top products ranked by real sales performance
            </p>
          </div>
        </section>

        <section className="py-8 md:py-12">
          <div className="container">
            {loading ? (
              <ProductGridSkeleton count={isMobile ? 6 : 8} className="grid gap-3 md:gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4" />
            ) : bestSellerEntries.length === 0 ? (
              <div className="text-center py-12">
                <Package className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                <p className="text-muted-foreground">
                  No best sellers data yet. Check back after more sales!
                </p>
              </div>
            ) : isMobile ? (
              <div className="grid grid-cols-2 gap-3">
                {bestSellerEntries.map(({ product, totalSold }, index) => (
                  <BestSellerCard
                    key={product.id}
                    product={product}
                    rank={index + 1}
                    totalSold={totalSold}
                    priority={index < 4}
                  />
                ))}
              </div>
            ) : (
              <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {bestSellerEntries.map(({ product }, index) => (
                  <div key={product.id} className="relative">
                    {index < 3 && (
                      <div className="pointer-events-none absolute -top-2 -right-2 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-primary font-display text-xs text-primary-foreground shadow-md">
                        #{index + 1}
                      </div>
                    )}
                    <UnifiedProductCard product={product} priority={index < 4} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Customer Reviews Section */}
        <section className="border-t border-border py-12 md:py-16">
          <div className="container">
            <div className="mb-8 text-center">
              <h2 className="font-display text-xl md:text-2xl tracking-tight">
                CUSTOMER REVIEWS
              </h2>
              {!reviewsLoading && reviews.length > 0 && (
                <div className="mt-3 flex items-center justify-center gap-2">
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`h-4 w-4 ${
                          s <= Math.round(avgRating)
                            ? "fill-primary text-primary"
                            : "text-muted-foreground/20"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {avgRating.toFixed(1)} · {reviews.length} review{reviews.length !== 1 ? "s" : ""}
                  </span>
                </div>
              )}
            </div>

            {reviewsLoading ? (
              <div className="flex justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : reviews.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">
                  No reviews yet. Be the first to share your experience!
                </p>
                <ReviewPopup />
              </div>
            ) : (
              <>
                <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide">
                  {reviews.map((r) => (
                    <div
                      key={r.id}
                      className="min-w-[280px] max-w-[320px] shrink-0 snap-start rounded-lg border border-border bg-card p-5 flex flex-col gap-3"
                    >
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`h-4 w-4 ${
                              s <= r.rating
                                ? "fill-primary text-primary"
                                : "text-muted-foreground/20"
                            }`}
                          />
                        ))}
                      </div>
                      {r.comment && (
                        <p className="font-body text-sm text-foreground line-clamp-4">
                          "{r.comment}"
                        </p>
                      )}
                      {r.image_urls && r.image_urls.length > 0 && (
                        <div className="flex gap-2">
                          {r.image_urls.slice(0, 2).map((url, i) => (
                            <img
                              key={i}
                              src={url}
                              alt="Review"
                              className="h-16 w-16 rounded-md object-cover border border-border"
                              loading="lazy"
                            />
                          ))}
                        </div>
                      )}
                      <div className="mt-auto flex items-center justify-between text-xs text-muted-foreground">
                        <span className="font-medium">
                          {r.reviewer_name || "Anonymous"}
                        </span>
                        <span>{new Date(r.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-8 text-center">
                  <ReviewPopup />
                </div>
              </>
            )}
          </div>
        </section>
      </main>

      <Footer />
      <ChatButton variant="floating" />
    </div>
  );
}
