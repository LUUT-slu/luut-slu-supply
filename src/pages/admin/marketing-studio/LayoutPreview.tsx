import { useMemo } from "react";
import { getBrandStyleDef, getBrandStyleReferenceImage, type BrandStyle, type BrandSurface, type AspectRatio } from "@/lib/marketingRouting";

type Background =
  | "solid"
  | "gradient"
  | "studio"
  | "lifestyle"
  | "transparent"
  | "clean"
  | "luxury"
  | "bold"
  | "hype"
  | "modern"
  | "minimal";

interface LayoutPreviewProps {
  surface: BrandSurface;
  brandStyle: BrandStyle;
  productImage?: string | null;
  productTitle?: string;
  aspectRatio: AspectRatio;
  // Display-tab specific
  goal?: string;
  style?: string;
  background?: string;
  realism?: string;
  focus?: string;
  // Poster-tab specific
  campaign?: string;
  headline?: string;
  subheadline?: string;
  priceText?: string;
  ctaText?: string;
  brandName?: string;
}

const ASPECT_RATIO_CLASS: Record<AspectRatio, string> = {
  "1:1": "aspect-square",
  "4:5": "aspect-[4/5]",
  "9:16": "aspect-[9/16]",
  "16:9": "aspect-[16/9]",
  "3:4": "aspect-[3/4]",
};

// Style-driven background classes (CSS only mockup).
function bgClasses(style?: string, background?: string, surface?: BrandSurface): string {
  const key = surface === "poster" ? style : background || style;
  switch (key) {
    case "studio":
      return "bg-gradient-to-b from-neutral-100 to-neutral-300";
    case "lifestyle":
      return "bg-gradient-to-br from-amber-50 via-rose-100 to-orange-200";
    case "solid":
      return "bg-neutral-200";
    case "gradient":
      return "bg-gradient-to-tr from-indigo-200 via-fuchsia-200 to-amber-200";
    case "transparent":
      return "bg-[conic-gradient(at_0_0,_#e5e5e5_25%,_#fff_25%_50%,_#e5e5e5_50%_75%,_#fff_75%)] bg-[length:16px_16px]";
    case "minimal":
    case "clean":
      return "bg-neutral-50";
    case "luxury":
      return "bg-gradient-to-br from-stone-900 via-stone-800 to-amber-900";
    case "bold":
      return "bg-gradient-to-br from-red-500 via-orange-500 to-yellow-400";
    case "hype":
      return "bg-gradient-to-br from-fuchsia-600 via-purple-600 to-indigo-700";
    case "modern":
      return "bg-gradient-to-br from-sky-100 to-slate-300";
    default:
      return "bg-neutral-100";
  }
}

function isDarkBg(style?: string, background?: string, surface?: BrandSurface): boolean {
  const key = surface === "poster" ? style : background || style;
  return key === "luxury" || key === "bold" || key === "hype";
}

// Product image sizing/positioning by focus or goal.
function productScale(focus?: string, goal?: string): { size: string; shadow: string } {
  if (focus === "detail" || focus === "texture" || goal === "product_closeup") {
    return { size: "h-[78%] w-[78%]", shadow: "drop-shadow-2xl" };
  }
  if (focus === "hero_angle" || goal === "product_hero") {
    return { size: "h-[70%] w-[70%]", shadow: "drop-shadow-2xl" };
  }
  if (focus === "packaging" || goal === "packaging_showcase") {
    return { size: "h-[55%] w-[55%]", shadow: "drop-shadow-xl" };
  }
  if (goal === "lifestyle_product" || goal === "human_model") {
    return { size: "h-[50%] w-[50%]", shadow: "drop-shadow-xl" };
  }
  return { size: "h-[60%] w-[60%]", shadow: "drop-shadow-xl" };
}

export default function LayoutPreview(props: LayoutPreviewProps) {
  const {
    surface,
    brandStyle,
    productImage,
    productTitle,
    aspectRatio,
    goal,
    style,
    background,
    realism,
    focus,
    campaign,
    headline,
    subheadline,
    priceText,
    ctaText,
    brandName,
  } = props;

  const brandDef = useMemo(() => getBrandStyleDef(brandStyle), [brandStyle]);
  const brandRef = useMemo(
    () => getBrandStyleReferenceImage(brandStyle, surface),
    [brandStyle, surface],
  );

  const aspectClass = ASPECT_RATIO_CLASS[aspectRatio] || "aspect-square";
  const bg = bgClasses(style, background, surface);
  const dark = isDarkBg(style, background, surface);
  const text = dark ? "text-white" : "text-neutral-900";
  const { size, shadow } = productScale(focus, goal);

  const realismRing =
    realism === "hyper" || realism === "luxury"
      ? "ring-1 ring-black/10"
      : "";

  return (
    <div className="space-y-2">
      <div
        className={`relative w-full overflow-hidden rounded-lg border ${aspectClass} ${bg} ${realismRing}`}
      >
        {/* Brand style color tint overlay */}
        {brandRef && (
          <div
            className="pointer-events-none absolute inset-0 opacity-25 mix-blend-overlay"
            style={{
              backgroundImage: `url(${brandRef})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              filter: "blur(18px) saturate(1.2)",
            }}
            aria-hidden
          />
        )}

        {/* Studio backdrop floor */}
        {(background === "studio" || style === "studio") && (
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-black/15 to-transparent" />
        )}

        {/* Poster headline area */}
        {surface === "poster" && (
          <div className={`absolute left-0 right-0 top-0 z-10 px-3 pt-3 ${text}`}>
            {headline && (
              <div className="truncate text-[clamp(14px,4vw,28px)] font-black uppercase leading-none tracking-tight">
                {headline}
              </div>
            )}
            {subheadline && (
              <div className="mt-1 truncate text-[10px] opacity-80">{subheadline}</div>
            )}
          </div>
        )}

        {/* Product */}
        <div className="absolute inset-0 flex items-center justify-center">
          {productImage ? (
            <img
              src={productImage}
              alt={productTitle || "product"}
              className={`${size} object-contain ${shadow}`}
              draggable={false}
            />
          ) : (
            <div
              className={`${size} flex items-center justify-center rounded border border-dashed ${
                dark ? "border-white/40 text-white/60" : "border-black/30 text-black/50"
              } text-[10px]`}
            >
              Product
            </div>
          )}
        </div>

        {/* Human silhouette hint */}
        {(goal === "human_model" || style === "human") && (
          <div className="pointer-events-none absolute bottom-0 left-2 h-[70%] w-1/3 rounded-t-full bg-black/15" />
        )}

        {/* Poster bottom block: price + CTA */}
        {surface === "poster" && (priceText || ctaText || brandName) && (
          <div className={`absolute bottom-0 left-0 right-0 z-10 flex items-end justify-between px-3 pb-3 ${text}`}>
            <div>
              {priceText && (
                <div className="text-[clamp(12px,3.5vw,22px)] font-extrabold leading-none">
                  {priceText}
                </div>
              )}
              {brandName && (
                <div className="mt-1 text-[9px] uppercase tracking-[0.2em] opacity-70">
                  {brandName}
                </div>
              )}
            </div>
            {ctaText && (
              <div
                className={`rounded-full px-3 py-1 text-[10px] font-semibold ${
                  dark ? "bg-white text-black" : "bg-black text-white"
                }`}
              >
                {ctaText}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground">
        <span className="rounded bg-muted px-1.5 py-0.5">{aspectRatio}</span>
        {style && <span className="rounded bg-muted px-1.5 py-0.5">style: {style}</span>}
        {background && <span className="rounded bg-muted px-1.5 py-0.5">bg: {background}</span>}
        {goal && <span className="rounded bg-muted px-1.5 py-0.5">{goal.replace(/_/g, " ")}</span>}
        {focus && <span className="rounded bg-muted px-1.5 py-0.5">focus: {focus}</span>}
        {realism && <span className="rounded bg-muted px-1.5 py-0.5">{realism}</span>}
        {campaign && <span className="rounded bg-muted px-1.5 py-0.5">{campaign}</span>}
        {brandDef && brandDef.key !== "default" && (
          <span className="rounded bg-muted px-1.5 py-0.5">brand: {brandDef.label}</span>
        )}
      </div>
      <p className="text-[10px] italic text-muted-foreground">
        Mockup preview — not a generated image. Updates live as you change settings.
      </p>
    </div>
  );
}
