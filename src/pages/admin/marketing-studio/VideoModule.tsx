import { useEffect, useRef, useState } from "react";
import {
  Shirt,
  LayoutGrid,
  User,
  Megaphone,
  Upload,
  ArrowRight,
  RefreshCw,
  Share2,
  Download,
  Play,
  Pause,
  Image as ImageIcon,
  Copy,
  Folder,
  SlidersHorizontal,
  MessageCircle,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// ----- Types -----
type VideoType = "product" | "poster" | "model" | "promo";
type MotionStyleV = "subtle" | "dynamic" | "cinematic" | "zoom" | "orbit";
type DurationV = 5 | 10;
type RatioV = "9:16" | "1:1" | "16:9" | "4:3" | "3:4" | "21:9";

const RATIOS: RatioV[] = ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"];

function ratioToWH(r: RatioV): [number, number] {
  const [w, h] = r.split(":").map(Number);
  return [w, h];
}

const VIDEO_TYPES: { id: VideoType; label: string; desc: string; Icon: any }[] = [
  { id: "product", label: "Product video", desc: "Animate product photo", Icon: Shirt },
  { id: "poster", label: "Animate poster", desc: "Bring poster to life", Icon: LayoutGrid },
  { id: "model", label: "Model video", desc: "AI model wearing product", Icon: User },
  { id: "promo", label: "Promo clip", desc: "Text + product reveal", Icon: Megaphone },
];

const MOTION_STYLES: { id: MotionStyleV; label: string }[] = [
  { id: "subtle", label: "Subtle" },
  { id: "dynamic", label: "Dynamic" },
  { id: "cinematic", label: "Cinematic" },
  { id: "zoom", label: "Zoom in" },
  { id: "orbit", label: "Orbit" },
];

const MODEL_LABEL = "kwaivgi/kling-v2.1";

export interface VideoModuleProps {
  selectedProduct: any;
  onOpenProductPicker?: () => void;
}

export default function VideoModule({ selectedProduct, onOpenProductPicker }: VideoModuleProps) {
  const productImageUrl: string | null = selectedProduct?.images?.[0]?.url ?? null;
  const productTitle: string = selectedProduct?.title ?? "Select a product";
  const productPrice: number | null = selectedProduct?.price ?? null;

  const [videoType, setVideoType] = useState<VideoType>("product");
  const [motionStyle, setMotionStyle] = useState<MotionStyleV>("subtle");
  const [duration, setDuration] = useState<DurationV>(5);
  const [aspectRatio, setAspectRatio] = useState<RatioV>("9:16");
  const [customPrompt, setCustomPrompt] = useState("");

  const [startFrame, setStartFrame] = useState<string | null>(null);
  const [endFrame, setEndFrame] = useState<string | null>(null);
  const startInputRef = useRef<HTMLInputElement | null>(null);
  const endInputRef = useRef<HTMLInputElement | null>(null);

  const [generating, setGenerating] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [lastAt, setLastAt] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(false);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>, slot: "start" | "end") {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const v = typeof reader.result === "string" ? reader.result : null;
      if (slot === "start") setStartFrame(v);
      else setEndFrame(v);
    };
    reader.onerror = () => toast.error("Failed to read file");
    reader.readAsDataURL(file);
  }

  function buildPrompt() {
    const typeLabel = VIDEO_TYPES.find((v) => v.id === videoType)?.label ?? "Product video";
    const motion = MOTION_STYLES.find((m) => m.id === motionStyle)?.label ?? "Subtle";
    const parts = [
      `${typeLabel} of ${productTitle}.`,
      `Motion style: ${motion.toLowerCase()}.`,
      customPrompt?.trim() ? customPrompt.trim() : "",
    ].filter(Boolean);
    return parts.join(" ");
  }

  const genLabel =
    videoType === "poster" ? "Animate Poster" : videoType === "model" ? "Generate Model Video" : "Generate Video";

  async function handleGenerate() {
    if (!selectedProduct) {
      toast.error("Select a product first");
      return;
    }
    setGenerating(true);
    setVideoUrl(null);
    try {
      const prompt = buildPrompt();
      const isPoster = videoType === "poster";
      const fn = isPoster ? "generate-product-poster-video" : "generate-product-video";
      const body: any = isPoster
        ? {
            posterImageUrl: startFrame ?? undefined,
            posterType: "product",
            prompt,
            duration,
            aspectRatio,
            motionStyle,
          }
        : {
            productImageUrl: startFrame ?? undefined,
            productTitle: selectedProduct.title,
            productCategory: selectedProduct.category || "",
            motionStyle,
            duration,
            aspectRatio,
            customPrompt: customPrompt?.trim() || undefined,
            videoType,
          };
      if (endFrame) body.endImageUrl = endFrame;
      const { data, error } = await supabase.functions.invoke(fn, { body });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const url = (data as any)?.videoUrl;
      if (!url) throw new Error("No video returned");
      setVideoUrl(url);
      setLastAt(Date.now());
      toast.success("Video ready");
    } catch (e: any) {
      toast.error(e?.message || "Failed to generate video");
    } finally {
      setGenerating(false);
    }
  }

  async function downloadVideo() {
    if (!videoUrl) return;
    try {
      const res = await fetch(videoUrl);
      const blob = await res.blob();
      const obj = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = obj;
      a.download = `luutslu-${videoType}-${Date.now()}.mp4`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(obj);
    } catch {
      toast.error("Failed to download video");
    }
  }

  function shareWhatsApp() {
    if (!videoUrl) return;
    const text = encodeURIComponent(`${productTitle} — generated by Luut SLU\n${videoUrl}`);
    window.open(`https://wa.me/?text=${text}`, "_blank");
  }

  function copyLink() {
    if (!videoUrl) return;
    navigator.clipboard.writeText(videoUrl);
    toast.success("Link copied");
  }

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play();
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  }

  // --- Style helpers ---
  const pill = (active: boolean) =>
    `px-2.5 py-1 rounded-md border text-[11px] cursor-pointer whitespace-nowrap transition-colors ${
      active
        ? "border-[#e8e8e8] bg-[#181818] text-[#e8e8e8]"
        : "border-[#1c1c1c] bg-[#111] text-[#555] hover:text-[#aaa]"
    }`;

  const vtCard = (active: boolean) =>
    `text-left p-2.5 rounded-lg border cursor-pointer transition-colors ${
      active ? "border-[#e8e8e8] bg-[#181818]" : "border-[#1c1c1c] bg-[#111] hover:border-[#3a3a3a]"
    }`;

  const sLabel = "mb-1.5 text-[10px] font-medium uppercase tracking-[0.1em] text-[#3a3a3a]";

  const meta = `${aspectRatio} · ${duration}s · ${
    MOTION_STYLES.find((m) => m.id === motionStyle)?.label
  } · Kling v2.1`;

  return (
    <div className="flex flex-1 overflow-hidden bg-[#080808] text-[#e8e8e8]">
      {/* ===== Sidebar ===== */}
      <aside className="w-[300px] shrink-0 overflow-y-auto border-r border-[#1c1c1c] bg-[#0c0c0c] p-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex flex-col gap-3.5 pb-6">
          {/* Product */}
          <div>
            <div className={sLabel}>Product</div>
            <div className="flex items-center gap-2.5 rounded-lg border border-[#1c1c1c] bg-[#111] p-2.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-[#222] bg-[#161616]">
                {productImageUrl ? (
                  <img src={productImageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <ImageIcon className="h-4 w-4 text-[#333]" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12px] font-medium text-[#ccc]">{productTitle}</div>
                <div className="mt-0.5 truncate text-[11px] text-[#555]">
                  {productPrice ? `EC$${Math.round(Number(productPrice))} · ` : ""}Luut SLU
                </div>
              </div>
              {onOpenProductPicker && (
                <button
                  type="button"
                  onClick={onOpenProductPicker}
                  className="whitespace-nowrap rounded border border-[#1c1c1c] bg-transparent px-1.5 py-0.5 text-[10px] text-[#555] hover:text-[#aaa]"
                >
                  Change
                </button>
              )}
            </div>
          </div>

          {/* Video type */}
          <div>
            <div className={sLabel}>Video type</div>
            <div className="grid grid-cols-2 gap-1.5">
              {VIDEO_TYPES.map((t) => {
                const active = videoType === t.id;
                const Icon = t.Icon;
                return (
                  <button key={t.id} type="button" onClick={() => setVideoType(t.id)} className={vtCard(active)}>
                    <Icon className={`mb-1 h-4 w-4 ${active ? "text-[#e8e8e8]" : "text-[#555]"}`} />
                    <div className={`text-[11px] font-medium ${active ? "text-[#e8e8e8]" : "text-[#777]"}`}>
                      {t.label}
                    </div>
                    <div className={`mt-0.5 text-[9px] ${active ? "text-[#555]" : "text-[#2a2a2a]"}`}>{t.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Start & end frames */}
          <div>
            <div className={sLabel}>Start &amp; end frames</div>
            <div className="flex items-stretch gap-2">
              <FrameSlot
                label="Start frame"
                badge="START"
                value={startFrame}
                hint="First frame of video"
                placeholder="Upload image or use product"
                onPick={() => startInputRef.current?.click()}
                onClear={() => setStartFrame(null)}
              />
              <div className="flex items-center pt-7 text-[#2a2a2a]">
                <ArrowRight className="h-4 w-4" />
              </div>
              <FrameSlot
                label="End frame"
                badge="END"
                value={endFrame}
                hint="Last frame of video"
                placeholder="Upload image (optional)"
                onPick={() => endInputRef.current?.click()}
                onClear={() => setEndFrame(null)}
              />
            </div>
            <input
              ref={startInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFile(e, "start")}
            />
            <input
              ref={endInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFile(e, "end")}
            />
          </div>

          {/* Motion style */}
          <div>
            <div className={sLabel}>Motion style</div>
            <div className="flex flex-wrap gap-1.5">
              {MOTION_STYLES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMotionStyle(m.id)}
                  className={pill(motionStyle === m.id)}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Duration & Ratio */}
          <div className="flex gap-3">
            <div className="flex-1">
              <div className={sLabel}>Duration</div>
              <div className="flex flex-wrap gap-1.5">
                {[5, 10].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDuration(d as DurationV)}
                    className={pill(duration === d)}
                  >
                    {d}s
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1">
              <div className={sLabel}>Ratio</div>
              <div className="flex flex-wrap gap-1.5">
                {RATIOS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setAspectRatio(r)}
                    className={pill(aspectRatio === r)}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Extra instructions */}
          <div>
            <div className={sLabel}>Extra instructions</div>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="e.g. slow rotation, glowing effect, product floats in..."
              className="h-[60px] w-full resize-none rounded-md border border-[#1c1c1c] bg-[#111] p-2 text-[11px] text-[#bbb] placeholder:text-[#3a3a3a] focus:border-[#3a3a3a] focus:outline-none"
            />
          </div>

          {/* Generate button */}
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating || !selectedProduct}
            className="mt-1 flex w-full items-center justify-center gap-2 rounded-md bg-[#e8e8e8] px-3 py-2.5 text-[12px] font-bold text-[#080808] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating…
              </>
            ) : (
              genLabel
            )}
          </button>
        </div>
      </aside>

      {/* ===== Canvas ===== */}
      <section className="flex flex-1 flex-col overflow-hidden bg-[#080808]">
        {/* Toolbar */}
        <div className="flex h-11 items-center gap-2 border-b border-[#111] px-4">
          <span className="text-[11px] text-[#3a3a3a]">Preview</span>
          <ToolBtn icon={<RefreshCw className="h-3 w-3" />} label="Regenerate" onClick={handleGenerate} disabled={generating} />
          <div className="ml-auto flex items-center gap-1.5">
            <ToolBtn icon={<Share2 className="h-3 w-3" />} label="Share" onClick={shareWhatsApp} disabled={!videoUrl} />
            <ToolBtn
              icon={<Download className="h-3 w-3" />}
              label="Download"
              onClick={downloadVideo}
              disabled={!videoUrl}
              variant="dl"
            />
          </div>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center gap-3.5 overflow-auto p-5">
          <div className="mb-2 flex items-center gap-4">
            <FrameThumb label="Start" src={startFrame} />
            <ArrowRight className="h-3.5 w-3.5 text-[#2a2a2a]" />
            <div
              className="relative flex flex-col items-center justify-center gap-2.5 overflow-hidden rounded-lg border border-[#1c1c1c] bg-[#0c0c0c]"
              style={{ width: 200, height: 356 }}
            >
              {videoUrl ? (
                <>
                  <video
                    ref={videoRef}
                    src={videoUrl}
                    className="h-full w-full object-cover"
                    loop
                    playsInline
                    onPlay={() => setPlaying(true)}
                    onPause={() => setPlaying(false)}
                    onClick={togglePlay}
                  />
                  <button
                    type="button"
                    onClick={togglePlay}
                    className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors hover:bg-black/30"
                    aria-label={playing ? "Pause" : "Play"}
                  >
                    {!playing && (
                      <span className="flex h-12 w-12 items-center justify-center rounded-full border border-[#2a2a2a] bg-black/50">
                        <Play className="h-5 w-5 text-white" />
                      </span>
                    )}
                  </button>
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1a1a1a]" />
                </>
              ) : (
                <>
                  <span className="flex h-12 w-12 items-center justify-center rounded-full border border-[#2a2a2a]">
                    {generating ? (
                      <Loader2 className="h-5 w-5 animate-spin text-[#666]" />
                    ) : (
                      <Play className="h-5 w-5 text-[#444]" />
                    )}
                  </span>
                  <div className="px-5 text-center text-[10px] leading-relaxed text-[#2a2a2a]">
                    {generating ? "Generating video…" : "Generate a video to preview it here"}
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1a1a1a]" />
                </>
              )}
            </div>
            <ArrowRight className="h-3.5 w-3.5 text-[#2a2a2a]" />
            <FrameThumb label="End" src={endFrame} />
          </div>
          <div className="text-center text-[10px] text-[#2a2a2a]">{meta}</div>
        </div>
      </section>

      {/* ===== Action Strip ===== */}
      <aside className="flex w-[180px] shrink-0 flex-col gap-1.5 overflow-y-auto border-l border-[#1c1c1c] bg-[#0c0c0c] px-3 py-3.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {videoUrl ? (
          <>
            <div className="mb-0.5 text-[9px] uppercase tracking-[0.1em] text-[#3a3a3a]">Ready</div>
            <div className="mb-1.5 text-[10px] leading-relaxed text-[#555]">
              {VIDEO_TYPES.find((v) => v.id === videoType)?.label}
              <br />
              {MOTION_STYLES.find((m) => m.id === motionStyle)?.label} · {aspectRatio} · {duration}s
              <br />
              <span className="text-[#3a3a3a]">Kling v2.1</span>
            </div>
            <div className="my-1 h-px bg-[#141414]" />
            <ActionBtn primary icon={<Download className="h-3 w-3" />} label="Download" onClick={downloadVideo} />
            <ActionBtn icon={<MessageCircle className="h-3 w-3" />} label="WhatsApp" onClick={shareWhatsApp} />
            <ActionBtn icon={<Copy className="h-3 w-3" />} label="Copy link" onClick={copyLink} />
            <ActionBtn icon={<Folder className="h-3 w-3" />} label="Save to library" onClick={() => toast.success("Saved")} />
            <div className="my-1 h-px bg-[#141414]" />
            <ActionBtn icon={<RefreshCw className="h-3 w-3" />} label="Regenerate" onClick={handleGenerate} />
            <ActionBtn
              icon={<SlidersHorizontal className="h-3 w-3" />}
              label="Adjust prompt"
              onClick={() => {
                const el = document.querySelector<HTMLTextAreaElement>("textarea[placeholder^='e.g. slow rotation']");
                el?.focus();
              }}
            />
          </>
        ) : (
          <div className="text-[10px] leading-relaxed text-[#3a3a3a]">
            Actions appear here once a video is ready.
          </div>
        )}
      </aside>
    </div>
  );
}

// ----- Subcomponents -----
function FrameSlot({
  label,
  badge,
  value,
  hint,
  placeholder,
  onPick,
  onClear,
}: {
  label: string;
  badge: string;
  value: string | null;
  hint: string;
  placeholder: string;
  onPick: () => void;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col gap-1.5">
      <div className="text-[10px] uppercase tracking-[0.06em] text-[#3a3a3a]">{label}</div>
      <button
        type="button"
        onClick={onPick}
        className={`relative flex aspect-[9/16] min-h-[90px] cursor-pointer flex-col items-center justify-center gap-1 rounded-md bg-[#0e0e0e] ${
          value ? "border border-solid border-[#333]" : "border border-dashed border-[#2a2a2a]"
        }`}
      >
        <span className="absolute left-1 top-1 rounded border border-[#2a2a2a] bg-[#1a1a1a] px-1.5 py-0.5 text-[8px] font-medium text-[#555]">
          {badge}
        </span>
        {value ? (
          <>
            <img src={value} alt="" className="absolute inset-0 h-full w-full rounded-md object-cover" />
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              className="absolute right-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-[8px] text-[#aaa] hover:text-white"
            >
              Clear
            </span>
          </>
        ) : (
          <>
            <Upload className="h-4 w-4 text-[#2a2a2a]" />
            <span className="px-1.5 text-center text-[9px] text-[#2a2a2a]">{placeholder}</span>
          </>
        )}
      </button>
      <div className="text-center text-[9px] leading-snug text-[#2a2a2a]">{hint}</div>
    </div>
  );
}

function FrameThumb({ label, src }: { label: string; src: string | null }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-1 overflow-hidden rounded-md border border-[#1c1c1c] bg-[#111]"
      style={{ width: 48, height: 86 }}
    >
      {src ? (
        <img src={src} alt={label} className="h-full w-full object-cover" />
      ) : (
        <>
          <ImageIcon className="h-3.5 w-3.5 text-[#2a2a2a]" />
          <span className="text-[8px] text-[#2a2a2a]">{label}</span>
        </>
      )}
    </div>
  );
}

function ToolBtn({
  icon,
  label,
  onClick,
  disabled,
  variant,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: "dl";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1.5 rounded border px-2 py-1 text-[11px] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        variant === "dl"
          ? "border-[#888] text-[#d0d0d0] hover:border-[#aaa]"
          : "border-[#1c1c1c] text-[#555] hover:text-[#aaa]"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function ActionBtn({
  icon,
  label,
  onClick,
  primary,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] transition-colors ${
        primary
          ? "border-[#e8e8e8] bg-[#e8e8e8] font-bold text-[#080808] hover:opacity-90"
          : "border-[#1c1c1c] bg-[#111] text-[#888] hover:border-[#3a3a3a] hover:text-[#e8e8e8]"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
