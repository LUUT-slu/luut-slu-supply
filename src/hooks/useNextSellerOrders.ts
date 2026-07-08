import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface NextOrder {
  id: string;
  order_number: number;
  customer_name: string;
  location: string;
  total_price: number;
  status: string;
  items_summary: string;
}

export function useNextSellerOrders(sellerId: string | undefined, limit = 5) {
  const [orders, setOrders] = useState<NextOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sellerId) {
      setOrders([]);
      setLoading(false);
      return;
    }
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const { data: items } = await supabase
          .from("order_items")
          .select("order_id, product_name, quantity")
          .eq("seller_id", sellerId);

        if (!items || items.length === 0) {
          if (!cancelled) setOrders([]);
          return;
        }

        const orderIds = [...new Set(items.map((i) => i.order_id))];

        const { data: ordersData } = await supabase
          .from("orders")
          .select("id, order_number, customer_name, location, total_price, status, preferred_date, created_at")
          .in("id", orderIds)
          .in("status", ["pending", "confirmed"])
          .order("created_at", { ascending: true })
          .limit(limit);

        if (!ordersData) {
          if (!cancelled) setOrders([]);
          return;
        }

        const itemsByOrder = new Map<string, { product_name: string; quantity: number }[]>();
        items.forEach((it) => {
          const arr = itemsByOrder.get(it.order_id) || [];
          arr.push({ product_name: it.product_name, quantity: it.quantity });
          itemsByOrder.set(it.order_id, arr);
        });

        const result: NextOrder[] = ordersData.map((o) => {
          const its = itemsByOrder.get(o.id) || [];
          const summary = its
            .slice(0, 2)
            .map((i) => `${i.quantity}× ${i.product_name}`)
            .join(" · ") + (its.length > 2 ? ` +${its.length - 2}` : "");
          return {
            id: o.id,
            order_number: o.order_number,
            customer_name: o.customer_name,
            location: o.location,
            total_price: Number(o.total_price),
            status: o.status,
            items_summary: summary,
          };
        });

        if (!cancelled) setOrders(result);
      } catch (err) {
        console.error("useNextSellerOrders error:", err);
        if (!cancelled) setOrders([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sellerId, limit]);

  return { orders, loading };
}
