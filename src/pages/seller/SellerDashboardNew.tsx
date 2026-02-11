import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { startOfMonth, endOfMonth } from "date-fns";
import { DateRange } from "react-day-picker";
import { SellerRouteGuard } from "@/components/seller/SellerRouteGuard";
import { SellerNav } from "@/components/seller/SellerNav";
import { DateRangePicker } from "@/components/seller/DateRangePicker";
import { CreateOrderDialog } from "@/components/seller/CreateOrderDialog";
import { useSellerProfile } from "@/hooks/useSellerProfile";
import { useSellerStats } from "@/hooks/useSellerStats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DollarSign,
  ShoppingBag,
  Package,
  TrendingUp,
  Plus,
  Eye,
  BarChart3,
} from "lucide-react";

export default function SellerDashboardNew() {
  const navigate = useNavigate();
  const { profile, loading: profileLoading } = useSellerProfile();
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  
  const { stats, loading: statsLoading } = useSellerStats(profile?.id, dateRange);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "XCD",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const kpiCards = [
    {
      title: "Total Revenue",
      value: formatCurrency(stats.totalRevenue),
      icon: DollarSign,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
    {
      title: "Orders",
      value: stats.totalOrders.toString(),
      icon: ShoppingBag,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      title: "Units Sold",
      value: stats.totalUnitsSold.toString(),
      icon: TrendingUp,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
    },
    {
      title: "Active Products",
      value: stats.productsActive.toString(),
      icon: Package,
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
    },
  ];

  return (
    <SellerRouteGuard>
      <div className="flex min-h-screen flex-col bg-background">
        <SellerNav 
          sellerName={profile?.seller_name} 
          logoUrl={profile?.logo_url || undefined}
          sellerId={profile?.id}
        />

        <main className="container flex-1 py-4 md:py-6">
          {/* Header Section */}
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              {profile?.logo_url ? (
                <img
                  src={profile.logo_url}
                  alt={profile.seller_name}
                  className="h-14 w-14 rounded-full object-cover border-2 border-border"
                />
              ) : (
                <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <Package className="h-7 w-7 text-primary" />
                </div>
              )}
              <div>
                <h1 className="font-display text-xl md:text-2xl">
                  {profile?.seller_name || "Seller Dashboard"}
                </h1>
                <div className="flex items-center gap-2 mt-1">
                  {profile?.seller_id && (
                    <Badge variant="outline" className="text-xs">
                      ID: {profile.seller_id}
                    </Badge>
                  )}
                  <Badge className="bg-green-500/20 text-green-500 border-green-500/30 text-xs">
                    Approved
                  </Badge>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex gap-2">
              {profile?.id && (
                <CreateOrderDialog
                  sellerId={profile.id}
                  sellerName={profile.seller_name}
                  sellerWhatsapp={profile.whatsapp}
                />
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/seller/products")}
                className="gap-1.5"
              >
                <Eye className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">View</span> Products
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate("/seller/products/new")}
                className="gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Product
              </Button>
            </div>
          </div>

          {/* Date Range Filter */}
          <div className="mb-5">
            <DateRangePicker
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
              className="max-w-xs"
            />
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-6">
            {kpiCards.map((kpi) => (
              <Card key={kpi.title} className="border-border/60">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${kpi.bgColor} shrink-0`}>
                      <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground truncate">{kpi.title}</p>
                      <p className="font-semibold text-lg">
                        {statsLoading ? "..." : kpi.value}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Best Seller */}
          {stats.bestSellerProduct && (
            <Card className="mb-6 border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Best Seller
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="font-medium">{stats.bestSellerProduct.name}</span>
                  <Badge variant="secondary">
                    {stats.bestSellerProduct.count} sold
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quick Links */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Card
              className="border-border/60 cursor-pointer transition-all hover:border-primary/50"
              onClick={() => navigate("/seller/products")}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <Package className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium text-sm">Manage Products</p>
                  <p className="text-xs text-muted-foreground">View & edit inventory</p>
                </div>
              </CardContent>
            </Card>
            <Card
              className="border-border/60 cursor-pointer transition-all hover:border-primary/50"
              onClick={() => navigate("/seller/orders")}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <ShoppingBag className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium text-sm">View Orders</p>
                  <p className="text-xs text-muted-foreground">Track customer orders</p>
                </div>
              </CardContent>
            </Card>
            <Card
              className="border-border/60 cursor-pointer transition-all hover:border-primary/50"
              onClick={() => navigate("/seller/analytics")}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <BarChart3 className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium text-sm">Analytics</p>
                  <p className="text-xs text-muted-foreground">Sales insights</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Empty State */}
          {!statsLoading && stats.totalOrders === 0 && stats.productsActive === 0 && (
            <Card className="mt-6 border-border/60">
              <CardContent className="py-8 text-center">
                <Package className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <h3 className="font-medium mb-1">Start Selling</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Add your first product to get started
                </p>
                <Button onClick={() => navigate("/seller/products/new")}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Your First Product
                </Button>
              </CardContent>
            </Card>
          )}
        </main>
      </div>
    </SellerRouteGuard>
  );
}
