import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ShopifySyncState {
  last_synced_at: string | null;
  last_status: string | null;
  last_error: string | null;
  last_run_count: number | null;
}

export interface ShopifySyncResult {
  fetched?: number;
  created?: number;
  updated?: number;
  skipped?: number;
  pos?: number;
  online?: number;
  paid?: number;
  completed?: number;
  line_items_total?: number;
  line_items_matched_to_seller?: number;
  line_items_unassigned?: number;
  seller_orders_touched?: number;
  unassigned_samples?: Array<{
    shopify_order_name?: string;
    line_title?: string;
    shopify_product_id?: string | null;
    shopify_variant_id?: string | null;
    reason?: string;
  }>;
  mode?: string;
  skip_details?: Array<{
    shopify_order_id?: string;
    shopify_order_name?: string;
    source?: string;
    financial_status?: string | null;
    fulfillment_status?: string | null;
    created_at?: string;
    reason?: string;
  }>;
}

export function useShopifySyncStatus() {
  const [state, setState] = useState<ShopifySyncState | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [lastResult, setLastResult] = useState<ShopifySyncResult | null>(null);

  const refresh = useCallback(async () => {
    const { data } = await (supabase as any)
      .from("shopify_sync_state")
      .select("last_synced_at, last_status, last_error, last_run_count")
      .eq("id", "orders")
      .maybeSingle();
    if (data) setState(data as ShopifySyncState);
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 30_000);
    return () => clearInterval(t);
  }, [refresh]);

  const triggerSync = useCallback(async (opts?: { mode?: "full" | "incremental" }) => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-shopify-orders", {
        body: { trigger: "manual", mode: opts?.mode ?? "incremental" },
      });
      if (error) throw error;
      const d = data || {};
      const desc = [
        `Fetched ${d.fetched ?? 0}`,
        `Created ${d.created ?? 0}`,
        `Updated ${d.updated ?? 0}`,
        `POS ${d.pos ?? 0}`,
        `Paid ${d.paid ?? 0}`,
        `Completed ${d.completed ?? 0}`,
        d.skipped ? `Skipped ${d.skipped}` : null,
      ].filter(Boolean).join(" · ");
      toast.success(
        opts?.mode === "full" ? "Shopify full resync complete" : "Shopify sync complete",
        { description: desc },
      );
      await refresh();
      setLastResult(d as ShopifySyncResult);
      return d;
    } catch (e: any) {
      toast.error("Shopify order sync failed", { description: e?.message ?? "Check API permissions or connection." });
    } finally {
      setSyncing(false);
    }
  }, [refresh]);

  return { state, syncing, triggerSync, refresh, lastResult };
}
