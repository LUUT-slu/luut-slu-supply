import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AnalyticsEvent, ProductMetrics } from "@/hooks/useAnalyticsData";
import { groupByDay } from "@/hooks/useAnalyticsData";

interface Props {
  events: AnalyticsEvent[];
  products: ProductMetrics[];
}

export function AnalyticsCharts({ events, products }: Props) {
  const viewsByDay = groupByDay(events, "product_viewed");
  const cartsByDay = groupByDay(events, "add_to_cart");

  const funnelData = [
    { stage: "Views", count: events.filter((e) => e.event_type === "product_viewed").length },
    { stage: "Clicks", count: events.filter((e) => e.event_type === "product_clicked").length },
    { stage: "Cart", count: events.filter((e) => e.event_type === "add_to_cart").length },
    { stage: "Checkout", count: events.filter((e) => e.event_type === "checkout_started").length },
    { stage: "Order", count: events.filter((e) => e.event_type === "order_completed").length },
  ];

  const topProducts = [...products]
    .sort((a, b) => (b.views + b.clicks) - (a.views + a.clicks))
    .slice(0, 8)
    .map((p) => ({
      name: p.productName.length > 20 ? p.productName.slice(0, 20) + "…" : p.productName,
      attention: p.views + p.clicks,
    }));

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Views Over Time */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Views Over Time</CardTitle>
        </CardHeader>
        <CardContent className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={viewsByDay}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Area type="monotone" dataKey="count" className="fill-primary/20 stroke-primary" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Add-to-Cart Trend */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Add-to-Cart Trend</CardTitle>
        </CardHeader>
        <CardContent className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={cartsByDay}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="count" className="fill-amber-500" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Conversion Funnel */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Conversion Funnel</CardTitle>
        </CardHeader>
        <CardContent className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={funnelData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis dataKey="stage" type="category" tick={{ fontSize: 10 }} width={70} />
              <Tooltip />
              <Bar dataKey="count" className="fill-primary" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Top Products by Attention */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Top Products by Attention</CardTitle>
        </CardHeader>
        <CardContent className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topProducts} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 9 }} width={100} />
              <Tooltip />
              <Bar dataKey="attention" className="fill-violet-500" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
