import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Plus, Search, Trash2, X, ArrowUp, ArrowDown } from "lucide-react";
import { useHybridProducts } from "@/hooks/useHybridProducts";
import {
  PromotionCampaign,
  PromotionProductRef,
  PromotionVisibility,
  DiscountType,
  useUpsertPromotionCampaign,
} from "@/hooks/usePromotionCampaigns";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  campaign: PromotionCampaign | null;
}

const PROMO_LABELS = ["Sale", "Discount", "Limited Deal", "Bundle Offer", "Flash Sale", "Clearance", "Featured"];

const fmtMoney = (v?: string | number) => {
  if (v === undefined || v === null || v === "") return "";
  return `EC$${Math.round(Number(v))}`;
};

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 16);
}
function fromLocalInput(local: string): string | null {
  if (!local) return null;
  return new Date(local).toISOString();
}

export function PromotionEditor({ open, onOpenChange, campaign }: Props) {
  const isEdit = !!campaign;
  const upsert = useUpsertPromotionCampaign();
  const { products, loading } = useHybridProducts({ limit: 100 });

  const [name, setName] = useState("");
  const [promoLabel, setPromoLabel] = useState("Sale");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [discountType, setDiscountType] = useState<DiscountType>("percent");
  const [discountValue, setDiscountValue] = useState<string>("10");
  const [visibility, setVisibility] = useState<PromotionVisibility>({
    posters: true,
    productPages: false,
    homepage: false,
    collections: false,
  });
  const [productRefs, setProductRefs] = useState<PromotionProductRef[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open) return;
    if (campaign) {
      setName(campaign.name);
      setPromoLabel(campaign.promo_label);
      setDescription(campaign.description ?? "");
      setStartDate(toLocalInput(campaign.start_date));
      setEndDate(toLocalInput(campaign.end_date));
      setIsActive(campaign.is_active);
      setDiscountType(campaign.discount_type);
      setDiscountValue(String(campaign.discount_value ?? 0));
      setVisibility(campaign.visibility);
      setProductRefs(campaign.product_refs);
    } else {
      setName("");
      setPromoLabel("Sale");
      setDescription("");
      setStartDate("");
      setEndDate("");
      setIsActive(true);
      setDiscountType("percent");
      setDiscountValue("10");
      setVisibility({ posters: true, productPages: false, homepage: false, collections: false });
      setProductRefs([]);
    }
    setSearch("");
  }, [open, campaign]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? products.filter((p) => p.title.toLowerCase().includes(q))
      : products;
    const selectedIds = new Set(productRefs.map((r) => r.id));
    return list.filter((p) => !selectedIds.has(p.id)).slice(0, 30);
  }, [products, search, productRefs]);

  const addProduct = (p: typeof products[number]) => {
    setProductRefs((prev) => [
      ...prev,
      {
        id: p.id,
        source: p.source === "shopify" ? "shopify" : "local",
        title: p.title,
        image: p.images?.[0]?.url,
        price: p.price?.amount ? String(p.price.amount) : undefined,
      },
    ]);
  };

  const removeProduct = (id: string) => {
    setProductRefs((prev) => prev.filter((r) => r.id !== id));
  };

  const move = (id: string, dir: -1 | 1) => {
    setProductRefs((prev) => {
      const idx = prev.findIndex((r) => r.id === id);
      if (idx < 0) return prev;
      const next = idx + dir;
      if (next < 0 || next >= prev.length) return prev;
      const copy = [...prev];
      [copy[idx], copy[next]] = [copy[next], copy[idx]];
      return copy;
    });
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Promotion name is required");
      return;
    }
    try {
      await upsert.mutateAsync({
        ...(campaign?.id ? { id: campaign.id } : {}),
        name: name.trim(),
        promo_label: promoLabel,
        description: description.trim() || null,
        start_date: fromLocalInput(startDate),
        end_date: fromLocalInput(endDate),
        is_active: isActive,
        discount_type: discountType,
        discount_value: Number(discountValue) || 0,
        product_refs: productRefs as any,
        visibility: visibility as any,
      });
      toast.success(isEdit ? "Promotion updated" : "Promotion created");
      onOpenChange(false);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Failed to save promotion");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Promotion" : "New Promotion"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Basics */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Promotion name *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Black Friday Drop"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Promo label</Label>
              <Select value={promoLabel} onValueChange={setPromoLabel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROMO_LABELS.map((l) => (
                    <SelectItem key={l} value={l}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Description (optional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Internal note about this promotion..."
              rows={2}
            />
          </div>

          {/* Dates + active */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Start date</Label>
              <Input
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>End date</Label>
              <Input
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <div className="flex h-10 items-center gap-3 rounded-md border px-3">
                <Switch checked={isActive} onCheckedChange={setIsActive} />
                <span className="text-sm">{isActive ? "Active" : "Draft"}</span>
              </div>
            </div>
          </div>

          {/* Discount */}
          <div className="space-y-2 rounded-md border p-3">
            <Label className="text-sm font-semibold">Discount</Label>
            <RadioGroup
              value={discountType}
              onValueChange={(v) => setDiscountType(v as DiscountType)}
              className="grid grid-cols-2 sm:grid-cols-4 gap-2"
            >
              {[
                { v: "percent", l: "Percent off" },
                { v: "fixed", l: "Fixed amount" },
                { v: "override", l: "Price override" },
                { v: "none", l: "No discount" },
              ].map((o) => (
                <label
                  key={o.v}
                  className="flex items-center gap-2 rounded-md border px-2 py-1.5 cursor-pointer hover:bg-muted/40"
                >
                  <RadioGroupItem value={o.v} />
                  <span className="text-xs">{o.l}</span>
                </label>
              ))}
            </RadioGroup>
            {discountType !== "none" && (
              <div className="flex items-center gap-2 pt-1">
                <Input
                  type="number"
                  min={0}
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  className="w-32"
                />
                <span className="text-xs text-muted-foreground">
                  {discountType === "percent" ? "% off" : discountType === "fixed" ? "EC$ off" : "EC$ override price"}
                </span>
              </div>
            )}
          </div>

          {/* Visibility */}
          <div className="space-y-2 rounded-md border p-3">
            <Label className="text-sm font-semibold">Visibility</Label>
            <div className="grid grid-cols-2 gap-2">
              {([
                ["posters", "Marketing posters"],
                ["productPages", "Product pages"],
                ["homepage", "Homepage sections"],
                ["collections", "Collections / promo pages"],
              ] as const).map(([k, l]) => (
                <label key={k} className="flex items-center gap-2 text-xs">
                  <Switch
                    checked={visibility[k]}
                    onCheckedChange={(v) => setVisibility((prev) => ({ ...prev, [k]: v }))}
                  />
                  {l}
                </label>
              ))}
            </div>
          </div>

          {/* Product picker */}
          <div className="space-y-2 rounded-md border p-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">
                Products ({productRefs.length})
              </Label>
            </div>

            {/* Selected list */}
            {productRefs.length > 0 && (
              <div className="space-y-1 rounded-md bg-muted/40 p-2">
                {productRefs.map((r, i) => (
                  <div
                    key={r.id}
                    className="flex items-center gap-2 rounded bg-background p-1.5"
                  >
                    {r.image && (
                      <img
                        src={r.image}
                        alt=""
                        className="h-9 w-9 rounded object-cover"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-medium">{r.title}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {r.source} {r.price ? `· ${fmtMoney(r.price)}` : ""}
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => move(r.id, -1)}
                      disabled={i === 0}
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => move(r.id, 1)}
                      disabled={i === productRefs.length - 1}
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive"
                      onClick={() => removeProduct(r.id)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Search & add */}
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products to add..."
                className="pl-7"
              />
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading products
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-56 overflow-y-auto">
                {filteredProducts.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addProduct(p)}
                    className="group flex items-center gap-1.5 rounded border bg-background p-1.5 text-left hover:border-primary"
                  >
                    {p.images?.[0]?.url && (
                      <img
                        src={p.images[0].url}
                        alt=""
                        className="h-8 w-8 flex-shrink-0 rounded object-cover"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[11px] font-medium">{p.title}</div>
                      <div className="text-[9px] text-muted-foreground">
                        {p.price?.amount ? fmtMoney(p.price.amount) : ""}
                      </div>
                    </div>
                    <Plus className="h-3 w-3 text-muted-foreground group-hover:text-primary" />
                  </button>
                ))}
                {filteredProducts.length === 0 && (
                  <div className="col-span-full py-4 text-center text-xs text-muted-foreground">
                    {search ? "No matches" : "All products added"}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={upsert.isPending}>
            {upsert.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? "Save changes" : "Create promotion"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
