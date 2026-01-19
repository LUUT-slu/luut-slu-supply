import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DateRange } from "react-day-picker";

interface SellerStats {
  totalRevenue: number;
  totalOrders: number;
  totalUnitsSold: number;
  productsActive: number;
  bestSellerProduct: { name: string; count: number } | null;
}

export function useSellerStats(sellerId: string | undefined, dateRange: DateRange | undefined) {
  const [stats, setStats] = useState<SellerStats>({
    totalRevenue: 0,
    totalOrders: 0,
    totalUnitsSold: 0,
    productsActive: 0,
    bestSellerProduct: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sellerId) {
      setLoading(false);
      return;
    }
    
    fetchStats();
  }, [sellerId, dateRange]);

  const fetchStats = async () => {
    if (!sellerId) return;
    
    setLoading(true);

    try {
      // Get active products count
      const { count: productsCount } = await supabase
        .from("seller_products")
        .select("*", { count: "exact", head: true })
        .eq("seller_id", sellerId)
        .eq("status", "active");

      // Get sales data from product_sales with date range filter
      let salesQuery = supabase
        .from("product_sales")
        .select("*");
      
      // Get seller profile to get user_id for sales query
      const { data: sellerProfile } = await supabase
        .from("seller_profiles")
        .select("user_id")
        .eq("id", sellerId)
        .single();

      if (sellerProfile) {
        salesQuery = salesQuery.eq("seller_user_id", sellerProfile.user_id);
      }

      if (dateRange?.from) {
        salesQuery = salesQuery.gte("sold_at", dateRange.from.toISOString());
      }
      if (dateRange?.to) {
        salesQuery = salesQuery.lte("sold_at", dateRange.to.toISOString());
      }

      const { data: salesData } = await salesQuery;

      // Calculate stats from sales data
      let totalRevenue = 0;
      let totalUnits = 0;
      const productSales: Record<string, { name: string; count: number }> = {};

      if (salesData) {
        salesData.forEach((sale) => {
          totalRevenue += Number(sale.price_amount) * sale.quantity;
          totalUnits += sale.quantity;
          
          if (!productSales[sale.product_id]) {
            productSales[sale.product_id] = { name: sale.product_title, count: 0 };
          }
          productSales[sale.product_id].count += sale.quantity;
        });
      }

      // Find best seller
      let bestSeller: { name: string; count: number } | null = null;
      Object.values(productSales).forEach((product) => {
        if (!bestSeller || product.count > bestSeller.count) {
          bestSeller = product;
        }
      });

      // Count unique orders (approximation based on sales)
      const orderCount = salesData?.length || 0;

      setStats({
        totalRevenue,
        totalOrders: orderCount,
        totalUnitsSold: totalUnits,
        productsActive: productsCount || 0,
        bestSellerProduct: bestSeller,
      });
    } catch (error) {
      console.error("Error fetching seller stats:", error);
    } finally {
      setLoading(false);
    }
  };

  return { stats, loading, refetch: fetchStats };
}
