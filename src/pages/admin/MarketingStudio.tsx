import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toPng } from "html-to-image";
import { Header } from "@/components/Header";
import { AdminAuth } from "@/components/AdminAuth";
import { BackButton } from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Megaphone, Download, Loader2, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { useHybridProducts } from "@/hooks/useHybridProducts";
import { useSiteSettings, DEFAULT_MARKETING_STUDIO } from "@/hooks/useSiteSettings";
import {
  MarketingTemplate,
  MultiProductTemplate,
  TemplateFormat,
  TemplateStyle,
} from "@/components/marketing/templates";
import { CopyPanel } from "@/components/marketing/CopyPanel";
import { VariantSelector, VariantMode, VariantOption } from "@/components/marketing/VariantSelector";
import { PosterTypeSelector } from "@/components/marketing/PosterTypeSelector";
import { ProductSourceCard } from "@/components/marketing/ProductSourceCard";
import {
  PosterType,
  MarketingProduct,
  getPosterTypeMeta,
} from "@/lib/marketingPosterTypes";

const FORMATS: { key: TemplateFormat; label: string; size: string }[] = [
  { key: "story", label: "Story", size: "1080×1920" },
  { key: "post", label: "Post", size: "1080×1080" },
  { key: "ad", label: "Ad", size: "1200×628" },
  { key: "portrait", label: "Portrait", size: "1080×1350" },
];

const STYLES: { key: TemplateStyle; label: string }[] = [
  { key: "clean", label: "Clean" },
  { key: "hype", label: "Hype" },
  { key: "minimal", label: "Minimal" },
];

const PREVIEW_DIMS: Record<TemplateFormat, { w: number; h: number }> = {
  story: { w: 1080, h: 1920 },
  post: { w: 1080, h: 1080 },
  ad: { w: 1200, h: 628 },
  portrait: { w: 1080, h: 1350 },
};

function usePreviewScale(templateWidth: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.3);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      if (w > 0) setScale(Math.min(1, w / templateWidth));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [templateWidth]);

  return { ref, scale };
}

function PreviewBox({
  templateWidth,
  templateHeight,
  children,
}: {
  templateWidth: number;
  templateHeight: number;
  children: React.ReactNode;
}) {
  const { ref, scale } = usePreviewScale(templateWidth);
  return (
    <div ref={ref} className="mx-auto w-full max-w-[420px]">
      <div
        className="mx-auto"
        style={{
          width: templateWidth * scale,
          height: templateHeight * scale,
        }}
      >
        <div
          style={{
            width: templateWidth,
            height: templateHeight,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export default function MarketingStudio() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initialId = params.get("productId") || "";

  const { data: settings } = useSiteSettings();
  const defaults = settings?.marketingStudio || DEFAULT_MARKETING_STUDIO;

  const { products, loading } = useHybridProducts({ limit: 100 });

  const [selectedId, setSelectedId] = useState<string>(initialId);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<TemplateFormat>("story");
  const [style, setStyle] = useState<TemplateStyle>("hype");

  // Editable session-level fields, seeded from defaults
  const [brandName, setBrandName] = useState(defaults.brandName);
  const [brandLogoUrl, setBrandLogoUrl] = useState(defaults.brandLogoUrl);
  const [meetupText, setMeetupText] = useState(defaults.meetupLocations);
  const [ctaText, setCtaText] = useState(defaults.defaultCta);
  const [urgencyText, setUrgencyText] = useState(defaults.urgencyText);
  const [tagline, setTagline] = useState("");
  const [showPrice, setShowPrice] = useState(defaults.showPriceByDefault);

  // Variant selection
  const [variantMode, setVariantMode] = useState<VariantMode>("single");
  const [selectedVariantIds, setSelectedVariantIds] = useState<string[]>([]);
  const [showVariantLabels, setShowVariantLabels] = useState(true);

  useEffect(() => {
    setBrandName(defaults.brandName);
    setBrandLogoUrl(defaults.brandLogoUrl);
    setMeetupText(defaults.meetupLocations);
    setCtaText(defaults.defaultCta);
    setUrgencyText(defaults.urgencyText);
    setShowPrice(defaults.showPriceByDefault);
  }, [defaults.brandName, defaults.brandLogoUrl, defaults.meetupLocations, defaults.defaultCta, defaults.urgencyText, defaults.showPriceByDefault]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products.slice(0, 50);
    return products.filter((p) => p.title.toLowerCase().includes(q)).slice(0, 50);
  }, [products, search]);

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedId) || products[0],
    [products, selectedId]
  );

  useEffect(() => {
    if (!selectedId && products.length > 0) {
      setSelectedId(products[0].id);
    }
  }, [products, selectedId]);

  // Build variant options from selected product. De-dupe by image+label so
  // products with size+color combos don't show 30 near-identical tiles.
  const variantOptions = useMemo<VariantOption[]>(() => {
    if (!selectedProduct) return [];
    const fallback = selectedProduct.images?.[0]?.url;
    const seen = new Set<string>();
    const opts: VariantOption[] = [];
    for (const v of selectedProduct.variants) {
      if (v.title === "Default Title" || v.title === "Default") continue;
      // Prefer Color option for label, otherwise the variant title
      const colorOpt = v.selectedOptions.find(
        (o) => o.name.toLowerCase() === "color" || o.name.toLowerCase() === "colour",
      );
      const label = colorOpt?.value || v.title;
      const imageUrl = v.image?.url || fallback;
      const key = `${label}::${imageUrl || ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      opts.push({
        id: v.id,
        label,
        imageUrl,
        available: v.availableForSale,
      });
    }
    return opts;
  }, [selectedProduct]);

  // Reset variant selection when product changes
  useEffect(() => {
    if (variantOptions.length === 0) {
      setSelectedVariantIds([]);
      return;
    }
    setSelectedVariantIds([variantOptions[0].id]);
    setVariantMode("single");
  }, [selectedProduct?.id, variantOptions]);

  // Compute variant images for the template
  const variantImages = useMemo(() => {
    const picked = selectedVariantIds
      .map((id) => variantOptions.find((v) => v.id === id))
      .filter((v): v is VariantOption => Boolean(v && v.imageUrl));
    return picked.map((v) => ({ url: v.imageUrl as string, label: v.label }));
  }, [selectedVariantIds, variantOptions]);

  const productPayload = useMemo(() => {
    if (!selectedProduct) return null;
    const stockBadge =
      selectedProduct.stockStatus === "in_stock"
        ? "In Stock"
        : selectedProduct.stockStatus === "low_stock"
          ? "Low Stock"
          : "Sold Out";
    // In single mode, use the chosen variant image as the main visual
    const singleVariantImage =
      variantMode === "single" && variantImages.length === 1
        ? variantImages[0].url
        : undefined;
    return {
      name: selectedProduct.title,
      productImage: singleVariantImage || selectedProduct.images?.[0]?.url,
      price: selectedProduct.price?.amount,
      description: selectedProduct.description?.slice(0, 160),
      category: selectedProduct.category || undefined,
      stockStatus: stockBadge,
    };
  }, [selectedProduct, variantMode, variantImages]);

  const exportRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (!exportRef.current || !productPayload) return;
    setExporting(true);
    try {
      const dataUrl = await toPng(exportRef.current, {
        cacheBust: true,
        pixelRatio: 1,
        skipFonts: false,
      });
      const link = document.createElement("a");
      const safeName = productPayload.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 40);
      link.download = `${safeName}-${tab}-${style}.png`;
      link.href = dataUrl;
      link.click();
      toast.success("Image downloaded");
    } catch (e: any) {
      console.error(e);
      toast.error("Export failed — image may be cross-origin blocked");
    } finally {
      setExporting(false);
    }
  };

  const templateProps = productPayload
    ? {
        format: tab,
        style,
        productName: productPayload.name,
        productImage: productPayload.productImage,
        price: productPayload.price ? String(productPayload.price) : undefined,
        showPrice,
        description: productPayload.description,
        tagline: tagline || undefined,
        stockBadge: productPayload.stockStatus,
        brandName,
        brandLogoUrl: brandLogoUrl || undefined,
        meetupText,
        ctaText,
        urgencyText,
        variantImages: variantMode === "multi" && variantImages.length > 1 ? variantImages : undefined,
        showVariantLabels,
      }
    : null;

  return (
    <AdminAuth>
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <main className="container flex-1 py-6">
          <div className="mb-5 flex items-center gap-3">
            <BackButton to="/admin" />
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-fuchsia-500/10">
              <Megaphone className="h-5 w-5 text-fuchsia-500" />
            </div>
            <div>
              <h1 className="font-display text-xl md:text-2xl">Marketing Studio</h1>
              <p className="text-xs text-muted-foreground">
                Turn any product into ready-to-post content
              </p>
            </div>
          </div>

          {/* Product picker */}
          <Card className="mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Pick a product</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                placeholder="Search products..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger>
                  <SelectValue placeholder={loading ? "Loading..." : "Select a product"} />
                </SelectTrigger>
                <SelectContent className="max-h-[60vh]">
                  {filtered.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.title} — EC${p.price?.amount}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedProduct && (
                <div className="flex items-center gap-3 rounded-md border p-2">
                  {selectedProduct.images?.[0]?.url && (
                    <img
                      src={selectedProduct.images[0].url}
                      alt=""
                      className="h-12 w-12 rounded object-cover"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{selectedProduct.title}</div>
                    <div className="text-xs text-muted-foreground">
                      EC${selectedProduct.price?.amount} ·{" "}
                      <Badge variant="outline" className="text-[10px]">
                        {selectedProduct.stockStatus.replace("_", " ")}
                      </Badge>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Variant selection */}
          {variantOptions.length > 1 && (
            <Card className="mb-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Select Variants</CardTitle>
              </CardHeader>
              <CardContent>
                <VariantSelector
                  variants={variantOptions}
                  mode={variantMode}
                  onModeChange={setVariantMode}
                  selectedIds={selectedVariantIds}
                  onSelectionChange={setSelectedVariantIds}
                  fallbackImageUrl={selectedProduct?.images?.[0]?.url}
                />
              </CardContent>
            </Card>
          )}

          <Tabs value={tab} onValueChange={(v) => setTab(v as TemplateFormat)}>
            <TabsList className="grid w-full grid-cols-5">
              {FORMATS.map((f) => (
                <TabsTrigger key={f.key} value={f.key} className="text-xs">
                  {f.label}
                </TabsTrigger>
              ))}
              <TabsTrigger value="copy" className="text-xs">
                Copy
              </TabsTrigger>
            </TabsList>

            {/* Image tabs */}
            {FORMATS.map((f) => (
              <TabsContent key={f.key} value={f.key} className="mt-4">
                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_320px]">
                  {/* Preview */}
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <ImageIcon className="h-4 w-4" />
                          Preview
                        </CardTitle>
                        <span className="text-[10px] text-muted-foreground">{f.size}</span>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {!templateProps ? (
                        <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
                          Pick a product to preview
                        </div>
                      ) : (
                        <PreviewBox
                          templateWidth={PREVIEW_DIMS[f.key].w}
                          templateHeight={PREVIEW_DIMS[f.key].h}
                        >
                          <MarketingTemplate {...templateProps} />
                        </PreviewBox>
                      )}
                      <Button
                        className="mt-4 w-full gap-2"
                        onClick={handleExport}
                        disabled={!templateProps || exporting}
                      >
                        {exporting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4" />
                        )}
                        Download PNG
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Controls */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Style & Branding</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <Label className="text-xs">Style</Label>
                        <div className="mt-1 grid grid-cols-3 gap-1.5">
                          {STYLES.map((s) => (
                            <Button
                              key={s.key}
                              size="sm"
                              variant={style === s.key ? "default" : "outline"}
                              className="text-xs"
                              onClick={() => setStyle(s.key)}
                            >
                              {s.label}
                            </Button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs">Brand Name</Label>
                        <Input
                          className="mt-1"
                          value={brandName}
                          onChange={(e) => setBrandName(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Brand Logo URL (optional)</Label>
                        <Input
                          className="mt-1"
                          placeholder="https://..."
                          value={brandLogoUrl}
                          onChange={(e) => setBrandLogoUrl(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Short Tagline (optional)</Label>
                        <Input
                          className="mt-1"
                          placeholder="e.g. Fresh drop · Just landed"
                          value={tagline}
                          onChange={(e) => setTagline(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">CTA Text</Label>
                        <Input
                          className="mt-1"
                          value={ctaText}
                          onChange={(e) => setCtaText(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Meetup Text</Label>
                        <Input
                          className="mt-1"
                          value={meetupText}
                          onChange={(e) => setMeetupText(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Urgency</Label>
                        <Input
                          className="mt-1"
                          value={urgencyText}
                          onChange={(e) => setUrgencyText(e.target.value)}
                        />
                      </div>
                      <div className="flex items-center justify-between rounded-md border p-2">
                        <Label className="text-xs">Show price</Label>
                        <Switch checked={showPrice} onCheckedChange={setShowPrice} />
                      </div>
                      {variantMode === "multi" && selectedVariantIds.length > 1 && (
                        <div className="flex items-center justify-between rounded-md border p-2">
                          <Label className="text-xs">Show variant labels</Label>
                          <Switch
                            checked={showVariantLabels}
                            onCheckedChange={setShowVariantLabels}
                          />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            ))}

            {/* Copy tab */}
            <TabsContent value="copy" className="mt-4">
              {productPayload ? (
                <CopyPanel
                  product={{
                    ...productPayload,
                    brandName,
                    meetupLocations: meetupText,
                    cta: ctaText,
                    urgencyText,
                  }}
                />
              ) : (
                <Card>
                  <CardContent className="py-8 text-center text-sm text-muted-foreground">
                    Pick a product to generate copy
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>

          {/* Hidden full-resolution export node */}
          <div
            style={{
              position: "fixed",
              top: -100000,
              left: -100000,
              pointerEvents: "none",
              opacity: 0,
            }}
            aria-hidden
          >
            {templateProps && tab !== ("copy" as any) && (
              <div ref={exportRef}>
                <MarketingTemplate {...templateProps} />
              </div>
            )}
          </div>
        </main>
      </div>
    </AdminAuth>
  );
}
