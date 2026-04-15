import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, MousePointerClick, ShoppingCart, CreditCard, Package, TrendingUp } from "lucide-react";

interface Props {
  totalVisitors: number;
  totalViews: number;
  totalClicks: number;
  totalAddToCarts: number;
  totalOrders: number;
  avgConversionRate: number;
}

const cards = [
  { key: "visitors", label: "Unique Visitors", icon: Eye, color: "text-blue-500" },
  { key: "views", label: "Product Views", icon: Eye, color: "text-emerald-500" },
  { key: "clicks", label: "Product Clicks", icon: MousePointerClick, color: "text-violet-500" },
  { key: "carts", label: "Add to Carts", icon: ShoppingCart, color: "text-amber-500" },
  { key: "orders", label: "Orders", icon: Package, color: "text-pink-500" },
  { key: "conversion", label: "Conversion Rate", icon: TrendingUp, color: "text-primary" },
] as const;

export function AnalyticsCards(props: Props) {
  const values: Record<string, string> = {
    visitors: props.totalVisitors.toLocaleString(),
    views: props.totalViews.toLocaleString(),
    clicks: props.totalClicks.toLocaleString(),
    carts: props.totalAddToCarts.toLocaleString(),
    orders: props.totalOrders.toLocaleString(),
    conversion: `${props.avgConversionRate.toFixed(1)}%`,
  };

  return (
    <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
      {cards.map((c) => (
        <Card key={c.key}>
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground">{c.label}</CardTitle>
            <c.icon className={`h-4 w-4 ${c.color}`} />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-xl font-bold">{values[c.key]}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
