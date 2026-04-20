// Reference-based design preset system for Marketing Studio.
// Presets are bounded token bundles applied to existing templates.
// Templates remain in control of layout — presets only swap palette,
// density, badge/CTA shape, and background style.

export type PresetDensity = "tight" | "normal" | "spaced";
export type PresetBadgeShape = "pill" | "ribbon" | "chip";
export type PresetCtaShape = "pill" | "block" | "outline";
export type PresetBgType = "dark" | "gradient" | "glow" | "minimal";
export type PresetFill = "glow" | "solid" | "outline";

export interface PosterPreset {
  id: string;
  name: string;
  source: "builtin" | "custom";
  palette: {
    bg: string; // base canvas color
    surface: string; // tile/card background
    accent: string; // headline glow / price / divider
    glow: string; // soft halo (rgba)
    text: string;
    muted: string;
  };
  layout: {
    density: PresetDensity;
    radius: number; // px
    gridGap: number; // px
  };
  typography: {
    headlineWeight: 700 | 800 | 900;
    headlineCase: "upper" | "title";
    scale: number; // 0.85 .. 1.15
  };
  badge: {
    shape: PresetBadgeShape;
    fill: PresetFill;
  };
  cta: {
    shape: PresetCtaShape;
    fill: PresetFill;
  };
  background: {
    type: PresetBgType;
    noise: boolean;
  };
}

const BUILTIN_PRESETS: PosterPreset[] = [
  {
    id: "clean",
    name: "Clean",
    source: "builtin",
    palette: {
      bg: "#ffffff",
      surface: "#f4f4f4",
      accent: "#0a0a0a",
      glow: "rgba(10,10,10,0.08)",
      text: "#0a0a0a",
      muted: "#666666",
    },
    layout: { density: "spaced", radius: 24, gridGap: 18 },
    typography: { headlineWeight: 800, headlineCase: "upper", scale: 1 },
    badge: { shape: "pill", fill: "solid" },
    cta: { shape: "block", fill: "solid" },
    background: { type: "minimal", noise: false },
  },
  {
    id: "hype",
    name: "Hype",
    source: "builtin",
    palette: {
      bg: "#0a0a0a",
      surface: "rgba(255,255,255,0.06)",
      accent: "#39ff7a",
      glow: "rgba(57,255,122,0.55)",
      text: "#ffffff",
      muted: "rgba(255,255,255,0.7)",
    },
    layout: { density: "normal", radius: 22, gridGap: 18 },
    typography: { headlineWeight: 900, headlineCase: "upper", scale: 1.05 },
    badge: { shape: "pill", fill: "glow" },
    cta: { shape: "pill", fill: "glow" },
    background: { type: "glow", noise: false },
  },
  {
    id: "minimal",
    name: "Minimal",
    source: "builtin",
    palette: {
      bg: "#f6f1ea",
      surface: "#ffffff",
      accent: "#1a1a1a",
      glow: "rgba(26,26,26,0.06)",
      text: "#1a1a1a",
      muted: "#7a6a52",
    },
    layout: { density: "spaced", radius: 16, gridGap: 24 },
    typography: { headlineWeight: 700, headlineCase: "title", scale: 0.95 },
    badge: { shape: "chip", fill: "outline" },
    cta: { shape: "outline", fill: "outline" },
    background: { type: "gradient", noise: false },
  },
  {
    id: "sale",
    name: "Sale",
    source: "builtin",
    palette: {
      bg: "#1a0a14",
      surface: "rgba(255,255,255,0.05)",
      accent: "#ffcf3a",
      glow: "rgba(255,90,140,0.55)",
      text: "#ffffff",
      muted: "rgba(255,255,255,0.75)",
    },
    layout: { density: "tight", radius: 18, gridGap: 14 },
    typography: { headlineWeight: 900, headlineCase: "upper", scale: 1.1 },
    badge: { shape: "ribbon", fill: "glow" },
    cta: { shape: "pill", fill: "glow" },
    background: { type: "glow", noise: false },
  },
  {
    id: "urgency",
    name: "Urgency",
    source: "builtin",
    palette: {
      bg: "#160604",
      surface: "rgba(255,255,255,0.05)",
      accent: "#ff7a18",
      glow: "rgba(255,90,20,0.55)",
      text: "#ffffff",
      muted: "rgba(255,230,200,0.8)",
    },
    layout: { density: "tight", radius: 18, gridGap: 14 },
    typography: { headlineWeight: 900, headlineCase: "upper", scale: 1.08 },
    badge: { shape: "ribbon", fill: "solid" },
    cta: { shape: "pill", fill: "glow" },
    background: { type: "glow", noise: false },
  },
  {
    id: "luxury",
    name: "Luxury",
    source: "builtin",
    palette: {
      bg: "#0a0805",
      surface: "rgba(212,175,55,0.06)",
      accent: "#d4af37",
      glow: "rgba(212,175,55,0.35)",
      text: "#f5e9c8",
      muted: "rgba(245,233,200,0.6)",
    },
    layout: { density: "spaced", radius: 12, gridGap: 22 },
    typography: { headlineWeight: 700, headlineCase: "upper", scale: 0.95 },
    badge: { shape: "chip", fill: "outline" },
    cta: { shape: "outline", fill: "outline" },
    background: { type: "dark", noise: false },
  },
  {
    id: "grid-showcase",
    name: "Grid Showcase",
    source: "builtin",
    palette: {
      bg: "#111111",
      surface: "rgba(255,255,255,0.06)",
      accent: "#ffffff",
      glow: "rgba(255,255,255,0.18)",
      text: "#ffffff",
      muted: "rgba(255,255,255,0.65)",
    },
    layout: { density: "normal", radius: 14, gridGap: 12 },
    typography: { headlineWeight: 800, headlineCase: "upper", scale: 0.95 },
    badge: { shape: "chip", fill: "solid" },
    cta: { shape: "block", fill: "solid" },
    background: { type: "dark", noise: false },
  },
];

export function getBuiltinPresets(): PosterPreset[] {
  return BUILTIN_PRESETS;
}

const CUSTOM_KEY = "marketing.presets.custom";

export function getCustomPresets(): PosterPreset[] {
  try {
    const raw = localStorage.getItem(CUSTOM_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((p) => p && p.id && p.palette);
  } catch {
    return [];
  }
}

export function saveCustomPreset(preset: PosterPreset) {
  const list = getCustomPresets();
  const next = [...list.filter((p) => p.id !== preset.id), { ...preset, source: "custom" as const }];
  localStorage.setItem(CUSTOM_KEY, JSON.stringify(next));
}

export function deleteCustomPreset(id: string) {
  const list = getCustomPresets().filter((p) => p.id !== id);
  localStorage.setItem(CUSTOM_KEY, JSON.stringify(list));
}

export function getAllPresets(): PosterPreset[] {
  return [...BUILTIN_PRESETS, ...getCustomPresets()];
}

export function getPreset(id: string): PosterPreset | null {
  return getAllPresets().find((p) => p.id === id) || null;
}

export function mergePreset(
  base: PosterPreset,
  overrides: Partial<{
    accent: string;
    glow: string;
    density: PresetDensity;
    badgeShape: PresetBadgeShape;
    ctaShape: PresetCtaShape;
  }>,
): PosterPreset {
  return {
    ...base,
    palette: {
      ...base.palette,
      accent: overrides.accent ?? base.palette.accent,
      glow: overrides.glow ?? base.palette.glow,
    },
    layout: {
      ...base.layout,
      density: overrides.density ?? base.layout.density,
    },
    badge: {
      ...base.badge,
      shape: overrides.badgeShape ?? base.badge.shape,
    },
    cta: {
      ...base.cta,
      shape: overrides.ctaShape ?? base.cta.shape,
    },
  };
}

// Density → padding/gap multipliers used by templates.
export function densityScale(d: PresetDensity): { pad: number; gap: number } {
  if (d === "tight") return { pad: 0.85, gap: 0.7 };
  if (d === "spaced") return { pad: 1.15, gap: 1.3 };
  return { pad: 1, gap: 1 };
}

// Validate AI-extracted preset payload — returns null if malformed.
export function validateExtractedPreset(raw: unknown, name: string): PosterPreset | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, any>;
  const palette = r.palette || {};
  const layout = r.layout || {};
  const typo = r.typography || {};
  const badge = r.badge || {};
  const cta = r.cta || {};
  const bg = r.background || {};

  const hex = (v: unknown, fallback: string) =>
    typeof v === "string" && /^#?[0-9a-fA-F]{3,8}$/.test(v.replace("#", ""))
      ? v.startsWith("#")
        ? v
        : `#${v}`
      : fallback;

  return {
    id: `custom-${Date.now()}`,
    name: name.trim() || "Custom",
    source: "custom",
    palette: {
      bg: hex(palette.bg, "#0a0a0a"),
      surface: hex(palette.surface, "rgba(255,255,255,0.06)"),
      accent: hex(palette.accent, "#39ff7a"),
      glow: typeof palette.glow === "string" ? palette.glow : "rgba(57,255,122,0.5)",
      text: hex(palette.text, "#ffffff"),
      muted: hex(palette.muted, "#888888"),
    },
    layout: {
      density: ["tight", "normal", "spaced"].includes(layout.density) ? layout.density : "normal",
      radius: typeof layout.radius === "number" ? Math.max(0, Math.min(48, layout.radius)) : 18,
      gridGap: typeof layout.gridGap === "number" ? Math.max(0, Math.min(40, layout.gridGap)) : 18,
    },
    typography: {
      headlineWeight: [700, 800, 900].includes(typo.headlineWeight) ? typo.headlineWeight : 900,
      headlineCase: typo.headlineCase === "title" ? "title" : "upper",
      scale: typeof typo.scale === "number" ? Math.max(0.85, Math.min(1.15, typo.scale)) : 1,
    },
    badge: {
      shape: ["pill", "ribbon", "chip"].includes(badge.shape) ? badge.shape : "pill",
      fill: ["glow", "solid", "outline"].includes(badge.fill) ? badge.fill : "solid",
    },
    cta: {
      shape: ["pill", "block", "outline"].includes(cta.shape) ? cta.shape : "pill",
      fill: ["glow", "solid", "outline"].includes(cta.fill) ? cta.fill : "solid",
    },
    background: {
      type: ["dark", "gradient", "glow", "minimal"].includes(bg.type) ? bg.type : "dark",
      noise: Boolean(bg.noise),
    },
  };
}
