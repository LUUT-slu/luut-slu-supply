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
  referenceImagePoster?: string;
  referenceImageDisplay?: string;
}

const EMPTY_DRAFT: DraftState = {
  key: null,
  label: "",
  description: "",
  snippet: "",
  referenceImagePoster: undefined,
  referenceImageDisplay: undefined,
};

type RefSlot = "poster" | "display";

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
  const posterFileRef = useRef<HTMLInputElement>(null);
  const displayFileRef = useRef<HTMLInputElement>(null);

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
      // Migrate legacy single referenceImage into both slots as a starting point.
      referenceImagePoster: def.referenceImagePoster ?? def.referenceImage,
      referenceImageDisplay: def.referenceImageDisplay ?? def.referenceImage,
    });
    setEditorOpen(true);
  };

  const onPickFile = async (file: File | null, slot: RefSlot) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Pick an image file");
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      setDraft((d) =>
        slot === "poster"
          ? { ...d, referenceImagePoster: dataUrl }
          : { ...d, referenceImageDisplay: dataUrl },
      );
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
    if (!snippet && !draft.referenceImagePoster && !draft.referenceImageDisplay) {
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
              referenceImage: undefined, // drop legacy field once edited
              referenceImagePoster: draft.referenceImagePoster,
              referenceImageDisplay: draft.referenceImageDisplay,
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
          referenceImagePoster: draft.referenceImagePoster,
          referenceImageDisplay: draft.referenceImageDisplay,
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

  const selectedDef = all.find((b) => b.key === value);
  const isCustomSelected = selectedDef?.custom === true;

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
            {b.custom ? `★ ${b.label}${(b.referenceImagePoster || b.referenceImageDisplay || b.referenceImage) ? " 🖼" : ""}` : b.label}
          </option>
        ))}
      </select>

      {isCustomSelected && selectedDef && (
        <button
          type="button"
          onClick={() => openEdit(selectedDef)}
          className="rounded-md border bg-background p-1.5 text-muted-foreground hover:text-foreground"
          aria-label="Edit selected brand style"
          title="Edit selected brand style"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      )}

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
                {(() => {
                  const slots: { label: string; src?: string }[] = [
                    { label: "Poster ref", src: b.referenceImagePoster || b.referenceImage },
                    { label: "Display ref", src: b.referenceImageDisplay || b.referenceImage },
                  ].filter((s) => !!s.src) as { label: string; src: string }[];
                  if (slots.length === 0) return null;
                  return (
                    <div className="mt-2 space-y-2 rounded bg-muted/40 p-2">
                      <div className="flex flex-wrap items-start gap-3">
                        {slots.map((s) => (
                          <div key={s.label} className="flex flex-col items-center gap-1">
                            <img
                              src={s.src}
                              alt={`${b.label} ${s.label}`}
                              className="h-16 w-16 rounded object-cover"
                            />
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                              {s.label}
                            </span>
                          </div>
                        ))}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Visual DNA from these images is blended into the matching surface as a style
                        donor — colors, lighting, composition, and background style only. Their
                        content is never copied.
                      </p>
                    </div>
                  );
                })()}
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

            <div className="space-y-3">
              <Label className="text-xs">Reference images (optional — pure style donors)</Label>
              <p className="text-[11px] text-muted-foreground">
                Upload separate references for posters and for display images. Each one's visual DNA
                — colors, lighting, composition, typography feel, background style, how the product
                is positioned — influences generations of that surface type. The actual content of
                these images is never copied; the product stays whatever you have selected on the
                page.
              </p>

              {([
                {
                  slot: "poster" as RefSlot,
                  title: "Poster reference",
                  desc: "Used when generating posters & flyers.",
                  current: draft.referenceImagePoster,
                  ref: posterFileRef,
                  clear: () => setDraft((d) => ({ ...d, referenceImagePoster: undefined })),
                },
                {
                  slot: "display" as RefSlot,
                  title: "Display image reference",
                  desc: "Used when generating product display & lifestyle images.",
                  current: draft.referenceImageDisplay,
                  ref: displayFileRef,
                  clear: () => setDraft((d) => ({ ...d, referenceImageDisplay: undefined })),
                },
              ]).map((row) => (
                <div key={row.slot} className="rounded border p-3">
                  <div className="text-xs font-medium">{row.title}</div>
                  <p className="text-[11px] text-muted-foreground">{row.desc}</p>
                  <input
                    ref={row.ref}
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(e) => onPickFile(e.target.files?.[0] || null, row.slot)}
                  />
                  <div className="mt-2 flex items-center gap-3">
                    {row.current ? (
                      <img
                        src={row.current}
                        alt={`${row.title} preview`}
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
                        onClick={() => row.ref.current?.click()}
                      >
                        <Upload className="mr-1 h-3.5 w-3.5" />
                        {row.current ? "Replace image" : "Upload image"}
                      </Button>
                      {row.current && (
                        <Button type="button" variant="ghost" size="sm" onClick={row.clear}>
                          Remove image
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
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
