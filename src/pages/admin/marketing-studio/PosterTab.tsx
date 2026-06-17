import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { downloadImage } from "@/lib/downloadImage";
import { toast } from "sonner";
import { Loader2, Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useHybridProducts } from "@/hooks/useHybridProducts";
import { prepareMarketingSourceImages } from "@/lib/marketingSourceImages";
import {
  type AspectRatio,
  type BrandStyle,
  type DisplayRealism,
  type PosterCampaign,
  type PosterControls,
  type PosterStyle,
  POSTER_PRESETS,
  previewPosterTwoStage,
  getBrandStyleReferenceImage,
} from "@/lib/marketingRouting";

import PromptPreview from "./PromptPreview";
import LayoutPreview from "./LayoutPreview";

const CAMPAIGNS: { key: PosterCampaign; label: string }[] = [
  { key: "sale", label: "Sale" },
  { key: "promotion", label: "Promotion" },
  { key: "new_arrival", label: "New Arrival" },
  { key: "limited_drop", label: "Limited Drop" },
  { key: "clearance", label: "Clearance" },
  { key: "brand_awareness", label: "Brand Awareness" },
  { key: "event", label: "Event" },
];

const STYLES: { key: PosterStyle; label: string }[] = [
  { key: "clean", label: "Clean" },
  { key: "luxury", label: "Luxury" },
  { key: "bold", label: "Bold" },
  { key: "hype", label: "Hype" },
  { key: "modern", label: "Modern" },
  { key: "minimal", label: "Minimal" },
];

const ASPECTS: AspectRatio[] = ["1:1", "4:5", "9:16", "16:9", "3:4"];

const REALISMS: { key: DisplayRealism; label: string }[] = [
  { key: "standard", label: "Standard" },
  { key: "premium", label: "Premium" },
  { key: "hyper", label: "Hyper Realistic" },
  { key: "luxury", label: "Luxury" },
];


const MAX_REFS = 4;

export default function PosterTab({ brandStyle }: { brandStyle: BrandStyle }) {
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
  const [campaign, setCampaign] = useState<PosterCampaign>("sale");
  const [style, setStyle] = useState<PosterStyle>("bold");
  const [realism, setRealism] = useState<DisplayRealism>("hyper");
  const [aspect, setAspect] = useState<AspectRatio>("4:5");

  const [headline, setHeadline] = useState("");
  const [subheadline, setSubheadline] = useState("");
  const [priceText, setPriceText] = useState("");
  const [ctaText, setCtaText] = useState("Shop Now");
  const [notes, setNotes] = useState("");
  const [promptOverride, setPromptOverride] = useState<string | null>(null);
  const [lastSeed, setLastSeed] = useState<number | null>(null);

  const [generating, setGenerating] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  const controls: PosterControls = {
    productTitle: product?.title || "",
    productPrice: product?.price?.amount ? String(product.price.amount) : undefined,
    campaign,
    style,
    realism,

    aspectRatio: aspect,
    headline,
    subheadline,
    priceText:
      priceText ||
      (product?.price?.amount ? `EC$${Math.round(Number(product.price.amount))}` : undefined),
    ctaText,
    brandName: "LUUT SLU",
    notes,
    hasReference: refs.length > 0 || Boolean(variantImage),
  };

  const { route, backgroundPrompt, textPrompt } = previewPosterTwoStage(controls, brandStyle);

  const applyPreset = (id: string) => {
    const preset = POSTER_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    const a = preset.apply;
    if (a.campaign) setCampaign(a.campaign);
    if (a.style) setStyle(a.style);
    if (a.realism) setRealism(a.realism);
    if (a.aspectRatio) setAspect(a.aspectRatio);

    if (a.headline !== undefined) setHeadline(a.headline);
    if (a.ctaText !== undefined) setCtaText(a.ctaText);
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
          task: "poster",
          model: route.model,
          prompt: promptOverride ?? textPrompt,
          backgroundPrompt,
          textPrompt: promptOverride ?? textPrompt,
          aspectRatio: aspect,
          referenceImages: sourceRefs,
          styleReferenceImage: getBrandStyleReferenceImage(brandStyle, "poster") || undefined,
          productTitle: product.title,
          productHandle: (product as any).handle || null,
          campaignType: campaign,
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
      toast.success("Poster generated");
    } catch (e: any) {
      toast.error(e?.message || "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
      {/* Controls */}
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
                    aria-label="Remove"
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
                : refs.length === 0
                ? "Using product listing image."
                : "Uploaded references will be used to preserve product identity."}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick Presets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {POSTER_PRESETS.map((p) => (
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
            <CardTitle className="text-base">Campaign</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs">Campaign Type</Label>
              <div className="mt-1 grid grid-cols-3 gap-1.5 sm:grid-cols-4">
                {CAMPAIGNS.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setCampaign(c.key)}
                    className={`rounded-md border px-2 py-1.5 text-xs ${
                      campaign === c.key ? "border-foreground bg-foreground/5" : "border-border"
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs">Style</Label>
              <div className="mt-1 grid grid-cols-3 gap-1.5 sm:grid-cols-6">
                {STYLES.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setStyle(s.key)}
                    className={`rounded-md border px-2 py-1.5 text-xs ${
                      style === s.key ? "border-foreground bg-foreground/5" : "border-border"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs">Realism</Label>
              <div className="mt-1 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                {REALISMS.map((r) => (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => setRealism(r.key)}
                    className={`rounded-md border px-2 py-1.5 text-xs ${
                      realism === r.key ? "border-foreground bg-foreground/5" : "border-border"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
            <div>

              <Label className="text-xs">Aspect Ratio</Label>
              <div className="mt-1 flex flex-wrap gap-1.5">
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
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Text on Image</CardTitle>
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
                <Label className="text-xs">CTA</Label>
                <Input value={ctaText} onChange={(e) => setCtaText(e.target.value)} placeholder="Shop Now" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Additional notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
            </div>
          </CardContent>
        </Card>

        <PromptPreview prompt={prompt} value={promptOverride} onChange={setPromptOverride} />

        <div className="space-y-2">
          <Button onClick={() => generate()} disabled={generating || !product} size="lg" className="w-full">
            {generating ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating…</>
            ) : (
              "Generate Poster"
            )}
          </Button>
          <Button
            onClick={() => generate({ reuseSeed: true })}
            disabled={generating || !product || lastSeed == null}
            variant="outline"
            className="w-full"
          >
            Regenerate Same Poster{lastSeed != null ? ` (seed ${lastSeed})` : ""}
          </Button>
        </div>
      </div>

      {/* Live preview + Result */}
      <div className="space-y-4 lg:sticky lg:top-4">
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="text-base">Live Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <LayoutPreview
              surface="poster"
              brandStyle={brandStyle}
              productImage={variantImage}
              productTitle={product?.title}
              aspectRatio={aspect}
              style={style}
              realism={realism}
              campaign={campaign}
              headline={headline}
              subheadline={subheadline}
              priceText={
                priceText ||
                (product?.price?.amount ? `EC$${Math.round(Number(product.price.amount))}` : undefined)
              }
              ctaText={ctaText}
              brandName="LUUT SLU"
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
                <img src={resultUrl} alt="Generated poster" className="w-full rounded" />
                <Button variant="outline" className="w-full" onClick={() => downloadImage(resultUrl, "luut-poster.png")}>
                  <Download className="mr-2 h-4 w-4" /> Download
                </Button>
              </div>
            ) : (
              <div className="flex aspect-[4/5] items-center justify-center rounded border border-dashed text-xs text-muted-foreground">
                Poster preview will appear here
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
