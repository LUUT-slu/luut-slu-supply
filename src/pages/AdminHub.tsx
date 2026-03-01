import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";

import { AdminAuth } from "@/components/AdminAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Package,
  Users,
  UserCheck,
  Truck,
  Store,
  Settings,
  LogOut,
  ClipboardList,
  ShieldCheck,
  TrendingUp,
  Home,
} from "lucide-react";
import { toast } from "sonner";

interface AdminStats {
  totalOrders: number;
  pendingOrders: number;
  pendingSellerRequests: number;
  activePartners: number;
  activeSellers: number;
}

export default function AdminHub() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<AdminStats>({
    totalOrders: 0,
    pendingOrders: 0,
    pendingSellerRequests: 0,
    activePartners: 0,
    activeSellers: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    try {
      // Fetch orders count
      const { count: totalOrders } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true });

      const { count: pendingOrders } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .in("status", ["pending", "new"]);

      // Fetch pending seller applications
      const { count: pendingSellerRequests } = await supabase
        .from("seller_applications")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");

      // Fetch active partners
      const { count: activePartners } = await supabase
        .from("partner_profiles")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true);

      // Fetch active sellers
      const { count: activeSellers } = await supabase
        .from("seller_profiles")
        .select("*", { count: "exact", head: true })
        .eq("is_approved", true);

      setStats({
        totalOrders: totalOrders || 0,
        pendingOrders: pendingOrders || 0,
        pendingSellerRequests: pendingSellerRequests || 0,
        activePartners: activePartners || 0,
        activeSellers: activeSellers || 0,
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
    navigate("/");
  };

  const adminModules = [
    {
      title: "Order Management",
      description: "View, assign, and manage all customer orders",
      icon: Package,
      href: "/admin-orders",
      stat: stats.pendingOrders > 0 ? `${stats.pendingOrders} pending` : `${stats.totalOrders} total`,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      title: "Seller Requests",
      description: "Review and approve seller applications",
      icon: UserCheck,
      href: "/admin-sellers",
      stat: stats.pendingSellerRequests > 0 ? `${stats.pendingSellerRequests} pending` : "All reviewed",
      color: "text-green-500",
      bgColor: "bg-green-500/10",
      highlight: stats.pendingSellerRequests > 0,
    },
    {
      title: "Partner Management",
      description: "Manage delivery partners and assignments",
      icon: Truck,
      href: "/connect",
      stat: `${stats.activePartners} active`,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
    },
    {
      title: "Verified Sellers",
      description: "View and manage approved seller profiles",
      icon: Store,
      href: "/admin/sellers",
      stat: `${stats.activeSellers} active`,
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
    },
    {
      title: "My Seller Dashboard",
      description: "Access your own seller sales and stats",
      icon: TrendingUp,
      href: "/seller/dashboard",
      stat: "View sales",
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Site Settings",
      description: "Control popups, checkout, and product visibility",
      icon: Settings,
      href: "/admin/site-settings",
      stat: "Manage",
      color: "text-pink-500",
      bgColor: "bg-pink-500/10",
    },
  ];

  return (
    <AdminAuth>
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
                <h1 className="font-display text-2xl md:text-3xl">Admin Hub</h1>
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
              <Button onClick={() => navigate("/admin/site-settings")} variant="outline" size="sm" className="gap-2">
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline">Settings</span>
              </Button>
              <Button onClick={handleLogout} variant="outline" size="sm" className="gap-2">
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
                <CardTitle className="text-sm font-medium">Pending Requests</CardTitle>
                <UserCheck className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{loading ? "..." : stats.pendingSellerRequests}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Active Partners</CardTitle>
                <Truck className="h-4 w-4 text-purple-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{loading ? "..." : stats.activePartners}</div>
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
                key={module.href}
                className={`cursor-pointer transition-all hover:border-primary/50 hover:shadow-md ${
                  module.highlight ? "border-yellow-500/50 bg-yellow-500/5" : ""
                }`}
                onClick={() => navigate(module.href)}
              >
                <CardHeader className="flex flex-row items-start gap-4">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${module.bgColor}`}>
                    <module.icon className={`h-6 w-6 ${module.color}`} />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-lg">{module.title}</CardTitle>
                    <CardDescription className="mt-1">
                      {module.description}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-medium ${module.highlight ? "text-yellow-600" : "text-muted-foreground"}`}>
                      {module.stat}
                    </span>
                    <Button variant="ghost" size="sm">
                      Open →
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </main>
      </div>
    </AdminAuth>
  );
}
