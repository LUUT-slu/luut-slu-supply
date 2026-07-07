import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Package,
  Users,
  UserCheck,
  Store,
  LogOut,
  Home,
  ClipboardList,
  Settings,
  Truck,
  BarChart3,
  Megaphone,
  Boxes,
} from "lucide-react";
import { toast } from "sonner";

interface AdminStats {
  totalOrders: number;
  pendingOrders: number;
  pendingSellerRequests: number;
  activeSellers: number;
}

export default function AdminHome() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<AdminStats>({
    totalOrders: 0,
    pendingOrders: 0,
    pendingSellerRequests: 0,
    activeSellers: 0,
  });
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      navigate("/seller-auth", { replace: true });
      return;
    }
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id);
    const hasAdminRole = roles?.some((r) => (r.role as string) === "admin");
    if (!hasAdminRole) {
      toast.error("Admin access required");
      navigate("/seller-auth", { replace: true });
      return;
    }
    setIsAdmin(true);
    setCheckingAuth(false);
    fetchStats();
  };

  const fetchStats = async () => {
    setLoading(true);
    try {
      const [ordersResult, pendingResult, sellersResult, approvedResult] = await Promise.all([
        supabase.from("orders").select("*", { count: "exact", head: true }),
        supabase.from("orders").select("*", { count: "exact", head: true }).in("status", ["pending", "new"]),
        supabase.from("seller_applications").select("*", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("seller_profiles").select("*", { count: "exact", head: true }).eq("is_approved", true),
      ]);
      setStats({
        totalOrders: ordersResult.count || 0,
        pendingOrders: pendingResult.count || 0,
        pendingSellerRequests: sellersResult.count || 0,
        activeSellers: approvedResult.count || 0,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logged out successfully");
    navigate("/", { replace: true });
  };

  if (checkingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAdmin) return null;

  const statsChips = [
    { label: "Orders", count: stats.totalOrders, icon: Package, color: "text-muted-foreground" },
    { label: "Pending", count: stats.pendingOrders, icon: ClipboardList, color: "text-blue-500" },
    { label: "Requests", count: stats.pendingSellerRequests, icon: UserCheck, color: "text-yellow-500" },
    { label: "Sellers", count: stats.activeSellers, icon: Store, color: "text-green-500" },
  ];

  const hubCards = [
    {
      title: "Orders & Fulfillment",
      description: "Customer orders, dispatch, purchase orders & reports",
      icon: ClipboardList,
      href: "/admin/orders",
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
      tabs: ["Orders", "Dispatch", "Purchase Orders", "Reports"],
      highlight: stats.pendingOrders > 0,
    },
    {
      title: "Customer Info",
      description: "Accounts, unclaimed, spend, loyalty & signups",
      icon: Users,
      href: "/admin/customers",
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
      tabs: ["Directory", "Claimed", "Unclaimed", "Spend", "Loyalty", "Signups"],
    },
    {
      title: "Sellers & Partners",
      description: "Approve applications, manage roster & delivery partners",
      icon: UserCheck,
      href: "/admin/approvals",
      color: "text-green-500",
      bgColor: "bg-green-500/10",
      tabs: ["Approvals", "Verified Sellers", "Delivery Partners"],
      highlight: stats.pendingSellerRequests > 0,
    },
    {
      title: "Catalog",
      description: "Products, category images & reviews",
      icon: Boxes,
      href: "/admin/products",
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
      tabs: ["Products", "Category Images", "Reviews"],
    },
    {
      title: "Marketing",
      description: "Promotions, studio, content library, discounts & popups",
      icon: Megaphone,
      href: "/admin/promotions",
      color: "text-fuchsia-500",
      bgColor: "bg-fuchsia-500/10",
      tabs: ["Promotions", "Studio", "Content Library", "Discounts", "Popups"],
    },
    {
      title: "Analytics & Health",
      description: "Sales, traffic and Shopify connection diagnostics",
      icon: BarChart3,
      href: "/admin/analytics",
      color: "text-cyan-500",
      bgColor: "bg-cyan-500/10",
      tabs: ["Analytics", "Connection Health"],
    },
    {
      title: "Site Settings",
      description: "Homepage layout, hero, checkout & visibility controls",
      icon: Settings,
      href: "/admin/site-settings",
      color: "text-pink-500",
      bgColor: "bg-pink-500/10",
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 w-full border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between">
          <Link to="/" className="font-display text-xl tracking-wide text-primary">
            Home
          </Link>
          <div className="flex items-center gap-1">
            <Button
              onClick={() => navigate("/admin/site-settings")}
              variant="ghost"
              size="sm"
              className="gap-2 text-muted-foreground hover:text-primary"
            >
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Settings</span>
            </Button>
            <Button onClick={handleLogout} variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-destructive">
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="container flex-1 py-4 md:py-6">
        <div className="mb-4">
          <h1 className="font-display text-xl md:text-2xl">Admin Control Panel</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Everything grouped — pick a hub, then tab through its sections.
          </p>
        </div>

        {/* Compact Stats Bar */}
        <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {statsChips.map((chip) => (
            <div
              key={chip.label}
              className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-card/50 px-3 py-2.5 h-14"
            >
              <chip.icon className={`h-4 w-4 ${chip.color} shrink-0`} />
              <div className="flex items-baseline gap-1.5 min-w-0">
                <span className="text-xs text-muted-foreground truncate">{chip.label}</span>
                <span className="font-semibold text-sm">{loading ? "..." : chip.count}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Hub Cards */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {hubCards.map((card) => (
            <Card
              key={card.title}
              className={`cursor-pointer transition-all hover:border-primary/50 hover:shadow-md ${
                card.highlight ? "border-yellow-500/50 bg-yellow-500/5" : ""
              }`}
              onClick={() => navigate(card.href)}
            >
              <CardHeader className="flex flex-row items-start gap-3 pb-2 pt-4 px-4">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${card.bgColor} shrink-0`}>
                  <card.icon className={`h-5 w-5 ${card.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base">{card.title}</CardTitle>
                  <CardDescription className="text-xs mt-0.5">{card.description}</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-2">
                {card.tabs ? (
                  <div className="flex flex-wrap gap-1">
                    {card.tabs.map((t) => (
                      <span
                        key={t}
                        className="rounded-md border border-border/60 bg-muted/50 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                ) : (
                  <Button variant="outline" size="sm" className="w-full text-xs h-8">
                    Open →
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Footer shortcuts */}
        <div className="mt-8 flex flex-wrap items-center gap-2 border-t border-border/40 pt-4">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground mr-1">Shortcuts</span>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8" onClick={() => navigate("/seller/dashboard")}>
            <Store className="h-3.5 w-3.5" /> My Seller Dashboard
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8" onClick={() => navigate("/")}>
            <Home className="h-3.5 w-3.5" /> Open Storefront
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8" onClick={() => navigate("/connect")}>
            <Truck className="h-3.5 w-3.5" /> Dispatch
          </Button>
        </div>
      </main>
    </div>
  );
}
