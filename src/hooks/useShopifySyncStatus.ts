import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ShopifySyncState {
  last_synced_at: string | null;
  last_status: string | null;
  last_error: string | null;
  last_run_count: number | null;
}

export function useShopifySyncStatus() {
  const [state, setState] = useState<ShopifySyncState | null>(null);
  const [syncing, setSyncing] = useState(false);

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

  const triggerSync = useCallback(async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-shopify-orders", {
        body: { trigger: "manual" },
      });
      if (error) throw error;
      toast.success(`Shopify sync complete — ${data?.processed ?? 0} orders updated`);
      await refresh();
    } catch (e: any) {
      toast.error("Shopify order sync failed", { description: e?.message ?? "Check API permissions or connection." });
    } finally {
      setSyncing(false);
    }
  }, [refresh]);

  return { state, syncing, triggerSync, refresh };
}
