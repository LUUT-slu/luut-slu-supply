import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { POItem, confirmArrival } from "@/hooks/usePurchaseOrders";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export function ConfirmArrivalDialog({
  open, onOpenChange, poId, items,
}: { open: boolean; onOpenChange: (v: boolean) => void; poId: string; items: POItem[] }) {
  const qc = useQueryClient();
  const [rows, setRows] = useState(() => items.map(i => ({
    item_id: i.id,
    name: i.product_name,
    arrived: i.quantity_arrived || i.quantity_ordered,
    missing: i.quantity_missing || 0,
    damaged: i.quantity_damaged || 0,
  })));
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      await confirmArrival(poId, rows.map(r => ({ item_id: r.item_id, arrived: r.arrived, missing: r.missing, damaged: r.damaged })), date, notes);
      toast.success("Arrival confirmed");
      qc.invalidateQueries({ queryKey: ["purchase_order", poId] });
      qc.invalidateQueries({ queryKey: ["purchase_orders"] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Failed to confirm arrival");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Confirm Arrival</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="actual-date">Actual arrival date</Label>
              <Input id="actual-date" type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
          </div>
          {rows.map((r, idx) => (
            <div key={r.item_id} className="rounded-md border border-border/60 p-3 space-y-2">
              <p className="font-medium text-sm">{r.name}</p>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs">Arrived</Label>
                  <Input type="number" min={0} value={r.arrived} onChange={e => {
                    const v = Number(e.target.value) || 0;
                    setRows(rs => rs.map((x, i) => i === idx ? { ...x, arrived: v } : x));
                  }} />
                </div>
                <div>
                  <Label className="text-xs">Missing</Label>
                  <Input type="number" min={0} value={r.missing} onChange={e => {
                    const v = Number(e.target.value) || 0;
                    setRows(rs => rs.map((x, i) => i === idx ? { ...x, missing: v } : x));
                  }} />
                </div>
                <div>
                  <Label className="text-xs">Damaged</Label>
                  <Input type="number" min={0} value={r.damaged} onChange={e => {
                    const v = Number(e.target.value) || 0;
                    setRows(rs => rs.map((x, i) => i === idx ? { ...x, damaged: v } : x));
                  }} />
                </div>
              </div>
            </div>
          ))}
          <div>
            <Label htmlFor="arr-notes">Notes</Label>
            <Textarea id="arr-notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Saving…" : "Confirm Arrival"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
