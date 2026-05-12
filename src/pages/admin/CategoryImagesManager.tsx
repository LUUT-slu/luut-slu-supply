import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Header } from "@/components/Header";
import { BackButton } from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, RefreshCw, Upload, Check, X, Pencil, Image as ImageIcon } from "lucide-react";
import { fetchTaxonomy } from "@/lib/taxonomy";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type CategoryRow = {
  category_key: string;
  main_slug: string;
  sub_slug: string | null;
  display_name: string;
  parent_name: string | null;
  product_count: number;
  sample_titles: string[];
};

type StoredImage = {
  category_key: string;
  image_url: string | null;
  image_source: string;
  prompt_used: string | null;
  prompt_override: string | null;
  status: string;
  last_generated_at: string | null;
};

async function loadAll() {
  const tax = await fetchTaxonomy();
  const rows: CategoryRow[] = [];
  for (const m of tax.mains) {
    const samples = m.subs.slice(0, 5).map((s) => s.title);
    rows.push({
      category_key: `main:${m.slug}`,
      main_slug: m.slug,
      sub_slug: null,
      display_name: m.title,
      parent_name: null,
      product_count: m.productCount,
      sample_titles: samples,
    });
    for (const s of m.subs) {
      rows.push({
        category_key: `sub:${m.slug}--${s.slug}`,
        main_slug: m.slug,
        sub_slug: s.slug,
        display_name: s.title,
        parent_name: m.title,
        product_count: s.productCount,
        sample_titles: [s.title],
      });
    }
  }

  const { data } = await supabase
    .from("category_images")
    .select("category_key, image_url, image_source, prompt_used, prompt_override, status, last_generated_at");
  const byKey = new Map<string, StoredImage>();
  (data ?? []).forEach((r) => byKey.set(r.category_key, r as StoredImage));
  return { rows, byKey };
}

export default function CategoryImagesManager() {
  const qc = useQueryClient();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-category-images"],
    queryFn: loadAll,
  });

  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const [editPrompt, setEditPrompt] = useState("");

  async function generate(row: CategoryRow, opts: { promptOverride?: string; autoApprove?: boolean } = {}) {
    setBusyKey(row.category_key);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error("Not signed in");
      const res = await supabase.functions.invoke("generate-category-image", {
        body: {
          categoryKey: row.category_key,
          mainSlug: row.main_slug,
          subSlug: row.sub_slug,
          displayName: row.display_name,
          parentName: row.parent_name,
          sampleTitles: row.sample_titles,
          promptOverride: opts.promptOverride,
          autoApprove: opts.autoApprove ?? true,
        },
      });
      if (res.error) throw new Error(res.error.message);
      toast.success(`Generated image for ${row.display_name}`);
      await refetch();
      qc.invalidateQueries({ queryKey: ["taxonomy"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate");
    } finally {
      setBusyKey(null);
    }
  }

  async function setStatus(key: string, status: "approved" | "rejected") {
    const { error } = await supabase.from("category_images").update({ status }).eq("category_key", key);
    if (error) toast.error(error.message);
    else {
      toast.success(`Marked ${status}`);
      refetch();
      qc.invalidateQueries({ queryKey: ["taxonomy"] });
    }
  }

  async function uploadManual(row: CategoryRow, file: File) {
    setBusyKey(row.category_key);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${row.category_key.replace(/[^a-z0-9_:-]/gi, "_")}-manual-${Date.now()}.${ext}`;
      const up = await supabase.storage.from("category-images").upload(path, file, {
        upsert: true,
        contentType: file.type,
      });
      if (up.error) throw up.error;
      const { data: pub } = supabase.storage.from("category-images").getPublicUrl(path);
      const { error } = await supabase.from("category_images").upsert({
        category_key: row.category_key,
        main_slug: row.main_slug,
        sub_slug: row.sub_slug,
        display_name: row.display_name,
        image_url: pub.publicUrl,
        image_source: "manual",
        status: "approved",
        last_generated_at: new Date().toISOString(),
      }, { onConflict: "category_key" });
      if (error) throw error;
      toast.success("Image uploaded");
      refetch();
      qc.invalidateQueries({ queryKey: ["taxonomy"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusyKey(null);
    }
  }

  const sortedRows = useMemo(() => {
    if (!data) return [];
    return data.rows.filter((r) => r.product_count > 0);
  }, [data]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <BackButton />
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ImageIcon className="w-6 h-6" /> Category Images
            </h1>
            <p className="text-sm text-muted-foreground">
              AI-generated images for each visible category and subcategory.
            </p>
          </div>
          <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : (
          <div className="grid gap-3">
            {sortedRows.map((row) => {
              const stored = data?.byKey.get(row.category_key);
              const busy = busyKey === row.category_key;
              const sourceLabel = stored?.image_source ?? "shopify";
              return (
                <Card key={row.category_key}>
                  <CardContent className="p-4 flex gap-4 items-start flex-wrap sm:flex-nowrap">
                    <div className="w-24 h-24 rounded-md bg-muted overflow-hidden flex-shrink-0 flex items-center justify-center">
                      {stored?.image_url ? (
                        <img src={stored.image_url} alt={row.display_name} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <ImageIcon className="w-6 h-6 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">
                          {row.parent_name ? `${row.parent_name} › ` : ""}{row.display_name}
                        </span>
                        <Badge variant="secondary">{row.product_count} products</Badge>
                        <Badge variant={stored?.status === "approved" ? "default" : "outline"}>
                          {stored?.status ?? "missing"}
                        </Badge>
                        <Badge variant="outline">{sourceLabel}</Badge>
                      </div>
                      {stored?.prompt_used && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{stored.prompt_used}</p>
                      )}
                      {stored?.last_generated_at && (
                        <p className="text-[11px] text-muted-foreground">
                          Updated {new Date(stored.last_generated_at).toLocaleString()}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2 pt-1">
                        <Button size="sm" onClick={() => generate(row)} disabled={busy}>
                          {busy ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1" />}
                          {stored?.image_url ? "Regenerate" : "Generate"}
                        </Button>
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => {
                          setEditing(row);
                          setEditPrompt(stored?.prompt_used ?? "");
                        }}>
                          <Pencil className="w-3 h-3 mr-1" /> Edit prompt
                        </Button>
                        <label className="inline-flex">
                          <Button size="sm" variant="outline" disabled={busy} asChild>
                            <span><Upload className="w-3 h-3 mr-1" /> Upload</span>
                          </Button>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) uploadManual(row, f);
                              e.target.value = "";
                            }}
                          />
                        </label>
                        {stored && stored.status !== "approved" && (
                          <Button size="sm" variant="outline" onClick={() => setStatus(row.category_key, "approved")}>
                            <Check className="w-3 h-3 mr-1" /> Approve
                          </Button>
                        )}
                        {stored && stored.status !== "rejected" && (
                          <Button size="sm" variant="ghost" onClick={() => setStatus(row.category_key, "rejected")}>
                            <X className="w-3 h-3 mr-1" /> Reject
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit prompt — {editing?.display_name}</DialogTitle>
          </DialogHeader>
          <Textarea
            value={editPrompt}
            onChange={(e) => setEditPrompt(e.target.value)}
            rows={8}
            placeholder="Describe what the image should show…"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={async () => {
              if (!editing) return;
              const row = editing;
              setEditing(null);
              await generate(row, { promptOverride: editPrompt });
            }}>Save & regenerate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
