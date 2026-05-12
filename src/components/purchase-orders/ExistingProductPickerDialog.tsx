import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { storefrontApiRequest } from "@/lib/shopify";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Search } from "lucide-react";

export interface PickedVariant {
  shopify_variant_id?: string;
  option_color?: string;
  option_size?: string;
  option_other?: string;
  cost_per_item: number;
  selling_price: number;
  compare_at_price?: number;
  quantity_ordered: number;
  is_new_variant?: boolean;
  included: boolean;
}

export interface PickedProduct {
  source_type: "shopify" | "seller_product";
  source_ref: string;
  product_name: string;
  category?: string;
  sub_category?: string;
  image_url?: string;
  current_shopify_price?: number;
  current_shopify_stock?: number;
  variants: PickedVariant[];
}

const SEARCH_QUERY = `
  query Search($q: String!) {
    products(first: 20, query: $q) {
      edges { node {
        id title handle productType vendor tags
        priceRange { minVariantPrice { amount } }
        images(first: 1) { edges { node { url } } }
        variants(first: 50) { edges { node {
          id title availableForSale
          quantityAvailable
          price { amount }
          compareAtPrice { amount }
          selectedOptions { name value }
        }}}
      }}
    }
  }`;

export function ExistingProductPickerDialog({
  open, onOpenChange, onPick, isAdmin,
}: { open: boolean; onOpenChange: (v: boolean) => void; onPick: (p: PickedProduct) => void; isAdmin: boolean }) {
  const [tab, setTab] = useState<"shopify" | "website">("shopify");
  const [q, setQ] = useState("");
  const [shopifyResults, setShopifyResults] = useState<any[]>([]);
  const [localResults, setLocalResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        if (tab === "shopify") {
          const query = q ? `title:*${q}* OR vendor:*${q}* OR tag:*${q}*` : "";
          const data = await storefrontApiRequest(SEARCH_QUERY, { q: query });
          setShopifyResults(data?.data?.products?.edges?.map((e: any) => e.node) || []);
        } else {
          let qb = supabase.from("seller_products").select("*, seller_profiles(seller_name, user_id)").eq("status", "active").limit(30);
          if (q) qb = qb.ilike("name", `%${q}%`);
          if (!isAdmin) {
            const { data: u } = await supabase.auth.getUser();
            const { data: sp } = await supabase.from("seller_profiles").select("id").eq("user_id", u.user?.id || "").maybeSingle();
            if (sp?.id) qb = qb.eq("seller_id", sp.id);
          }
          const { data } = await qb;
          setLocalResults(data || []);
        }
      } finally { setLoading(false); }
    }, 250);
    return () => clearTimeout(t);
  }, [q, tab, open, isAdmin]);

  const pickShopify = (p: any) => {
    const variantEdges = p.variants?.edges || [];
    const totalStock = variantEdges.reduce((s: number, v: any) => s + (Number(v.node.quantityAvailable) || 0), 0);
    onPick({
      source_type: "shopify",
      source_ref: p.id,
      product_name: p.title,
      category: p.productType || undefined,
      image_url: p.images?.edges?.[0]?.node?.url,
      current_shopify_price: Number(p.priceRange?.minVariantPrice?.amount) || undefined,
      current_shopify_stock: totalStock,
      variants: variantEdges.map((v: any) => {
        const opts = v.node.selectedOptions || [];
        return {
          shopify_variant_id: v.node.id,
          option_color: opts.find((o: any) => /color/i.test(o.name))?.value,
          option_size: opts.find((o: any) => /size/i.test(o.name))?.value,
          option_other: opts.find((o: any) => !/color|size/i.test(o.name))?.value,
          cost_per_item: 0,
          selling_price: Number(v.node.price?.amount) || 0,
          compare_at_price: v.node.compareAtPrice?.amount ? Number(v.node.compareAtPrice.amount) : undefined,
          quantity_ordered: 0,
          included: true,
        };
      }),
    });
  };

  const pickLocal = (p: any) => {
    onPick({
      source_type: "seller_product",
      source_ref: p.id,
      product_name: p.name,
      category: p.main_category || p.category,
      sub_category: p.sub_category,
      image_url: p.images?.[0],
      current_shopify_price: Number(p.price) || undefined,
      current_shopify_stock: Number(p.quantity) || 0,
      variants: [{
        cost_per_item: 0,
        selling_price: Number(p.price) || 0,
        quantity_ordered: 0,
        included: true,
      }],
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Add Existing Product</DialogTitle>
        </DialogHeader>
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="flex-1 flex flex-col min-h-0">
          <TabsList className="self-start">
            <TabsTrigger value="shopify">Shopify products</TabsTrigger>
            <TabsTrigger value="website">Website / sellers</TabsTrigger>
          </TabsList>
          <div className="relative my-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, category, vendor, tag…" className="pl-9" />
          </div>
          <div className="flex-1 overflow-y-auto -mx-1 px-1">
            {loading && <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}
            <TabsContent value="shopify" className="space-y-2 mt-0">
              {shopifyResults.map((p) => (
                <button key={p.id} onClick={() => pickShopify(p)} className="w-full flex gap-3 p-2 rounded-md border border-border/60 hover:bg-accent text-left">
                  <img src={p.images?.edges?.[0]?.node?.url} alt="" className="h-14 w-14 rounded object-cover bg-muted" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{p.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{p.vendor} · {p.productType || "—"}</p>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      <Badge variant="secondary" className="text-[10px]">EC${Number(p.priceRange?.minVariantPrice?.amount).toFixed(2)}</Badge>
                      <Badge variant="outline" className="text-[10px]">{p.variants?.edges?.length || 0} variants</Badge>
                    </div>
                  </div>
                </button>
              ))}
              {!loading && shopifyResults.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">No Shopify products found.</p>}
            </TabsContent>
            <TabsContent value="website" className="space-y-2 mt-0">
              {localResults.map((p) => (
                <button key={p.id} onClick={() => pickLocal(p)} className="w-full flex gap-3 p-2 rounded-md border border-border/60 hover:bg-accent text-left">
                  <img src={p.images?.[0]} alt="" className="h-14 w-14 rounded object-cover bg-muted" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{p.seller_profiles?.seller_name || "—"} · {p.main_category || p.category || "—"}</p>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      <Badge variant="secondary" className="text-[10px]">EC${Number(p.price).toFixed(2)}</Badge>
                      <Badge variant="outline" className="text-[10px]">Stock {p.quantity}</Badge>
                    </div>
                  </div>
                </button>
              ))}
              {!loading && localResults.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">No website products found.</p>}
            </TabsContent>
          </div>
        </Tabs>
        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
