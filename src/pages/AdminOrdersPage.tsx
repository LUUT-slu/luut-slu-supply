import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  Package, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Truck,
  RefreshCw, 
  Filter,
  LogOut,
  Trash2,
  Home,
} from "lucide-react";
import { toast } from "sonner";

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
  assigned_partner_id: string | null;
  line_items: Array<{
    title: string;
    quantity: number;
    price: string;
  }>;
  created_at: string;
}

interface Partner {
  user_id: string;
  partner_name: string;
  phone: string | null;
  whatsapp: string | null;
  is_active: boolean;
}

const WHATSAPP_NUMBER = "7587185478";

const statusOptions = [
  { value: "NEW", label: "New", icon: Package, color: "bg-blue-500" },
  { value: "ASSIGNED", label: "Assigned", icon: Clock, color: "bg-yellow-500" },
  { value: "ACCEPTED", label: "Accepted", icon: CheckCircle, color: "bg-indigo-500" },
  { value: "ON_THE_WAY", label: "On the Way", icon: Truck, color: "bg-purple-500" },
  { value: "COMPLETED", label: "Completed", icon: CheckCircle, color: "bg-green-500" },
  { value: "CANCELLED", label: "Cancelled", icon: XCircle, color: "bg-red-500" },
];

export default function AdminOrdersPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const checkAdminAccess = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return false;
    }

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const hasAdminRole = roles?.some(r => r.role === "admin");
    if (!hasAdminRole) {
      toast.error("Access denied. Admin only.");
      navigate("/");
      return false;
    }

    setIsAdmin(true);
    return true;
  };

  const fetchOrders = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load orders");
      console.error(error);
    } else {
      setOrders((data || []) as unknown as Order[]);
    }
    setLoading(false);
  };

  const fetchPartners = async () => {
    const { data, error } = await supabase
      .from("partner_profiles")
      .select("user_id, partner_name, phone, whatsapp, is_active")
      .eq("is_active", true);

    if (error) {
      console.error("Failed to load partners:", error);
    } else {
      setPartners(data || []);
    }
  };

  useEffect(() => {
    const init = async () => {
      const hasAccess = await checkAdminAccess();
      if (hasAccess) {
        await Promise.all([fetchOrders(), fetchPartners()]);
      }
    };
    init();
  }, []);

  const assignPartner = async (orderId: string, partnerId: string) => {
    setUpdating(orderId);
    
    const { error } = await supabase
      .from("orders")
      .update({ 
        assigned_partner_id: partnerId, 
        status: "ASSIGNED",
        updated_at: new Date().toISOString() 
      })
      .eq("id", orderId);

    if (error) {
      toast.error("Failed to assign partner");
    } else {
      const partner = partners.find(p => p.user_id === partnerId);
      toast.success(`Order assigned to ${partner?.partner_name || 'partner'}`);
      setOrders(orders.map(o => o.id === orderId ? { ...o, assigned_partner_id: partnerId, status: "ASSIGNED" } : o));
      
      const order = orders.find(o => o.id === orderId);
      if (order && partner?.whatsapp) {
        sendPartnerNotification(order, partner);
      }
    }
    setUpdating(null);
  };

  const sendPartnerNotification = (order: Order, partner: Partner) => {
    let message = `🚀 *NEW ORDER ASSIGNED*\n\n`;
    message += `Order: #L${String(order.order_number).padStart(4, '0')}\n\n`;
    message += `👤 Customer: ${order.customer_name}\n`;
    if (order.customer_phone) {
      message += `📱 Phone: ${order.customer_phone}\n`;
    }
    message += `📍 Location: ${order.location}\n`;
    message += `📅 Pickup: ${order.preferred_date}\n`;
    if (order.pickup_time_window) {
      message += `⏰ Time: ${order.pickup_time_window}\n`;
    }
    message += `\n📦 Items:\n`;
    order.line_items.forEach(item => {
      message += `• ${item.title} × ${item.quantity}\n`;
    });
    message += `\n💰 Total: EC$${order.total_price.toFixed(2)}\n`;
    message += `💳 Payment: Cash on pickup`;
    
    if (order.note) {
      message += `\n\n📝 Note: ${order.note}`;
    }

    const phoneNumber = partner.whatsapp?.replace(/\D/g, '') || '';
    if (phoneNumber) {
      const encodedMessage = encodeURIComponent(message);
      const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;
      window.open(whatsappUrl, '_blank');
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/admin-login");
  };

  const toggleSelectOrder = (orderId: string) => {
    const newSelected = new Set(selectedOrders);
    if (newSelected.has(orderId)) {
      newSelected.delete(orderId);
    } else {
      newSelected.add(orderId);
    }
    setSelectedOrders(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedOrders.size === filteredOrders.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(filteredOrders.map(o => o.id)));
    }
  };

  const handleBulkDelete = async () => {
    const orderIds = Array.from(selectedOrders);
    
    const { error } = await supabase
      .from("orders")
      .delete()
      .in("id", orderIds);

    if (error) {
      toast.error("Failed to delete orders");
      console.error(error);
    } else {
      toast.success(`${orderIds.length} order(s) deleted`);
      setOrders(orders.filter(o => !selectedOrders.has(o.id)));
      setSelectedOrders(new Set());
    }
    setDeleteDialogOpen(false);
  };

  const formatOrderNumber = (num: number) => `#L${String(num).padStart(4, '0')}`;
  
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = statusOptions.find(s => s.value === status) || statusOptions[0];
    return (
      <Badge variant="outline" className="gap-1">
        <span className={`h-2 w-2 rounded-full ${statusConfig.color}`} />
        {statusConfig.label}
      </Badge>
    );
  };

  const getPartnerName = (partnerId: string | null) => {
    if (!partnerId) return "Unassigned";
    const partner = partners.find(p => p.user_id === partnerId);
    return partner?.partner_name || "Unknown";
  };

  const filteredOrders = statusFilter === "ALL" 
    ? orders 
    : orders.filter(o => o.status === statusFilter);

  const orderCounts = {
    NEW: orders.filter(o => o.status === "NEW").length,
    ASSIGNED: orders.filter(o => o.status === "ASSIGNED").length,
    ACTIVE: orders.filter(o => ["ACCEPTED", "ON_THE_WAY"].includes(o.status)).length,
    COMPLETED: orders.filter(o => o.status === "COMPLETED").length,
  };

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container py-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl">Admin Orders</h1>
            <p className="text-sm text-muted-foreground">Assign partners and track all orders</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => navigate("/")} variant="outline" size="sm" className="gap-2">
              <Home className="h-4 w-4" />
              <span className="hidden sm:inline">Home</span>
            </Button>
            {selectedOrders.size > 0 && (
              <Button 
                onClick={() => setDeleteDialogOpen(true)} 
                variant="destructive" 
                size="sm" 
                className="gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Delete ({selectedOrders.size})
              </Button>
            )}
            <Button onClick={() => { fetchOrders(); fetchPartners(); }} variant="outline" size="sm" className="gap-2">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button onClick={handleLogout} variant="ghost" size="sm" className="gap-2">
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="mb-6 grid gap-3 grid-cols-2 lg:grid-cols-4">
          <Card className="cursor-pointer hover:border-primary" onClick={() => setStatusFilter("NEW")}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">New</p>
                  <p className="text-2xl font-bold">{orderCounts.NEW}</p>
                </div>
                <Package className="h-5 w-5 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:border-primary" onClick={() => setStatusFilter("ASSIGNED")}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Assigned</p>
                  <p className="text-2xl font-bold">{orderCounts.ASSIGNED}</p>
                </div>
                <Clock className="h-5 w-5 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:border-primary" onClick={() => setStatusFilter("ALL")}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active</p>
                  <p className="text-2xl font-bold">{orderCounts.ACTIVE}</p>
                </div>
                <Truck className="h-5 w-5 text-purple-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:border-primary" onClick={() => setStatusFilter("COMPLETED")}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Completed</p>
                  <p className="text-2xl font-bold">{orderCounts.COMPLETED}</p>
                </div>
                <CheckCircle className="h-5 w-5 text-green-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter */}
        <div className="mb-4 flex items-center gap-3">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Orders</SelectItem>
              {statusOptions.map((status) => (
                <SelectItem key={status.value} value={status.value}>
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {statusFilter !== "ALL" && (
            <Button variant="ghost" size="sm" onClick={() => setStatusFilter("ALL")}>
              Clear
            </Button>
          )}
        </div>

        {/* Orders Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">
              {statusFilter === "ALL" ? "All Orders" : `${statusOptions.find(s => s.value === statusFilter)?.label} Orders`}
              <span className="ml-2 text-sm font-normal text-muted-foreground">({filteredOrders.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Package className="mb-4 h-10 w-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No orders found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">
                        <Checkbox
                          checked={filteredOrders.length > 0 && selectedOrders.size === filteredOrders.length}
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                      <TableHead>Order</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Pickup</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Partner</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map((order) => (
                      <TableRow key={order.id} className={selectedOrders.has(order.id) ? "bg-muted/50" : ""}>
                        <TableCell>
                          <Checkbox
                            checked={selectedOrders.has(order.id)}
                            onCheckedChange={() => toggleSelectOrder(order.id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatOrderNumber(order.order_number)}
                          <div className="text-xs text-muted-foreground">{formatDate(order.created_at)}</div>
                        </TableCell>
                        <TableCell>
                          {order.customer_name}
                          {order.customer_phone && (
                            <div className="text-xs text-muted-foreground">{order.customer_phone}</div>
                          )}
                        </TableCell>
                        <TableCell>{order.location}</TableCell>
                        <TableCell>
                          {order.preferred_date}
                          {order.pickup_time_window && (
                            <div className="text-xs text-muted-foreground">{order.pickup_time_window}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="max-w-[150px]">
                            {order.line_items.slice(0, 2).map((item, i) => (
                              <div key={i} className="text-sm truncate">{item.title} ×{item.quantity}</div>
                            ))}
                            {order.line_items.length > 2 && (
                              <div className="text-xs text-muted-foreground">+{order.line_items.length - 2} more</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">EC${order.total_price.toFixed(2)}</TableCell>
                        <TableCell>{getStatusBadge(order.status)}</TableCell>
                        <TableCell>
                          {order.status === "NEW" || !order.assigned_partner_id ? (
                            <Select
                              value={order.assigned_partner_id || ""}
                              onValueChange={(value) => assignPartner(order.id, value)}
                              disabled={updating === order.id}
                            >
                              <SelectTrigger className="w-[130px]">
                                <SelectValue placeholder="Assign..." />
                              </SelectTrigger>
                              <SelectContent>
                                {partners.map((partner) => (
                                  <SelectItem key={partner.user_id} value={partner.user_id}>
                                    {partner.partner_name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="text-sm">{getPartnerName(order.assigned_partner_id)}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedOrders.size} Order(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The selected orders will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
