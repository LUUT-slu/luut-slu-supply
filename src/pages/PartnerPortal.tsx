import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
  Calendar as CalendarIcon,
  Phone,
  User,
  LogOut,
  XCircle,
  AlertTriangle,
  MessageSquare,
  ChevronDown,
  Home,
  DollarSign,
  ThumbsUp,
  ThumbsDown,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { format, subDays, isWithinInterval, parseISO } from "date-fns";
import { DateRange } from "react-day-picker";

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
  partner_commission: number | null;
  partner_commission_status: string | null;
}

const ADMIN_WHATSAPP_NUMBER = "7587185478";

const statusConfig: Record<string, { label: string; color: string; bgColor: string; icon: typeof Package }> = {
  ASSIGNED: { label: "Assigned", color: "text-yellow-600", bgColor: "bg-yellow-100", icon: Clock },
  ACCEPTED: { label: "Accepted", color: "text-blue-600", bgColor: "bg-blue-100", icon: ThumbsUp },
  ON_THE_WAY: { label: "On the Way", color: "text-purple-600", bgColor: "bg-purple-100", icon: Truck },
  COMPLETED: { label: "Completed", color: "text-green-600", bgColor: "bg-green-100", icon: CheckCircle },
  CANCELLED: { label: "Cancelled", color: "text-red-600", bgColor: "bg-red-100", icon: XCircle },
  DECLINED: { label: "Declined", color: "text-gray-600", bgColor: "bg-gray-100", icon: ThumbsDown },
};

export default function PartnerPortal() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [partnerName, setPartnerName] = useState<string>("");
  
  // Dialogs
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelOrderId, setCancelOrderId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  
  const [partialDialogOpen, setPartialDialogOpen] = useState(false);
  const [partialOrder, setPartialOrder] = useState<Order | null>(null);
  const [completedItems, setCompletedItems] = useState<Record<number, boolean>>({});
  
  const [declineDialogOpen, setDeclineDialogOpen] = useState(false);
  const [declineOrderId, setDeclineOrderId] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState("");

  // Earnings section
  const [earningsOpen, setEarningsOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [calendarOpen, setCalendarOpen] = useState(false);

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
    
    // Lock commission when order is completed
    if (newStatus === "COMPLETED") {
      updateData.partner_commission_status = "locked";
    }
    
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
      setOrders(orders.map(o => o.id === orderId ? { 
        ...o, 
        status: newStatus, 
        note: updateData.note as string,
        partner_commission_status: newStatus === "COMPLETED" ? "locked" : o.partner_commission_status
      } : o));
      
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
    window.open(`https://wa.me/${ADMIN_WHATSAPP_NUMBER}?text=${encodedMessage}`, '_blank');
  };

  const contactCustomer = (order: Order) => {
    if (!order.customer_phone) {
      toast.error("No phone number available");
      return;
    }
    
    const items = order.line_items.map(item => `${item.title} ×${item.quantity}`).join(", ");
    const message = `Hi, this is the Luut SLU partner assigned to your order.\n\nJust confirming pickup for *${items}* at *${order.location}* around *${order.preferred_date}${order.pickup_time_window ? ` (${order.pickup_time_window})` : ''}*.\n\nLet me know if that still works.`;
    
    const encodedMessage = encodeURIComponent(message);
    const phoneNumber = order.customer_phone.replace(/\D/g, '');
    window.open(`https://wa.me/${phoneNumber}?text=${encodedMessage}`, '_blank');
  };

  const handleAcceptOrder = (orderId: string) => {
    updateStatus(orderId, "ACCEPTED");
  };

  const handleDeclineClick = (orderId: string) => {
    setDeclineOrderId(orderId);
    setDeclineReason("");
    setDeclineDialogOpen(true);
  };

  const handleConfirmDecline = () => {
    if (!declineOrderId) return;
    updateStatus(declineOrderId, "DECLINED", `Declined by partner: ${declineReason || "No reason provided"}`);
    setDeclineDialogOpen(false);
    setDeclineOrderId(null);
    setDeclineReason("");
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

  // Calculate stats
  const assignedOrders = orders.filter(o => o.status === "ASSIGNED");
  const pendingAcceptance = orders.filter(o => o.status === "ASSIGNED");
  const activeOrders = orders.filter(o => ["ASSIGNED", "ACCEPTED", "ON_THE_WAY"].includes(o.status));
  const completedOrders = orders.filter(o => o.status === "COMPLETED");
  
  // Calculate total earnings
  const totalEarned = completedOrders.reduce((sum, order) => sum + (order.partner_commission || 0), 0);
  
  // Filter earnings by date range
  const filteredEarnings = completedOrders.filter(order => {
    if (!dateRange?.from || !dateRange?.to) return true;
    try {
      const orderDate = parseISO(order.created_at);
      return isWithinInterval(orderDate, { start: dateRange.from, end: dateRange.to });
    } catch {
      return true;
    }
  });
  
  const filteredEarningsTotal = filteredEarnings.reduce((sum, order) => sum + (order.partner_commission || 0), 0);

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
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
              {partnerName?.charAt(0) || "P"}
            </div>
            <div>
              <h1 className="font-display text-base font-semibold">Partner Portal</h1>
              {partnerName && <p className="text-[10px] text-muted-foreground leading-none">{partnerName}</p>}
            </div>
          </div>
          <div className="flex gap-1">
            <Button onClick={() => navigate("/")} variant="ghost" size="icon" className="h-8 w-8">
              <Home className="h-4 w-4" />
            </Button>
            <Button onClick={fetchOrders} variant="ghost" size="icon" className="h-8 w-8">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button onClick={handleLogout} variant="ghost" size="sm" className="gap-1.5 h-8 px-2">
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline text-xs">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-4 space-y-4">
        {/* Compact Stats - 4 columns */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Card className="border-yellow-200 bg-yellow-50/50">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-yellow-700">{assignedOrders.length}</p>
              <p className="text-[10px] text-yellow-600 font-medium uppercase tracking-wide">Assigned</p>
            </CardContent>
          </Card>
          <Card className="border-blue-200 bg-blue-50/50">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-blue-700">{pendingAcceptance.length}</p>
              <p className="text-[10px] text-blue-600 font-medium uppercase tracking-wide">Pending</p>
            </CardContent>
          </Card>
          <Card className="border-green-200 bg-green-50/50">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-green-700">{completedOrders.length}</p>
              <p className="text-[10px] text-green-600 font-medium uppercase tracking-wide">Completed</p>
            </CardContent>
          </Card>
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-primary">EC${totalEarned.toFixed(0)}</p>
              <p className="text-[10px] text-primary/80 font-medium uppercase tracking-wide">Earned</p>
            </CardContent>
          </Card>
        </div>

        {/* Active Orders Section */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4 text-primary" />
            <h2 className="font-display text-lg font-semibold">Active Orders</h2>
            <Badge variant="secondary" className="ml-auto text-xs">{activeOrders.length}</Badge>
          </div>

          {activeOrders.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                <Package className="mb-3 h-10 w-10 text-muted-foreground/50" />
                <h3 className="font-medium text-sm mb-1">No active orders</h3>
                <p className="text-xs text-muted-foreground">Orders assigned to you will appear here</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {activeOrders.map((order) => (
                <Card key={order.id} className="overflow-hidden border-l-4 border-l-primary">
                  <CardContent className="p-0">
                    {/* Order Header */}
                    <div className="flex items-center justify-between p-3 bg-muted/30">
                      <div className="flex items-center gap-2">
                        <span className="font-display text-base font-bold">{formatOrderNumber(order.order_number)}</span>
                        {getStatusBadge(order.status)}
                      </div>
                      <div className="text-right">
                        <p className="text-base font-bold text-primary">EC${order.total_price.toFixed(2)}</p>
                        {order.partner_commission && (
                          <p className="text-xs text-green-600 font-medium flex items-center gap-1 justify-end">
                            <DollarSign className="h-3 w-3" />
                            +EC${order.partner_commission.toFixed(2)} commission
                          </p>
                        )}
                      </div>
                    </div>

                    <Separator />

                    {/* Customer Info */}
                    <div className="p-3 space-y-2">
                      <div className="flex items-start gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground shrink-0">
                          <User className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{order.customer_name}</p>
                          {order.customer_phone && (
                            <a href={`tel:${order.customer_phone}`} className="text-xs text-primary flex items-center gap-1">
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
                            className="gap-1 text-xs text-green-600 border-green-200 hover:bg-green-50 h-7 px-2"
                          >
                            <MessageSquare className="h-3 w-3" />
                            Message
                          </Button>
                        )}
                      </div>

                      {/* Pickup Details */}
                      <div className="grid gap-1.5 pl-10">
                        <div className="flex items-center gap-1.5 text-xs">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          <span className="truncate">{order.location}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs">
                          <CalendarIcon className="h-3 w-3 text-muted-foreground" />
                          <span>{order.preferred_date}</span>
                          {order.pickup_time_window && (
                            <Badge variant="outline" className="text-[10px] h-4 px-1">{order.pickup_time_window}</Badge>
                          )}
                        </div>
                      </div>

                      {/* Items */}
                      <div className="rounded-md bg-muted/50 p-2 ml-10">
                        <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wide">Items</p>
                        {order.line_items.map((item, i) => (
                          <div key={i} className="flex items-center justify-between text-xs py-0.5">
                            <span className="truncate">{item.title}</span>
                            <span className="text-muted-foreground ml-2">×{item.quantity}</span>
                          </div>
                        ))}
                      </div>

                      {order.note && (
                        <div className="flex items-start gap-1.5 ml-10 p-2 rounded-md bg-yellow-50 border border-yellow-100">
                          <AlertTriangle className="h-3 w-3 text-yellow-600 mt-0.5 shrink-0" />
                          <p className="text-xs text-yellow-800">{order.note}</p>
                        </div>
                      )}
                    </div>

                    <Separator />

                    {/* Actions - Different for ASSIGNED vs ACCEPTED orders */}
                    <div className="p-3">
                      {order.status === "ASSIGNED" ? (
                        // Accept/Decline buttons for new assignments
                        <div className="flex gap-2">
                          <Button
                            onClick={() => handleAcceptOrder(order.id)}
                            disabled={updating === order.id}
                            className="flex-1 gap-1.5 bg-green-600 hover:bg-green-700 h-9"
                          >
                            <ThumbsUp className="h-4 w-4" />
                            Accept
                            {order.partner_commission && (
                              <span className="ml-1 text-green-200">
                                (+EC${order.partner_commission.toFixed(0)})
                              </span>
                            )}
                          </Button>
                          <Button
                            onClick={() => handleDeclineClick(order.id)}
                            disabled={updating === order.id}
                            variant="outline"
                            className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50 h-9"
                          >
                            <ThumbsDown className="h-4 w-4" />
                            Decline
                          </Button>
                        </div>
                      ) : (
                        // Standard actions for accepted orders
                        <div className="flex flex-wrap gap-2">
                          <Button
                            onClick={() => handleMarkCompleted(order.id)}
                            disabled={updating === order.id}
                            className="flex-1 gap-1.5 bg-green-600 hover:bg-green-700 h-8 text-sm"
                          >
                            <CheckCircle className="h-3.5 w-3.5" />
                            Completed
                          </Button>
                          
                          {order.line_items.length > 1 && (
                            <Button
                              onClick={() => handlePartialCompleteClick(order)}
                              disabled={updating === order.id}
                              variant="outline"
                              className="gap-1.5 h-8 text-sm"
                            >
                              <AlertTriangle className="h-3.5 w-3.5" />
                              Partial
                            </Button>
                          )}
                          
                          <Button
                            onClick={() => handleCancelClick(order.id)}
                            disabled={updating === order.id}
                            variant="ghost"
                            className="gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 h-8 text-sm"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            Cancel
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* My Earnings Section - Collapsible */}
        <Collapsible open={earningsOpen} onOpenChange={setEarningsOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full justify-between h-10">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-primary" />
                <span className="font-medium">My Earnings</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">EC${totalEarned.toFixed(2)}</Badge>
                <ChevronDown className={`h-4 w-4 transition-transform ${earningsOpen ? 'rotate-180' : ''}`} />
              </div>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3">
            <Card>
              <CardContent className="p-4 space-y-4">
                {/* Date Range Filter */}
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Filter by date</p>
                  <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs">
                        <CalendarIcon className="h-3 w-3" />
                        {dateRange?.from && dateRange?.to ? (
                          `${format(dateRange.from, "MMM d")} - ${format(dateRange.to, "MMM d")}`
                        ) : (
                          "Select dates"
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                      <Calendar
                        mode="range"
                        selected={dateRange}
                        onSelect={(range) => {
                          setDateRange(range);
                          if (range?.from && range?.to) {
                            setCalendarOpen(false);
                          }
                        }}
                        numberOfMonths={1}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Earnings Summary */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <div>
                    <p className="text-xs text-muted-foreground">Total in range</p>
                    <p className="text-xl font-bold text-primary">EC${filteredEarningsTotal.toFixed(2)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Orders</p>
                    <p className="text-xl font-bold">{filteredEarnings.length}</p>
                  </div>
                </div>

                {/* Earnings List */}
                {filteredEarnings.length > 0 ? (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {filteredEarnings.map((order) => (
                      <div key={order.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50 text-sm">
                        <div>
                          <span className="font-medium">{formatOrderNumber(order.order_number)}</span>
                          <p className="text-xs text-muted-foreground">
                            {format(parseISO(order.created_at), "MMM d, yyyy")}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-green-600">
                            +EC${(order.partner_commission || 0).toFixed(2)}
                          </p>
                          <Badge variant="outline" className="text-[10px] h-4">
                            {order.partner_commission_status || "pending"}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No completed orders in this date range
                  </p>
                )}
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>

        {/* Completed Orders - Compact list */}
        {completedOrders.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <h2 className="font-display text-lg font-semibold">Completed</h2>
              <Badge variant="secondary" className="ml-auto text-xs">{completedOrders.length}</Badge>
            </div>
            
            <Card>
              <CardContent className="p-0 divide-y">
                {completedOrders.slice(0, 5).map((order) => (
                  <div key={order.id} className="flex items-center justify-between p-3 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100">
                        <CheckCircle className="h-3 w-3 text-green-600" />
                      </div>
                      <div>
                        <span className="font-medium text-sm">{formatOrderNumber(order.order_number)}</span>
                        <p className="text-[10px] text-muted-foreground">{order.customer_name}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">EC${order.total_price.toFixed(2)}</p>
                      {order.partner_commission && (
                        <p className="text-[10px] text-green-600">+EC${order.partner_commission.toFixed(2)}</p>
                      )}
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

      {/* Decline Dialog */}
      <Dialog open={declineDialogOpen} onOpenChange={setDeclineDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decline Order</DialogTitle>
            <DialogDescription>Optionally provide a reason for declining this order.</DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Enter reason (optional)..."
            value={declineReason}
            onChange={(e) => setDeclineReason(e.target.value)}
            className="min-h-[80px]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeclineDialogOpen(false)}>Back</Button>
            <Button variant="destructive" onClick={handleConfirmDecline}>Confirm Decline</Button>
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
