import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toJpeg, toCanvas } from "html-to-image";
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
import { Megaphone, Download, Loader2, Image as ImageIcon, Share2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";
import { useHybridProducts } from "@/hooks/useHybridProducts";
import { useSiteSettings, DEFAULT_MARKETING_STUDIO } from "@/hooks/useSiteSettings";
import {
  MarketingTemplate,
  MultiProductTemplate,
  TemplateFormat,
} from "@/components/marketing/templates";
import { CopyPanel } from "@/components/marketing/CopyPanel";
import { VariantSelector, VariantMode, VariantOption } from "@/components/marketing/VariantSelector";
import { PosterTypeSelector } from "@/components/marketing/PosterTypeSelector";
import { ProductSourceCard } from "@/components/marketing/ProductSourceCard";
import { ImagePrepPanel } from "@/components/marketing/ImagePrepPanel";
import { useImagePrep } from "@/hooks/useImagePrep";
import {
  PosterType,
  MarketingProduct,
  getPosterTypeMeta,
} from "@/lib/marketingPosterTypes";
import { PresetPicker } from "@/components/marketing/PresetPicker";
import { PresetOverridePanel, PresetOverrides } from "@/components/marketing/PresetOverridePanel";
import { getPreset, mergePreset, getBuiltinPresets } from "@/lib/marketingPresets";
import {
  prefetchImagesAsDataUrls,
  waitForDomImages,
  useImagesReady,
} from "@/lib/exportImageCache";

const FORMATS: { key: TemplateFormat; label: string; size: string }[] = [
  { key: "story", label: "Story", size: "1080×1920" },
  { key: "post", label: "Post", size: "1080×1080" },
  { key: "ad", label: "Ad", size: "1200×628" },
  { key: "portrait", label: "Portrait", size: "1080×1350" },
];


const PREVIEW_DIMS: Record<TemplateFormat, { w: number; h: number }> = {
  story: { w: 1080, h: 1920 },
  post: { w: 1080, h: 1080 },
  ad: { w: 1200, h: 628 },
  portrait: { w: 1080, h: 1350 },
};

function usePreviewScale(templateWidth: number, templateHeight: number, maxHeight: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.3);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      if (w <= 0) return;
      const scaleByWidth = w / templateWidth;
      const scaleByHeight = maxHeight / templateHeight;
      setScale(Math.min(1, scaleByWidth, scaleByHeight));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [templateWidth, templateHeight, maxHeight]);

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
  // Cap preview height so tall Story posters don't blow past the viewport on mobile.
  // Use ~55vh on small screens, ~70vh on larger.
  const [maxH, setMaxH] = useState(500);
  useEffect(() => {
    const compute = () => {
      const vh = window.innerHeight || 800;
      const isSmall = window.innerWidth < 768;
      setMaxH(Math.round(vh * (isSmall ? 0.55 : 0.7)));
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);

  const { ref, scale } = usePreviewScale(templateWidth, templateHeight, maxH);
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
  
  const [activePresetId, setActivePresetId] = useState<string>("hype");
  const [presetOverrides, setPresetOverrides] = useState<PresetOverrides>({});

  const activePreset = useMemo(() => {
    const base = getPreset(activePresetId) || getBuiltinPresets()[1];
    return mergePreset(base, presetOverrides);
  }, [activePresetId, presetOverrides]);

  // Reset overrides when switching preset
  useEffect(() => {
    setPresetOverrides({});
  }, [activePresetId]);

  // Editable session-level fields, seeded from defaults
  const [brandName, setBrandName] = useState(defaults.brandName);
  const [brandLogoUrl, setBrandLogoUrl] = useState(defaults.brandLogoUrl);
  const [meetupText, setMeetupText] = useState(defaults.meetupLocations);
  const [ctaText, setCtaText] = useState(defaults.defaultCta);
  const [urgencyText, setUrgencyText] = useState(defaults.urgencyText);
  const [tagline, setTagline] = useState("");
  const [showPrice, setShowPrice] = useState(defaults.showPriceByDefault);

  // Poster type (content engine)
  const [posterType, setPosterType] = useState<PosterType>("single");
  const [sourceSelectedIds, setSourceSelectedIds] = useState<string[]>([]);
  const [sourceLimit, setSourceLimit] = useState(4);
  const [sourceProducts, setSourceProducts] = useState<MarketingProduct[]>([]);
  const [showTileBadges, setShowTileBadges] = useState(true);
  const [showTileLabels, setShowTileLabels] = useState(true);
  const [promoCampaignId, setPromoCampaignId] = useState<string | undefined>(undefined);

  // Variant selection (single-promo only)
  const [variantMode, setVariantMode] = useState<VariantMode>("single");
  const [selectedVariantIds, setSelectedVariantIds] = useState<string[]>([]);
  const [showVariantLabels, setShowVariantLabels] = useState(true);

  // Switch poster type → adapt urgency / CTA defaults so the new poster reads correctly
  useEffect(() => {
    const meta = getPosterTypeMeta(posterType);
    if (posterType !== "single") {
      setUrgencyText(meta.defaultUrgency);
      if (meta.defaultCta) setCtaText(meta.defaultCta);
    }
    // reset source selection when changing type
    setSourceSelectedIds([]);
  }, [posterType]);

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

  // ---- AI-assisted image prep (single-product hero image) ----
  const singlePrep = useImagePrep(productPayload?.productImage, tab);

  // ---- AI-assisted image prep (multi-product, applied to all tiles) ----
  const [multiPrepMode, setMultiPrepMode] = useState<
    import("@/hooks/useImagePrep").PrepMode
  >("original");
  // Show prep preview against the first tile so admin sees what will apply.
  const firstSourceImage = sourceProducts[0]?.imageUrl;
  const multiPrepPreview = useImagePrep(firstSourceImage, tab);
  // Keep the preview hook in sync with the global multi mode.
  useEffect(() => {
    if (multiPrepPreview.mode !== multiPrepMode) {
      multiPrepPreview.setMode(multiPrepMode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [multiPrepMode]);

  const exportRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const isMobile = useIsMobile();
  const [canShare, setCanShare] = useState(false);

  // Detect Web Share API (Level 2 — files) once at mount
  useEffect(() => {
    try {
      const probe = new File([new Blob(["x"], { type: "image/png" })], "probe.png", {
        type: "image/png",
      });
      const ok =
        typeof navigator !== "undefined" &&
        typeof (navigator as any).canShare === "function" &&
        (navigator as any).canShare({ files: [probe] });
      setCanShare(Boolean(ok));
    } catch {
      setCanShare(false);
    }
  }, []);

  const isMulti = posterType !== "single";
  const meta = getPosterTypeMeta(posterType);

  const slugify = (s: string) =>
    s
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase()
      .slice(0, 50) || "poster";

  const buildPosterFilename = (): string => {
    const today = new Date().toISOString().slice(0, 10);
    let core: string;
    if (!isMulti) {
      const name = productPayload?.name || "product";
      core = `product-${slugify(name)}`;
    } else if (posterType === "bestsellers") {
      core = `best-sellers-week-${today}`;
    } else if (posterType === "promotions") {
      core = `promo-${today}`;
    } else {
      const typeSlug = slugify(meta.label);
      core = `${typeSlug}-${today}`;
    }
    return `luutslu-${core}-${tab}.jpeg`;
  };

  const dataUrlToBlob = async (dataUrl: string): Promise<Blob> => {
    const res = await fetch(dataUrl);
    return await res.blob();
  };

  const handleExport = async () => {
    if (!exportRef.current) return;
    if (!isMulti && !productPayload) return;
    if (isMulti && sourceProducts.length === 0) {
      toast.error("Select at least one product to generate a poster");
      return;
    }
    setExporting(true);
    try {
      // 1. Make sure every <img> in the export node is fully loaded + decoded.
      await waitForDomImages(exportRef.current);

      // 2. Collect every external image URL the export node references.
      const urlSet = new Set<string>();
      if (brandLogoUrl) urlSet.add(brandLogoUrl);
      if (!isMulti) {
        const heroUrl = singlePrep.preparedUrl || productPayload?.productImage;
        if (heroUrl) urlSet.add(heroUrl);
        for (const v of variantImages) if (v.url) urlSet.add(v.url);
      } else if (multiTemplateProps) {
        for (const p of multiTemplateProps.products) {
          if (p.imageUrl) urlSet.add(p.imageUrl);
        }
      }
      const liveImgs = exportRef.current.querySelectorAll("img");
      liveImgs.forEach((img) => {
        const src = img.getAttribute("src");
        if (src) urlSet.add(src);
      });

      // 3. Pre-resolve all external images to data URLs so html-to-image
      //    never re-fetches them (this is what was breaking on mobile).
      let placeholders: Record<string, string> = {};
      try {
        placeholders = await prefetchImagesAsDataUrls(Array.from(urlSet));
      } catch (e) {
        console.error("Image prefetch failed:", e);
        toast.error("Couldn't load product image — try again in a moment");
        return;
      }

      // 4. Swap every <img src> in the export node to its data URL.
      const swapped: { el: HTMLImageElement; original: string }[] = [];
      liveImgs.forEach((img) => {
        const src = img.getAttribute("src");
        if (!src) return;
        const replacement = placeholders[src];
        if (replacement && replacement !== src) {
          swapped.push({ el: img, original: src });
          img.setAttribute("src", replacement);
        }
      });
      await waitForDomImages(exportRef.current);

      // 5. Capture as JPEG (high quality, smaller file, gallery-friendly).
      let dataUrl: string;
      try {
        dataUrl = await toJpeg(exportRef.current, {
          cacheBust: false,
          pixelRatio: 2,
          skipFonts: false,
          quality: 0.95,
          backgroundColor: "#000000",
        });
      } finally {
        swapped.forEach(({ el, original }) => el.setAttribute("src", original));
      }

      // 6. Validate: a broken capture is usually < 5KB.
      const blob = await dataUrlToBlob(dataUrl);
      if (blob.size < 5_000) {
        toast.error("Export looks incomplete — please try again");
        return;
      }

      const filename = buildPosterFilename();

      // 7. Mobile + Web Share API (files) → open native share/save sheet so
      //    the user can pick Save Image / Photos / Files / etc.
      if (isMobile && canShare) {
        try {
          const file = new File([blob], filename, { type: "image/jpeg" });
          const nav = navigator as any;
          if (nav.canShare?.({ files: [file] })) {
            await nav.share({
              files: [file],
              title: filename,
              text: "Luut SLU poster",
            });
            return; // OS sheet handled it
          }
        } catch (err: any) {
          if (err?.name === "AbortError") return; // user cancelled
          console.warn("Share failed, falling back to download", err);
          // fall through to download
        }
      }

      // 8. Desktop (or mobile w/o Web Share files) → direct download.
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1500);

      toast.success("Poster downloaded");
    } catch (e: any) {
      console.error(e);
      toast.error("Export failed — please try again");
    } finally {
      setExporting(false);
    }
  };

  // All presets (including Hype default) route through the preset-driven
  // PresetLayout so Style & Branding controls always take effect.
  const templateProps = productPayload
    ? {
        format: tab,
        style: "hype" as const,
        productName: productPayload.name,
        productImage: singlePrep.preparedUrl || productPayload.productImage,
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
        preset: activePreset,
      }
    : null;

  // Apply the chosen multi-prep mode to every tile via a per-image
  // useImagePrep call would be N hooks — instead we use a tiny inline
  // canvas pass for canvas-only modes and skip AI modes for multi (cost).
  const preparedTiles = useMemo(() => {
    return sourceProducts.map((p) => ({
      id: p.id,
      title: p.title,
      imageUrl: p.imageUrl, // placeholder; replaced async below via cache
      price: p.price,
      badge: p.badge,
      hint: p.hint,
    }));
    // We intentionally exclude multiPrepMode here — tiles map is async.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceProducts]);

  // Async tile preparation: when mode/format/source changes, run canvas ops
  // for each tile and stash the results in local state.
  const [tilePreparedMap, setTilePreparedMap] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!isMulti) return;
    if (multiPrepMode === "original") {
      setTilePreparedMap({});
      return;
    }
    // AI modes are disabled for multi-product to avoid N gateway calls.
    if (multiPrepMode === "remove-bg" || multiPrepMode === "expand") {
      return;
    }
    let cancelled = false;
    (async () => {
      const { autoFitProduct, smartReframe, enhanceImage } = await import(
        "@/lib/imagePrep"
      );
      const next: Record<string, string> = {};
      await Promise.all(
        sourceProducts.map(async (p) => {
          if (!p.imageUrl) return;
          try {
            let r: string;
            if (multiPrepMode === "auto-fit") r = await autoFitProduct(p.imageUrl, tab);
            else if (multiPrepMode === "reframe") r = await smartReframe(p.imageUrl, tab);
            else r = await enhanceImage(p.imageUrl);
            next[p.id] = r;
          } catch (e) {
            console.warn("Tile prep failed for", p.id, e);
          }
        }),
      );
      if (!cancelled) setTilePreparedMap(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [isMulti, multiPrepMode, tab, sourceProducts]);

  const multiTemplateProps = isMulti
    ? {
        format: tab,
        headline: meta.headline,
        subhead: tagline || undefined,
        products: preparedTiles.map((p) => ({
          ...p,
          imageUrl: tilePreparedMap[p.id] || p.imageUrl,
        })),
        brandName,
        brandLogoUrl: brandLogoUrl || undefined,
        meetupText,
        ctaText,
        urgencyText,
        showPrice,
        showBadges: showTileBadges,
        showLabels: showTileLabels,
        preset: activePreset,
      }
    : null;

  // Gate export until every external image referenced by the current poster
  // is reachable. Prevents mobile users from triggering a half-loaded capture.
  const exportImageUrls = useMemo(() => {
    const out: string[] = [];
    if (brandLogoUrl) out.push(brandLogoUrl);
    if (!isMulti) {
      const hero = singlePrep.preparedUrl || productPayload?.productImage;
      if (hero) out.push(hero);
      for (const v of variantImages) if (v.url) out.push(v.url);
    } else if (multiTemplateProps) {
      for (const p of multiTemplateProps.products) if (p.imageUrl) out.push(p.imageUrl);
    }
    return out;
  }, [brandLogoUrl, isMulti, singlePrep.preparedUrl, productPayload?.productImage, variantImages, multiTemplateProps]);
  const imagesReady = useImagesReady(exportImageUrls);

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

          {/* Poster Type chips */}
          <Card className="mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Poster Type</CardTitle>
            </CardHeader>
            <CardContent>
              <PosterTypeSelector value={posterType} onChange={setPosterType} />
            </CardContent>
          </Card>

          {/* Single-product picker (only for Single Promo) */}
          {!isMulti && (
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
                        {p.title}{p.price?.amount ? ` — EC$${Math.round(Number(p.price.amount))}` : ""}
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
                        EC${Math.round(Number(selectedProduct.price?.amount ?? 0))} ·{" "}
                        <Badge variant="outline" className="text-[10px]">
                          {selectedProduct.stockStatus.replace("_", " ")}
                        </Badge>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Multi-product source (everything except Single Promo) */}
          {isMulti && (
            <Card className="mb-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Products in poster</CardTitle>
              </CardHeader>
              <CardContent>
                <ProductSourceCard
                  posterType={posterType}
                  selectedIds={sourceSelectedIds}
                  onSelectionChange={setSourceSelectedIds}
                  limit={sourceLimit}
                  onLimitChange={setSourceLimit}
                  onProductsResolved={setSourceProducts}
                  campaignId={promoCampaignId}
                  onCampaignChange={setPromoCampaignId}
                />
              </CardContent>
            </Card>
          )}

          {/* Variant selection — only relevant for single product */}
          {!isMulti && variantOptions.length > 1 && (
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

          {/* Image prep — single product */}
          {!isMulti && productPayload?.productImage && (
            <Card className="mb-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Prepare image</CardTitle>
              </CardHeader>
              <CardContent>
                <ImagePrepPanel
                  sourceUrl={productPayload.productImage}
                  preparedUrl={singlePrep.preparedUrl}
                  mode={singlePrep.mode}
                  onModeChange={singlePrep.setMode}
                  isProcessing={singlePrep.isProcessing}
                />
              </CardContent>
            </Card>
          )}

          {/* Image prep — multi-product (applied to every tile, canvas-only) */}
          {isMulti && sourceProducts.length > 0 && (
            <Card className="mb-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Prepare tile images</CardTitle>
              </CardHeader>
              <CardContent>
                <ImagePrepPanel
                  sourceUrl={firstSourceImage}
                  preparedUrl={multiPrepPreview.preparedUrl}
                  mode={multiPrepMode}
                  onModeChange={(m) => {
                    if (m === "remove-bg" || m === "expand") {
                      toast.info(
                        "AI background edits are available for single-product posters only — keeps generation fast and free of multi-tile credit usage.",
                      );
                      return;
                    }
                    setMultiPrepMode(m);
                  }}
                  isProcessing={multiPrepPreview.isProcessing}
                />
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Applied to every product tile in this poster.
                </p>
              </CardContent>
            </Card>
          )}

          <Tabs value={tab} onValueChange={(v) => setTab(v as TemplateFormat)} className="w-full min-w-0">
            <div className="w-full overflow-x-auto">
              <TabsList className="inline-flex w-auto min-w-full justify-start">
                {FORMATS.map((f) => (
                  <TabsTrigger key={f.key} value={f.key} className="text-xs">
                    {f.label}
                  </TabsTrigger>
                ))}
                <TabsTrigger value="copy" className="text-xs">
                  Copy
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Image tabs */}
            {FORMATS.map((f) => (
              <TabsContent key={f.key} value={f.key} className="mt-4">
                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_320px] [&>*]:min-w-0">
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
                      {isMulti ? (
                        !multiTemplateProps || multiTemplateProps.products.length === 0 ? (
                          <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
                            Select products to preview
                          </div>
                        ) : (
                          <PreviewBox
                            templateWidth={PREVIEW_DIMS[f.key].w}
                            templateHeight={PREVIEW_DIMS[f.key].h}
                          >
                            <MultiProductTemplate {...multiTemplateProps} />
                          </PreviewBox>
                        )
                      ) : !templateProps ? (
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
                        disabled={
                          exporting ||
                          !imagesReady ||
                          (isMulti
                            ? !multiTemplateProps || multiTemplateProps.products.length === 0
                            : !templateProps)
                        }
                      >
                        {exporting || !imagesReady ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : isMobile && canShare ? (
                          <Share2 className="h-4 w-4" />
                        ) : (
                          <Download className="h-4 w-4" />
                        )}
                        {!imagesReady
                          ? "Loading image…"
                          : exporting
                            ? "Preparing…"
                            : isMobile && canShare
                              ? "Save / Share"
                              : "Download JPEG"}
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
                        <Label className="text-xs">Design Preset</Label>
                        <div className="mt-1.5">
                          <PresetPicker
                            activeId={activePresetId}
                            onChange={setActivePresetId}
                          />
                        </div>
                      </div>
                      <PresetOverridePanel
                        basePreset={activePreset}
                        overrides={presetOverrides}
                        onChange={setPresetOverrides}
                      />
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
                      {isMulti && (
                        <>
                          <div className="flex items-center justify-between rounded-md border p-2">
                            <Label className="text-xs">Show tile badges</Label>
                            <Switch checked={showTileBadges} onCheckedChange={setShowTileBadges} />
                          </div>
                          <div className="flex items-center justify-between rounded-md border p-2">
                            <Label className="text-xs">Show product names</Label>
                            <Switch checked={showTileLabels} onCheckedChange={setShowTileLabels} />
                          </div>
                        </>
                      )}
                      {!isMulti && variantMode === "multi" && selectedVariantIds.length > 1 && (
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
            {tab !== ("copy" as any) && (
              <div ref={exportRef}>
                {isMulti && multiTemplateProps && multiTemplateProps.products.length > 0 ? (
                  <MultiProductTemplate {...multiTemplateProps} />
                ) : !isMulti && templateProps ? (
                  <MarketingTemplate {...templateProps} />
                ) : null}
              </div>
            )}
          </div>
        </main>
      </div>
    </AdminAuth>
  );
}
