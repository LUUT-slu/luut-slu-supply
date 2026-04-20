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
  TemplateFormat,
  TemplateStyle,
} from "@/components/marketing/templates";
import { CopyPanel } from "@/components/marketing/CopyPanel";

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

const PREVIEW_SCALE: Record<TemplateFormat, number> = {
  story: 0.22,
  post: 0.32,
  ad: 0.32,
  portrait: 0.28,
};

const PREVIEW_DIMS: Record<TemplateFormat, { w: number; h: number }> = {
  story: { w: 1080, h: 1920 },
  post: { w: 1080, h: 1080 },
  ad: { w: 1200, h: 628 },
  portrait: { w: 1080, h: 1350 },
};

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

  const productPayload = useMemo(() => {
    if (!selectedProduct) return null;
    const stockBadge =
      selectedProduct.stockStatus === "in_stock"
        ? "In Stock"
        : selectedProduct.stockStatus === "low_stock"
          ? "Low Stock"
          : "Sold Out";
    return {
      name: selectedProduct.title,
      productImage: selectedProduct.images?.[0]?.url,
      price: selectedProduct.price?.amount,
      description: selectedProduct.description?.slice(0, 160),
      category: selectedProduct.category || undefined,
      stockStatus: stockBadge,
    };
  }, [selectedProduct]);

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
                        <div className="flex justify-center overflow-hidden">
                          <div
                            style={{
                              transform: `scale(${PREVIEW_SCALE[f.key]})`,
                              transformOrigin: "top center",
                              width: PREVIEW_DIMS[f.key].w * PREVIEW_SCALE[f.key],
                              height: PREVIEW_DIMS[f.key].h * PREVIEW_SCALE[f.key],
                            }}
                          >
                            <div
                              style={{
                                transform: `scale(${1 / 1})`,
                                transformOrigin: "top left",
                              }}
                            >
                              <MarketingTemplate {...templateProps} />
                            </div>
                          </div>
                        </div>
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
