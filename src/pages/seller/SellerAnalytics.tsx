import { useState, useEffect } from "react";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import { supabase } from "@/integrations/supabase/client";

import { SellerNav } from "@/components/seller/SellerNav";
import { DateRangePicker } from "@/components/seller/DateRangePicker";
import { useSellerProfile } from "@/hooks/useSellerProfile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  Package,
  RefreshCw,
  Calendar,
  CheckCircle,
} from "lucide-react";

interface DailySales {
  date: string;
  revenue: number;
  units: number;
  orders: number;
}

interface TopProduct {
  id: string;
  name: string;
  imageUrl: string | null;
  unitsSold: number;
  revenue: number;
}

export default function SellerAnalytics() {
  const { profile } = useSellerProfile();
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  const [dailySales, setDailySales] = useState<DailySales[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [potentialRevenue, setPotentialRevenue] = useState(0);
  const [actualRevenue, setActualRevenue] = useState(0);
  const [totalUnits, setTotalUnits] = useState(0);
  const [totalSalesCount, setTotalSalesCount] = useState(0);

  useEffect(() => {
    if (profile?.user_id && profile?.id) {
      fetchAnalytics();
    }
  }, [profile?.user_id, profile?.id, dateRange]);

  const fetchAnalytics = async () => {
    if (!profile?.user_id || !profile?.id) return;

    setLoading(true);

    try {
      // Fetch product_sales for this seller (potential revenue)
      let salesQuery = supabase
        .from("product_sales")
        .select("*")
        .eq("seller_user_id", profile.user_id);

      if (dateRange?.from) {
        salesQuery = salesQuery.gte("sold_at", dateRange.from.toISOString());
      }
      if (dateRange?.to) {
        salesQuery = salesQuery.lte("sold_at", dateRange.to.toISOString());
      }

      const { data: salesData } = await salesQuery.order("sold_at", { ascending: false });

      // Fetch completed orders for actual revenue
      const { data: orderItems } = await supabase
        .from("order_items")
        .select("order_id, total_price, quantity, product_name, product_id")
        .eq("seller_id", profile.id);

      let completedRevenue = 0;
      if (orderItems && orderItems.length > 0) {
        const orderIds = [...new Set(orderItems.map((i) => i.order_id))];
        let ordersQuery = supabase
          .from("orders")
          .select("id, status, created_at")
          .in("id", orderIds)
          .eq("status", "completed");

        if (dateRange?.from) {
          ordersQuery = ordersQuery.gte("created_at", dateRange.from.toISOString());
        }
        if (dateRange?.to) {
          ordersQuery = ordersQuery.lte("created_at", dateRange.to.toISOString());
        }

        const { data: completedOrders } = await ordersQuery;
        if (completedOrders) {
          const completedIds = new Set(completedOrders.map((o) => o.id));
          completedRevenue = orderItems
            .filter((i) => completedIds.has(i.order_id))
            .reduce((sum, i) => sum + Number(i.total_price), 0);
        }
      }

      setActualRevenue(completedRevenue);

      if (!salesData || salesData.length === 0) {
        setDailySales([]);
        setTopProducts([]);
        setPotentialRevenue(0);
        setTotalUnits(0);
        setTotalSalesCount(0);
        setLoading(false);
        return;
      }

      let potTotal = 0;
      let unitTotal = 0;
      const dailyMap: Record<string, DailySales> = {};
      const productMap: Record<string, TopProduct> = {};

      salesData.forEach((sale) => {
        const revenue = sale.price_amount * sale.quantity;
        potTotal += revenue;
        unitTotal += sale.quantity;

        const dateKey = format(new Date(sale.sold_at), "yyyy-MM-dd");
        if (!dailyMap[dateKey]) {
          dailyMap[dateKey] = { date: dateKey, revenue: 0, units: 0, orders: 0 };
        }
        dailyMap[dateKey].revenue += revenue;
        dailyMap[dateKey].units += sale.quantity;
        dailyMap[dateKey].orders += 1;

        if (!productMap[sale.product_id]) {
          productMap[sale.product_id] = {
            id: sale.product_id,
            name: sale.product_title,
            imageUrl: sale.product_image_url,
            unitsSold: 0,
            revenue: 0,
          };
        }
        productMap[sale.product_id].unitsSold += sale.quantity;
        productMap[sale.product_id].revenue += revenue;
      });

      setDailySales(
        Object.values(dailyMap).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      );
      setTopProducts(
        Object.values(productMap).sort((a, b) => b.unitsSold - a.unitsSold).slice(0, 10)
      );
      setPotentialRevenue(potTotal);
      setTotalUnits(unitTotal);
      setTotalSalesCount(salesData.length);
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "XCD",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <>
      <div className="flex min-h-screen flex-col bg-background">
        <SellerNav
          sellerName={profile?.seller_name}
          logoUrl={profile?.logo_url || undefined}
          sellerId={profile?.id}
        />

        <main className="container flex-1 py-4 md:py-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="font-display text-xl md:text-2xl flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Analytics
              </h1>
              <p className="text-xs text-muted-foreground">
                Sales performance and insights
              </p>
            </div>
          </div>

          <div className="mb-5">
            <DateRangePicker
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
              className="max-w-xs"
            />
          </div>

          {loading ? (
            <div className="space-y-6">
              <StatCardGridSkeleton count={4} />
              <ListItemSkeleton rows={4} />
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <Card className="border-border/60">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10 shrink-0">
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Actual Revenue</p>
                        <p className="font-semibold text-lg">{formatCurrency(actualRevenue)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-border/60">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-500/10 shrink-0">
                        <DollarSign className="h-5 w-5 text-yellow-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Potential Revenue</p>
                        <p className="font-semibold text-lg">{formatCurrency(potentialRevenue)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-border/60">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 shrink-0">
                        <Package className="h-5 w-5 text-blue-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Units Sold</p>
                        <p className="font-semibold text-lg">{totalUnits}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-border/60">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10 shrink-0">
                        <TrendingUp className="h-5 w-5 text-purple-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Sales</p>
                        <p className="font-semibold text-lg">{totalSalesCount}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Two Column Layout */}
              <div className="grid gap-6 lg:grid-cols-2">
                <Card className="border-border/60">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      Top Products
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {topProducts.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">
                        No sales data in this period
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {topProducts.slice(0, 5).map((product, index) => (
                          <div
                            key={product.id}
                            className="flex items-center gap-3 p-2 rounded-lg bg-muted/30"
                          >
                            <span className="text-xs text-muted-foreground w-4">
                              #{index + 1}
                            </span>
                            {product.imageUrl ? (
                              <img
                                src={product.imageUrl}
                                alt={product.name}
                                className="h-10 w-10 rounded object-cover"
                              />
                            ) : (
                              <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                                <Package className="h-4 w-4 text-muted-foreground" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{product.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {product.unitsSold} sold
                              </p>
                            </div>
                            <span className="text-sm font-medium text-green-500">
                              {formatCurrency(product.revenue)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-border/60">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-primary" />
                      Sales by Date
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {dailySales.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">
                        No sales data in this period
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-[300px] overflow-y-auto">
                        {dailySales.slice(0, 10).map((day) => (
                          <div
                            key={day.date}
                            className="flex items-center justify-between p-2 rounded-lg bg-muted/30"
                          >
                            <div>
                              <p className="text-sm font-medium">{formatDate(day.date)}</p>
                              <p className="text-xs text-muted-foreground">
                                {day.orders} sales · {day.units} units
                              </p>
                            </div>
                            <span className="text-sm font-medium text-green-500">
                              {formatCurrency(day.revenue)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </main>
      </div>
    </>
  );
}
