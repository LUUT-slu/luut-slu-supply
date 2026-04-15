import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, TrendingUp, Eye, ShoppingCart } from "lucide-react";
import type { ProductMetrics } from "@/hooks/useAnalyticsData";

interface Props {
  products: ProductMetrics[];
}

interface Insight {
  icon: typeof AlertTriangle;
  color: string;
  text: string;
}

export function AnalyticsInsights({ products }: Props) {
  const insights: Insight[] = [];

  // High views, low cart
  const highViewLow = products
    .filter((p) => p.views >= 10 && p.cartRate < 5)
    .sort((a, b) => b.views - a.views);
  for (const p of highViewLow.slice(0, 3)) {
    insights.push({
      icon: AlertTriangle,
      color: "text-amber-500",
      text: `"${p.productName}" gets ${p.views} views but only ${p.cartRate.toFixed(0)}% add to cart — may need better images, pricing, or description.`,
    });
  }

  // Strong cart rate
  const strongCart = products
    .filter((p) => p.views >= 5 && p.cartRate > 30)
    .sort((a, b) => b.cartRate - a.cartRate);
  for (const p of strongCart.slice(0, 2)) {
    insights.push({
      icon: TrendingUp,
      color: "text-emerald-500",
      text: `"${p.productName}" has a strong ${p.cartRate.toFixed(0)}% add-to-cart rate — consider promoting it.`,
    });
  }

  // Low attention
  const lowAttention = products
    .filter((p) => p.views + p.clicks <= 2)
    .sort((a, b) => a.views - b.views);
  if (lowAttention.length > 0) {
    insights.push({
      icon: Eye,
      color: "text-muted-foreground",
      text: `${lowAttention.length} product${lowAttention.length > 1 ? "s" : ""} ha${lowAttention.length > 1 ? "ve" : "s"} very low attention — may be dead stock or poorly listed.`,
    });
  }

  // Cart abandonment
  const abandoned = products
    .filter((p) => p.addToCarts >= 3 && p.orders === 0)
    .sort((a, b) => b.addToCarts - a.addToCarts);
  for (const p of abandoned.slice(0, 2)) {
    insights.push({
      icon: ShoppingCart,
      color: "text-red-500",
      text: `"${p.productName}" was added to cart ${p.addToCarts} times but never purchased — potential cart abandonment issue.`,
    });
  }

  if (insights.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">💡 Insights</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {insights.map((ins, i) => (
          <div key={i} className="flex items-start gap-2 text-xs">
            <ins.icon className={`h-4 w-4 mt-0.5 shrink-0 ${ins.color}`} />
            <span className="text-muted-foreground">{ins.text}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
