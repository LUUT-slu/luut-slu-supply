import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Sparkles, Download, Share2, Link2, Save, RotateCw, Pencil, Plug, ZoomIn } from "lucide-react";
import PosterLightbox from "./PosterLightbox";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type PosterStyle = "hype" | "clean" | "luxury" | "bold";
type DesktopTab = "poster" | "display" | "video" | "library";

export interface DesktopChromeProps {
  // Tab control
  activeTab: DesktopTab;
  onTabChange: (t: DesktopTab) => void;

  // Product
  productName?: string;
  productImage?: string;
  productPrice?: number | string;
  brandName: string;
  products: { id: string; title: string }[];
  selectedProductId: string;
  onSelectProduct: (id: string) => void;

  // Poster controls
  aiPosterStyle: PosterStyle;
  setAiPosterStyle: (s: PosterStyle) => void;
  aiPosterAspectRatio: string;
  setAiPosterAspectRatio: (r: string) => void;
  urgencyText: string;
  setUrgencyText: (s: string) => void;
  tagline: string;
  setTagline: (s: string) => void;
  meetupText: string;
  setMeetupText: (s: string) => void;
  aiPosterCustom: string;
  setAiPosterCustom: (s: string) => void;

  // Generation state
  aiPosterGenerating: boolean;
  aiPosterResult: string | null;
  aiPosterPrompt: string;
  lastGeneratedAt: number | null;
  onGenerate: () => void;
  onClear: () => void;

  // Optional slots for non-poster tabs
  displaySlot?: React.ReactNode;
  videoSlot?: React.ReactNode;
}

const STYLES: { key: PosterStyle; label: string }[] = [
  { key: "hype", label: "Hype" },
  { key: "clean", label: "Clean" },
  { key: "luxury", label: "Luxury" },
  { key: "bold", label: "Bold" },
];

const FORMATS = ["9:16", "1:1", "4:5", "16:9"];

const MODEL_LABEL = "Ideogram v3 Turbo";

async function downloadOrShare(url: string) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Fetch failed");
    const blob = await res.blob();
    const isMobile = /Mobi|Android/i.test(navigator.userAgent);
    if (isMobile && typeof navigator.share === "function") {
      try {
        const file = new File([blob], "luut-poster.png", { type: blob.type || "image/png" });
        const navAny = navigator as any;
        if (navAny.canShare?.({ files: [file] })) {
          await navAny.share({ files: [file], title: "Luut Poster" });
          return;
        }
      } catch {}
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
}

async function copyLink(url: string) {
  try {
    await navigator.clipboard.writeText(url);
    toast.success("Link copied");
  } catch {
    toast.error("Copy failed");
  }
}

function shareWhatsapp(url: string, caption: string) {
  const text = encodeURIComponent(`${caption}\n${url}`);
  window.open(`https://wa.me/?text=${text}`, "_blank", "noopener");
}

async function saveToLibrary(url: string, meta: { product?: string; style: string; aspect: string }) {
  try {
    const { error } = await supabase
      .from("marketing_generated_images" as any)
      .insert({
        image_url: url,
        thumbnail_url: url,
        generation_type: "ai_poster",
        product_title: meta.product || null,
        style: meta.style,
        aspect_ratio: meta.aspect,
      } as any);
    if (error) throw error;
    toast.success("Saved to library");
  } catch (e: any) {
    toast.error(e?.message || "Save failed");
  }
}

export default function DesktopChrome(props: DesktopChromeProps) {
  const navigate = useNavigate();
  const {
    activeTab,
    onTabChange,
    productName,
    productImage,
    productPrice,
    brandName,
    products,
    selectedProductId,
    onSelectProduct,
    aiPosterStyle,
    setAiPosterStyle,
    aiPosterAspectRatio,
    setAiPosterAspectRatio,
    urgencyText,
    setUrgencyText,
    tagline,
    setTagline,
    meetupText,
    setMeetupText,
    aiPosterCustom,
    setAiPosterCustom,
    aiPosterGenerating,
    aiPosterResult,
    aiPosterPrompt,
    lastGeneratedAt,
    onGenerate,
    onClear,
    displaySlot,
    videoSlot,
  } = props;

  const [lightboxOpen, setLightboxOpen] = useState(false);

  // Escape to clear preview on canvas (only when lightbox is closed)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && aiPosterResult && !lightboxOpen) onClear();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [aiPosterResult, onClear, lightboxOpen]);

  const lastTimeLabel = lastGeneratedAt
    ? new Date(lastGeneratedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "—";

  return (
    <div className="studio-desktop flex min-h-screen flex-col bg-[#080808] text-[#e8e8e8]">
      {/* Top bar */}
      <header className="flex h-[54px] items-center justify-between border-b border-[#1c1c1c] bg-[#0c0c0c] px-5">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate("/admin")}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-[#1c1c1c] bg-[#111] text-[#e8e8e8] hover:border-[#3a3a3a]"
            aria-label="Back to admin"
          >
            <Plug className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-3">
            <span className="text-[13px] font-semibold tracking-[0.18em] text-[#e8e8e8]">LUUT SLU</span>
            <span className="h-4 w-px bg-[#1c1c1c]" />
            <span className="text-[10px] uppercase tracking-[0.22em] text-[#555]">Marketing Studio</span>
          </div>
        </div>

        <nav className="flex items-center gap-1 rounded-full border border-[#1c1c1c] bg-[#111] p-1">
          {(["poster", "display", "video", "library"] as DesktopTab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onTabChange(t)}
              className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.14em] transition-colors ${
                activeTab === t
                  ? "bg-[#e8e8e8] text-[#080808]"
                  : "text-[#aaa] hover:text-[#e8e8e8]"
              }`}
            >
              {t}
            </button>
          ))}
        </nav>
      </header>

      {/* Body: 3-col when poster active, else single canvas */}
      {activeTab === "poster" ? (
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <aside className="w-[300px] shrink-0 overflow-y-auto border-r border-[#1c1c1c] bg-[#0c0c0c]">
            <div className="space-y-6 p-5 pb-32">
              {/* Product */}
              <section>
                <div className="mb-2 text-[10px] uppercase tracking-[0.18em] text-[#555]">Product</div>
                <div className="space-y-2 rounded-md border border-[#1c1c1c] bg-[#111] p-3">
                  {productName && (
                    <div className="flex items-center gap-3">
                      {productImage && (
                        <img src={productImage} alt="" className="h-10 w-10 rounded object-cover" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[12px] text-[#e8e8e8]">{productName}</div>
                        <div className="text-[10px] text-[#555]">
                          {productPrice ? `EC$${Math.round(Number(productPrice))} · ` : ""}
                          {brandName}
                        </div>
                      </div>
                    </div>
                  )}
                  <select
                    value={selectedProductId}
                    onChange={(e) => onSelectProduct(e.target.value)}
                    className="w-full rounded border border-[#1c1c1c] bg-[#0c0c0c] px-2 py-1.5 text-[11px] text-[#e8e8e8] focus:border-[#3a3a3a] focus:outline-none"
                  >
                    {products.length === 0 && <option value="">Loading…</option>}
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </div>
              </section>


              {/* Style */}
              <section>
                <div className="mb-2 text-[10px] uppercase tracking-[0.18em] text-[#555]">Style</div>
                <div className="grid grid-cols-2 gap-2">
                  {STYLES.map((s) => (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => setAiPosterStyle(s.key)}
                      className={`rounded-md border p-3 text-left text-[12px] transition-colors ${
                        aiPosterStyle === s.key
                          ? "border-[#e8e8e8] bg-[#111] text-[#e8e8e8]"
                          : "border-[#1c1c1c] bg-[#111] text-[#aaa] hover:border-[#3a3a3a]"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </section>

              {/* Format */}
              <section>
                <div className="mb-2 text-[10px] uppercase tracking-[0.18em] text-[#555]">Format</div>
                <div className="flex flex-wrap gap-1.5">
                  {FORMATS.map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setAiPosterAspectRatio(f)}
                      className={`rounded-full border px-3 py-1 text-[11px] transition-colors ${
                        aiPosterAspectRatio === f
                          ? "border-[#e8e8e8] bg-[#e8e8e8] text-[#080808]"
                          : "border-[#1c1c1c] bg-[#111] text-[#aaa] hover:border-[#3a3a3a]"
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </section>

              {/* Urgency */}
              <SidebarField label="Urgency" value={urgencyText} onChange={setUrgencyText} placeholder="Limited stock" />

              {/* Tagline */}
              <SidebarField label="Tagline" value={tagline} onChange={setTagline} placeholder="Drop something" />

              {/* Pickup */}
              <SidebarField
                label="Pickup locations"
                value={meetupText}
                onChange={setMeetupText}
                placeholder="Rodney Bay · Castries"
              />

              {/* Extras */}
              <section>
                <div className="mb-2 text-[10px] uppercase tracking-[0.18em] text-[#555]">Extra instructions</div>
                <textarea
                  rows={3}
                  value={aiPosterCustom}
                  onChange={(e) => setAiPosterCustom(e.target.value)}
                  placeholder="tropical beach background, huge price, fire emoji..."
                  className="w-full resize-none rounded-md border border-[#1c1c1c] bg-[#111] px-3 py-2 text-[12px] text-[#e8e8e8] placeholder:text-[#555] focus:border-[#3a3a3a] focus:outline-none"
                />
              </section>
            </div>

            {/* Sticky Generate */}
            <div className="sticky bottom-0 border-t border-[#1c1c1c] bg-[#0c0c0c] p-4">
              <button
                type="button"
                disabled={!productName || aiPosterGenerating}
                onClick={onGenerate}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-[#e8e8e8] px-4 py-3 text-[12px] font-bold uppercase tracking-[0.16em] text-[#080808] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {aiPosterGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Generate
                  </>
                )}
              </button>
            </div>
          </aside>

          {/* Canvas */}
          <section className="flex flex-1 flex-col overflow-hidden">
            {/* Canvas toolbar */}
            <div className="flex h-12 items-center justify-between border-b border-[#1c1c1c] bg-[#0c0c0c] px-5">
              <div className="flex items-center gap-2">
                <ToolbarButton
                  icon={<RotateCw className="h-3.5 w-3.5" />}
                  label="Regenerate"
                  onClick={onGenerate}
                  disabled={!productName || aiPosterGenerating}
                />
                <ToolbarButton
                  icon={<Pencil className="h-3.5 w-3.5" />}
                  label="Edit"
                  onClick={() => toast.info("Adjust the prompt and regenerate")}
                  disabled={!aiPosterResult}
                />
              </div>
              <div className="flex items-center gap-2">
                <ToolbarButton
                  icon={<Share2 className="h-3.5 w-3.5" />}
                  label="Share"
                  onClick={() => aiPosterResult && shareWhatsapp(aiPosterResult, productName || "Luut SLU")}
                  disabled={!aiPosterResult}
                />
                <button
                  type="button"
                  disabled={!aiPosterResult}
                  onClick={() => aiPosterResult && downloadOrShare(aiPosterResult)}
                  className="flex items-center gap-1.5 rounded-md border border-[#888] bg-transparent px-3 py-1.5 text-[11px] text-[#e8e8e8] transition-colors hover:bg-[#111] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </button>
              </div>
            </div>

            {/* Preview */}
            <div className="flex flex-1 items-center justify-center overflow-auto bg-[#080808] p-8">
              {aiPosterGenerating ? (
                <div className="flex flex-col items-center gap-3 text-[#aaa]">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <div className="text-[12px]">Generating poster… ~20–40s</div>
                </div>
              ) : aiPosterResult ? (
                <div className="flex flex-col items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setLightboxOpen(true)}
                    aria-label="Zoom poster"
                    className="group relative block cursor-zoom-in border-0 bg-transparent p-0"
                  >
                    <img
                      src={aiPosterResult}
                      alt="AI poster"
                      className="max-h-[calc(100vh-200px)] max-w-full rounded-sm border border-[#1c1c1c] object-contain shadow-2xl transition-transform group-hover:scale-[1.01]"
                    />
                    <span
                      className="pointer-events-none absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full opacity-0 transition-opacity group-hover:opacity-100"
                      style={{ background: "rgba(0,0,0,0.6)", color: "#fff" }}
                    >
                      <ZoomIn size={18} />
                    </span>
                  </button>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-[#3a3a3a]">
                    {aiPosterAspectRatio} · {MODEL_LABEL}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 text-center text-[#555]">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[#1c1c1c] bg-[#0c0c0c]">
                    <Sparkles className="h-6 w-6 text-[#3a3a3a]" />
                  </div>
                  <div className="text-[12px] text-[#aaa]">No poster yet</div>
                  <div className="max-w-[280px] text-[11px] text-[#555]">
                    Pick a product, choose a style and format, then hit Generate.
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Right action strip */}
          <aside className="w-[180px] shrink-0 overflow-y-auto border-l border-[#1c1c1c] bg-[#0c0c0c]">
            <div className="space-y-4 p-4">
              {aiPosterResult ? (
                <>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#e8e8e8]" />
                      <span className="text-[10px] uppercase tracking-[0.18em] text-[#aaa]">Ready</span>
                    </div>
                    <div className="text-[10px] text-[#555]">
                      {aiPosterStyle} · {aiPosterAspectRatio}
                    </div>
                    <div className="text-[10px] text-[#555]">{MODEL_LABEL}</div>
                  </div>

                  <div className="h-px bg-[#1c1c1c]" />

                  <button
                    type="button"
                    onClick={() => downloadOrShare(aiPosterResult)}
                    className="flex w-full items-center justify-center gap-1.5 rounded-md bg-[#e8e8e8] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#080808] hover:opacity-90"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download
                  </button>

                  <ActionStripButton
                    icon={<Share2 className="h-3.5 w-3.5" />}
                    label="WhatsApp"
                    onClick={() => shareWhatsapp(aiPosterResult, productName || "Luut SLU")}
                  />
                  <ActionStripButton
                    icon={<Link2 className="h-3.5 w-3.5" />}
                    label="Copy link"
                    onClick={() => copyLink(aiPosterResult)}
                  />
                  <ActionStripButton
                    icon={<Save className="h-3.5 w-3.5" />}
                    label="Save"
                    onClick={() =>
                      saveToLibrary(aiPosterResult, {
                        product: productName,
                        style: aiPosterStyle,
                        aspect: aiPosterAspectRatio,
                      })
                    }
                  />

                  <div className="h-px bg-[#1c1c1c]" />

                  <ActionStripButton
                    icon={<RotateCw className="h-3.5 w-3.5" />}
                    label="Regenerate"
                    onClick={onGenerate}
                  />
                  <ActionStripButton
                    icon={<Pencil className="h-3.5 w-3.5" />}
                    label="Adjust prompt"
                    onClick={() => {
                      onClear();
                      toast.info("Edit the sidebar then regenerate");
                    }}
                  />

                  {aiPosterPrompt && (
                    <details className="text-[10px] text-[#555]">
                      <summary className="cursor-pointer select-none">Prompt</summary>
                      <p className="mt-1 whitespace-pre-wrap leading-relaxed">{aiPosterPrompt}</p>
                    </details>
                  )}
                </>
              ) : (
                <div className="text-[10px] text-[#3a3a3a]">
                  Actions appear here once a poster is ready.
                </div>
              )}
            </div>
          </aside>
        </div>
      ) : (
        // Non-poster tabs: render placeholder that hands control back to mobile tree below.
        // We unmount the desktop chrome at lg by not applying lg:hidden externally;
        // instead, when switching tabs the parent will toggle showAiPoster.
        <div className="flex flex-1 items-center justify-center bg-[#080808] p-12 text-center text-[#aaa]">
          <div className="max-w-md space-y-3">
            <div className="text-[11px] uppercase tracking-[0.2em] text-[#555]">{activeTab}</div>
            <div className="text-[14px] text-[#e8e8e8]">Switching view…</div>
          </div>
        </div>
      )}

      {/* Status bar */}
      <footer className="flex h-9 items-center justify-between border-t border-[#1c1c1c] bg-[#0c0c0c] px-5 text-[10px] uppercase tracking-[0.14em] text-[#555]">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${aiPosterGenerating ? "bg-[#aaa]" : "bg-[#e8e8e8]"}`} />
            {aiPosterGenerating ? "Generating" : "Idle"}
          </span>
          <span>Last · {lastTimeLabel}</span>
          <span>Model · {MODEL_LABEL}</span>
        </div>
        <span className="rounded-full border border-[#1c1c1c] bg-[#111] px-3 py-1 text-[#aaa]">Replicate</span>
      </footer>
      <PosterLightbox
        open={lightboxOpen}
        src={aiPosterResult}
        onClose={() => setLightboxOpen(false)}
      />
    </div>
  );
}

function SidebarField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  placeholder?: string;
}) {
  return (
    <section>
      <div className="mb-2 text-[10px] uppercase tracking-[0.18em] text-[#555]">{label}</div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-[#1c1c1c] bg-[#111] px-3 py-2 text-[12px] text-[#e8e8e8] placeholder:text-[#555] focus:border-[#3a3a3a] focus:outline-none"
      />
    </section>
  );
}

function ToolbarButton({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1.5 rounded-md border border-[#1c1c1c] bg-[#111] px-3 py-1.5 text-[11px] text-[#aaa] transition-colors hover:border-[#3a3a3a] hover:text-[#e8e8e8] disabled:cursor-not-allowed disabled:opacity-40"
    >
      {icon}
      {label}
    </button>
  );
}

function ActionStripButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-center gap-1.5 rounded-md border border-[#1c1c1c] bg-[#111] px-3 py-2 text-[11px] text-[#aaa] transition-colors hover:border-[#3a3a3a] hover:text-[#e8e8e8]"
    >
      {icon}
      {label}
    </button>
  );
}
