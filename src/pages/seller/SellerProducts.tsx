import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SellerRouteGuard } from "@/components/seller/SellerRouteGuard";
import { SellerNav } from "@/components/seller/SellerNav";
import { useSellerProfile } from "@/hooks/useSellerProfile";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  Package,
  RefreshCw,
  Eye,
  Pencil,
  Trash2,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { toast } from "sonner";

interface Product {
  id: string;
  name: string;
  price: number;
  quantity: number;
  status: string;
  images: string[];
  category: string | null;
  created_at: string;
}

export default function SellerProducts() {
  const navigate = useNavigate();
  const { profile } = useSellerProfile();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("active");

  useEffect(() => {
    if (profile?.id) {
      fetchProducts();
    }
  }, [profile?.id]);

  const fetchProducts = async () => {
    if (!profile?.id) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from("seller_products")
      .select("*")
      .eq("seller_id", profile.id)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load products");
      console.error(error);
    } else {
      setProducts(data || []);
    }
    setLoading(false);
  };

  const handleToggleStatus = async (product: Product) => {
    const newStatus = product.status === "active" ? "inactive" : "active";
    
    const { error } = await supabase
      .from("seller_products")
      .update({ status: newStatus })
      .eq("id", product.id);

    if (error) {
      toast.error("Failed to update product status");
    } else {
      toast.success(`Product ${newStatus === "active" ? "activated" : "deactivated"}`);
      fetchProducts();
    }
  };

  const handleDelete = async (product: Product) => {
    const { error } = await supabase
      .from("seller_products")
      .delete()
      .eq("id", product.id);

    if (error) {
      toast.error("Failed to delete product");
    } else {
      toast.success("Product deleted");
      fetchProducts();
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "XCD",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const filteredProducts = products.filter((p) => {
    if (activeTab === "active") return p.status === "active";
    if (activeTab === "inactive") return p.status === "inactive";
    if (activeTab === "outofstock") return p.quantity === 0;
    return true;
  });

  const getStatusBadge = (product: Product) => {
    if (product.quantity === 0) {
      return <Badge variant="destructive">Out of Stock</Badge>;
    }
    if (product.status === "active") {
      return <Badge className="bg-green-500/20 text-green-500 border-green-500/30">Active</Badge>;
    }
    return <Badge variant="secondary">Inactive</Badge>;
  };

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
              <h1 className="font-display text-xl md:text-2xl">Products</h1>
              <p className="text-xs text-muted-foreground">
                {products.length} total products
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={fetchProducts} variant="outline" size="sm" className="gap-1.5">
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
              <Button onClick={() => navigate("/seller/products/new")} size="sm" className="gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                Add Product
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-4">
            <TabsList className="grid w-full grid-cols-3 max-w-xs">
              <TabsTrigger value="active" className="text-xs">
                Active ({products.filter((p) => p.status === "active").length})
              </TabsTrigger>
              <TabsTrigger value="inactive" className="text-xs">
                Inactive ({products.filter((p) => p.status === "inactive").length})
              </TabsTrigger>
              <TabsTrigger value="outofstock" className="text-xs">
                Out of Stock ({products.filter((p) => p.quantity === 0).length})
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Products Table */}
          <div className="rounded-lg border border-border/60 bg-card/50">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Package className="mb-4 h-10 w-10 text-muted-foreground" />
                <h3 className="font-medium text-sm">No products found</h3>
                <p className="text-xs text-muted-foreground mb-4">
                  {activeTab === "active" ? "Add your first product to get started" : "No products in this category"}
                </p>
                <Button onClick={() => navigate("/seller/products/new")} size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Product
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs w-12"></TableHead>
                      <TableHead className="text-xs">Product</TableHead>
                      <TableHead className="text-xs">Price</TableHead>
                      <TableHead className="text-xs">Qty</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.map((product) => (
                      <TableRow key={product.id} className="h-14">
                        <TableCell className="py-2">
                          {product.images?.[0] ? (
                            <img
                              src={product.images[0]}
                              alt={product.name}
                              className="h-10 w-10 rounded object-cover"
                            />
                          ) : (
                            <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                              <Package className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="py-2">
                          <div className="font-medium text-sm">{product.name}</div>
                          {product.category && (
                            <div className="text-xs text-muted-foreground">{product.category}</div>
                          )}
                        </TableCell>
                        <TableCell className="py-2 font-medium">
                          {formatCurrency(product.price)}
                        </TableCell>
                        <TableCell className="py-2">
                          <span className={product.quantity === 0 ? "text-destructive" : ""}>
                            {product.quantity}
                          </span>
                        </TableCell>
                        <TableCell className="py-2">{getStatusBadge(product)}</TableCell>
                        <TableCell className="py-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => navigate(`/seller/products/${product.id}`)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleToggleStatus(product)}
                            >
                              {product.status === "active" ? (
                                <ToggleRight className="h-4 w-4 text-green-500" />
                              ) : (
                                <ToggleLeft className="h-4 w-4" />
                              )}
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Product?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will permanently remove "{product.name}" from your store.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDelete(product)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
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
