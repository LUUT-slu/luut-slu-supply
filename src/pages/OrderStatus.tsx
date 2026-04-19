import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, MapPin, Calendar, Clock, Package } from "lucide-react";

interface OrderRow {
  id: string;
  order_number: number;
  customer_name: string;
  location: string;
  preferred_date: string;
  pickup_time: string | null;
  pickup_time_window: string | null;
  total_price: number;
  currency_code: string;
  line_items: Array<{ title: string; quantity: number; price: string }>;
  status: string;
  order_status: string | null;
  order_token: string;
  note: string | null;
}

export default function OrderStatus() {
  const { orderId } = useParams<{ orderId: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";

  const [order, setOrder] = useState<OrderRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOrder = async () => {
      if (!orderId || !token) {
        setError("Invalid order link. Missing access token.");
        setLoading(false);
        return;
      }

      const { data, error: fetchErr } = await supabase
        .from("orders")
        .select(
          "id, order_number, customer_name, location, preferred_date, pickup_time, pickup_time_window, total_price, currency_code, line_items, status, order_status, order_token, note",
        )
        .eq("id", orderId)
        .maybeSingle();

      if (fetchErr || !data) {
        setError("Order not found.");
        setLoading(false);
        return;
      }

      // Validate token client-side (RLS allows public select on orders, but we
      // gate the page behind the order_token to prevent enumeration).
      if (data.order_token !== token) {
        setError("Invalid or expired order link.");
        setLoading(false);
        return;
      }

      setOrder(data as OrderRow);
      setLoading(false);
    };

    fetchOrder();
  }, [orderId, token]);

  const orderNum = order ? `#L${String(order.order_number).padStart(4, "0")}` : "";
  const status = order?.order_status || order?.status || "pending";
  const pickupTime = order?.pickup_time || order?.pickup_time_window || "";

  const statusVariant = (s: string) => {
    const u = s.toUpperCase();
    if (u.includes("COMPLETE")) return "default";
    if (u.includes("CANCEL")) return "destructive";
    if (u.includes("CONFIRM") || u.includes("ACCEPT") || u.includes("ASSIGN")) return "secondary";
    return "outline";
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 container max-w-2xl mx-auto px-4 py-8">
        {loading ? (
          <div className="flex justify-center items-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <Card>
            <CardHeader>
              <CardTitle>Unable to load order</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{error}</p>
            </CardContent>
          </Card>
        ) : order ? (
          <div className="space-y-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="text-sm text-muted-foreground">Order</p>
                <h1 className="text-2xl font-bold font-mono">{orderNum}</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Hi {order.customer_name}, here are your order details.
                </p>
              </div>
              <Badge variant={statusVariant(status)} className="uppercase">
                {status}
              </Badge>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="h-4 w-4" /> Items
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="divide-y">
                  {order.line_items.map((it, idx) => {
                    const qty = it.quantity || 1;
                    const unit = parseFloat(it.price || "0");
                    return (
                      <li key={idx} className="py-3 flex justify-between text-sm">
                        <div>
                          <div className="font-medium">{it.title}</div>
                          <div className="text-muted-foreground">Qty {qty}</div>
                        </div>
                        <div className="font-mono">EC${(qty * unit).toFixed(2)}</div>
                      </li>
                    );
                  })}
                </ul>
                <div className="border-t mt-3 pt-3 flex justify-between font-bold">
                  <span>Total</span>
                  <span className="font-mono">EC${order.total_price.toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Pickup details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{order.location}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>{order.preferred_date}</span>
                </div>
                {pickupTime && (
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>{pickupTime}</span>
                  </div>
                )}
                {order.note && (
                  <div className="text-muted-foreground pt-2 border-t mt-3">
                    <span className="font-medium">Note:</span> {order.note}
                  </div>
                )}
              </CardContent>
            </Card>

            <p className="text-xs text-muted-foreground text-center">
              Payment is collected on meetup. Save this link to check your order anytime.
            </p>
          </div>
        ) : null}
      </main>
      <Footer />
    </div>
  );
}
