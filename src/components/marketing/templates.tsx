import { forwardRef } from "react";

export type TemplateStyle = "clean" | "hype" | "minimal";
export type TemplateFormat = "story" | "post" | "ad";

export interface TemplateProps {
  style: TemplateStyle;
  format: TemplateFormat;
  productName: string;
  productImage?: string;
  price?: string;
  showPrice: boolean;
  description?: string;
  stockBadge?: string;
  brandName: string;
  meetupText: string;
  ctaText: string;
  urgencyText?: string;
}

const DIMENSIONS: Record<TemplateFormat, { w: number; h: number }> = {
  story: { w: 1080, height: 1920 } as any, // satisfy TS
  post: { w: 1080, height: 1080 } as any,
  ad: { w: 1200, height: 628 } as any,
};

// Re-declare cleanly to avoid TS issue above
const SIZE: Record<TemplateFormat, { w: number; h: number }> = {
  story: { w: 1080, h: 1920 },
  post: { w: 1080, h: 1080 },
  ad: { w: 1200, h: 628 },
};

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

function CleanLayout(p: TemplateProps) {
  const isStory = p.format === "story";
  const isAd = p.format === "ad";
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "#ffffff",
        color: "#0a0a0a",
        display: "flex",
        flexDirection: isAd ? "row" : "column",
        padding: isStory ? "80px 60px" : "60px",
        boxSizing: "border-box",
      }}
    >
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
        {p.productImage ? (
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
        <div style={{ fontSize: isStory ? 28 : 22, color: "#666", letterSpacing: 4, textTransform: "uppercase", marginBottom: 16 }}>
          {p.brandName}
        </div>
        <div
          style={{
            fontSize: isStory ? 78 : isAd ? 56 : 64,
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
            EC${p.price}
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
        padding: isStory ? "70px 60px" : "50px",
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: isAd ? 0 : 32, position: isAd ? "absolute" : "relative", top: isAd ? 0 : undefined, left: isAd ? 0 : undefined, right: isAd ? 0 : undefined, zIndex: 3 }}>
          <div style={{ background: "#ff3d00", color: "#fff", padding: "10px 22px", borderRadius: 999, fontSize: 22, fontWeight: 800, letterSpacing: 2 }}>
            {p.urgencyText || "NEW IN"}
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: 4, opacity: 0.7 }}>{p.brandName}</div>
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
          {p.productImage ? (
            <img
              src={p.productImage}
              crossOrigin="anonymous"
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          ) : null}
        </div>

        <div style={{ flex: isAd ? 1 : "0 0 auto", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div
            style={{
              fontSize: isStory ? 96 : isAd ? 60 : 76,
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
              EC${p.price}
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
        padding: isStory ? "100px 80px" : "60px",
        boxSizing: "border-box",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 22, letterSpacing: 8, textTransform: "uppercase", color: "#7a6a52", marginBottom: 40 }}>
        {p.brandName}
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
        {p.productImage ? (
          <img
            src={p.productImage}
            crossOrigin="anonymous"
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
          />
        ) : null}
      </div>
      <div style={{ fontSize: isStory ? 64 : isAd ? 44 : 52, fontWeight: 700, marginBottom: 16, letterSpacing: "-0.01em" }}>
        {p.productName}
      </div>
      {p.showPrice && p.price && (
        <div style={{ display: "inline-block", border: "2px solid #1a1a1a", padding: "8px 22px", borderRadius: 999, fontSize: isStory ? 32 : 26, fontWeight: 600, marginBottom: 24 }}>
          EC${p.price}
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
