import { Card, CardContent } from "@/components/ui/card";
import { PurchaseOrder } from "@/hooks/usePurchaseOrders";

export function POSummaryCard({ po, itemCount, qtyTotal }: { po: PurchaseOrder; itemCount: number; qtyTotal: number }) {
  const fmt = (n: number) => `EC$${(Number(n) || 0).toFixed(2)}`;
  return (
    <Card className="border-border/60">
      <CardContent className="p-4 grid grid-cols-2 gap-3 text-sm">
        <Stat label="Items" value={String(itemCount)} />
        <Stat label="Total qty" value={String(qtyTotal)} />
        <Stat label="Invested" value={fmt(po.total_cost)} />
        <Stat label="Expected revenue" value={fmt(po.total_expected_revenue)} />
        <Stat label="Expected profit" value={fmt(po.total_expected_profit)} accent />
        <Stat label="Avg margin" value={`${(po.avg_margin || 0).toFixed(1)}%`} />
        <Stat label="High ROI items" value={String(po.high_roi_count)} />
        <Stat label="Risky items" value={String(po.risky_count)} />
        {po.expected_arrival_date && (
          <Stat label="Expected arrival" value={po.expected_arrival_date} />
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`font-semibold ${accent ? "text-primary" : ""}`}>{value}</p>
    </div>
  );
}
