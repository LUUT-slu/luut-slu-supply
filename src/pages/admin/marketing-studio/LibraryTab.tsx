import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { downloadImage } from "@/lib/downloadImage";
import { toast } from "sonner";
import { Copy, Download, Heart, Info, Loader2, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  model_used: string | null;
  prompt_used: string | null;
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
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<Row | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("marketing_generated_images")
      .select("id,image_url,generation_type,product_title,campaign_type,is_favorite,download_count,created_at,aspect_ratio,model_used,prompt_used")
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

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((r) => selected.has(r.id));

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllFiltered = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filtered.forEach((r) => next.delete(r.id));
      } else {
        filtered.forEach((r) => next.add(r.id));
      }
      return next;
    });
  };

  const clearSelection = () => setSelected(new Set());

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
      await downloadImage(r.image_url, `${r.product_title || "asset"}-${r.id.slice(0, 6)}.png`);
      await supabase
        .from("marketing_generated_images")
        .update({ download_count: r.download_count + 1 })
        .eq("id", r.id);
      setRows((prev) => prev.map((x) => x.id === r.id ? { ...x, download_count: x.download_count + 1 } : x));
    } catch {
      toast.error("Download failed");
    }
  };

  const copyPrompt = async (prompt: string | null) => {
    if (!prompt) {
      toast.error("No prompt saved for this creative");
      return;
    }
    try {
      await navigator.clipboard.writeText(prompt);
      toast.success("Prompt copied to clipboard");
    } catch {
      toast.error("Copy failed");
    }
  };

  const performDelete = async () => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    setConfirmOpen(false);
    const prev = rows;
    setRows((r) => r.filter((x) => !selected.has(x.id)));
    const { error } = await supabase
      .from("marketing_generated_images")
      .delete()
      .in("id", ids);
    if (error) {
      toast.error(error.message);
      setRows(prev);
      return;
    }
    toast.success(`Deleted ${ids.length} creative${ids.length === 1 ? "" : "s"}`);
    clearSelection();
    setSelectMode(false);
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
        <div className="ml-auto flex w-full items-center gap-2 sm:w-auto">
          <Input
            placeholder="Search by product or campaign…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="sm:w-64"
          />
          <Button
            variant={selectMode ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setSelectMode((s) => !s);
              clearSelection();
            }}
          >
            {selectMode ? "Done" : "Select"}
          </Button>
        </div>
      </div>

      {selectMode && (
        <div className="flex flex-wrap items-center gap-2 rounded border bg-muted/30 px-3 py-2 text-xs">
          <button
            type="button"
            onClick={toggleAllFiltered}
            className="rounded border bg-background px-2 py-1 hover:bg-foreground/5"
          >
            {allFilteredSelected ? "Deselect all" : "Select all"}
          </button>
          <button
            type="button"
            onClick={clearSelection}
            className="rounded border bg-background px-2 py-1 hover:bg-foreground/5"
            disabled={selected.size === 0}
          >
            Clear
          </button>
          <span className="text-muted-foreground">
            {selected.size} selected
          </span>
          <Button
            variant="destructive"
            size="sm"
            className="ml-auto"
            disabled={selected.size === 0}
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2 className="mr-1 h-3 w-3" /> Delete
          </Button>
        </div>
      )}

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
          {filtered.map((r) => {
            const isSelected = selected.has(r.id);
            return (
              <Card
                key={r.id}
                className={`overflow-hidden ${isSelected ? "ring-2 ring-foreground" : ""}`}
              >
                <div className="relative">
                  {selectMode ? (
                    <button
                      type="button"
                      onClick={() => toggleOne(r.id)}
                      className="block w-full"
                    >
                      <img
                        src={r.image_url}
                        alt={r.product_title || ""}
                        className="aspect-square w-full object-cover"
                      />
                    </button>
                  ) : (
                    <a href={r.image_url} target="_blank" rel="noopener noreferrer" className="block">
                      <img
                        src={r.image_url}
                        alt={r.product_title || ""}
                        className="aspect-square w-full object-cover"
                      />
                    </a>
                  )}
                  {selectMode && (
                    <div className="absolute left-2 top-2 rounded bg-background/90 p-1 shadow">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleOne(r.id)}
                        aria-label="Select creative"
                      />
                    </div>
                  )}
                </div>
                <CardContent className="space-y-2 p-3">
                  <div className="truncate text-xs font-medium">{r.product_title || "Untitled"}</div>
                  <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
                    <span>{r.generation_type}</span>
                    <span>{r.aspect_ratio || ""}</span>
                  </div>
                  {r.model_used && (
                    <div className="truncate font-mono text-[10px] text-muted-foreground" title={r.model_used}>
                      {r.model_used}
                    </div>
                  )}
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => handleDownload(r)}>
                      <Download className="mr-1 h-3 w-3" /> {r.download_count || 0}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDetail(r)}
                      aria-label="View prompt and model"
                    >
                      <Info className="h-3 w-3" />
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
            );
          })}
        </div>
      )}

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{detail?.product_title || "Creative details"}</DialogTitle>
            <DialogDescription>
              Reuse the prompt and model that generated this creative.
            </DialogDescription>
          </DialogHeader>
          {detail && (
            <div className="space-y-3">
              <img src={detail.image_url} alt="" className="w-full rounded" />
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Model</div>
                  <div className="font-mono">{detail.model_used || "—"}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Type</div>
                  <div>{detail.generation_type}{detail.aspect_ratio ? ` · ${detail.aspect_ratio}` : ""}</div>
                </div>
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Prompt</div>
                  <Button size="sm" variant="outline" onClick={() => copyPrompt(detail.prompt_used)}>
                    <Copy className="mr-1 h-3 w-3" /> Copy
                  </Button>
                </div>
                <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded bg-muted/40 p-3 font-mono text-[11px] leading-relaxed">
                  {detail.prompt_used || "No prompt saved for this creative."}
                </pre>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetail(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selected.size} creative{selected.size === 1 ? "" : "s"}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the selected items from your library. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={performDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
