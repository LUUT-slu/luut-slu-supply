import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Star, Check, X, Trash2, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Review {
  id: string;
  reviewer_name: string | null;
  rating: number;
  comment: string | null;
  image_urls: string[] | null;
  status: string;
  show_on_homepage: boolean;
  created_at: string;
}

export default function AdminReviews() {
  const navigate = useNavigate();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [acting, setActing] = useState<string | null>(null);

  const fetch = async () => {
    setLoading(true);
    let q = supabase
      .from("reviews")
      .select("*")
      .order("created_at", { ascending: false });
    if (filter !== "all") q = q.eq("status", filter);
    const { data } = await q;
    setReviews((data as Review[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetch(); }, [filter]);

  const update = async (id: string, fields: Partial<Review>) => {
    setActing(id);
    const { error } = await supabase.from("reviews").update(fields).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Updated"); fetch(); }
    setActing(null);
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this review?")) return;
    setActing(id);
    const { error } = await supabase.from("reviews").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Deleted"); fetch(); }
    setActing(null);
  };

  const statusColor = (s: string) =>
    s === "approved" ? "bg-green-500/10 text-green-600" :
    s === "rejected" ? "bg-red-500/10 text-red-600" :
    "bg-yellow-500/10 text-yellow-600";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-border/50 bg-background/95 backdrop-blur">
        <div className="container flex h-14 items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="font-display text-lg">Review Management</h1>
        </div>
      </header>

      <main className="container flex-1 py-4 space-y-4">
        <div className="flex items-center gap-3">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">{reviews.length} reviews</span>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : reviews.length === 0 ? (
          <p className="text-center py-12 text-muted-foreground">No reviews found.</p>
        ) : (
          <div className="grid gap-3">
            {reviews.map(r => (
              <Card key={r.id} className="overflow-hidden">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex gap-0.5 mb-1">
                        {[1, 2, 3, 4, 5].map(s => (
                          <Star key={s} className={`h-4 w-4 ${s <= r.rating ? "fill-primary text-primary" : "text-muted-foreground/20"}`} />
                        ))}
                      </div>
                      <p className="text-sm font-medium">{r.reviewer_name || "Anonymous"}</p>
                      <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</p>
                    </div>
                    <Badge className={statusColor(r.status)}>{r.status}</Badge>
                  </div>

                  {r.comment && <p className="text-sm text-foreground">"{r.comment}"</p>}

                  {r.image_urls && r.image_urls.length > 0 && (
                    <div className="flex gap-2">
                      {r.image_urls.map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noreferrer">
                          <img src={url} alt="" className="h-16 w-16 rounded-md object-cover border border-border" />
                        </a>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 pt-1">
                    {r.status !== "approved" && (
                      <Button size="sm" variant="outline" className="gap-1 text-green-600" disabled={acting === r.id}
                        onClick={() => update(r.id, { status: "approved" })}>
                        <Check className="h-3 w-3" /> Approve
                      </Button>
                    )}
                    {r.status !== "rejected" && (
                      <Button size="sm" variant="outline" className="gap-1 text-red-600" disabled={acting === r.id}
                        onClick={() => update(r.id, { status: "rejected" })}>
                        <X className="h-3 w-3" /> Reject
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="gap-1" disabled={acting === r.id}
                      onClick={() => update(r.id, { show_on_homepage: !r.show_on_homepage })}>
                      {r.show_on_homepage ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      {r.show_on_homepage ? "Hide" : "Show on Homepage"}
                    </Button>
                    <Button size="sm" variant="ghost" className="gap-1 text-destructive" disabled={acting === r.id}
                      onClick={() => remove(r.id)}>
                      <Trash2 className="h-3 w-3" /> Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
