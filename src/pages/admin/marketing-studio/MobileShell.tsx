import { useState } from "react";
import {
  Download,
  RefreshCw,
  Share2,
  MessageCircle,
  Menu,
  X,
  LayoutGrid,
  Image as ImageIcon,
  Play,
  Folder,
  Copy,
  Sparkles,
  Loader2,
  ShoppingBag,
  User,
} from "lucide-react";
import { toast } from "sonner";
import PosterLightbox from "./PosterLightbox";

type StudioMode = "select" | "images" | "videos";
type AiStyle = "default" | "hype" | "clean" | "luxury" | "bold";
type DisplayStyle = "studio" | "lifestyle" | "minimal" | "human";
type DisplayAspect = "1:1" | "4:5" | "9:16" | "3:4" | "16:9" | "4:3";
type DisplayBackground = "solid" | "gradient" | "studio" | "lifestyle" | "transparent";
type ModelGender = "male" | "female" | "unspecified";
type SkinTone = "light" | "medium-light" | "medium" | "medium-dark" | "dark";

export interface MobileShellProps {
  studioMode: StudioMode;
  setStudioMode: (m: StudioMode) => void;
  showAiPoster: boolean;
  setShowAiPoster: (v: boolean) => void;
  navigate: (path: string) => void;

  productName?: string;
  productImage?: string;
  productPrice?: number | string;
  posterPrice?: string;
  setPosterPrice?: (s: string) => void;
  brandName: string;

  aiPosterStyle: AiStyle;
  setAiPosterStyle: (s: AiStyle) => void;
  aiPosterAspectRatio: string;
  setAiPosterAspectRatio: (r: string) => void;
  urgencyText: string;
  setUrgencyText: (v: string) => void;
  tagline: string;
  setTagline: (v: string) => void;
  meetupText: string;
  setMeetupText: (v: string) => void;
  aiPosterCustom: string;
  setAiPosterCustom: (v: string) => void;

  aiPosterGenerating: boolean;
  aiPosterResult: string | null;
  onGenerate: () => void;
  onOpenProductPicker: () => void;
  customProductImages?: string[];
  setCustomProductImages?: (v: string[]) => void;
  variantSlot?: React.ReactNode;
  displaySlot?: React.ReactNode;
  videoSlot?: React.ReactNode;

  // Display generator (optional — when provided, Display mode uses the matching mobile shell)
  displayStyle?: DisplayStyle;
  setDisplayStyle?: (s: DisplayStyle) => void;
  displayAspect?: DisplayAspect;
  setDisplayAspect?: (a: DisplayAspect) => void;
  displayTextOverlay?: string;
  setDisplayTextOverlay?: (s: string) => void;
  displayBackground?: DisplayBackground;
  setDisplayBackground?: (b: DisplayBackground) => void;
  displayCustomPrompt?: string;
  setDisplayCustomPrompt?: (s: string) => void;
  modelGender?: ModelGender;
  setModelGender?: (g: ModelGender) => void;
  skinTone?: SkinTone;
  setSkinTone?: (t: SkinTone) => void;
  displayLoading?: boolean;
  displayResultUrl?: string | null;
  displayPrompt?: string;
  onGenerateDisplay?: () => void;
  onClearDisplay?: () => void;
}

const FORMATS = ["9:16", "1:1", "4:5", "16:9"];
const STYLES: { key: AiStyle; label: string; desc: string }[] = [
  { key: "default", label: "Default", desc: "LUUT brand" },
  { key: "hype", label: "Hype", desc: "Dark streetwear" },
  { key: "clean", label: "Clean", desc: "White minimal" },
  { key: "luxury", label: "Luxury", desc: "Warm gold" },
  { key: "bold", label: "Bold", desc: "High contrast" },
];

function PlugLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 22 22" fill="none" aria-hidden>
      <rect x="4" y="2" width="3" height="7" rx="1.5" fill="#777" />
      <rect x="9.5" y="2" width="3" height="5" rx="1.5" fill="#777" />
      <rect x="15" y="2" width="3" height="7" rx="1.5" fill="#777" />
      <path d="M3 9 Q3 18 11 18 Q19 18 19 9" stroke="#999" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <rect x="2" y="8" width="18" height="2.5" rx="1.25" fill="#666" />
    </svg>
  );
}

export default function MobileShell(props: MobileShellProps) {
  const {
    studioMode,
    setStudioMode,
    showAiPoster,
    setShowAiPoster,
    navigate,
    productName,
    productImage,
    productPrice,
    posterPrice = "",
    setPosterPrice,
    brandName,
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
    onGenerate,
    onOpenProductPicker,
    customProductImages = [],
    setCustomProductImages,
    variantSlot,
    displaySlot,
    videoSlot,
    displayStyle = "studio",
    setDisplayStyle,
    displayAspect = "1:1",
    setDisplayAspect,
    displayTextOverlay = "",
    setDisplayTextOverlay,
    displayBackground = "studio",
    setDisplayBackground,
    displayCustomPrompt = "",
    setDisplayCustomPrompt,
    modelGender = "unspecified",
    setModelGender,
    skinTone = "medium",
    setSkinTone,
    displayLoading = false,
    displayResultUrl = null,
    onGenerateDisplay,
  } = props;

  const displayWired = Boolean(onGenerateDisplay && setDisplayStyle);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [displayLightboxOpen, setDisplayLightboxOpen] = useState(false);

  // Determine current "mode" for the nav
  const currentNav: "poster" | "display" | "video" | "library" =
    studioMode === "videos"
      ? "video"
      : studioMode === "images" && !showAiPoster
        ? "display"
        : "poster";

  const modeLabel =
    currentNav === "poster"
      ? "Poster"
      : currentNav === "display"
        ? "Display"
        : currentNav === "video"
          ? "Video"
          : "Library";

  const selectMode = (m: "poster" | "display" | "video" | "library") => {
    setDrawerOpen(false);
    if (m === "poster") {
      setStudioMode("images");
      setShowAiPoster(true);
    } else if (m === "display") {
      setStudioMode("images");
      setShowAiPoster(false);
    } else if (m === "video") {
      setStudioMode("videos");
      setShowAiPoster(false);
    } else if (m === "library") {
      navigate("/admin/content-library");
    }
  };

  // Default to Poster mode on mobile
  useEffect(() => {
    if (studioMode === "select") {
      setStudioMode("images");
      setShowAiPoster(true);
    }
  }, [studioMode, setStudioMode, setShowAiPoster]);

  const priceStr = productPrice ? `EC$${Math.round(Number(productPrice))}` : "";

  const handleDownload = async () => {
    if (!aiPosterResult) return;
    try {
      const res = await fetch(aiPosterResult);
      const blob = await res.blob();
      const file = new File([blob], "luut-poster.png", { type: blob.type || "image/png" });
      const navAny: any = navigator;
      if (navAny.canShare && navAny.canShare({ files: [file] })) {
        await navAny.share({ files: [file], title: "LUUT Poster" });
        return;
      }
      // fallback: open in new tab
      window.open(aiPosterResult, "_blank");
    } catch (e: any) {
      window.open(aiPosterResult, "_blank");
    }
  };

  const handleShare = async () => {
    if (!aiPosterResult) return;
    const navAny: any = navigator;
    try {
      if (navAny.share) {
        await navAny.share({ title: "LUUT Poster", url: aiPosterResult });
      } else {
        await navigator.clipboard.writeText(aiPosterResult);
        toast.success("Link copied");
      }
    } catch {/* ignore */}
  };

  const handleWhatsApp = () => {
    if (!aiPosterResult) return;
    const text = `${productName || "Check this out"} — ${aiPosterResult}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  const handleCopyLink = async () => {
    if (!aiPosterResult) return;
    await navigator.clipboard.writeText(aiPosterResult);
    toast.success("Link copied");
  };

  // ---- Display handlers ----
  const handleDisplayDownload = async () => {
    if (!displayResultUrl) return;
    try {
      const res = await fetch(displayResultUrl);
      const blob = await res.blob();
      const file = new File([blob], "luut-display.png", { type: blob.type || "image/png" });
      const navAny: any = navigator;
      if (navAny.canShare && navAny.canShare({ files: [file] })) {
        await navAny.share({ files: [file], title: "LUUT Display" });
        return;
      }
      window.open(displayResultUrl, "_blank");
    } catch {
      window.open(displayResultUrl, "_blank");
    }
  };

  const handleDisplayShare = async () => {
    if (!displayResultUrl) return;
    const navAny: any = navigator;
    try {
      if (navAny.share) {
        await navAny.share({ title: "LUUT Display", url: displayResultUrl });
      } else {
        await navigator.clipboard.writeText(displayResultUrl);
        toast.success("Link copied");
      }
    } catch {/* ignore */}
  };

  const handleDisplayWhatsApp = () => {
    if (!displayResultUrl) return;
    const text = `${productName || "Check this out"} — ${displayResultUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  const handleDisplayCopyLink = async () => {
    if (!displayResultUrl) return;
    await navigator.clipboard.writeText(displayResultUrl);
    toast.success("Link copied");
  };

  const DISPLAY_STYLES_M: { key: DisplayStyle; label: string; desc: string }[] = [
    { key: "studio", label: "Studio", desc: "Clean backdrop" },
    { key: "lifestyle", label: "Lifestyle", desc: "Real setting" },
    { key: "minimal", label: "Minimal", desc: "Pure white" },
    { key: "human", label: "Human Model", desc: "Person wearing it" },
  ];
  const DISPLAY_FORMATS_M: DisplayAspect[] = ["1:1", "4:5", "9:16", "3:4", "16:9", "4:3"];
  const BACKGROUNDS_M: { key: DisplayBackground; label: string }[] = [
    { key: "solid", label: "Solid" },
    { key: "gradient", label: "Gradient" },
    { key: "studio", label: "Studio" },
    { key: "lifestyle", label: "Lifestyle" },
    { key: "transparent", label: "Transparent" },
  ];
  const GENDERS_M: { key: ModelGender; label: string }[] = [
    { key: "male", label: "Male" },
    { key: "female", label: "Female" },
    { key: "unspecified", label: "Unspecified" },
  ];
  const SKIN_TONES_M: { key: SkinTone; label: string }[] = [
    { key: "light", label: "Light" },
    { key: "medium-light", label: "Med-Light" },
    { key: "medium", label: "Medium" },
    { key: "medium-dark", label: "Med-Dark" },
    { key: "dark", label: "Dark" },
  ];



  return (
    <div className="lg:hidden min-h-screen flex flex-col" style={{ background: "#080808", color: "#fff", fontFamily: "Inter, system-ui, sans-serif" }}>
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-[14px] flex-shrink-0"
        style={{ height: 50, background: "#0c0c0c", borderBottom: "0.5px solid #1c1c1c" }}
      >
        <button
          onClick={() => navigate("/admin")}
          className="flex items-center gap-2"
          aria-label="LUUT SLU home"
        >
          <PlugLogo />
          <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.18em", color: "#e0e0e0" }}>
            LUUT SLU
          </span>
        </button>
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 10, color: "#444", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            {modeLabel}
          </span>
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            style={{
              width: 34,
              height: 34,
              borderRadius: 6,
              border: "0.5px solid #1c1c1c",
              background: "#111",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Menu size={17} color="#777" />
          </button>
        </div>
      </div>

      {/* Fixed preview panel (only for Poster mode) */}
      {currentNav === "poster" && (
        <div
          className="flex-shrink-0"
          style={{ background: "#0c0c0c", borderBottom: "0.5px solid #1c1c1c", padding: "12px 14px" }}
        >
          <div className="flex items-stretch">
            <div className="w-1/2 pr-[10px] flex items-center justify-center">
              <div
                className="w-full relative overflow-hidden flex flex-col"
                style={{
                  aspectRatio: "9 / 16",
                  maxHeight: 200,
                  borderRadius: 8,
                  background: "#111",
                  border: "0.5px solid #1c1c1c",
                  padding: 10,
                }}
              >
                {aiPosterResult ? (
                  <button
                    type="button"
                    onClick={() => setLightboxOpen(true)}
                    aria-label="View poster full screen"
                    className="absolute inset-0 p-0 border-0 bg-transparent cursor-zoom-in"
                  >
                    <img
                      src={aiPosterResult}
                      alt="Generated poster"
                      className="w-full h-full object-cover"
                    />
                  </button>
                ) : (
                  <>
                    <div
                      className="pointer-events-none absolute top-0 left-0 right-0"
                      style={{
                        height: 80,
                        background: "linear-gradient(135deg, rgba(255,255,255,0.05) 0%, transparent 60%)",
                      }}
                    />
                    <div
                      style={{
                        border: "0.5px solid #666",
                        borderRadius: 10,
                        padding: "2px 6px",
                        fontSize: 6,
                        fontWeight: 700,
                        color: "#aaa",
                        letterSpacing: "0.08em",
                        alignSelf: "flex-start",
                      }}
                    >
                      {urgencyText || "PREVIEW"}
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 900,
                        color: "#e8e8e8",
                        lineHeight: 0.88,
                        textTransform: "uppercase",
                        marginTop: 5,
                      }}
                    >
                      {(productName || "Your\nProduct").slice(0, 28)}
                    </div>
                    {priceStr && (
                      <div
                        style={{
                          background: "#e8e8e8",
                          borderRadius: 3,
                          padding: "2px 5px",
                          alignSelf: "flex-start",
                          marginTop: 5,
                        }}
                      >
                        <span style={{ fontSize: 7, fontWeight: 900, color: "#080808" }}>{priceStr}</span>
                      </div>
                    )}
                    <div style={{ marginTop: "auto" }}>
                      <div style={{ fontSize: 5, color: "#333", textAlign: "center", marginBottom: 2 }}>
                        {meetupText}
                      </div>
                      <div
                        style={{
                          border: "0.5px solid #666",
                          borderRadius: 10,
                          padding: 2,
                          fontSize: 5,
                          fontWeight: 700,
                          color: "#bbb",
                          textAlign: "center",
                        }}
                      >
                        DM TO BUY
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div
              className="w-1/2 pl-[10px] flex flex-col justify-center"
              style={{ gap: 5, borderLeft: "0.5px solid #1c1c1c" }}
            >
              <div style={{ marginBottom: 4 }}>
                <div style={{ fontSize: 9, color: "#3a3a3a", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  Style
                </div>
                <div style={{ fontSize: 11, fontWeight: 500, color: "#888", marginTop: 1 }}>
                  {STYLES.find((s) => s.key === aiPosterStyle)?.label} · {aiPosterAspectRatio}
                </div>
              </div>
              <div className="flex flex-wrap" style={{ gap: 3, marginTop: 4, marginBottom: 6 }}>
                {FORMATS.map((f) => {
                  const active = aiPosterAspectRatio === f;
                  return (
                    <button
                      key={f}
                      onClick={() => setAiPosterAspectRatio(f)}
                      style={{
                        padding: "3px 7px",
                        borderRadius: 4,
                        border: active ? "0.5px solid #888" : "0.5px solid #1c1c1c",
                        background: active ? "#1a1a1a" : "#111",
                        fontSize: 9,
                        color: active ? "#d0d0d0" : "#555",
                      }}
                    >
                      {f}
                    </button>
                  );
                })}
              </div>
              {[
                { icon: Download, label: "Download", primary: true, onClick: handleDownload },
                { icon: RefreshCw, label: "Regenerate", onClick: onGenerate },
                { icon: Share2, label: "Share", onClick: handleShare },
                { icon: MessageCircle, label: "WhatsApp", onClick: handleWhatsApp },
              ].map(({ icon: Icon, label, primary, onClick }) => (
                <button
                  key={label}
                  onClick={onClick}
                  disabled={!aiPosterResult && label !== "Regenerate"}
                  style={{
                    padding: "5px 8px",
                    borderRadius: 5,
                    border: primary ? "0.5px solid #888" : "0.5px solid #1c1c1c",
                    background: primary ? "#161616" : "#111",
                    color: primary ? "#d0d0d0" : "#666",
                    fontSize: 10,
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    width: "100%",
                    opacity: !aiPosterResult && label !== "Regenerate" ? 0.4 : 1,
                  }}
                >
                  <Icon size={12} />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Fixed preview panel — Display mode */}
      {currentNav === "display" && displayWired && (
        <div
          className="flex-shrink-0"
          style={{ background: "#0c0c0c", borderBottom: "0.5px solid #1c1c1c", padding: "12px 14px" }}
        >
          <div className="flex items-stretch">
            <div className="w-1/2 pr-[10px] flex items-center justify-center">
              <div
                className="w-full relative overflow-hidden flex items-center justify-center"
                style={{
                  aspectRatio: "1 / 1",
                  maxHeight: 200,
                  borderRadius: 8,
                  background: "#111",
                  border: "0.5px solid #1c1c1c",
                }}
              >
                {displayResultUrl ? (
                  <button
                    type="button"
                    onClick={() => setDisplayLightboxOpen(true)}
                    aria-label="View display image full screen"
                    className="absolute inset-0 p-0 border-0 bg-transparent cursor-zoom-in"
                  >
                    <img
                      src={displayResultUrl}
                      alt="Generated display"
                      className="w-full h-full object-cover"
                    />
                  </button>
                ) : (
                  <div className="flex flex-col items-center gap-1 text-center px-2">
                    <ImageIcon size={20} color="#3a3a3a" />
                    <span style={{ fontSize: 9, color: "#555" }}>No image yet</span>
                  </div>
                )}
              </div>
            </div>
            <div
              className="w-1/2 pl-[10px] flex flex-col justify-center"
              style={{ gap: 5, borderLeft: "0.5px solid #1c1c1c" }}
            >
              <div style={{ marginBottom: 4 }}>
                <div style={{ fontSize: 9, color: "#3a3a3a", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  Style
                </div>
                <div style={{ fontSize: 11, fontWeight: 500, color: "#888", marginTop: 1 }}>
                  {DISPLAY_STYLES_M.find((s) => s.key === displayStyle)?.label} · {displayAspect}
                </div>
              </div>
              {[
                { icon: Download, label: "Download", primary: true, onClick: handleDisplayDownload },
                { icon: RefreshCw, label: "Regenerate", onClick: () => onGenerateDisplay?.() },
                { icon: Share2, label: "Share", onClick: handleDisplayShare },
                { icon: MessageCircle, label: "WhatsApp", onClick: handleDisplayWhatsApp },
              ].map(({ icon: Icon, label, primary, onClick }) => (
                <button
                  key={label}
                  onClick={onClick}
                  disabled={!displayResultUrl && label !== "Regenerate"}
                  style={{
                    padding: "5px 8px",
                    borderRadius: 5,
                    border: primary ? "0.5px solid #888" : "0.5px solid #1c1c1c",
                    background: primary ? "#161616" : "#111",
                    color: primary ? "#d0d0d0" : "#666",
                    fontSize: 10,
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    width: "100%",
                    opacity: !displayResultUrl && label !== "Regenerate" ? 0.4 : 1,
                  }}
                >
                  <Icon size={12} />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Scrollable content */}
      <div
        className="flex-1 overflow-y-auto flex flex-col"
        style={{ padding: "14px 14px 96px", gap: 16 }}
      >
        {currentNav === "poster" ? (
          <>
            {/* Product */}
            <div>
              <div className="s-label" style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.1em", color: "#3a3a3a", textTransform: "uppercase", marginBottom: 7 }}>
                Product
              </div>
              <div
                className="flex items-center"
                style={{ background: "#111", border: "0.5px solid #1c1c1c", borderRadius: 8, padding: 10, gap: 10 }}
              >
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 5,
                    background: "#161616",
                    border: "0.5px solid #222",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    overflow: "hidden",
                  }}
                >
                  {productImage ? (
                    <img src={productImage} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <ShoppingBag size={16} color="#333" />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: "#ccc" }} className="truncate">
                    {productName || "No product selected"}
                  </div>
                  <div style={{ fontSize: 11, color: "#555", marginTop: 1 }}>
                    {priceStr ? `${priceStr} · ${brandName}` : brandName}
                  </div>
                </div>
                <button
                  onClick={onOpenProductPicker}
                  style={{
                    marginLeft: "auto",
                    fontSize: 10,
                    color: "#aaa",
                    border: "0.5px solid #1c1c1c",
                    borderRadius: 4,
                    padding: "3px 7px",
                    background: "transparent",
                    whiteSpace: "nowrap",
                  }}
                >
                  Change
                </button>
              </div>
            </div>

            {/* Variant selector (shared across tabs) */}
            {variantSlot}

            {/* Source photos override (multi-upload, up to 4) */}
            {setCustomProductImages && (() => {
              const MAX_REFS = 4;
              const refs = customProductImages;
              const canAddMore = refs.length < MAX_REFS;
              const showPlaceholder = refs.length === 0 && productImage;
              return (
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}>
                    <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.1em", color: "#3a3a3a", textTransform: "uppercase" }}>
                      Source photos {refs.length > 0 ? `(${refs.length}/${MAX_REFS})` : ""}
                    </div>
                    {refs.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setCustomProductImages([])}
                        style={{ fontSize: 10, color: "#888", background: "transparent", border: "none" }}
                      >
                        Clear all
                      </button>
                    )}
                  </div>
                  <div
                    style={{
                      background: "#111",
                      border: "0.5px solid #1c1c1c",
                      borderRadius: 8,
                      padding: 10,
                    }}
                  >
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {showPlaceholder && (
                        <div style={{ position: "relative", width: 52, height: 52, borderRadius: 5, overflow: "hidden", border: "0.5px solid #222", background: "#161616" }}>
                          <img src={productImage} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.7 }} />
                          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", color: "#aaa", fontSize: 8, textAlign: "center", padding: "1px 0", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                            Listing
                          </div>
                        </div>
                      )}
                      {refs.map((src, idx) => (
                        <div key={idx} style={{ position: "relative", width: 52, height: 52, borderRadius: 5, overflow: "hidden", border: "0.5px solid #2a2a2a", background: "#161616" }}>
                          <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          <button
                            type="button"
                            onClick={() => setCustomProductImages(refs.filter((_, i) => i !== idx))}
                            aria-label="Remove reference"
                            style={{ position: "absolute", top: -4, right: -4, width: 16, height: 16, borderRadius: 999, background: "#000", color: "#fff", border: "none", fontSize: 10, lineHeight: "16px", padding: 0 }}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      {canAddMore && (
                        <label
                          style={{
                            width: 52,
                            height: 52,
                            borderRadius: 5,
                            border: "1px dashed #2a2a2a",
                            background: "#0c0c0c",
                            color: "#666",
                            fontSize: 18,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                          }}
                        >
                          +
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            style={{ display: "none" }}
                            onChange={(e) => {
                              const files = Array.from(e.target.files || []);
                              if (files.length === 0) return;
                              const room = MAX_REFS - refs.length;
                              const next = files.slice(0, room);
                              Promise.all(
                                next.map(
                                  (f) =>
                                    new Promise<string | null>((resolve) => {
                                      const reader = new FileReader();
                                      reader.onload = () =>
                                        resolve(typeof reader.result === "string" ? reader.result : null);
                                      reader.onerror = () => resolve(null);
                                      reader.readAsDataURL(f);
                                    }),
                                ),
                              ).then((results) => {
                                const added = results.filter((r): r is string => Boolean(r));
                                if (added.length) setCustomProductImages([...refs, ...added]);
                              });
                              e.target.value = "";
                            }}
                          />
                        </label>
                      )}
                    </div>
                    <div style={{ fontSize: 9, color: "#555", marginTop: 8 }}>
                      {refs.length === 0
                        ? "Using listing image. Upload up to 4 reference photos to override."
                        : `Using your uploaded reference${refs.length > 1 ? "s" : ""}.`}
                    </div>
                  </div>
                </div>
              );
            })()}



            {/* Style */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.1em", color: "#3a3a3a", textTransform: "uppercase", marginBottom: 7 }}>
                Style
              </div>
              <div className="grid grid-cols-2" style={{ gap: 5 }}>
                {STYLES.map((s) => {
                  const active = aiPosterStyle === s.key;
                  return (
                    <button
                      key={s.key}
                      onClick={() => setAiPosterStyle(s.key)}
                      style={{
                        padding: "9px 8px",
                        borderRadius: 7,
                        border: active ? "0.5px solid #999" : "0.5px solid #1c1c1c",
                        background: active ? "#181818" : "#111",
                        textAlign: "left",
                      }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 500, color: active ? "#e8e8e8" : "#999" }}>
                        {s.label}
                      </div>
                      <div style={{ fontSize: 9, color: active ? "#555" : "#333", marginTop: 2 }}>
                        {s.desc}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Details */}
            <div className="flex flex-col" style={{ gap: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.1em", color: "#3a3a3a", textTransform: "uppercase" }}>
                Details
              </div>
              {[
                { label: "Price", value: posterPrice, set: (v: string) => setPosterPrice?.(v), placeholder: "EC$120" },
                { label: "Urgency", value: urgencyText, set: setUrgencyText, placeholder: "Limited Drop" },
                { label: "Tagline", value: tagline, set: setTagline, placeholder: "Saint Lucia's Plug 🇱🇨" },
                { label: "Pickup locations", value: meetupText, set: setMeetupText, placeholder: "Castries · Gros Islet · Vieux Fort" },
              ].map((f) => (
                <div key={f.label} className="flex flex-col" style={{ gap: 4 }}>
                  <label style={{ fontSize: 10, color: "#3a3a3a", letterSpacing: "0.04em" }}>{f.label}</label>
                  <input
                    type="text"
                    value={f.value}
                    placeholder={f.placeholder}
                    onChange={(e) => f.set(e.target.value)}
                    style={{
                      background: "#111",
                      border: "0.5px solid #1c1c1c",
                      borderRadius: 5,
                      color: "#bbb",
                      fontSize: 12,
                      padding: "8px 10px",
                      outline: "none",
                      width: "100%",
                    }}
                  />
                </div>
              ))}
              <div className="flex flex-col" style={{ gap: 4 }}>
                <label style={{ fontSize: 10, color: "#3a3a3a", letterSpacing: "0.04em" }}>Extra instructions</label>
                <textarea
                  value={aiPosterCustom}
                  onChange={(e) => setAiPosterCustom(e.target.value)}
                  placeholder="e.g. dramatic lighting, smoke effect..."
                  style={{
                    background: "#111",
                    border: "0.5px solid #1c1c1c",
                    borderRadius: 5,
                    color: "#bbb",
                    fontSize: 12,
                    padding: "8px 10px",
                    outline: "none",
                    width: "100%",
                    height: 52,
                    resize: "none",
                    fontFamily: "inherit",
                  }}
                />
              </div>
            </div>

            {/* Save or share — after generation */}
            {aiPosterResult && (
              <div className="flex flex-col" style={{ gap: 6 }}>
                <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.1em", color: "#3a3a3a", textTransform: "uppercase" }}>
                  Save or share
                </div>
                <button
                  onClick={handleDownload}
                  style={{
                    width: "100%",
                    padding: 12,
                    background: "#e8e8e8",
                    color: "#080808",
                    border: "none",
                    borderRadius: 7,
                    fontSize: 13,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 7,
                  }}
                >
                  <Download size={15} /> Download
                </button>
                <button
                  onClick={handleWhatsApp}
                  style={{
                    width: "100%",
                    padding: 10,
                    background: "#111",
                    color: "#ccc",
                    border: "0.5px solid #1c1c1c",
                    borderRadius: 7,
                    fontSize: 12,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 7,
                  }}
                >
                  <MessageCircle size={15} /> Share via WhatsApp
                </button>
                <div className="grid grid-cols-2" style={{ gap: 6 }}>
                  <button
                    onClick={handleCopyLink}
                    style={{
                      padding: 9,
                      background: "#111",
                      color: "#777",
                      border: "0.5px solid #1c1c1c",
                      borderRadius: 7,
                      fontSize: 11,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 5,
                    }}
                  >
                    <Copy size={12} /> Copy link
                  </button>
                  <button
                    onClick={() => navigate("/admin/content-library")}
                    style={{
                      padding: 9,
                      background: "#111",
                      color: "#777",
                      border: "0.5px solid #1c1c1c",
                      borderRadius: 7,
                      fontSize: 11,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 5,
                    }}
                  >
                    <Folder size={12} /> Save to library
                  </button>
                </div>
              </div>
            )}
          </>
        ) : currentNav === "display" ? (
          displayWired ? (
            <>
              {/* Product */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.1em", color: "#3a3a3a", textTransform: "uppercase", marginBottom: 7 }}>
                  Product
                </div>
                <div
                  className="flex items-center"
                  style={{ background: "#111", border: "0.5px solid #1c1c1c", borderRadius: 8, padding: 10, gap: 10 }}
                >
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 5,
                      background: "#161616",
                      border: "0.5px solid #222",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      overflow: "hidden",
                    }}
                  >
                    {productImage ? (
                      <img src={productImage} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <ShoppingBag size={16} color="#333" />
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: "#ccc" }} className="truncate">
                      {productName || "No product selected"}
                    </div>
                    <div style={{ fontSize: 11, color: "#555", marginTop: 1 }}>
                      Reference image
                    </div>
                  </div>
                  <button
                    onClick={onOpenProductPicker}
                    style={{
                      marginLeft: "auto",
                      fontSize: 10,
                      color: "#aaa",
                      border: "0.5px solid #1c1c1c",
                      borderRadius: 4,
                      padding: "3px 7px",
                      background: "transparent",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Change
                  </button>
                </div>
              </div>

              {/* Style */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.1em", color: "#3a3a3a", textTransform: "uppercase", marginBottom: 7 }}>
                  Style
                </div>
                <div className="grid grid-cols-2" style={{ gap: 5 }}>
                  {DISPLAY_STYLES_M.map((s) => {
                    const active = displayStyle === s.key;
                    return (
                      <button
                        key={s.key}
                        onClick={() => setDisplayStyle?.(s.key)}
                        style={{
                          padding: "9px 8px",
                          borderRadius: 7,
                          border: active ? "0.5px solid #999" : "0.5px solid #1c1c1c",
                          background: active ? "#181818" : "#111",
                          textAlign: "left",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        {s.key === "human" && (
                          <User size={13} color={active ? "#e8e8e8" : "#666"} />
                        )}
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 500, color: active ? "#e8e8e8" : "#999" }}>
                            {s.label}
                          </div>
                          <div style={{ fontSize: 9, color: active ? "#555" : "#333", marginTop: 2 }}>
                            {s.desc}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Human model sub-controls */}
              {displayStyle === "human" && (
                <>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.1em", color: "#3a3a3a", textTransform: "uppercase", marginBottom: 7 }}>
                      Model gender
                    </div>
                    <div className="flex flex-wrap" style={{ gap: 5 }}>
                      {GENDERS_M.map((g) => {
                        const active = modelGender === g.key;
                        return (
                          <button
                            key={g.key}
                            onClick={() => setModelGender?.(g.key)}
                            style={{
                              padding: "6px 10px",
                              borderRadius: 14,
                              border: active ? "0.5px solid #999" : "0.5px solid #1c1c1c",
                              background: active ? "#181818" : "#111",
                              fontSize: 11,
                              color: active ? "#e8e8e8" : "#888",
                            }}
                          >
                            {g.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.1em", color: "#3a3a3a", textTransform: "uppercase", marginBottom: 7 }}>
                      Skin tone
                    </div>
                    <div className="flex flex-wrap" style={{ gap: 5 }}>
                      {SKIN_TONES_M.map((t) => {
                        const active = skinTone === t.key;
                        return (
                          <button
                            key={t.key}
                            onClick={() => setSkinTone?.(t.key)}
                            style={{
                              padding: "6px 10px",
                              borderRadius: 14,
                              border: active ? "0.5px solid #999" : "0.5px solid #1c1c1c",
                              background: active ? "#181818" : "#111",
                              fontSize: 11,
                              color: active ? "#e8e8e8" : "#888",
                            }}
                          >
                            {t.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              {/* Aspect ratio */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.1em", color: "#3a3a3a", textTransform: "uppercase", marginBottom: 7 }}>
                  Aspect ratio
                </div>
                <div className="flex flex-wrap" style={{ gap: 5 }}>
                  {DISPLAY_FORMATS_M.map((f) => {
                    const active = displayAspect === f;
                    return (
                      <button
                        key={f}
                        onClick={() => setDisplayAspect?.(f)}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 14,
                          border: active ? "0.5px solid #888" : "0.5px solid #1c1c1c",
                          background: active ? "#e8e8e8" : "#111",
                          fontSize: 11,
                          color: active ? "#080808" : "#888",
                          fontWeight: active ? 600 : 400,
                        }}
                      >
                        {f}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Background */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.1em", color: "#3a3a3a", textTransform: "uppercase", marginBottom: 7 }}>
                  Background
                </div>
                <div className="flex flex-wrap" style={{ gap: 5 }}>
                  {BACKGROUNDS_M.map((b) => {
                    const active = displayBackground === b.key;
                    return (
                      <button
                        key={b.key}
                        onClick={() => setDisplayBackground?.(b.key)}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 14,
                          border: active ? "0.5px solid #999" : "0.5px solid #1c1c1c",
                          background: active ? "#181818" : "#111",
                          fontSize: 11,
                          color: active ? "#e8e8e8" : "#888",
                        }}
                      >
                        {b.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Details */}
              <div className="flex flex-col" style={{ gap: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.1em", color: "#3a3a3a", textTransform: "uppercase" }}>
                  Details
                </div>
                <div className="flex flex-col" style={{ gap: 4 }}>
                  <label style={{ fontSize: 10, color: "#3a3a3a", letterSpacing: "0.04em" }}>Text on image</label>
                  <input
                    type="text"
                    value={displayTextOverlay}
                    placeholder="e.g. SUMMER DROP"
                    onChange={(e) => setDisplayTextOverlay?.(e.target.value)}
                    style={{
                      background: "#111",
                      border: "0.5px solid #1c1c1c",
                      borderRadius: 5,
                      color: "#bbb",
                      fontSize: 12,
                      padding: "8px 10px",
                      outline: "none",
                      width: "100%",
                    }}
                  />
                </div>
                <div className="flex flex-col" style={{ gap: 4 }}>
                  <label style={{ fontSize: 10, color: "#3a3a3a", letterSpacing: "0.04em" }}>Additional prompt notes</label>
                  <textarea
                    value={displayCustomPrompt}
                    onChange={(e) => setDisplayCustomPrompt?.(e.target.value)}
                    placeholder="e.g. sunlit countertop, magazine photography..."
                    style={{
                      background: "#111",
                      border: "0.5px solid #1c1c1c",
                      borderRadius: 5,
                      color: "#bbb",
                      fontSize: 12,
                      padding: "8px 10px",
                      outline: "none",
                      width: "100%",
                      height: 52,
                      resize: "none",
                      fontFamily: "inherit",
                    }}
                  />
                </div>
              </div>

              {/* Save or share — after generation */}
              {displayResultUrl && (
                <div className="flex flex-col" style={{ gap: 6 }}>
                  <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.1em", color: "#3a3a3a", textTransform: "uppercase" }}>
                    Save or share
                  </div>
                  <button
                    onClick={handleDisplayDownload}
                    style={{
                      width: "100%",
                      padding: 12,
                      background: "#e8e8e8",
                      color: "#080808",
                      border: "none",
                      borderRadius: 7,
                      fontSize: 13,
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 7,
                    }}
                  >
                    <Download size={15} /> Download
                  </button>
                  <button
                    onClick={handleDisplayWhatsApp}
                    style={{
                      width: "100%",
                      padding: 10,
                      background: "#111",
                      color: "#ccc",
                      border: "0.5px solid #1c1c1c",
                      borderRadius: 7,
                      fontSize: 12,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 7,
                    }}
                  >
                    <MessageCircle size={15} /> Share via WhatsApp
                  </button>
                  <div className="grid grid-cols-2" style={{ gap: 6 }}>
                    <button
                      onClick={handleDisplayCopyLink}
                      style={{
                        padding: 9,
                        background: "#111",
                        color: "#777",
                        border: "0.5px solid #1c1c1c",
                        borderRadius: 7,
                        fontSize: 11,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 5,
                      }}
                    >
                      <Copy size={12} /> Copy link
                    </button>
                    <button
                      onClick={() => navigate("/admin/content-library")}
                      style={{
                        padding: 9,
                        background: "#111",
                        color: "#777",
                        border: "0.5px solid #1c1c1c",
                        borderRadius: 7,
                        fontSize: 11,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 5,
                      }}
                    >
                      <Folder size={12} /> Save to library
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-[#e8e8e8]">
              {displaySlot ?? (
                <div className="text-center text-xs text-[#555] py-12">Display generator unavailable.</div>
              )}
            </div>
          )
        ) : currentNav === "video" ? (
          <div className="text-[#e8e8e8]">
            {videoSlot ?? (
              <div className="text-center text-xs text-[#555] py-12">Video generator unavailable.</div>
            )}
          </div>
        ) : null}
      </div>

      {/* Sticky generate */}
      {(currentNav === "poster" || (currentNav === "display" && displayWired)) && (
        <div
          className="fixed left-0 right-0"
          style={{
            bottom: 0,
            padding: "10px 14px",
            background: "#080808",
            borderTop: "0.5px solid #1a1a1a",
            zIndex: 30,
          }}
        >
          <button
            onClick={() => {
              if (currentNav === "poster") onGenerate();
              else onGenerateDisplay?.();
            }}
            disabled={
              currentNav === "poster"
                ? aiPosterGenerating || !productName
                : displayLoading || !productName
            }
            style={{
              width: "100%",
              padding: 13,
              background: "#e8e8e8",
              color: "#080808",
              border: "none",
              borderRadius: 7,
              fontSize: 13,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              opacity:
                (currentNav === "poster" ? aiPosterGenerating || !productName : displayLoading || !productName)
                  ? 0.6
                  : 1,
            }}
          >
            {(currentNav === "poster" ? aiPosterGenerating : displayLoading) ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Generating...
              </>
            ) : currentNav === "poster" ? (
              "Generate Poster"
            ) : (
              "Generate Display Image"
            )}
          </button>
        </div>
      )}

      {/* Drawer overlay */}
      <div
        onClick={() => setDrawerOpen(false)}
        className="fixed inset-0"
        style={{
          background: "rgba(0,0,0,0.75)",
          zIndex: 40,
          opacity: drawerOpen ? 1 : 0,
          pointerEvents: drawerOpen ? "all" : "none",
          transition: "opacity 0.2s",
        }}
      />
      {/* Drawer */}
      <div
        className="fixed top-0 h-full flex flex-col"
        style={{
          right: drawerOpen ? 0 : -260,
          width: 240,
          background: "#0c0c0c",
          borderLeft: "0.5px solid #1c1c1c",
          zIndex: 50,
          transition: "right 0.22s",
        }}
      >
        <div
          className="flex items-center justify-between"
          style={{ padding: "14px 16px", borderBottom: "0.5px solid #1c1c1c" }}
        >
          <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.12em", color: "#555", textTransform: "uppercase" }}>
            Studio
          </span>
          <button
            onClick={() => setDrawerOpen(false)}
            aria-label="Close menu"
            style={{
              width: 28,
              height: 28,
              borderRadius: 5,
              border: "0.5px solid #1c1c1c",
              background: "#161616",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={14} color="#666" />
          </button>
        </div>
        <div className="flex-1" style={{ padding: 10, display: "flex", flexDirection: "column", gap: 3 }}>
          {[
            { key: "poster", icon: LayoutGrid, label: "Poster", desc: "AI marketing posters" },
            { key: "display", icon: ImageIcon, label: "Display Image", desc: "Product display shots" },
            { key: "video", icon: Play, label: "Video", desc: "Product video clips" },
            { key: "library", icon: Folder, label: "Content Library", desc: "All generated assets" },
          ].map(({ key, icon: Icon, label, desc }) => {
            const active = currentNav === key;
            return (
              <button
                key={key}
                onClick={() => selectMode(key as any)}
                className="flex items-center text-left"
                style={{
                  padding: "11px 12px",
                  borderRadius: 7,
                  border: active ? "0.5px solid #1c1c1c" : "0.5px solid transparent",
                  background: active ? "#161616" : "transparent",
                  gap: 10,
                }}
              >
                <Icon size={17} color={active ? "#d0d0d0" : "#555"} />
                <div>
                  <div
                    style={{
                      fontSize: 13,
                      color: active ? "#e0e0e0" : "#555",
                      fontWeight: active ? 500 : 400,
                    }}
                  >
                    {label}
                  </div>
                  <div style={{ fontSize: 10, color: active ? "#444" : "#2a2a2a", marginTop: 1 }}>{desc}</div>
                </div>
              </button>
            );
          })}
        </div>
        <div
          className="flex items-center justify-between"
          style={{ padding: "14px 16px", borderTop: "0.5px solid #1c1c1c" }}
        >
          <span style={{ fontSize: 10, color: "#2a2a2a" }}>Replicate</span>
          <span style={{ fontSize: 12, color: "#777", fontWeight: 500 }}>Live</span>
        </div>
      </div>

      <PosterLightbox
        open={lightboxOpen}
        src={aiPosterResult}
        onClose={() => setLightboxOpen(false)}
        showDownload
      />
      <PosterLightbox
        open={displayLightboxOpen}
        src={displayResultUrl}
        onClose={() => setDisplayLightboxOpen(false)}
        showDownload
      />
    </div>
  );
}
