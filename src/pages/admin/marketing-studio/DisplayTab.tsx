import { useMemo, useRef, useState, type CSSProperties } from "react";
import { supabase } from "@/integrations/supabase/client";
import { downloadImage } from "@/lib/downloadImage";
import { toast } from "sonner";
import {
  Loader2, Download, X, Upload, Sparkles, Wand2, ChevronDown,
  Camera, User, Package, Layers, Box, Gem, Sun, Maximize2, Image as ImageIcon,
  Crop, ShoppingBag, RefreshCcw,
} from "lucide-react";
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
} from "@/lib/marketingRouting";
import PromptPreview from "./PromptPreview";
import LayoutPreview from "./LayoutPreview";

/* ============================================================
   LUUT Display Studio — dark image-gen aesthetic. Visual only.
   All product/variant/reference/prompt/generate logic preserved.
   ============================================================ */

const GOLD = "#E0A82E";
const GOLD2 = "#F5C451";
const INK = "#0B0A0D";
const CARD = "#161419";
const RAISED = "#211E26";
const LINE = "#2C2833";
const TEXT = "#B4AEBE";
const goldGrad = `linear-gradient(135deg, ${GOLD} 0%, ${GOLD2} 100%)`;
const goldGlow = `0 10px 30px -12px ${GOLD}80, 0 0 0 1px ${GOLD}55 inset`;

const MAX_REFS = 4;

/* ---------- Option data (unchanged) ---------- */
const GOALS: { key: DisplayGoal; label: string; icon: any }[] = [
  { key: "product_display", label: "Product Display", icon: Package },
  { key: "product_closeup", label: "Product Closeup", icon: Camera },
  { key: "human_model", label: "Human Model", icon: User },
  { key: "lifestyle_product", label: "Lifestyle Product", icon: ImageIcon },
  { key: "product_hero", label: "Product Hero", icon: Maximize2 },
  { key: "packaging_showcase", label: "Packaging Showcase", icon: Box },
];
const STYLES: { key: DisplayStyle; label: string; icon: any }[] = [
  { key: "studio", label: "Studio", icon: Camera },
  { key: "lifestyle", label: "Lifestyle", icon: ImageIcon },
  { key: "minimal", label: "Minimal", icon: Layers },
  { key: "human", label: "Human Model", icon: User },
];
const BACKGROUNDS: { key: DisplayBackground; label: string; preview: CSSProperties }[] = [
  { key: "solid", label: "Solid Color", preview: { background: "#2A2630" } },
  { key: "gradient", label: "Gradient", preview: { background: "linear-gradient(135deg,#E8A87C,#C38D9E,#41B3A3)" } },
  { key: "studio", label: "Studio Backdrop", preview: { background: "radial-gradient(circle at 50% 30%, #d9d5cf 0%, #6b6570 100%)" } },
  { key: "lifestyle", label: "Lifestyle Scene", preview: { background: "linear-gradient(160deg,#fdd9a0,#f2a488 55%,#7c5b52)" } },
  { key: "transparent", label: "Transparent", preview: { backgroundImage: "conic-gradient(#e5e5e5 25%, #fff 0 50%, #e5e5e5 0 75%, #fff 0)", backgroundSize: "10px 10px" } },
];
const REALISMS: { key: DisplayRealism; label: string; icon: any }[] = [
  { key: "standard", label: "Standard", icon: Sun },
  { key: "premium", label: "Premium", icon: Gem },
  { key: "hyper", label: "Hyper Realistic", icon: Camera },
  { key: "luxury", label: "Luxury Brand", icon: Gem },
];
const FOCUSES: { key: DisplayFocus; label: string; icon: any }[] = [
  { key: "full", label: "Full Product", icon: Maximize2 },
  { key: "detail", label: "Product Detail", icon: Crop },
  { key: "texture", label: "Texture", icon: Layers },
  { key: "packaging", label: "Packaging", icon: Box },
  { key: "in_use", label: "Product In Use", icon: User },
  { key: "hero_angle", label: "Hero Angle", icon: Camera },
];
const ASPECTS: { key: AspectRatio; w: number; h: number }[] = [
  { key: "1:1", w: 22, h: 22 },
  { key: "4:5", w: 20, h: 25 },
  { key: "9:16", w: 15, h: 26 },
  { key: "16:9", w: 30, h: 17 },
  { key: "3:4", w: 21, h: 28 },
];

/* ---------- Small presentational primitives ---------- */
function SectionCard({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ background: CARD, border: `1px solid ${LINE}`, borderRadius: 16, padding: 14 }}>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[13px] font-semibold tracking-tight text-white">{title}</span>
        {right}
      </div>
      {children}
    </div>
  );
}

function VisualPickCard({
  label, active, onClick, icon: Icon, previewStyle,
}: { label: string; active: boolean; onClick: () => void; icon?: any; previewStyle?: CSSProperties }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 focus:outline-none"
      style={{
        display: "flex", flexDirection: "column", gap: 8, padding: 8,
        background: active ? `${GOLD}14` : CARD,
        border: `1.5px solid ${active ? GOLD : LINE}`,
        borderRadius: 14, minWidth: 96, cursor: "pointer",
        transition: "all .15s ease",
      }}
    >
      <div
        style={{
          height: 56, borderRadius: 10, background: RAISED,
          display: "flex", alignItems: "center", justifyContent: "center",
          border: active ? `1px solid ${GOLD}66` : `1px solid ${LINE}`,
          ...previewStyle,
        }}
      >
        {Icon && !previewStyle && <Icon size={22} color={active ? GOLD : "#8E8898"} />}
      </div>
      <span
        style={{
          fontSize: 12, lineHeight: 1.2, textAlign: "center",
          color: active ? "#fff" : TEXT, fontWeight: active ? 700 : 500,
        }}
      >
        {label}
      </span>
    </button>
  );
}

function HScroll({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2.5 overflow-x-auto -mx-1 px-1 pb-1"
      style={{ scrollbarWidth: "thin" }}>
      {children}
    </div>
  );
}

function GoldPill({ active, onClick, children }: { active?: boolean; onClick?: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 rounded-full text-xs font-medium transition"
      style={{
        padding: "7px 14px",
        background: active ? goldGrad : "transparent",
        border: `1px solid ${active ? "transparent" : LINE}`,
        color: active ? "#1a1400" : TEXT,
      }}
    >
      {children}
    </button>
  );
}

/* ---------- Main tab ---------- */
export default function DisplayTab({ brandStyle }: { brandStyle: BrandStyle }) {
  const { products, loading } = useHybridProducts({ limit: 100 });

  const [sourceMode, setSourceMode] = useState<"shopify" | "upload" | "none">("shopify");
  const [productPickerOpen, setProductPickerOpen] = useState(false);

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
  const [uploadedProductUrl, setUploadedProductUrl] = useState<string | null>(null);
  const notesRef = useRef<HTMLTextAreaElement | null>(null);

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

  // Effective product context depending on sourceMode
  const activeProductTitle = sourceMode === "shopify" ? product?.title || "" : "";
  const activeProductCategory = sourceMode === "shopify" ? product?.category || undefined : undefined;

  // Authoritative product image — always sent to generation to keep the product exact.
  const productImageUrl: string | null =
    sourceMode === "shopify" ? variantImage :
    sourceMode === "upload" ? uploadedProductUrl :
    null;

  const controls: DisplayControls = {
    productTitle: activeProductTitle,
    productCategory: activeProductCategory,
    goal, style, background, realism, focus,
    aspectRatio: aspect,
    notes,
    hasReference: !!productImageUrl,
  };

  const { prompt } = previewDisplayFinal(controls, brandStyle);

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

  const handleFilesPicked = async (files: File[], replaceFirst = false) => {
    if (!files.length) return;
    const room = replaceFirst ? 1 : MAX_REFS - refs.length;
    const added = await prepareMarketingSourceImages(files, room);
    if (!added.length) return;
    if (replaceFirst) setRefs([added[0], ...refs.slice(1)]);
    else setRefs([...refs, ...added]);
  };

  const generate = async (opts?: { reuseSeed?: boolean }) => {
    if (sourceMode === "shopify" && !product) {
      toast.error("Select a product first");
      return;
    }
    const imageUrl = productImageUrl;

    const seed =
      opts?.reuseSeed && lastSeed != null
        ? lastSeed
        : Math.floor(Math.random() * 2_147_483_647);

    const effectivePrompt = promptOverride ?? prompt;
    if (!imageUrl && (!effectivePrompt || effectivePrompt.trim().length < 2)) {
      if (sourceMode === "upload") {
        toast.error("Upload a product image or write a prompt first");
      } else {
        toast.error("Write a prompt first");
      }
      return;
    }

    setGenerating(true);
    setResultUrl(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (imageUrl) {
        // Image-to-image via ai-image-prep (unchanged path)
        const mode: "remove-bg" | "expand" = background === "transparent" ? "remove-bg" : "expand";
        const { data, error } = await supabase.functions.invoke("ai-image-prep", {
          body: {
            imageUrl,
            mode,
            aspectRatio: aspect,
            campaignType: "display",
            productTitle: activeProductTitle,
            prompt: effectivePrompt,
          },
          headers: { Authorization: `Bearer ${session?.access_token}` },
        });
        if (error || (data as any)?.error) {
          const raw = (data as any)?.error || error?.message || "Generation failed";
          toast.error(raw);
          return;
        }
        setResultUrl((data as any).url);
      } else {
        // Text-to-image fallback via existing text-to-image edge function.
        // Allowed ratios: 1:1, 9:16, 16:9, 4:3, 3:4. Map 4:5 → 3:4.
        const t2iRatio = aspect === "4:5" ? "3:4" : aspect;
        const auth = { Authorization: `Bearer ${session?.access_token}` };
        const start = await supabase.functions.invoke("text-to-image", {
          body: { action: "start", prompt: effectivePrompt, aspect_ratio: t2iRatio },
          headers: auth,
        });
        if (start.error || (start.data as any)?.error) {
          const raw = (start.data as any)?.error || start.error?.message || "Generation failed";
          toast.error(raw);
          return;
        }
        const predId = (start.data as any)?.id;
        if (!predId) {
          toast.error("Generation failed to start");
          return;
        }
        // Poll until succeeded/failed. ~90s cap.
        let url: string | null = null;
        for (let i = 0; i < 45; i++) {
          await new Promise((r) => setTimeout(r, 2000));
          const s = await supabase.functions.invoke("text-to-image", {
            body: { action: "status", id: predId },
            headers: auth,
          });
          const sd = s.data as any;
          if (s.error || sd?.error) {
            toast.error(sd?.error || s.error?.message || "Generation failed");
            return;
          }
          if (sd?.status === "succeeded" && sd?.imageUrl) { url = sd.imageUrl; break; }
          if (sd?.status === "failed" || sd?.status === "canceled") {
            toast.error("Generation failed");
            return;
          }
        }
        if (!url) {
          toast.error("Generation timed out");
          return;
        }
        setResultUrl(url);
      }

      setLastSeed(seed);
      toast.success("Display image generated");
    } catch (e: any) {
      toast.error(e?.message || "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  /* ---------- Render ---------- */
  return (
    <div
      className="-mx-4 -mb-6 px-4 pb-32 pt-2"
      style={{ background: INK, color: TEXT, minHeight: "calc(100vh - 220px)" }}
    >
      <div className="grid gap-5 lg:grid-cols-[1fr_400px]">
        {/* LEFT column */}
        <div className="space-y-5">
          {/* 1. Product Source */}
          <SectionCard title="Product Source">
            <div className="mb-3 grid grid-cols-3 gap-2">
              {[
                { k: "shopify", label: "Shopify Product", icon: ShoppingBag },
                { k: "upload", label: "My Own Image", icon: Upload },
                { k: "none", label: "No Product", icon: X },
              ].map(({ k, label, icon: Icon }) => {
                const active = sourceMode === k;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setSourceMode(k as any)}
                    className="flex items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-xs font-medium transition"
                    style={{
                      background: active ? `${GOLD}14` : RAISED,
                      border: `1.5px solid ${active ? GOLD : LINE}`,
                      color: active ? "#fff" : TEXT,
                    }}
                  >
                    <Icon size={13} color={active ? GOLD : "#8E8898"} />
                    <span className="truncate">{label}</span>
                  </button>
                );
              })}
            </div>

            {sourceMode === "shopify" && (
              <div
                className="rounded-xl p-3"
                style={{ background: RAISED, border: `1px solid ${LINE}` }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="h-14 w-14 shrink-0 overflow-hidden rounded-lg"
                    style={{ background: INK, border: `1px solid ${LINE}` }}
                  >
                    {variantImage ? (
                      <img src={variantImage} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: GOLD }}>
                      Shopify Product
                    </div>
                    <div className="mt-0.5 truncate text-sm font-semibold text-white">
                      {loading ? "Loading…" : product?.title || "No product"}
                    </div>
                    {variant && (
                      <div className="mt-0.5 truncate text-[11px]" style={{ color: TEXT }}>
                        {variant.title}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setProductPickerOpen((v) => !v)}
                    className="rounded-lg px-3 py-1.5 text-[11px] font-medium"
                    style={{ background: INK, border: `1px solid ${LINE}`, color: "#fff" }}
                  >
                    {productPickerOpen ? "Close" : "Change"}
                  </button>
                </div>

                {productPickerOpen && (
                  <div className="mt-3">
                    <select
                      value={selectedId}
                      onChange={(e) => { setSelectedId(e.target.value); setSelectedVariantId(""); }}
                      className="w-full rounded-lg px-3 py-2 text-sm"
                      style={{ background: INK, border: `1px solid ${LINE}`, color: "#fff" }}
                      disabled={loading}
                    >
                      {products.length === 0 && <option value="">Loading…</option>}
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>{p.title}</option>
                      ))}
                    </select>
                  </div>
                )}

                {product && product.variants && product.variants.length >= 1 && (
                  <div
                    className="mt-3 rounded-lg p-3"
                    style={{ background: INK, border: `1px solid ${LINE}` }}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: GOLD }}>
                        Variants
                      </span>
                      <span className="text-[10px]" style={{ color: TEXT }}>
                        {product.variants.length} option{product.variants.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {product.variants.map((v) => {
                        const active = (variant?.id || product.variants[0].id) === v.id;
                        const only = product.variants.length === 1;
                        return (
                          <GoldPill
                            key={v.id}
                            active={active}
                            onClick={only ? undefined : () => setSelectedVariantId(v.id)}
                          >
                            {v.title}{v.availableForSale ? "" : " · oos"}
                          </GoldPill>
                        );
                      })}
                    </div>
                    {product.variants.length === 1 && (
                      <p className="mt-2 text-[10px]" style={{ color: TEXT }}>
                        Only one variant available. Add more in Shopify to pick a specific one here.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {sourceMode === "upload" && (
              <label
                className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl px-3 py-8 text-center"
                style={{ background: RAISED, border: `1.5px dashed ${LINE}` }}
              >
                {uploadedProductUrl ? (
                  <div className="flex items-center gap-3">
                    <img src={uploadedProductUrl} alt="" className="h-16 w-16 rounded-lg object-cover" />
                    <div className="text-left">
                      <div className="text-sm font-semibold text-white">Uploaded product</div>
                      <div className="text-[11px]" style={{ color: TEXT }}>Tap to replace</div>
                    </div>
                  </div>
                ) : (
                  <>
                    <Upload size={22} color={GOLD} />
                    <div className="text-sm font-semibold text-white">Upload your product</div>
                    <div className="text-[11px]" style={{ color: TEXT }}>This image defines exactly how the product looks</div>
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const input = e.currentTarget;
                    const files = Array.from(input.files || []);
                    const added = await prepareMarketingSourceImages(files, 1);
                    if (added[0]) setUploadedProductUrl(added[0]);
                    if (input) input.value = "";
                  }}
                />
              </label>
            )}

            {sourceMode === "none" && (
              <div
                className="rounded-xl px-3 py-6 text-center"
                style={{ background: RAISED, border: `1.5px dashed ${LINE}` }}
              >
                <div className="text-sm font-semibold text-white">No product attached</div>
                <div className="mt-1 text-[11px]" style={{ color: TEXT }}>
                  Generate purely from your prompt and settings below.
                </div>
              </div>
            )}
          </SectionCard>

          {/* 2. Describe your image */}
          <SectionCard
            title="Describe your image"
            right={
              <button
                type="button"
                onClick={() => notesRef.current?.focus()}
                className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                style={{ background: `${GOLD}14`, border: `1px solid ${GOLD}66`, color: GOLD }}
              >
                <Sparkles size={12} /> Auto prompt
              </button>
            }
          >
            <textarea
              ref={notesRef}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Describe the mood, scene, product details you want emphasized…"
              className="w-full resize-none rounded-lg px-3 py-2.5 text-sm outline-none"
              style={{ background: RAISED, border: `1px solid ${LINE}`, color: "#fff" }}
            />
          </SectionCard>

          {/* 3. Reference This Image (optional) */}
          <SectionCard title={`Reference This Image (${refs.length}/${MAX_REFS}) · optional`}>
            <div className="flex flex-wrap gap-2">
              {refs.map((src, i) => (
                <div key={i} className="relative h-16 w-16 overflow-hidden rounded-lg" style={{ border: `1px solid ${LINE}` }}>
                  <img src={src} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setRefs(refs.filter((_, idx) => idx !== i))}
                    className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full shadow"
                    style={{ background: INK, color: "#fff", border: `1px solid ${LINE}` }}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {refs.length === 0 && autoRefAvailable && variantImage && (
                <div
                  className="relative h-16 w-16 overflow-hidden rounded-lg"
                  style={{ border: `1px dashed ${GOLD}66` }}
                >
                  <img src={variantImage} alt="Product listing" className="h-full w-full object-cover opacity-80" />
                  <button
                    type="button"
                    onClick={() => setAutoRefDismissed(true)}
                    className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full shadow"
                    style={{ background: INK, color: "#fff", border: `1px solid ${LINE}` }}
                    aria-label="Remove auto reference"
                  >
                    <X className="h-3 w-3" />
                  </button>
                  <span
                    className="absolute inset-x-0 bottom-0 text-center text-[9px] font-bold py-0.5"
                    style={{ background: `${GOLD}dd`, color: "#1a1400" }}
                  >
                    AUTO
                  </span>
                </div>
              )}
              {refs.length < MAX_REFS && (
                <label
                  className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-lg text-2xl"
                  style={{ background: RAISED, border: `1.5px dashed ${LINE}`, color: GOLD }}
                >
                  +
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={async (e) => {
                      const input = e.currentTarget;
                      const files = Array.from(input.files || []);
                      await handleFilesPicked(files);
                      if (input) input.value = "";
                    }}
                  />
                </label>
              )}
              {sourceMode === "shopify" && autoRefDismissed && refs.length === 0 && variantImage && (
                <button
                  type="button"
                  onClick={() => setAutoRefDismissed(false)}
                  className="rounded-lg px-2 text-[10px] font-semibold"
                  style={{ background: RAISED, border: `1px dashed ${LINE}`, color: TEXT }}
                >
                  Restore auto
                </button>
              )}
            </div>
            <p className="mt-2 text-[11px]" style={{ color: TEXT }}>
              Optional. If left empty, the image is generated purely from your prompt. When present, it defines the structure — do not expect its contents to be copied.
            </p>
          </SectionCard>

          {/* 4. Quick Presets */}
          <SectionCard title="Quick Presets" right={<span className="text-[11px] font-semibold" style={{ color: GOLD }}>See All</span>}>
            <HScroll>
              {DISPLAY_PRESETS.map((p) => (
                <GoldPill key={p.id} onClick={() => applyPreset(p.id)}>{p.label}</GoldPill>
              ))}
            </HScroll>
          </SectionCard>

          {/* 5. Visual picker rows */}
          <SectionCard title="Display Goal">
            <HScroll>
              {GOALS.map((g) => (
                <VisualPickCard key={g.key} label={g.label} icon={g.icon}
                  active={goal === g.key} onClick={() => setGoal(g.key)} />
              ))}
            </HScroll>
          </SectionCard>

          <SectionCard title="Style">
            <HScroll>
              {STYLES.map((s) => (
                <VisualPickCard key={s.key} label={s.label} icon={s.icon}
                  active={style === s.key} onClick={() => setStyle(s.key)} />
              ))}
            </HScroll>
          </SectionCard>

          <SectionCard title="Background">
            <HScroll>
              {BACKGROUNDS.map((b) => (
                <VisualPickCard key={b.key} label={b.label} previewStyle={b.preview}
                  active={background === b.key} onClick={() => setBackground(b.key)} />
              ))}
            </HScroll>
          </SectionCard>

          <SectionCard title="Realism">
            <HScroll>
              {REALISMS.map((r) => (
                <VisualPickCard key={r.key} label={r.label} icon={r.icon}
                  active={realism === r.key} onClick={() => setRealism(r.key)} />
              ))}
            </HScroll>
          </SectionCard>

          <SectionCard title="Product Focus">
            <HScroll>
              {FOCUSES.map((f) => (
                <VisualPickCard key={f.key} label={f.label} icon={f.icon}
                  active={focus === f.key} onClick={() => setFocus(f.key)} />
              ))}
            </HScroll>
          </SectionCard>

          {/* 6. Choose Shape */}
          <SectionCard title="Choose Shape">
            <div className="flex flex-wrap gap-2">
              {ASPECTS.map((a) => {
                const active = aspect === a.key;
                return (
                  <button
                    key={a.key}
                    type="button"
                    onClick={() => setAspect(a.key)}
                    className="flex flex-col items-center gap-2 rounded-xl px-3 py-2.5"
                    style={{
                      background: active ? `${GOLD}14` : CARD,
                      border: `1.5px solid ${active ? GOLD : LINE}`,
                      minWidth: 66,
                    }}
                  >
                    <div
                      style={{
                        width: a.w, height: a.h,
                        background: active ? GOLD : RAISED,
                        border: `1px solid ${active ? GOLD : LINE}`,
                        borderRadius: 3,
                      }}
                    />
                    <span className="text-[11px] font-semibold" style={{ color: active ? "#fff" : TEXT }}>
                      {a.key}
                    </span>
                  </button>
                );
              })}
            </div>
          </SectionCard>

          {/* 7. Final Prompt */}
          <div style={{ background: CARD, border: `1px solid ${LINE}`, borderRadius: 16 }} className="p-1">
            <PromptPreview prompt={prompt} value={promptOverride} onChange={setPromptOverride} />
          </div>
        </div>

        {/* RIGHT rail */}
        <div className="space-y-5 lg:sticky lg:top-4 lg:self-start">
          <SectionCard title="Live Preview">
            <div className="mb-2 flex flex-wrap gap-1.5">
              {[goal.replace(/_/g, " "), style, background, realism, focus.replace(/_/g, " "), aspect].map((t) => (
                <span key={t} className="rounded-full px-2 py-0.5 text-[10px] font-medium capitalize"
                  style={{ background: RAISED, border: `1px solid ${LINE}`, color: TEXT }}>
                  {t}
                </span>
              ))}
            </div>
            <LayoutPreview
              surface="display"
              brandStyle={brandStyle}
              productImage={sourceMode === "shopify" ? variantImage : refs[0] || null}
              productTitle={activeProductTitle}
              aspectRatio={aspect}
              goal={goal}
              style={style}
              background={background}
              realism={realism}
              focus={focus}
            />
            <p className="mt-2 text-[10px] italic" style={{ color: TEXT }}>
              Mockup preview — not a generated image. Updates live as you change settings.
            </p>
          </SectionCard>

          <SectionCard title="Result">
            {resultUrl ? (
              <div className="space-y-3">
                <img src={resultUrl} alt="Generated display" className="w-full rounded-lg" />
                <button
                  onClick={() => downloadImage(resultUrl, "luut-display.png")}
                  className="flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold"
                  style={{ background: RAISED, border: `1px solid ${LINE}`, color: "#fff" }}
                >
                  <Download className="h-4 w-4" /> Download
                </button>
              </div>
            ) : (
              <div
                className="flex aspect-square items-center justify-center rounded-lg text-xs"
                style={{ background: RAISED, border: `1.5px dashed ${LINE}`, color: TEXT }}
              >
                Display image will appear here
              </div>
            )}
          </SectionCard>
        </div>
      </div>

      {/* Sticky Generate bar */}
      <div
        className="fixed inset-x-0 bottom-0 z-30 px-4 pb-4 pt-3"
        style={{
          background: `linear-gradient(to top, ${INK} 70%, ${INK}00)`,
          backdropFilter: "blur(8px)",
        }}
      >
        <div className="mx-auto max-w-7xl space-y-2">
          <button
            onClick={() => generate()}
            disabled={generating}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold tracking-tight disabled:opacity-70"
            style={{
              background: goldGrad,
              color: "#1a1400",
              boxShadow: goldGlow,
            }}
          >
            {generating ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</> : <><Wand2 className="h-4 w-4" /> Generate Display Image</>}
          </button>
          <button
            onClick={() => generate({ reuseSeed: true })}
            disabled={generating || lastSeed == null}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-semibold disabled:opacity-40"
            style={{ background: RAISED, border: `1px solid ${LINE}`, color: "#fff" }}
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            Regenerate Same Image{lastSeed != null ? ` (seed ${lastSeed})` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
