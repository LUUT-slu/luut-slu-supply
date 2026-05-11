import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
  ArrowLeft,
  UserPlus,
  MapPin,
  Calendar,
  Phone,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { AssignOrderModal } from "@/components/admin/AssignOrderModal";
import { useIsMobile } from "@/hooks/use-mobile";
import { useShopifySyncStatus } from "@/hooks/useShopifySyncStatus";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, ShoppingBag, Store } from "lucide-react";

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
  order_status: string | null;
  total_price: number;
  currency_code: string;
  assigned_partner_id: string | null;
  source?: string | null;
  shopify_order_name?: string | null;
  shopify_pos_location_name?: string | null;
  shopify_financial_status?: string | null;
  line_items: Array<{
    title: string;
    quantity: number;
    price: string;
  }>;
  created_at: string;
}

const getEffectiveStatus = (order: Order): string => {
  if (order.order_status) return order.order_status.toUpperCase();
  return order.status?.toUpperCase() || "NEW";
};

interface Partner {
  user_id: string;
  partner_name: string;
  phone: string | null;
  whatsapp: string | null;
  is_active: boolean;
}

const statusOptions = [
  { value: "NEW", label: "New", icon: Package, color: "bg-blue-500" },
  { value: "ASSIGNED", label: "Assigned", icon: Clock, color: "bg-yellow-500" },
  { value: "ACCEPTED", label: "Accepted", icon: CheckCircle, color: "bg-indigo-500" },
  { value: "ON_THE_WAY", label: "On the Way", icon: Truck, color: "bg-purple-500" },
  { value: "COMPLETED", label: "Completed", icon: CheckCircle, color: "bg-green-500" },
  { value: "NO_SHOW", label: "No Show", icon: XCircle, color: "bg-red-500" },
  { value: "CANCELLED", label: "Cancelled", icon: XCircle, color: "bg-gray-500" },
];

const adminUpdatableStatuses = ["NEW", "ASSIGNED", "ACCEPTED", "COMPLETED", "CANCELLED", "NO_SHOW"];

export default function AdminOrdersPage() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [orders, setOrders] = useState<Order[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [sourceFilter, setSourceFilter] = useState<string>("ALL");
  const [mobileTab, setMobileTab] = useState("ALL");
  const { state: syncState, syncing, triggerSync } = useShopifySyncStatus();
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminUserId, setAdminUserId] = useState<string | null>(null);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [orderToAssign, setOrderToAssign] = useState<Order | null>(null);
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  const checkAdminAccess = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/auth"); return false; }
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    const hasAdminRole = roles?.some(r => r.role === "admin");
    if (!hasAdminRole) { toast.error("Access denied. Admin only."); navigate("/"); return false; }
    setIsAdmin(true);
    setAdminUserId(user.id);
    return true;
  };

  const fetchOrders = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
    if (error) { toast.error("Failed to load orders"); console.error(error); }
    else { setOrders((data || []) as unknown as Order[]); }
    setLoading(false);
  };

  const fetchPartners = async () => {
    const { data } = await supabase.from("partner_profiles").select("user_id, partner_name, phone, whatsapp, is_active").eq("is_active", true);
    setPartners(data || []);
  };

  useEffect(() => {
    const init = async () => {
      const ok = await checkAdminAccess();
      if (ok) await Promise.all([fetchOrders(), fetchPartners()]);
    };
    init();
  }, []);

  // ─── STATUS UPDATE WITH OPTIMISTIC UI + AUDIT ───
  const handleStatusChange = async (orderId: string, newStatus: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order || !adminUserId) return;

    const previousStatus = getEffectiveStatus(order);
    if (previousStatus === newStatus) return;

    // Optimistic update
    setUpdatingStatus(orderId);
    setOrders(prev => prev.map(o =>
      o.id === orderId ? { ...o, order_status: newStatus, status: newStatus.toLowerCase() } : o
    ));

    try {
      const updatePayload: Record<string, any> = {
        order_status: newStatus,
        status: newStatus.toLowerCase(),
        updated_at: new Date().toISOString(),
        last_edited_by: adminUserId,
        last_edited_at: new Date().toISOString(),
      };

      if (newStatus === "COMPLETED") updatePayload.completed_at = new Date().toISOString();
      if (newStatus === "CANCELLED") updatePayload.cancelled_at = new Date().toISOString();
      if (newStatus === "NO_SHOW") updatePayload.no_sale_at = new Date().toISOString();

      const { error: updateError } = await supabase
        .from("orders")
        .update(updatePayload)
        .eq("id", orderId);

      if (updateError) throw updateError;

      await supabase.from("order_events").insert({
        order_id: orderId,
        actor_user_id: adminUserId,
        event_type: "status_changed",
        event_payload: {
          previous_status: previousStatus,
          new_status: newStatus,
          channel: "admin",
        },
      } as any);

      toast.success(`Order updated to ${statusOptions.find(s => s.value === newStatus)?.label || newStatus}`);
    } catch (err) {
      console.error("Status update failed:", err);
      setOrders(prev => prev.map(o =>
        o.id === orderId ? { ...o, order_status: previousStatus, status: previousStatus.toLowerCase() } : o
      ));
      toast.error("Failed to update order status");
    } finally {
      setUpdatingStatus(null);
    }
  };

  // ─── BULK STATUS UPDATE ───
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const handleBulkStatusChange = async (newStatus: string) => {
    if (selectedOrders.size === 0 || !adminUserId) return;
    const ids = Array.from(selectedOrders);
    setBulkUpdating(true);

    // Optimistic
    setOrders(prev => prev.map(o =>
      ids.includes(o.id) ? { ...o, order_status: newStatus, status: newStatus.toLowerCase() } : o
    ));

    try {
      const updatePayload: Record<string, any> = {
        order_status: newStatus,
        status: newStatus.toLowerCase(),
        updated_at: new Date().toISOString(),
        last_edited_by: adminUserId,
        last_edited_at: new Date().toISOString(),
      };
      if (newStatus === "COMPLETED") updatePayload.completed_at = new Date().toISOString();
      if (newStatus === "CANCELLED") updatePayload.cancelled_at = new Date().toISOString();
      if (newStatus === "NO_SHOW") updatePayload.no_sale_at = new Date().toISOString();

      const { error } = await supabase.from("orders").update(updatePayload).in("id", ids);
      if (error) throw error;

      // Audit logs
      await supabase.from("order_events").insert(
        ids.map(id => ({
          order_id: id,
          actor_user_id: adminUserId,
          event_type: "status_changed",
          event_payload: { new_status: newStatus, channel: "admin_bulk" },
        })) as any
      );

      toast.success(`${ids.length} order(s) updated to ${statusOptions.find(s => s.value === newStatus)?.label || newStatus}`);
      setSelectedOrders(new Set());
    } catch (err) {
      console.error("Bulk status update failed:", err);
      await fetchOrders();
      toast.error("Failed to update orders");
    } finally {
      setBulkUpdating(false);
    }
  };

  const openAssignModal = (order: Order) => { setOrderToAssign(order); setAssignModalOpen(true); };

  const handleOrderAssigned = (partnerId: string, commissionType: 'fixed' | 'percent', commissionValue: number) => {
    if (!orderToAssign) return;
    setOrders(orders.map(o =>
      o.id === orderToAssign.id
        ? { ...o, assigned_partner_id: partnerId, order_status: "ASSIGNED", status: "ASSIGNED" }
        : o
    ));
    const partner = partners.find(p => p.user_id === partnerId);
    if (partner?.whatsapp) sendPartnerNotification(orderToAssign, partner, commissionType, commissionValue);
    setOrderToAssign(null);
  };

  const sendPartnerNotification = (order: Order, partner: Partner, commissionType?: 'fixed' | 'percent', commissionValue?: number) => {
    let message = `🚀 *NEW ORDER ASSIGNED*\n\nOrder: ${formatOrderNumber(order.order_number)}\n\n`;
    message += `👤 Customer: ${order.customer_name}\n`;
    if (order.customer_phone) message += `📱 Phone: ${order.customer_phone}\n`;
    message += `📍 Location: ${order.location}\n📅 Pickup: ${order.preferred_date}\n`;
    if (order.pickup_time_window) message += `⏰ Time: ${order.pickup_time_window}\n`;
    message += `\n📦 Items:\n`;
    order.line_items.forEach(item => { message += `• ${item.title} × ${item.quantity}\n`; });
    message += `\n💰 Total: EC$${order.total_price.toFixed(2)}\n💳 Payment: Cash on pickup`;
    if (commissionType && commissionValue) {
      const amt = commissionType === 'fixed' ? commissionValue : (order.total_price * commissionValue) / 100;
      message += `\n\n💵 Your Commission: EC$${amt.toFixed(2)}`;
      if (commissionType === 'percent') message += ` (${commissionValue}%)`;
    }
    if (order.note) message += `\n\n📝 Note: ${order.note}`;
    const phone = partner.whatsapp?.replace(/\D/g, '') || '';
    if (phone) window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const handleLogout = async () => { await supabase.auth.signOut(); toast.success("Logged out"); navigate("/", { replace: true }); };

  const toggleSelectOrder = (id: string) => {
    const s = new Set(selectedOrders);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelectedOrders(s);
  };

  const toggleSelectAll = () => {
    selectedOrders.size === filteredOrders.length
      ? setSelectedOrders(new Set())
      : setSelectedOrders(new Set(filteredOrders.map(o => o.id)));
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedOrders);
    const { error } = await supabase.from("orders").delete().in("id", ids);
    if (error) { toast.error("Failed to delete orders"); }
    else { toast.success(`${ids.length} order(s) deleted`); setOrders(o => o.filter(x => !selectedOrders.has(x.id))); setSelectedOrders(new Set()); }
    setDeleteDialogOpen(false);
  };

  const formatOrderNumber = (num: number) => `#L${String(num).padStart(4, '0')}`;
  const formatDate = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  const getPartnerName = (id: string | null) => {
    if (!id) return "Unassigned";
    return partners.find(p => p.user_id === id)?.partner_name || "Unknown";
  };

  const activeFilter = isMobile ? mobileTab : statusFilter;
  const filteredOrders = useMemo(() => {
    let list = orders;
    if (sourceFilter !== "ALL") {
      list = list.filter(o => (o.source ?? "website") === sourceFilter);
    }
    if (activeFilter === "ALL") return list;
    if (activeFilter === "ACTIVE") return list.filter(o => ["ACCEPTED", "ON_THE_WAY"].includes(getEffectiveStatus(o)));
    return list.filter(o => getEffectiveStatus(o) === activeFilter);
  }, [orders, activeFilter, sourceFilter]);

  const orderCounts = useMemo(() => ({
    ALL: orders.length,
    NEW: orders.filter(o => getEffectiveStatus(o) === "NEW").length,
    ASSIGNED: orders.filter(o => getEffectiveStatus(o) === "ASSIGNED").length,
    ACTIVE: orders.filter(o => ["ACCEPTED", "ON_THE_WAY"].includes(getEffectiveStatus(o))).length,
    COMPLETED: orders.filter(o => getEffectiveStatus(o) === "COMPLETED").length,
    NO_SHOW: orders.filter(o => getEffectiveStatus(o) === "NO_SHOW").length,
    CANCELLED: orders.filter(o => getEffectiveStatus(o) === "CANCELLED").length,
  }), [orders]);

  const getStatusBadge = (status: string) => {
    const cfg = statusOptions.find(s => s.value === status) || statusOptions[0];
    return (
      <Badge variant="outline" className="gap-1 text-xs">
        <span className={`h-2 w-2 rounded-full ${cfg.color}`} />
        {cfg.label}
      </Badge>
    );
  };

  // ─── STATUS SELECT (shared between table & cards) ───
  const StatusSelect = ({ order }: { order: Order }) => {
    const current = getEffectiveStatus(order);
    return (
      <Select
        value={current}
        onValueChange={(v) => handleStatusChange(order.id, v)}
        disabled={updatingStatus === order.id}
      >
        <SelectTrigger className="h-8 w-[120px] text-xs" onClick={(e) => e.stopPropagation()}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {adminUpdatableStatuses.map(s => (
            <SelectItem key={s} value={s}>{statusOptions.find(x => x.value === s)?.label || s}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  };

  // ─── MOBILE ORDER CARD ───
  const OrderCard = ({ order }: { order: Order }) => {
    const status = getEffectiveStatus(order);
    return (
      <Card
        className="cursor-pointer transition-all hover:border-primary/50 active:scale-[0.99]"
        onClick={() => setDetailOrder(order)}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-sm">{formatOrderNumber(order.order_number)}</span>
                {getStatusBadge(status)}
                {order.source === "shopify_pos" && (
                  <Badge variant="secondary" className="gap-1 text-[10px]">
                    <Store className="h-3 w-3" /> Shopify POS
                    {order.shopify_pos_location_name ? ` · ${order.shopify_pos_location_name}` : ""}
                  </Badge>
                )}
                {order.source === "shopify_online" && (
                  <Badge variant="secondary" className="gap-1 text-[10px]">
                    <ShoppingBag className="h-3 w-3" /> Shopify Online
                  </Badge>
                )}
                {order.shopify_order_name && (
                  <span className="text-[10px] text-muted-foreground">{order.shopify_order_name}</span>
                )}
              </div>
              <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <User className="h-3 w-3 shrink-0" />
                <span className="truncate">{order.customer_name}</span>
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{order.location}</span>
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3 shrink-0" />
                <span>{order.preferred_date}{order.pickup_time_window ? ` · ${order.pickup_time_window}` : ""}</span>
              </div>
              <div className="mt-1.5 text-xs">
                {order.line_items.slice(0, 2).map((item, i) => (
                  <span key={i} className="text-muted-foreground">{i > 0 ? ", " : ""}{item.title} ×{item.quantity}</span>
                ))}
                {order.line_items.length > 2 && <span className="text-muted-foreground"> +{order.line_items.length - 2}</span>}
              </div>
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0">
              <span className="font-semibold text-sm">EC${order.total_price.toFixed(2)}</span>
              <div onClick={(e) => e.stopPropagation()}>
                <StatusSelect order={order} />
              </div>
              {order.assigned_partner_id && (
                <span className="text-[10px] text-muted-foreground">{getPartnerName(order.assigned_partner_id)}</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  // ─── MOBILE ORDER DETAIL DRAWER ───
  const OrderDetailSheet = () => {
    if (!detailOrder) return null;
    const status = getEffectiveStatus(detailOrder);
    return (
      <Sheet open={!!detailOrder} onOpenChange={(open) => { if (!open) setDetailOrder(null); }}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              {formatOrderNumber(detailOrder.order_number)}
              {getStatusBadge(status)}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Customer</p>
                <p className="font-medium">{detailOrder.customer_name}</p>
              </div>
              {detailOrder.customer_phone && (
                <div>
                  <p className="text-xs text-muted-foreground">Phone</p>
                  <a href={`tel:${detailOrder.customer_phone}`} className="font-medium text-primary">{detailOrder.customer_phone}</a>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground">Location</p>
                <p className="font-medium">{detailOrder.location}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pickup</p>
                <p className="font-medium">{detailOrder.preferred_date}</p>
                {detailOrder.pickup_time_window && <p className="text-xs text-muted-foreground">{detailOrder.pickup_time_window}</p>}
              </div>
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-1">Items</p>
              <div className="space-y-1">
                {detailOrder.line_items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span>{item.title} ×{item.quantity}</span>
                    <span className="text-muted-foreground">EC${(parseFloat(item.price) * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex items-center justify-between border-t pt-2 font-semibold text-sm">
                <span>Total</span>
                <span>EC${detailOrder.total_price.toFixed(2)}</span>
              </div>
            </div>

            {detailOrder.note && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Note</p>
                <p className="text-sm">{detailOrder.note}</p>
              </div>
            )}

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Partner</p>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{getPartnerName(detailOrder.assigned_partner_id)}</span>
                <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => { setDetailOrder(null); openAssignModal(detailOrder); }}>
                  <UserPlus className="h-3 w-3" />
                  {detailOrder.assigned_partner_id ? "Change" : "Assign"}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Update Status</p>
              <StatusSelect order={detailOrder} />
            </div>
          </div>
        </SheetContent>
      </Sheet>
    );
  };

  if (!isAdmin) {
    return <div className="flex min-h-screen items-center justify-center bg-background"><RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  // ─── MOBILE TABS ───
  const mobileTabs = [
    { value: "ALL", label: "All", count: orderCounts.ALL },
    { value: "NEW", label: "New", count: orderCounts.NEW },
    { value: "ASSIGNED", label: "Assigned", count: orderCounts.ASSIGNED },
    { value: "COMPLETED", label: "Done", count: orderCounts.COMPLETED },
    { value: "CANCELLED", label: "Cancelled", count: orderCounts.CANCELLED },
    { value: "NO_SHOW", label: "No Show", count: orderCounts.NO_SHOW },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="container py-4 md:py-6">
        {/* Header */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-xl md:text-2xl">Admin Orders</h1>
            <p className="text-xs text-muted-foreground">Assign partners and track all orders</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => navigate("/admin")} variant="outline" size="sm" className="gap-1 text-xs">
              <ArrowLeft className="h-3 w-3" />
              <span className="hidden sm:inline">Admin</span>
            </Button>
            <Button onClick={() => navigate("/")} variant="outline" size="sm" className="gap-1 text-xs">
              <Home className="h-3 w-3" />
            </Button>
            {selectedOrders.size > 0 && (
              <>
                <Select onValueChange={handleBulkStatusChange} disabled={bulkUpdating}>
                  <SelectTrigger className="h-8 w-[140px] text-xs">
                    <SelectValue placeholder={`Status (${selectedOrders.size})`} />
                  </SelectTrigger>
                  <SelectContent>
                    {adminUpdatableStatuses.map(s => (
                      <SelectItem key={s} value={s}>{statusOptions.find(x => x.value === s)?.label || s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={() => setDeleteDialogOpen(true)} variant="destructive" size="sm" className="gap-1 text-xs">
                  <Trash2 className="h-3 w-3" />
                  ({selectedOrders.size})
                </Button>
              </>
            )}
            <Button onClick={triggerSync} disabled={syncing} variant="outline" size="sm" className="gap-1 text-xs">
              <ShoppingBag className={`h-3 w-3 ${syncing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{syncing ? "Syncing…" : "Sync Shopify"}</span>
            </Button>
            <Button onClick={() => { fetchOrders(); fetchPartners(); }} variant="outline" size="sm" className="gap-1 text-xs">
              <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button onClick={handleLogout} variant="ghost" size="sm" className="gap-1 text-xs">
              <LogOut className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Shopify sync status */}
        {syncState?.last_status === "error" && (
          <Alert variant="destructive" className="mb-3">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Shopify order sync failed. Check API permissions or connection.
              {syncState.last_error ? ` (${syncState.last_error.slice(0, 120)})` : ""}
            </AlertDescription>
          </Alert>
        )}
        {syncState?.last_synced_at && syncState.last_status !== "error" && (
          <p className="mb-3 text-[11px] text-muted-foreground">
            Shopify last synced {new Date(syncState.last_synced_at).toLocaleString()}
            {typeof syncState.last_run_count === "number" ? ` · ${syncState.last_run_count} updated` : ""}
          </p>
        )}

        {/* Source filter */}
        <Tabs value={sourceFilter} onValueChange={setSourceFilter} className="mb-3">
          <TabsList className="w-full overflow-x-auto flex justify-start gap-0 h-auto p-1">
            {[
              { value: "ALL", label: "All Orders" },
              { value: "website", label: "Website" },
              { value: "shopify_online", label: "Shopify Online" },
              { value: "shopify_pos", label: "Shopify POS" },
              { value: "manual", label: "Manual" },
            ].map(s => (
              <TabsTrigger key={s.value} value={s.value} className="text-xs px-2.5 py-1.5 whitespace-nowrap gap-1">
                {s.value === "shopify_pos" && <Store className="h-3 w-3" />}
                {s.value === "shopify_online" && <ShoppingBag className="h-3 w-3" />}
                {s.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="mb-4 hidden md:grid gap-3 grid-cols-2 lg:grid-cols-5">
          {[
            { label: "New", count: orderCounts.NEW, icon: Package, color: "text-blue-500", filter: "NEW" },
            { label: "Assigned", count: orderCounts.ASSIGNED, icon: Clock, color: "text-yellow-500", filter: "ASSIGNED" },
            { label: "Active", count: orderCounts.ACTIVE, icon: Truck, color: "text-purple-500", filter: "ACTIVE" },
            { label: "Completed", count: orderCounts.COMPLETED, icon: CheckCircle, color: "text-green-500", filter: "COMPLETED" },
            { label: "No Show", count: orderCounts.NO_SHOW, icon: XCircle, color: "text-red-500", filter: "NO_SHOW" },
          ].map(s => (
            <Card key={s.label} className="cursor-pointer hover:border-primary" onClick={() => setStatusFilter(s.filter)}>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                    <p className="text-xl font-bold">{s.count}</p>
                  </div>
                  <s.icon className={`h-4 w-4 ${s.color}`} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* MOBILE VIEW */}
        {isMobile ? (
          <div>
            <Tabs value={mobileTab} onValueChange={setMobileTab}>
              <TabsList className="w-full overflow-x-auto flex justify-start gap-0 h-auto p-1 mb-3">
                {mobileTabs.map(t => (
                  <TabsTrigger key={t.value} value={t.value} className="text-xs px-2.5 py-1.5 whitespace-nowrap">
                    {t.label} {t.count > 0 && <span className="ml-1 text-[10px] text-muted-foreground">({t.count})</span>}
                  </TabsTrigger>
                ))}
              </TabsList>
              {mobileTabs.map(t => (
                <TabsContent key={t.value} value={t.value} className="mt-0">
                  {loading ? (
                    <div className="flex items-center justify-center py-12"><RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                  ) : filteredOrders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Package className="mb-3 h-8 w-8 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">No orders</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredOrders.map(order => <OrderCard key={order.id} order={order} />)}
                    </div>
                  )}
                </TabsContent>
              ))}
            </Tabs>
            <OrderDetailSheet />
          </div>
        ) : (
          /* DESKTOP VIEW */
          <>
            {/* Filter */}
            <div className="mb-3 flex items-center gap-3">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Orders</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  {statusOptions.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
              {statusFilter !== "ALL" && (
                <Button variant="ghost" size="sm" onClick={() => setStatusFilter("ALL")}>Clear</Button>
              )}
            </div>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">
                  {statusFilter === "ALL" ? "All Orders" : `${statusFilter} Orders`}
                  <span className="ml-2 text-sm font-normal text-muted-foreground">({filteredOrders.length})</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-12"><RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" /></div>
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
                          <TableHead className="w-[40px]">
                            <Checkbox checked={filteredOrders.length > 0 && selectedOrders.size === filteredOrders.length} onCheckedChange={toggleSelectAll} />
                          </TableHead>
                          <TableHead>Order</TableHead>
                          <TableHead>Customer</TableHead>
                          <TableHead>Location</TableHead>
                          <TableHead>Pickup</TableHead>
                          <TableHead>Items</TableHead>
                          <TableHead>Total</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Update</TableHead>
                          <TableHead>Partner</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredOrders.map(order => {
                          const status = getEffectiveStatus(order);
                          return (
                            <TableRow key={order.id} className={selectedOrders.has(order.id) ? "bg-muted/50" : ""}>
                              <TableCell>
                                <Checkbox checked={selectedOrders.has(order.id)} onCheckedChange={() => toggleSelectOrder(order.id)} />
                              </TableCell>
                              <TableCell className="font-medium">
                                {formatOrderNumber(order.order_number)}
                                <div className="text-xs text-muted-foreground">{formatDate(order.created_at)}</div>
                              </TableCell>
                              <TableCell>
                                {order.customer_name}
                                {order.customer_phone && <div className="text-xs text-muted-foreground">{order.customer_phone}</div>}
                              </TableCell>
                              <TableCell>{order.location}</TableCell>
                              <TableCell>
                                {order.preferred_date}
                                {order.pickup_time_window && <div className="text-xs text-muted-foreground">{order.pickup_time_window}</div>}
                              </TableCell>
                              <TableCell>
                                <div className="max-w-[150px]">
                                  {order.line_items.slice(0, 2).map((item, i) => (
                                    <div key={i} className="text-sm truncate">{item.title} ×{item.quantity}</div>
                                  ))}
                                  {order.line_items.length > 2 && <div className="text-xs text-muted-foreground">+{order.line_items.length - 2} more</div>}
                                </div>
                              </TableCell>
                              <TableCell className="font-medium">EC${order.total_price.toFixed(2)}</TableCell>
                              <TableCell>{getStatusBadge(status)}</TableCell>
                              <TableCell>
                                <StatusSelect order={order} />
                              </TableCell>
                              <TableCell>
                                {status === "NEW" || !order.assigned_partner_id ? (
                                  <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => openAssignModal(order)}>
                                    <UserPlus className="h-3 w-3" />
                                    Assign
                                  </Button>
                                ) : (
                                  <span className="text-sm">{getPartnerName(order.assigned_partner_id)}</span>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedOrders.size} Order(s)?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Assign Modal */}
      {orderToAssign && (
        <AssignOrderModal
          open={assignModalOpen}
          onOpenChange={setAssignModalOpen}
          orderId={orderToAssign.id}
          orderNumber={orderToAssign.order_number}
          orderTotal={orderToAssign.total_price}
          currencyCode={orderToAssign.currency_code}
          partners={partners}
          onAssigned={handleOrderAssigned}
        />
      )}
    </div>
  );
}
