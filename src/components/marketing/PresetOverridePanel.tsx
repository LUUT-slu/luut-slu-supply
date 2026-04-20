import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RotateCcw } from "lucide-react";
import {
  PosterPreset,
  PresetDensity,
  PresetBadgeShape,
  PresetCtaShape,
} from "@/lib/marketingPresets";

export interface PresetOverrides {
  accent?: string;
  glow?: string;
  density?: PresetDensity;
  badgeShape?: PresetBadgeShape;
  ctaShape?: PresetCtaShape;
}

interface Props {
  basePreset: PosterPreset;
  overrides: PresetOverrides;
  onChange: (next: PresetOverrides) => void;
}

const DENSITIES: PresetDensity[] = ["tight", "normal", "spaced"];
const BADGES: PresetBadgeShape[] = ["pill", "ribbon", "chip"];
const CTAS: PresetCtaShape[] = ["pill", "block", "outline"];

export function PresetOverridePanel({ basePreset, overrides, onChange }: Props) {
  const set = (patch: PresetOverrides) => onChange({ ...overrides, ...patch });
  const reset = () => onChange({});

  const accent = overrides.accent ?? basePreset.palette.accent;
  const density = overrides.density ?? basePreset.layout.density;
  const badgeShape = overrides.badgeShape ?? basePreset.badge.shape;
  const ctaShape = overrides.ctaShape ?? basePreset.cta.shape;

  const hasOverrides = Object.values(overrides).some((v) => v !== undefined);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium">Customize: {basePreset.name}</span>
        {hasOverrides && (
          <Button variant="ghost" size="sm" onClick={reset} className="h-7 px-2 text-xs gap-1">
            <RotateCcw className="h-3 w-3" />
            Reset
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-[11px]">Accent</Label>
          <div className="mt-1 flex items-center gap-1.5">
            <input
              type="color"
              value={normalizeHex(accent)}
              onChange={(e) => set({ accent: e.target.value })}
              className="h-8 w-10 cursor-pointer rounded border border-border bg-transparent p-0.5"
            />
            <Input
              value={accent}
              onChange={(e) => set({ accent: e.target.value })}
              className="h-8 text-xs"
            />
          </div>
        </div>
        <div>
          <Label className="text-[11px]">Glow (rgba)</Label>
          <Input
            value={overrides.glow ?? basePreset.palette.glow}
            onChange={(e) => set({ glow: e.target.value })}
            className="mt-1 h-8 text-xs"
            placeholder="rgba(57,255,122,0.55)"
          />
        </div>
      </div>

      <div>
        <Label className="text-[11px]">Density</Label>
        <div className="mt-1 grid grid-cols-3 gap-1.5">
          {DENSITIES.map((d) => (
            <Button
              key={d}
              size="sm"
              variant={density === d ? "default" : "outline"}
              className="h-8 text-xs capitalize"
              onClick={() => set({ density: d })}
            >
              {d}
            </Button>
          ))}
        </div>
      </div>

      <div>
        <Label className="text-[11px]">Badge shape</Label>
        <div className="mt-1 grid grid-cols-3 gap-1.5">
          {BADGES.map((b) => (
            <Button
              key={b}
              size="sm"
              variant={badgeShape === b ? "default" : "outline"}
              className="h-8 text-xs capitalize"
              onClick={() => set({ badgeShape: b })}
            >
              {b}
            </Button>
          ))}
        </div>
      </div>

      <div>
        <Label className="text-[11px]">CTA shape</Label>
        <div className="mt-1 grid grid-cols-3 gap-1.5">
          {CTAS.map((c) => (
            <Button
              key={c}
              size="sm"
              variant={ctaShape === c ? "default" : "outline"}
              className="h-8 text-xs capitalize"
              onClick={() => set({ ctaShape: c })}
            >
              {c}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}

function normalizeHex(c: string): string {
  if (typeof c !== "string") return "#000000";
  if (c.startsWith("#") && (c.length === 7 || c.length === 4)) return c;
  // Fallback: try to extract from rgb()
  const m = c.match(/\d+/g);
  if (m && m.length >= 3) {
    const [r, g, b] = m.map(Number);
    return (
      "#" +
      [r, g, b]
        .map((n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0"))
        .join("")
    );
  }
  return "#000000";
}
