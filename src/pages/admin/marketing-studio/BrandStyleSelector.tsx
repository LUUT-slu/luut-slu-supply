import { useEffect, useRef, useState } from "react";
import { Info, Plus, Trash2, Upload, Image as ImageIcon, Pencil } from "lucide-react";
import {
  BUILTIN_BRAND_STYLES,
  loadCustomBrandStyles,
  saveCustomBrandStyles,
  type BrandStyle,
  type BrandStyleDef,
} from "@/lib/marketingRouting";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

// Downscale + JPEG-encode the uploaded reference so localStorage stays under quota.
async function fileToDataUrl(file: File, maxSize = 1024, quality = 0.85): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(bitmap, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}

interface DraftState {
  key: string | null; // null = creating new
  label: string;
  description: string;
  snippet: string;
  referenceImage?: string;
}

const EMPTY_DRAFT: DraftState = { key: null, label: "", description: "", snippet: "", referenceImage: undefined };

export default function BrandStyleSelector({
  value,
  onChange,
}: {
  value: BrandStyle;
  onChange: (b: BrandStyle) => void;
}) {
  const [custom, setCustom] = useState<BrandStyleDef[]>([]);
  const [infoOpen, setInfoOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCustom(loadCustomBrandStyles());
  }, []);

  const all = [...BUILTIN_BRAND_STYLES, ...custom];

  const openCreate = () => {
    setDraft(EMPTY_DRAFT);
    setEditorOpen(true);
  };

  const openEdit = (def: BrandStyleDef) => {
    setDraft({
      key: def.key,
      label: def.label,
      description: def.description,
      snippet: def.snippet,
      referenceImage: def.referenceImage,
    });
    setEditorOpen(true);
  };

  const onPickFile = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Pick an image file");
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      setDraft((d) => ({ ...d, referenceImage: dataUrl }));
    } catch (e: any) {
      toast.error(e?.message || "Could not read image");
    }
  };

  const saveDraft = () => {
    const label = draft.label.trim();
    const snippet = draft.snippet.trim();
    if (!label) {
      toast.error("Name is required");
      return;
    }
    if (!snippet && !draft.referenceImage) {
      toast.error("Add a style description or a reference image");
      return;
    }
    let next: BrandStyleDef[];
    let key = draft.key;
    if (key) {
      next = custom.map((s) =>
        s.key === key
          ? {
              ...s,
              label,
              description: draft.description.trim() || "Custom brand style",
              snippet,
              referenceImage: draft.referenceImage,
            }
          : s,
      );
    } else {
      key = `custom:${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString(36)}`;
      next = [
        ...custom,
        {
          key,
          label,
          description: draft.description.trim() || "Custom brand style",
          snippet,
          referenceImage: draft.referenceImage,
          custom: true,
        },
      ];
    }
    try {
      saveCustomBrandStyles(next);
    } catch {
      toast.error("Style is too large to save on this device. Try a smaller image.");
      return;
    }
    setCustom(next);
    onChange(key);
    setEditorOpen(false);
    setDraft(EMPTY_DRAFT);
    toast.success(`Saved "${label}" brand style`);
  };

  const removeCustom = (key: string) => {
    const next = custom.filter((s) => s.key !== key);
    setCustom(next);
    saveCustomBrandStyles(next);
    if (value === key) onChange("default");
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        Brand Style
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border bg-background px-2 py-1.5 text-xs"
      >
        {all.map((b) => (
          <option key={b.key} value={b.key}>
            {b.custom ? `★ ${b.label}${b.referenceImage ? " 🖼" : ""}` : b.label}
          </option>
        ))}
      </select>

      <Dialog open={infoOpen} onOpenChange={setInfoOpen}>
        <DialogTrigger asChild>
          <button
            type="button"
            className="rounded-md border bg-background p-1.5 text-muted-foreground hover:text-foreground"
            aria-label="About brand styles"
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        </DialogTrigger>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>How brand styles influence your creations</DialogTitle>
            <DialogDescription>
              Each brand style appends a short instruction snippet to every prompt so the look stays
              consistent across posters and display images. Custom styles can also carry a reference
              image whose visual DNA (colors, lighting, composition, typography feel) is blended into
              every generated scene — never its content.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
            {all.map((b) => (
              <div key={b.key} className="rounded border p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium">
                    {b.label}
                    {b.custom && (
                      <span className="ml-2 rounded-full bg-foreground/5 px-2 py-0.5 text-[10px] uppercase tracking-wider">
                        Custom
                      </span>
                    )}
                  </div>
                  {b.custom && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setInfoOpen(false);
                          openEdit(b);
                        }}
                        className="text-muted-foreground hover:text-foreground"
                        aria-label="Edit custom style"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeCustom(b.key)}
                        className="text-muted-foreground hover:text-destructive"
                        aria-label="Delete custom style"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{b.description}</p>
                {b.referenceImage && (
                  <div className="mt-2 flex items-center gap-2 rounded bg-muted/40 p-2">
                    <img
                      src={b.referenceImage}
                      alt={`${b.label} reference`}
                      className="h-16 w-16 rounded object-cover"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Visual DNA from this image is blended into every generated scene as a style
                      donor — colors, lighting, composition, and background style only. Its content
                      is never copied.
                    </p>
                  </div>
                )}
                {b.snippet && (
                  <p className="mt-2 rounded bg-muted/40 p-2 font-mono text-[11px] leading-relaxed text-foreground/80">
                    {b.snippet}
                  </p>
                )}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInfoOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <button
        type="button"
        onClick={openCreate}
        className="rounded-md border bg-background p-1.5 text-muted-foreground hover:text-foreground"
        aria-label="Add custom brand style"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{draft.key ? "Edit custom brand style" : "Create custom brand style"}</DialogTitle>
            <DialogDescription>
              Saved on this device. Every poster and display generated while this style is selected
              will blend in its description and, if attached, its reference image as a pure style
              donor.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Name</Label>
              <Input
                value={draft.label}
                onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
                placeholder="e.g. Caribbean Pastel"
              />
            </div>
            <div>
              <Label className="text-xs">Short description (for the info panel)</Label>
              <Input
                value={draft.description}
                onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                placeholder="Soft pastel palette, sun-bleached, breezy"
              />
            </div>
            <div>
              <Label className="text-xs">Style prompt snippet (gets appended to every prompt)</Label>
              <Textarea
                rows={3}
                value={draft.snippet}
                onChange={(e) => setDraft((d) => ({ ...d, snippet: e.target.value }))}
                placeholder="pastel Caribbean palette, soft natural light, sun-bleached tropical mood, editorial composition"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Write it as descriptive keywords, like a photography brief.
              </p>
            </div>

            <div>
              <Label className="text-xs">Reference image (optional — pure style donor)</Label>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Upload a poster or display image whose visual DNA — colors, lighting, composition,
                typography feel, background style, how the product is positioned — should influence
                every generation under this style. The actual content of this image is never copied;
                the product stays whatever you have selected on the page.
              </p>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => onPickFile(e.target.files?.[0] || null)}
              />
              <div className="mt-2 flex items-center gap-3">
                {draft.referenceImage ? (
                  <img
                    src={draft.referenceImage}
                    alt="Style reference preview"
                    className="h-20 w-20 rounded border object-cover"
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded border border-dashed text-muted-foreground">
                    <ImageIcon className="h-5 w-5" />
                  </div>
                )}
                <div className="flex flex-col gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileRef.current?.click()}
                  >
                    <Upload className="mr-1 h-3.5 w-3.5" />
                    {draft.referenceImage ? "Replace image" : "Upload image"}
                  </Button>
                  {draft.referenceImage && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setDraft((d) => ({ ...d, referenceImage: undefined }))}
                    >
                      Remove image
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditorOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveDraft}>Save style</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
