import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { downloadImage } from "@/lib/downloadImage";
import { toast } from "sonner";
import { Loader2, Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useHybridProducts } from "@/hooks/useHybridProducts";
import { prepareMarketingSourceImages } from "@/lib/marketingSourceImages";
import {
  type AspectRatio,
  type BrandStyle,
  type DisplayBackground,
  type DisplayControls,
  type DisplayFocus,
  type DisplayGoal,
  type DisplayRealism,
  type DisplayStyle,
  DISPLAY_PRESETS,
  previewDisplayFinal,
  getBrandStyleReferenceImage,
} from "@/lib/marketingRouting";
import PromptPreview from "./PromptPreview";
import LayoutPreview from "./LayoutPreview";

const GOALS: { key: DisplayGoal; label: string }[] = [
  { key: "product_display", label: "Product Display" },
  { key: "product_closeup", label: "Product Closeup" },
  { key: "human_model", label: "Human Model" },
  { key: "lifestyle_product", label: "Lifestyle Product" },
  { key: "product_hero", label: "Product Hero" },
  { key: "packaging_showcase", label: "Packaging Showcase" },
];

const STYLES: { key: DisplayStyle; label: string }[] = [
  { key: "studio", label: "Studio" },
  { key: "lifestyle", label: "Lifestyle" },
  { key: "minimal", label: "Minimal" },
  { key: "human", label: "Human Model" },
];

const BACKGROUNDS: { key: DisplayBackground; label: string }[] = [
  { key: "solid", label: "Solid Color" },
  { key: "gradient", label: "Gradient" },
  { key: "studio", label: "Studio Backdrop" },
  { key: "lifestyle", label: "Lifestyle Scene" },
  { key: "transparent", label: "Transparent" },
];

const REALISMS: { key: DisplayRealism; label: string }[] = [
  { key: "standard", label: "Standard" },
  { key: "premium", label: "Premium" },
  { key: "hyper", label: "Hyper Realistic" },
  { key: "luxury", label: "Luxury Brand" },
];

const FOCUSES: { key: DisplayFocus; label: string }[] = [
  { key: "full", label: "Full Product" },
  { key: "detail", label: "Product Detail" },
  { key: "texture", label: "Texture" },
  { key: "packaging", label: "Packaging" },
  { key: "in_use", label: "Product In Use" },
  { key: "hero_angle", label: "Hero Angle" },
];

const ASPECTS: AspectRatio[] = ["1:1", "4:5", "9:16", "16:9", "3:4"];
const MAX_REFS = 4;

export default function DisplayTab({ brandStyle }: { brandStyle: BrandStyle }) {
  const { products, loading } = useHybridProducts({ limit: 100 });

  const [selectedId, setSelectedId] = useState("");
  const product = useMemo(
    () => products.find((p) => p.id === selectedId) || products[0],
    [products, selectedId],
  );

  const [selectedVariantId, setSelectedVariantId] = useState("");
  const variant = useMemo(() => {
    if (!product?.variants?.length) return null;
    return product.variants.find((v) => v.id === selectedVariantId) || product.variants[0];
  }, [product, selectedVariantId]);
  const variantImage = variant?.image?.url || product?.images?.[0]?.url || null;

  const [refs, setRefs] = useState<string[]>([]);
  const [goal, setGoal] = useState<DisplayGoal>("product_display");
  const [style, setStyle] = useState<DisplayStyle>("studio");
  const [background, setBackground] = useState<DisplayBackground>("studio");
  const [realism, setRealism] = useState<DisplayRealism>("hyper");
  const [focus, setFocus] = useState<DisplayFocus>("full");
  const [aspect, setAspect] = useState<AspectRatio>("1:1");
  const [notes, setNotes] = useState("");
  const [promptOverride, setPromptOverride] = useState<string | null>(null);
  const [lastSeed, setLastSeed] = useState<number | null>(null);

  const [generating, setGenerating] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  const controls: DisplayControls = {
    productTitle: product?.title || "",
    productCategory: product?.category || undefined,
    goal,
    style,
    background,
    realism,
    focus,
    aspectRatio: aspect,
    notes,
    hasReference: refs.length > 0 || Boolean(variantImage),
  };

  const { route, prompt } = previewDisplayFinal(controls, brandStyle);

  const applyPreset = (id: string) => {
    const preset = DISPLAY_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    const a = preset.apply;
    if (a.goal) setGoal(a.goal);
    if (a.style) setStyle(a.style);
    if (a.background) setBackground(a.background);
    if (a.realism) setRealism(a.realism);
    if (a.focus) setFocus(a.focus);
    if (a.aspectRatio) setAspect(a.aspectRatio);
  };

  const generate = async (opts?: { reuseSeed?: boolean }) => {
    if (!product) {
      toast.error("Select a product first");
      return;
    }
    const sourceRefs =
      refs.length > 0
        ? refs
        : variantImage
        ? [variantImage]
        : [];

    const seed =
      opts?.reuseSeed && lastSeed != null
        ? lastSeed
        : Math.floor(Math.random() * 2_147_483_647);

    setGenerating(true);
    setResultUrl(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("marketing-generate", {
        body: {
          task: "display",
          model: route.model,
          prompt: promptOverride ?? prompt,
          aspectRatio: aspect,
          referenceImages: sourceRefs,
          styleReferenceImage: getBrandStyleReferenceImage(brandStyle, "display") || undefined,
          productTitle: product.title,
          productHandle: (product as any).handle || null,
          campaignType: goal,
          style,
          seed,
        },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (error || (data as any)?.error) {
        const raw = (data as any)?.error || error?.message || "Generation failed";
        const friendly = /insufficient credit/i.test(raw)
          ? "The image provider is out of credit. Top up Replicate billing and try again."
          : raw;
        toast.error(friendly);
        return;
      }
      setResultUrl((data as any).url);
      setLastSeed(seed);
      toast.success("Display image generated");
    } catch (e: any) {
      toast.error(e?.message || "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const optionGrid = <T extends string>(
    items: { key: T; label: string }[],
    value: T,
    onChange: (v: T) => void,
  ) => (
    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
      {items.map((it) => (
        <button
          key={it.key}
          type="button"
          onClick={() => onChange(it.key)}
          className={`rounded-md border px-2 py-1.5 text-xs ${
            value === it.key ? "border-foreground bg-foreground/5" : "border-border"
          }`}
        >
          {it.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Product</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <select
              value={selectedId}
              onChange={(e) => { setSelectedId(e.target.value); setSelectedVariantId(""); }}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              disabled={loading}
            >
              {products.length === 0 && <option value="">Loading…</option>}
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
            {product && product.variants?.length > 1 && (
              <div>
                <Label className="text-xs">Variant</Label>
                <select
                  value={variant?.id || ""}
                  onChange={(e) => setSelectedVariantId(e.target.value)}
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                >
                  {product.variants.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.title}{v.availableForSale ? "" : " — out of stock"}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Reference Images ({refs.length}/{MAX_REFS})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {refs.map((src, i) => (
                <div key={i} className="relative h-16 w-16 overflow-hidden rounded border">
                  <img src={src} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setRefs(refs.filter((_, idx) => idx !== i))}
                    className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-background text-xs shadow"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {refs.length === 0 && variantImage && (
                <div className="relative h-16 w-16 overflow-hidden rounded border border-dashed border-muted-foreground/40">
                  <img src={variantImage} alt="Product listing" className="h-full w-full object-cover opacity-80" />
                  <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-[9px] text-white text-center py-0.5">Auto</span>
                </div>
              )}
              {refs.length < MAX_REFS && (
                <label className="flex h-16 w-16 cursor-pointer items-center justify-center rounded border border-dashed text-lg text-muted-foreground hover:border-foreground">
                  +
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={async (e) => {
                      const input = e.currentTarget;
                      const files = Array.from(input.files || []);
                      if (!files.length) return;
                      const room = MAX_REFS - refs.length;
                      const added = await prepareMarketingSourceImages(files, room);
                      if (added.length) setRefs([...refs, ...added]);
                      if (input) input.value = "";
                    }}
                  />
                </label>
              )}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {refs.length === 0 && variantImage
                ? "Product listing image will be used as reference. Upload images to override."
                : "Reference images preserve product identity, color, branding and proportions."}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick Presets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {DISPLAY_PRESETS.map((p) => (
                <Button
                  key={p.id}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyPreset(p.id)}
                >
                  {p.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Display Goal</CardTitle>
          </CardHeader>
          <CardContent>{optionGrid<DisplayGoal>(GOALS, goal, setGoal)}</CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base">Style</CardTitle></CardHeader>
            <CardContent>{optionGrid<DisplayStyle>(STYLES, style, setStyle)}</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Background</CardTitle></CardHeader>
            <CardContent>{optionGrid<DisplayBackground>(BACKGROUNDS, background, setBackground)}</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Realism</CardTitle></CardHeader>
            <CardContent>{optionGrid<DisplayRealism>(REALISMS, realism, setRealism)}</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Product Focus</CardTitle></CardHeader>
            <CardContent>{optionGrid<DisplayFocus>(FOCUSES, focus, setFocus)}</CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">Aspect Ratio</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {ASPECTS.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAspect(a)}
                  className={`rounded-md border px-3 py-1.5 text-xs ${
                    aspect === a ? "border-foreground bg-foreground/5" : "border-border"
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Additional Notes</CardTitle></CardHeader>
          <CardContent>
            <Label className="sr-only">Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </CardContent>
        </Card>

        <PromptPreview prompt={prompt} value={promptOverride} onChange={setPromptOverride} />

        <div className="space-y-2">
          <Button onClick={() => generate()} disabled={generating || !product} size="lg" className="w-full">
            {generating ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating…</>
            ) : (
              "Generate Display Image"
            )}
          </Button>
          <Button
            onClick={() => generate({ reuseSeed: true })}
            disabled={generating || !product || lastSeed == null}
            variant="outline"
            className="w-full"
          >
            Regenerate Same Image{lastSeed != null ? ` (seed ${lastSeed})` : ""}
          </Button>
        </div>
      </div>

      <div className="space-y-4 lg:sticky lg:top-4">
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="text-base">Live Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <LayoutPreview
              surface="display"
              brandStyle={brandStyle}
              productImage={variantImage}
              productTitle={product?.title}
              aspectRatio={aspect}
              goal={goal}
              style={style}
              background={background}
              realism={realism}
              focus={focus}
            />
          </CardContent>
        </Card>
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="text-base">Result</CardTitle>
          </CardHeader>
          <CardContent>
            {resultUrl ? (
              <div className="space-y-3">
                <img src={resultUrl} alt="Generated display" className="w-full rounded" />
                <Button variant="outline" className="w-full" onClick={() => downloadImage(resultUrl, "luut-display.png")}>
                  <Download className="mr-2 h-4 w-4" /> Download
                </Button>
              </div>
            ) : (
              <div className="flex aspect-square items-center justify-center rounded border border-dashed text-xs text-muted-foreground">
                Display image will appear here
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
