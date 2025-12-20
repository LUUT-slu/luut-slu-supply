import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface BestSellerProduct {
  product_id: string;
  product_title: string;
  product_handle: string;
  product_image_url: string | null;
  total_sold: number;
  price: number;
  currency_code: string;
}

export function useBestSellers() {
  return useQuery({
    queryKey: ['weekly-best-sellers'],
    queryFn: async (): Promise<BestSellerProduct[]> => {
      const { data, error } = await supabase
        .from('weekly_best_sellers')
        .select('*');
      
      if (error) {
        console.error('Error fetching best sellers:', error);
        return [];
      }
      
      return (data || []) as BestSellerProduct[];
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
}

export async function recordSale(item: {
  productId: string;
  productTitle: string;
  productHandle: string;
  productImageUrl: string | null;
  variantId: string;
  quantity: number;
  priceAmount: number;
  currencyCode: string;
}) {
  const { error } = await supabase
    .from('product_sales')
    .insert({
      product_id: item.productId,
      product_title: item.productTitle,
      product_handle: item.productHandle,
      product_image_url: item.productImageUrl,
      variant_id: item.variantId,
      quantity: item.quantity,
      price_amount: item.priceAmount,
      currency_code: item.currencyCode,
    });

  if (error) {
    console.error('Error recording sale:', error);
  }
}
