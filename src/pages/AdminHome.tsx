import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { BackButton } from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Package,
  Users,
  UserCheck,
  Store,
  LogOut,
  ShieldCheck,
  TrendingUp,
  Home,
  ClipboardList,
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

    const hasAdminRole = roles?.some(r => (r.role as string) === "admin");
    
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

  const actionCards = [
    {
      title: "Manage Sellers",
      description: "Approve applications & manage profiles",
      icon: Users,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
      highlight: stats.pendingSellerRequests > 0,
      subLinks: [
        { label: "Approve Requests", href: "/admin/approvals" },
        { label: "View Sellers", href: "/admin/sellers" },
      ],
    },
    {
      title: "Partner Management",
      description: "View & manage delivery partners",
      icon: Users,
      href: "/admin/partners",
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      title: "View All Orders",
      description: "Browse complete order history",
      icon: Package,
      href: "/admin/orders",
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Custom Admin Header */}
      <header className="sticky top-0 z-40 w-full border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between">
          <Link to="/" className="font-display text-xl tracking-wide text-primary">
            Home
          </Link>
          <Button onClick={handleLogout} variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-destructive">
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>
      </header>

      <main className="container flex-1 py-4 md:py-6">
        {/* Page Title - Compact */}
        <div className="mb-4">
          <h1 className="font-display text-xl md:text-2xl">Admin Control Panel</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Approve sellers, assign orders, track drops.
          </p>
        </div>

        {/* Compact Stats Bar - 2x2 Grid */}
        <div className="mb-5 grid grid-cols-2 gap-2">
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

        {/* Action Cards */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {actionCards.map((card) => (
            <Card
              key={card.title}
              className={`transition-all hover:border-primary/50 ${
                card.highlight ? "border-yellow-500/50 bg-yellow-500/5" : ""
              }`}
            >
              <CardHeader className="flex flex-row items-start gap-3 pb-2 pt-4 px-4">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${card.bgColor} shrink-0`}>
                  <card.icon className={`h-5 w-5 ${card.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base">{card.title}</CardTitle>
                  <CardDescription className="text-xs mt-0.5 line-clamp-1">{card.description}</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-2">
                {card.subLinks ? (
                  <div className="flex flex-wrap gap-2">
                    {card.subLinks.map((link) => (
                      <Button
                        key={link.href}
                        variant="outline"
                        size="sm"
                        className="text-xs h-8"
                        onClick={() => navigate(link.href)}
                      >
                        {link.label}
                      </Button>
                    ))}
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs h-8"
                    onClick={() => navigate(card.href!)}
                  >
                    Open →
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
