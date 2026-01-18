import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
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
  Package, 
  Clock, 
  CheckCircle, 
  Truck, 
  RefreshCw,
  MapPin,
  Calendar,
  Phone,
  User,
  MessageSquare,
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
  line_items: Array<{
    title: string;
    quantity: number;
    price: string;
  }>;
  created_at: string;
}

const WHATSAPP_NUMBER = "7587185478";

const statusOptions = [
  { value: "ASSIGNED", label: "Assigned", icon: Clock, color: "bg-yellow-500", canTransitionTo: ["ACCEPTED"] },
  { value: "ACCEPTED", label: "Accepted", icon: CheckCircle, color: "bg-blue-500", canTransitionTo: ["ON_THE_WAY"] },
  { value: "ON_THE_WAY", label: "On the Way", icon: Truck, color: "bg-purple-500", canTransitionTo: ["COMPLETED"] },
  { value: "COMPLETED", label: "Completed", icon: CheckCircle, color: "bg-green-500", canTransitionTo: [] },
];

export default function PartnerDashboard() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [partnerProfile, setPartnerProfile] = useState<{ partner_name: string; whatsapp: string } | null>(null);

  const checkPartnerAccess = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return false;
    }

    // Check if user has partner role
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    // Cast to string to handle the 'partner' role that may not be in the enum yet
    const isPartner = roles?.some(r => (r.role as string) === "partner");
    const isAdmin = roles?.some(r => r.role === "admin");

    if (!isPartner && !isAdmin) {
      toast.error("Access denied. You are not a registered partner.");
      navigate("/");
      return false;
    }

    // Get partner profile
    const { data: profile } = await supabase
      .from("partner_profiles")
      .select("partner_name, whatsapp")
      .eq("user_id", user.id)
      .single();

    if (profile) {
      setPartnerProfile(profile);
    }

    return true;
  };

  const fetchOrders = async () => {
    setLoading(true);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("assigned_partner_id", user.id)
      .in("status", ["ASSIGNED", "ACCEPTED", "ON_THE_WAY", "COMPLETED"])
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load orders");
      console.error(error);
    } else {
      setOrders((data || []) as unknown as Order[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    const init = async () => {
      const hasAccess = await checkPartnerAccess();
      if (hasAccess) {
        await fetchOrders();
      }
    };
    init();
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
      toast.success(`Order status updated to ${newStatus}`);
      setOrders(orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
      
      // Send WhatsApp notification to admin
      const order = orders.find(o => o.id === orderId);
      if (order) {
        sendStatusNotification(order, newStatus);
      }
    }
    setUpdating(null);
  };

  const sendStatusNotification = (order: Order, newStatus: string) => {
    const partnerName = partnerProfile?.partner_name || "Partner";
    let message = `📦 *ORDER STATUS UPDATE*\n\n`;
    message += `Order: #L${String(order.order_number).padStart(4, '0')}\n`;
    message += `Partner: ${partnerName}\n`;
    message += `New Status: ${newStatus}\n\n`;
    message += `👤 Customer: ${order.customer_name}\n`;
    message += `📍 Location: ${order.location}\n`;
    message += `📅 Pickup: ${order.preferred_date}`;
    
    if (order.pickup_time_window) {
      message += ` (${order.pickup_time_window})`;
    }
    
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
  };

  const formatOrderNumber = (num: number) => `#L${String(num).padStart(4, '0')}`;
  
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
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

  const getNextStatuses = (currentStatus: string) => {
    const current = statusOptions.find(s => s.value === currentStatus);
    if (!current) return [];
    return statusOptions.filter(s => current.canTransitionTo.includes(s.value));
  };

  const contactCustomer = (order: Order) => {
    if (!order.customer_phone) {
      toast.error("No phone number available for this customer");
      return;
    }
    
    const message = `Hi ${order.customer_name}! I'm your delivery partner for order ${formatOrderNumber(order.order_number)}. I'll be meeting you at ${order.location} on ${order.preferred_date}. See you soon! 💳 Payment: Cash on pickup`;
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${order.customer_phone.replace(/\D/g, '')}?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
  };

  const activeOrders = orders.filter(o => o.status !== "COMPLETED");
  const completedOrders = orders.filter(o => o.status === "COMPLETED");

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      
      <main className="container flex-1 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <BackButton />
            <div>
              <h1 className="font-display text-3xl">Partner Dashboard</h1>
              <p className="text-muted-foreground">
                {partnerProfile?.partner_name ? `Welcome, ${partnerProfile.partner_name}` : "Manage your assigned orders"}
              </p>
            </div>
          </div>
          <Button onClick={fetchOrders} variant="outline" size="sm" className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Active Orders</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeOrders.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Assigned</CardTitle>
              <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {orders.filter(o => o.status === "ASSIGNED").length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">On the Way</CardTitle>
              <Truck className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {orders.filter(o => o.status === "ON_THE_WAY").length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{completedOrders.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Active Orders */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Active Orders</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : activeOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Package className="mb-4 h-12 w-12 text-muted-foreground" />
                <h3 className="font-medium">No active orders</h3>
                <p className="text-sm text-muted-foreground">Orders assigned to you will appear here</p>
              </div>
            ) : (
              <div className="space-y-4">
                {activeOrders.map((order) => (
                  <Card key={order.id} className="border-l-4 border-l-primary">
                    <CardContent className="p-4">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="font-display text-lg">{formatOrderNumber(order.order_number)}</span>
                            {getStatusBadge(order.status)}
                          </div>
                          
                          <div className="grid gap-1 text-sm">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <span>{order.customer_name}</span>
                            </div>
                            {order.customer_phone && (
                              <div className="flex items-center gap-2">
                                <Phone className="h-4 w-4 text-muted-foreground" />
                                <span>{order.customer_phone}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-muted-foreground" />
                              <span>{order.location}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              <span>{order.preferred_date}</span>
                              {order.pickup_time_window && (
                                <Badge variant="outline" className="text-xs">{order.pickup_time_window}</Badge>
                              )}
                            </div>
                          </div>

                          <div className="pt-2">
                            <p className="text-xs text-muted-foreground mb-1">Items:</p>
                            {order.line_items.map((item, i) => (
                              <p key={i} className="text-sm">
                                {item.title} × {item.quantity}
                              </p>
                            ))}
                          </div>

                          {order.note && (
                            <div className="flex items-start gap-2 pt-2">
                              <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5" />
                              <p className="text-sm text-muted-foreground">{order.note}</p>
                            </div>
                          )}

                          <p className="font-medium text-primary pt-2">
                            Total: EC${order.total_price.toFixed(2)} (Pay on pickup)
                          </p>
                        </div>

                        <div className="flex flex-col gap-2">
                          {order.customer_phone && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => contactCustomer(order)}
                              className="gap-2"
                            >
                              <MessageSquare className="h-4 w-4" />
                              Contact
                            </Button>
                          )}
                          
                          {getNextStatuses(order.status).length > 0 && (
                            <Select
                              value=""
                              onValueChange={(value) => updateOrderStatus(order.id, value)}
                              disabled={updating === order.id}
                            >
                              <SelectTrigger className="w-[140px]">
                                <SelectValue placeholder="Update Status" />
                              </SelectTrigger>
                              <SelectContent>
                                {getNextStatuses(order.status).map((status) => (
                                  <SelectItem key={status.value} value={status.value}>
                                    {status.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Completed Orders */}
        {completedOrders.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Completed Orders</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {completedOrders.slice(0, 10).map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">
                          {formatOrderNumber(order.order_number)}
                        </TableCell>
                        <TableCell>{order.customer_name}</TableCell>
                        <TableCell>{order.location}</TableCell>
                        <TableCell>{order.preferred_date}</TableCell>
                        <TableCell className="font-medium">
                          EC${order.total_price.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      <Footer />
    </div>
  );
}
