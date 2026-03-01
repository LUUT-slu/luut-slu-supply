import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AdminAuth } from "@/components/AdminAuth";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Tag, Plus, Pencil, Trash2, Save, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface Discount {
  id: number;
  title: string;
  value_type: string;
  value: string;
  target_type: string;
  target_selection: string;
  once_per_customer: boolean;
  usage_limit: number | null;
  starts_at: string | null;
  ends_at: string | null;
  discount_codes: Array<{ id: number; code: string; usage_count: number }>;
}

interface DiscountForm {
  title: string;
  code: string;
  value_type: "percentage" | "fixed_amount";
  value: string;
  target_selection: "all";
  once_per_customer: boolean;
  usage_limit: string;
  starts_at: string;
  ends_at: string;
}

const emptyForm: DiscountForm = {
  title: "", code: "", value_type: "percentage", value: "",
  target_selection: "all", once_per_customer: true, usage_limit: "",
  starts_at: "", ends_at: "",
};

async function apiCall(action: string, method: string, body?: any) {
  const { data, error } = await supabase.functions.invoke("manage-discounts", {
    method: method as any,
    body: body ? JSON.stringify(body) : undefined,
    headers: { "Content-Type": "application/json" },
  });
  // The edge function uses query params; we pass action via body for invoke
  // Actually supabase.functions.invoke doesn't support query params easily,
  // so we'll pass action in body
  return data;
}

export default function DiscountsManager() {
  const navigate = useNavigate();
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(true);
  const [editForm, setEditForm] = useState<DiscountForm | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState<number | null>(null);

  const fetchDiscounts = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-discounts?action=list`,
        {
          headers: {
            "Authorization": `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setDiscounts(data.price_rules || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load discounts");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDiscounts(); }, []);

  const getStatus = (d: Discount): "active" | "expired" | "scheduled" | "inactive" => {
    const now = new Date();
    if (d.ends_at && new Date(d.ends_at) < now) return "expired";
    if (d.starts_at && new Date(d.starts_at) > now) return "scheduled";
    return "active";
  };

  const handleCreate = () => {
    setEditForm({ ...emptyForm });
    setEditId(null);
    setIsNew(true);
  };

  const handleEdit = (d: Discount) => {
    setEditForm({
      title: d.title,
      code: d.discount_codes[0]?.code || "",
      value_type: d.value_type as any,
      value: String(Math.abs(parseFloat(d.value))),
      target_selection: "all",
      once_per_customer: d.once_per_customer,
      usage_limit: d.usage_limit ? String(d.usage_limit) : "",
      starts_at: d.starts_at ? d.starts_at.slice(0, 16) : "",
      ends_at: d.ends_at ? d.ends_at.slice(0, 16) : "",
    });
    setEditId(d.id);
    setIsNew(false);
  };

  const handleSave = async () => {
    if (!editForm) return;
    setSaving(true);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const baseHeaders = {
        "Authorization": `Bearer ${session?.access_token}`,
        "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        "Content-Type": "application/json",
      };

      if (isNew) {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-discounts?action=create`,
          {
            method: "POST",
            headers: baseHeaders,
            body: JSON.stringify({
              title: editForm.title,
              code: editForm.code,
              value_type: editForm.value_type,
              value: editForm.value,
              target_selection: editForm.target_selection,
              once_per_customer: editForm.once_per_customer,
              usage_limit: editForm.usage_limit ? parseInt(editForm.usage_limit) : null,
              starts_at: editForm.starts_at ? new Date(editForm.starts_at).toISOString() : null,
              ends_at: editForm.ends_at ? new Date(editForm.ends_at).toISOString() : null,
            }),
          }
        );
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        toast.success("Discount created!");
      } else if (editId) {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-discounts?action=update`,
          {
            method: "PUT",
            headers: baseHeaders,
            body: JSON.stringify({
              price_rule_id: editId,
              title: editForm.title,
              value_type: editForm.value_type,
              value: editForm.value,
              once_per_customer: editForm.once_per_customer,
              usage_limit: editForm.usage_limit ? parseInt(editForm.usage_limit) : null,
              starts_at: editForm.starts_at ? new Date(editForm.starts_at).toISOString() : null,
              ends_at: editForm.ends_at ? new Date(editForm.ends_at).toISOString() : null,
            }),
          }
        );
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        toast.success("Discount updated!");
      }

      setEditForm(null);
      fetchDiscounts();
    } catch (err: any) {
      toast.error(err.message || "Failed to save discount");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (d: Discount, enabled: boolean) => {
    setToggling(d.id);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-discounts?action=toggle`,
        {
          method: "PUT",
          headers: {
            "Authorization": `Bearer ${session?.access_token}`,
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ price_rule_id: d.id, enabled }),
        }
      );
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success(enabled ? "Discount activated" : "Discount disabled");
      fetchDiscounts();
    } catch (err: any) {
      toast.error(err.message || "Failed to toggle discount");
    } finally {
      setToggling(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-discounts?action=delete`,
        {
          method: "DELETE",
          headers: {
            "Authorization": `Bearer ${session?.access_token}`,
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ price_rule_id: deleteId }),
        }
      );
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success("Discount deleted");
      setDeleteId(null);
      fetchDiscounts();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete discount");
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; className: string }> = {
      active: { label: "Active", className: "bg-green-500/10 text-green-500 border-green-500/20" },
      expired: { label: "Expired", className: "bg-muted text-muted-foreground" },
      scheduled: { label: "Scheduled", className: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
      inactive: { label: "Inactive", className: "bg-muted text-muted-foreground" },
    };
    const s = map[status] || map.inactive;
    return <Badge variant="outline" className={`text-[10px] ${s.className}`}>{s.label}</Badge>;
  };

  return (
    <AdminAuth>
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <main className="container flex-1 py-8">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/admin/marketing")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="font-display text-xl md:text-2xl">Discounts Manager</h1>
                <p className="text-xs text-muted-foreground">Synced with Shopify price rules</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={fetchDiscounts} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
              <Button onClick={handleCreate} size="sm" className="gap-1">
                <Plus className="h-4 w-4" /> New Discount
              </Button>
            </div>
          </div>

          <div className="max-w-2xl space-y-3">
            {loading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            )}

            {!loading && discounts.length === 0 && (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <Tag className="mb-3 h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">No discounts found. Create one to get started.</p>
                </CardContent>
              </Card>
            )}

            {!loading && discounts.map((d) => {
              const status = getStatus(d);
              const code = d.discount_codes[0]?.code || "—";
              const absValue = Math.abs(parseFloat(d.value));
              const valueDisplay = d.value_type === "percentage" ? `${absValue}%` : `EC$${absValue.toFixed(2)}`;

              return (
                <Card key={d.id}>
                  <CardContent className="flex items-center justify-between gap-4 py-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm truncate">{d.title}</p>
                        {statusBadge(status)}
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        <span className="font-mono font-semibold text-foreground">{code}</span>
                        <span>{valueDisplay} off</span>
                        <span>{d.target_selection === "all" ? "Storewide" : "Specific"}</span>
                        {d.once_per_customer && <span>1x/customer</span>}
                        {d.usage_limit && <span>Limit: {d.usage_limit}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Switch
                        checked={status === "active" || status === "scheduled"}
                        onCheckedChange={(v) => handleToggle(d, v)}
                        disabled={toggling === d.id}
                      />
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(d)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(d.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </main>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={!!editForm} onOpenChange={(open) => { if (!open) setEditForm(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{isNew ? "Create Discount" : "Edit Discount"}</DialogTitle>
          </DialogHeader>
          {editForm && (
            <div className="space-y-4">
              <div>
                <Label className="text-xs">Discount Name</Label>
                <Input className="mt-1" value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} placeholder="Summer Sale" />
              </div>
              {isNew && (
                <div>
                  <Label className="text-xs">Code</Label>
                  <Input className="mt-1 font-mono uppercase" value={editForm.code} onChange={(e) => setEditForm({ ...editForm, code: e.target.value.toUpperCase() })} placeholder="SUMMER15" />
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Type</Label>
                  <Select value={editForm.value_type} onValueChange={(v) => setEditForm({ ...editForm, value_type: v as any })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage</SelectItem>
                      <SelectItem value="fixed_amount">Fixed Amount</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Value</Label>
                  <Input className="mt-1" type="number" value={editForm.value} onChange={(e) => setEditForm({ ...editForm, value: e.target.value })} placeholder={editForm.value_type === "percentage" ? "15" : "10.00"} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <Switch checked={editForm.once_per_customer} onCheckedChange={(v) => setEditForm({ ...editForm, once_per_customer: v })} />
                  <Label className="text-xs">Once per customer</Label>
                </div>
                <div>
                  <Label className="text-xs">Usage Limit</Label>
                  <Input className="mt-1" type="number" value={editForm.usage_limit} onChange={(e) => setEditForm({ ...editForm, usage_limit: e.target.value })} placeholder="Unlimited" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Start Date</Label>
                  <Input className="mt-1" type="datetime-local" value={editForm.starts_at} onChange={(e) => setEditForm({ ...editForm, starts_at: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">End Date</Label>
                  <Input className="mt-1" type="datetime-local" value={editForm.ends_at} onChange={(e) => setEditForm({ ...editForm, ends_at: e.target.value })} />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditForm(null)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {isNew ? "Create" : "Update"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteId !== null} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Discount?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete the discount from Shopify. Customers will no longer be able to use this code.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminAuth>
  );
}
