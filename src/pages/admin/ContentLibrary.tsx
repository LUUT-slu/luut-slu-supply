import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { AdminAuth } from "@/components/AdminAuth";
import { BackButton } from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
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
import { Download, Trash2, Images, Loader2, Wand2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AdminGroupNav } from "@/components/admin/AdminGroupNav";

type GenType = "display" | "poster" | "video";

interface LibraryImage {
  id: string;
  created_at: string;
  image_url: string;
  generation_type: string;
  product_title: string | null;
  style: string | null;
  aspect_ratio: string | null;
  logo_applied: boolean | null;
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

function pathFromUrl(url: string): string | null {
  const marker = "/marketing-assets/";
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  const tail = url.slice(idx + marker.length);
  return tail.split("?")[0];
}

async function downloadImage(url: string, name: string) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objUrl;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objUrl);
  } catch {
    toast.error("Download failed");
  }
}

export default function ContentLibrary() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<GenType | "all">("all");
  const [items, setItems] = useState<LibraryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<LibraryImage | null>(null);
  const [toDelete, setToDelete] = useState<LibraryImage | null>(null);

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from("marketing_generated_images" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (filter !== "all") q = q.eq("generation_type", filter);
    const { data, error } = await q;
    if (error) {
      console.error(error);
      toast.error("Failed to load library");
      setItems([]);
    } else {
      setItems((data as any) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [filter]);

  const recent = useMemo(() => items.slice(0, 6), [items]);

  const handleDelete = async () => {
    if (!toDelete) return;
    const path = pathFromUrl(toDelete.image_url);
    try {
      if (path) {
        await supabase.storage.from("marketing-assets").remove([path]);
      }
      const { error } = await supabase
        .from("marketing_generated_images" as any)
        .delete()
        .eq("id", toDelete.id);
      if (error) throw error;
      toast.success("Deleted");
      setToDelete(null);
      load();
    } catch (e: any) {
      toast.error(e?.message || "Delete failed");
    }
  };

  const filterPills: { key: GenType | "all"; label: string }[] = [
    { key: "all", label: "All" },
    { key: "display", label: "Display Images" },
    { key: "poster", label: "Posters" },
    { key: "video", label: "Videos" },
  ];

  return (
    <AdminAuth>
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
      <AdminGroupNav group="marketing" />
        <main className="container flex-1 py-6 space-y-6">
          <div className="flex items-center gap-3">
            <BackButton />
            <div>
              <h1 className="font-display text-xl md:text-2xl">Content Library</h1>
              <p className="text-xs text-muted-foreground">
                Your saved AI-generated marketing images
              </p>
            </div>
          </div>

          {/* Filter pills */}
          <div className="flex flex-wrap gap-1.5">
            {filterPills.map((p) => (
              <Button
                key={p.key}
                size="sm"
                variant={filter === p.key ? "default" : "outline"}
                onClick={() => setFilter(p.key)}
                className="text-xs"
              >
                {p.label}
              </Button>
            ))}
          </div>

          {/* Recent strip */}
          {!loading && recent.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Recent</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  {recent.map((it) => (
                    <div
                      key={it.id}
                      className="space-y-2 rounded-md border p-2 bg-card"
                    >
                      <button
                        type="button"
                        onClick={() => setPreview(it)}
                        className="block w-full overflow-hidden rounded"
                      >
                        <img
                          src={it.image_url}
                          alt={it.product_title || "Image"}
                          className="w-full aspect-square object-cover"
                          loading="lazy"
                        />
                      </button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="w-full text-xs"
                        onClick={() => navigate("/admin/marketing-studio")}
                      >
                        <Wand2 className="mr-1 h-3 w-3" />
                        Use in Studio
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Main grid */}
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
            </div>
          ) : items.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center space-y-3">
                <Images className="h-10 w-10 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  No saved images yet. Generate your first image in Marketing Studio.
                </p>
                <Button onClick={() => navigate("/admin/marketing-studio")}>
                  Open Marketing Studio
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((it) => (
                <Card key={it.id} className="overflow-hidden group">
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setPreview(it)}
                      className="block w-full"
                    >
                      <img
                        src={it.image_url}
                        alt={it.product_title || "Image"}
                        className="w-full aspect-square object-cover"
                        loading="lazy"
                      />
                    </button>
                    {/* Badges overlay (hover on desktop, always on touch) */}
                    <div className="absolute inset-x-0 top-0 p-2 flex flex-wrap gap-1 bg-gradient-to-b from-black/60 to-transparent opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity pointer-events-none">
                      {it.aspect_ratio && (
                        <Badge variant="secondary" className="text-[10px]">
                          {it.aspect_ratio}
                        </Badge>
                      )}
                      {it.style && (
                        <Badge variant="secondary" className="text-[10px] capitalize">
                          {it.style}
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-[10px] text-white border-white/40">
                        {formatDate(it.created_at)}
                      </Badge>
                    </div>
                  </div>
                  {/* Always-visible action row */}
                  <div className="p-2 space-y-2 border-t bg-card">
                    <div className="text-xs truncate text-muted-foreground">
                      {it.product_title || "—"}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="flex-1 h-7 text-xs"
                        onClick={() =>
                          downloadImage(
                            it.image_url,
                            `${it.generation_type}-${it.id}.png`,
                          )
                        }
                      >
                        <Download className="h-3 w-3 mr-1" />
                        Download
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-7 text-xs"
                        onClick={() => setToDelete(it)}
                        aria-label="Delete"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </main>

        {/* Preview lightbox */}
        <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle className="text-sm">
                {preview?.product_title || "Image"}
              </DialogTitle>
            </DialogHeader>
            {preview && (
              <div className="space-y-3">
                <img
                  src={preview.image_url}
                  alt={preview.product_title || "Image"}
                  className="w-full rounded"
                />
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {preview.style && (
                    <Badge variant="secondary" className="capitalize">
                      {preview.style}
                    </Badge>
                  )}
                  {preview.aspect_ratio && (
                    <Badge variant="secondary">{preview.aspect_ratio}</Badge>
                  )}
                  <span>{formatDate(preview.created_at)}</span>
                </div>
                <Button
                  onClick={() =>
                    downloadImage(
                      preview.image_url,
                      `${preview.generation_type}-${preview.id}.png`,
                    )
                  }
                  className="w-full"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download PNG
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete confirm */}
        <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete image?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently removes the image from your library and storage.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AdminAuth>
  );
}
