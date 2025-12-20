import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { DollarSign, Package, TrendingUp, Calendar, LogOut, Store } from "lucide-react";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";

interface SellerProfile {
  id: string;
  seller_name: string;
  seller_id: string | null;
  is_approved: boolean;
  whatsapp: string | null;
  location: string | null;
}

interface SalesStats {
  totalSales: number;
  totalRevenue: number;
  thisMonthSales: number;
  thisMonthRevenue: number;
}

export default function SellerDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<SellerProfile | null>(null);
  const [stats, setStats] = useState<SalesStats>({
    totalSales: 0,
    totalRevenue: 0,
    thisMonthSales: 0,
    thisMonthRevenue: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session?.user) {
        navigate("/seller-auth");
      } else {
        setUser(session.user);
        setTimeout(() => {
          fetchProfile(session.user.id);
          fetchStats(session.user.id);
        }, 0);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) {
        navigate("/seller-auth");
      } else {
        setUser(session.user);
        fetchProfile(session.user.id);
        fetchStats(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from("seller_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("Error fetching profile:", error);
      toast.error("Failed to load profile");
      return;
    }

    if (!data) {
      // No seller profile, redirect to auth
      navigate("/seller-auth");
      return;
    }

    setProfile(data);
    setIsLoading(false);
  };

  const fetchStats = async (userId: string) => {
    // Get all sales for this seller
    const { data: allSales } = await supabase
      .from("product_sales")
      .select("*")
      .eq("seller_user_id", userId);

    // Get this month's sales
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { data: monthSales } = await supabase
      .from("product_sales")
      .select("*")
      .eq("seller_user_id", userId)
      .gte("sold_at", startOfMonth.toISOString());

    setStats({
      totalSales: allSales?.reduce((acc, sale) => acc + sale.quantity, 0) || 0,
      totalRevenue: allSales?.reduce((acc, sale) => acc + Number(sale.price_amount) * sale.quantity, 0) || 0,
      thisMonthSales: monthSales?.reduce((acc, sale) => acc + sale.quantity, 0) || 0,
      thisMonthRevenue: monthSales?.reduce((acc, sale) => acc + Number(sale.price_amount) * sale.quantity, 0) || 0,
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logged out successfully");
    navigate("/");
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "XCD",
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className="flex-1 py-8">
        <div className="container">
          {/* Header */}
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Store className="h-6 w-6 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-display text-2xl md:text-3xl">{profile?.seller_name}</h1>
                  {profile?.seller_id && (
                    <span className="rounded bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
                      {profile.seller_id}
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {profile?.is_approved ? "Verified Seller" : "Pending Approval"}
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={handleLogout} className="gap-2">
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>

          {/* Approval Status Banner */}
          {!profile?.is_approved && (
            <Card className="mb-8 border-primary/50 bg-primary/5">
              <CardContent className="py-4">
                <p className="text-sm">
                  <strong>Pending Approval:</strong> Your seller account is being reviewed. 
                  Once approved, your products will be visible to customers.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Stats Grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Revenue
                </CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</div>
                <p className="text-xs text-muted-foreground">All time earnings</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Sales
                </CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalSales}</div>
                <p className="text-xs text-muted-foreground">Items sold</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  This Month
                </CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(stats.thisMonthRevenue)}</div>
                <p className="text-xs text-muted-foreground">{stats.thisMonthSales} items sold</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Avg. Order Value
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats.totalSales > 0 
                    ? formatCurrency(stats.totalRevenue / stats.totalSales) 
                    : formatCurrency(0)}
                </div>
                <p className="text-xs text-muted-foreground">Per item</p>
              </CardContent>
            </Card>
          </div>

          {/* Empty State */}
          {stats.totalSales === 0 && (
            <Card className="mt-8">
              <CardContent className="py-12 text-center">
                <Package className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="font-display text-xl mb-2">No Sales Yet</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Once your account is approved and you start making sales, 
                  your statistics will appear here.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}