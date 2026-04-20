import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type DiscountType = "percent" | "fixed" | "override" | "none";
export type CampaignStatus = "active" | "scheduled" | "expired" | "draft";

export interface PromotionProductRef {
  id: string;
  source: "shopify" | "local";
  title: string;
  image?: string;
  price?: string;
}

export interface PromotionVisibility {
  posters: boolean;
  productPages: boolean;
  homepage: boolean;
  collections: boolean;
}

export interface PromotionCampaign {
  id: string;
  name: string;
  promo_label: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  discount_type: DiscountType;
  discount_value: number;
  product_refs: PromotionProductRef[];
  visibility: PromotionVisibility;
  created_at: string;
  updated_at: string;
}

export function deriveStatus(c: Pick<PromotionCampaign, "is_active" | "start_date" | "end_date">): CampaignStatus {
  if (!c.is_active) return "draft";
  const now = Date.now();
  const start = c.start_date ? new Date(c.start_date).getTime() : null;
  const end = c.end_date ? new Date(c.end_date).getTime() : null;
  if (end !== null && end < now) return "expired";
  if (start !== null && start > now) return "scheduled";
  return "active";
}

export function usePromotionCampaigns() {
  return useQuery({
    queryKey: ["promotion-campaigns"],
    queryFn: async (): Promise<PromotionCampaign[]> => {
      const { data, error } = await supabase
        .from("promotion_campaigns" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data as any[]) || []).map((r) => ({
        ...r,
        product_refs: Array.isArray(r.product_refs) ? r.product_refs : [],
        visibility:
          r.visibility && typeof r.visibility === "object"
            ? r.visibility
            : { posters: true, productPages: false, homepage: false, collections: false },
      })) as PromotionCampaign[];
    },
    staleTime: 60_000,
  });
}

export function useActivePromotionCampaigns() {
  return useQuery({
    queryKey: ["promotion-campaigns", "active"],
    queryFn: async (): Promise<PromotionCampaign[]> => {
      const { data, error } = await supabase
        .from("promotion_campaigns" as any)
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const list = ((data as any[]) || []).map((r) => ({
        ...r,
        product_refs: Array.isArray(r.product_refs) ? r.product_refs : [],
        visibility:
          r.visibility && typeof r.visibility === "object"
            ? r.visibility
            : { posters: true, productPages: false, homepage: false, collections: false },
      })) as PromotionCampaign[];
      return list.filter((c) => deriveStatus(c) === "active");
    },
    staleTime: 60_000,
  });
}

export function useUpsertPromotionCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<PromotionCampaign> & { id?: string }) => {
      const payload: any = { ...input };
      const { data, error } = await supabase
        .from("promotion_campaigns" as any)
        .upsert(payload)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["promotion-campaigns"] });
    },
  });
}

export function useDeletePromotionCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("promotion_campaigns" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["promotion-campaigns"] });
    },
  });
}
