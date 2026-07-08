import { useState } from "react";
import { SellerAIPanel } from "@/components/seller/SellerAIPanel";
import { useNavigate } from "react-router-dom";
import { SellerNav } from "@/components/seller/SellerNav";
import { CreateOrderDialog } from "@/components/seller/CreateOrderDialog";
import { useSellerProfile } from "@/hooks/useSellerProfile";
import { useSellerStats, type StatsPeriod } from "@/hooks/useSellerStats";
import { useNextSellerOrders } from "@/hooks/useNextSellerOrders";
import { Card, CardContent } from "@/components/ui/card";
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
  Sparkles,
  ChevronRight,
  Inbox,
  Circle,
} from "lucide-react";

export default function SellerDashboardNew() {
  const navigate = useNavigate();
  const { profile } = useSellerProfile();
  const [period, setPeriod] = useState<StatsPeriod>("day");
  const { stats, loading: statsLoading } = useSellerStats(profile?.id, undefined, period);
  const { orders: nextOrders, loading: nextLoading } = useNextSellerOrders(profile?.id, 5);

  const periodLabel = period === "day" ? "Today" : period === "week" ? "This Week" : "This Month";
  const periodSubOrders = period === "day" ? "today" : period === "week" ? "this week" : "this month";

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "XCD",
      minimumFractionDigits: 0,
    }).format(amount);

  const kpiCards = [
    {
      title: "Today's Revenue",
      value: formatCurrency(stats.todayRevenue),
      subtitle: `${stats.todayOrders} order${stats.todayOrders === 1 ? "" : "s"} today`,
      icon: DollarSign,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
    {
      title: "Today's Orders",
      value: stats.todayOrders.toString(),
      subtitle: `${stats.todayReadyForPickup} ready for pickup`,
      icon: ShoppingBag,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      title: "Total Revenue",
      value: formatCurrency(stats.totalRevenue),
      subtitle: "all-time",
      icon: TrendingUp,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
    },
    {
      title: "Total Orders",
      value: stats.totalOrders.toString(),
      subtitle: `${stats.totalUnitsSold} units sold`,
      icon: Package,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
  ];

  const statusMeta = (s: string) => {
    const v = s?.toLowerCase();
    if (v === "confirmed") return { label: "Ready", dot: "text-green-500" };
    if (v === "pending") return { label: "Processing", dot: "text-muted-foreground" };
    return { label: s, dot: "text-primary" };
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
          {/* Header (unchanged) */}
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              {profile?.logo_url ? (
                <img
                  src={profile.logo_url}
                  alt={profile.seller_name}
                  className="h-14 w-14 rounded-full object-cover border-2 border-border aspect-square"
                />
              ) : (
                <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center aspect-square">
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

            <div className="flex gap-2 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate("/seller/products/new")}
                className="gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Product
              </Button>
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
            </div>
          </div>

          {/* KPI cards (2x2 mobile, 4-col desktop) */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-5">
            {kpiCards.map((kpi) => (
              <Card key={kpi.title} className="border-border/60">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-lg ${kpi.bgColor} shrink-0`}
                    >
                      <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground truncate">{kpi.title}</p>
                      <p className="font-semibold text-lg tabular-nums">
                        {statsLoading ? "…" : kpi.value}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                        {kpi.subtitle}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Marketing Studio */}
          <Card
            className="border-border/60 cursor-pointer transition-all hover:border-primary/50 mb-5"
            onClick={() => navigate("/admin/marketing-studio")}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">Marketing Studio</p>
                <p className="text-xs text-muted-foreground">Generate posters & content</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>

          {/* Next orders */}
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Next Orders to Complete
            </p>
            <Card className="border-border/60">
              <CardContent className="p-0">
                {nextLoading ? (
                  <div className="p-6 text-sm text-muted-foreground text-center">Loading…</div>
                ) : nextOrders.length === 0 ? (
                  <div className="py-10 flex flex-col items-center text-center px-4">
                    <Inbox className="h-8 w-8 text-muted-foreground mb-3" />
                    <p className="font-medium text-sm">No orders logged</p>
                    <p className="text-xs text-muted-foreground mt-1 mb-4">
                      New orders will show up here as they come in.
                    </p>
                    {profile?.id && (
                      <CreateOrderDialog
                        sellerId={profile.id}
                        sellerName={profile.seller_name}
                        sellerWhatsapp={profile.whatsapp}
                      />
                    )}
                  </div>
                ) : (
                  <ul className="divide-y divide-border/60">
                    {nextOrders.map((o) => {
                      const meta = statusMeta(o.status);
                      return (
                        <li
                          key={o.id}
                          onClick={() => navigate(`/seller/orders/${o.id}`)}
                          className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/40"
                        >
                          <Circle className={`h-2.5 w-2.5 fill-current ${meta.dot} shrink-0`} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-primary font-semibold text-sm tabular-nums">
                                #L{String(o.order_number).padStart(4, "0")}
                              </span>
                              <span className="text-sm truncate">{o.items_summary}</span>
                            </div>
                            <p className="text-xs text-muted-foreground truncate">
                              {o.customer_name} · {o.location}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-semibold tabular-nums">
                              {formatCurrency(o.total_price)}
                            </p>
                            <p className="text-[11px] text-muted-foreground">{meta.label}</p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Quick Links (unchanged) */}
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
            <Card
              className="border-border/60 cursor-pointer transition-all hover:border-primary/50"
              onClick={() => navigate("/seller/purchase-orders")}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <Package className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium text-sm">Purchase Orders</p>
                  <p className="text-xs text-muted-foreground">Track stock & profit</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
      <SellerAIPanel />
    </>
  );
}
