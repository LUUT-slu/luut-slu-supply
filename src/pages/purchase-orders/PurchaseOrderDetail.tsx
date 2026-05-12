import { useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, Sparkles, PackageCheck, Send, Tag as TagIcon } from "lucide-react";
import {
  usePurchaseOrder, useUpdatePO, useDeletePO, useUpsertItem, useDeleteItem,
  useAddTag, useRemoveTag, applyAutoTags, PO_STATUSES, STATUS_LABELS, PAYMENT_STATUSES,
  POStatus, PaymentStatus, MANUAL_TAGS, POItem,
} from "@/hooks/usePurchaseOrders";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { POStatusBadge } from "@/components/purchase-orders/POStatusBadge";
import { POSummaryCard } from "@/components/purchase-orders/POSummaryCard";
import { ConfirmArrivalDialog } from "@/components/purchase-orders/ConfirmArrivalDialog";
import { PublishShopifyDialog } from "@/components/purchase-orders/PublishShopifyDialog";
import { BuyingInsightHint } from "@/components/purchase-orders/BuyingInsightHint";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function PurchaseOrderDetail({ basePath }: { basePath: "/admin/purchase-orders" | "/seller/purchase-orders" }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, isLoading } = usePurchaseOrder(id);
  const updatePO = useUpdatePO();
  const deletePO = useDeletePO();
  const upsertItem = useUpsertItem();
  const deleteItem = useDeleteItem();
  const addTag = useAddTag();
  const removeTag = useRemoveTag();
  const [showArrival, setShowArrival] = useState(false);
  const [publishItem, setPublishItem] = useState<POItem | null>(null);
  const isAdminPath = basePath.startsWith("/admin");

  const { data: isAdmin } = useQuery({
    queryKey: ["is_admin_check"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return false;
      const { data: r } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id).eq("role", "admin");
      return (r || []).length > 0;
    },
  });

  if (isLoading || !data?.po) {
    return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  }
  const { po, items, tags } = data;
  const qtyTotal = items.reduce((s, i) => s + (i.quantity_ordered || 0), 0);

  const addBlankItem = async () => {
    await upsertItem.mutateAsync({
      purchase_order_id: po.id,
      product_name: "New item",
      quantity_ordered: 1,
      cost_per_item: 0,
      selling_price: 0,
    });
  };

  const runAutoTags = async () => {
    try { await applyAutoTags(po.id); toast.success("Auto tags applied"); window.location.reload(); }
    catch (e: any) { toast.error(e?.message || "Failed"); }
  };

  const tagsByItem = (itemId: string) => tags.filter(t => t.item_id === itemId);

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-30 border-b border-border/50 bg-background/95 backdrop-blur">
        <div className="container mx-auto flex items-center justify-between px-4 py-3 max-w-3xl">
          <div className="flex items-center gap-2 min-w-0">
            <Link to={basePath} className="text-muted-foreground hover:text-foreground"><ArrowLeft className="h-5 w-5" /></Link>
            <h1 className="text-lg font-semibold truncate">{po.name}</h1>
          </div>
          <POStatusBadge status={po.status as POStatus} />
        </div>
      </header>

      <main className="container mx-auto px-4 py-4 max-w-3xl space-y-4">
        {/* Header fields */}
        <Card className="border-border/60">
          <CardContent className="p-4 grid gap-3 sm:grid-cols-2">
            <Field label="PO name">
              <Input defaultValue={po.name} onBlur={e => updatePO.mutate({ id: po.id, name: e.target.value })} />
            </Field>
            <Field label="Supplier / store">
              <Input defaultValue={po.supplier_name || ""} onBlur={e => updatePO.mutate({ id: po.id, supplier_name: e.target.value })} />
            </Field>
            <Field label="Date ordered">
              <Input type="date" defaultValue={po.date_ordered || ""} onBlur={e => updatePO.mutate({ id: po.id, date_ordered: e.target.value || null })} />
            </Field>
            <Field label="Expected arrival">
              <Input type="date" defaultValue={po.expected_arrival_date || ""} onBlur={e => updatePO.mutate({ id: po.id, expected_arrival_date: e.target.value || null })} />
            </Field>
            <Field label="Status">
              <Select value={po.status} onValueChange={v => updatePO.mutate({ id: po.id, status: v as POStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PO_STATUSES.map(s => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Payment">
              <Select value={po.payment_status} onValueChange={v => updatePO.mutate({ id: po.id, payment_status: v as PaymentStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PAYMENT_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Notes">
                <Textarea defaultValue={po.notes || ""} onBlur={e => updatePO.mutate({ id: po.id, notes: e.target.value })} />
              </Field>
            </div>
          </CardContent>
        </Card>

        <POSummaryCard po={po} itemCount={items.length} qtyTotal={qtyTotal} />

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <Button onClick={addBlankItem}><Plus className="h-4 w-4 mr-1" />Add Item</Button>
          <Button variant="outline" onClick={() => setShowArrival(true)} disabled={items.length === 0}>
            <PackageCheck className="h-4 w-4 mr-1" />Confirm Arrival
          </Button>
          <Button variant="outline" onClick={runAutoTags} disabled={items.length === 0}>
            <Sparkles className="h-4 w-4 mr-1" />Apply Auto Tags
          </Button>
        </div>

        {/* Items */}
        <div className="space-y-3">
          {items.map(item => (
            <Card key={item.id} className="border-border/60">
              <CardContent className="p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <Input className="font-medium" defaultValue={item.product_name}
                    onBlur={e => upsertItem.mutate({ id: item.id, purchase_order_id: po.id, product_name: e.target.value })} />
                  <Button size="icon" variant="ghost" onClick={() => deleteItem.mutate({ id: item.id, purchase_order_id: po.id })}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                <BuyingInsightHint productName={item.product_name} category={item.category} />
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Category">
                    <Input defaultValue={item.category || ""} onBlur={e => upsertItem.mutate({ id: item.id, purchase_order_id: po.id, category: e.target.value })} />
                  </Field>
                  <Field label="Subcategory">
                    <Input defaultValue={item.sub_category || ""} onBlur={e => upsertItem.mutate({ id: item.id, purchase_order_id: po.id, sub_category: e.target.value })} />
                  </Field>
                  <Field label="Qty ordered">
                    <Input type="number" min={0} defaultValue={item.quantity_ordered} onBlur={e => upsertItem.mutate({ id: item.id, purchase_order_id: po.id, quantity_ordered: Number(e.target.value) || 0 })} />
                  </Field>
                  <Field label="Cost / item (EC$)">
                    <Input type="number" min={0} step="0.01" defaultValue={item.cost_per_item} onBlur={e => upsertItem.mutate({ id: item.id, purchase_order_id: po.id, cost_per_item: Number(e.target.value) || 0 })} />
                  </Field>
                  <Field label="Selling price (EC$)">
                    <Input type="number" min={0} step="0.01" defaultValue={item.selling_price} onBlur={e => upsertItem.mutate({ id: item.id, purchase_order_id: po.id, selling_price: Number(e.target.value) || 0 })} />
                  </Field>
                  <Field label="Image URL">
                    <Input defaultValue={item.image_url || ""} onBlur={e => upsertItem.mutate({ id: item.id, purchase_order_id: po.id, image_url: e.target.value })} />
                  </Field>
                </div>

                <div className="grid grid-cols-3 gap-2 rounded-md bg-muted/30 p-2 text-xs">
                  <div><p className="text-muted-foreground">Total cost</p><p className="font-semibold">EC${Number(item.total_cost).toFixed(2)}</p></div>
                  <div><p className="text-muted-foreground">Exp. profit</p><p className="font-semibold text-primary">EC${Number(item.expected_profit).toFixed(2)}</p></div>
                  <div><p className="text-muted-foreground">Margin</p><p className="font-semibold">{Number(item.profit_margin).toFixed(1)}%</p></div>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-1 items-center">
                  <TagIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  {tagsByItem(item.id).map(t => (
                    <Badge key={t.id} variant={t.source === "auto" ? "secondary" : "default"}
                      className="cursor-pointer" onClick={() => removeTag.mutate({ tag_id: t.id, po_id: po.id })}>
                      {t.tag} ×
                    </Badge>
                  ))}
                  <Select onValueChange={(v) => addTag.mutate({ item_id: item.id, tag: v, po_id: po.id })}>
                    <SelectTrigger className="h-7 w-32 text-xs"><SelectValue placeholder="+ tag" /></SelectTrigger>
                    <SelectContent className="max-h-72">
                      {MANUAL_TAGS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {(isAdmin || isAdminPath) && (
                  <Button size="sm" variant="outline" onClick={() => setPublishItem(item)}>
                    <Send className="h-3.5 w-3.5 mr-1" />
                    {item.shopify_product_id ? "Update on Shopify" : "Publish to Shopify"}
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <Button variant="ghost" className="text-destructive" onClick={async () => {
          if (!confirm("Delete this purchase order?")) return;
          await deletePO.mutateAsync(po.id);
          navigate(basePath);
        }}>Delete purchase order</Button>
      </main>

      {showArrival && (
        <ConfirmArrivalDialog open={showArrival} onOpenChange={setShowArrival} poId={po.id} items={items} />
      )}
      {publishItem && (
        <PublishShopifyDialog open={!!publishItem} onOpenChange={(v) => !v && setPublishItem(null)} item={publishItem} poId={po.id} />
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
