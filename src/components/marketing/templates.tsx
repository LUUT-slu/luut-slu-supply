import { forwardRef } from "react";
import type { PosterPreset } from "@/lib/marketingPresets";
import { densityScale } from "@/lib/marketingPresets";

export type TemplateStyle = "clean" | "hype" | "minimal";
export type TemplateFormat = "story" | "post" | "ad" | "portrait";

// Format poster prices: no decimal places, EC$ prefix.
export function formatPosterPrice(amount?: string | number): string {
  if (amount === undefined || amount === null || amount === "") return "";
  const n = Number(amount);
  if (Number.isNaN(n)) return "";
  return `EC$${Math.round(n)}`;
}

export interface VariantImage {
  url: string;
  label?: string;
}

export interface TemplateProps {
  style?: TemplateStyle;
  format: TemplateFormat;
  productName: string;
  productImage?: string;
  price?: string;
  showPrice: boolean;
  description?: string;
  tagline?: string;
  stockBadge?: string;
  brandName: string;
  brandLogoUrl?: string;
  meetupText: string;
  ctaText: string;
  urgencyText?: string;
  variantImages?: VariantImage[];
  showVariantLabels?: boolean;
  preset?: PosterPreset;
}

const SIZE: Record<TemplateFormat, { w: number; h: number }> = {
  story: { w: 1080, h: 1920 },
  post: { w: 1080, h: 1080 },
  ad: { w: 1200, h: 628 },
  portrait: { w: 1080, h: 1350 },
};

export const TEMPLATE_SIZE = SIZE;

// ---------------- Multi-product (content-engine) template ----------------

export interface MultiProductItem {
  id: string;
  title: string;
  imageUrl?: string;
  price?: string;
  badge?: string;
  hint?: string;
}

export interface MultiTemplateProps {
  style?: TemplateStyle;
  format: TemplateFormat;
  headline: string;
  subhead?: string;
  products: MultiProductItem[];
  brandName: string;
  brandLogoUrl?: string;
  meetupText: string;
  ctaText: string;
  urgencyText?: string;
  showPrice: boolean;
  showBadges: boolean;
  showLabels: boolean;
  preset?: PosterPreset;
}

// Convert a PosterPreset palette/background into the legacy PosterTheme
// shape used by ProductGrid + Ribbon, so the existing render code keeps
// working unchanged.
function presetToTheme(preset: PosterPreset): PosterTheme {
  const { palette, background } = preset;
  const accent = palette.accent;
  const glow = palette.glow;
  // Background renderers
  let bgVignette = `radial-gradient(ellipse at center, ${shade(palette.bg, -2)} 0%, ${palette.bg} 55%, ${shade(palette.bg, -8)} 100%)`;
  if (background.type === "dark") {
    bgVignette = palette.bg;
  } else if (background.type === "minimal") {
    bgVignette = palette.bg;
  } else if (background.type === "gradient") {
    bgVignette = `linear-gradient(135deg, ${palette.bg} 0%, ${shade(palette.bg, -6)} 100%)`;
  }
  // Ribbon + CTA gradients derived from accent
  const ribbon = `linear-gradient(180deg, ${accent} 0%, ${shade(accent, -15)} 60%, ${shade(accent, -35)} 100%)`;
  const cta = ribbon;
  return {
    glow: accent,
    glowSoft: glow,
    ribbon,
    ribbonText: contrastText(accent),
    cta,
    ctaText: contrastText(accent),
    bgVignette,
    divider: `linear-gradient(90deg,transparent 0%,${accent} 25%,${tint(accent, 60)} 50%,${accent} 75%,transparent 100%)`,
    badge: `linear-gradient(180deg,${accent},${shade(accent, -25)})`,
  };
}

// Lightweight color helpers (hex only — rgba passes through).
function hexToRgb(hex: string): [number, number, number] | null {
  let h = hex.trim().replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (h.length !== 6) return null;
  const n = parseInt(h, 16);
  if (isNaN(n)) return null;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHex(r: number, g: number, b: number): string {
  return (
    "#" +
    [r, g, b]
      .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0"))
      .join("")
  );
}
function shade(color: string, percent: number): string {
  const rgb = hexToRgb(color);
  if (!rgb) return color;
  const f = 1 + percent / 100;
  return rgbToHex(rgb[0] * f, rgb[1] * f, rgb[2] * f);
}
function tint(color: string, amount: number): string {
  const rgb = hexToRgb(color);
  if (!rgb) return color;
  return rgbToHex(rgb[0] + amount, rgb[1] + amount, rgb[2] + amount);
}
function contrastText(bg: string): string {
  const rgb = hexToRgb(bg);
  if (!rgb) return "#ffffff";
  const yiq = (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000;
  return yiq >= 160 ? "#0a0a0a" : "#ffffff";
}

// Theme palette per poster intent. Picked from `urgencyText`/`headline` keywords
// so the reference's "green glow" / "red glow" aesthetic auto-applies.
interface PosterTheme {
  glow: string; // primary accent (price chips, headline highlight, glow color)
  glowSoft: string; // halo
  ribbon: string; // CTA ribbon background gradient
  ribbonText: string;
  cta: string; // CTA button gradient
  ctaText: string;
  bgVignette: string; // radial vignette behind tiles
  divider: string; // horizontal glowing divider under headline
  badge: string; // per-tile badge gradient
}

function pickTheme(headline: string, urgency?: string): PosterTheme {
  const probe = `${headline} ${urgency ?? ""}`.toUpperCase();

  // Almost gone / low-stock / urgency → red-orange ember
  if (/ALMOST|GONE|LIMITED|LOW|HURRY|LAST/.test(probe)) {
    return {
      glow: "#ff7a18",
      glowSoft: "rgba(255,90,20,0.55)",
      ribbon: "linear-gradient(180deg,#ffd166 0%,#f5a300 55%,#c97400 100%)",
      ribbonText: "#1a0a00",
      cta: "linear-gradient(180deg,#ff8a3d 0%,#ff5b14 60%,#c93b00 100%)",
      ctaText: "#ffffff",
      bgVignette:
        "radial-gradient(ellipse at center,#3a1408 0%,#160604 55%,#070302 100%)",
      divider:
        "linear-gradient(90deg,transparent 0%,#ff8a3d 25%,#ffd28a 50%,#ff8a3d 75%,transparent 100%)",
      badge: "linear-gradient(180deg,#ff8a3d,#d83f00)",
    };
  }

  // Best sellers / top picks / most ordered → green neon
  if (/BEST|TOP|MOST|PICKS|HOT|TRENDING/.test(probe)) {
    return {
      glow: "#39ff7a",
      glowSoft: "rgba(57,255,122,0.55)",
      ribbon: "linear-gradient(180deg,#39ff7a 0%,#19c45a 60%,#0d8a3e 100%)",
      ribbonText: "#03190b",
      cta: "linear-gradient(180deg,#27e068 0%,#0fa84a 60%,#0a7a36 100%)",
      ctaText: "#ffffff",
      bgVignette:
        "radial-gradient(ellipse at center,#06140c 0%,#040806 55%,#020302 100%)",
      divider:
        "linear-gradient(90deg,transparent 0%,#39ff7a 25%,#cfffd8 50%,#39ff7a 75%,transparent 100%)",
      badge: "linear-gradient(180deg,#39ff7a,#0fa84a)",
    };
  }

  // New / drop / arrivals → cyan-electric
  if (/NEW|DROP|ARRIVAL|FRESH|JUST/.test(probe)) {
    return {
      glow: "#22d3ff",
      glowSoft: "rgba(34,211,255,0.55)",
      ribbon: "linear-gradient(180deg,#7df3ff 0%,#22d3ff 55%,#0090b8 100%)",
      ribbonText: "#04161c",
      cta: "linear-gradient(180deg,#39e0ff 0%,#0aa6d6 60%,#066f90 100%)",
      ctaText: "#ffffff",
      bgVignette:
        "radial-gradient(ellipse at center,#06181f 0%,#040a0f 55%,#020405 100%)",
      divider:
        "linear-gradient(90deg,transparent 0%,#22d3ff 25%,#cdf6ff 50%,#22d3ff 75%,transparent 100%)",
      badge: "linear-gradient(180deg,#39e0ff,#0aa6d6)",
    };
  }

  // Sale / promo / discount → magenta-gold
  if (/SALE|PROMO|DISCOUNT|OFF|DEAL/.test(probe)) {
    return {
      glow: "#ffcf3a",
      glowSoft: "rgba(255,90,140,0.5)",
      ribbon: "linear-gradient(180deg,#ffe48a 0%,#ffcf3a 55%,#c98a00 100%)",
      ribbonText: "#1a0a00",
      cta: "linear-gradient(180deg,#ff5fa0 0%,#d63076 60%,#8a1a4d 100%)",
      ctaText: "#ffffff",
      bgVignette:
        "radial-gradient(ellipse at center,#1a0a14 0%,#0a0508 55%,#040203 100%)",
      divider:
        "linear-gradient(90deg,transparent 0%,#ffcf3a 25%,#fff2c2 50%,#ffcf3a 75%,transparent 100%)",
      badge: "linear-gradient(180deg,#ff5fa0,#d63076)",
    };
  }

  // Restocked / back in stock → violet
  if (/RESTOCK|BACK|STOCK/.test(probe)) {
    return {
      glow: "#a78bfa",
      glowSoft: "rgba(167,139,250,0.55)",
      ribbon: "linear-gradient(180deg,#c4b5fd 0%,#8b5cf6 55%,#5b21b6 100%)",
      ribbonText: "#0e0623",
      cta: "linear-gradient(180deg,#a78bfa 0%,#7c3aed 60%,#4c1d95 100%)",
      ctaText: "#ffffff",
      bgVignette:
        "radial-gradient(ellipse at center,#120a22 0%,#070414 55%,#030108 100%)",
      divider:
        "linear-gradient(90deg,transparent 0%,#a78bfa 25%,#e9e2ff 50%,#a78bfa 75%,transparent 100%)",
      badge: "linear-gradient(180deg,#a78bfa,#7c3aed)",
    };
  }

  // Default → neutral neon green (matches BEST SELLERS reference)
  return {
    glow: "#39ff7a",
    glowSoft: "rgba(57,255,122,0.45)",
    ribbon: "linear-gradient(180deg,#39ff7a 0%,#19c45a 60%,#0d8a3e 100%)",
    ribbonText: "#03190b",
    cta: "linear-gradient(180deg,#27e068 0%,#0fa84a 60%,#0a7a36 100%)",
    ctaText: "#ffffff",
    bgVignette:
      "radial-gradient(ellipse at center,#0a0f0c 0%,#050706 55%,#020303 100%)",
    divider:
      "linear-gradient(90deg,transparent 0%,#39ff7a 25%,#cfffd8 50%,#39ff7a 75%,transparent 100%)",
    badge: "linear-gradient(180deg,#39ff7a,#0fa84a)",
  };
}

export const MultiProductTemplate = forwardRef<HTMLDivElement, MultiTemplateProps>(
  function MultiProductTemplate(props, ref) {
    const { format } = props;
    const { w, h } = SIZE[format];

    const theme = props.preset ? presetToTheme(props.preset) : pickTheme(props.headline, props.urgencyText);
    const dscale = densityScale(props.preset?.layout.density ?? "normal");
    const isStory = format === "story";
    const isAd = format === "ad";
    const isPortrait = format === "portrait";
    const basePad = isStory || isPortrait ? 56 : isAd ? 40 : 52;
    const padding = `${Math.round(basePad * dscale.pad)}px`;

    // Split headline into two words to color the second one with the glow,
    // matching the reference (e.g. "BEST SELLERS" → "BEST" white, "SELLERS" green)
    const headlineParts = props.headline.trim().split(/\s+/);
    const firstWord = headlineParts[0] ?? "";
    const restWords = headlineParts.slice(1).join(" ");

    const tScale = props.preset?.typography.scale ?? 1;
    const headlineSize = Math.round((isStory ? 110 : isAd ? 64 : isPortrait ? 96 : 86) * tScale);
    const headlineWeight = props.preset?.typography.headlineWeight ?? 900;
    const headlineCase = props.preset?.typography.headlineCase ?? "upper";
    const ctaShape = props.preset?.cta.shape ?? "pill";
    const ctaFill = props.preset?.cta.fill ?? "glow";
    const gridGap = Math.round((props.preset?.layout.gridGap ?? 18) * dscale.gap);
    const textColor = props.preset?.palette.text ?? "#ffffff";
    const mutedColor = props.preset?.palette.muted ?? "rgba(255,255,255,0.7)";

    const showHalos = !props.preset || props.preset.background.type === "glow";

    return (
      <div
        ref={ref}
        style={{
          width: `${w}px`,
          height: `${h}px`,
          position: "relative",
          overflow: "hidden",
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          background: theme.bgVignette,
          color: textColor,
          padding,
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Top + bottom glowing halos (only on glow backgrounds) */}
        {showHalos && (
          <>
            <div
              style={{
                position: "absolute",
                top: -260,
                left: "50%",
                transform: "translateX(-50%)",
                width: "120%",
                height: 520,
                background: `radial-gradient(ellipse at center, ${theme.glowSoft} 0%, transparent 60%)`,
                filter: "blur(20px)",
                pointerEvents: "none",
              }}
            />
            <div
              style={{
                position: "absolute",
                bottom: -260,
                left: "50%",
                transform: "translateX(-50%)",
                width: "120%",
                height: 520,
                background: `radial-gradient(ellipse at center, ${theme.glowSoft} 0%, transparent 60%)`,
                filter: "blur(20px)",
                pointerEvents: "none",
              }}
            />
          </>
        )}

        {/* Headline + glowing divider above */}
        <div style={{ position: "relative", zIndex: 2, textAlign: "center" }}>
          <div
            style={{
              height: 6,
              borderRadius: 999,
              background: theme.divider,
              filter: `drop-shadow(0 0 18px ${theme.glow})`,
              marginBottom: isStory ? 26 : 18,
            }}
          />
          <div
            style={{
              fontSize: headlineSize,
              fontWeight: headlineWeight,
              lineHeight: 0.92,
              letterSpacing: "-0.02em",
              textTransform: headlineCase === "upper" ? "uppercase" : "none",
              color: textColor,
              textShadow: "0 4px 18px rgba(0,0,0,0.4)",
            }}
          >
            <span>{firstWord}</span>
            {restWords && (
              <>
                {" "}
                <span
                  style={{
                    background: `linear-gradient(180deg, ${theme.glow} 0%, ${theme.glow} 60%, ${textColor} 100%)`,
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                    filter: `drop-shadow(0 0 18px ${theme.glowSoft})`,
                  }}
                >
                  {restWords}
                </span>
              </>
            )}
          </div>
          {props.subhead && (
            <div
              style={{
                marginTop: 12,
                fontSize: isStory ? 24 : 20,
                color: mutedColor,
                fontWeight: 600,
                letterSpacing: 1.5,
                textTransform: "uppercase",
              }}
            >
              {props.subhead}
            </div>
          )}
        </div>

        {/* Product grid */}
        <div
          style={{
            position: "relative",
            zIndex: 2,
            flex: 1,
            minHeight: 0,
            marginTop: isStory ? 36 : 24,
            marginBottom: isStory ? 28 : 20,
          }}
        >
          <ProductGrid
            items={props.products}
            theme={theme}
            showPrice={props.showPrice}
            showBadges={props.showBadges}
            showLabels={props.showLabels}
            preset={props.preset}
            gap={gridGap}
          />
        </div>

        {/* Optional ribbon (urgency) */}
        {props.urgencyText && (
          <div
            style={{
              position: "relative",
              zIndex: 2,
              alignSelf: "center",
              marginBottom: 16,
            }}
          >
            <Ribbon text={props.urgencyText} theme={theme} small={isAd} />
          </div>
        )}

        {/* Meetup line */}
        <div
          style={{
            position: "relative",
            zIndex: 2,
            textAlign: "center",
            color: mutedColor,
            fontSize: isAd ? 18 : 22,
            fontWeight: 600,
            marginBottom: 14,
          }}
        >
          <span style={{ color: theme.glow, marginRight: 6 }}>📍</span>
          {props.meetupText}
        </div>

        {/* CTA — shape & fill driven by preset */}
        <div
          style={{
            position: "relative",
            zIndex: 2,
            display: "flex",
            justifyContent: "center",
          }}
        >
          <PresetCTA
            text={props.ctaText}
            theme={theme}
            shape={ctaShape}
            fill={ctaFill}
            small={isAd}
          />
        </div>

        {/* Brand line */}
        <div
          style={{
            position: "relative",
            zIndex: 2,
            marginTop: 18,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          {props.brandLogoUrl ? (
            <img
              src={props.brandLogoUrl}
              crossOrigin="anonymous"
              alt=""
              style={{ height: isAd ? 28 : 38, width: "auto", objectFit: "contain" }}
            />
          ) : (
            <div
              style={{
                fontSize: isAd ? 16 : 20,
                fontWeight: 700,
                letterSpacing: 6,
                textTransform: "uppercase",
                color: mutedColor,
              }}
            >
              {props.brandName}
            </div>
          )}
        </div>
      </div>
    );
  },
);

// CTA renderer that respects preset shape + fill.
function PresetCTA({
  text,
  theme,
  shape,
  fill,
  small,
}: {
  text: string;
  theme: PosterTheme;
  shape: "pill" | "block" | "outline";
  fill: "glow" | "solid" | "outline";
  small?: boolean;
}) {
  const radius = shape === "pill" ? 999 : shape === "block" ? 12 : 16;
  const isOutline = fill === "outline" || shape === "outline";
  const bg = isOutline ? "transparent" : theme.cta;
  const border = isOutline ? `3px solid ${theme.glow}` : "none";
  const color = isOutline ? theme.glow : theme.ctaText;
  const shadow =
    fill === "glow" && !isOutline
      ? `0 0 32px ${theme.glowSoft}, inset 0 -4px 0 rgba(0,0,0,0.25)`
      : "none";
  return (
    <div
      style={{
        background: bg,
        border,
        color,
        padding: small ? "12px 32px" : "20px 56px",
        borderRadius: radius,
        fontSize: small ? 22 : 30,
        fontWeight: 900,
        letterSpacing: 2,
        textAlign: "center",
        textTransform: "uppercase",
        boxShadow: shadow,
        minWidth: small ? 280 : 420,
      }}
    >
      {text}
    </div>
  );
}

function Ribbon({
  text,
  theme,
  small,
}: {
  text: string;
  theme: PosterTheme;
  small?: boolean;
}) {
  const padY = small ? 10 : 14;
  const padX = small ? 28 : 44;
  const notch = small ? 16 : 22;
  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <div
        style={{
          background: theme.ribbon,
          color: theme.ribbonText,
          padding: `${padY}px ${padX + notch}px`,
          fontSize: small ? 20 : 28,
          fontWeight: 900,
          letterSpacing: 2,
          textTransform: "uppercase",
          clipPath: `polygon(${notch}px 0, calc(100% - ${notch}px) 0, 100% 50%, calc(100% - ${notch}px) 100%, ${notch}px 100%, 0 50%)`,
          boxShadow: `0 0 28px ${theme.glowSoft}`,
        }}
      >
        {text}
      </div>
    </div>
  );
}

function ProductGrid({
  items,
  theme,
  showPrice,
  showBadges,
  showLabels,
  preset,
  gap = 18,
}: {
  items: MultiProductItem[];
  theme: PosterTheme;
  showPrice: boolean;
  showBadges: boolean;
  showLabels: boolean;
  preset?: PosterPreset;
  gap?: number;
}) {
  const tiles = items.slice(0, 4);
  const overflow = items.length - tiles.length;
  const count = tiles.length;

  let columns = "1fr 1fr";
  let rows = "1fr 1fr";
  if (count === 1) {
    columns = "1fr";
    rows = "1fr";
  } else if (count === 2) {
    columns = "1fr 1fr";
    rows = "1fr";
  } else if (count === 3) {
    columns = "1fr 1fr";
    rows = "1fr 1fr";
  }

  const tileRadius = preset?.layout.radius ?? 22;
  const innerRadius = Math.max(8, tileRadius - 8);
  const tileBg = preset?.palette.surface ?? "rgba(255,255,255,0.04)";
  const titleColor = preset?.palette.text ?? "#ffffff";
  const badgeShape = preset?.badge.shape ?? "pill";
  const badgeFill = preset?.badge.fill ?? "glow";

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "grid",
        gridTemplateColumns: columns,
        gridTemplateRows: rows,
        gap,
      }}
    >
      {tiles.map((item, i) => {
        const spanFull = count === 3 && i === 0;
        return (
          <div
            key={item.id}
            style={{
              gridColumn: spanFull ? "1 / span 2" : "auto",
              position: "relative",
              borderRadius: tileRadius,
              background: tileBg,
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: `0 0 22px ${theme.glowSoft}, 0 12px 28px rgba(0,0,0,0.45)`,
              padding: 14,
              display: "flex",
              flexDirection: "column",
              gap: 10,
              overflow: "hidden",
            }}
          >
            {/* Image area (rounded inner card) */}
            <div
              style={{
                position: "relative",
                flex: 1,
                minHeight: 0,
                borderRadius: innerRadius,
                overflow: "hidden",
                background: "#f3f3f3",
              }}
            >
              {item.imageUrl ? (
                <img
                  src={item.imageUrl}
                  crossOrigin="anonymous"
                  alt=""
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                  }}
                />
              ) : (
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#999",
                    fontSize: 22,
                  }}
                >
                  No image
                </div>
              )}

              {/* Badge top-left — preset-driven shape & fill */}
              {showBadges && item.badge && (
                <PresetBadge
                  text={item.badge}
                  theme={theme}
                  shape={badgeShape}
                  fill={badgeFill}
                />
              )}

              {/* Overflow chip top-right on last tile */}
              {overflow > 0 && i === tiles.length - 1 && (
                <div
                  style={{
                    position: "absolute",
                    top: 12,
                    right: 12,
                    background: "#0a0a0a",
                    color: "#ffffff",
                    padding: "6px 14px",
                    borderRadius: 999,
                    fontSize: 18,
                    fontWeight: 900,
                  }}
                >
                  +{overflow}
                </div>
              )}
            </div>

            {/* Title */}
            {showLabels && item.title && (
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 800,
                  color: titleColor,
                  letterSpacing: 0.5,
                  textTransform: "uppercase",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  lineHeight: 1.1,
                }}
              >
                {item.title}
              </div>
            )}

            {/* Price chip */}
            {showPrice && item.price && (
              <div
                style={{
                  alignSelf: "flex-start",
                  background: theme.glow,
                  color: contrastTextSafe(theme.glow),
                  padding: "8px 16px",
                  borderRadius: 10,
                  fontSize: 22,
                  fontWeight: 900,
                  letterSpacing: 0.5,
                  boxShadow: `0 0 18px ${theme.glowSoft}`,
                }}
              >
                {formatPosterPrice(item.price)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function contrastTextSafe(c: string): string {
  if (!c.startsWith("#")) return "#0a0a0a";
  return contrastText(c);
}

// Preset-aware tile badge.
function PresetBadge({
  text,
  theme,
  shape,
  fill,
}: {
  text: string;
  theme: PosterTheme;
  shape: "pill" | "ribbon" | "chip";
  fill: "glow" | "solid" | "outline";
}) {
  const isOutline = fill === "outline";
  const radius = shape === "pill" ? 999 : shape === "chip" ? 6 : 4;
  const padding =
    shape === "ribbon" ? "6px 18px 6px 14px" : shape === "chip" ? "5px 10px" : "6px 14px";
  const clip =
    shape === "ribbon"
      ? "polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%)"
      : undefined;
  const bg = isOutline ? "transparent" : theme.badge;
  const border = isOutline ? `2px solid ${theme.glow}` : "none";
  const color = isOutline ? theme.glow : "#ffffff";
  return (
    <div
      style={{
        position: "absolute",
        top: 12,
        left: 12,
        background: bg,
        border,
        color,
        padding,
        borderRadius: radius,
        clipPath: clip,
        fontSize: 16,
        fontWeight: 900,
        letterSpacing: 1.5,
        textTransform: "uppercase",
        boxShadow: fill === "glow" ? `0 0 14px ${theme.glowSoft}` : "none",
      }}
    >
      {text}
    </div>
  );
}

// ---------------- Single-product template (existing) ----------------

export const MarketingTemplate = forwardRef<HTMLDivElement, TemplateProps>(
  function MarketingTemplate(props, ref) {
    const { format, style } = props;
    const { w, h } = SIZE[format];

    return (
      <div
        ref={ref}
        style={{
          width: `${w}px`,
          height: `${h}px`,
          position: "relative",
          overflow: "hidden",
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        {style === "clean" && <CleanLayout {...props} />}
        {style === "hype" && <HypeLayout {...props} />}
        {style === "minimal" && <MinimalLayout {...props} />}
      </div>
    );
  }
);

function BrandMark({
  brandName,
  brandLogoUrl,
  dark,
  size = 80,
}: {
  brandName: string;
  brandLogoUrl?: string;
  dark?: boolean;
  size?: number;
}) {
  if (brandLogoUrl) {
    return (
      <img
        src={brandLogoUrl}
        crossOrigin="anonymous"
        alt=""
        style={{ height: size, width: "auto", objectFit: "contain", display: "block" }}
      />
    );
  }
  return (
    <div
      style={{
        fontSize: 22,
        fontWeight: 700,
        letterSpacing: 4,
        textTransform: "uppercase",
        color: dark ? "rgba(255,255,255,0.85)" : "#666",
      }}
    >
      {brandName}
    </div>
  );
}

function VariantGrid({
  images,
  showLabels,
  dark,
}: {
  images: VariantImage[];
  showLabels?: boolean;
  dark?: boolean;
}) {
  const tiles = images.slice(0, 4);
  const overflow = images.length - tiles.length;
  const count = tiles.length;

  let columns = "1fr 1fr";
  let rows = "1fr 1fr";
  if (count === 2) {
    columns = "1fr 1fr";
    rows = "1fr";
  }

  const labelBg = dark ? "rgba(0,0,0,0.6)" : "rgba(255,255,255,0.9)";
  const labelColor = dark ? "#fff" : "#0a0a0a";

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        display: "grid",
        gridTemplateColumns: columns,
        gridTemplateRows: rows,
        gap: 10,
      }}
    >
      {tiles.map((v, i) => {
        const spanFull = count === 3 && i === 0;
        return (
          <div
            key={i}
            style={{
              gridColumn: spanFull ? "1 / span 2" : "auto",
              position: "relative",
              overflow: "hidden",
              borderRadius: 18,
              background: dark ? "rgba(255,255,255,0.06)" : "#f4f4f4",
            }}
          >
            <img
              src={v.url}
              crossOrigin="anonymous"
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
            {showLabels && v.label && (
              <div
                style={{
                  position: "absolute",
                  left: 12,
                  bottom: 12,
                  background: labelBg,
                  color: labelColor,
                  padding: "6px 14px",
                  borderRadius: 999,
                  fontSize: 22,
                  fontWeight: 700,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                }}
              >
                {v.label}
              </div>
            )}
            {overflow > 0 && i === tiles.length - 1 && (
              <div
                style={{
                  position: "absolute",
                  right: 12,
                  top: 12,
                  background: "#0a0a0a",
                  color: "#fff",
                  padding: "6px 14px",
                  borderRadius: 999,
                  fontSize: 22,
                  fontWeight: 800,
                }}
              >
                +{overflow}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function CleanLayout(p: TemplateProps) {
  const isStory = p.format === "story";
  const isAd = p.format === "ad";
  const isPortrait = p.format === "portrait";
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "#ffffff",
        color: "#0a0a0a",
        display: "flex",
        flexDirection: isAd ? "row" : "column",
        padding: isStory || isPortrait ? "80px 60px" : "60px",
        boxSizing: "border-box",
        position: "relative",
      }}
    >
      {/* Logo top-right */}
      {p.brandLogoUrl && (
        <div style={{ position: "absolute", top: 32, right: 32, zIndex: 5 }}>
          <BrandMark brandName={p.brandName} brandLogoUrl={p.brandLogoUrl} size={isAd ? 56 : 72} />
        </div>
      )}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f4f4f4",
          borderRadius: "32px",
          overflow: "hidden",
          minHeight: 0,
          marginBottom: isAd ? 0 : "48px",
          marginRight: isAd ? "48px" : 0,
        }}
      >
        {p.variantImages && p.variantImages.length > 1 ? (
          <div style={{ width: "100%", height: "100%", padding: 16, boxSizing: "border-box" }}>
            <VariantGrid images={p.variantImages} showLabels={p.showVariantLabels} />
          </div>
        ) : p.productImage ? (
          <img
            src={p.productImage}
            crossOrigin="anonymous"
            alt=""
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
        ) : (
          <div style={{ color: "#999", fontSize: 32 }}>No image</div>
        )}
      </div>
      <div style={{ flex: isAd ? 1 : "0 0 auto", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        {!p.brandLogoUrl && (
          <div style={{ fontSize: isStory ? 28 : 22, color: "#666", letterSpacing: 4, textTransform: "uppercase", marginBottom: 16 }}>
            {p.brandName}
          </div>
        )}
        {p.tagline && (
          <div style={{ fontSize: isStory ? 30 : 24, color: "#ff3d00", fontWeight: 700, textTransform: "uppercase", letterSpacing: 2, marginBottom: 12 }}>
            {p.tagline}
          </div>
        )}
        <div
          style={{
            fontSize: isStory ? 78 : isAd ? 56 : isPortrait ? 70 : 64,
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
            marginBottom: 24,
          }}
        >
          {p.productName}
        </div>
        {p.showPrice && p.price && (
          <div style={{ fontSize: isStory ? 64 : 52, fontWeight: 700, color: "#0a0a0a", marginBottom: 20 }}>
            {formatPosterPrice(p.price)}
          </div>
        )}
        {p.description && (
          <div style={{ fontSize: isStory ? 28 : 24, color: "#444", lineHeight: 1.4, marginBottom: 28 }}>
            {p.description}
          </div>
        )}
        <Chips {...p} />
        <CTABar {...p} dark />
      </div>
    </div>
  );
}

function HypeLayout(p: TemplateProps) {
  const isStory = p.format === "story";
  const isAd = p.format === "ad";
  const isPortrait = p.format === "portrait";
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "#0a0a0a",
        color: "#ffffff",
        position: "relative",
        display: "flex",
        flexDirection: isAd ? "row" : "column",
        padding: isStory || isPortrait ? "70px 60px" : "50px",
        boxSizing: "border-box",
      }}
    >
      {/* Neon glow */}
      <div
        style={{
          position: "absolute",
          top: -200,
          right: -200,
          width: 600,
          height: 600,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,87,34,0.55), transparent 70%)",
          filter: "blur(20px)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: -150,
          left: -150,
          width: 500,
          height: 500,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(57,255,20,0.35), transparent 70%)",
          filter: "blur(20px)",
          pointerEvents: "none",
        }}
      />

      <div style={{ position: "relative", zIndex: 2, width: "100%", height: "100%", display: "flex", flexDirection: isAd ? "row" : "column" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: isAd ? 0 : 32, position: isAd ? "absolute" : "relative", top: isAd ? 0 : undefined, left: isAd ? 0 : undefined, right: isAd ? 0 : undefined, zIndex: 3 }}>
          <div style={{ background: "#ff3d00", color: "#fff", padding: "10px 22px", borderRadius: 999, fontSize: 22, fontWeight: 800, letterSpacing: 2 }}>
            {p.urgencyText || "NEW IN"}
          </div>
          <BrandMark brandName={p.brandName} brandLogoUrl={p.brandLogoUrl} dark size={isAd ? 48 : 64} />
        </div>

        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "2px solid rgba(255,255,255,0.15)",
            borderRadius: 28,
            overflow: "hidden",
            minHeight: 0,
            marginRight: isAd ? 40 : 0,
            marginTop: isAd ? 0 : 0,
            marginBottom: isAd ? 0 : 32,
          }}
        >
          {p.variantImages && p.variantImages.length > 1 ? (
            <div style={{ width: "100%", height: "100%", padding: 14, boxSizing: "border-box" }}>
              <VariantGrid images={p.variantImages} showLabels={p.showVariantLabels} dark />
            </div>
          ) : p.productImage ? (
            <img
              src={p.productImage}
              crossOrigin="anonymous"
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          ) : null}
        </div>

        <div style={{ flex: isAd ? 1 : "0 0 auto", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          {p.tagline && (
            <div style={{ fontSize: isStory ? 32 : 26, color: "#39ff14", fontWeight: 800, textTransform: "uppercase", letterSpacing: 3, marginBottom: 12 }}>
              {p.tagline}
            </div>
          )}
          <div
            style={{
              fontSize: isStory ? 96 : isAd ? 60 : isPortrait ? 84 : 76,
              fontWeight: 900,
              lineHeight: 0.95,
              letterSpacing: "-0.03em",
              textTransform: "uppercase",
              marginBottom: 20,
            }}
          >
            {p.productName}
          </div>
          {p.showPrice && p.price && (
            <div
              style={{
                display: "inline-block",
                background: "#39ff14",
                color: "#0a0a0a",
                padding: "14px 28px",
                fontSize: isStory ? 56 : 44,
                fontWeight: 900,
                marginBottom: 24,
                alignSelf: "flex-start",
              }}
            >
              {formatPosterPrice(p.price)}
            </div>
          )}
          <Chips {...p} dark />
          <CTABar {...p} />
        </div>
      </div>
    </div>
  );
}

function MinimalLayout(p: TemplateProps) {
  const isStory = p.format === "story";
  const isAd = p.format === "ad";
  const isPortrait = p.format === "portrait";
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "linear-gradient(135deg, #f6f1ea 0%, #e8dcc8 100%)",
        color: "#1a1a1a",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: isStory || isPortrait ? "100px 80px" : "60px",
        boxSizing: "border-box",
        textAlign: "center",
        position: "relative",
      }}
    >
      <div style={{ marginBottom: 40 }}>
        {p.brandLogoUrl ? (
          <BrandMark brandName={p.brandName} brandLogoUrl={p.brandLogoUrl} size={isAd ? 56 : 80} />
        ) : (
          <div style={{ fontSize: 22, letterSpacing: 8, textTransform: "uppercase", color: "#7a6a52" }}>
            {p.brandName}
          </div>
        )}
      </div>
      <div
        style={{
          flex: isAd ? "0 0 60%" : 1,
          width: isAd ? "auto" : "70%",
          aspectRatio: isAd ? undefined : "1",
          maxHeight: isStory ? "55%" : "60%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 40,
          overflow: "hidden",
          borderRadius: 16,
        }}
      >
        {p.variantImages && p.variantImages.length > 1 ? (
          <div style={{ width: "100%", height: "100%" }}>
            <VariantGrid images={p.variantImages} showLabels={p.showVariantLabels} />
          </div>
        ) : p.productImage ? (
          <img
            src={p.productImage}
            crossOrigin="anonymous"
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
          />
        ) : null}
      </div>
      {p.tagline && (
        <div style={{ fontSize: isStory ? 26 : 22, color: "#7a6a52", letterSpacing: 4, textTransform: "uppercase", marginBottom: 12 }}>
          {p.tagline}
        </div>
      )}
      <div style={{ fontSize: isStory ? 64 : isAd ? 44 : isPortrait ? 58 : 52, fontWeight: 700, marginBottom: 16, letterSpacing: "-0.01em" }}>
        {p.productName}
      </div>
      {p.showPrice && p.price && (
        <div style={{ display: "inline-block", border: "2px solid #1a1a1a", padding: "8px 22px", borderRadius: 999, fontSize: isStory ? 32 : 26, fontWeight: 600, marginBottom: 24 }}>
          {formatPosterPrice(p.price)}
        </div>
      )}
      <div style={{ fontSize: 22, color: "#5a4a36", maxWidth: "80%" }}>{p.meetupText}</div>
      <div style={{ marginTop: 32, fontSize: isStory ? 32 : 26, fontWeight: 700, letterSpacing: 4, textTransform: "uppercase" }}>
        {p.ctaText}
      </div>
    </div>
  );
}

function Chips(p: TemplateProps & { dark?: boolean }) {
  const chipBg = p.dark ? "rgba(255,255,255,0.1)" : "#f4f4f4";
  const chipColor = p.dark ? "#fff" : "#333";
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 24 }}>
      {p.stockBadge && (
        <span style={{ background: chipBg, color: chipColor, padding: "8px 18px", borderRadius: 999, fontSize: 22, fontWeight: 600 }}>
          {p.stockBadge}
        </span>
      )}
      <span style={{ background: chipBg, color: chipColor, padding: "8px 18px", borderRadius: 999, fontSize: 22, fontWeight: 600 }}>
        📍 {p.meetupText}
      </span>
    </div>
  );
}

function CTABar(p: TemplateProps & { dark?: boolean }) {
  return (
    <div
      style={{
        marginTop: 8,
        background: p.dark ? "#0a0a0a" : "#ff3d00",
        color: "#fff",
        padding: "20px 32px",
        borderRadius: 16,
        fontSize: 30,
        fontWeight: 800,
        letterSpacing: 2,
        textAlign: "center",
        textTransform: "uppercase",
        alignSelf: "stretch",
      }}
    >
      {p.ctaText}
    </div>
  );
}
