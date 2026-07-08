import { useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { downloadImage } from "@/lib/downloadImage";
import { toast } from "sonner";
import {
  Loader2, Download, X, Upload, Sparkles, Wand2,
  ShoppingBag, RefreshCcw, ChevronUp, Pencil, RotateCcw, Copy, Plus,
  Image as ImageIcon, Calendar, MapPin,
} from "lucide-react";
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
  previewPosterFinal,
  getBrandStyleReferenceImage,
  getBrandStyleDef,
} from "@/lib/marketingRouting";

/* ============================================================
   LUUT Poster Studio — matches uploaded reference layout.
   Two sub-tabs: Image → Image · Text → Image.
   Product Source is authoritative product image. Reference is style-only.
   Backend endpoints unchanged: poster-img2img-gpt, marketing-generate,
   build-poster-prompt, generate-poster-t2i.
   ============================================================ */

const GOLD = "#E0A82E";
const GOLD2 = "#F5C451";
const INK = "#0B0A0D";
const CARD = "#161419";
const RAISED = "#211E26";
const LINE = "#2C2833";
const TEXT = "#B4AEBE";
const MUTED = "#8E8898";
const goldGrad = `linear-gradient(135deg, ${GOLD} 0%, ${GOLD2} 100%)`;
const goldGlow = `0 8px 24px ${GOLD}44`;

/* ---------- Shared primitives (mirror reference exactly) ---------- */
function RowHeader({ title, seeAll }: { title: string; seeAll?: boolean }) {
  return (
    <div className="mb-3 mt-6 flex items-center justify-between">
      <span className="text-[16px] font-bold tracking-tight text-white">{title}</span>
      {seeAll && <span className="text-[13px] font-semibold" style={{ color: GOLD }}>See All</span>}
    </div>
  );
}
function HScroll({ children }: { children: React.ReactNode }) {
  return (
    <div className="-mx-1 flex gap-2.5 overflow-x-auto px-1 pb-1" style={{ scrollbarWidth: "none" }}>
      {children}
    </div>
  );
}
function Pill({
  label, active, onClick, disabled,
}: { label: string; active?: boolean; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="shrink-0 whitespace-nowrap rounded-full"
      style={{
        background: active ? GOLD : RAISED,
        color: active ? "#1A1206" : "#E4E0EA",
        border: `1px solid ${active ? GOLD : LINE}`,
        padding: "10px 16px",
        fontSize: 13.5,
        fontWeight: active ? 700 : 500,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.7 : 1,
      }}
    >
      {label}
    </button>
  );
}
function GridChip({
  label, active, onClick,
}: { label: string; active?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-center"
      style={{
        background: active ? `${GOLD}14` : CARD,
        color: active ? "#fff" : TEXT,
        border: `1.5px solid ${active ? GOLD : LINE}`,
        borderRadius: 11,
        padding: "13px 10px",
        fontSize: 13.5,
        fontWeight: active ? 700 : 500,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}
function TextField({
  label, placeholder, value, onChange,
}: { label: string; placeholder?: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void }) {
  return (
    <div className="mb-3">
      <div className="mb-2 text-[12px] font-semibold uppercase tracking-widest" style={{ color: "#8A8898" }}>
        {label}
      </div>
      <input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full outline-none"
        style={{
          background: "#0E0D11",
          border: `1px solid ${LINE}`,
          borderRadius: 10,
          padding: "12px 14px",
          color: "#fff",
          fontSize: 14.5,
        }}
      />
    </div>
  );
}
function ShapePicker({
  ratio, setRatio, options,
}: { ratio: string; setRatio: (r: any) => void; options: string[] }) {
  return (
    <div className="flex gap-2.5">
      {options.map((x) => {
        const active = ratio === x;
        const w = x === "1:1" ? 30 : x === "9:16" ? 20 : x === "16:9" ? 38 : x === "4:5" ? 26 : x === "4:3" ? 36 : 24;
        const h = x === "1:1" ? 30 : x === "9:16" ? 36 : x === "16:9" ? 22 : x === "4:5" ? 32 : x === "4:3" ? 27 : 32;
        return (
          <button
            key={x}
            type="button"
            onClick={() => setRatio(x)}
            className="flex flex-1 flex-col items-center gap-1.5"
            style={{
              padding: "12px 4px",
              background: active ? `${GOLD}14` : CARD,
              border: `1.5px solid ${active ? GOLD : LINE}`,
              borderRadius: 12,
              cursor: "pointer",
            }}
          >
            <div style={{ width: w, height: h, borderRadius: 4, border: `2px solid ${active ? GOLD : "#6E6878"}` }} />
            <span className="text-[11.5px]" style={{ fontWeight: active ? 700 : 500, color: active ? "#fff" : MUTED }}>
              {x}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Reusable "Reference This Image" upload ---------- */
function RefUpload({
  value, onChange, subtext, cta = "Upload reference image",
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  subtext: string;
  cta?: string;
}) {
  return (
    <div>
      {value ? (
        <div
          className="relative w-full overflow-hidden"
          style={{ borderRadius: 16, border: `1.5px solid ${GOLD}` }}
        >
          <img src={value} alt="reference" className="block w-full" style={{ maxHeight: 220, objectFit: "cover" }} />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute right-2.5 top-2.5 flex h-[30px] w-[30px] items-center justify-center rounded-full"
            style={{ background: "rgba(0,0,0,.7)", color: "#fff" }}
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <label
          className="flex cursor-pointer items-center gap-3.5"
          style={{ padding: 16, background: CARD, border: `1.5px dashed ${LINE}`, borderRadius: 16 }}
        >
          <div
            className="flex shrink-0 items-center justify-center"
            style={{ width: 48, height: 48, borderRadius: 12, background: RAISED }}
          >
            <Upload size={20} color={GOLD} />
          </div>
          <span className="text-[14.5px] font-semibold text-white">{cta}</span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const input = e.currentTarget;
              const files = Array.from(input.files || []);
              const added = await prepareMarketingSourceImages(files, 1);
              if (added[0]) onChange(added[0]);
              if (input) input.value = "";
            }}
          />
        </label>
      )}
      <div className="mt-2.5 text-[12.5px] leading-relaxed" style={{ color: MUTED }}>
        {subtext}
      </div>
    </div>
  );
}

/* ---------- Final Prompt collapsible ---------- */
function FinalPrompt({
  compiled, value, onChange, addChips,
}: {
  compiled: string;
  value: string | null;
  onChange: (v: string | null) => void;
  addChips?: string[];
}) {
  const [open, setOpen] = useState(true);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const final = value ?? compiled;
  const btnStyle: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 6, background: RAISED,
    border: `1px solid ${LINE}`, borderRadius: 10, padding: "9px 14px",
    color: "#E4E0EA", fontSize: 13.5, fontWeight: 600, cursor: "pointer",
  };
  return (
    <div style={{ background: CARD, border: `1px solid ${LINE}`, borderRadius: 18, overflow: "hidden" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between"
        style={{ padding: "16px 18px", color: "#fff" }}
      >
        <span className="text-[14px] font-bold">Full prompt preview</span>
        <ChevronUp size={18} color="#71717A" style={{ transform: open ? "none" : "rotate(180deg)", transition: "transform .2s" }} />
      </button>
      {open && (
        <div style={{ padding: "0 18px 18px" }}>
          <div className="mb-3 flex gap-2">
            <button type="button" style={btnStyle} onClick={() => setEditing((e) => !e)}>
              <Pencil size={14} /> {editing ? "Done" : "Edit"}
            </button>
            <button
              type="button"
              onClick={() => onChange(null)}
              disabled={value === null}
              style={{ ...btnStyle, opacity: value === null ? 0.4 : 1 }}
            >
              <RotateCcw size={14} /> Reset
            </button>
            <button
              type="button"
              style={btnStyle}
              onClick={() => {
                navigator.clipboard?.writeText(final);
                setCopied(true);
                setTimeout(() => setCopied(false), 1400);
              }}
            >
              <Copy size={14} /> {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <textarea
            value={final}
            readOnly={!editing}
            onChange={(e) => onChange(e.target.value)}
            style={{
              width: "100%", minHeight: 140, background: "#0E0D11",
              border: `1px solid ${LINE}`, borderRadius: 12, padding: "13px 14px",
              color: "#C8C2D0", fontSize: 13, lineHeight: 1.6, outline: "none",
              resize: "vertical", fontFamily: "'SF Mono', ui-monospace, monospace",
            }}
          />
          {addChips && addChips.length > 0 && (
            <>
              <div className="mb-2.5 mt-4 text-[11.5px] font-semibold" style={{ letterSpacing: "0.1em", color: "#6E6878" }}>
                ADD TO PROMPT
              </div>
              <div className="flex flex-wrap gap-2">
                {addChips.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => onChange((value ?? compiled) + " " + c + ".")}
                    className="flex items-center gap-1.5"
                    style={{
                      background: RAISED, border: `1px solid ${LINE}`, borderRadius: 999,
                      padding: "9px 14px", color: "#E4E0EA", fontSize: 13, fontWeight: 500, cursor: "pointer",
                    }}
                  >
                    <Plus size={13} color={GOLD} /> {c}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   IMAGE-TO-IMAGE SUBTAB
   ============================================================ */
function ImageToImage({ brandStyle }: { brandStyle: BrandStyle }) {
  const { products, loading } = useHybridProducts({ limit: 100 });

  const [source, setSource] = useState<"shopify" | "upload" | "none">("shopify");
  const [ownImg, setOwnImg] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [variantOpen, setVariantOpen] = useState(false);

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

  const [refImg, setRefImg] = useState<string | null>(null);

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

  const activeProductTitle = source === "shopify" ? product?.title || "" : "";
  const productImageUrl: string | null =
    source === "shopify" ? variantImage : source === "upload" ? ownImg : null;

  const controls: PosterControls = {
    productTitle: activeProductTitle,
    productPrice: source === "shopify" && product?.price?.amount ? String(product.price.amount) : undefined,
    campaign, style, realism,
    aspectRatio: aspect,
    headline, subheadline,
    priceText: priceText || (source === "shopify" && product?.price?.amount ? `EC$${Math.round(Number(product.price.amount))}` : undefined),
    ctaText,
    brandName: "LUUT SLU",
    notes,
    hasReference: !!productImageUrl,
  };
  const { route, prompt } = previewPosterFinal(controls, brandStyle);

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
    if (source === "shopify" && !product) {
      toast.error("Select a product first");
      return;
    }
    const imageUrl = productImageUrl;
    const effectivePrompt = promptOverride ?? prompt;
    if (!imageUrl && (!effectivePrompt || effectivePrompt.trim().length < 2)) {
      toast.error(source === "upload" ? "Upload a product image or write a prompt first" : "Write a prompt first");
      return;
    }
    const seed = opts?.reuseSeed && lastSeed != null ? lastSeed : Math.floor(Math.random() * 2_147_483_647);

    setGenerating(true);
    setResultUrl(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (imageUrl) {
        const { data, error } = await supabase.functions.invoke("poster-img2img-gpt", {
          body: {
            imageUrl,
            prompt: effectivePrompt,
            aspectRatio: aspect,
            productTitle: activeProductTitle || "Custom product",
            campaignType: "poster",
            style: `${style}|${campaign}|gemini-3-pro`,
          },
          headers: { Authorization: `Bearer ${session?.access_token}` },
        });
        if (error || (data as any)?.error || !(data as any)?.url) {
          toast.error((data as any)?.error || error?.message || "Poster generation failed");
          return;
        }
        setResultUrl((data as any).url);
      } else {
        const { data, error } = await supabase.functions.invoke("marketing-generate", {
          body: {
            task: "poster",
            model: route.model,
            prompt: effectivePrompt,
            aspectRatio: aspect,
            referenceImages: [],
            styleReferenceImage: getBrandStyleReferenceImage(brandStyle, "poster") || undefined,
            productTitle: activeProductTitle || "Custom",
            productHandle: (product as any)?.handle || null,
            campaignType: campaign,
            style,
            seed,
          },
          headers: { Authorization: `Bearer ${session?.access_token}` },
        });
        if (error || (data as any)?.error) {
          const raw = (data as any)?.error || error?.message || "Generation failed";
          toast.error(/insufficient credit/i.test(raw) ? "The image provider is out of credit. Top up Replicate billing and try again." : raw);
          return;
        }
        setResultUrl((data as any).url);
      }
      setLastSeed(seed);
      toast.success("Poster generated");
    } catch (e: any) {
      toast.error(e?.message || "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const ar =
    aspect === "9:16" ? "9/16" :
    aspect === "4:5" ? "4/5" :
    aspect === "16:9" ? "16/9" :
    aspect === "3:4" ? "3/4" : "1/1";

  return (
    <div>
      {/* Product source segmented */}
      <div className="mb-3 mt-2 flex gap-2">
        {[
          { k: "shopify", l: "Shopify Product" },
          { k: "upload", l: "My Own Image" },
          { k: "none", l: "No Product" },
        ].map((m) => {
          const active = source === m.k;
          return (
            <button
              key={m.l}
              type="button"
              onClick={() => setSource(m.k as any)}
              className="flex-1"
              style={{
                background: active ? `${GOLD}14` : CARD,
                color: active ? "#fff" : MUTED,
                border: `1.5px solid ${active ? GOLD : LINE}`,
                borderRadius: 11,
                padding: "10px 8px",
                fontSize: 12.5,
                fontWeight: active ? 700 : 500,
                cursor: "pointer",
              }}
            >
              {m.l}
            </button>
          );
        })}
      </div>
      <p className="mb-3 text-[11.5px]" style={{ color: MUTED }}>
        This image is used as the product. It defines exactly how the product looks in the result.
      </p>

      {source === "shopify" && (
        <div style={{ borderRadius: 20, background: "linear-gradient(135deg,#2A2530,#1A1720)", border: `1px solid ${LINE}`, padding: 16 }}>
          <div className="flex items-center gap-3.5">
            <div
              className="flex shrink-0 items-center justify-center overflow-hidden"
              style={{ width: 62, height: 62, borderRadius: 14, background: "#0E0D11", border: `1px solid ${LINE}` }}
            >
              {variantImage ? (
                <img src={variantImage} alt="" className="h-full w-full object-cover" />
              ) : (
                <ShoppingBag size={22} color={MUTED} />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-semibold uppercase" style={{ color: GOLD, letterSpacing: "0.04em" }}>
                Shopify Product
              </div>
              <div className="mt-0.5 truncate text-[17px] font-bold text-white">
                {loading ? "Loading…" : product?.title || "No product"}
              </div>
              {variant && (
                <div className="mt-0.5 text-[12.5px]" style={{ color: MUTED }}>
                  Variant: <span className="font-semibold" style={{ color: "#E4E0EA" }}>{variant.title}</span>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setPickerOpen((v) => !v)}
              style={{ background: RAISED, border: `1px solid ${LINE}`, borderRadius: 10, padding: "9px 12px", color: "#E4E0EA", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
            >
              {pickerOpen ? "Close" : "Change"}
            </button>
          </div>

          {pickerOpen && (
            <div className="mt-3">
              <select
                value={selectedId}
                onChange={(e) => { setSelectedId(e.target.value); setSelectedVariantId(""); }}
                className="w-full outline-none"
                style={{ background: "#0E0D11", border: `1px solid ${LINE}`, borderRadius: 10, padding: "10px 12px", color: "#fff", fontSize: 14 }}
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
            <div className="mt-3.5">
              <button
                type="button"
                onClick={() => setVariantOpen((o) => !o)}
                className="flex w-full items-center justify-between"
                style={{ background: "#0E0D11", border: `1px solid ${LINE}`, borderRadius: 11, padding: "12px 14px", color: "#fff", fontSize: 14, cursor: "pointer" }}
              >
                <span>Change variant ({product.variants.length})</span>
                <ChevronUp size={16} color="#71717A" style={{ transform: variantOpen ? "none" : "rotate(180deg)" }} />
              </button>
              {variantOpen && (
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {product.variants.length === 1 ? (
                    <>
                      <Pill label={product.variants[0].title} active disabled />
                      <p className="mt-1 w-full text-[11px]" style={{ color: MUTED }}>
                        Only one variant available. Add more in Shopify to pick a specific one here.
                      </p>
                    </>
                  ) : (
                    product.variants.map((v) => (
                      <Pill
                        key={v.id}
                        label={`${v.title}${v.availableForSale ? "" : " · oos"}`}
                        active={(variant?.id || product.variants[0].id) === v.id}
                        onClick={() => { setSelectedVariantId(v.id); setVariantOpen(false); }}
                      />
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {source === "upload" && (
        <div style={{ borderRadius: 20, background: "linear-gradient(135deg,#2A2530,#1A1720)", border: `1px solid ${LINE}`, padding: 16 }}>
          {ownImg ? (
            <div className="flex items-center gap-3.5">
              <img src={ownImg} alt="product" style={{ width: 62, height: 62, borderRadius: 14, objectFit: "cover" }} />
              <div className="flex-1">
                <div className="text-[12px] font-semibold" style={{ color: GOLD }}>YOUR IMAGE</div>
                <div className="mt-0.5 text-[16px] font-bold text-white">Custom product</div>
              </div>
              <button
                type="button"
                onClick={() => setOwnImg(null)}
                style={{ background: RAISED, border: `1px solid ${LINE}`, borderRadius: 10, padding: "9px 12px", color: "#E4E0EA", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                Replace
              </button>
            </div>
          ) : (
            <label className="flex cursor-pointer items-center gap-3.5">
              <div
                className="flex items-center justify-center"
                style={{ width: 62, height: 62, borderRadius: 14, background: RAISED }}
              >
                <Upload size={24} color={GOLD} />
              </div>
              <div className="flex-1">
                <div className="text-[16px] font-bold text-white">Upload your product</div>
                <div className="mt-0.5 text-[12.5px]" style={{ color: MUTED }}>Use any image of your choice</div>
              </div>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const input = e.currentTarget;
                  const files = Array.from(input.files || []);
                  const added = await prepareMarketingSourceImages(files, 1);
                  if (added[0]) setOwnImg(added[0]);
                  if (input) input.value = "";
                }}
              />
            </label>
          )}
        </div>
      )}

      {source === "none" && (
        <div style={{ borderRadius: 20, background: CARD, border: `1.5px dashed ${LINE}`, padding: 18, textAlign: "center" }}>
          <div className="text-[15px] font-bold" style={{ color: "#E4E0EA" }}>No product attached</div>
          <div className="mt-1 text-[12.5px]" style={{ color: MUTED }}>
            Generate purely from your prompt and settings below.
          </div>
        </div>
      )}

      {/* Reference */}
      <RowHeader title="Reference This Image" />
      <RefUpload
        value={refImg}
        onChange={setRefImg}
        subtext="Use this image to create the structure of how the image will look, do not copy any contents inside."
      />

      {/* Presets */}
      <RowHeader title="Quick Presets" seeAll />
      <HScroll>
        {POSTER_PRESETS.map((p) => (
          <Pill key={p.id} label={p.label} onClick={() => applyPreset(p.id)} />
        ))}
      </HScroll>

      {/* Campaign */}
      <RowHeader title="Campaign Type" />
      <div className="grid grid-cols-3 gap-2.5">
        {(["sale", "promotion", "new_arrival", "limited_drop", "clearance", "brand_awareness", "event"] as PosterCampaign[]).map((k) => (
          <GridChip
            key={k}
            label={k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
            active={campaign === k}
            onClick={() => setCampaign(k)}
          />
        ))}
      </div>

      <RowHeader title="Style" />
      <div className="grid grid-cols-3 gap-2.5">
        {(["clean", "luxury", "bold", "hype", "modern", "minimal"] as PosterStyle[]).map((k) => (
          <GridChip
            key={k}
            label={k.charAt(0).toUpperCase() + k.slice(1)}
            active={style === k}
            onClick={() => setStyle(k)}
          />
        ))}
      </div>

      <RowHeader title="Realism" />
      <div className="grid grid-cols-2 gap-2.5">
        {(["standard", "premium", "hyper", "luxury"] as DisplayRealism[]).map((k) => (
          <GridChip
            key={k}
            label={k === "hyper" ? "Hyper Realistic" : k.charAt(0).toUpperCase() + k.slice(1)}
            active={realism === k}
            onClick={() => setRealism(k)}
          />
        ))}
      </div>

      <RowHeader title="Choose Shape" />
      <ShapePicker
        ratio={aspect}
        setRatio={(v) => setAspect(v as AspectRatio)}
        options={["1:1", "4:5", "9:16", "16:9", "3:4"]}
      />

      {/* Text on Image */}
      <RowHeader title="Text on Image" />
      <div style={{ background: CARD, border: `1px solid ${LINE}`, borderRadius: 16, padding: 16 }}>
        <TextField label="Headline" placeholder="FLASH SALE" value={headline} onChange={(e) => setHeadline(e.target.value)} />
        <TextField label="Subheadline" placeholder="Limited time only" value={subheadline} onChange={(e) => setSubheadline(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Price" placeholder="EC$199" value={priceText} onChange={(e) => setPriceText(e.target.value)} />
          <TextField label="CTA" placeholder="Shop Now" value={ctaText} onChange={(e) => setCtaText(e.target.value)} />
        </div>
        <div className="mb-2 text-[12px] font-semibold uppercase tracking-widest" style={{ color: "#8A8898" }}>
          Additional notes
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any extra detail..."
          style={{
            width: "100%", minHeight: 70, background: "#0E0D11",
            border: `1px solid ${LINE}`, borderRadius: 10, padding: "12px 14px",
            color: "#fff", fontSize: 14, outline: "none", resize: "vertical",
            fontFamily: "inherit",
          }}
        />
      </div>

      {/* Final Prompt */}
      <RowHeader title="Final Prompt" />
      <FinalPrompt
        compiled={prompt}
        value={promptOverride}
        onChange={setPromptOverride}
        addChips={["Cleaner background", "More dramatic lighting", "Bigger headline", "Add urgency", "Premium feel", "Bolder colors"]}
      />

      {/* Live Preview mockup */}
      <RowHeader title="Live Preview" />
      <div style={{ background: CARD, border: `1px solid ${LINE}`, borderRadius: 18, padding: 14 }}>
        <div
          className="relative mx-auto flex items-center justify-center overflow-hidden"
          style={{
            borderRadius: 14,
            background: "linear-gradient(150deg,#FF3D2E,#FF6B1A 55%,#F5A623)",
            aspectRatio: ar,
            padding: 26,
            maxWidth: aspect === "9:16" || aspect === "3:4" ? 260 : "100%",
          }}
        >
          {productImageUrl ? (
            <img src={productImageUrl} alt="" style={{ width: "60%", aspectRatio: "1/1", objectFit: "cover", borderRadius: 6, boxShadow: "0 20px 44px rgba(0,0,0,.3)" }} />
          ) : (
            <div style={{ width: "60%", aspectRatio: "1/1", background: "#C9BCA8", borderRadius: 6, boxShadow: "0 20px 44px rgba(0,0,0,.3)" }} />
          )}
          <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
            <div>
              <div className="text-[22px] font-extrabold text-white">
                {priceText || (source === "shopify" && product?.price?.amount ? `EC$${Math.round(Number(product.price.amount))}` : "EC$35")}
              </div>
              <div className="mt-0.5 text-[11px] text-white opacity-90" style={{ letterSpacing: "0.3em" }}>
                LUUT SLU
              </div>
            </div>
            <div style={{ background: "#fff", color: "#111", fontSize: 12, fontWeight: 700, padding: "8px 16px", borderRadius: 999 }}>
              {ctaText || "Shop Now"}
            </div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {[aspect, `style: ${style}`, realism, campaign.replace(/_/g, " ")].map((t, i) => (
            <span key={i} style={{ fontSize: 11.5, background: RAISED, color: TEXT, padding: "5px 10px", borderRadius: 7 }}>{t}</span>
          ))}
        </div>
        <div className="mt-2 text-[12px] italic" style={{ color: "#6E6878" }}>
          Mockup preview — not a generated image. Updates live as you change settings.
        </div>
      </div>

      {/* Result */}
      <RowHeader title="Result" />
      <div
        className="flex flex-col items-center justify-center gap-2.5"
        style={{
          background: CARD, border: `1.5px dashed ${LINE}`, borderRadius: 18,
          minHeight: 220, color: "#6E6878", padding: 24,
        }}
      >
        {resultUrl ? (
          <div className="w-full space-y-3">
            <img src={resultUrl} alt="Generated poster" className="w-full rounded-lg" />
            <button
              type="button"
              onClick={() => downloadImage(resultUrl, "luut-poster.png")}
              className="flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold"
              style={{ background: RAISED, border: `1px solid ${LINE}`, color: "#fff" }}
            >
              <Download className="h-4 w-4" /> Download
            </button>
          </div>
        ) : (
          <>
            <Sparkles size={26} color="#4A4552" />
            <span className="text-[14px]">Poster preview will appear here</span>
          </>
        )}
      </div>

      {/* Sticky Generate */}
      <div className="sticky bottom-0 mt-6" style={{ background: `linear-gradient(180deg, transparent, ${INK} 30%)`, padding: "20px 0 18px" }}>
        <button
          type="button"
          onClick={() => generate()}
          disabled={generating}
          className="flex w-full items-center justify-center gap-2 disabled:opacity-70"
          style={{ background: goldGrad, color: "#1A1206", border: "none", borderRadius: 15, padding: 17, fontSize: 16.5, fontWeight: 700, cursor: "pointer", boxShadow: goldGlow }}
        >
          {generating ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</> : <><Sparkles size={19} /> Generate Poster</>}
        </button>
        <button
          type="button"
          onClick={() => generate({ reuseSeed: true })}
          disabled={generating || lastSeed == null}
          className="mt-2 flex w-full items-center justify-center gap-2 disabled:opacity-40"
          style={{ background: "transparent", color: MUTED, border: `1px solid ${LINE}`, borderRadius: 13, padding: 13, fontSize: 14.5, fontWeight: 500, cursor: "pointer" }}
        >
          <RefreshCcw className="h-3.5 w-3.5" />
          Regenerate Same Poster{lastSeed != null ? ` (seed ${lastSeed})` : ""}
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   TEXT-TO-IMAGE SUBTAB (wired to build-poster-prompt + generate-poster-t2i)
   ============================================================ */
function TextToImage({ brandStyle }: { brandStyle: BrandStyle }) {
  const [campaign, setCampaign] = useState("Sale");
  const [style, setStyle] = useState("Clean");
  const [realism, setRealism] = useState("Standard");
  const [ratio, setRatio] = useState<AspectRatio>("1:1");
  const [headline, setHeadline] = useState("");
  const [sub, setSub] = useState("");
  const [key, setKey] = useState("");
  const [dates, setDates] = useState("");
  const [locations, setLocations] = useState("Castries · Gros Islet · Vieux Fort");
  const [theme, setTheme] = useState("");
  const [refImg, setRefImg] = useState<string | null>(null);
  const [finalPrompt, setFinalPrompt] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  const compiled = [
    `${style} ${campaign.toLowerCase()} promotional poster.`,
    headline ? `Headline: "${headline}".` : "",
    sub ? `Subheadline: "${sub}".` : "",
    key ? `Key detail: "${key}".` : "",
    dates ? `Dates: ${dates}.` : "",
    locations ? `Locations: ${locations}.` : "",
    theme ? `Theme: ${theme}.` : "",
    `${realism} realism. Compose in ${ratio}. Bold readable typography, LUUT SLU branding.`,
  ].filter(Boolean).join(" ");

  const buildPrompt = async () => {
    if (!headline.trim() && !sub.trim() && !key.trim()) {
      toast.error("Add at least a headline, subheadline, or key detail");
      return;
    }
    setBuilding(true);
    try {
      const brandDef = getBrandStyleDef(brandStyle);
      const { data, error } = await supabase.functions.invoke("build-poster-prompt", {
        body: {
          campaignType: campaign,
          headline: headline.trim(),
          subheadline: sub.trim(),
          keyDetail: key.trim(),
          dateRange: dates.trim(),
          locations: locations.trim(),
          style, realism, brandStyle,
          brandSnippet: brandDef?.snippet ?? "",
          additionalNotes: theme.trim(),
          referenceImage: refImg ?? undefined,
        },
      });
      const err = (data as any)?.error || error?.message;
      if (err) { toast.error(err); return; }
      const p = (data as any)?.prompt;
      if (!p) { toast.error("No prompt returned"); return; }
      setFinalPrompt(p);
      toast.success("Prompt ready — edit, then generate");
    } catch (e: any) {
      toast.error(e?.message || "Could not build prompt");
    } finally {
      setBuilding(false);
    }
  };

  const generate = async () => {
    const p = (finalPrompt ?? compiled).trim();
    if (!p) { toast.error("Build a prompt first"); return; }
    setLoading(true);
    setResultUrl(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("generate-poster-t2i", {
        body: { prompt: p, aspectRatio: ratio },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const err = (data as any)?.error || error?.message;
      if (err) {
        toast.error(/insufficient credit|out of credit/i.test(err) ? "Replicate is out of credit. Top up and try again." : err);
        return;
      }
      const url = (data as any)?.imageUrl;
      if (!url) { toast.error("Generation failed"); return; }
      setResultUrl(url);
      toast.success("Image generated");
      try {
        const title = headline.trim() || sub.trim() || key.trim() || `${campaign} poster`;
        await supabase.from("marketing_generated_images" as any).insert({
          image_url: url, thumbnail_url: url,
          generation_type: "ai_poster", campaign_type: "ai_poster",
          style: "text_to_image", aspect_ratio: ratio,
          prompt_used: p,
          product_title: title.length > 60 ? `${title.slice(0, 57)}…` : title,
          model_used: "ideogram-ai/ideogram-v3-quality",
        } as any);
      } catch {}
    } catch (e: any) {
      toast.error(e?.message || "Generation failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Model note */}
      <div style={{ background: CARD, border: `1px solid ${LINE}`, borderRadius: 14, padding: "13px 16px", marginTop: 8 }}>
        <div className="text-[15px] font-bold text-white">Text to Image</div>
        <div className="mt-0.5 text-[12.5px]" style={{ color: MUTED, fontFamily: "'SF Mono', ui-monospace, monospace" }}>
          Model: ideogram-ai/ideogram-v3-quality
        </div>
      </div>

      <RowHeader title="Campaign Type" />
      <HScroll>
        {["Sale", "Promotion", "New Arrival", "Limited Drop", "Clearance", "Brand Awareness", "Event"].map((x) => (
          <Pill key={x} label={x} active={campaign === x} onClick={() => setCampaign(x)} />
        ))}
      </HScroll>

      <RowHeader title="Poster Copy" />
      <div style={{ background: CARD, border: `1px solid ${LINE}`, borderRadius: 16, padding: 16 }}>
        <TextField label="Headline" placeholder="CLEARANCE SALE" value={headline} onChange={(e) => setHeadline(e.target.value)} />
        <TextField label="Subheadline" placeholder="Everything Must Go" value={sub} onChange={(e) => setSub(e.target.value)} />
        <TextField label="Key Detail" placeholder="50% OFF" value={key} onChange={(e) => setKey(e.target.value)} />
        <div className="mb-2 text-[12px] font-semibold uppercase tracking-widest" style={{ color: "#8A8898" }}>Date Range</div>
        <div className="mb-3 flex items-center gap-2.5" style={{ background: "#0E0D11", border: `1px solid ${LINE}`, borderRadius: 10, padding: "12px 14px" }}>
          <Calendar size={16} color={MUTED} />
          <input
            value={dates}
            onChange={(e) => setDates(e.target.value)}
            placeholder="June 25 — June 30"
            className="flex-1 bg-transparent outline-none"
            style={{ color: "#fff", fontSize: 14.5 }}
          />
        </div>
        <div className="mb-2 text-[12px] font-semibold uppercase tracking-widest" style={{ color: "#8A8898" }}>Locations</div>
        <div className="flex items-center gap-2.5" style={{ background: "#0E0D11", border: `1px solid ${LINE}`, borderRadius: 10, padding: "12px 14px" }}>
          <MapPin size={16} color={MUTED} />
          <input
            value={locations}
            onChange={(e) => setLocations(e.target.value)}
            className="flex-1 bg-transparent outline-none"
            style={{ color: "#fff", fontSize: 14.5 }}
          />
        </div>
      </div>

      <RowHeader title="Style" />
      <HScroll>
        {["Clean", "Luxury", "Bold", "Hype", "Modern", "Minimal"].map((x) => (
          <Pill key={x} label={x} active={style === x} onClick={() => setStyle(x)} />
        ))}
      </HScroll>

      <RowHeader title="Realism Level" />
      <HScroll>
        {["Standard", "Premium", "Hyper Realistic"].map((x) => (
          <Pill key={x} label={x} active={realism === x} onClick={() => setRealism(x)} />
        ))}
      </HScroll>

      <RowHeader title="Choose Shape" />
      <ShapePicker ratio={ratio} setRatio={(v) => setRatio(v as AspectRatio)} options={["1:1", "9:16", "16:9", "4:3", "3:4"]} />

      <RowHeader title="Theme / Additional Notes" />
      <textarea
        value={theme}
        onChange={(e) => setTheme(e.target.value)}
        placeholder="e.g. tropical island vibes, neon accents, warm sunset colors..."
        style={{
          width: "100%", minHeight: 90, background: CARD,
          border: `1px solid ${LINE}`, borderRadius: 14, padding: "13px 14px",
          color: "#fff", fontSize: 14, outline: "none", resize: "vertical",
          fontFamily: "inherit",
        }}
      />

      <RowHeader title="Reference Poster (Optional)" />
      <RefUpload
        value={refImg}
        onChange={setRefImg}
        subtext="Use this poster to reference its design style — layout, color feel, and composition. Do not copy any contents inside."
      />

      <RowHeader title="Final Prompt" />
      <FinalPrompt
        compiled={finalPrompt ?? compiled}
        value={null}
        onChange={(v) => setFinalPrompt(v)}
        addChips={["Bigger headline", "More contrast", "Add urgency", "Cleaner layout", "Bolder colors", "Premium feel"]}
      />

      <RowHeader title="Result" />
      <div
        className="flex flex-col items-center justify-center gap-2.5"
        style={{
          background: CARD, border: `1.5px dashed ${LINE}`, borderRadius: 18,
          minHeight: 220, color: "#6E6878", padding: 24,
        }}
      >
        {resultUrl ? (
          <div className="w-full space-y-3">
            <img src={resultUrl} alt="Generated poster" className="w-full rounded-lg" />
            <button
              type="button"
              onClick={() => downloadImage(resultUrl, "luut-text-poster.png")}
              className="flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold"
              style={{ background: RAISED, border: `1px solid ${LINE}`, color: "#fff" }}
            >
              <Download className="h-4 w-4" /> Download
            </button>
          </div>
        ) : (
          <>
            <Sparkles size={26} color="#4A4552" />
            <span className="text-[14px]">Poster preview will appear here</span>
          </>
        )}
      </div>

      {/* Sticky actions */}
      <div className="sticky bottom-0 mt-6" style={{ background: `linear-gradient(180deg, transparent, ${INK} 30%)`, padding: "20px 0 18px" }}>
        <button
          type="button"
          onClick={buildPrompt}
          disabled={building || loading}
          className="mb-2 flex w-full items-center justify-center gap-2 disabled:opacity-60"
          style={{ background: "transparent", color: "#fff", border: `1px solid ${LINE}`, borderRadius: 13, padding: 13, fontSize: 14.5, fontWeight: 600, cursor: "pointer" }}
        >
          {building ? <><Loader2 className="h-4 w-4 animate-spin" /> Writing prompt…</> : <><Wand2 size={16} /> Build Prompt</>}
        </button>
        <button
          type="button"
          onClick={generate}
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 disabled:opacity-70"
          style={{ background: goldGrad, color: "#1A1206", border: "none", borderRadius: 15, padding: 17, fontSize: 16.5, fontWeight: 700, cursor: "pointer", boxShadow: goldGlow }}
        >
          {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</> : <><Sparkles size={19} /> Generate Poster</>}
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   ROOT — subtab selector + shell
   ============================================================ */
export default function PosterTab({ brandStyle }: { brandStyle: BrandStyle }) {
  const [gen, setGen] = useState<"i2i" | "t2i">("i2i");

  return (
    <div
      className="-mx-4 -mb-6 px-4 pb-6 pt-2"
      style={{ background: INK, color: TEXT, minHeight: "calc(100vh - 220px)" }}
    >
      <div className="mx-auto max-w-[720px]">
        {/* Generator sub-tabs */}
        <div className="flex gap-2 pt-2">
          {[
            { k: "i2i", l: "Image → Image", d: "Poster from your product", Icon: ImageIcon },
            { k: "t2i", l: "Text → Image", d: "Poster from text only", Icon: Wand2 },
          ].map((m) => {
            const active = gen === m.k;
            const Ic = m.Icon;
            return (
              <button
                key={m.k}
                type="button"
                onClick={() => setGen(m.k as any)}
                className="flex-1 text-left"
                style={{
                  background: active ? `${GOLD}14` : CARD,
                  border: `1.5px solid ${active ? GOLD : LINE}`,
                  borderRadius: 14,
                  padding: "13px 15px",
                  cursor: "pointer",
                }}
              >
                <div className="flex items-center gap-2 text-[14.5px] font-bold" style={{ color: active ? "#fff" : TEXT }}>
                  <Ic size={16} color={active ? GOLD : MUTED} />
                  {m.l}
                </div>
                <div className="mt-1 text-[11.5px]" style={{ color: MUTED }}>{m.d}</div>
              </button>
            );
          })}
        </div>

        {gen === "i2i" ? <ImageToImage brandStyle={brandStyle} /> : <TextToImage brandStyle={brandStyle} />}
      </div>
    </div>
  );
}
