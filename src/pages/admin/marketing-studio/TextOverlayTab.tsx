import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { downloadImage } from "@/lib/downloadImage";
import { toast } from "sonner";
import { Loader2, Download, X, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Position = "top" | "center" | "bottom" | "top-left" | "top-right" | "bottom-left" | "bottom-right";

const POSITIONS: { key: Position; label: string }[] = [
  { key: "top", label: "Top Band" },
  { key: "center", label: "Center" },
  { key: "bottom", label: "Bottom Band" },
  { key: "top-left", label: "Top Left" },
  { key: "top-right", label: "Top Right" },
  { key: "bottom-left", label: "Bottom Left" },
  { key: "bottom-right", label: "Bottom Right" },
];

// Read a File as a data URL (so we can preview + send to the edge function).
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Could not read file"));
    r.readAsDataURL(file);
  });
}

// Load an <img> from a URL/dataURL and return its natural pixel size.
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load image"));
    img.src = src;
  });
}

// Build a binary mask at the exact image dimensions.
// White = "Ideogram may paint here (text)", black = "preserve original pixels".
function buildMaskDataUrl(width: number, height: number, position: Position): string {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  // Preserve everything by default.
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#ffffff";
  let x = 0, y = 0, w = width, h = height;
  switch (position) {
    case "top":
      h = Math.round(height * 0.28);
      break;
    case "bottom":
      y = Math.round(height * 0.72);
      h = Math.round(height * 0.28);
      break;
    case "center":
      y = Math.round(height * 0.36);
      h = Math.round(height * 0.28);
      break;
    case "top-left":
      w = Math.round(width * 0.55);
      h = Math.round(height * 0.32);
      break;
    case "top-right":
      x = Math.round(width * 0.45);
      w = Math.round(width * 0.55);
      h = Math.round(height * 0.32);
      break;
    case "bottom-left":
      y = Math.round(height * 0.68);
      w = Math.round(width * 0.55);
      h = Math.round(height * 0.32);
      break;
    case "bottom-right":
      x = Math.round(width * 0.45);
      y = Math.round(height * 0.68);
      w = Math.round(width * 0.55);
      h = Math.round(height * 0.32);
      break;
  }
  ctx.fillRect(x, y, w, h);
  return canvas.toDataURL("image/png");
}

export default function TextOverlayTab() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [baseImage, setBaseImage] = useState<string | null>(null);
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);

  const [headline, setHeadline] = useState("");
  const [subheadline, setSubheadline] = useState("");
  const [priceText, setPriceText] = useState("");
  const [ctaText, setCtaText] = useState("");
  const [notes, setNotes] = useState("");
  const [position, setPosition] = useState<Position>("bottom");

  const [generating, setGenerating] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      const img = await loadImage(dataUrl);
      setBaseImage(dataUrl);
      setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
      setResultUrl(null);
    } catch (e: any) {
      toast.error(e?.message || "Could not read image");
    }
  };

  const buildPrompt = (): string => {
    const lines: string[] = [];
    if (headline) lines.push(`Headline: "${headline}"`);
    if (subheadline) lines.push(`Subheadline: "${subheadline}"`);
    if (priceText) lines.push(`Price: "${priceText}"`);
    if (ctaText) lines.push(`Call-to-action: "${ctaText}"`);
    const layout =
      `Place text in the ${position.replace("-", " ")} region of the image.`;
    const styleNote =
      "Bold, clean, modern advertising typography. High contrast against the underlying image so the text is fully readable. Do not add any extra graphics, shapes, frames, or decorations — text only. Do not alter or recreate the product or background outside the text region.";
    return [
      "Add the following marketing text on top of the image:",
      ...lines,
      layout,
      styleNote,
      notes && `Additional notes: ${notes}`,
    ].filter(Boolean).join("\n");
  };

  const generate = async () => {
    if (!baseImage || !imgSize) {
      toast.error("Upload an image first");
      return;
    }
    if (!headline && !subheadline && !priceText && !ctaText && !notes) {
      toast.error("Enter at least one piece of text");
      return;
    }
    const mask = buildMaskDataUrl(imgSize.w, imgSize.h, position);
    const prompt = buildPrompt();

    setGenerating(true);
    setResultUrl(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("marketing-generate", {
        body: {
          task: "text-overlay",
          model: "ideogram-ai/ideogram-v3-quality", // unused for text-overlay but required by schema
          prompt,
          baseImage,
          maskImage: mask,
          aspectRatio: "1:1",
        },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (error || (data as any)?.error) {
        const raw = (data as any)?.error || error?.message || "Generation failed";
        toast.error(raw);
        return;
      }
      setResultUrl((data as any).url);
      toast.success("Text added");
    } catch (e: any) {
      toast.error(e?.message || "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">1. Upload Display Image</CardTitle>
          </CardHeader>
          <CardContent>
            {baseImage ? (
              <div className="relative inline-block">
                <img
                  src={baseImage}
                  alt="Uploaded"
                  className="max-h-64 rounded border"
                />
                <button
                  type="button"
                  onClick={() => { setBaseImage(null); setImgSize(null); setResultUrl(null); }}
                  className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-background text-xs shadow"
                >
                  <X className="h-3 w-3" />
                </button>
                {imgSize && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {imgSize.w} × {imgSize.h}px
                  </p>
                )}
              </div>
            ) : (
              <label className="flex h-40 w-full cursor-pointer items-center justify-center rounded border border-dashed border-muted-foreground/40 hover:border-foreground">
                <div className="text-center text-sm text-muted-foreground">
                  <Upload className="mx-auto mb-1 h-5 w-5" />
                  Click to upload a product photo or existing ad
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.currentTarget.files?.[0];
                    if (f) handleFile(f);
                    if (fileRef.current) fileRef.current.value = "";
                  }}
                />
              </label>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              The uploaded image will not be redesigned. Ideogram only paints text into the selected region.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">2. Text Content</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs">Headline</Label>
              <Input value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="FLASH SALE" />
            </div>
            <div>
              <Label className="text-xs">Subheadline</Label>
              <Input value={subheadline} onChange={(e) => setSubheadline(e.target.value)} placeholder="Limited time only" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Price</Label>
                <Input value={priceText} onChange={(e) => setPriceText(e.target.value)} placeholder="EC$199" />
              </div>
              <div>
                <Label className="text-xs">Call-to-action</Label>
                <Input value={ctaText} onChange={(e) => setCtaText(e.target.value)} placeholder="Shop Now" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Additional notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Optional details for the typography" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">3. Text Position</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
              {POSITIONS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setPosition(p.key)}
                  className={`rounded-md border px-2 py-1.5 text-xs ${
                    position === p.key ? "border-foreground bg-foreground/5" : "border-border"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Only this region of the image will be modified. Everything else stays pixel-identical.
            </p>
          </CardContent>
        </Card>

        <Button onClick={generate} disabled={generating || !baseImage} size="lg" className="w-full">
          {generating ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Adding text…</>
          ) : (
            "Add Text to Image"
          )}
        </Button>
      </div>

      <div className="space-y-4 lg:sticky lg:top-4">
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="text-base">Result</CardTitle>
          </CardHeader>
          <CardContent>
            {resultUrl ? (
              <div className="space-y-3">
                <img src={resultUrl} alt="Result" className="w-full rounded border" />
                <Button
                  onClick={() => downloadImage(resultUrl, `luut-text-${Date.now()}.png`)}
                  variant="outline"
                  className="w-full"
                >
                  <Download className="mr-2 h-4 w-4" /> Download
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Generated image will appear here.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
