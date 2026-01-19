import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";

import { AdminAuth } from "@/components/AdminAuth";
import { BackButton } from "@/components/BackButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { 
  Package, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Truck,
  RefreshCw, 
  Users, 
  Trash2,
  UserPlus,
  Filter,
} from "lucide-react";
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
import { toast } from "sonner";
import { Link } from "react-router-dom";

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

export default function LuutConnectAdmin() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

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
    fetchOrders();
    fetchPartners();
  }, []);

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    setUpdating(orderId);
    const { error } = await supabase
      .from("orders")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", orderId);

    if (error) {
      toast.error("Failed to update order status");
    } else {
      toast.success("Order status updated");
      setOrders(orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
    }
    setUpdating(null);
  };

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
      
      // Send WhatsApp notification to partner
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

  const deleteOrder = async (orderId: string) => {
    const { error } = await supabase
      .from("orders")
      .delete()
      .eq("id", orderId);

    if (error) {
      toast.error("Failed to delete order");
    } else {
      toast.success("Order deleted");
      setOrders(orders.filter(o => o.id !== orderId));
    }
  };

  const formatOrderNumber = (num: number) => `#L${String(num).padStart(4, '0')}`;
  
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
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
    NEW: orders.filter(o => o.status === "NEW" || o.status === "pending").length,
    ASSIGNED: orders.filter(o => o.status === "ASSIGNED").length,
    ACCEPTED: orders.filter(o => o.status === "ACCEPTED").length,
    ON_THE_WAY: orders.filter(o => o.status === "ON_THE_WAY").length,
    COMPLETED: orders.filter(o => o.status === "COMPLETED" || o.status === "completed").length,
    CANCELLED: orders.filter(o => o.status === "CANCELLED" || o.status === "cancelled").length,
  };

  return (
    <AdminAuth>
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        
        <main className="container flex-1 py-8">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <BackButton />
              <div>
                <h1 className="font-display text-3xl">Luut Connect</h1>
                <p className="text-muted-foreground">Order Management System</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" asChild>
                <Link to="/connect/partners" className="gap-2">
                  <Users className="h-4 w-4" />
                  Partners
                </Link>
              </Button>
              <Button onClick={() => { fetchOrders(); fetchPartners(); }} variant="outline" size="sm" className="gap-2">
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="mb-8 grid gap-4 grid-cols-2 lg:grid-cols-6">
            <Card className="cursor-pointer hover:border-primary" onClick={() => setStatusFilter("NEW")}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">New</CardTitle>
                <Package className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{orderCounts.NEW}</div>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:border-primary" onClick={() => setStatusFilter("ASSIGNED")}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Assigned</CardTitle>
                <Clock className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{orderCounts.ASSIGNED}</div>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:border-primary" onClick={() => setStatusFilter("ACCEPTED")}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Accepted</CardTitle>
                <CheckCircle className="h-4 w-4 text-indigo-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{orderCounts.ACCEPTED}</div>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:border-primary" onClick={() => setStatusFilter("ON_THE_WAY")}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">On the Way</CardTitle>
                <Truck className="h-4 w-4 text-purple-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{orderCounts.ON_THE_WAY}</div>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:border-primary" onClick={() => setStatusFilter("COMPLETED")}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Completed</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{orderCounts.COMPLETED}</div>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:border-primary" onClick={() => setStatusFilter("CANCELLED")}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Cancelled</CardTitle>
                <XCircle className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{orderCounts.CANCELLED}</div>
              </CardContent>
            </Card>
          </div>

          {/* Filter */}
          <div className="mb-4 flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Filter:</span>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
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
                Clear Filter
              </Button>
            )}
          </div>

          {/* Orders Table */}
          <Card>
            <CardHeader>
              <CardTitle>
                {statusFilter === "ALL" ? "All Orders" : `${statusOptions.find(s => s.value === statusFilter)?.label || statusFilter} Orders`}
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({filteredOrders.length})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Package className="mb-4 h-12 w-12 text-muted-foreground" />
                  <h3 className="font-medium">No orders found</h3>
                  <p className="text-sm text-muted-foreground">
                    {statusFilter === "ALL" ? "Orders will appear here when customers place them" : `No ${statusFilter.toLowerCase()} orders`}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Pickup Date</TableHead>
                        <TableHead>Items</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Partner</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOrders.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell className="font-medium">
                            {formatOrderNumber(order.order_number)}
                            <div className="text-xs text-muted-foreground">
                              {formatDate(order.created_at)}
                            </div>
                          </TableCell>
                          <TableCell>
                            {order.customer_name}
                            {order.customer_phone && (
                              <div className="text-xs text-muted-foreground">
                                {order.customer_phone}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>{order.location}</TableCell>
                          <TableCell>
                            {order.preferred_date}
                            {order.pickup_time_window && (
                              <div className="text-xs text-muted-foreground">
                                {order.pickup_time_window}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="max-w-[200px]">
                              {order.line_items.map((item, i) => (
                                <div key={i} className="text-sm">
                                  {item.title} ×{item.quantity}
                                </div>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">
                            EC${order.total_price.toFixed(2)}
                          </TableCell>
                          <TableCell>{getStatusBadge(order.status)}</TableCell>
                          <TableCell>
                            {partners.length > 0 ? (
                              <Select
                                value={order.assigned_partner_id || ""}
                                onValueChange={(value) => assignPartner(order.id, value)}
                                disabled={updating === order.id || order.status === "COMPLETED" || order.status === "CANCELLED"}
                              >
                                <SelectTrigger className="w-[140px]">
                                  <SelectValue placeholder="Assign Partner">
                                    {order.assigned_partner_id ? getPartnerName(order.assigned_partner_id) : "Unassigned"}
                                  </SelectValue>
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
                              <span className="text-sm text-muted-foreground">No partners</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Select
                                value={order.status}
                                onValueChange={(value) => updateOrderStatus(order.id, value)}
                                disabled={updating === order.id}
                              >
                                <SelectTrigger className="w-[130px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {statusOptions.map((status) => (
                                    <SelectItem key={status.value} value={status.value}>
                                      {status.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Order?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will permanently delete order {formatOrderNumber(order.order_number)}. This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteOrder(order.id)}
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
            </CardContent>
          </Card>
        </main>
      </div>
    </AdminAuth>
  );
}
