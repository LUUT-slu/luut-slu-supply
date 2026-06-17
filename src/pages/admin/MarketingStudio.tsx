import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
// html-to-image is large (~80KB) — lazy-loaded inside export handlers below.
type ToJpegFn = (node: HTMLElement, opts?: any) => Promise<string>;
type ToCanvasFn = (node: HTMLElement, opts?: any) => Promise<HTMLCanvasElement>;
let _htmlToImageMod: { toJpeg: ToJpegFn; toCanvas: ToCanvasFn } | null = null;
async function loadHtmlToImage() {
  if (!_htmlToImageMod) {
    _htmlToImageMod = await import("html-to-image");
  }
  return _htmlToImageMod;
}
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
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Megaphone, Download, Loader2, Image as ImageIcon, Share2, Undo2, Redo2, RotateCcw, Video, Sparkles } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
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
  loadImageElement,
  isIOSSafari,
} from "@/lib/exportImageCache";
import { ImageEditorModal } from "@/components/marketing/ImageEditorModal";
import {
  CropState,
  DEFAULT_CROP,
  cropToSourceRect,
  isDefaultCrop,
} from "@/lib/imageCropState";
import DesktopChrome from "./marketing-studio/DesktopChrome";
import MobileShell from "./marketing-studio/MobileShell";
import VideoModule from "./marketing-studio/VideoModule";

const FORMATS: { key: TemplateFormat; label: string; size: string }[] = [
  { key: "story", label: "Story", size: "1080×1920" },
  { key: "post", label: "Post", size: "1080×1080" },
  { key: "ad", label: "Ad", size: "1200×628" },
  { key: "portrait", label: "Portrait", size: "1080×1350" },
];

type StudioTab = TemplateFormat | "copy";


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
  const [tab, setTab] = useState<StudioTab>("story");
  const activeTemplateFormat: TemplateFormat =
    tab === "story" || tab === "post" || tab === "ad" || tab === "portrait" ? tab : "story";
  const [studioMode, setStudioMode] = useState<'select' | 'images' | 'videos'>('select');
  
  
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
  const singlePrep = useImagePrep(productPayload?.productImage, activeTemplateFormat);

  // ---- AI Display Image generator (Replicate flux-kontext-pro) ----
  type DisplayAspect = "1:1" | "4:5" | "9:16" | "3:4" | "16:9" | "4:3";
  type LogoPos = "top-left" | "top-center" | "top-right" | "bottom-left" | "bottom-center" | "bottom-right";
  const DISPLAY_ASPECTS: { key: DisplayAspect; size: string }[] = [
    { key: "1:1", size: "1080×1080" },
    { key: "4:5", size: "1080×1350" },
    { key: "9:16", size: "1080×1920" },
    { key: "3:4", size: "1080×1440" },
    { key: "16:9", size: "1920×1080" },
    { key: "4:3", size: "1440×1080" },
  ];
  type DisplayStyle = "studio" | "lifestyle" | "minimal" | "human";
  type ModelGender = "male" | "female" | "unspecified";
  type SkinTone = "light" | "medium-light" | "medium" | "medium-dark" | "dark";
  type DisplayBackground = "solid" | "gradient" | "studio" | "lifestyle" | "transparent";
  const [displayStyle, setDisplayStyle] = useState<DisplayStyle>("studio");
  const [displayAspect, setDisplayAspect] = useState<DisplayAspect>("1:1");
  const [displayTextOverlay, setDisplayTextOverlay] = useState("");
  const [displayCustomPrompt, setDisplayCustomPrompt] = useState("");
  const [displayRefImage, setDisplayRefImage] = useState<string | null>(null);
  const [displayAddLogo, setDisplayAddLogo] = useState(false);
  const [displayLogoPos, setDisplayLogoPos] = useState<LogoPos>("bottom-right");
  const [displayBackground, setDisplayBackground] = useState<DisplayBackground>("studio");
  const [modelGender, setModelGender] = useState<ModelGender>("unspecified");
  const [skinTone, setSkinTone] = useState<SkinTone>("medium");
  const [displayLoading, setDisplayLoading] = useState(false);
  const [displayResultUrl, setDisplayResultUrl] = useState<string | null>(null);
  const [displayResultId, setDisplayResultId] = useState<string | null>(null);
  const [displayComposite, setDisplayComposite] = useState<string | null>(null);
  const [displayCompositing, setDisplayCompositing] = useState(false);
  const [displayCompositeSaved, setDisplayCompositeSaved] = useState(false);
  const [displayPrompt, setDisplayPrompt] = useState<string>("");

  // AI Poster (Ideogram v3) — separate generation surface
  const [showAiPoster, setShowAiPoster] = useState(false);
  const [aiPosterStyle, setAiPosterStyle] = useState<"hype" | "clean" | "luxury" | "bold">("hype");
  const [aiPosterAspectRatio, setAiPosterAspectRatio] = useState("9:16");
  const [aiPosterCustom, setAiPosterCustom] = useState("");
  const [aiPosterGenerating, setAiPosterGenerating] = useState(false);
  const [aiPosterResult, setAiPosterResult] = useState<string | null>(null);
  const [aiPosterPrompt, setAiPosterPrompt] = useState("");
  const [aiPosterLastAt, setAiPosterLastAt] = useState<number | null>(null);
  const [mobileProductPickerOpen, setMobileProductPickerOpen] = useState(false);

  const generateAiPoster = async () => {
    if (!productPayload) return;
    setAiPosterGenerating(true);
    setAiPosterResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("generate-ai-poster", {
        body: {
          productTitle: productPayload.name,
          productPrice: productPayload.price ? `EC$${Math.round(Number(productPayload.price))}` : "",
          productImageUrl: productPayload.productImage || "",
          ctaText,
          brandName,
          meetupText,
          urgencyText,
          tagline: tagline || null,
          posterStyle: aiPosterStyle,
          aspectRatio: aiPosterAspectRatio,
          customInstructions: aiPosterCustom || null,
        },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (error || (data as any)?.error) {
        toast.error((data as any)?.error || "Generation failed");
      } else {
        setAiPosterResult((data as any).url);
        setAiPosterPrompt((data as any).prompt || "");
        setAiPosterLastAt(Date.now());
        toast.success("AI poster generated!");
      }
    } catch (e: any) {
      toast.error(e?.message || "Generation failed");
    } finally {
      setAiPosterGenerating(false);
    }
  };

  const handleRefImageFile = (file: File | null) => {
    if (!file) {
      setDisplayRefImage(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setDisplayRefImage(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(file);
  };

  const generateDisplayImage = async () => {
    if (!selectedProduct) return;
    const imageUrl = selectedProduct.images?.[0]?.url;
    if (!imageUrl) {
      toast.error("Selected product has no image to use as reference");
      return;
    }
    setDisplayLoading(true);
    setDisplayResultUrl(null);
    setDisplayResultId(null);
    setDisplayComposite(null);
    setDisplayCompositeSaved(false);
    try {
      // Compose extra prompt: Human Model anchor + background hint + user notes
      const skinToneLabel = skinTone.replace("-", " ");
      const genderClause =
        modelGender === "male"
          ? " The model is male."
          : modelGender === "female"
            ? " The model is female."
            : "";
      const humanAnchor =
        displayStyle === "human"
          ? `A real human model wearing/holding/using the product. The model should have ${skinToneLabel} skin tone.${genderClause} The product must be clearly visible and accurately represented. Fashion editorial style photography, professional lighting, clean background.`
          : "";
      const backgroundHint = (() => {
        switch (displayBackground) {
          case "solid":
            return "Clean solid color background.";
          case "gradient":
            return "Soft gradient background.";
          case "studio":
            return "Professional studio backdrop with controlled lighting.";
          case "lifestyle":
            return "Lifestyle scene background that complements the product.";
          case "transparent":
            return "Pure white background suitable for transparent cut-out.";
          default:
            return "";
        }
      })();
      const composedCustom = [humanAnchor, backgroundHint, displayCustomPrompt.trim()]
        .filter(Boolean)
        .join(" ");

      // Send "lifestyle" to the edge function when human is chosen (closest supported value).
      const styleForApi = displayStyle === "human" ? "lifestyle" : displayStyle;

      const { data, error } = await supabase.functions.invoke("generate-product-display-image", {
        body: {
          productImageUrl: imageUrl,
          productTitle: selectedProduct.title,
          productCategory: selectedProduct.category || "product",
          style: styleForApi,
          aspectRatio: displayAspect,
          textOverlay: displayTextOverlay.trim() || null,
          referenceImageUrl: displayRefImage,
          customPrompt: composedCustom || null,
        },
      });
      if (error) throw new Error(error.message || "Generation failed");
      if (!data?.url) throw new Error(data?.error || "No image returned");
      setDisplayResultUrl(data.url as string);
      setDisplayResultId((data.id as string) || null);
      setDisplayPrompt((data.prompt as string) || "");
      toast.success("Display image generated");
    } catch (e: any) {
      toast.error(e?.message || "Generation failed");
    } finally {
      setDisplayLoading(false);
    }
  };

  // Client-side compositing: overlay brand logo on the generated image
  const compositeLogoOnImage = async () => {
    if (!displayResultUrl) return null;
    const logoUrl = brandLogoUrl;
    if (!logoUrl) return null;
    setDisplayCompositing(true);
    try {
      const loadImg = (src: string) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error("Could not load image"));
          img.src = src;
        });
      const [baseImg, logoImg] = await Promise.all([loadImg(displayResultUrl), loadImg(logoUrl)]);
      const canvas = document.createElement("canvas");
      canvas.width = baseImg.naturalWidth;
      canvas.height = baseImg.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas not supported");
      ctx.drawImage(baseImg, 0, 0);
      const logoW = canvas.width * 0.15;
      const logoH = (logoImg.naturalHeight / logoImg.naturalWidth) * logoW;
      const margin = 8;
      let x = margin;
      let y = margin;
      if (displayLogoPos.endsWith("right")) x = canvas.width - logoW - margin;
      else if (displayLogoPos.endsWith("center")) x = (canvas.width - logoW) / 2;
      if (displayLogoPos.startsWith("bottom")) y = canvas.height - logoH - margin;
      ctx.drawImage(logoImg, x, y, logoW, logoH);
      const dataUrl = canvas.toDataURL("image/png");
      setDisplayComposite(dataUrl);
      return dataUrl;
    } catch (e: any) {
      toast.error(e?.message || "Could not apply logo");
      return null;
    } finally {
      setDisplayCompositing(false);
    }
  };

  // Re-composite whenever the toggle/position changes (after we have a result)
  useEffect(() => {
    if (displayAddLogo && displayResultUrl && brandLogoUrl) {
      compositeLogoOnImage();
      setDisplayCompositeSaved(false);
    } else {
      setDisplayComposite(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayAddLogo, displayLogoPos, displayResultUrl, brandLogoUrl]);

  const saveCompositeToLibrary = async () => {
    if (!displayComposite || !selectedProduct) return;
    try {
      const blob = await (await fetch(displayComposite)).blob();
      const path = `display-composite-${Date.now()}.png`;
      const { error: upErr } = await supabase.storage
        .from("marketing-assets")
        .upload(path, blob, { contentType: "image/png", upsert: true });
      if (upErr) throw upErr;
      const { data: signed, error: sErr } = await supabase.storage
        .from("marketing-assets")
        .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
      if (sErr || !signed?.signedUrl) throw sErr || new Error("Signed URL failed");
      const { error: insErr } = await supabase
        .from("marketing_generated_images" as any)
        .insert({
          image_url: signed.signedUrl,
          thumbnail_url: signed.signedUrl,
          generation_type: "display",
          product_title: selectedProduct.title,
          style: displayStyle,
          aspect_ratio: displayAspect,
          logo_applied: true,
          logo_position: displayLogoPos,
        } as any);
      if (insErr) throw insErr;
      setDisplayCompositeSaved(true);
      toast.success("Saved to library");
    } catch (e: any) {
      toast.error(e?.message || "Save failed");
    }
  };

  const downloadDisplayImage = async () => {
    const target = displayComposite || displayResultUrl;
    if (!target) return;
    try {
      const res = await fetch(target);
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objUrl;
      a.download = `display-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objUrl);
    } catch {
      toast.error("Download failed");
    }
  };


  // ---- AI-assisted image prep (multi-product, applied to all tiles) ----
  const [multiPrepMode, setMultiPrepMode] = useState<
    import("@/hooks/useImagePrep").PrepMode
  >("original");
  // Show prep preview against the first tile so admin sees what will apply.
  const firstSourceImage = sourceProducts[0]?.imageUrl;
  const multiPrepPreview = useImagePrep(firstSourceImage, activeTemplateFormat);
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

  // ---- Manual image editor (per-image crop / zoom / pan) ----
  // Session-level history of cropMap snapshots so the user can undo/redo
  // image edits across the whole poster (in addition to the per-image
  // undo/redo inside the editor modal).
  const [cropMap, setCropMapState] = useState<Record<string, CropState>>({});
  const cropHistoryRef = useRef<Record<string, CropState>[]>([{}]);
  const cropCursorRef = useRef(0);
  const [cropHistoryVersion, setCropHistoryVersion] = useState(0);
  const [editorImage, setEditorImage] = useState<string | null>(null);

  const pushCropHistory = (next: Record<string, CropState>) => {
    // Drop any redo branch ahead of the cursor, then append.
    cropHistoryRef.current = cropHistoryRef.current.slice(0, cropCursorRef.current + 1);
    cropHistoryRef.current.push(next);
    // Cap history at 50 entries to avoid unbounded memory.
    if (cropHistoryRef.current.length > 50) {
      cropHistoryRef.current.shift();
    }
    cropCursorRef.current = cropHistoryRef.current.length - 1;
    setCropHistoryVersion((v) => v + 1);
  };

  const handleImageClick = (url: string) => setEditorImage(url);
  const handleEditorSave = (next: CropState) => {
    if (!editorImage) return;
    const updated = { ...cropMap };
    if (isDefaultCrop(next)) delete updated[editorImage];
    else updated[editorImage] = next;
    setCropMapState(updated);
    pushCropHistory(updated);
  };

  const canUndoCrop = cropCursorRef.current > 0;
  const canRedoCrop = cropCursorRef.current < cropHistoryRef.current.length - 1;
  const hasAnyCrops = Object.keys(cropMap).length > 0;

  const handleUndoCrop = () => {
    if (cropCursorRef.current <= 0) return;
    cropCursorRef.current -= 1;
    setCropMapState(cropHistoryRef.current[cropCursorRef.current]);
    setCropHistoryVersion((v) => v + 1);
  };
  const handleRedoCrop = () => {
    if (cropCursorRef.current >= cropHistoryRef.current.length - 1) return;
    cropCursorRef.current += 1;
    setCropMapState(cropHistoryRef.current[cropCursorRef.current]);
    setCropHistoryVersion((v) => v + 1);
  };
  const handleResetCrops = () => {
    if (Object.keys(cropMap).length === 0) return;
    setCropMapState({});
    pushCropHistory({});
  };
  // Silence unused-var lint for cropHistoryVersion (used to force re-render).
  void cropHistoryVersion;

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
    return `luutslu-${core}-${activeTemplateFormat}.jpeg`;
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
      const liveImgs = Array.from(exportRef.current.querySelectorAll("img"));
      liveImgs.forEach((img) => {
        const src = img.getAttribute("src");
        if (src) urlSet.add(src);
      });

      // 3. Pre-resolve all external images to data URLs so html-to-image
      //    never re-fetches them (fixes mobile CORS re-fetch).
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

      // 5. Capture. iOS Safari has a known html-to-image bug where <img>
      //    tags inside the serialized SVG <foreignObject> are silently
      //    dropped during rasterization. We use a hybrid renderer that:
      //      - captures layout via toCanvas with hero <img>s hidden
      //      - composites hero images natively via Canvas2D drawImage
      //    On non-iOS Safari we keep the fast single-pass toJpeg path.
      const useHybrid = isIOSSafari();

      let dataUrl: string;
      try {
        if (useHybrid) {
          dataUrl = await captureHybrid(exportRef.current, placeholders);
        } else {
          const { toJpeg } = await loadHtmlToImage();
          dataUrl = await toJpeg(exportRef.current, {
            cacheBust: false,
            pixelRatio: 2,
            skipFonts: false,
            quality: 0.95,
            backgroundColor: "#000000",
          });
        }
      } finally {
        swapped.forEach(({ el, original }) => el.setAttribute("src", original));
      }

      // 6. Validate: a broken capture is usually < 5KB.
      const blob = await dataUrlToBlob(dataUrl);
      if (blob.size < 5_000) {
        toast.error("Couldn't render product image — please try again");
        return;
      }

      const filename = buildPosterFilename();

      // 7. Mobile + Web Share API (files) → open native share/save sheet.
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
            return;
          }
        } catch (err: any) {
          if (err?.name === "AbortError") return;
          console.warn("Share failed, falling back to download", err);
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
      const msg = String(e?.message || "");
      if (msg.includes("failed to render")) {
        toast.error("Couldn't render one of the product images — please try again");
      } else {
        toast.error("Export failed — please try again");
      }
    } finally {
      setExporting(false);
    }
  };

  /**
   * Hybrid renderer for iOS Safari:
   *  Pass 1 — toCanvas with every [data-export-hero] <img> hidden via
   *           html-to-image's `filter` option (still occupies layout space
   *           because we use inline visibility:hidden via a temporary class).
   *  Pass 2 — native ctx.drawImage of the prefetched hero into the
   *           bounding rect of the original <img>.
   * Retries up to 3 times with a 200ms delay if the hero region is blank.
   */
  const captureHybrid = async (
    node: HTMLElement,
    placeholders: Record<string, string>,
  ): Promise<string> => {
    const heroEls = Array.from(
      node.querySelectorAll<HTMLImageElement>("img[data-export-hero='true']"),
    );

    // Snapshot bounding rects (relative to export node) BEFORE hiding,
    // so layout positions are accurate. Track BOTH the current src (may be a
    // swapped data: URL) and the ORIGINAL src (used for cropMap lookup).
    const nodeRect = node.getBoundingClientRect();
    const heroRects = heroEls.map((img) => {
      const r = img.getBoundingClientRect();
      const currentSrc = img.getAttribute("src") || "";
      const originalSrc = img.getAttribute("data-export-src") || currentSrc;
      return {
        el: img,
        src: currentSrc,
        originalSrc,
        x: r.left - nodeRect.left,
        y: r.top - nodeRect.top,
        w: r.width,
        h: r.height,
      };
    });

    // Hide hero <img>s for the html-to-image pass (keep layout).
    const prevVisibility = heroEls.map((img) => img.style.visibility);
    heroEls.forEach((img) => {
      img.style.visibility = "hidden";
    });

    let lastError: unknown = null;

    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const pixelRatio = 2;
          const { toCanvas } = await loadHtmlToImage();
          const canvas = await toCanvas(node, {
            cacheBust: false,
            pixelRatio,
            skipFonts: false,
            backgroundColor: "#000000",
          });
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("Canvas 2D context unavailable");

          // Composite each hero image natively onto the canvas.
          // Track which tiles successfully drew so we can validate per-tile.
          const drawnOk = new Set<number>();
          for (let i = 0; i < heroRects.length; i++) {
            const hr = heroRects[i];
            const dataUrl =
              placeholders[hr.originalSrc] || placeholders[hr.src] || hr.src;
            try {
              const img = await loadImageElement(dataUrl);
              const dx = hr.x * pixelRatio;
              const dy = hr.y * pixelRatio;
              const dw = hr.w * pixelRatio;
              const dh = hr.h * pixelRatio;
              // Honor per-image crop (scale + normalized offset) keyed by
              // the ORIGINAL url. Falls back to centered "object-fit: cover".
              const crop = cropMap[hr.originalSrc] ?? DEFAULT_CROP;
              const { sx, sy, sw, sh } = cropToSourceRect(
                img.naturalWidth,
                img.naturalHeight,
                dw,
                dh,
                crop,
              );
              ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
              drawnOk.add(i);
            } catch (err) {
              console.warn("Hero composite failed for", hr.originalSrc, err);
            }
          }

          // Per-tile validation: sample center pixel of each hero rect.
          // A tile that's fully transparent or pure black after compositing
          // is treated as failed and forces a retry.
          const failedTiles: number[] = [];
          for (let i = 0; i < heroRects.length; i++) {
            const hr = heroRects[i];
            if (hr.w < 4 || hr.h < 4) continue;
            if (!drawnOk.has(i)) {
              failedTiles.push(i);
              continue;
            }
            const cx = Math.floor((hr.x + hr.w / 2) * pixelRatio);
            const cy = Math.floor((hr.y + hr.h / 2) * pixelRatio);
            try {
              const px = ctx.getImageData(cx, cy, 1, 1).data;
              const isBlank =
                px[3] === 0 || (px[0] === 0 && px[1] === 0 && px[2] === 0);
              if (isBlank) failedTiles.push(i);
            } catch {
              // getImageData can fail if canvas is tainted; skip check.
            }
          }

          if (failedTiles.length === 0) {
            return canvas.toDataURL("image/jpeg", 0.95);
          }
          if (attempt === 2) {
            // Final attempt still has bad tiles → abort cleanly.
            console.error(
              "Hybrid capture: tiles still blank after 3 attempts",
              failedTiles.map((i) => heroRects[i].originalSrc),
            );
            throw new Error("One or more product images failed to render");
          }
          await new Promise((r) => setTimeout(r, 200));
        } catch (err) {
          lastError = err;
          if (attempt === 2) throw err;
          await new Promise((r) => setTimeout(r, 200));
        }
      }
      throw lastError ?? new Error("Hybrid capture failed");
    } finally {
      heroEls.forEach((img, i) => {
        img.style.visibility = prevVisibility[i] || "";
      });
    }
  };


  // All presets (including Hype default) route through the preset-driven
  // PresetLayout so Style & Branding controls always take effect.
  const templateProps = productPayload
    ? {
        format: activeTemplateFormat,
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
        cropMap,
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
            if (multiPrepMode === "auto-fit") r = await autoFitProduct(p.imageUrl, activeTemplateFormat);
            else if (multiPrepMode === "reframe") r = await smartReframe(p.imageUrl, activeTemplateFormat);
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
  }, [isMulti, multiPrepMode, activeTemplateFormat, sourceProducts]);

  const multiTemplateProps = isMulti
    ? {
        format: activeTemplateFormat,
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
        cropMap,
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

  const activeDesktopTab: "poster" | "display" | "video" | "library" =
    studioMode === "videos"
      ? "video"
      : studioMode === "images" && !showAiPoster
        ? "display"
        : "poster";

  const displayPanel = (
    <div className="space-y-5 rounded-lg border border-[#1c1c1c] bg-[#0c0c0c] p-5 text-[#e8e8e8]">
      <div>
        <div className="text-[14px] font-semibold">Display Image Generator</div>
        <div className="mt-1 text-[11px] text-[#666]">
          AI product display shots for storefronts &amp; ads
        </div>
      </div>

      {selectedProduct ? (
        <div className="flex items-center gap-3 rounded border border-[#1c1c1c] bg-[#111] p-3">
          {selectedProduct.images?.[0]?.url && (
            <img
              src={selectedProduct.images[0].url}
              alt=""
              className="h-12 w-12 rounded object-cover"
            />
          )}
          <div className="min-w-0">
            <div className="truncate text-[12px]">{selectedProduct.title}</div>
            <div className="text-[10px] text-[#555]">Reference image</div>
          </div>
        </div>
      ) : (
        <div className="rounded border border-dashed border-[#1c1c1c] p-4 text-center text-[11px] text-[#555]">
          Pick a product first
        </div>
      )}

      <div>
        <div className="mb-2 text-[10px] uppercase tracking-[0.18em] text-[#555]">Style</div>
        <div className="grid grid-cols-3 gap-2">
          {(["studio", "lifestyle", "minimal"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setDisplayStyle(s)}
              className={`rounded border p-2 text-[11px] capitalize transition-colors ${
                displayStyle === s
                  ? "border-[#e8e8e8] bg-[#161616] text-[#e8e8e8]"
                  : "border-[#1c1c1c] bg-[#111] text-[#aaa] hover:border-[#3a3a3a]"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 text-[10px] uppercase tracking-[0.18em] text-[#555]">Aspect ratio</div>
        <div className="flex flex-wrap gap-1.5">
          {DISPLAY_ASPECTS.map((a) => (
            <button
              key={a.key}
              type="button"
              onClick={() => setDisplayAspect(a.key)}
              className={`rounded-full border px-3 py-1 text-[11px] transition-colors ${
                displayAspect === a.key
                  ? "border-[#e8e8e8] bg-[#e8e8e8] text-[#080808]"
                  : "border-[#1c1c1c] bg-[#111] text-[#aaa]"
              }`}
            >
              {a.key}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 text-[10px] uppercase tracking-[0.18em] text-[#555]">Text on image</div>
        <Input
          value={displayTextOverlay}
          onChange={(e) => setDisplayTextOverlay(e.target.value)}
          placeholder="e.g. SUMMER DROP"
          className="bg-[#111] border-[#1c1c1c] text-[#e8e8e8] text-xs"
        />
      </div>

      <div>
        <div className="mb-2 text-[10px] uppercase tracking-[0.18em] text-[#555]">Reference image (optional)</div>
        <div className="flex items-center gap-3">
          <label className="flex-1 cursor-pointer rounded border border-dashed border-[#1c1c1c] bg-[#111] px-3 py-2 text-[11px] text-[#aaa] hover:border-[#3a3a3a]">
            {displayRefImage ? "Replace reference" : "Upload reference"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleRefImageFile(e.target.files?.[0] || null)}
            />
          </label>
          {displayRefImage && (
            <img src={displayRefImage} alt="" className="h-12 w-12 rounded border border-[#1c1c1c] object-cover" />
          )}
        </div>
      </div>

      <div>
        <div className="mb-2 text-[10px] uppercase tracking-[0.18em] text-[#555]">Additional prompt notes</div>
        <textarea
          value={displayCustomPrompt}
          onChange={(e) => setDisplayCustomPrompt(e.target.value)}
          rows={3}
          placeholder="e.g. sunlit countertop, soft shadows, magazine photography"
          className="w-full resize-none rounded border border-[#1c1c1c] bg-[#111] px-3 py-2 text-[12px] text-[#e8e8e8] placeholder:text-[#555] focus:border-[#3a3a3a] focus:outline-none"
        />
      </div>

      <Button
        className="w-full gap-2 bg-[#e8e8e8] text-[#080808] hover:bg-[#d8d8d8]"
        onClick={generateDisplayImage}
        disabled={!selectedProduct || displayLoading}
      >
        {displayLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Generating image…
          </>
        ) : (
          <>
            <ImageIcon className="h-4 w-4" />
            Generate Image
          </>
        )}
      </Button>

      {displayResultUrl && (
        <div className="space-y-2">
          <img
            src={displayComposite || displayResultUrl}
            alt="Generated display"
            className="w-full rounded border border-[#1c1c1c]"
          />
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 gap-2 border-[#1c1c1c] bg-[#111] text-[#e8e8e8] hover:bg-[#181818]"
              onClick={downloadDisplayImage}
            >
              <Download className="h-4 w-4" />
              Download
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  const videoPanel = (
    <div className="rounded-lg border border-[#1c1c1c] bg-[#0c0c0c] p-5">
      <VideoStudioPanel selectedProduct={selectedProduct} posterType={posterType} />
    </div>
  );

  return (
    <AdminAuth>
      {/* Desktop chrome (lg+) — DesktopChrome handles its own 3-col layout */}
      <div className="hidden lg:block">
        <DesktopChrome
          activeTab={activeDesktopTab}
          onTabChange={(t) => {
            if (t === "poster") {
              setStudioMode("images");
              setShowAiPoster(true);
            } else if (t === "display") {
              setStudioMode("images");
              setShowAiPoster(false);
            } else if (t === "video") {
              setStudioMode("videos");
              setShowAiPoster(false);
            } else if (t === "library") {
              navigate("/admin/content-library");
            }
          }}
          productName={productPayload?.name}
          productImage={productPayload?.productImage}
          productPrice={productPayload?.price}
          brandName={brandName}
          products={products.map((p) => ({ id: p.id, title: p.title }))}
          selectedProductId={selectedId}
          onSelectProduct={setSelectedId}
          aiPosterStyle={aiPosterStyle}
          setAiPosterStyle={setAiPosterStyle}
          aiPosterAspectRatio={aiPosterAspectRatio}
          setAiPosterAspectRatio={setAiPosterAspectRatio}
          urgencyText={urgencyText}
          setUrgencyText={setUrgencyText}
          tagline={tagline}
          setTagline={setTagline}
          meetupText={meetupText}
          setMeetupText={setMeetupText}
          aiPosterCustom={aiPosterCustom}
          setAiPosterCustom={setAiPosterCustom}
          aiPosterGenerating={aiPosterGenerating}
          aiPosterResult={aiPosterResult}
          aiPosterPrompt={aiPosterPrompt}
          lastGeneratedAt={aiPosterLastAt}
          onGenerate={generateAiPoster}
          onClear={() => {
            setAiPosterResult(null);
            setAiPosterPrompt("");
          }}
          displaySlot={displayPanel}
          videoSlot={videoPanel}
          displayStyle={displayStyle}
          setDisplayStyle={setDisplayStyle}
          displayAspect={displayAspect}
          setDisplayAspect={setDisplayAspect}
          displayTextOverlay={displayTextOverlay}
          setDisplayTextOverlay={setDisplayTextOverlay}
          displayBackground={displayBackground}
          setDisplayBackground={setDisplayBackground}
          displayCustomPrompt={displayCustomPrompt}
          setDisplayCustomPrompt={setDisplayCustomPrompt}
          modelGender={modelGender}
          setModelGender={setModelGender}
          skinTone={skinTone}
          setSkinTone={setSkinTone}
          displayLoading={displayLoading}
          displayResultUrl={displayResultUrl}
          displayPrompt={displayPrompt}
          onGenerateDisplay={generateDisplayImage}
          onClearDisplay={() => {
            setDisplayResultUrl(null);
            setDisplayPrompt("");
          }}
        />
      </div>

      {/* Mobile (lg-) — redesigned shell */}
      <MobileShell
        studioMode={studioMode}
        setStudioMode={setStudioMode}
        showAiPoster={showAiPoster}
        setShowAiPoster={setShowAiPoster}
        navigate={navigate}
        productName={productPayload?.name}
        productImage={productPayload?.productImage}
        productPrice={productPayload?.price}
        brandName={brandName}
        aiPosterStyle={aiPosterStyle}
        setAiPosterStyle={setAiPosterStyle}
        aiPosterAspectRatio={aiPosterAspectRatio}
        setAiPosterAspectRatio={setAiPosterAspectRatio}
        urgencyText={urgencyText}
        setUrgencyText={setUrgencyText}
        tagline={tagline}
        setTagline={setTagline}
        meetupText={meetupText}
        setMeetupText={setMeetupText}
        aiPosterCustom={aiPosterCustom}
        setAiPosterCustom={setAiPosterCustom}
        aiPosterGenerating={aiPosterGenerating}
        aiPosterResult={aiPosterResult}
        onGenerate={generateAiPoster}
        onOpenProductPicker={() => setMobileProductPickerOpen(true)}
        displaySlot={displayPanel}
        videoSlot={videoPanel}
        displayStyle={displayStyle}
        setDisplayStyle={setDisplayStyle}
        displayAspect={displayAspect}
        setDisplayAspect={setDisplayAspect}
        displayTextOverlay={displayTextOverlay}
        setDisplayTextOverlay={setDisplayTextOverlay}
        displayBackground={displayBackground}
        setDisplayBackground={setDisplayBackground}
        displayCustomPrompt={displayCustomPrompt}
        setDisplayCustomPrompt={setDisplayCustomPrompt}
        modelGender={modelGender}
        setModelGender={setModelGender}
        skinTone={skinTone}
        setSkinTone={setSkinTone}
        displayLoading={displayLoading}
        displayResultUrl={displayResultUrl}
        displayPrompt={displayPrompt}
        onGenerateDisplay={generateDisplayImage}
        onClearDisplay={() => {
          setDisplayResultUrl(null);
          setDisplayPrompt("");
        }}
      />

      <Dialog open={mobileProductPickerOpen} onOpenChange={setMobileProductPickerOpen}>
        <DialogContent className="lg:hidden max-w-sm bg-[#0c0c0c] border-[#1c1c1c] text-white">
          <DialogHeader>
            <DialogTitle className="text-sm tracking-widest uppercase text-[#888]">Choose product</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-[#111] border-[#1c1c1c] text-white text-sm"
          />
          <div className="max-h-[60vh] overflow-y-auto flex flex-col gap-1">
            {filtered.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setSelectedId(p.id);
                  setMobileProductPickerOpen(false);
                }}
                className={`text-left px-3 py-2 rounded text-sm ${
                  selectedId === p.id ? "bg-[#181818] text-white" : "text-[#aaa] hover:bg-[#161616]"
                }`}
              >
                {p.title}
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="text-xs text-[#555] text-center py-6">No products found</div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AdminAuth>

  );
}

// ============================================================
// Video Studio Panel — image-to-video generation via Replicate
// ============================================================
type MotionStyle = "subtle" | "dynamic" | "cinematic";

function VideoStudioPanel({
  selectedProduct,
  posterType,
}: {
  selectedProduct: any;
  posterType: PosterType;
}) {
  const [motionStyle, setMotionStyle] = useState<MotionStyle>("subtle");
  const [duration, setDuration] = useState<5 | 10>(5);
  const [productLoading, setProductLoading] = useState(false);
  const [productVideoUrl, setProductVideoUrl] = useState<string | null>(null);

  const [posterDataUrl, setPosterDataUrl] = useState<string | null>(null);
  const [posterLoading, setPosterLoading] = useState(false);
  const [posterVideoUrl, setPosterVideoUrl] = useState<string | null>(null);
  const posterFileInputRef = useRef<HTMLInputElement | null>(null);

  async function handleGenerateProductVideo() {
    if (!selectedProduct) return;
    const imageUrl = selectedProduct.images?.[0]?.url;
    if (!imageUrl) {
      toast.error("Selected product has no image");
      return;
    }
    setProductLoading(true);
    setProductVideoUrl(null);
    try {
      const { data, error } = await supabase.functions.invoke("generate-product-video", {
        body: {
          productImageUrl: imageUrl,
          productTitle: selectedProduct.title,
          productCategory: selectedProduct.category || "",
          motionStyle,
          duration,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const url = (data as any)?.videoUrl;
      if (!url) throw new Error("No video returned");
      setProductVideoUrl(url);
      toast.success("Product video ready");
    } catch (e: any) {
      toast.error(e?.message || "Failed to generate video");
    } finally {
      setProductLoading(false);
    }
  }

  function handlePosterFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setPosterDataUrl(typeof reader.result === "string" ? reader.result : null);
      setPosterVideoUrl(null);
    };
    reader.onerror = () => toast.error("Failed to read file");
    reader.readAsDataURL(file);
  }

  async function handleAnimatePoster() {
    if (!posterDataUrl) return;
    setPosterLoading(true);
    setPosterVideoUrl(null);
    try {
      const { data, error } = await supabase.functions.invoke("generate-product-poster-video", {
        body: { posterImageUrl: posterDataUrl, posterType },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const url = (data as any)?.videoUrl;
      if (!url) throw new Error("No video returned");
      setPosterVideoUrl(url);
      toast.success("Poster animated");
    } catch (e: any) {
      toast.error(e?.message || "Failed to animate poster");
    } finally {
      setPosterLoading(false);
    }
  }

  async function downloadVideo(url: string, filename: string) {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objUrl);
    } catch {
      toast.error("Failed to download video");
    }
  }

  const pillClass = (active: boolean) =>
    `h-7 rounded-full border px-3 text-[11px] capitalize transition-colors ${
      active
        ? "border-[#e8e8e8] bg-[#e8e8e8] text-[#080808]"
        : "border-[#1c1c1c] bg-[#111] text-[#aaa] hover:border-[#3a3a3a]"
    }`;
  const primaryBtnClass =
    "flex w-full items-center justify-center gap-2 rounded-md bg-[#e8e8e8] px-4 py-2.5 text-[12px] font-bold text-[#080808] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40";
  const outlineBtnClass =
    "flex w-full items-center justify-center gap-2 rounded-md border border-[#1c1c1c] bg-[#111] px-4 py-2.5 text-[12px] text-[#e8e8e8] transition-colors hover:bg-[#181818] disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Section A — Product Video */}
      <div className="rounded-lg border border-[#1c1c1c] bg-[#0c0c0c] p-5 space-y-3">
        <div>
          <div className="text-[13px] font-semibold text-[#e8e8e8]">Product Video</div>
          <p className="text-[11px] text-[#666] mt-0.5">
            Animate your product photo into a short marketing clip
          </p>
        </div>
        {!selectedProduct ? (
          <div className="rounded-md border border-dashed border-[#1c1c1c] p-6 text-center text-[11px] text-[#555]">
            Select a product to generate a video
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              {selectedProduct.images?.[0]?.url && (
                <img
                  src={selectedProduct.images[0].url}
                  alt={selectedProduct.title}
                  className="h-12 w-12 rounded object-cover"
                />
              )}
              <div className="min-w-0 text-[12px]">
                <div className="truncate font-medium text-[#e8e8e8]">{selectedProduct.title}</div>
              </div>
            </div>

            <div>
              <div className="mb-1.5 text-[10px] uppercase tracking-[0.18em] text-[#555]">Motion Style</div>
              <div className="flex flex-wrap gap-1.5">
                {(["subtle", "dynamic", "cinematic"] as MotionStyle[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={pillClass(motionStyle === s)}
                    onClick={() => setMotionStyle(s)}
                    disabled={productLoading}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-1.5 text-[10px] uppercase tracking-[0.18em] text-[#555]">Duration</div>
              <div className="flex gap-1.5">
                {([5, 10] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    className={pillClass(duration === d)}
                    onClick={() => setDuration(d)}
                    disabled={productLoading}
                  >
                    {d}s
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              className={primaryBtnClass}
              onClick={handleGenerateProductVideo}
              disabled={!selectedProduct || productLoading}
            >
              {productLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating video... ~30–60s
                </>
              ) : (
                <>
                  <Megaphone className="h-4 w-4" />
                  Generate Product Video
                </>
              )}
            </button>

            {productVideoUrl && (
              <div className="space-y-2">
                <video
                  src={productVideoUrl}
                  controls
                  autoPlay
                  muted
                  loop
                  playsInline
                  className="w-full rounded-md border border-[#1c1c1c]"
                />
                <button
                  type="button"
                  className={primaryBtnClass}
                  onClick={() =>
                    downloadVideo(
                      productVideoUrl,
                      `luutslu-${(selectedProduct.title || "product").replace(/\s+/g, "-").toLowerCase()}-video.mp4`,
                    )
                  }
                >
                  <Download className="h-4 w-4" />
                  Download MP4
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Section B — Animate This Poster */}
      <div className="rounded-lg border border-[#1c1c1c] bg-[#0c0c0c] p-5 space-y-3">
        <div>
          <div className="text-[13px] font-semibold text-[#e8e8e8]">Animate This Poster</div>
          <p className="text-[11px] text-[#666] mt-0.5">
            Turn your finished poster into a video for Reels &amp; TikTok
          </p>
        </div>
        <input
          ref={posterFileInputRef}
          type="file"
          accept="image/png,image/jpeg"
          className="hidden"
          onChange={handlePosterFileChange}
        />
        <button
          type="button"
          className={outlineBtnClass}
          onClick={() => posterFileInputRef.current?.click()}
          disabled={posterLoading}
        >
          <ImageIcon className="h-4 w-4" />
          {posterDataUrl ? "Replace Poster Image" : "Upload Poster Image"}
        </button>

        {posterDataUrl && (
          <img
            src={posterDataUrl}
            alt="Poster preview"
            className="mx-auto max-h-48 rounded-md border border-[#1c1c1c] object-contain"
          />
        )}

        <button
          type="button"
          className={primaryBtnClass}
          onClick={handleAnimatePoster}
          disabled={!posterDataUrl || posterLoading}
        >
          {posterLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Animating poster... ~30s
            </>
          ) : (
            <>
              <Megaphone className="h-4 w-4" />
              Animate Poster
            </>
          )}
        </button>

        {posterVideoUrl && (
          <div className="space-y-2">
            <video
              src={posterVideoUrl}
              controls
              autoPlay
              muted
              loop
              playsInline
              className="w-full rounded-md border border-[#1c1c1c]"
            />
            <button
              type="button"
              className={primaryBtnClass}
              onClick={() => downloadVideo(posterVideoUrl, `luutslu-${posterType}-poster-video.mp4`)}
            >
              <Download className="h-4 w-4" />
              Download MP4
            </button>
          </div>
        )}
      </div>
    </div>
  );
}


// ============================================================
// Recently Saved strip — shows last 6 marketing_generated_images
// ============================================================
function RecentlySavedStrip() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Array<{
    id: string;
    image_url: string;
    product_title: string | null;
    style: string | null;
    aspect_ratio: string | null;
    created_at: string;
    generation_type: string;
  }>>([]);
  const [preview, setPreview] = useState<typeof items[number] | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("marketing_generated_images" as any)
        .select("id, image_url, product_title, style, aspect_ratio, created_at, generation_type")
        .order("created_at", { ascending: false })
        .limit(6);
      setItems((data as any) || []);
    })();
  }, []);

  if (items.length === 0) return null;

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    } catch {
      return "";
    }
  };

  const handlePosterAction = async (url: string) => {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("Fetch failed");
      const blob = await res.blob();
      const isMobile = /Mobi|Android/i.test(navigator.userAgent);

      if (isMobile && typeof navigator.share === "function" && navigator.canShare && navigator.canShare({ files: [] })) {
        const file = new File([blob], "luut-poster.png", { type: blob.type || "image/png" });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: "Luut Poster" });
          return;
        }
      }

      if (isMobile) {
        const obj = URL.createObjectURL(blob);
        window.open(obj, "_blank");
        URL.revokeObjectURL(obj);
        return;
      }

      const obj = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = obj;
      a.download = "luut-poster.png";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(obj);
    } catch {
      toast.error("Download failed");
    }
  };

  return (
    <Card className="mt-6">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm">Recently Saved</CardTitle>
        <button
          type="button"
          onClick={() => navigate("/admin/content-library")}
          className="text-xs text-primary hover:underline"
        >
          View all →
        </button>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {items.map((it) => (
            <button
              key={it.id}
              type="button"
              onClick={() => setPreview(it)}
              className="flex-shrink-0 rounded-lg overflow-hidden border hover:opacity-80 transition-opacity"
              style={{ width: 80, height: 80 }}
            >
              <img
                src={it.image_url}
                alt={it.product_title || "Saved"}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      </CardContent>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-[min(92vw,640px)] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm pr-8">
              {preview?.product_title || "Image"}
            </DialogTitle>
          </DialogHeader>
          {preview && (
            <div className="space-y-3">
              <div className="flex justify-center">
                <img
                  src={preview.image_url}
                  alt={preview.product_title || "Image"}
                  className="max-h-[65vh] w-auto max-w-full rounded object-contain"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {preview.style && (
                  <Badge variant="secondary" className="capitalize">{preview.style}</Badge>
                )}
                {preview.aspect_ratio && (
                  <Badge variant="secondary">{preview.aspect_ratio}</Badge>
                )}
                <span>{formatDate(preview.created_at)}</span>
              </div>
              <Button onClick={() => handlePosterAction(preview.image_url)} className="w-full">
                {(() => {
                  const mobile = /Mobi|Android/i.test(navigator.userAgent);
                  return mobile ? (
                    <>
                      <Share2 className="h-4 w-4 mr-2" />
                      Share
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Download PNG
                    </>
                  );
                })()}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
