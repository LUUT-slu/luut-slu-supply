import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2 } from "lucide-react";
import { PickedProduct, PickedVariant } from "./ExistingProductPickerDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export function RestockEditDialog({
  open, onOpenChange, picked, poId,
}: { open: boolean; onOpenChange: (v: boolean) => void; picked: PickedProduct | null; poId: string }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<PickedProduct | null>(picked);
  const [busy, setBusy] = useState(false);

  // Sync when picked changes
  if (picked && draft?.source_ref !== picked.source_ref) setDraft(picked);
  if (!draft) return null;

  const updateVariant = (i: number, patch: Partial<PickedVariant>) => {
    setDraft({ ...draft, variants: draft.variants.map((v, idx) => idx === i ? { ...v, ...patch } : v) });
  };

  const addVariant = () => {
    setDraft({ ...draft, variants: [...draft.variants, {
      cost_per_item: 0, selling_price: 0, quantity_ordered: 0, included: true, is_new_variant: true,
    }] });
  };

  const removeVariant = (i: number) => {
    setDraft({ ...draft, variants: draft.variants.filter((_, idx) => idx !== i) });
  };

  const totals = draft.variants.filter(v => v.included).reduce(
    (acc, v) => ({
      qty: acc.qty + (v.quantity_ordered || 0),
      cost: acc.cost + (v.cost_per_item * v.quantity_ordered),
      profit: acc.profit + ((v.selling_price - v.cost_per_item) * v.quantity_ordered),
    }), { qty: 0, cost: 0, profit: 0 }
  );

  const save = async () => {
    setBusy(true);
    try {
      const snapshot = {
        product_name: draft.product_name,
        category: draft.category,
        sub_category: draft.sub_category,
        image_url: draft.image_url,
        current_shopify_price: draft.current_shopify_price,
        current_shopify_stock: draft.current_shopify_stock,
        quantity_ordered: totals.qty,
        cost_per_item: totals.qty > 0 ? totals.cost / totals.qty : 0,
        selling_price: draft.variants[0]?.selling_price || 0,
        variants: draft.variants,
      };
      const { data, error } = await (supabase as any).rpc("rpc_po_add_existing_product", {
        p_po_id: poId,
        p_source_type: draft.source_type,
        p_source_ref: draft.source_ref,
        p_snapshot: snapshot,
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed");
      toast.success("Added to purchase order");
      qc.invalidateQueries({ queryKey: ["purchase_order", poId] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Failed to add");
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>Edit Restock Details</span>
            <Badge variant="secondary">Restock</Badge>
            <Badge variant="outline">{draft.source_type === "shopify" ? "Shopify" : "Website"}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-3 items-start p-3 rounded-md bg-muted/40">
            {draft.image_url && <img src={draft.image_url} alt="" className="h-16 w-16 rounded object-cover" />}
            <div className="flex-1 text-sm">
              <p className="font-medium">{draft.product_name}</p>
              <p className="text-muted-foreground text-xs mt-1">
                Current price: EC${(draft.current_shopify_price ?? 0).toFixed(2)} · Current stock: {draft.current_shopify_stock ?? 0}
              </p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Product name">
              <Input value={draft.product_name} onChange={e => setDraft({ ...draft, product_name: e.target.value })} />
            </Field>
            <Field label="Image URL">
              <Input value={draft.image_url || ""} onChange={e => setDraft({ ...draft, image_url: e.target.value })} />
            </Field>
            <Field label="Category">
              <Input value={draft.category || ""} onChange={e => setDraft({ ...draft, category: e.target.value })} />
            </Field>
            <Field label="Subcategory">
              <Input value={draft.sub_category || ""} onChange={e => setDraft({ ...draft, sub_category: e.target.value })} />
            </Field>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm">Variants for this batch</Label>
              <Button size="sm" variant="outline" onClick={addVariant}><Plus className="h-3.5 w-3.5 mr-1" />Add variant</Button>
            </div>
            <div className="space-y-2">
              {draft.variants.map((v, i) => (
                <div key={i} className={`grid grid-cols-12 gap-2 items-end p-2 rounded-md border border-border/60 ${!v.included ? "opacity-50" : ""}`}>
                  <div className="col-span-12 sm:col-span-1 flex items-center gap-1">
                    <Checkbox checked={v.included} onCheckedChange={(c) => updateVariant(i, { included: !!c })} />
                    {v.is_new_variant && <Badge className="text-[9px]" variant="secondary">NEW</Badge>}
                  </div>
                  <Field label="Color" className="col-span-6 sm:col-span-2">
                    <Input value={v.option_color || ""} onChange={e => updateVariant(i, { option_color: e.target.value })} />
                  </Field>
                  <Field label="Size" className="col-span-6 sm:col-span-2">
                    <Input value={v.option_size || ""} onChange={e => updateVariant(i, { option_size: e.target.value })} />
                  </Field>
                  <Field label="Cost" className="col-span-4 sm:col-span-2">
                    <Input type="number" step="0.01" value={v.cost_per_item} onChange={e => updateVariant(i, { cost_per_item: Number(e.target.value) || 0 })} />
                  </Field>
                  <Field label="Sell" className="col-span-4 sm:col-span-2">
                    <Input type="number" step="0.01" value={v.selling_price} onChange={e => updateVariant(i, { selling_price: Number(e.target.value) || 0 })} />
                  </Field>
                  <Field label="Qty" className="col-span-3 sm:col-span-2">
                    <Input type="number" min={0} value={v.quantity_ordered} onChange={e => updateVariant(i, { quantity_ordered: Number(e.target.value) || 0 })} />
                  </Field>
                  <div className="col-span-1">
                    <Button size="icon" variant="ghost" onClick={() => removeVariant(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 rounded-md bg-muted/30 p-3 text-xs">
            <div><p className="text-muted-foreground">Total qty</p><p className="font-semibold">{totals.qty}</p></div>
            <div><p className="text-muted-foreground">Total cost</p><p className="font-semibold">EC${totals.cost.toFixed(2)}</p></div>
            <div><p className="text-muted-foreground">Expected profit</p><p className="font-semibold text-primary">EC${totals.profit.toFixed(2)}</p></div>
          </div>

          <Field label="Notes">
            <Textarea rows={2} placeholder="Restock notes for this batch…" />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={busy || totals.qty === 0}>{busy ? "Saving…" : "Add to PO"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
