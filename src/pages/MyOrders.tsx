import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { BackButton } from "@/components/BackButton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Package, Clock, CheckCircle, XCircle, ShoppingBag, ChevronRight } from "lucide-react";
import { ListItemSkeleton } from "@/components/skeletons/TableSkeleton";

interface Order {
  id: string;
  order_number: number;
  customer_name: string;
  location: string;
  preferred_date: string;
  note: string | null;
  status: string;
  total_price: number;
  currency_code: string;
  line_items: Array<{
    title: string;
    quantity: number;
    price: string;
  }>;
  created_at: string;
  order_token: string;
}

const statusConfig: Record<string, { label: string; icon: typeof Clock; color: string }> = {
  pending: { label: "Pending", icon: Clock, color: "bg-yellow-500" },
  confirmed: { label: "Confirmed", icon: CheckCircle, color: "bg-blue-500" },
  completed: { label: "Completed", icon: CheckCircle, color: "bg-green-500" },
  cancelled: { label: "Cancelled", icon: XCircle, color: "bg-red-500" },
};

export default function MyOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMyOrders = async () => {
      const savedOrderIds: string[] = JSON.parse(
        localStorage.getItem("luut-my-orders") || "[]",
      );
      const orderTokens: Record<string, string> = JSON.parse(
        localStorage.getItem("luut-order-tokens") || "{}",
      );

      // 1. Token-based (guest) orders
      const tokenResults = await Promise.all(
        savedOrderIds.map(async (id) => {
          const token = orderTokens[id];
          if (!token) return null;
          const { data, error } = await supabase.rpc("rpc_get_order_by_token", {
            p_order_id: id,
            p_token: token,
          });
          if (error) {
            console.error("Failed to fetch order", id, error);
            return null;
          }
          const row = Array.isArray(data) ? data[0] : data;
          return row || null;
        }),
      );

      // 2. Signed-in / claimed orders (RLS scoped by customer_user_id)
      const { data: sessionData } = await supabase.auth.getSession();
      let claimedResults: any[] = [];
      if (sessionData?.session?.user?.id) {
        const uid = sessionData.session.user.id;
        const { data } = await supabase
          .from("orders")
          .select("*")
          .eq("customer_user_id", uid)
          .order("created_at", { ascending: false })
          .limit(200);
        claimedResults = data || [];
      }

      const byId = new Map<string, any>();
      for (const r of [...tokenResults, ...claimedResults]) {
        if (r && r.id && !byId.has(r.id)) byId.set(r.id, r);
      }
      const fetched = Array.from(byId.values()).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );

      setOrders(fetched as unknown as Order[]);
      setLoading(false);
    };

    fetchMyOrders();
  }, []);


  const formatOrderNumber = (num: number) => `#L${String(num).padStart(4, '0')}`;
  
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getStatusBadge = (status: string) => {
    const config = statusConfig[status] || statusConfig.pending;
    return (
      <Badge variant="outline" className="gap-1">
        <span className={`h-2 w-2 rounded-full ${config.color}`} />
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      
      <main className="container flex-1 py-8">
        <div className="mb-6 flex items-center gap-4">
          <BackButton />
          <div>
            <h1 className="font-display text-3xl">My Orders</h1>
            <p className="text-muted-foreground">Track your meetup orders</p>
          </div>
        </div>

        {loading ? (
          <ListItemSkeleton rows={4} />
        ) : orders.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <ShoppingBag className="mb-4 h-16 w-16 text-muted-foreground" />
              <h3 className="mb-2 text-xl font-medium">No orders yet</h3>
              <p className="mb-6 max-w-sm text-muted-foreground">
                When you place an order, it will appear here so you can track its status.
              </p>
              <Button asChild>
                <Link to="/shop">Start Shopping</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {orders.map((order) => (
              <Link key={order.id} to={`/order/${order.id}`}>
                <Card className="transition-colors hover:bg-card/80 cursor-pointer">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Package className="h-5 w-5" />
                        {formatOrderNumber(order.order_number)}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Placed on {formatDate(order.created_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(order.status)}
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </CardHeader>
                  <CardContent className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-sm">📍 {order.location}</p>
                      <p className="text-sm">📅 {order.preferred_date}</p>
                    </div>
                    <div className="text-right">
                      <span className="font-display text-lg text-primary">
                        EC${order.total_price.toFixed(2)}
                      </span>
                      <p className="text-xs text-muted-foreground">
                        {order.line_items.length} item{order.line_items.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
