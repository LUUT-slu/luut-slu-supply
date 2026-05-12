import { useEffect, useState } from "react";
import { fetchBuyingInsights } from "@/hooks/usePurchaseOrders";
import { Lightbulb } from "lucide-react";

export function BuyingInsightHint({ productName, category }: { productName: string; category?: string | null }) {
  const [insight, setInsight] = useState<Awaited<ReturnType<typeof fetchBuyingInsights>>>(null);

  useEffect(() => {
    if (!productName || productName.trim().length < 2) { setInsight(null); return; }
    const id = setTimeout(async () => {
      const r = await fetchBuyingInsights(productName.trim(), category || undefined);
      setInsight(r);
    }, 400);
    return () => clearTimeout(id);
  }, [productName, category]);

  if (!insight) return null;
  if (!insight.found) {
    return (
      <div className="flex items-start gap-2 rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
        <Lightbulb className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <span>New product — {insight.recommendation}.</span>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2 rounded-md bg-primary/5 p-2 text-xs">
      <Lightbulb className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
      <div className="space-y-0.5">
        <p className="font-medium">{insight.recommendation}</p>
        <p className="text-muted-foreground">
          Last cost EC${(insight.last_cost ?? 0).toFixed(2)} · last sell EC${(insight.last_sell ?? 0).toFixed(2)} · avg margin {(insight.avg_margin ?? 0).toFixed(0)}% · sold {insight.total_sold ?? 0} · restocks {insight.restock_count ?? 0}
        </p>
      </div>
    </div>
  );
}
