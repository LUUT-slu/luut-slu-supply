import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
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

  const adminModules = [
    {
      title: "Manage Sellers",
      description: "Approve applications & manage seller profiles",
      icon: Users,
      href: "/admin/approvals",
      stat: stats.pendingSellerRequests > 0 
        ? `${stats.pendingSellerRequests} pending` 
        : `${stats.activeSellers} active`,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
      highlight: stats.pendingSellerRequests > 0,
      subLinks: [
        { label: "Approve Requests", href: "/admin/approvals" },
        { label: "View Sellers", href: "/admin/sellers" },
      ],
    },
    {
      title: "Assign Orders",
      description: "Assign orders to delivery partners",
      icon: ClipboardList,
      href: "/admin-orders",
      stat: stats.pendingOrders > 0 ? `${stats.pendingOrders} pending` : "All assigned",
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
      highlight: stats.pendingOrders > 0,
    },
    {
      title: "View All Orders",
      description: "Browse complete order history",
      icon: Package,
      href: "/admin/orders",
      stat: `${stats.totalOrders} total`,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
    },
    {
      title: "Switch to Seller View",
      description: "Access your own seller dashboard",
      icon: TrendingUp,
      href: "/seller",
      stat: "View sales",
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className="container flex-1 py-8">
        {/* Header */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <ShieldCheck className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h1 className="font-display text-2xl md:text-3xl">Admin Home</h1>
              <p className="text-sm text-muted-foreground">
                Central control panel for Luut SLU
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => navigate("/")} variant="outline" size="sm" className="gap-2">
              <Home className="h-4 w-4" />
              <span className="hidden sm:inline">Home</span>
            </Button>
            <Button onClick={handleLogout} variant="destructive" size="sm" className="gap-2">
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loading ? "..." : stats.totalOrders}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pending Orders</CardTitle>
              <ClipboardList className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loading ? "..." : stats.pendingOrders}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Seller Requests</CardTitle>
              <UserCheck className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loading ? "..." : stats.pendingSellerRequests}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Active Sellers</CardTitle>
              <Store className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loading ? "..." : stats.activeSellers}</div>
            </CardContent>
          </Card>
        </div>

        {/* Admin Modules */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {adminModules.map((module) => (
            <Card
              key={module.title}
              className={`transition-all hover:border-primary/50 hover:shadow-md ${
                module.highlight ? "border-yellow-500/50 bg-yellow-500/5" : ""
              }`}
            >
              <CardHeader className="flex flex-row items-start gap-4">
                <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${module.bgColor}`}>
                  <module.icon className={`h-6 w-6 ${module.color}`} />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-lg">{module.title}</CardTitle>
                  <CardDescription className="mt-1">{module.description}</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-sm font-medium ${module.highlight ? "text-yellow-600" : "text-muted-foreground"}`}>
                    {module.stat}
                  </span>
                </div>
                {module.subLinks ? (
                  <div className="flex flex-wrap gap-2">
                    {module.subLinks.map((link) => (
                      <Button
                        key={link.href}
                        variant="outline"
                        size="sm"
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
                    className="w-full"
                    onClick={() => navigate(module.href)}
                  >
                    Open →
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </main>

      <Footer />
    </div>
  );
}
