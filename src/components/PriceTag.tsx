import { cn } from "@/lib/utils";
import { ResolvedPrice } from "@/lib/pricing";

interface PriceTagProps {
  resolved: ResolvedPrice;
  size?: "sm" | "md" | "lg";
  className?: string;
  /** Show "-XX%" chip next to the strikethrough. */
  showPercentChip?: boolean;
}

export function PriceTag({ resolved, size = "md", className, showPercentChip = false }: PriceTagProps) {
  const finalCls =
    size === "lg"
      ? "text-3xl md:text-4xl font-sans"
      : size === "sm"
      ? "text-[15px] font-semibold"
      : "text-lg font-semibold";
  const origCls =
    size === "lg" ? "text-base" : size === "sm" ? "text-[11px]" : "text-sm";

  return (
    <div className={cn("flex flex-wrap items-baseline gap-1.5", className)}>
      <span className={cn("font-display text-primary", finalCls)}>
        EC${resolved.final.toFixed(2)}
      </span>
      {resolved.hasDiscount && (
        <>
          <span className={cn("text-muted-foreground line-through", origCls)}>
            EC${resolved.original.toFixed(2)}
          </span>
          {showPercentChip && resolved.percentOff > 0 && (
            <span className="rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-destructive-foreground">
              −{resolved.percentOff}%
            </span>
          )}
        </>
      )}
    </div>
  );
}

/** Small sale ribbon to drop on the corner of a product image. */
export function SaleRibbon({ resolved, className }: { resolved: ResolvedPrice; className?: string }) {
  if (!resolved.hasDiscount) return null;
  return (
    <span
      className={cn(
        "z-10 rounded-md bg-destructive px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-destructive-foreground shadow",
        className,
      )}
    >
      {resolved.badge || "Sale"}
    </span>
  );
}
