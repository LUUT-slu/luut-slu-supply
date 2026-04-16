import { useState, useEffect } from "react";
import { Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Review {
  id: string;
  reviewer_name: string | null;
  rating: number;
  comment: string | null;
  image_urls: string[] | null;
  created_at: string;
}

interface ProductReviewsProps {
  productHandle: string;
  productTitle: string;
}

export function ProductReviews({ productHandle, productTitle }: ProductReviewsProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchReviews() {
      const { data } = await supabase
        .from("reviews")
        .select("id, reviewer_name, rating, comment, image_urls, created_at")
        .eq("product_handle", productHandle)
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(20);
      setReviews((data as Review[]) || []);
      setLoading(false);
    }
    fetchReviews();
  }, [productHandle]);

  if (loading || reviews.length === 0) return null;

  const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm tracking-wide">CUSTOMER REVIEWS</h3>
        <div className="flex items-center gap-1.5">
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star
                key={s}
                className={`h-3.5 w-3.5 ${
                  s <= Math.round(avgRating)
                    ? "fill-primary text-primary"
                    : "text-muted-foreground/20"
                }`}
              />
            ))}
          </div>
          <span className="text-xs text-muted-foreground">
            ({reviews.length})
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {reviews.map((review) => (
          <div
            key={review.id}
            className="rounded-lg border border-border bg-card p-3 space-y-2"
          >
            <div className="flex items-center justify-between">
              <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className={`h-3 w-3 ${
                      s <= review.rating
                        ? "fill-primary text-primary"
                        : "text-muted-foreground/20"
                    }`}
                  />
                ))}
              </div>
              <span className="text-[10px] text-muted-foreground">
                {new Date(review.created_at).toLocaleDateString()}
              </span>
            </div>

            <p className="text-xs font-medium">
              {review.reviewer_name || "Anonymous"}
            </p>

            {review.comment && (
              <p className="text-xs text-muted-foreground leading-relaxed">
                "{review.comment}"
              </p>
            )}

            {review.image_urls && review.image_urls.length > 0 && (
              <div className="flex gap-2">
                {review.image_urls.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noreferrer">
                    <img
                      src={url}
                      alt=""
                      className="h-16 w-16 rounded-md object-cover border border-border"
                    />
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
