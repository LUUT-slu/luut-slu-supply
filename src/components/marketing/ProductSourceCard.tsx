import { useEffect, useMemo } from "react";
import { Loader2, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useMarketingProducts } from "@/hooks/useMarketingProducts";
import { MarketingProduct, PosterType, getPosterTypeMeta } from "@/lib/marketingPosterTypes";

interface Props {
  posterType: PosterType;
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  limit: number;
  onLimitChange: (n: number) => void;
  onProductsResolved: (products: MarketingProduct[]) => void;
}

export function ProductSourceCard({
  posterType,
  selectedIds,
  onSelectionChange,
  limit,
  onLimitChange,
  onProductsResolved,
}: Props) {
  const meta = getPosterTypeMeta(posterType);
  const { data: products = [], isLoading, refetch, isFetching } = useMarketingProducts(
    posterType,
    { limit: 12 },
  );

  // Push the resolved (selected) product list to parent for the template
  const selected = useMemo(
    () => products.filter((p) => selectedIds.includes(p.id)).slice(0, limit),
    [products, selectedIds, limit],
  );

  useEffect(() => {
    onProductsResolved(selected);
  }, [selected, onProductsResolved]);

  // Auto-select top N whenever the source list or limit changes
  useEffect(() => {
    if (products.length === 0) {
      onSelectionChange([]);
      return;
    }
    // Only auto-pick when current selection is empty OR all current selections fell out
    const stillValid = selectedIds.filter((id) => products.some((p) => p.id === id));
    if (stillValid.length === 0) {
      onSelectionChange(products.slice(0, limit).map((p) => p.id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products]);

  const toggle = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter((x) => x !== id));
    } else {
      if (selectedIds.length >= limit) {
        // replace oldest
        onSelectionChange([...selectedIds.slice(1), id]);
      } else {
        onSelectionChange([...selectedIds, id]);
      }
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          Auto-loaded from <span className="font-medium text-foreground">{meta.label}</span>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 gap-1 text-[11px]"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          {isFetching ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCcw className="h-3 w-3" />
          )}
          Refresh
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <Label className="text-xs whitespace-nowrap">Items: {limit}</Label>
        <Slider
          min={1}
          max={6}
          step={1}
          value={[limit]}
          onValueChange={(v) => onLimitChange(v[0])}
          className="flex-1"
        />
      </div>

      {isLoading ? (
        <div className="flex h-32 items-center justify-center text-xs text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading products...
        </div>
      ) : products.length === 0 ? (
        <div className="rounded-md border border-dashed p-6 text-center text-xs text-muted-foreground">
          No products found for this poster type yet. Try another type or check back later.
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {products.map((p) => {
            const isSel = selectedIds.includes(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => toggle(p.id)}
                className={cn(
                  "group relative overflow-hidden rounded-md border bg-muted text-left transition-all touch-manipulation",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isSel
                    ? "border-primary ring-2 ring-primary/40"
                    : "border-border hover:border-foreground/40",
                )}
              >
                <div className="aspect-square w-full overflow-hidden bg-muted">
                  {p.imageUrl ? (
                    <img
                      src={p.imageUrl}
                      alt={p.title}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                      No image
                    </div>
                  )}
                  {isSel && (
                    <div className="absolute right-1 top-1">
                      <Badge className="h-5 px-1.5 text-[9px]">SELECTED</Badge>
                    </div>
                  )}
                  {p.hint && (
                    <div className="absolute bottom-1 left-1 right-1 truncate rounded bg-background/85 px-1.5 py-0.5 text-[9px] font-medium text-foreground">
                      {p.hint}
                    </div>
                  )}
                </div>
                <div className="truncate px-1.5 py-1 text-[11px] font-medium">{p.title}</div>
              </button>
            );
          })}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">
        {selectedIds.length} selected · poster auto-arranges {selectedIds.length === 1 ? "spotlight" : `${selectedIds.length}-tile layout`}.
      </p>
    </div>
  );
}
