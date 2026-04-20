import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface VariantOption {
  id: string;
  label: string;
  imageUrl?: string;
  available: boolean;
}

export type VariantMode = "single" | "multi";

interface VariantSelectorProps {
  variants: VariantOption[];
  mode: VariantMode;
  onModeChange: (mode: VariantMode) => void;
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  fallbackImageUrl?: string;
}

export function VariantSelector({
  variants,
  mode,
  onModeChange,
  selectedIds,
  onSelectionChange,
  fallbackImageUrl,
}: VariantSelectorProps) {
  if (variants.length <= 1) return null;

  const toggle = (id: string) => {
    if (mode === "single") {
      onSelectionChange([id]);
      return;
    }
    if (selectedIds.includes(id)) {
      // keep at least one selected
      const next = selectedIds.filter((x) => x !== id);
      onSelectionChange(next.length === 0 ? [id] : next);
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs">Select Variants</Label>
        <div className="inline-flex rounded-md border p-0.5">
          <Button
            type="button"
            size="sm"
            variant={mode === "single" ? "default" : "ghost"}
            className="h-7 text-[11px] px-3"
            onClick={() => {
              onModeChange("single");
              if (selectedIds.length > 1) onSelectionChange([selectedIds[0]]);
            }}
          >
            Single
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === "multi" ? "default" : "ghost"}
            className="h-7 text-[11px] px-3"
            onClick={() => onModeChange("multi")}
          >
            Multi
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
        {variants.map((v) => {
          const selected = selectedIds.includes(v.id);
          const img = v.imageUrl || fallbackImageUrl;
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => toggle(v.id)}
              className={cn(
                "group relative overflow-hidden rounded-md border bg-muted text-left transition-all touch-manipulation",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                selected
                  ? "border-primary ring-2 ring-primary/40"
                  : "border-border hover:border-foreground/40",
                !v.available && "opacity-60",
              )}
            >
              <div className="aspect-square w-full overflow-hidden bg-muted">
                {img ? (
                  <img
                    src={img}
                    alt={v.label}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                    No image
                  </div>
                )}
                {selected && (
                  <div className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow">
                    <Check className="h-3 w-3" />
                  </div>
                )}
              </div>
              <div className="truncate px-1.5 py-1 text-[11px] font-medium">
                {v.label}
              </div>
            </button>
          );
        })}
      </div>

      <p className="text-[11px] text-muted-foreground">
        {mode === "single"
          ? "One variant featured in the poster."
          : `${selectedIds.length} variant${selectedIds.length === 1 ? "" : "s"} will be combined into the poster.`}
      </p>
    </div>
  );
}
