import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  LogOut,
  XCircle,
  AlertTriangle,
  MessageSquare,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

interface LineItem {
  title: string;
  quantity: number;
  price: string;
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
  line_items: LineItem[];
  created_at: string;
}

const WHATSAPP_NUMBER = "7587185478";

const statusConfig: Record<string, { label: string; color: string; bgColor: string; icon: typeof Package }> = {
  ASSIGNED: { label: "Assigned", color: "text-yellow-600", bgColor: "bg-yellow-100", icon: Clock },
  ACCEPTED: { label: "Accepted", color: "text-blue-600", bgColor: "bg-blue-100", icon: CheckCircle },
  ON_THE_WAY: { label: "On the Way", color: "text-purple-600", bgColor: "bg-purple-100", icon: Truck },
  COMPLETED: { label: "Completed", color: "text-green-600", bgColor: "bg-green-100", icon: CheckCircle },
  CANCELLED: { label: "Cancelled", color: "text-red-600", bgColor: "bg-red-100", icon: XCircle },
};

export default function PartnerPortal() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [partnerName, setPartnerName] = useState<string>("");
  
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelOrderId, setCancelOrderId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  
  const [partialDialogOpen, setPartialDialogOpen] = useState(false);
  const [partialOrder, setPartialOrder] = useState<Order | null>(null);
  const [completedItems, setCompletedItems] = useState<Record<number, boolean>>({});

  const checkPartnerAccess = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return false;
    }

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const isPartner = roles?.some(r => (r.role as string) === "partner");
    const isAdmin = roles?.some(r => r.role === "admin");

    if (!isPartner && !isAdmin) {
      toast.error("Access denied. Partner login required.");
      navigate("/auth");
      return false;
    }

    const { data: profile } = await supabase
      .from("partner_profiles")
      .select("partner_name")
      .eq("user_id", user.id)
      .single();

    if (profile) {
      setPartnerName(profile.partner_name);
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

  const updateStatus = async (orderId: string, newStatus: string, note?: string) => {
    setUpdating(orderId);
    
    const updateData: Record<string, unknown> = { 
      status: newStatus, 
      updated_at: new Date().toISOString() 
    };
    
    if (note) {
      const order = orders.find(o => o.id === orderId);
      const existingNote = order?.note || "";
      updateData.note = existingNote ? `${existingNote}\n---\n${note}` : note;
    }
    
    const { error } = await supabase
      .from("orders")
      .update(updateData)
      .eq("id", orderId);

    if (error) {
      toast.error("Failed to update order");
    } else {
      toast.success(`Order marked as ${newStatus}`);
      setOrders(orders.map(o => o.id === orderId ? { ...o, status: newStatus, note: updateData.note as string } : o));
      
      const order = orders.find(o => o.id === orderId);
      if (order) {
        sendAdminNotification(order, newStatus, note);
      }
    }
    setUpdating(null);
  };

  const sendAdminNotification = (order: Order, newStatus: string, extraNote?: string) => {
    let message = `📦 *ORDER UPDATE*\n\n`;
    message += `Order: #L${String(order.order_number).padStart(4, '0')}\n`;
    message += `Partner: ${partnerName}\n`;
    message += `Status: ${newStatus}\n\n`;
    message += `👤 ${order.customer_name}\n`;
    message += `📍 ${order.location}\n`;
    message += `📅 ${order.preferred_date}`;
    
    if (extraNote) {
      message += `\n\n📝 Note: ${extraNote}`;
    }
    
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodedMessage}`, '_blank');
  };

  const contactCustomer = (order: Order) => {
    if (!order.customer_phone) {
      toast.error("No phone number available");
      return;
    }
    const message = `Hi ${order.customer_name}! I'm your delivery partner for order #L${String(order.order_number).padStart(4, '0')}. I'll be meeting you at ${order.location} on ${order.preferred_date}. See you soon!`;
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/${order.customer_phone.replace(/\D/g, '')}?text=${encodedMessage}`, '_blank');
  };

  const handleMarkCompleted = (orderId: string) => {
    updateStatus(orderId, "COMPLETED");
  };

  const handleCancelClick = (orderId: string) => {
    setCancelOrderId(orderId);
    setCancelReason("");
    setCancelDialogOpen(true);
  };

  const handleConfirmCancel = () => {
    if (!cancelOrderId) return;
    if (!cancelReason.trim()) {
      toast.error("Please provide a cancellation reason");
      return;
    }
    updateStatus(cancelOrderId, "CANCELLED", `Cancelled by partner: ${cancelReason}`);
    setCancelDialogOpen(false);
    setCancelOrderId(null);
    setCancelReason("");
  };

  const handlePartialCompleteClick = (order: Order) => {
    setPartialOrder(order);
    const initialItems: Record<number, boolean> = {};
    order.line_items.forEach((_, i) => {
      initialItems[i] = true;
    });
    setCompletedItems(initialItems);
    setPartialDialogOpen(true);
  };

  const handleConfirmPartial = () => {
    if (!partialOrder) return;
    
    const completedList = partialOrder.line_items
      .filter((_, i) => completedItems[i])
      .map(item => `${item.title} ×${item.quantity}`)
      .join(", ");
    
    const notCompletedList = partialOrder.line_items
      .filter((_, i) => !completedItems[i])
      .map(item => `${item.title} ×${item.quantity}`)
      .join(", ");
    
    let note = `Partial completion:\n✅ Delivered: ${completedList || "None"}`;
    if (notCompletedList) {
      note += `\n❌ Not delivered: ${notCompletedList}`;
    }
    
    updateStatus(partialOrder.id, "COMPLETED", note);
    setPartialDialogOpen(false);
    setPartialOrder(null);
    setCompletedItems({});
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const formatOrderNumber = (num: number) => `#L${String(num).padStart(4, '0')}`;

  const getStatusBadge = (status: string) => {
    const config = statusConfig[status] || statusConfig.ASSIGNED;
    return (
      <Badge className={`${config.bgColor} ${config.color} border-0 gap-1.5`}>
        <config.icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const activeOrders = orders.filter(o => !["COMPLETED", "CANCELLED"].includes(o.status));
  const completedOrders = orders.filter(o => o.status === "COMPLETED");
  const cancelledOrders = orders.filter(o => o.status === "CANCELLED");

  if (loading && orders.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading your orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
              {partnerName?.charAt(0) || "P"}
            </div>
            <div>
              <h1 className="font-display text-lg font-semibold">Partner Portal</h1>
              {partnerName && <p className="text-xs text-muted-foreground">{partnerName}</p>}
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={fetchOrders} variant="ghost" size="icon" className="h-9 w-9">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button onClick={handleLogout} variant="ghost" size="sm" className="gap-2">
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="bg-yellow-50 border-yellow-200">
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-yellow-700">{activeOrders.length}</p>
              <p className="text-xs text-yellow-600 font-medium">Active</p>
            </CardContent>
          </Card>
          <Card className="bg-green-50 border-green-200">
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-green-700">{completedOrders.length}</p>
              <p className="text-xs text-green-600 font-medium">Completed</p>
            </CardContent>
          </Card>
          <Card className="bg-red-50 border-red-200">
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-red-700">{cancelledOrders.length}</p>
              <p className="text-xs text-red-600 font-medium">Cancelled</p>
            </CardContent>
          </Card>
        </div>

        {/* Active Orders Section */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-5 w-5 text-primary" />
            <h2 className="font-display text-xl font-semibold">Active Orders</h2>
            <Badge variant="secondary" className="ml-auto">{activeOrders.length}</Badge>
          </div>

          {activeOrders.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Package className="mb-4 h-12 w-12 text-muted-foreground/50" />
                <h3 className="font-medium mb-1">No active orders</h3>
                <p className="text-sm text-muted-foreground">Orders assigned to you will appear here</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {activeOrders.map((order) => (
                <Card key={order.id} className="overflow-hidden border-l-4 border-l-primary">
                  <CardContent className="p-0">
                    {/* Order Header */}
                    <div className="flex items-center justify-between p-4 pb-3 bg-muted/30">
                      <div className="flex items-center gap-3">
                        <span className="font-display text-lg font-bold">{formatOrderNumber(order.order_number)}</span>
                        {getStatusBadge(order.status)}
                      </div>
                      <span className="text-lg font-bold text-primary">EC${order.total_price.toFixed(2)}</span>
                    </div>

                    <Separator />

                    {/* Customer Info */}
                    <div className="p-4 space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                          <User className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{order.customer_name}</p>
                          {order.customer_phone && (
                            <a href={`tel:${order.customer_phone}`} className="text-sm text-primary flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {order.customer_phone}
                            </a>
                          )}
                        </div>
                        {order.customer_phone && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => contactCustomer(order)}
                            className="gap-1.5 text-green-600 border-green-200 hover:bg-green-50"
                          >
                            <MessageSquare className="h-4 w-4" />
                            WhatsApp
                          </Button>
                        )}
                      </div>

                      {/* Pickup Details */}
                      <div className="grid gap-2 pl-[52px]">
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span>{order.location}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span>{order.preferred_date}</span>
                          {order.pickup_time_window && (
                            <Badge variant="outline" className="text-xs">{order.pickup_time_window}</Badge>
                          )}
                        </div>
                      </div>

                      {/* Items */}
                      <div className="rounded-lg bg-muted/50 p-3 ml-[52px]">
                        <p className="text-xs text-muted-foreground mb-2">Order Items</p>
                        {order.line_items.map((item, i) => (
                          <div key={i} className="flex items-center justify-between text-sm py-1">
                            <span>{item.title}</span>
                            <span className="text-muted-foreground">×{item.quantity}</span>
                          </div>
                        ))}
                      </div>

                      {order.note && (
                        <div className="flex items-start gap-2 pl-[52px] p-3 rounded-lg bg-yellow-50 border border-yellow-100">
                          <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
                          <p className="text-sm text-yellow-800">{order.note}</p>
                        </div>
                      )}
                    </div>

                    <Separator />

                    {/* Actions */}
                    <div className="p-4 flex flex-wrap gap-2">
                      <Button
                        onClick={() => handleMarkCompleted(order.id)}
                        disabled={updating === order.id}
                        className="flex-1 gap-2 bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle className="h-4 w-4" />
                        Mark Completed
                      </Button>
                      
                      {order.line_items.length > 1 && (
                        <Button
                          onClick={() => handlePartialCompleteClick(order)}
                          disabled={updating === order.id}
                          variant="outline"
                          className="gap-2"
                        >
                          <AlertTriangle className="h-4 w-4" />
                          Partial
                        </Button>
                      )}
                      
                      <Button
                        onClick={() => handleCancelClick(order.id)}
                        disabled={updating === order.id}
                        variant="ghost"
                        className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <XCircle className="h-4 w-4" />
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Completed Orders */}
        {completedOrders.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <h2 className="font-display text-xl font-semibold">Completed</h2>
              <Badge variant="secondary" className="ml-auto">{completedOrders.length}</Badge>
            </div>
            
            <Card>
              <CardContent className="p-0 divide-y">
                {completedOrders.slice(0, 10).map((order) => (
                  <div key={order.id} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      </div>
                      <div>
                        <span className="font-medium">{formatOrderNumber(order.order_number)}</span>
                        <p className="text-xs text-muted-foreground">{order.customer_name}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">EC${order.total_price.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">{order.preferred_date}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      {/* Cancel Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Order</DialogTitle>
            <DialogDescription>Please provide a reason for cancellation.</DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Enter cancellation reason..."
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            className="min-h-[100px]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>Back</Button>
            <Button variant="destructive" onClick={handleConfirmCancel}>Confirm Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Partial Complete Dialog */}
      <Dialog open={partialDialogOpen} onOpenChange={setPartialDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Partial Completion</DialogTitle>
            <DialogDescription>Select items that were delivered.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {partialOrder?.line_items.map((item, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Checkbox
                  id={`item-${i}`}
                  checked={completedItems[i]}
                  onCheckedChange={(checked) => setCompletedItems({ ...completedItems, [i]: !!checked })}
                />
                <label htmlFor={`item-${i}`} className="text-sm cursor-pointer flex-1">
                  {item.title} × {item.quantity}
                </label>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPartialDialogOpen(false)}>Back</Button>
            <Button onClick={handleConfirmPartial} className="bg-green-600 hover:bg-green-700">Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
