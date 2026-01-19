import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SellerRouteGuard } from "@/components/seller/SellerRouteGuard";
import { SellerNav } from "@/components/seller/SellerNav";
import { CreateOrderDialog } from "@/components/seller/CreateOrderDialog";
import { useSellerProfile } from "@/hooks/useSellerProfile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ShoppingBag, RefreshCw, Package } from "lucide-react";
import { toast } from "sonner";

interface Sale {
  id: string;
  product_title: string;
  product_image_url: string | null;
  quantity: number;
  price_amount: number;
  sold_at: string;
  product_handle: string;
}

export default function SellerOrders() {
  const navigate = useNavigate();
  const { profile } = useSellerProfile();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.user_id) {
      fetchSales();
    }
  }, [profile?.user_id]);

  const fetchSales = async () => {
    if (!profile?.user_id) return;

    setLoading(true);
    const { data, error } = await supabase
      .from("product_sales")
      .select("*")
      .eq("seller_user_id", profile.user_id)
      .order("sold_at", { ascending: false });

    if (error) {
      toast.error("Failed to load orders");
      console.error(error);
    } else {
      setSales(data || []);
    }
    setLoading(false);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "XCD",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Group sales by date
  const salesByDate = sales.reduce((acc, sale) => {
    const date = formatDate(sale.sold_at);
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(sale);
    return acc;
  }, {} as Record<string, Sale[]>);

  const totalRevenue = sales.reduce((sum, s) => sum + s.price_amount * s.quantity, 0);
  const totalUnits = sales.reduce((sum, s) => sum + s.quantity, 0);

  return (
    <SellerRouteGuard>
      <div className="flex min-h-screen flex-col bg-background">
        <SellerNav
          sellerName={profile?.seller_name}
          logoUrl={profile?.logo_url || undefined}
        />

        <main className="container flex-1 py-4 md:py-6">
          {/* Header */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="font-display text-xl md:text-2xl">Orders</h1>
              <p className="text-xs text-muted-foreground">
                {sales.length} sales · {formatCurrency(totalRevenue)} revenue · {totalUnits} units
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={fetchSales} variant="outline" size="sm" className="gap-1.5">
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
              {profile?.id && (
                <CreateOrderDialog
                  sellerId={profile.id}
                  sellerName={profile.seller_name}
                  sellerWhatsapp={profile.whatsapp}
                  onOrderCreated={fetchSales}
                />
              )}
            </div>
          </div>

          {/* Orders Table */}
          <div className="rounded-lg border border-border/60 bg-card/50">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : sales.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <ShoppingBag className="mb-4 h-10 w-10 text-muted-foreground" />
                <h3 className="font-medium text-sm">No orders yet</h3>
                <p className="text-xs text-muted-foreground">
                  Orders will appear here when customers purchase your products
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs w-12"></TableHead>
                      <TableHead className="text-xs">Product</TableHead>
                      <TableHead className="text-xs">Qty</TableHead>
                      <TableHead className="text-xs">Revenue</TableHead>
                      <TableHead className="text-xs">Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sales.map((sale) => (
                      <TableRow key={sale.id} className="h-14">
                        <TableCell className="py-2">
                          {sale.product_image_url ? (
                            <img
                              src={sale.product_image_url}
                              alt={sale.product_title}
                              className="h-10 w-10 rounded object-cover"
                            />
                          ) : (
                            <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                              <Package className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="py-2">
                          <div className="font-medium text-sm line-clamp-1">
                            {sale.product_title}
                          </div>
                        </TableCell>
                        <TableCell className="py-2">
                          <Badge variant="secondary">{sale.quantity}</Badge>
                        </TableCell>
                        <TableCell className="py-2 font-medium text-green-500">
                          {formatCurrency(sale.price_amount * sale.quantity)}
                        </TableCell>
                        <TableCell className="py-2 text-xs text-muted-foreground">
                          {formatDate(sale.sold_at)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </main>
      </div>
    </SellerRouteGuard>
  );
}
