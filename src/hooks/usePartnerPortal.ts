import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfDay, subDays } from "date-fns";

export type OrderFilter = 'ASSIGNED' | 'COMPLETED' | 'NO_SHOW' | 'ALL';
export type ViewMode = 'orders' | 'earnings' | 'to_return' | 'stock';

interface LineItem {
  title: string;
  quantity: number;
  price: string;
}

export interface PartnerOrder {
  id: string;
  order_number: number;
  customer_name: string;
  customer_phone: string | null;
  location: string;
  preferred_date: string;
  pickup_time_window: string | null;
  note: string | null;
  status: string;
  order_status: string | null;
  total_price: number;
  currency_code: string;
  line_items: LineItem[];
  created_at: string;
  partner_commission: number | null;
  partner_commission_status: string | null;
  settlement_status: string | null;
  completed_at: string | null;
}

export interface PartnerStats {
  assignedCount: number;
  completedCount: number;
  noShowCount: number;
  totalEarned: number;
  toBeReturned: number;
}

export interface PartnerStockItem {
  id: string;
  partner_id: string;
  product_id: string | null;
  qty_on_hand: number;
  last_updated_at: string | null;
  product?: {
    name: string;
    images: string[];
    price: number;
  };
}

export interface EarningsEntry {
  id: string;
  order_id: string;
  commission_amount: number;
  created_at: string;
  ledger_status: string;
  gross_collected: number;
}

interface RpcResponse {
  success: boolean;
  error?: string;
  commission_earned?: number;
  gross_collected?: number;
  net_owed_to_admin?: number;
  [key: string]: unknown;
}

// Hook for partner orders with filtering
export const usePartnerOrders = (filter: OrderFilter = 'ASSIGNED') => {
  const [orders, setOrders] = useState<PartnerOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    let query = supabase
      .from("orders")
      .select("*")
      .eq("assigned_partner_id", user.id)
      .order("created_at", { ascending: false });

    // Filter by order_status (using the new field, fallback to status)
    if (filter === 'ASSIGNED') {
      // ASSIGNED and ON_THE_WAY are both "active" orders
      query = query.or("order_status.in.(ASSIGNED,ON_THE_WAY),and(order_status.is.null,status.in.(ASSIGNED,ON_THE_WAY,pending))");
    } else if (filter === 'COMPLETED') {
      query = query.or("order_status.eq.COMPLETED,and(order_status.is.null,status.eq.COMPLETED)");
    } else if (filter === 'NO_SHOW') {
      query = query.or("order_status.eq.NO_SHOW,and(order_status.is.null,status.eq.NO_SHOW)");
    }
    // 'ALL' returns everything

    const { data, error } = await query;
    
    if (error) {
      console.error("Failed to fetch orders:", error);
    } else {
      setOrders((data || []) as unknown as PartnerOrder[]);
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  return { orders, loading, refetch: fetchOrders };
};

// Hook for partner stats
export const usePartnerStats = () => {
  const [stats, setStats] = useState<PartnerStats>({
    assignedCount: 0,
    completedCount: 0,
    noShowCount: 0,
    totalEarned: 0,
    toBeReturned: 0
  });
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    // Get all orders for this partner
    const { data: orders } = await supabase
      .from("orders")
      .select("status, order_status")
      .eq("assigned_partner_id", user.id);

    // Count by status
    const assignedCount = orders?.filter(o => {
      const effectiveStatus = o.order_status || o.status;
      return ['ASSIGNED', 'ON_THE_WAY', 'pending'].includes(effectiveStatus);
    }).length || 0;

    const completedCount = orders?.filter(o => {
      const effectiveStatus = o.order_status || o.status;
      return effectiveStatus === 'COMPLETED';
    }).length || 0;

    const noShowCount = orders?.filter(o => {
      const effectiveStatus = o.order_status || o.status;
      return effectiveStatus === 'NO_SHOW';
    }).length || 0;

    // Get totals from RPC
    const { data: totals } = await supabase.rpc('get_partner_totals', {
      p_partner_id: user.id
    });

    const totalsData = totals as { total_commission_earned?: number; amount_to_return?: number } | null;

    setStats({
      assignedCount,
      completedCount,
      noShowCount,
      totalEarned: totalsData?.total_commission_earned || 0,
      toBeReturned: totalsData?.amount_to_return || 0
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, loading, refetch: fetchStats };
};

// Hook for partner stock
export const usePartnerStock = () => {
  const [stock, setStock] = useState<PartnerStockItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStock = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('partner_stock')
      .select(`
        *,
        product:seller_products(name, images, price)
      `)
      .eq('partner_id', user.id)
      .gt('qty_on_hand', 0);

    if (error) {
      console.error("Failed to fetch partner stock:", error);
    } else {
      setStock((data || []) as unknown as PartnerStockItem[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStock();
  }, [fetchStock]);

  return { stock, loading, refetch: fetchStock };
};

// Hook for partner earnings with date range
export const usePartnerEarnings = (dateRange?: { from: Date; to: Date }) => {
  const [earnings, setEarnings] = useState<{ total: number; entries: EarningsEntry[] }>({
    total: 0,
    entries: []
  });
  const [loading, setLoading] = useState(true);

  const fetchEarnings = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    // Query partner_cash_ledger - note: we intentionally exclude net_owed_to_admin from partner view
    let query = supabase
      .from('partner_cash_ledger')
      .select('id, order_id, commission_amount, created_at, ledger_status, gross_collected')
      .eq('partner_id', user.id)
      .order('created_at', { ascending: false });

    if (dateRange?.from && dateRange?.to) {
      query = query
        .gte('created_at', dateRange.from.toISOString())
        .lte('created_at', dateRange.to.toISOString());
    }

    const { data, error } = await query;

    if (error) {
      console.error("Failed to fetch earnings:", error);
    } else {
      const entries = (data || []) as EarningsEntry[];
      const total = entries.reduce((sum, e) => sum + (e.commission_amount || 0), 0);
      setEarnings({ total, entries });
    }
    setLoading(false);
  }, [dateRange?.from?.toISOString(), dateRange?.to?.toISOString()]);

  useEffect(() => {
    fetchEarnings();
  }, [fetchEarnings]);

  return { earnings, loading, refetch: fetchEarnings };
};

// Partner operations (mark completed, no show, etc)
export const usePartnerActions = () => {
  const [updating, setUpdating] = useState<string | null>(null);

  const markCompleted = async (orderId: string): Promise<boolean> => {
    setUpdating(orderId);
    try {
      const { data, error } = await supabase.rpc('rpc_mark_completed', {
        p_order_id: orderId
      });

      const result = data as unknown as RpcResponse | null;

      if (error || !result?.success) {
        console.error("Mark completed error:", error || result?.error);
        setUpdating(null);
        return false;
      }

      setUpdating(null);
      return true;
    } catch (err) {
      console.error("Mark completed exception:", err);
      setUpdating(null);
      return false;
    }
  };

  const markNoShow = async (orderId: string, note?: string): Promise<boolean> => {
    setUpdating(orderId);
    try {
      const { data, error } = await supabase.rpc('rpc_mark_no_sale', {
        p_order_id: orderId,
        p_note: note || 'Customer no show'
      });

      const result = data as unknown as RpcResponse | null;

      if (error || !result?.success) {
        console.error("Mark no show error:", error || result?.error);
        setUpdating(null);
        return false;
      }

      setUpdating(null);
      return true;
    } catch (err) {
      console.error("Mark no show exception:", err);
      setUpdating(null);
      return false;
    }
  };

  return { markCompleted, markNoShow, updating };
};

// Format order number helper
export const formatOrderNumber = (num: number) => `#L${String(num).padStart(4, '0')}`;
