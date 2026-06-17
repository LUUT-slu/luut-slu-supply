import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Download, Heart, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Row {
  id: string;
  image_url: string;
  generation_type: string;
  product_title: string | null;
  campaign_type: string | null;
  is_favorite: boolean;
  download_count: number;
  created_at: string;
  aspect_ratio: string | null;
}

type Filter = "all" | "poster" | "display" | "video" | "favorites";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "poster", label: "Posters" },
  { key: "display", label: "Display" },
  { key: "video", label: "Videos" },
  { key: "favorites", label: "Favorites" },
];

export default function LibraryTab() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("marketing_generated_images")
      .select("id,image_url,generation_type,product_title,campaign_type,is_favorite,download_count,created_at,aspect_ratio")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      toast.error(error.message);
    } else {
      setRows((data || []) as Row[]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let out = rows;
    if (filter === "favorites") out = out.filter((r) => r.is_favorite);
    else if (filter !== "all") {
      out = out.filter((r) => {
        if (filter === "video") return /video/i.test(r.generation_type);
        return r.generation_type === filter || r.generation_type === `ai_${filter}`;
      });
    }
    const q = search.trim().toLowerCase();
    if (q) {
      out = out.filter((r) =>
        (r.product_title || "").toLowerCase().includes(q) ||
        (r.campaign_type || "").toLowerCase().includes(q),
      );
    }
    return out;
  }, [rows, filter, search]);

  const toggleFavorite = async (r: Row) => {
    const next = !r.is_favorite;
    setRows((prev) => prev.map((x) => x.id === r.id ? { ...x, is_favorite: next } : x));
    const { error } = await supabase
      .from("marketing_generated_images")
      .update({ is_favorite: next })
      .eq("id", r.id);
    if (error) {
      toast.error(error.message);
      setRows((prev) => prev.map((x) => x.id === r.id ? { ...x, is_favorite: !next } : x));
    }
  };

  const handleDownload = async (r: Row) => {
    try {
      const res = await fetch(r.image_url);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${r.product_title || "asset"}-${r.id.slice(0, 6)}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      await supabase
        .from("marketing_generated_images")
        .update({ download_count: r.download_count + 1 })
        .eq("id", r.id);
      setRows((prev) => prev.map((x) => x.id === r.id ? { ...x, download_count: x.download_count + 1 } : x));
    } catch {
      toast.error("Download failed");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`rounded-full border px-3 py-1 text-xs ${
              filter === f.key ? "border-foreground bg-foreground text-background" : "border-border"
            }`}
          >
            {f.label}
          </button>
        ))}
        <div className="ml-auto w-full sm:w-64">
          <Input
            placeholder="Search by product or campaign…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded border border-dashed py-16 text-center text-sm text-muted-foreground">
          No assets yet. Generate some posters or display images to fill your library.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((r) => (
            <Card key={r.id} className="overflow-hidden">
              <a href={r.image_url} target="_blank" rel="noopener noreferrer" className="block">
                <img src={r.image_url} alt={r.product_title || ""} className="aspect-square w-full object-cover" />
              </a>
              <CardContent className="space-y-2 p-3">
                <div className="truncate text-xs font-medium">{r.product_title || "Untitled"}</div>
                <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
                  <span>{r.generation_type}</span>
                  <span>{r.aspect_ratio || ""}</span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => handleDownload(r)}>
                    <Download className="mr-1 h-3 w-3" /> {r.download_count || 0}
                  </Button>
                  <Button
                    variant={r.is_favorite ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleFavorite(r)}
                    aria-label="Favorite"
                  >
                    <Heart className={`h-3 w-3 ${r.is_favorite ? "fill-current" : ""}`} />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
