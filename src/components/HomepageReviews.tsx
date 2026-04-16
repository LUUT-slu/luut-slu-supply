import { useEffect, useState } from "react";
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

export function HomepageReviews() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("reviews")
      .select("id, reviewer_name, rating, comment, image_urls, created_at")
      .eq("status", "approved")
      .eq("show_on_homepage", true)
      .order("created_at", { ascending: false })
      .limit(10)
      .then(({ data }) => {
        setReviews((data as Review[]) || []);
        setLoading(false);
      });
  }, []);

  if (loading || reviews.length === 0) return null;

  return (
    <section className="border-t border-border py-12 md:py-16">
      <div className="container">
        <h2 className="mb-8 text-center text-xl font-semibold tracking-tight md:text-2xl">
          WHAT OUR CUSTOMERS SAY
        </h2>
        <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide">
          {reviews.map(r => (
            <div
              key={r.id}
              className="min-w-[280px] max-w-[320px] shrink-0 snap-start rounded-lg border border-border bg-card p-5 flex flex-col gap-3"
            >
              <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map(s => (
                  <Star
                    key={s}
                    className={`h-4 w-4 ${s <= r.rating ? "fill-primary text-primary" : "text-muted-foreground/20"}`}
                  />
                ))}
              </div>
              {r.comment && (
                <p className="font-body text-sm text-foreground line-clamp-4">"{r.comment}"</p>
              )}
              {r.image_urls && r.image_urls.length > 0 && (
                <div className="flex gap-2">
                  {r.image_urls.map((url, i) => (
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
                <span className="font-medium">{r.reviewer_name || "Anonymous"}</span>
                <span>{new Date(r.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
