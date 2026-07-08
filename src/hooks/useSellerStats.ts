import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DateRange } from "react-day-picker";

// Shopify orders get created_at = sync time, not real order time.
// Real order time for Shopify-sourced rows is stored in preferred_date as ISO.
function effectiveOrderDate(o: { source?: string | null; preferred_date?: string | null; created_at: string }): Date {
  if (
    o.source &&
    o.source.startsWith("shopify") &&
    o.preferred_date &&
    /^\d{4}-\d{2}-\d{2}T/.test(o.preferred_date)
  ) {
    return new Date(o.preferred_date);
  }
  return new Date(o.created_at);
}


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
  todayRevenue: number;
  todayOrders: number;
  todayReadyForPickup: number;
}

export type StatsPeriod = "day" | "week" | "month";

export function useSellerStats(
  sellerId: string | undefined,
  dateRange: DateRange | undefined,
  period: StatsPeriod = "day"
) {
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
    todayRevenue: 0,
    todayOrders: 0,
    todayReadyForPickup: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sellerId) {
      setLoading(false);
      return;
    }
    
    fetchStats();
  }, [sellerId, dateRange, period]);

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
          todayRevenue: 0,
          todayOrders: 0,
          todayReadyForPickup: 0,
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
          todayRevenue: 0,
          todayOrders: 0,
          todayReadyForPickup: 0,
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

      // Period-scoped aggregates in Saint Lucia time (UTC-4, no DST).
      // Field names kept as `today*` for compatibility.
      const SLU_OFFSET_MS = 4 * 60 * 60 * 1000; // UTC-4
      // "Now" shifted so that UTC-midnight of the shifted date == SLU-midnight in UTC.
      const nowSlu = new Date(Date.now() - SLU_OFFSET_MS);
      const sluY = nowSlu.getUTCFullYear();
      const sluM = nowSlu.getUTCMonth();
      const sluD = nowSlu.getUTCDate();

      // Start of period in SLU local, expressed as a UTC instant.
      let startOfPeriod: Date;
      if (period === "week") {
        const dow = nowSlu.getUTCDay(); // 0=Sun..6=Sat
        const diff = dow === 0 ? 6 : dow - 1; // Monday start
        startOfPeriod = new Date(Date.UTC(sluY, sluM, sluD - diff) + SLU_OFFSET_MS);
      } else if (period === "month") {
        startOfPeriod = new Date(Date.UTC(sluY, sluM, 1) + SLU_OFFSET_MS);
      } else {
        startOfPeriod = new Date(Date.UTC(sluY, sluM, sluD) + SLU_OFFSET_MS);
      }
      // End of today (SLU) as UTC instant, for the "ready for pickup today" card.
      const endOfTodaySlu = new Date(Date.UTC(sluY, sluM, sluD + 1) + SLU_OFFSET_MS);
      const todayStr = `${sluY}-${String(sluM + 1).padStart(2, "0")}-${String(sluD).padStart(2, "0")}`;

      const periodOrders = ordersData.filter((o) => {
        const d = effectiveOrderDate(o);
        return d >= startOfPeriod && d < endOfTodaySlu;
      });

      // Deduplicate: when a Shopify sync failed row (e.g. "draft_failed",
      // "customer_sync_failed") has a successful counterpart for the same sale,
      // drop the failed one so it is not double-counted in the Today cards.
      // Match by normalized phone + total_price across all of the seller's orders.
      const normPhone = (p: string | null | undefined) =>
        (p || "").replace(/\D+/g, "").replace(/^1(?=\d{10}$)/, "");
      const successKeys = new Set(
        ordersData
          .filter((o) => {
            const s = (o.shopify_sync_status || "").toLowerCase();
            return s && !s.includes("failed");
          })
          .map((o) => `${normPhone(o.customer_phone)}|${Number(o.total_price).toFixed(2)}`)
      );
      const dedupedPeriodOrders = periodOrders.filter((o) => {
        const s = (o.shopify_sync_status || "").toLowerCase();
        if (!s.includes("failed")) return true;
        const key = `${normPhone(o.customer_phone)}|${Number(o.total_price).toFixed(2)}`;
        return !successKeys.has(key);
      });

      const periodCompletedIds = new Set(
        dedupedPeriodOrders.filter((o) => o.status === "completed").map((o) => o.id)
      );
      const todayRevenue = orderItems
        .filter((i) => periodCompletedIds.has(i.order_id))
        .reduce((sum, i) => sum + Number(i.total_price), 0);
      const todayReadyForPickup = ordersData.filter(
        (o) =>
          o.preferred_date === todayStr &&
          o.status !== "cancelled" &&
          o.status !== "completed" &&
          o.status !== "no-show"
      ).length;
      const todaysOrders = dedupedPeriodOrders.filter((o) => o.status === "completed");




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
        todayRevenue,
        todayOrders: todaysOrders.length,
        todayReadyForPickup,
      });
    } catch (error) {
      console.error("Error fetching seller stats:", error);
    } finally {
      setLoading(false);
    }
  };

  return { stats, loading, refetch: fetchStats };
}
