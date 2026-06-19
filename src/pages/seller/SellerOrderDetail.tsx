import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AIOrderHelper } from "@/components/seller/AIOrderHelper";
import { SellerAIPanel } from "@/components/seller/SellerAIPanel";
import { useParams, useNavigate } from "react-router-dom";

import { SellerNav } from "@/components/seller/SellerNav";
import { useSellerProfile } from "@/hooks/useSellerProfile";
import { useSellerOrders, ORDER_STATUSES, OrderStatus } from "@/hooks/useSellerOrders";
import { EditOrderDialog } from "@/components/seller/EditOrderDialog";
import { OrderShopifyActions } from "@/components/orders/OrderShopifyActions";
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
} from "lucide-react";
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
    const message = `Hi ${order.customer_name}! This is ${profile?.seller_name || "your seller"} regarding your order ${orderNum}.\n\n📦 Items: ${items}\n📍 Pickup: ${order.location}\n📅 Date: ${displayDate(order.preferred_date)}${order.pickup_time || order.pickup_time_window ? `\n🕐 Time: ${order.pickup_time || order.pickup_time_window}` : ""}\n💰 Total: ${formatCurrency(order.total_price)}\n\nLet me know if you have any questions!`;
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
    await updateOrderStatus(order.id, newStatus as OrderStatus);

    // Trigger email on status change
    if (newStatus === "confirmed" || newStatus === "completed") {
      const emailType = newStatus === "confirmed" ? "order_confirmed" : "order_ready";
      supabase.functions.invoke("send-order-email", {
        body: { orderId: order.id, type: emailType },
      }).catch(err => console.error("Email trigger error:", err));
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
          <main className="container flex-1 py-6">
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
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

          <div className="mb-6">
            <OrderShopifyActions order={order as any} onChanged={refetch} />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Customer Info
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <p className="font-medium">{order.customer_name}</p>
                      {order.customer_phone && (
                        <p className="text-sm text-muted-foreground">{order.customer_phone}</p>
                      )}
                    </div>
                    {order.customer_phone && (
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={callCustomer} className="flex-1">
                          <Phone className="h-4 w-4 mr-1" />
                          Call
                        </Button>
                        <Button size="sm" variant="outline" onClick={messageCustomer} className="flex-1">
                          <MessageCircle className="h-4 w-4 mr-1" />
                          WhatsApp
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Pickup Info
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <span>{order.location}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>{displayDate(order.preferred_date)}</span>
                    </div>
                    {(order.pickup_time || order.pickup_time_window) && (
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>{order.pickup_time || order.pickup_time_window}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Order Items */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Order Items</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {order.items.map((item) => (
                      <div key={item.id} className="flex items-center gap-4">
                        {item.product_image_url ? (
                          <img
                            src={item.product_image_url}
                            alt={item.product_name}
                            className="h-16 w-16 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center">
                            <Package className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm line-clamp-1">{item.product_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatCurrency(item.unit_price)} × {item.quantity}
                          </p>
                        </div>
                        <p className="font-medium">{formatCurrency(item.total_price)}</p>
                      </div>
                    ))}
                  </div>

                  <Separator className="my-4" />

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>{formatCurrency(itemsTotal)}</span>
                    </div>
                    <div className="flex justify-between font-medium text-lg">
                      <span>Total</span>
                      <span className="text-primary">{formatCurrency(order.total_price)}</span>
                    </div>
                  </div>
                </CardContent>
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

            {/* Sidebar Actions */}
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {order.status === "pending" && (
                    <Button
                      className="w-full justify-start"
                      variant="outline"
                      onClick={() => handleStatusChange("confirmed")}
                    >
                      <CheckCircle className="h-4 w-4 mr-2 text-blue-400" />
                      Confirm Order
                    </Button>
                  )}

                  {(order.status === "pending" || order.status === "confirmed") && (
                    <Button
                      className="w-full justify-start"
                      variant="outline"
                      onClick={() => handleStatusChange("completed")}
                    >
                      <CheckCircle className="h-4 w-4 mr-2 text-green-400" />
                      Mark Completed
                    </Button>
                  )}

                  {order.status !== "cancelled" && order.status !== "completed" && (
                    <Button
                      className="w-full justify-start"
                      variant="outline"
                      onClick={() => handleStatusChange("cancelled")}
                    >
                      <XCircle className="h-4 w-4 mr-2 text-red-400" />
                      Cancel Order
                    </Button>
                  )}

                  {order.status !== "no-show" && order.status !== "completed" && (
                    <Button
                      className="w-full justify-start"
                      variant="outline"
                      onClick={() => handleStatusChange("no-show")}
                    >
                      <AlertTriangle className="h-4 w-4 mr-2 text-muted-foreground" />
                      Mark No-Show
                    </Button>
                  )}

                  <Separator className="my-2" />

                  <Button
                    className="w-full justify-start"
                    variant="outline"
                    onClick={messageCustomer}
                    disabled={!order.customer_phone}
                  >
                    <MessageCircle className="h-4 w-4 mr-2" />
                    Message Customer
                  </Button>

                  <Button
                    className="w-full justify-start"
                    variant="outline"
                    onClick={addToCalendar}
                    disabled={addingToCalendar}
                  >
                    <CalendarPlus className="h-4 w-4 mr-2" />
                    {addingToCalendar ? "Adding..." : "Add to Calendar"}
                  </Button>

                  <Button
                    className="w-full justify-start"
                    variant="outline"
                    onClick={() => setEditDialogOpen(true)}
                    disabled={!isEditable}
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit Order
                  </Button>

                  <Button
                    className="w-full justify-start"
                    variant="outline"
                    onClick={toggleArchive}
                  >
                    <Archive className="h-4 w-4 mr-2" />
                    Archive Order
                  </Button>

                  {canDelete && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button className="w-full justify-start" variant="destructive">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete Order
                        </Button>
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
                </CardContent>
              </Card>

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
    </>
  );
}
