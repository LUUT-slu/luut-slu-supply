import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface SellerOrderItem {
  id: string;
  order_id: string;
  product_name: string;
  product_image_url: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  product_id: string | null;
  seller_id: string | null;
}

export interface SellerOrder {
  id: string;
  order_number: number;
  customer_name: string;
  customer_phone: string | null;
  location: string;
  preferred_date: string;
  pickup_time: string | null;
  pickup_time_window: string | null;
  note: string | null;
  seller_notes: string | null;
  status: string;
  total_price: number;
  created_at: string;
  updated_at: string;
  last_edited_at: string | null;
  last_edited_by: string | null;
  source?: string | null;
  shopify_order_id?: string | null;
  shopify_order_name?: string | null;
  order_token?: string | null;
  items: SellerOrderItem[];

}

export type OrderStatus = "pending" | "confirmed" | "completed" | "cancelled" | "no-show";

export const ORDER_STATUSES: { value: OrderStatus; label: string; color: string }[] = [
  { value: "pending", label: "Pending", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  { value: "confirmed", label: "Confirmed", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  { value: "completed", label: "Completed", color: "bg-green-500/20 text-green-400 border-green-500/30" },
  { value: "cancelled", label: "Cancelled", color: "bg-red-500/20 text-red-400 border-red-500/30" },
  { value: "no-show", label: "No-Show", color: "bg-muted text-muted-foreground border-border" },
];

export function useSellerOrders(sellerProfileId: string | undefined) {
  const [orders, setOrders] = useState<SellerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  // Stable ref to prevent re-fetching when sellerProfileId reference hasn't actually changed
  const lastFetchedId = useRef<string | undefined>();

  const fetchOrders = useCallback(async () => {
    if (!sellerProfileId) {
      setOrders([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data: orderItems, error: itemsError } = await supabase
        .from("order_items")
        .select("*")
        .eq("seller_id", sellerProfileId);

      if (itemsError) throw itemsError;

      if (!orderItems || orderItems.length === 0) {
        setOrders([]);
        setLoading(false);
        lastFetchedId.current = sellerProfileId;
        return;
      }

      const orderIds = [...new Set(orderItems.map((item) => item.order_id))];

      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select("*")
        .in("id", orderIds)
        .order("created_at", { ascending: false });

      if (ordersError) throw ordersError;

      const ordersWithItems: SellerOrder[] = (ordersData || []).map((order) => ({
        ...order,
        items: orderItems.filter((item) => item.order_id === order.id),
      }));

      setOrders(ordersWithItems);
      lastFetchedId.current = sellerProfileId;
    } catch (error) {
      console.error("Error fetching seller orders:", error);
      toast.error("Failed to load orders");
    } finally {
      setLoading(false);
    }
  }, [sellerProfileId]);

  useEffect(() => {
    // Only fetch if the ID actually changed to prevent infinite loops
    if (sellerProfileId && sellerProfileId !== lastFetchedId.current) {
      fetchOrders();
    } else if (!sellerProfileId) {
      setOrders([]);
      setLoading(false);
    }
  }, [sellerProfileId, fetchOrders]);

  const updateOrderStatus = async (orderId: string, newStatus: OrderStatus) => {
    try {
      const { error } = await supabase
        .from("orders")
        .update({
          status: newStatus,
          updated_at: new Date().toISOString(),
          last_edited_at: new Date().toISOString(),
        })
        .eq("id", orderId);

      if (error) throw error;

      setOrders((prev) =>
        prev.map((order) =>
          order.id === orderId ? { ...order, status: newStatus } : order
        )
      );

      toast.success(`Order marked as ${newStatus}`);
      return true;
    } catch (error) {
      console.error("Error updating order status:", error);
      toast.error("Failed to update order status");
      return false;
    }
  };

  const updateOrder = async (
    orderId: string,
    updates: {
      preferred_date?: string;
      pickup_time?: string;
      location?: string;
      seller_notes?: string;
    }
  ) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from("orders")
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
          last_edited_at: new Date().toISOString(),
          last_edited_by: user?.id || null,
        })
        .eq("id", orderId);

      if (error) throw error;

      setOrders((prev) =>
        prev.map((order) =>
          order.id === orderId ? { ...order, ...updates } : order
        )
      );

      toast.success("Order updated successfully");
      return true;
    } catch (error) {
      console.error("Error updating order:", error);
      toast.error("Failed to update order");
      return false;
    }
  };

  const updateOrderItem = async (itemId: string, quantity: number) => {
    try {
      const item = orders.flatMap((o) => o.items).find((i) => i.id === itemId);
      if (!item) throw new Error("Item not found");

      const newTotalPrice = item.unit_price * quantity;

      const { error } = await supabase
        .from("order_items")
        .update({ quantity, total_price: newTotalPrice })
        .eq("id", itemId);

      if (error) throw error;

      setOrders((prev) =>
        prev.map((order) => ({
          ...order,
          items: order.items.map((i) =>
            i.id === itemId ? { ...i, quantity, total_price: newTotalPrice } : i
          ),
        }))
      );

      return true;
    } catch (error) {
      console.error("Error updating order item:", error);
      toast.error("Failed to update item");
      return false;
    }
  };

  const deleteOrderItem = async (orderId: string, itemId: string) => {
    try {
      const { error } = await supabase
        .from("order_items")
        .delete()
        .eq("id", itemId);

      if (error) throw error;

      setOrders((prev) =>
        prev.map((order) =>
          order.id === orderId
            ? { ...order, items: order.items.filter((i) => i.id !== itemId) }
            : order
        )
      );

      toast.success("Item removed");
      return true;
    } catch (error) {
      console.error("Error deleting order item:", error);
      toast.error("Failed to remove item");
      return false;
    }
  };

  const deleteOrder = async (orderId: string) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return false;

    const canDelete =
      order.status === "cancelled" ||
      order.status === "no-show" ||
      (order.status === "pending" &&
        new Date(order.created_at) < new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));

    if (!canDelete) {
      toast.error("Cannot delete this order");
      return false;
    }

    try {
      const { error: itemsError } = await supabase
        .from("order_items")
        .delete()
        .eq("order_id", orderId);

      if (itemsError) throw itemsError;

      const { error: orderError } = await supabase
        .from("orders")
        .delete()
        .eq("id", orderId);

      if (orderError) throw orderError;

      setOrders((prev) => prev.filter((o) => o.id !== orderId));
      toast.success("Order deleted");
      return true;
    } catch (error) {
      console.error("Error deleting order:", error);
      toast.error("Failed to delete order");
      return false;
    }
  };

  return {
    orders,
    loading,
    refetch: fetchOrders,
    updateOrderStatus,
    updateOrder,
    updateOrderItem,
    deleteOrderItem,
    deleteOrder,
  };
}
