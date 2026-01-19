import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BackButton } from "@/components/BackButton";
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
  Home,
  DollarSign,
  Wallet,
  ArrowLeft,
  BoxIcon,
} from "lucide-react";
import { toast } from "sonner";
import { format, subDays, parseISO, startOfDay } from "date-fns";
import { DateRange } from "react-day-picker";
import {
  usePartnerOrders,
  usePartnerStats,
  usePartnerStock,
  usePartnerEarnings,
  usePartnerActions,
  formatOrderNumber,
  type OrderFilter,
  type ViewMode,
  type PartnerOrder,
} from "@/hooks/usePartnerPortal";

const ADMIN_WHATSAPP_NUMBER = "7587185478";

const statusConfig: Record<string, { label: string; color: string; bgColor: string; icon: typeof Package }> = {
  ASSIGNED: { label: "Active", color: "text-yellow-600", bgColor: "bg-yellow-100", icon: Clock },
  ON_THE_WAY: { label: "On the Way", color: "text-purple-600", bgColor: "bg-purple-100", icon: Truck },
  COMPLETED: { label: "Completed", color: "text-green-600", bgColor: "bg-green-100", icon: CheckCircle },
  NO_SHOW: { label: "No Show", color: "text-red-600", bgColor: "bg-red-100", icon: XCircle },
  CANCELLED: { label: "Cancelled", color: "text-gray-600", bgColor: "bg-gray-100", icon: XCircle },
  pending: { label: "Active", color: "text-yellow-600", bgColor: "bg-yellow-100", icon: Clock },
};

export default function PartnerPortal() {
  const navigate = useNavigate();
  const [partnerName, setPartnerName] = useState<string>("");
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  
  // View state
  const [activeFilter, setActiveFilter] = useState<OrderFilter>('ASSIGNED');
  const [viewMode, setViewMode] = useState<ViewMode>('orders');
  
  // Dialogs
  const [noShowDialogOpen, setNoShowDialogOpen] = useState(false);
  const [noShowOrderId, setNoShowOrderId] = useState<string | null>(null);
  const [noShowNote, setNoShowNote] = useState("");

  // Earnings date range
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Hooks
  const { orders, loading: ordersLoading, refetch: refetchOrders } = usePartnerOrders(activeFilter);
  const { stats, loading: statsLoading, refetch: refetchStats } = usePartnerStats();
  const { stock, loading: stockLoading, refetch: refetchStock } = usePartnerStock();
  const { earnings, loading: earningsLoading, refetch: refetchEarnings } = usePartnerEarnings(
    dateRange?.from && dateRange?.to ? { from: dateRange.from, to: dateRange.to } : undefined
  );
  const { markCompleted, markNoShow, updating } = usePartnerActions();

  const checkPartnerAccess = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
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
      return;
    }

    const { data: profile } = await supabase
      .from("partner_profiles")
      .select("partner_name")
      .eq("user_id", user.id)
      .single();

    if (profile) {
      setPartnerName(profile.partner_name);
    }

    setIsAuthorized(true);
  };

  useEffect(() => {
    checkPartnerAccess();
  }, []);

  const refreshAll = async () => {
    await Promise.all([
      refetchOrders(),
      refetchStats(),
      refetchStock(),
      refetchEarnings()
    ]);
  };

  const handleMarkCompleted = async (orderId: string) => {
    const success = await markCompleted(orderId);
    if (success) {
      toast.success("Order marked as completed!");
      await refreshAll();
    } else {
      toast.error("Failed to complete order");
    }
  };

  const handleNoShowClick = (orderId: string) => {
    setNoShowOrderId(orderId);
    setNoShowNote("");
    setNoShowDialogOpen(true);
  };

  const handleConfirmNoShow = async () => {
    if (!noShowOrderId) return;
    
    const success = await markNoShow(noShowOrderId, noShowNote || "Customer no show");
    if (success) {
      toast.success("Order marked as No Show");
      setNoShowDialogOpen(false);
      setNoShowOrderId(null);
      setNoShowNote("");
      await refreshAll();
    } else {
      toast.error("Failed to mark as No Show");
    }
  };

  const contactCustomer = (order: PartnerOrder) => {
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

  const messageAdmin = (context?: string) => {
    let message = `Hi, this is ${partnerName} from the Partner Portal.`;
    if (context) {
      message += `\n\n${context}`;
    }
    window.open(`https://wa.me/${ADMIN_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const handleStatCardClick = (filter: OrderFilter | 'EARNINGS' | 'TO_RETURN' | 'STOCK') => {
    if (filter === 'EARNINGS') {
      setViewMode('earnings');
    } else if (filter === 'TO_RETURN') {
      setViewMode('to_return');
    } else if (filter === 'STOCK') {
      setViewMode('stock');
    } else {
      setActiveFilter(filter);
      setViewMode('orders');
    }
  };

  const getStatusBadge = (order: PartnerOrder) => {
    const effectiveStatus = order.order_status || order.status;
    const config = statusConfig[effectiveStatus] || statusConfig.ASSIGNED;
    return (
      <Badge className={`${config.bgColor} ${config.color} border-0 gap-1.5`}>
        <config.icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const setQuickDateFilter = (period: 'today' | 'week' | 'month') => {
    const now = new Date();
    if (period === 'today') {
      setDateRange({ from: startOfDay(now), to: now });
    } else if (period === 'week') {
      setDateRange({ from: subDays(now, 7), to: now });
    } else {
      setDateRange({ from: subDays(now, 30), to: now });
    }
  };

  if (isAuthorized === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading your portal...</p>
        </div>
      </div>
    );
  }

  const loading = ordersLoading || statsLoading;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-2">
            <BackButton to="/" label="" />
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
              {partnerName?.charAt(0) || "P"}
            </div>
            <div>
              <h1 className="font-display text-base font-semibold">Partner Portal</h1>
              {partnerName && <p className="text-[10px] text-muted-foreground leading-none">{partnerName}</p>}
            </div>
          </div>
          <div className="flex gap-1">
            <Button 
              onClick={() => messageAdmin()} 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8"
              title="Message Admin"
            >
              <MessageSquare className="h-4 w-4" />
            </Button>
            <Button onClick={() => navigate("/")} variant="ghost" size="icon" className="h-8 w-8">
              <Home className="h-4 w-4" />
            </Button>
            <Button onClick={refreshAll} variant="ghost" size="icon" className="h-8 w-8">
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
        {/* Clickable Stats Cards - 5 columns */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {/* Assigned */}
          <Card 
            className={`cursor-pointer transition-all hover:shadow-md border-yellow-400 bg-white ${
              viewMode === 'orders' && activeFilter === 'ASSIGNED' ? 'ring-2 ring-primary' : ''
            }`}
            onClick={() => handleStatCardClick('ASSIGNED')}
          >
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-yellow-600">{stats.assignedCount}</p>
              <p className="text-[10px] text-yellow-700 font-medium uppercase tracking-wide">Assigned</p>
            </CardContent>
          </Card>

          {/* Completed */}
          <Card 
            className={`cursor-pointer transition-all hover:shadow-md border-green-400 bg-white ${
              viewMode === 'orders' && activeFilter === 'COMPLETED' ? 'ring-2 ring-primary' : ''
            }`}
            onClick={() => handleStatCardClick('COMPLETED')}
          >
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-green-600">{stats.completedCount}</p>
              <p className="text-[10px] text-green-700 font-medium uppercase tracking-wide">Completed</p>
            </CardContent>
          </Card>

          {/* No Show */}
          <Card 
            className={`cursor-pointer transition-all hover:shadow-md border-red-400 bg-white ${
              viewMode === 'orders' && activeFilter === 'NO_SHOW' ? 'ring-2 ring-primary' : ''
            }`}
            onClick={() => handleStatCardClick('NO_SHOW')}
          >
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-red-600">{stats.noShowCount}</p>
              <p className="text-[10px] text-red-700 font-medium uppercase tracking-wide">No Show</p>
            </CardContent>
          </Card>

          {/* Earned */}
          <Card 
            className={`cursor-pointer transition-all hover:shadow-md border-amber-400 bg-amber-900 ${
              viewMode === 'earnings' ? 'ring-2 ring-primary' : ''
            }`}
            onClick={() => handleStatCardClick('EARNINGS')}
          >
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-amber-300">EC${stats.totalEarned.toFixed(0)}</p>
              <p className="text-[10px] text-amber-400 font-medium uppercase tracking-wide">Earned</p>
            </CardContent>
          </Card>

          {/* To Be Returned */}
          <Card 
            className={`cursor-pointer transition-all hover:shadow-md border-purple-400 bg-white ${
              viewMode === 'to_return' ? 'ring-2 ring-primary' : ''
            }`}
            onClick={() => handleStatCardClick('TO_RETURN')}
          >
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-purple-600">EC${stats.toBeReturned.toFixed(0)}</p>
              <p className="text-[10px] text-purple-700 font-medium uppercase tracking-wide">To Return</p>
            </CardContent>
          </Card>
        </div>

        {/* My Stock Button */}
        <Button 
          variant={viewMode === 'stock' ? 'default' : 'outline'}
          className="w-full justify-start gap-2"
          onClick={() => handleStatCardClick('STOCK')}
        >
          <BoxIcon className="h-4 w-4" />
          My Stock
          <Badge variant="secondary" className="ml-auto">{stock.length}</Badge>
        </Button>

        {/* Content Area - Renders based on viewMode */}
        {viewMode === 'orders' && (
          <OrdersView 
            orders={orders}
            loading={ordersLoading}
            activeFilter={activeFilter}
            updating={updating}
            onMarkCompleted={handleMarkCompleted}
            onNoShowClick={handleNoShowClick}
            onContactCustomer={contactCustomer}
            getStatusBadge={getStatusBadge}
          />
        )}

        {viewMode === 'earnings' && (
          <EarningsView
            earnings={earnings}
            loading={earningsLoading}
            dateRange={dateRange}
            calendarOpen={calendarOpen}
            onSetDateRange={setDateRange}
            onSetCalendarOpen={setCalendarOpen}
            onSetQuickFilter={setQuickDateFilter}
            onBack={() => setViewMode('orders')}
          />
        )}

        {viewMode === 'to_return' && (
          <ToBeReturnedView
            total={stats.toBeReturned}
            onBack={() => setViewMode('orders')}
          />
        )}

        {viewMode === 'stock' && (
          <StockView
            stock={stock}
            loading={stockLoading}
            onBack={() => setViewMode('orders')}
          />
        )}
      </main>

      {/* No Show Dialog */}
      <Dialog open={noShowDialogOpen} onOpenChange={setNoShowDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as No Show</DialogTitle>
            <DialogDescription>
              This will mark the order as failed. No stock will be deducted and no commission earned.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Add a note (optional)..."
            value={noShowNote}
            onChange={(e) => setNoShowNote(e.target.value)}
            className="min-h-[80px]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoShowDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleConfirmNoShow}>Confirm No Show</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Orders List Component
interface OrdersViewProps {
  orders: PartnerOrder[];
  loading: boolean;
  activeFilter: OrderFilter;
  updating: string | null;
  onMarkCompleted: (orderId: string) => void;
  onNoShowClick: (orderId: string) => void;
  onContactCustomer: (order: PartnerOrder) => void;
  getStatusBadge: (order: PartnerOrder) => JSX.Element;
}

function OrdersView({ 
  orders, 
  loading, 
  activeFilter, 
  updating, 
  onMarkCompleted, 
  onNoShowClick, 
  onContactCustomer,
  getStatusBadge 
}: OrdersViewProps) {
  const filterLabels: Record<OrderFilter, string> = {
    'ASSIGNED': 'Active Orders',
    'COMPLETED': 'Completed Orders',
    'NO_SHOW': 'No Show Orders',
    'ALL': 'All Orders'
  };

  if (loading && orders.length === 0) {
    return (
      <div className="flex justify-center py-8">
        <RefreshCw className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Clock className="h-4 w-4 text-primary" />
        <h2 className="font-display text-lg font-semibold">{filterLabels[activeFilter]}</h2>
        <Badge variant="secondary" className="ml-auto text-xs">{orders.length}</Badge>
      </div>

      {orders.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-8 text-center">
            <Package className="mb-3 h-10 w-10 text-muted-foreground/50" />
            <h3 className="font-medium text-sm mb-1">No orders</h3>
            <p className="text-xs text-muted-foreground">
              {activeFilter === 'ASSIGNED' ? 'Orders assigned to you will appear here' : 
               activeFilter === 'COMPLETED' ? 'Completed orders will appear here' :
               'No show orders will appear here'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              activeFilter={activeFilter}
              updating={updating}
              onMarkCompleted={onMarkCompleted}
              onNoShowClick={onNoShowClick}
              onContactCustomer={onContactCustomer}
              getStatusBadge={getStatusBadge}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Individual Order Card
interface OrderCardProps {
  order: PartnerOrder;
  activeFilter: OrderFilter;
  updating: string | null;
  onMarkCompleted: (orderId: string) => void;
  onNoShowClick: (orderId: string) => void;
  onContactCustomer: (order: PartnerOrder) => void;
  getStatusBadge: (order: PartnerOrder) => JSX.Element;
}

function OrderCard({ 
  order, 
  activeFilter, 
  updating, 
  onMarkCompleted, 
  onNoShowClick, 
  onContactCustomer,
  getStatusBadge 
}: OrderCardProps) {
  const effectiveStatus = order.order_status || order.status;
  const isActive = ['ASSIGNED', 'ON_THE_WAY', 'pending'].includes(effectiveStatus);

  return (
    <Card className="overflow-hidden border-l-4 border-l-primary">
      <CardContent className="p-0">
        {/* Order Header */}
        <div className="flex items-center justify-between p-3 bg-muted/30">
          <div className="flex items-center gap-2">
            <span className="font-display text-base font-bold">{formatOrderNumber(order.order_number)}</span>
            {getStatusBadge(order)}
          </div>
          <div className="text-right">
            <p className="text-base font-bold text-primary">EC${order.total_price.toFixed(2)}</p>
            {order.partner_commission && (
              <p className="text-xs text-green-600 font-medium flex items-center gap-1 justify-end">
                <DollarSign className="h-3 w-3" />
                +EC${order.partner_commission.toFixed(2)}
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
                onClick={() => onContactCustomer(order)}
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

        {/* Actions - Only for ASSIGNED orders */}
        {isActive && activeFilter === 'ASSIGNED' && (
          <>
            <Separator />
            <div className="p-3">
              <div className="flex gap-2">
                <Button
                  onClick={() => onMarkCompleted(order.id)}
                  disabled={updating === order.id}
                  className="flex-1 gap-1.5 bg-green-600 hover:bg-green-700 h-9"
                >
                  <CheckCircle className="h-4 w-4" />
                  Mark Completed
                </Button>
                <Button
                  onClick={() => onNoShowClick(order.id)}
                  disabled={updating === order.id}
                  variant="outline"
                  className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50 h-9"
                >
                  <XCircle className="h-4 w-4" />
                  No Show
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// Earnings View Component
interface EarningsViewProps {
  earnings: { total: number; entries: { id: string; order_id: string; commission_amount: number; created_at: string; ledger_status: string }[] };
  loading: boolean;
  dateRange: DateRange | undefined;
  calendarOpen: boolean;
  onSetDateRange: (range: DateRange | undefined) => void;
  onSetCalendarOpen: (open: boolean) => void;
  onSetQuickFilter: (period: 'today' | 'week' | 'month') => void;
  onBack: () => void;
}

function EarningsView({ 
  earnings, 
  loading, 
  dateRange, 
  calendarOpen, 
  onSetDateRange, 
  onSetCalendarOpen,
  onSetQuickFilter,
  onBack 
}: EarningsViewProps) {
  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
        <ArrowLeft className="h-4 w-4" />
        Back to Orders
      </Button>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-600" />
            Commission Earnings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Quick Filters */}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => onSetQuickFilter('today')}>Today</Button>
            <Button size="sm" variant="outline" onClick={() => onSetQuickFilter('week')}>This Week</Button>
            <Button size="sm" variant="outline" onClick={() => onSetQuickFilter('month')}>This Month</Button>
            <Popover open={calendarOpen} onOpenChange={onSetCalendarOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <CalendarIcon className="h-3 w-3" />
                  {dateRange?.from && dateRange?.to ? (
                    `${format(dateRange.from, "MMM d")} - ${format(dateRange.to, "MMM d")}`
                  ) : "Custom"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  selected={dateRange}
                  onSelect={(range) => {
                    onSetDateRange(range);
                    if (range?.from && range?.to) {
                      onSetCalendarOpen(false);
                    }
                  }}
                  numberOfMonths={1}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Total */}
          <div className="p-4 rounded-lg bg-green-50 border border-green-200">
            <p className="text-sm text-green-700">Total Commission</p>
            <p className="text-3xl font-bold text-green-600">EC${earnings.total.toFixed(2)}</p>
          </div>

          {/* Entries List */}
          {loading ? (
            <div className="flex justify-center py-4">
              <RefreshCw className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : earnings.entries.length > 0 ? (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {earnings.entries.map((entry) => (
                <div key={entry.id} className="flex justify-between p-2 bg-muted/50 rounded-md">
                  <span className="text-sm">{format(parseISO(entry.created_at), "MMM d, yyyy")}</span>
                  <span className="font-medium text-green-600">+EC${entry.commission_amount.toFixed(2)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No earnings in this date range
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// To Be Returned View Component
interface ToBeReturnedViewProps {
  total: number;
  onBack: () => void;
}

function ToBeReturnedView({ total, onBack }: ToBeReturnedViewProps) {
  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
        <ArrowLeft className="h-4 w-4" />
        Back to Orders
      </Button>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Wallet className="h-5 w-5 text-purple-600" />
            Amount to Return
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="p-6 rounded-lg bg-purple-50 border border-purple-200 text-center">
            <p className="text-sm text-purple-700 mb-1">Total Owed to Admin</p>
            <p className="text-4xl font-bold text-purple-600">EC${total.toFixed(2)}</p>
            <p className="text-xs text-purple-500 mt-2">
              (Gross collected minus your commission)
            </p>
          </div>
          <p className="text-xs text-muted-foreground text-center mt-4">
            This total will be cleared when admin marks your cash as settled.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// Stock View Component
interface StockViewProps {
  stock: { id: string; product_id: string | null; qty_on_hand: number; last_updated_at: string | null; product?: { name: string; images: string[]; price: number } }[];
  loading: boolean;
  onBack: () => void;
}

function StockView({ stock, loading, onBack }: StockViewProps) {
  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
        <ArrowLeft className="h-4 w-4" />
        Back to Orders
      </Button>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <BoxIcon className="h-5 w-5" />
            My Stock
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-4">
              <RefreshCw className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : stock.length === 0 ? (
            <div className="text-center py-8">
              <Package className="h-10 w-10 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No stock assigned to you</p>
            </div>
          ) : (
            <div className="divide-y">
              {stock.map(item => (
                <div key={item.id} className="flex justify-between items-center py-3">
                  <div>
                    <p className="font-medium text-sm">{item.product?.name || 'Unknown Product'}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.last_updated_at && `Updated: ${format(parseISO(item.last_updated_at), "MMM d, h:mm a")}`}
                    </p>
                  </div>
                  <Badge variant={item.qty_on_hand > 0 ? "secondary" : "destructive"}>
                    {item.qty_on_hand} units
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
