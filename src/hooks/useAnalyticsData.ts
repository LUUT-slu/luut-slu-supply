import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AnalyticsFilters {
  startDate: string; // ISO
  endDate: string;
  category?: string;
  sellerId?: string;
}

async function fetchAnalyticsEvents(filters: AnalyticsFilters) {
  // First get admin user IDs to exclude
  const { data: adminRoles } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin" as any);
  const adminIds = (adminRoles || []).map((r) => r.user_id);

  let query = supabase
    .from("analytics_events" as any)
    .select("*")
    .gte("created_at", filters.startDate)
    .lte("created_at", filters.endDate)
    .order("created_at", { ascending: true });

  if (filters.category) {
    query = query.eq("product_category", filters.category);
  }
  if (filters.sellerId) {
    query = query.eq("seller_id", filters.sellerId);
  }

  const { data, error } = await query;
  if (error) throw error;

  // Filter out admin events client-side
  const filtered = (data || []).filter(
    (e: any) => !e.user_id || !adminIds.includes(e.user_id)
  );
  return filtered as unknown as AnalyticsEvent[];
}

export interface AnalyticsEvent {
  id: string;
  event_type: string;
  product_id: string | null;
  product_name: string | null;
  product_category: string | null;
  seller_id: string | null;
  session_id: string | null;
  user_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ProductMetrics {
  productId: string;
  productName: string;
  productCategory: string;
  views: number;
  clicks: number;
  addToCarts: number;
  checkoutStarts: number;
  orders: number;
  uniqueSessions: Set<string>;
  conversionRate: number; // views → orders
  cartRate: number; // views → add_to_cart
}

export function useAnalyticsData(filters: AnalyticsFilters) {
  return useQuery({
    queryKey: ["analytics-events", filters],
    queryFn: () => fetchAnalyticsEvents(filters),
    staleTime: 30_000,
  });
}

// Helper to compute aggregated metrics from raw events
export function computeMetrics(events: AnalyticsEvent[]) {
  const totalSessions = new Set(events.map((e) => e.session_id).filter(Boolean));
  const byType = (type: string) => events.filter((e) => e.event_type === type);

  const views = byType("product_viewed");
  const clicks = byType("product_clicked");
  const addToCarts = byType("add_to_cart");
  const checkouts = byType("checkout_started");
  const orders = byType("order_completed");

  // Product-level
  const productMap = new Map<string, ProductMetrics>();

  for (const evt of events) {
    if (!evt.product_id) continue;
    if (!productMap.has(evt.product_id)) {
      productMap.set(evt.product_id, {
        productId: evt.product_id,
        productName: evt.product_name || "Unknown",
        productCategory: evt.product_category || "Uncategorized",
        views: 0,
        clicks: 0,
        addToCarts: 0,
        checkoutStarts: 0,
        orders: 0,
        uniqueSessions: new Set(),
        conversionRate: 0,
        cartRate: 0,
      });
    }
    const m = productMap.get(evt.product_id)!;
    if (evt.session_id) m.uniqueSessions.add(evt.session_id);

    switch (evt.event_type) {
      case "product_viewed":
        m.views++;
        break;
      case "product_clicked":
        m.clicks++;
        break;
      case "add_to_cart":
        m.addToCarts++;
        break;
      case "checkout_started":
        m.checkoutStarts++;
        break;
      case "order_completed":
        m.orders++;
        break;
    }
  }

  // Calculate rates
  for (const m of productMap.values()) {
    m.conversionRate = m.views > 0 ? (m.orders / m.views) * 100 : 0;
    m.cartRate = m.views > 0 ? (m.addToCarts / m.views) * 100 : 0;
  }

  const products = Array.from(productMap.values());

  return {
    totalVisitors: totalSessions.size,
    totalViews: views.length,
    totalClicks: clicks.length,
    totalAddToCarts: addToCarts.length,
    totalCheckouts: checkouts.length,
    totalOrders: orders.length,
    avgConversionRate:
      views.length > 0 ? ((orders.length / views.length) * 100) : 0,
    products,
    events,
  };
}

// Group events by day for chart data
export function groupByDay(events: AnalyticsEvent[], eventType?: string) {
  const filtered = eventType
    ? events.filter((e) => e.event_type === eventType)
    : events;

  const dayMap = new Map<string, number>();
  for (const e of filtered) {
    const day = e.created_at.slice(0, 10);
    dayMap.set(day, (dayMap.get(day) || 0) + 1);
  }

  return Array.from(dayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));
}
