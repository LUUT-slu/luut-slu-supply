import { useState } from "react";
import { ListItemSkeleton } from "@/components/skeletons/TableSkeleton";
import { supabase } from "@/integrations/supabase/client";
import { AIOrderHelper } from "@/components/seller/AIOrderHelper";
import { SellerAIPanel } from "@/components/seller/SellerAIPanel";
import { useParams, useNavigate } from "react-router-dom";

import { SellerNav } from "@/components/seller/SellerNav";
import { useSellerProfile } from "@/hooks/useSellerProfile";
import { useSellerOrders, ORDER_STATUSES, OrderStatus } from "@/hooks/useSellerOrders";
import { EditOrderDialog } from "@/components/seller/EditOrderDialog";
import { OrderShopifyActions } from "@/components/orders/OrderShopifyActions";
import { WhatsAppQuickMessages } from "@/components/seller/WhatsAppQuickMessages";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  Phone,
  MessageCircle,
  MapPin,
  Calendar,
  Clock,
  Package,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Pencil,
  Trash2,
  RefreshCw,
  FileText,
  Archive,
  CalendarPlus,
  CalendarClock,
  ExternalLink,
  MoreHorizontal,
  ChevronDown,
  ChevronRight,
  Send,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

// Display preferred_date as-is (canonical string) without re-parsing
function displayDate(dateStr: string): string {
  if (/^[A-Z][a-z]+,\s/.test(dateStr)) return dateStr;
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export default function SellerOrderDetail() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { profile } = useSellerProfile();
  const { orders, loading, refetch, updateOrderStatus, deleteOrder } = useSellerOrders(profile?.id);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [addingToCalendar, setAddingToCalendar] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [rescheduling, setRescheduling] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [itemsOpen, setItemsOpen] = useState(true);
  const [quickMsgKey, setQuickMsgKey] = useState<string | null>(null);

  const addToCalendar = async () => {
    if (!order) return;
    setAddingToCalendar(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-order-calendar-event", {

        body: { orderId: order.id },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success("Added to Google Calendar", {
          action: data.htmlLink
            ? { label: "Open", onClick: () => window.open(data.htmlLink, "_blank") }
            : undefined,
        });
      } else {
        toast.error(data?.error || "Failed to add to calendar");
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to add to calendar");
    } finally {
      setAddingToCalendar(false);
    }
  };

  // Convert any preferred_date format into "YYYY-MM-DD" for <input type="date">
  const toIsoDate = (input?: string | null): string => {
    if (!input) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input;
    const d = new Date(input);
    if (isNaN(d.getTime())) return "";
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  // Convert "10:30 AM" / "HH:MM" / "HH:MM:SS" into "HH:MM" for <input type="time">
  const toIsoTime = (input?: string | null): string => {
    if (!input) return "";
    const ampm = input.trim().match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/);
    if (ampm) {
      let h = parseInt(ampm[1], 10);
      const isPm = ampm[3].toLowerCase() === "pm";
      if (h === 12) h = isPm ? 12 : 0;
      else if (isPm) h += 12;
      return `${String(h).padStart(2, "0")}:${ampm[2]}`;
    }
    const hms = input.trim().match(/^(\d{1,2}):(\d{2})/);
    if (hms) return `${hms[1].padStart(2, "0")}:${hms[2]}`;
    return "";
  };

  const openReschedule = () => {
    if (!order) return;
    setNewDate(toIsoDate(order.preferred_date));
    setNewTime(toIsoTime(order.pickup_time || order.pickup_time_window));
    setRescheduleOpen(true);
  };

  const handleReschedule = async () => {
    if (!order || !newDate) {
      toast.error("Please pick a date");
      return;
    }
    setRescheduling(true);
    try {
      // 1. Update the same order row (not a new order)
      const { error: updateErr } = await supabase
        .from("orders")
        .update({
          preferred_date: newDate,
          pickup_time: newTime || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id);
      if (updateErr) throw updateErr;

      // 2. Delete old calendar event if one exists (no-op if absent)
      await supabase.functions
        .invoke("delete-order-calendar-event", { body: { orderId: order.id } })
        .catch((err) => console.error("Calendar delete error:", err));

      // 3. Create fresh calendar event for the new date/time
      const { data: createData, error: createErr } = await supabase.functions.invoke(
        "create-order-calendar-event",
        { body: { orderId: order.id } },
      );
      if (createErr) throw createErr;

      toast.success("Order rescheduled", {
        action: createData?.htmlLink
          ? { label: "Open Calendar", onClick: () => window.open(createData.htmlLink, "_blank") }
          : undefined,
      });
      setRescheduleOpen(false);
      refetch();
    } catch (err: any) {
      toast.error(err?.message || "Failed to reschedule");
    } finally {
      setRescheduling(false);
    }
  };

  const order = orders.find((o) => o.id === orderId);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "XCD",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatCreatedDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatOrderNumber = (num: number) => `#L${String(num).padStart(4, "0")}`;

  const getStatusConfig = (status: string) => {
    return ORDER_STATUSES.find((s) => s.value === status) || ORDER_STATUSES[0];
  };

  const normalizePhone = (phone: string) => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 7) return `1758${digits}`;
    if (digits.length === 10) return `1${digits}`;
    if (digits.length === 11 && digits.startsWith("1")) return digits;
    return digits;
  };

  const messageCustomer = () => {
    if (!order?.customer_phone) {
      toast.error("No phone number available");
      return;
    }
    const cleanPhone = normalizePhone(order.customer_phone);
    const orderNum = formatOrderNumber(order.order_number);
    const items = order.items.map(i => `${i.product_name} ×${i.quantity}`).join(", ");
    const trackLink = order.order_token
      ? `\n\n🔗 Track your order & create an account: ${window.location.origin}/order-status/${order.id}?token=${order.order_token}`
      : "";
    const message = `Hi ${order.customer_name}! This is ${profile?.seller_name || "your seller"} regarding your order ${orderNum}.\n\n📦 Items: ${items}\n📍 Pickup: ${order.location}\n📅 Date: ${displayDate(order.preferred_date)}${order.pickup_time || order.pickup_time_window ? `\n🕐 Time: ${order.pickup_time || order.pickup_time_window}` : ""}\n💰 Total: ${formatCurrency(order.total_price)}${trackLink}\n\nLet me know if you have any questions!`;
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, "_blank");

  };

  const callCustomer = () => {
    if (!order?.customer_phone) {
      toast.error("No phone number available");
      return;
    }
    window.location.href = `tel:${order.customer_phone}`;
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!order) return;
    const prevStatus = order.status;
    await updateOrderStatus(order.id, newStatus as OrderStatus);

    // Trigger email on status change
    if (newStatus === "confirmed" || newStatus === "completed") {
      const emailType = newStatus === "confirmed" ? "order_confirmed" : "order_ready";
      supabase.functions.invoke("send-order-email", {
        body: { orderId: order.id, type: emailType },
      }).catch(err => console.error("Email trigger error:", err));
    }

    // Auto-add to Google Calendar when transitioning to confirmed
    if (newStatus === "confirmed" && prevStatus !== "confirmed") {
      supabase.functions
        .invoke("create-order-calendar-event", { body: { orderId: order.id } })
        .then(({ data, error }) => {
          if (error) {
            console.error("Calendar event error:", error);
            return;
          }
          if (data?.success) {
            toast.success("Added to Google Calendar", {
              action: data.htmlLink
                ? { label: "Open", onClick: () => window.open(data.htmlLink, "_blank") }
                : undefined,
            });
          }
        })
        .catch((err) => console.error("Calendar event error:", err));
    }

    // Auto-remove from Google Calendar when cancelling or marking no-show
    if (
      (newStatus === "cancelled" || newStatus === "no-show") &&
      prevStatus !== newStatus
    ) {
      supabase.functions
        .invoke("delete-order-calendar-event", { body: { orderId: order.id } })
        .then(({ data, error }) => {
          if (error) {
            console.error("Calendar delete error:", error);
            return;
          }
          if (data?.success && !data.skipped) {
            toast.success("Removed from Google Calendar");
          }
        })
        .catch((err) => console.error("Calendar delete error:", err));
    }
  };

  const handleDelete = async () => {
    if (!order) return;
    const success = await deleteOrder(order.id);
    if (success) {
      navigate("/seller/orders");
    }
  };

  const toggleArchive = () => {
    if (!order || !profile?.id) return;
    try {
      const raw = localStorage.getItem(`luut-archived-orders-${profile.id}`);
      const ids: string[] = raw ? JSON.parse(raw) : [];
      const set = new Set(ids);
      if (set.has(order.id)) {
        set.delete(order.id);
        toast.success("Order unarchived");
      } else {
        set.add(order.id);
        toast.success("Order archived");
      }
      localStorage.setItem(`luut-archived-orders-${profile.id}`, JSON.stringify([...set]));
    } catch {}
  };

  const canDelete = order && (
    order.status === "cancelled" ||
    order.status === "no-show" ||
    (order.status === "pending" &&
      new Date(order.created_at) < new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
  );

  const isEditable = true;

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
          <SellerNav sellerName={profile?.seller_name} logoUrl={profile?.logo_url || undefined} sellerId={profile?.id} />
          <main className="container flex-1 py-6 space-y-4">
            <ListItemSkeleton rows={4} />
          </main>
        </div>
    );
  }

  if (!order) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
          <SellerNav sellerName={profile?.seller_name} logoUrl={profile?.logo_url || undefined} sellerId={profile?.id} />
          <main className="container flex-1 py-6">
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-lg font-medium">Order not found</h2>
              <Button variant="outline" onClick={() => navigate("/seller/orders")} className="mt-4">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Orders
              </Button>
            </div>
          </main>
        </div>
    );
  }

  const statusConfig = getStatusConfig(order.status);
  const itemsTotal = order.items.reduce((sum, item) => sum + item.total_price, 0);

  return (
    <>
      <div className="flex min-h-screen flex-col bg-background">
        <SellerNav sellerName={profile?.seller_name} logoUrl={profile?.logo_url || undefined} sellerId={profile?.id} />

        <main className="container flex-1 py-4 md:py-6">
          {/* Header */}
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/seller/orders")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="font-display text-xl md:text-2xl">
                    Order {formatOrderNumber(order.order_number)}
                  </h1>
                  <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Created {formatCreatedDate(order.created_at)}
                  {order.last_edited_at && (
                    <> · Last edited {formatCreatedDate(order.last_edited_at)}</>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Select value={order.status} onValueChange={handleStatusChange}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ORDER_STATUSES.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-4">
              {/* Customer + Pickup combined */}
              <Card>
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{order.customer_name}</p>
                      {order.customer_phone && (
                        <p className="text-xs text-muted-foreground truncate">{order.customer_phone}</p>
                      )}
                    </div>
                    {order.customer_phone && (
                      <div className="flex gap-2 shrink-0">
                        <Button size="icon" variant="secondary" onClick={callCustomer} aria-label="Call customer">
                          <Phone className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="secondary" onClick={() => setQuickMsgKey("confirm")} aria-label="WhatsApp customer">
                          <MessageCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                  <Separator />
                  <div className="space-y-1.5 text-sm">
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <span>{order.location}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground text-xs pl-6">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>{displayDate(order.preferred_date)}</span>
                      {(order.pickup_time || order.pickup_time_window) && (
                        <>
                          <span>·</span>
                          <Clock className="h-3.5 w-3.5" />
                          <span>{order.pickup_time || order.pickup_time_window}</span>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Order Items — collapsible */}
              <Card>
                <button
                  type="button"
                  onClick={() => setItemsOpen(!itemsOpen)}
                  className="w-full flex items-center justify-between p-4 text-sm touch-manipulation"
                >
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {order.items.length} {order.items.length === 1 ? "item" : "items"} · {formatCurrency(order.total_price)}
                    </span>
                  </div>
                  {itemsOpen ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
                {itemsOpen && (
                  <CardContent className="pt-0">
                    <div className="space-y-3">
                      {order.items.map((item) => (
                        <div key={item.id} className="flex items-center gap-3">
                          {item.product_image_url ? (
                            <img
                              src={item.product_image_url}
                              alt={item.product_name}
                              className="h-12 w-12 rounded-lg object-cover"
                            />
                          ) : (
                            <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center">
                              <Package className="h-5 w-5 text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm line-clamp-1">{item.product_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatCurrency(item.unit_price)} × {item.quantity}
                            </p>
                          </div>
                          <p className="font-medium text-sm">{formatCurrency(item.total_price)}</p>
                        </div>
                      ))}
                    </div>
                    <Separator className="my-3" />
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Subtotal</span>
                        <span>{formatCurrency(itemsTotal)}</span>
                      </div>
                      <div className="flex justify-between font-medium">
                        <span>Total</span>
                        <span className="text-primary">{formatCurrency(order.total_price)}</span>
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>

              {(order.note || order.seller_notes) && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Notes</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    {order.note && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Customer Note</p>
                        <p>{order.note}</p>
                      </div>
                    )}
                    {order.seller_notes && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Seller Notes (internal)</p>
                        <p>{order.seller_notes}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* AI Order Helper */}
              <Card>
                <CardContent className="pt-4">
                  <AIOrderHelper
                    order={{
                      orderNumber: formatOrderNumber(order.order_number),
                      customerName: order.customer_name,
                      customerPhone: order.customer_phone,
                      status: order.status,
                      totalPrice: order.total_price,
                      location: order.location,
                      preferredDate: order.preferred_date,
                      pickupTime: order.pickup_time || order.pickup_time_window,
                      items: order.items,
                      sellerName: profile?.seller_name,
                    }}
                  />
                </CardContent>
              </Card>
            </div>

            {/* Right column — actions */}
            <div className="space-y-3">
              {/* WhatsApp Quick Messages */}
              <WhatsAppQuickMessages
                order={order as any}
                sellerName={profile?.seller_name}
                openKey={quickMsgKey}
                onOpenChange={setQuickMsgKey}
              />

              {/* Primary actions — always visible */}
              {order.status !== "completed" && order.status !== "cancelled" && (
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    className="h-11"
                    onClick={() => handleStatusChange("completed")}
                  >
                    <CheckCircle className="h-4 w-4 mr-1.5" />
                    Mark Completed
                  </Button>
                  <Button
                    className="h-11"
                    variant="secondary"
                    onClick={() => setQuickMsgKey("confirm")}
                    disabled={!order.customer_phone}
                  >
                    <Send className="h-4 w-4 mr-1.5" />
                    Message
                  </Button>
                </div>
              )}

              {order.shopify_draft_order_id && (
                <Button
                  variant="outline"
                  className="w-full h-11 border-dashed"
                  asChild
                >
                  <a
                    href={`https://lovable-project-yf43m.myshopify.com/admin/draft_orders/${order.shopify_draft_order_id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink className="h-4 w-4 mr-2 text-primary" />
                    Open Shopify Draft
                  </a>
                </Button>
              )}

              {/* Shopify status badges strip (compact) */}
              {(order.shopify_sync_status || order.shopify_draft_order_name) && (
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground px-1">
                  {order.shopify_sync_status && (
                    <Badge variant="outline" className="text-[10px]">
                      Shopify: {String(order.shopify_sync_status).replace(/_/g, " ")}
                    </Badge>
                  )}
                  {order.shopify_draft_order_name && (
                    <span className="font-mono">{order.shopify_draft_order_name}</span>
                  )}
                </div>
              )}

              {/* More options toggle */}
              <button
                type="button"
                onClick={() => setMoreOpen(!moreOpen)}
                className="w-full flex items-center justify-center gap-2 py-2.5 text-xs text-muted-foreground hover:text-foreground transition-colors touch-manipulation"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
                {moreOpen ? "Fewer options" : "More options"}
              </button>

              {moreOpen && (
                <Card>
                  <CardContent className="p-0">
                    <div className="divide-y divide-border">
                      {order.status === "pending" && (
                        <button
                          type="button"
                          onClick={() => handleStatusChange("confirmed")}
                          className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left hover:bg-accent touch-manipulation"
                        >
                          <CheckCircle className="h-4 w-4 text-blue-400" />
                          Confirm Order
                        </button>
                      )}
                      {order.status !== "no-show" && order.status !== "completed" && (
                        <button
                          type="button"
                          onClick={() => handleStatusChange("no-show")}
                          className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left hover:bg-accent touch-manipulation"
                        >
                          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                          Mark No-Show
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={openReschedule}
                        disabled={order.status === "cancelled" || order.status === "completed"}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left hover:bg-accent disabled:opacity-50 touch-manipulation"
                      >
                        <CalendarClock className="h-4 w-4 text-amber-400" />
                        Reschedule
                      </button>
                      <button
                        type="button"
                        onClick={addToCalendar}
                        disabled={addingToCalendar}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left hover:bg-accent disabled:opacity-50 touch-manipulation"
                      >
                        <CalendarPlus className="h-4 w-4" />
                        {addingToCalendar ? "Adding..." : "Add to Calendar"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditDialogOpen(true)}
                        disabled={!isEditable}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left hover:bg-accent disabled:opacity-50 touch-manipulation"
                      >
                        <Pencil className="h-4 w-4" />
                        Edit Order
                      </button>
                      <button
                        type="button"
                        onClick={toggleArchive}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left hover:bg-accent touch-manipulation"
                      >
                        <Archive className="h-4 w-4" />
                        Archive Order
                      </button>
                      {order.status !== "cancelled" && order.status !== "completed" && (
                        <button
                          type="button"
                          onClick={() => handleStatusChange("cancelled")}
                          className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left text-destructive hover:bg-accent touch-manipulation"
                        >
                          <XCircle className="h-4 w-4" />
                          Cancel Order
                        </button>
                      )}
                      {canDelete && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button
                              type="button"
                              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left text-destructive hover:bg-accent touch-manipulation"
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete Order
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Order?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete the order
                                and all its items.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                    {/* Full Shopify actions (resync, request completion, etc.) */}
                    <div className="p-3 border-t border-border">
                      <OrderShopifyActions order={order as any} onChanged={refetch} />
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </main>
      </div>


      <EditOrderDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        order={order}
        onSave={refetch}
      />
      <SellerAIPanel defaultMode="order" />

      <Dialog open={rescheduleOpen} onOpenChange={setRescheduleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reschedule pickup</DialogTitle>
            <DialogDescription>
              Pick a new date (and optional time) for this order. The Google Calendar event will
              be updated to match — same order, new day.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="reschedule-date">New date</Label>
              <Input
                id="reschedule-date"
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reschedule-time">New time (optional)</Label>
              <Input
                id="reschedule-time"
                type="time"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to make it an all-day calendar event.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRescheduleOpen(false)} disabled={rescheduling}>
              Cancel
            </Button>
            <Button onClick={handleReschedule} disabled={rescheduling || !newDate}>
              {rescheduling ? "Rescheduling..." : "Confirm reschedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
