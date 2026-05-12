import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { POItem } from "@/hooks/usePurchaseOrders";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

type SyncMode = "po_only" | "inventory_only" | "inventory_price" | "inventory_variants" | "create_new";

export function RestockSyncDialog({
  open, onOpenChange, item, poId, isAdmin,
}: { open: boolean; onOpenChange: (v: boolean) => void; item: POItem; poId: string; isAdmin: boolean }) {
  const qc = useQueryClient();
  const isRestock = (item as any).is_restock || (item as any).source_type !== "manual";
  const priceChanged = isRestock
    && (item as any).current_shopify_price != null
    && Number((item as any).current_shopify_price) !== Number(item.selling_price);

  const [mode, setMode] = useState<SyncMode>(isRestock ? "inventory_only" : "create_new");
  const [confirmPrice, setConfirmPrice] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("po-publish-to-shopify", {
        body: {
          item_id: item.id,
          sync_mode: mode,
          confirm_price_change: confirmPrice,
          // legacy fallback
          publish_state: mode === "create_new" ? "draft" : "hidden",
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Sync failed");
      toast.success("Synced");
      qc.invalidateQueries({ queryKey: ["purchase_order", poId] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Failed");
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Sync to Shopify</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">{item.product_name}</p>
          <RadioGroup value={mode} onValueChange={(v) => setMode(v as SyncMode)} className="space-y-2">
            <Option value="po_only" current={mode}>Keep as purchase order only (no Shopify changes)</Option>
            {isRestock && <Option value="inventory_only" current={mode}>Update inventory only</Option>}
            {isRestock && isAdmin && <Option value="inventory_price" current={mode}>Update inventory + price</Option>}
            {isRestock && isAdmin && <Option value="inventory_variants" current={mode}>Update inventory + variants</Option>}
            {isAdmin && <Option value="create_new" current={mode}>Create as new product</Option>}
          </RadioGroup>

          {priceChanged && mode === "inventory_price" && (
            <div className="rounded-md bg-amber-500/10 border border-amber-500/30 p-3">
              <p className="text-xs">
                You changed the selling price for this batch (EC${Number(item.selling_price).toFixed(2)} vs current EC${Number((item as any).current_shopify_price).toFixed(2)}).
              </p>
              <label className="flex gap-2 items-center mt-2 text-xs cursor-pointer">
                <Checkbox checked={confirmPrice} onCheckedChange={(c) => setConfirmPrice(!!c)} />
                Yes, update Shopify price
              </label>
            </div>
          )}

          {!isAdmin && (
            <p className="text-xs text-muted-foreground">Admin approval required to update Shopify prices or variants.</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>{busy ? "Syncing…" : "Sync"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Option({ value, current, children }: { value: string; current: string; children: React.ReactNode }) {
  return (
    <label className={`flex gap-2 items-start p-2 rounded-md border cursor-pointer ${current === value ? "border-primary bg-primary/5" : "border-border/60"}`}>
      <RadioGroupItem value={value} className="mt-0.5" />
      <span className="text-xs">{children}</span>
    </label>
  );
}
