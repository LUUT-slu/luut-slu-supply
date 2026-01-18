import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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

const statusConfig: Record<string, { label: string; color: string; icon: typeof Package }> = {
  ASSIGNED: { label: "Assigned", color: "bg-yellow-500", icon: Clock },
  ACCEPTED: { label: "Accepted", color: "bg-blue-500", icon: CheckCircle },
  ON_THE_WAY: { label: "On the Way", color: "bg-purple-500", icon: Truck },
  COMPLETED: { label: "Completed", color: "bg-green-500", icon: CheckCircle },
  CANCELLED: { label: "Cancelled", color: "bg-red-500", icon: XCircle },
};

export default function AssignedOrdersPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [partnerName, setPartnerName] = useState<string>("");
  
  // Cancel dialog state
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelOrderId, setCancelOrderId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  
  // Partial complete dialog state
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
      
      // Notify admin
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
      <Badge variant="outline" className="gap-1">
        <span className={`h-2 w-2 rounded-full ${config.color}`} />
        {config.label}
      </Badge>
    );
  };

  const activeOrders = orders.filter(o => !["COMPLETED", "CANCELLED"].includes(o.status));
  const pastOrders = orders.filter(o => ["COMPLETED", "CANCELLED"].includes(o.status));

  if (loading && orders.length === 0) {
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
            <h1 className="font-display text-2xl">Assigned Orders</h1>
            {partnerName && <p className="text-sm text-muted-foreground">Welcome, {partnerName}</p>}
          </div>
          <div className="flex gap-2">
            <Button onClick={fetchOrders} variant="outline" size="sm" className="gap-2">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button onClick={handleLogout} variant="ghost" size="sm" className="gap-2">
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>

        {/* Active Orders */}
        {activeOrders.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Package className="mb-4 h-10 w-10 text-muted-foreground" />
              <p className="text-muted-foreground">No active orders assigned to you</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {activeOrders.map((order) => (
              <Card key={order.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-3 flex-1 min-w-[200px]">
                      <div className="flex items-center gap-2">
                        <span className="font-display text-lg">{formatOrderNumber(order.order_number)}</span>
                        {getStatusBadge(order.status)}
                      </div>
                      
                      <div className="grid gap-1.5 text-sm">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span>{order.customer_name}</span>
                        </div>
                        {order.customer_phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            <a href={`tel:${order.customer_phone}`} className="text-primary hover:underline">
                              {order.customer_phone}
                            </a>
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

                      <div className="pt-1">
                        <p className="text-xs text-muted-foreground mb-1">Items:</p>
                        {order.line_items.map((item, i) => (
                          <p key={i} className="text-sm">• {item.title} × {item.quantity}</p>
                        ))}
                      </div>

                      <p className="font-medium text-primary">
                        Total: EC${order.total_price.toFixed(2)} • Pay on pickup
                      </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col gap-2 min-w-[140px]">
                      <Button
                        onClick={() => handleMarkCompleted(order.id)}
                        disabled={updating === order.id}
                        className="gap-2 bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle className="h-4 w-4" />
                        Completed
                      </Button>
                      
                      <Button
                        onClick={() => handleCancelClick(order.id)}
                        disabled={updating === order.id}
                        variant="destructive"
                        className="gap-2"
                      >
                        <XCircle className="h-4 w-4" />
                        Cancel
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
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Past Orders */}
        {pastOrders.length > 0 && (
          <div className="mt-8">
            <h2 className="font-display text-lg mb-4 text-muted-foreground">Past Orders</h2>
            <div className="space-y-2">
              {pastOrders.slice(0, 5).map((order) => (
                <Card key={order.id} className="opacity-60">
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{formatOrderNumber(order.order_number)}</span>
                      <span className="text-sm text-muted-foreground">{order.customer_name}</span>
                    </div>
                    {getStatusBadge(order.status)}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Cancel Reason Dialog */}
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
              <div key={i} className="flex items-center gap-3">
                <Checkbox
                  id={`item-${i}`}
                  checked={completedItems[i]}
                  onCheckedChange={(checked) => setCompletedItems({ ...completedItems, [i]: !!checked })}
                />
                <label htmlFor={`item-${i}`} className="text-sm cursor-pointer">
                  {item.title} × {item.quantity}
                </label>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPartialDialogOpen(false)}>Back</Button>
            <Button onClick={handleConfirmPartial}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
