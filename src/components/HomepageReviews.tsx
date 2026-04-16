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
    <section className="border-t border-border bg-background py-10 md:py-14">
      <div className="container">
        <h2 className="mb-6 text-lg font-bold tracking-tight text-foreground uppercase md:text-xl">
          What Our Customers Say
        </h2>
        <div className="flex gap-3 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide">
          {reviews.map(r => (
            <div
              key={r.id}
              className="min-w-[260px] max-w-[300px] shrink-0 snap-start rounded-lg border border-border bg-card p-4 flex flex-col gap-2.5"
            >
              <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map(s => (
                  <Star
                    key={s}
                    className={`h-3.5 w-3.5 ${s <= r.rating ? "fill-amber-400 text-amber-400" : "text-border"}`}
                  />
                ))}
              </div>
              {r.comment && (
                <p className="font-body text-xs text-foreground leading-relaxed line-clamp-4">"{r.comment}"</p>
              )}
              {r.image_urls && r.image_urls.length > 0 && (
                <div className="flex gap-1.5">
                  {r.image_urls.map((url, i) => (
                    <img
                      key={i}
                      src={url}
                      alt="Review"
                      className="h-14 w-14 rounded object-cover border border-border"
                      loading="lazy"
                    />
                  ))}
                </div>
              )}
              <div className="mt-auto flex items-center justify-between text-[10px] text-muted-foreground pt-2 border-t border-border/50">
                <span className="font-medium text-foreground">{r.reviewer_name || "Anonymous"}</span>
                <span>{new Date(r.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
