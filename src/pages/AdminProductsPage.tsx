import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { BackButton } from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Store, 
  Package, 
  ArrowLeft, 
  Plus, 
  RefreshCw, 
  LogOut,
  ChevronRight,
  Megaphone,
} from "lucide-react";
import { toast } from "sonner";

interface Seller {
  id: string;
  seller_name: string;
  logo_url: string | null;
  is_approved: boolean;
}

interface Product {
  id: string;
  name: string;
  price: number;
  images: string[] | null;
  quantity: number;
}

interface Partner {
  id: string;
  user_id: string;
  partner_name: string;
  is_active: boolean;
}

export default function AdminProductsPage() {
  const navigate = useNavigate();
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [selectedSeller, setSelectedSeller] = useState<Seller | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Allocation dialog state
  const [allocateDialogOpen, setAllocateDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>("");
  const [allocateQty, setAllocateQty] = useState<number>(1);
  const [allocating, setAllocating] = useState(false);

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user) {
      navigate("/seller-auth", { replace: true });
      return;
    }

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id);

    const hasAdminRole = roles?.some(r => (r.role as string) === "admin");
    
    if (!hasAdminRole) {
      toast.error("Admin access required");
      navigate("/seller-auth", { replace: true });
      return;
    }

    setIsAdmin(true);
    setCheckingAuth(false);
    fetchSellers();
    fetchPartners();
  };

  const fetchSellers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("seller_profiles")
      .select("id, seller_name, logo_url, is_approved")
      .eq("is_approved", true)
      .order("seller_name");

    if (error) {
      console.error("Error fetching sellers:", error);
      toast.error("Failed to load sellers");
    } else {
      setSellers(data || []);
    }
    setLoading(false);
  };

  const fetchPartners = async () => {
    const { data } = await supabase
      .from("partner_profiles")
      .select("id, user_id, partner_name, is_active")
      .eq("is_active", true)
      .order("partner_name");

    setPartners(data || []);
  };

  const fetchProducts = async (sellerId: string) => {
    setLoadingProducts(true);
    const { data, error } = await supabase
      .from("seller_products")
      .select("id, name, price, images, quantity")
      .eq("seller_id", sellerId)
      .eq("status", "active")
      .order("name");

    if (error) {
      console.error("Error fetching products:", error);
      toast.error("Failed to load products");
    } else {
      setProducts(data || []);
    }
    setLoadingProducts(false);
  };

  const handleSelectSeller = (seller: Seller) => {
    setSelectedSeller(seller);
    fetchProducts(seller.id);
  };

  const handleBackToSellers = () => {
    setSelectedSeller(null);
    setProducts([]);
  };

  const openAllocateDialog = (product: Product) => {
    setSelectedProduct(product);
    setSelectedPartnerId("");
    setAllocateQty(1);
    setAllocateDialogOpen(true);
  };

  const handleAllocate = async () => {
    if (!selectedProduct || !selectedPartnerId || allocateQty <= 0) {
      toast.error("Select a partner and enter a valid quantity");
      return;
    }

    setAllocating(true);

    const { data, error } = await supabase.rpc('rpc_admin_allocate_seller_product_to_partner', {
      p_partner_id: selectedPartnerId,
      p_product_id: selectedProduct.id,
      p_qty: allocateQty
    });

    if (error) {
      toast.error(error.message || "Failed to allocate stock");
    } else if (data && typeof data === 'object' && 'success' in data) {
      const result = data as { success: boolean; error?: string; allocated?: number; product_name?: string };
      if (!result.success) {
        toast.error(result.error || "Failed to allocate stock");
      } else {
        const partnerName = partners.find(p => p.user_id === selectedPartnerId)?.partner_name || "partner";
        toast.success(`Allocated ${result.allocated} × ${result.product_name} to ${partnerName}`);
        setAllocateDialogOpen(false);
      }
    }

    setAllocating(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logged out successfully");
    navigate("/", { replace: true });
  };

  if (checkingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between">
          <Link to="/" className="font-display text-xl tracking-wide text-primary">
            Home
          </Link>
          <Button onClick={handleLogout} variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-destructive">
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>
      </header>

      <main className="container flex-1 py-4 md:py-6">
        {/* Page Header */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {selectedSeller ? (
              <Button variant="ghost" size="sm" onClick={handleBackToSellers} className="gap-1.5 px-2">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            ) : (
              <BackButton to="/admin" />
            )}
            <div>
              <h1 className="font-display text-xl md:text-2xl">
                {selectedSeller ? selectedSeller.seller_name : "All Products"}
              </h1>
              <p className="text-xs text-muted-foreground">
                {selectedSeller 
                  ? `${products.length} products · Click Allocate to assign to partner`
                  : `${sellers.length} sellers · Select a seller to view products`
                }
              </p>
            </div>
          </div>
          <Button 
            onClick={selectedSeller ? () => fetchProducts(selectedSeller.id) : fetchSellers} 
            variant="outline" 
            size="sm" 
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading || loadingProducts ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Sellers List */}
        {!selectedSeller && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {loading ? (
              <div className="col-span-full">
                <ListItemSkeleton rows={4} />
              </div>
            ) : sellers.length === 0 ? (
              <Card className="col-span-full border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Store className="h-10 w-10 text-muted-foreground/50 mb-3" />
                  <p className="text-sm text-muted-foreground">No approved sellers found</p>
                </CardContent>
              </Card>
            ) : (
              sellers.map((seller) => (
                <Card 
                  key={seller.id}
                  className="cursor-pointer transition-all hover:border-primary/50 hover:shadow-md"
                  onClick={() => handleSelectSeller(seller)}
                >
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted overflow-hidden shrink-0">
                      {seller.logo_url ? (
                        <img src={seller.logo_url} alt={seller.seller_name} className="h-full w-full object-cover" />
                      ) : (
                        <Store className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{seller.seller_name}</p>
                      <p className="text-xs text-muted-foreground">Click to view products</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {/* Products List */}
        {selectedSeller && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Package className="h-4 w-4" />
                Products
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingProducts ? (
                <div className="flex justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : products.length === 0 ? (
                <div className="flex flex-col items-center py-8">
                  <Package className="h-10 w-10 text-muted-foreground/50 mb-3" />
                  <p className="text-sm text-muted-foreground">No active products for this seller</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs">Product</TableHead>
                      <TableHead className="text-xs text-right">Price</TableHead>
                      <TableHead className="text-xs text-right">Stock</TableHead>
                      <TableHead className="text-xs text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {product.images?.[0] && (
                              <img 
                                src={product.images[0]} 
                                alt={product.name}
                                className="h-8 w-8 rounded object-cover"
                              />
                            )}
                            <span className="text-sm font-medium truncate max-w-[150px]">{product.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-sm">EC${product.price.toFixed(2)}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={product.quantity > 0 ? "secondary" : "destructive"} className="text-xs">
                            {product.quantity}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 h-7 px-2"
                              onClick={() => navigate(`/admin/marketing-studio?productId=${product.id}`)}
                              title="Promote this product"
                            >
                              <Megaphone className="h-3 w-3" />
                              <span className="hidden sm:inline">Promote</span>
                            </Button>
                            <Button 
                              size="sm" 
                              className="gap-1 h-7 px-2"
                              onClick={() => openAllocateDialog(product)}
                            >
                              <Plus className="h-3 w-3" />
                              Allocate
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}
      </main>

      {/* Allocate Dialog */}
      <Dialog open={allocateDialogOpen} onOpenChange={setAllocateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Allocate Stock to Partner</DialogTitle>
            <DialogDescription>
              {selectedProduct && `Allocating: ${selectedProduct.name}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Select Partner</label>
              <Select value={selectedPartnerId} onValueChange={setSelectedPartnerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a partner..." />
                </SelectTrigger>
                <SelectContent>
                  {partners.map((partner) => (
                    <SelectItem key={partner.id} value={partner.user_id}>
                      {partner.partner_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Quantity</label>
              <Input
                type="number"
                min={1}
                value={allocateQty}
                onChange={(e) => setAllocateQty(parseInt(e.target.value) || 1)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAllocateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAllocate} disabled={allocating || !selectedPartnerId}>
              {allocating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Allocating...
                </>
              ) : (
                "Allocate"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}