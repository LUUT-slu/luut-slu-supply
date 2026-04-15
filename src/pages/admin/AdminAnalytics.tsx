import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { subDays, startOfDay, endOfDay } from "date-fns";
import { ArrowLeft, Download } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminAuth } from "@/components/AdminAuth";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AnalyticsFilterBar } from "@/components/admin/AnalyticsFilters";
import { AnalyticsCards } from "@/components/admin/AnalyticsCards";
import { AnalyticsCharts } from "@/components/admin/AnalyticsCharts";
import { AnalyticsLeaderboard } from "@/components/admin/AnalyticsLeaderboard";
import { AnalyticsInsights } from "@/components/admin/AnalyticsInsights";
import { ProductAnalyticsDetail } from "@/components/admin/ProductAnalyticsDetail";
import {
  useAnalyticsData,
  computeMetrics,
  type AnalyticsFilters,
} from "@/hooks/useAnalyticsData";

export default function AdminAnalytics() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<AnalyticsFilters>({
    startDate: startOfDay(subDays(new Date(), 30)).toISOString(),
    endDate: endOfDay(new Date()).toISOString(),
  });
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  const { data: events, isLoading } = useAnalyticsData(filters);

  const { data: totalRevenue = 0 } = useQuery({
    queryKey: ["admin-revenue", filters.startDate, filters.endDate],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("total_price")
        .eq("order_status", "COMPLETED")
        .gte("created_at", filters.startDate)
        .lte("created_at", filters.endDate);
      return (data || []).reduce((sum, o) => sum + Number(o.total_price || 0), 0);
    },
  });

  const metrics = useMemo(() => {
    if (!events) return null;
    return computeMetrics(events);
  }, [events]);

  const categories = useMemo(() => {
    if (!events) return [];
    const cats = new Set(events.map((e) => e.product_category).filter(Boolean) as string[]);
    return Array.from(cats).sort();
  }, [events]);

  const sellers = useMemo(() => {
    if (!events) return [];
    const map = new Map<string, string>();
    for (const e of events) {
      if (e.seller_id && !map.has(e.seller_id)) {
        map.set(e.seller_id, e.seller_id);
      }
    }
    return Array.from(map.entries()).map(([id]) => ({ id, name: id }));
  }, [events]);

  const selectedProduct = useMemo(() => {
    if (!selectedProductId || !metrics) return null;
    return metrics.products.find((p) => p.productId === selectedProductId) || null;
  }, [selectedProductId, metrics]);

  const exportCSV = useCallback(() => {
    if (!metrics) return;
    const header = "Product,Category,Views,Clicks,Add to Cart,Orders,Cart Rate %,Conversion %\n";
    const rows = metrics.products
      .map(
        (p) =>
          `"${p.productName}","${p.productCategory}",${p.views},${p.clicks},${p.addToCarts},${p.orders},${p.cartRate.toFixed(1)},${p.conversionRate.toFixed(1)}`
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analytics-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [metrics]);

  return (
    <AdminAuth>
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <main className="container flex-1 py-6 space-y-6">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="font-display text-xl md:text-2xl">Analysis</h1>
                <p className="text-xs text-muted-foreground">Product performance & customer behavior</p>
              </div>
            </div>
            <Button size="sm" variant="outline" className="gap-1" onClick={exportCSV} disabled={!metrics}>
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
          </div>

          {/* Filters */}
          <AnalyticsFilterBar
            filters={filters}
            onChange={setFilters}
            categories={categories}
            sellers={sellers}
          />

          {isLoading ? (
            <div className="space-y-4">
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-[90px] rounded-lg" />
                ))}
              </div>
              <Skeleton className="h-[300px] rounded-lg" />
            </div>
          ) : metrics ? (
            <>
              {/* Summary Cards */}
              <AnalyticsCards
                totalVisitors={metrics.totalVisitors}
                totalViews={metrics.totalViews}
                totalClicks={metrics.totalClicks}
                totalAddToCarts={metrics.totalAddToCarts}
                totalOrders={metrics.totalOrders}
                avgConversionRate={metrics.avgConversionRate}
                totalRevenue={totalRevenue}
              />

              {/* Insights */}
              <AnalyticsInsights products={metrics.products} />

              {/* Charts */}
              <AnalyticsCharts events={metrics.events} products={metrics.products} />

              {/* Leaderboards */}
              <AnalyticsLeaderboard
                products={metrics.products}
                onSelectProduct={setSelectedProductId}
              />
            </>
          ) : (
            <p className="text-center text-muted-foreground py-12">No analytics data found for this period.</p>
          )}
        </main>

        {/* Product Detail Sheet */}
        <ProductAnalyticsDetail
          product={selectedProduct}
          open={!!selectedProductId}
          onClose={() => setSelectedProductId(null)}
        />
      </div>
    </AdminAuth>
  );
}
