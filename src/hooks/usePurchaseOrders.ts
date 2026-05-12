import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const PO_STATUSES = [
  "draft", "ordered", "paid", "in_transit", "arrived",
  "partially_arrived", "published", "selling", "completed", "cancelled",
] as const;
export type POStatus = typeof PO_STATUSES[number];

export const STATUS_LABELS: Record<POStatus, string> = {
  draft: "Draft",
  ordered: "Ordered",
  paid: "Paid",
  in_transit: "In Transit",
  arrived: "Arrived",
  partially_arrived: "Partially Arrived",
  published: "Published",
  selling: "Selling",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const PAYMENT_STATUSES = ["unpaid", "partial", "paid"] as const;
export type PaymentStatus = typeof PAYMENT_STATUSES[number];

export const MANUAL_TAGS = [
  "Best seller","Quick seller","Slow seller","High demand","Low demand",
  "Cheap item","Premium item","High ROI","Low ROI","Good margin","Risky buy",
  "Restock again","Test product","Main product","Add-on item","Bundle item",
  "Seasonal","New drop","Coming soon","Limited stock",
];

export interface PurchaseOrder {
  id: string;
  owner_user_id: string;
  owner_role: "admin" | "seller";
  seller_profile_id: string | null;
  name: string;
  supplier_name: string | null;
  supplier_link: string | null;
  date_ordered: string | null;
  expected_arrival_date: string | null;
  actual_arrival_date: string | null;
  payment_status: PaymentStatus;
  status: POStatus;
  notes: string | null;
  total_cost: number;
  total_expected_revenue: number;
  total_expected_profit: number;
  avg_margin: number;
  high_roi_count: number;
  risky_count: number;
  created_at: string;
  updated_at: string;
}

export interface POItem {
  id: string;
  purchase_order_id: string;
  product_name: string;
  category: string | null;
  sub_category: string | null;
  quantity_ordered: number;
  quantity_arrived: number;
  quantity_missing: number;
  quantity_damaged: number;
  cost_per_item: number;
  selling_price: number;
  image_url: string | null;
  supplier_link: string | null;
  color: string | null;
  size: string | null;
  brand: string | null;
  notes: string | null;
  linked_seller_product_id: string | null;
  shopify_product_id: string | null;
  shopify_variant_id: string | null;
  shopify_sync_status: string | null;
  shopify_synced_at: string | null;
  shopify_publish_state: "hidden" | "coming_soon" | "draft" | "active";
  qty_sold_cached: number;
  revenue_cached: number;
  total_cost: number;
  expected_revenue: number;
  expected_profit: number;
  profit_margin: number;
}

export interface POItemTag {
  id: string;
  item_id: string;
  tag: string;
  source: "manual" | "auto";
}

export function usePurchaseOrders() {
  return useQuery({
    queryKey: ["purchase_orders"],
    queryFn: async (): Promise<PurchaseOrder[]> => {
      const { data, error } = await (supabase as any)
        .from("purchase_orders")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

export function usePurchaseOrder(id: string | undefined) {
  return useQuery({
    enabled: !!id,
    queryKey: ["purchase_order", id],
    queryFn: async () => {
      const [po, items, tags] = await Promise.all([
        (supabase as any).from("purchase_orders").select("*").eq("id", id).maybeSingle(),
        (supabase as any).from("purchase_order_items").select("*").eq("purchase_order_id", id).order("created_at"),
        (supabase as any).from("purchase_order_item_tags").select("*"),
      ]);
      if (po.error) throw po.error;
      const itemList = (items.data || []) as POItem[];
      const tagList = ((tags.data || []) as POItemTag[]).filter(t =>
        itemList.some(i => i.id === t.item_id)
      );
      return { po: po.data as PurchaseOrder, items: itemList, tags: tagList };
    },
  });
}

export function useCreatePO() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<PurchaseOrder> & { name: string }) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      // Determine role
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
      const isAdmin = (roles || []).some(r => r.role === "admin");
      const owner_role = isAdmin ? "admin" : "seller";
      let seller_profile_id: string | null = null;
      if (!isAdmin) {
        const { data: sp } = await supabase.from("seller_profiles").select("id").eq("user_id", u.user.id).maybeSingle();
        seller_profile_id = sp?.id ?? null;
      }
      const { data, error } = await (supabase as any)
        .from("purchase_orders")
        .insert({ ...input, owner_user_id: u.user.id, owner_role, seller_profile_id })
        .select()
        .single();
      if (error) throw error;
      return data as PurchaseOrder;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["purchase_orders"] }),
  });
}

export function useUpdatePO() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<PurchaseOrder> & { id: string }) => {
      const { error } = await (supabase as any).from("purchase_orders").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["purchase_orders"] });
      qc.invalidateQueries({ queryKey: ["purchase_order", vars.id] });
    },
  });
}

export function useDeletePO() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("purchase_orders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["purchase_orders"] }),
  });
}

export function useUpsertItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: Partial<POItem> & { purchase_order_id: string }) => {
      if (item.id) {
        const { error } = await (supabase as any).from("purchase_order_items").update(item).eq("id", item.id);
        if (error) throw error;
        return item.id;
      }
      const { data, error } = await (supabase as any).from("purchase_order_items").insert(item).select().single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ["purchase_order", vars.purchase_order_id] }),
  });
}

export function useDeleteItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; purchase_order_id: string }) => {
      const { error } = await (supabase as any).from("purchase_order_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ["purchase_order", vars.purchase_order_id] }),
  });
}

export function useAddTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ item_id, tag, po_id }: { item_id: string; tag: string; po_id: string }) => {
      const { error } = await (supabase as any).from("purchase_order_item_tags").insert({ item_id, tag, source: "manual" });
      if (error && !String(error.message).includes("duplicate")) throw error;
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ["purchase_order", vars.po_id] }),
  });
}

export function useRemoveTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ tag_id, po_id }: { tag_id: string; po_id: string }) => {
      const { error } = await (supabase as any).from("purchase_order_item_tags").delete().eq("id", tag_id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ["purchase_order", vars.po_id] }),
  });
}

export async function fetchBuyingInsights(product_name: string, category?: string) {
  const { data, error } = await (supabase as any).rpc("rpc_po_buying_insights", {
    p_product_name: product_name,
    p_category: category ?? null,
  });
  if (error) return null;
  return data as {
    found: boolean;
    last_cost?: number;
    last_sell?: number;
    avg_margin?: number;
    total_sold?: number;
    restock_count?: number;
    best_sell_price?: number;
    recommendation: string;
  };
}

export async function confirmArrival(po_id: string, arrivals: Array<{ item_id: string; arrived: number; missing: number; damaged: number }>, actual_date?: string, notes?: string) {
  const { data, error } = await (supabase as any).rpc("rpc_po_confirm_arrival", {
    p_po_id: po_id,
    p_arrivals: arrivals,
    p_actual_date: actual_date ?? null,
    p_notes: notes ?? null,
  });
  if (error) throw error;
  return data;
}

export async function applyAutoTags(po_id: string) {
  const { data, error } = await (supabase as any).rpc("rpc_po_apply_auto_tags", { p_po_id: po_id });
  if (error) throw error;
  return data;
}
