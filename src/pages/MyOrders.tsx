import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { BackButton } from "@/components/BackButton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Clock, CheckCircle, XCircle, ShoppingBag } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

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
      // Get saved order IDs from localStorage
      const savedOrderIds = JSON.parse(localStorage.getItem("luut-my-orders") || "[]");
      
      if (savedOrderIds.length === 0) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .in("id", savedOrderIds)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Failed to fetch orders:", error);
      } else {
        setOrders((data || []) as unknown as Order[]);
      }
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
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
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
              <Card key={order.id}>
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
                  {getStatusBadge(order.status)}
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <h4 className="mb-2 text-sm font-medium text-muted-foreground">Meetup Details</h4>
                    <p className="text-sm">📍 {order.location}</p>
                    <p className="text-sm">📅 {order.preferred_date}</p>
                    {order.note && <p className="text-sm">📝 {order.note}</p>}
                  </div>
                  <div>
                    <h4 className="mb-2 text-sm font-medium text-muted-foreground">Items</h4>
                    {order.line_items.map((item, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span>{item.title} x{item.quantity}</span>
                        <span>EC${parseFloat(item.price).toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="mt-2 flex justify-between border-t pt-2 font-medium">
                      <span>Total</span>
                      <span>EC${order.total_price.toFixed(2)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
