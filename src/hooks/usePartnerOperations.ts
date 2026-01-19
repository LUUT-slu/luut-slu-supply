import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface PartnerTotals {
  total_commission_earned: number;
  amount_to_return: number;
}

export interface OrderAssignment {
  id: string;
  order_id: string;
  partner_id: string;
  commission_type: 'fixed' | 'percent';
  commission_value: number;
  commission_amount_calculated: number | null;
  assignment_status: 'pending' | 'accepted' | 'declined' | 'reassigned';
  assigned_at: string;
  responded_at: string | null;
}

export interface PartnerStock {
  id: string;
  partner_id: string;
  product_id: string;
  qty_on_hand: number;
  last_updated_at: string;
  product?: {
    name: string;
    images: string[];
    price: number;
  };
}

export interface StockMovement {
  id: string;
  partner_id: string;
  product_id: string;
  movement_type: 'stock_added' | 'stock_removed' | 'sold_deducted' | 'returned_to_admin' | 'adjustment' | 'undo_sale_restore';
  qty_change: number;
  related_order_id: string | null;
  note: string | null;
  created_at: string;
}

export interface CashLedgerEntry {
  id: string;
  partner_id: string;
  order_id: string;
  gross_collected: number;
  commission_amount: number;
  net_owed_to_admin: number;
  ledger_status: 'unsettled' | 'settled';
  created_at: string;
}

export interface Settlement {
  id: string;
  partner_id: string;
  settled_by_admin_id: string;
  settlement_amount: number;
  settlement_note: string | null;
  settled_at: string;
}

interface RpcResponse {
  success: boolean;
  error?: string;
  [key: string]: unknown;
}

// Partner Portal Functions
export const usePartnerOperations = () => {
  // Accept an order assignment
  const acceptOrder = async (orderId: string): Promise<boolean> => {
    const { data, error } = await supabase.rpc('rpc_partner_respond', {
      p_order_id: orderId,
      p_response: 'accepted'
    });

    const result = data as unknown as RpcResponse | null;
    
    if (error || !result?.success) {
      toast.error(result?.error || "Failed to accept order");
      return false;
    }

    toast.success("Order accepted!");
    return true;
  };

  // Decline an order assignment
  const declineOrder = async (orderId: string, reason?: string): Promise<boolean> => {
    const { data, error } = await supabase.rpc('rpc_partner_respond', {
      p_order_id: orderId,
      p_response: 'declined',
      p_decline_reason: reason || null
    });

    const result = data as unknown as RpcResponse | null;

    if (error || !result?.success) {
      toast.error(result?.error || "Failed to decline order");
      return false;
    }

    toast.success("Order declined, returned to queue");
    return true;
  };

  // Mark order as completed
  const markCompleted = async (orderId: string, grossCollected?: number): Promise<boolean> => {
    const { data, error } = await supabase.rpc('rpc_mark_completed', {
      p_order_id: orderId,
      p_gross_collected: grossCollected || null
    });

    const result = data as unknown as RpcResponse | null;

    if (error || !result?.success) {
      toast.error(result?.error || "Failed to complete order");
      return false;
    }

    const commissionEarned = result?.commission_earned as number | undefined;
    toast.success(`Order completed! Commission: EC$${commissionEarned?.toFixed(2) || '0'}`);
    return true;
  };

  // Mark order as no sale
  const markNoSale = async (orderId: string, note?: string): Promise<boolean> => {
    const { data, error } = await supabase.rpc('rpc_mark_no_sale', {
      p_order_id: orderId,
      p_note: note || null
    });

    const result = data as unknown as RpcResponse | null;

    if (error || !result?.success) {
      toast.error(result?.error || "Failed to mark as no sale");
      return false;
    }

    toast.success("Order marked as No Sale");
    return true;
  };

  // Undo completed order (within time limit)
  const undoCompleted = async (orderId: string): Promise<boolean> => {
    const { data, error } = await supabase.rpc('rpc_undo_completed', {
      p_order_id: orderId
    });

    const result = data as unknown as RpcResponse | null;

    if (error || !result?.success) {
      toast.error(result?.error || "Failed to undo completion");
      return false;
    }

    toast.success("Completion undone, order restored to Accepted");
    return true;
  };

  // Get partner totals (commission earned, amount to return)
  const getPartnerTotals = async (partnerId?: string): Promise<PartnerTotals | null> => {
    const { data, error } = await supabase.rpc('get_partner_totals', {
      p_partner_id: partnerId || null
    });

    if (error) {
      console.error("Failed to get partner totals:", error);
      return null;
    }

    return data as unknown as PartnerTotals | null;
  };

  // Get partner stock
  const getPartnerStock = async (partnerId: string): Promise<PartnerStock[]> => {
    const { data, error } = await supabase
      .from('partner_stock')
      .select(`
        *,
        product:seller_products(name, images, price)
      `)
      .eq('partner_id', partnerId);

    if (error) {
      console.error("Failed to get partner stock:", error);
      return [];
    }

    return (data || []) as unknown as PartnerStock[];
  };

  // Get stock movements
  const getStockMovements = async (partnerId: string): Promise<StockMovement[]> => {
    const { data, error } = await supabase
      .from('partner_stock_movements')
      .select('*')
      .eq('partner_id', partnerId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error("Failed to get stock movements:", error);
      return [];
    }

    return (data || []) as StockMovement[];
  };

  return {
    acceptOrder,
    declineOrder,
    markCompleted,
    markNoSale,
    undoCompleted,
    getPartnerTotals,
    getPartnerStock,
    getStockMovements
  };
};

// Admin Functions
export const useAdminOperations = () => {
  // Assign order to partner with commission
  const assignOrder = async (
    orderId: string,
    partnerId: string,
    commissionType: 'fixed' | 'percent',
    commissionValue: number
  ): Promise<boolean> => {
    const { data, error } = await supabase.rpc('rpc_assign_order', {
      p_order_id: orderId,
      p_partner_id: partnerId,
      p_commission_type: commissionType,
      p_commission_value: commissionValue
    });

    const result = data as unknown as RpcResponse | null;

    if (error || !result?.success) {
      toast.error(result?.error || "Failed to assign order");
      return false;
    }

    toast.success("Order assigned successfully!");
    return true;
  };

  // Settle partner cash
  const settlePartner = async (partnerId: string, note?: string): Promise<boolean> => {
    const { data, error } = await supabase.rpc('rpc_settle_partner', {
      p_partner_id: partnerId,
      p_settlement_note: note || null
    });

    const result = data as unknown as RpcResponse | null;

    if (error || !result?.success) {
      toast.error(result?.error || "Failed to settle partner");
      return false;
    }

    const amountSettled = result?.amount_settled as number | undefined;
    const ordersSettled = result?.orders_settled as number | undefined;
    toast.success(`Settled EC$${amountSettled?.toFixed(2) || '0'} for ${ordersSettled || 0} orders`);
    return true;
  };

  // Add stock to partner
  const addPartnerStock = async (
    partnerId: string,
    productId: string,
    quantity: number,
    note?: string
  ): Promise<boolean> => {
    const { data, error } = await supabase.rpc('rpc_add_partner_stock', {
      p_partner_id: partnerId,
      p_product_id: productId,
      p_quantity: quantity,
      p_note: note || null
    });

    const result = data as unknown as RpcResponse | null;

    if (error || !result?.success) {
      toast.error(result?.error || "Failed to add stock");
      return false;
    }

    toast.success("Stock added to partner");
    return true;
  };

  // Remove stock from partner
  const removePartnerStock = async (
    partnerId: string,
    productId: string,
    quantity: number,
    movementType: 'stock_removed' | 'returned_to_admin' = 'stock_removed',
    note?: string
  ): Promise<boolean> => {
    const { data, error } = await supabase.rpc('rpc_remove_partner_stock', {
      p_partner_id: partnerId,
      p_product_id: productId,
      p_quantity: quantity,
      p_movement_type: movementType,
      p_note: note || null
    });

    const result = data as unknown as RpcResponse | null;

    if (error || !result?.success) {
      toast.error(result?.error || "Failed to remove stock");
      return false;
    }

    toast.success("Stock removed from partner");
    return true;
  };

  // Get partner cash ledger (admin view)
  const getPartnerLedger = async (partnerId: string): Promise<CashLedgerEntry[]> => {
    const { data, error } = await supabase
      .from('partner_cash_ledger')
      .select('*')
      .eq('partner_id', partnerId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Failed to get partner ledger:", error);
      return [];
    }

    return (data || []) as CashLedgerEntry[];
  };

  // Get partner settlements
  const getPartnerSettlements = async (partnerId: string): Promise<Settlement[]> => {
    const { data, error } = await supabase
      .from('partner_settlements')
      .select('*')
      .eq('partner_id', partnerId)
      .order('settled_at', { ascending: false });

    if (error) {
      console.error("Failed to get settlements:", error);
      return [];
    }

    return (data || []) as Settlement[];
  };

  // Get order events (audit trail)
  const getOrderEvents = async (orderId: string) => {
    const { data, error } = await supabase
      .from('order_events')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error("Failed to get order events:", error);
      return [];
    }

    return data || [];
  };

  return {
    assignOrder,
    settlePartner,
    addPartnerStock,
    removePartnerStock,
    getPartnerLedger,
    getPartnerSettlements,
    getOrderEvents
  };
};
