import { Sparkles, Trophy, PackagePlus, RefreshCcw, AlertTriangle, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { POSTER_TYPES, PosterType } from "@/lib/marketingPosterTypes";

const ICONS: Record<PosterType, React.ComponentType<{ className?: string }>> = {
  single: Sparkles,
  bestsellers: Trophy,
  "new-arrivals": PackagePlus,
  restocked: RefreshCcw,
  "low-stock": AlertTriangle,
  promotions: Tag,
};

interface Props {
  value: PosterType;
  onChange: (type: PosterType) => void;
}

export function PosterTypeSelector({ value, onChange }: Props) {
  return (
    <div className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1">
      {POSTER_TYPES.map((t) => {
        const Icon = ICONS[t.key];
        const active = value === t.key;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            className={cn(
              "snap-start flex min-w-[140px] shrink-0 flex-col items-start gap-1 rounded-lg border px-3 py-2.5 text-left transition-all touch-manipulation",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                : "border-border bg-card hover:border-foreground/30",
            )}
          >
            <div className="flex items-center gap-2">
              <Icon className={cn("h-4 w-4", active ? "text-primary" : "text-muted-foreground")} />
              <span className="text-sm font-semibold">{t.label}</span>
            </div>
            <span className="text-[11px] text-muted-foreground">{t.hint}</span>
          </button>
        );
      })}
    </div>
  );
}
