import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { POItem } from "@/hooks/usePurchaseOrders";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export function PublishShopifyDialog({
  open, onOpenChange, item, poId,
}: { open: boolean; onOpenChange: (v: boolean) => void; item: POItem; poId: string }) {
  const qc = useQueryClient();
  const [state, setState] = useState<"hidden" | "coming_soon" | "draft" | "active">(item.shopify_publish_state || "draft");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("po-publish-to-shopify", {
        body: { item_id: item.id, publish_state: state },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Publish failed");
      toast.success("Synced to Shopify");
      qc.invalidateQueries({ queryKey: ["purchase_order", poId] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Failed to publish");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Publish to Shopify</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{item.product_name}</p>
          <div>
            <Label>Publish state</Label>
            <Select value={state} onValueChange={(v) => setState(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="hidden">Keep hidden (don't push)</SelectItem>
                <SelectItem value="coming_soon">Mark as Coming Soon (draft + tag)</SelectItem>
                <SelectItem value="draft">Push as Draft</SelectItem>
                <SelectItem value="active">Publish Active</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            Inventory will use arrived qty ({item.quantity_arrived}). Cost & supplier are stored privately in metafields and never shown to customers.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>{busy ? "Syncing…" : "Sync to Shopify"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
