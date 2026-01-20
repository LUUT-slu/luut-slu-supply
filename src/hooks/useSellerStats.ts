import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DateRange } from "react-day-picker";

interface SellerStats {
  totalRevenue: number;
  totalOrders: number;
  totalUnitsSold: number;
  productsActive: number;
  bestSellerProduct: { name: string; count: number } | null;
  // New stats
  completedOrders: number;
  cancelledOrders: number;
  noShowOrders: number;
  pendingOrders: number;
}

export function useSellerStats(sellerId: string | undefined, dateRange: DateRange | undefined) {
  const [stats, setStats] = useState<SellerStats>({
    totalRevenue: 0,
    totalOrders: 0,
    totalUnitsSold: 0,
    productsActive: 0,
    bestSellerProduct: null,
    completedOrders: 0,
    cancelledOrders: 0,
    noShowOrders: 0,
    pendingOrders: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sellerId) {
      setLoading(false);
      return;
    }
    
    fetchStats();
  }, [sellerId, dateRange]);

  const fetchStats = async () => {
    if (!sellerId) return;
    
    setLoading(true);

    try {
      // Get active products count
      const { count: productsCount } = await supabase
        .from("seller_products")
        .select("*", { count: "exact", head: true })
        .eq("seller_id", sellerId)
        .eq("status", "active");

      // Get order items for this seller
      const { data: orderItems } = await supabase
        .from("order_items")
        .select("*")
        .eq("seller_id", sellerId);

      if (!orderItems || orderItems.length === 0) {
        setStats({
          totalRevenue: 0,
          totalOrders: 0,
          totalUnitsSold: 0,
          productsActive: productsCount || 0,
          bestSellerProduct: null,
          completedOrders: 0,
          cancelledOrders: 0,
          noShowOrders: 0,
          pendingOrders: 0,
        });
        setLoading(false);
        return;
      }

      // Get unique order IDs
      const orderIds = [...new Set(orderItems.map((item) => item.order_id))];

      // Fetch orders with date range filter
      let ordersQuery = supabase
        .from("orders")
        .select("*")
        .in("id", orderIds);

      if (dateRange?.from) {
        ordersQuery = ordersQuery.gte("created_at", dateRange.from.toISOString());
      }
      if (dateRange?.to) {
        ordersQuery = ordersQuery.lte("created_at", dateRange.to.toISOString());
      }

      const { data: ordersData } = await ordersQuery;

      if (!ordersData || ordersData.length === 0) {
        setStats({
          totalRevenue: 0,
          totalOrders: 0,
          totalUnitsSold: 0,
          productsActive: productsCount || 0,
          bestSellerProduct: null,
          completedOrders: 0,
          cancelledOrders: 0,
          noShowOrders: 0,
          pendingOrders: 0,
        });
        setLoading(false);
        return;
      }

      // Filter order items by orders in date range
      const orderIdsInRange = new Set(ordersData.map((o) => o.id));
      const filteredItems = orderItems.filter((item) => orderIdsInRange.has(item.order_id));

      // Calculate status counts
      const statusCounts = {
        completed: 0,
        cancelled: 0,
        "no-show": 0,
        pending: 0,
        confirmed: 0,
      };

      ordersData.forEach((order) => {
        const status = order.status?.toLowerCase() || "pending";
        if (status in statusCounts) {
          statusCounts[status as keyof typeof statusCounts]++;
        }
      });

      // Calculate revenue ONLY from completed orders
      const completedOrderIds = new Set(
        ordersData.filter((o) => o.status === "completed").map((o) => o.id)
      );

      let totalRevenue = 0;
      let totalUnits = 0;
      const productSales: Record<string, { name: string; count: number }> = {};

      filteredItems.forEach((item) => {
        // Only count revenue and units from completed orders
        if (completedOrderIds.has(item.order_id)) {
          totalRevenue += Number(item.total_price);
          totalUnits += item.quantity;

          const productKey = item.product_id || item.product_name;
          if (!productSales[productKey]) {
            productSales[productKey] = { name: item.product_name, count: 0 };
          }
          productSales[productKey].count += item.quantity;
        }
      });

      // Find best seller
      let bestSeller: { name: string; count: number } | null = null;
      Object.values(productSales).forEach((product) => {
        if (!bestSeller || product.count > bestSeller.count) {
          bestSeller = product;
        }
      });

      setStats({
        totalRevenue,
        totalOrders: ordersData.length,
        totalUnitsSold: totalUnits,
        productsActive: productsCount || 0,
        bestSellerProduct: bestSeller,
        completedOrders: statusCounts.completed,
        cancelledOrders: statusCounts.cancelled,
        noShowOrders: statusCounts["no-show"],
        pendingOrders: statusCounts.pending + statusCounts.confirmed,
      });
    } catch (error) {
      console.error("Error fetching seller stats:", error);
    } finally {
      setLoading(false);
    }
  };

  return { stats, loading, refetch: fetchStats };
}
