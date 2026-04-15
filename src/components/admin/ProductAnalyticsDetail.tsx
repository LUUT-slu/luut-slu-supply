import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import type { ProductMetrics } from "@/hooks/useAnalyticsData";

interface Props {
  product: ProductMetrics | null;
  open: boolean;
  onClose: () => void;
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

export function ProductAnalyticsDetail({ product, open, onClose }: Props) {
  if (!product) return null;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-left text-base">{product.productName}</SheetTitle>
          <p className="text-xs text-muted-foreground">{product.productCategory}</p>
        </SheetHeader>

        <div className="mt-6 space-y-3">
          <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Funnel Metrics</h4>
          <Stat label="Total Views" value={product.views} />
          <Stat label="Unique Visitors" value={product.uniqueSessions.size} />
          <Stat label="Clicks" value={product.clicks} />
          <Stat label="Add to Cart" value={product.addToCarts} />
          <Stat label="Checkout Starts" value={product.checkoutStarts} />
          <Stat label="Orders Completed" value={product.orders} />

          <Separator />

          <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Conversion Rates</h4>
          <Stat label="View → Cart" value={`${product.cartRate.toFixed(1)}%`} />
          <Stat label="View → Order" value={`${product.conversionRate.toFixed(1)}%`} />
          <Stat
            label="Cart → Order"
            value={
              product.addToCarts > 0
                ? `${((product.orders / product.addToCarts) * 100).toFixed(1)}%`
                : "N/A"
            }
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
