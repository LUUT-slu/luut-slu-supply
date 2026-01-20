import { useState, useEffect } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { BackButton } from "@/components/BackButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  User,
  Phone,
  MapPin,
  Package,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  LogOut,
  MessageCircle,
  ArrowRightLeft,
  Truck,
  Plus,
  Boxes,
} from "lucide-react";
import { toast } from "sonner";

interface PartnerStockItem {
  id: string;
  product_id: string;
  qty_on_hand: number;
  product?: {
    name: string;
    price: number;
    images: string[] | null;
  };
}

interface Product {
  id: string;
  name: string;
  price: number;
}

interface Partner {
  id: string;
  user_id: string;
  partner_name: string;
  phone: string | null;
  whatsapp: string | null;
  location: string | null;
  is_active: boolean;
  created_at: string;
}

interface Order {
  id: string;
  order_number: number;
  customer_name: string;
  customer_phone: string | null;
  location: string;
  preferred_date: string;
  pickup_time_window: string | null;
  note: string | null;
  status: string;
  total_price: number;
  currency_code: string;
  line_items: Array<{
    title: string;
    quantity: number;
    price: string;
  }>;
  created_at: string;
}

const statusColors: Record<string, string> = {
  NEW: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  ASSIGNED: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  ACCEPTED: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
  ON_THE_WAY: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  COMPLETED: "bg-green-500/20 text-green-400 border-green-500/30",
  CANCELLED: "bg-red-500/20 text-red-400 border-red-500/30",
};

export default function PartnerDetailsPage() {
  const { partnerId } = useParams<{ partnerId: string }>();
  const navigate = useNavigate();
  const [partner, setPartner] = useState<Partner | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [allPartners, setAllPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [reassignDialogOpen, setReassignDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [newPartnerId, setNewPartnerId] = useState<string>("");
  
  // Stock allocation state
  const [partnerStock, setPartnerStock] = useState<PartnerStockItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [allocateDialogOpen, setAllocateDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<string>("");
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
    fetchData();
  };

  const fetchData = async () => {
    if (!partnerId) return;
    
    setLoading(true);
    
    // Fetch partner details
    const { data: partnerData, error: partnerError } = await supabase
      .from("partner_profiles")
      .select("*")
      .eq("user_id", partnerId)
      .single();

    if (partnerError || !partnerData) {
      toast.error("Partner not found");
      navigate("/admin/partners");
      return;
    }

    setPartner(partnerData);

    // Fetch orders assigned to this partner
    const { data: ordersData } = await supabase
      .from("orders")
      .select("*")
      .eq("assigned_partner_id", partnerId)
      .order("created_at", { ascending: false });

    setOrders((ordersData || []) as unknown as Order[]);

    // Fetch all active partners for reassignment
    const { data: partnersData } = await supabase
      .from("partner_profiles")
      .select("*")
      .eq("is_active", true);

    setAllPartners((partnersData || []).filter(p => p.user_id !== partnerId));
    
    // Fetch partner stock
    await fetchPartnerStock();
    
    // Fetch products for allocation
    await fetchProducts();
    
    setLoading(false);
  };

  const fetchPartnerStock = async () => {
    if (!partnerId) return;
    
    const { data } = await supabase
      .from('partner_stock')
      .select('id, product_id, qty_on_hand, product:seller_products(name, price, images)')
      .eq('partner_id', partnerId)
      .gt('qty_on_hand', 0);
    
    setPartnerStock((data || []) as unknown as PartnerStockItem[]);
  };

  const fetchProducts = async () => {
    const { data } = await supabase
      .from('seller_products')
      .select('id, name, price')
      .eq('status', 'active')
      .order('name');
    
    setProducts(data || []);
  };

  const allocateStock = async () => {
    if (!selectedProduct || allocateQty <= 0 || !partnerId) {
      toast.error("Select a product and enter a valid quantity");
      return;
    }
    
    setAllocating(true);
    
    const { data, error } = await supabase.rpc('rpc_admin_allocate_stock_to_partner', {
      p_partner_id: partnerId,
      p_product_id: selectedProduct,
      p_qty: allocateQty
    });
    
    if (error) {
      toast.error(error.message || "Failed to allocate stock");
    } else if (data && typeof data === 'object' && 'success' in data) {
      const result = data as { success: boolean; error?: string; allocated?: number };
      if (!result.success) {
        toast.error(result.error || "Failed to allocate stock");
      } else {
        toast.success(`Allocated ${result.allocated} units`);
        setAllocateDialogOpen(false);
        setSelectedProduct("");
        setAllocateQty(1);
        fetchPartnerStock();
      }
    }
    
    setAllocating(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logged out successfully");
    navigate("/", { replace: true });
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    const { error } = await supabase
      .from("orders")
      .update({ 
        status: newStatus, 
        order_status: newStatus,
        updated_at: new Date().toISOString() 
      })
      .eq("id", orderId);

    if (error) {
      toast.error("Failed to update status");
    } else {
      toast.success(`Order marked as ${newStatus}`);
      fetchData();
    }
  };

  const openReassignDialog = (order: Order) => {
    setSelectedOrder(order);
    setNewPartnerId("");
    setReassignDialogOpen(true);
  };

  const reassignOrder = async () => {
    if (!selectedOrder || !newPartnerId) return;

    const { error } = await supabase
      .from("orders")
      .update({ 
        assigned_partner_id: newPartnerId,
        updated_at: new Date().toISOString() 
      })
      .eq("id", selectedOrder.id);

    if (error) {
      toast.error("Failed to reassign order");
    } else {
      toast.success("Order reassigned");
      setReassignDialogOpen(false);
      fetchData();
    }
  };

  const cancelAssignment = async (orderId: string) => {
    const { error } = await supabase
      .from("orders")
      .update({ 
        assigned_partner_id: null,
        status: "NEW",
        updated_at: new Date().toISOString() 
      })
      .eq("id", orderId);

    if (error) {
      toast.error("Failed to cancel assignment");
    } else {
      toast.success("Assignment cancelled, order returned to queue");
      fetchData();
    }
  };

  const formatPrice = (price: number, currency: string) => {
    return `${currency === 'XCD' ? 'EC$' : '$'}${price.toFixed(2)}`;
  };

  if (checkingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAdmin || !partner) return null;

  const activeOrders = orders.filter(o => !["COMPLETED", "CANCELLED"].includes(o.status));
  const completedOrders = orders.filter(o => o.status === "COMPLETED");

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Admin Header */}
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
        {/* Header */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <BackButton to="/admin/partners" />
            <div>
              <h1 className="font-display text-xl md:text-2xl">{partner.partner_name}</h1>
              <p className="text-xs text-muted-foreground">
                Partner Details · {activeOrders.length} active orders
              </p>
            </div>
          </div>
          <Button onClick={fetchData} variant="outline" size="sm" className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Partner Profile Card */}
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <User className="h-4 w-4" />
              Partner Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Status</p>
              <Badge variant={partner.is_active ? "default" : "secondary"}>
                {partner.is_active ? "Active" : "Inactive"}
              </Badge>
            </div>
            <div>
              <p className="text-muted-foreground text-xs flex items-center gap-1">
                <Phone className="h-3 w-3" /> Phone
              </p>
              <p className="font-medium">{partner.phone || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs flex items-center gap-1">
                <MessageCircle className="h-3 w-3" /> WhatsApp
              </p>
              {partner.whatsapp ? (
                <a 
                  href={`https://wa.me/${partner.whatsapp}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary hover:underline"
                >
                  {partner.whatsapp}
                </a>
              ) : (
                <p className="font-medium">—</p>
              )}
            </div>
            <div>
              <p className="text-muted-foreground text-xs flex items-center gap-1">
                <MapPin className="h-3 w-3" /> Location
              </p>
              <p className="font-medium">{partner.location || "—"}</p>
            </div>
          </CardContent>
        </Card>

        {/* Stats Bar */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-card/50 px-3 py-2">
            <Package className="h-4 w-4 text-blue-500" />
            <div>
              <p className="text-xs text-muted-foreground">Active</p>
              <p className="font-semibold">{activeOrders.length}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-card/50 px-3 py-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <div>
              <p className="text-xs text-muted-foreground">Completed</p>
              <p className="font-semibold">{completedOrders.length}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-card/50 px-3 py-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="font-semibold">{orders.length}</p>
            </div>
          </div>
        </div>

        {/* Partner Stock Section */}
        <Card className="mb-4">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Boxes className="h-4 w-4" />
              Partner Stock
            </CardTitle>
            <Button size="sm" className="gap-1" onClick={() => setAllocateDialogOpen(true)}>
              <Plus className="h-3 w-3" />
              Allocate Stock
            </Button>
          </CardHeader>
          <CardContent>
            {partnerStock.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No stock allocated to this partner</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs">Product</TableHead>
                    <TableHead className="text-xs text-right">Qty On Hand</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {partnerStock.map(item => (
                    <TableRow key={item.id}>
                      <TableCell className="text-sm">{item.product?.name || 'Unknown Product'}</TableCell>
                      <TableCell className="text-right font-medium">{item.qty_on_hand}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Assigned Orders */}
        <div className="rounded-lg border border-border/60 bg-card/50">
          <div className="px-4 py-3 border-b border-border/60">
            <h2 className="font-medium text-sm">Assigned Orders</h2>
          </div>
          
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Package className="mb-4 h-10 w-10 text-muted-foreground" />
              <h3 className="font-medium text-sm">No orders assigned</h3>
              <p className="text-xs text-muted-foreground">Assign orders from the Partner Management page</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs">Order</TableHead>
                    <TableHead className="text-xs">Customer</TableHead>
                    <TableHead className="text-xs">Items</TableHead>
                    <TableHead className="text-xs">Meetup</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order.id} className="h-auto">
                      <TableCell className="py-2">
                        <div className="font-medium text-sm">
                          #L{String(order.order_number).padStart(4, '0')}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatPrice(order.total_price, order.currency_code)}
                        </div>
                      </TableCell>
                      <TableCell className="py-2">
                        <div className="text-sm">{order.customer_name}</div>
                        {order.customer_phone && (
                          <a 
                            href={`tel:${order.customer_phone}`}
                            className="text-xs text-primary hover:underline"
                          >
                            {order.customer_phone}
                          </a>
                        )}
                      </TableCell>
                      <TableCell className="py-2">
                        <div className="text-xs max-w-32">
                          {order.line_items?.slice(0, 2).map((item, i) => (
                            <div key={i} className="truncate">
                              {item.quantity}x {item.title}
                            </div>
                          ))}
                          {order.line_items?.length > 2 && (
                            <div className="text-muted-foreground">
                              +{order.line_items.length - 2} more
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-2">
                        <div className="text-xs">
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {order.location}
                          </div>
                          <div>{order.preferred_date}</div>
                          {order.pickup_time_window && (
                            <div className="text-muted-foreground">{order.pickup_time_window}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-2">
                        <Badge className={statusColors[order.status] || "bg-gray-500/20"}>
                          {order.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Mark Completed */}
                          {order.status !== "COMPLETED" && order.status !== "CANCELLED" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-green-500 hover:text-green-400 hover:bg-green-500/10"
                              onClick={() => updateOrderStatus(order.id, "COMPLETED")}
                              title="Mark Completed"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          )}
                          
                          {/* Reassign */}
                          {order.status !== "COMPLETED" && order.status !== "CANCELLED" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-blue-500 hover:text-blue-400 hover:bg-blue-500/10"
                              onClick={() => openReassignDialog(order)}
                              title="Reassign Partner"
                            >
                              <ArrowRightLeft className="h-4 w-4" />
                            </Button>
                          )}

                          {/* Cancel Assignment */}
                          {order.status !== "COMPLETED" && order.status !== "CANCELLED" && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  title="Cancel Assignment"
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Cancel Assignment?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will remove the partner assignment and return the order to the unassigned queue.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Keep Assignment</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => cancelAssignment(order.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Cancel Assignment
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
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

      {/* Reassign Dialog */}
      <Dialog open={reassignDialogOpen} onOpenChange={setReassignDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reassign Order</DialogTitle>
            <DialogDescription>
              Select a new partner for order #L{String(selectedOrder?.order_number || 0).padStart(4, '0')}
            </DialogDescription>
          </DialogHeader>
          <Select value={newPartnerId} onValueChange={setNewPartnerId}>
            <SelectTrigger>
              <SelectValue placeholder="Select partner" />
            </SelectTrigger>
            <SelectContent>
              {allPartners.map((p) => (
                <SelectItem key={p.user_id} value={p.user_id}>
                  {p.partner_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReassignDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={reassignOrder} disabled={!newPartnerId}>
              Reassign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Allocate Stock Dialog */}
      <Dialog open={allocateDialogOpen} onOpenChange={setAllocateDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Allocate Stock to Partner</DialogTitle>
            <DialogDescription>
              Select a product and quantity to allocate from admin inventory.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Product</label>
              <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                <SelectTrigger>
                  <SelectValue placeholder="Select product" />
                </SelectTrigger>
                <SelectContent>
                  {products.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Quantity</label>
              <Input 
                type="number" 
                min={1} 
                value={allocateQty} 
                onChange={e => setAllocateQty(parseInt(e.target.value) || 1)} 
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAllocateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={allocateStock} disabled={!selectedProduct || allocating}>
              {allocating ? "Allocating..." : "Allocate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
