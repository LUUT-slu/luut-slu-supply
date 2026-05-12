import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { usePurchaseOrders } from "@/hooks/usePurchaseOrders";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "XCD", maximumFractionDigits: 0 }).format(n || 0);

export default function PurchaseOrderReports({ basePath }: { basePath: "/admin/purchase-orders" | "/seller/purchase-orders" }) {
  const { data: pos = [] } = usePurchaseOrders();
  const homeHref = basePath.startsWith("/admin") ? "/admin" : "/seller";

  const { data: items = [] } = useQuery({
    queryKey: ["po_items_all"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("purchase_order_items").select("*");
      return data || [];
    },
  });

  const totals = useMemo(() => {
    return pos.reduce((acc: any, p: any) => {
      acc.cost += Number(p.total_cost || 0);
      acc.rev += Number(p.total_expected_revenue || 0);
      acc.profit += Number(p.total_expected_profit || 0);
      return acc;
    }, { cost: 0, rev: 0, profit: 0 });
  }, [pos]);

  const productPerf = useMemo(() => {
    const map = new Map<string, any>();
    for (const it of items as any[]) {
      const k = (it.product_name || "").toLowerCase();
      if (!k) continue;
      const cur = map.get(k) || { name: it.product_name, ordered: 0, sold: 0, revenue: 0, profit: 0, margin: 0, count: 0 };
      cur.ordered += Number(it.quantity_ordered || 0);
      cur.sold += Number(it.qty_sold_cached || 0);
      cur.revenue += Number(it.revenue_cached || 0);
      cur.profit += Number(it.expected_profit || 0);
      cur.margin += Number(it.profit_margin || 0);
      cur.count += 1;
      map.set(k, cur);
    }
    return Array.from(map.values()).map(r => ({ ...r, avgMargin: r.count ? r.margin / r.count : 0 }))
      .sort((a, b) => b.sold - a.sold);
  }, [items]);

  const last7Days = useMemo(() => {
    const cutoff = Date.now() - 7 * 86400 * 1000;
    return pos.filter((p: any) => new Date(p.created_at).getTime() >= cutoff);
  }, [pos]);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-5xl px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <Button asChild variant="ghost" size="sm">
            <Link to={basePath}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link to={homeHref}>Dashboard</Link>
          </Button>
        </div>
        <h1 className="text-2xl font-semibold mb-4">Purchase Order Reports</h1>

        <Tabs defaultValue="summary">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="summary">PO Summary</TabsTrigger>
            <TabsTrigger value="weekly">Weekly Review</TabsTrigger>
            <TabsTrigger value="performance">Product Performance</TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="mt-4 space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <Card><CardHeader><CardTitle className="text-sm">Total Spent</CardTitle></CardHeader><CardContent className="text-xl font-bold">{fmt(totals.cost)}</CardContent></Card>
              <Card><CardHeader><CardTitle className="text-sm">Expected Revenue</CardTitle></CardHeader><CardContent className="text-xl font-bold">{fmt(totals.rev)}</CardContent></Card>
              <Card><CardHeader><CardTitle className="text-sm">Expected Profit</CardTitle></CardHeader><CardContent className="text-xl font-bold">{fmt(totals.profit)}</CardContent></Card>
            </div>
            <Card>
              <CardHeader><CardTitle className="text-sm">All Purchase Orders ({pos.length})</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {pos.map((p: any) => (
                  <Link key={p.id} to={`${basePath}/${p.id}`} className="flex items-center justify-between text-sm border-b pb-2">
                    <span className="truncate flex-1">{p.name}</span>
                    <span className="text-muted-foreground mx-2">{p.status}</span>
                    <span className="font-medium">{fmt(Number(p.total_cost))}</span>
                  </Link>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="weekly" className="mt-4 space-y-3">
            <Card>
              <CardHeader><CardTitle className="text-sm">Last 7 Days</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-2">{last7Days.length} new POs</p>
                {last7Days.map((p: any) => (
                  <Link key={p.id} to={`${basePath}/${p.id}`} className="flex items-center justify-between text-sm border-b py-2">
                    <span className="truncate flex-1">{p.name}</span>
                    <span className="font-medium">{fmt(Number(p.total_cost))}</span>
                  </Link>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="performance" className="mt-4 space-y-3">
            <Card>
              <CardHeader><CardTitle className="text-sm">Product Performance</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {productPerf.length === 0 && <p className="text-sm text-muted-foreground">No data yet.</p>}
                {productPerf.map((r: any) => (
                  <div key={r.name} className="grid grid-cols-5 text-xs gap-2 border-b py-2">
                    <span className="col-span-2 truncate font-medium">{r.name}</span>
                    <span>Ordered: {r.ordered}</span>
                    <span>Sold: {r.sold}</span>
                    <span className="text-right">{fmt(r.revenue)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
