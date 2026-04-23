import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { BackButton } from "@/components/BackButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
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
  Package, 
  Clock, 
  CheckCircle, 
  XCircle, 
  MapPin, 
  Calendar,
  User,
  Phone,
  MessageSquare,
  Loader2,
  Edit2,
  Save,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { format, parse } from "date-fns";
import { cn } from "@/lib/utils";

const MEETUP_LOCATIONS = ["Castries", "Gros Islet", "Vieux Fort"];
const WHATSAPP_NUMBER = "17587185478";

interface Order {
  id: string;
  order_number: number;
  customer_name: string;
  customer_phone: string | null;
  location: string;
  preferred_date: string;
  note: string | null;
  status: string;
  total_price: number;
  currency_code: string;
  line_items: Array<{
    title: string;
    quantity: number;
    price: string;
    image_url?: string;
  }>;
  created_at: string;
  updated_at: string;
  order_token: string;
  cancelled_at: string | null;
}

const statusConfig: Record<string, { label: string; icon: typeof Clock; color: string; bgColor: string }> = {
  pending: { label: "Pending", icon: Clock, color: "text-yellow-500", bgColor: "bg-yellow-500" },
  confirmed: { label: "Confirmed", icon: CheckCircle, color: "text-blue-500", bgColor: "bg-blue-500" },
  completed: { label: "Completed", icon: CheckCircle, color: "text-green-500", bgColor: "bg-green-500" },
  cancelled: { label: "Cancelled", icon: XCircle, color: "text-red-500", bgColor: "bg-red-500" },
};

export default function OrderDetails() {
  const { orderId } = useParams<{ orderId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  
  // Edit state
  const [editLocation, setEditLocation] = useState('');
  const [editDate, setEditDate] = useState<Date>();
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Get token from URL or localStorage
  const urlToken = searchParams.get('token');
  const storedTokens = JSON.parse(localStorage.getItem("luut-order-tokens") || "{}");
  const orderToken = urlToken || storedTokens[orderId || ''];

  useEffect(() => {
    const fetchOrder = async () => {
      if (!orderId) {
        setLoading(false);
        return;
      }

      // Fetch order via secure token-based RPC (or direct read for logged-in customer/admin)
      let data: any = null;
      let error: any = null;

      if (orderToken) {
        const res = await supabase.rpc("rpc_get_order_by_token", {
          p_order_id: orderId,
          p_token: orderToken,
        });
        data = Array.isArray(res.data) ? res.data[0] : res.data;
        error = res.error;
      } else {
        // Authenticated customer/admin/seller path (RLS will gate access)
        const res = await supabase
          .from("orders")
          .select("*")
          .eq("id", orderId)
          .maybeSingle();
        data = res.data;
        error = res.error;
      }

      if (error || !data) {
        if (error) console.error("Failed to fetch order:", error);
        toast.error("Order not found");
      } else {
        setOrder(data as unknown as Order);
        setEditLocation(data.location);
        // Parse the date string back to Date object
        try {
          const parsedDate = parse(data.preferred_date, 'EEEE, MMMM d, yyyy', new Date());
          if (!isNaN(parsedDate.getTime())) {
            setEditDate(parsedDate);
          }
        } catch (e) {
          console.error("Could not parse date:", data.preferred_date);
        }
      }
      setLoading(false);
    };

    fetchOrder();
  }, [orderId]);

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

  const canModifyOrder = order && (order.status === 'pending' || order.status === 'confirmed');

  const handleCancelOrder = async () => {
    if (!order || !orderToken) {
      toast.error("Cannot cancel order - missing access token");
      return;
    }

    setIsCancelling(true);

    try {
      const { data, error } = await supabase.functions.invoke('update-order', {
        body: {
          orderId: order.id,
          orderToken,
          action: 'cancel',
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to cancel order');

      setOrder({ ...order, status: 'cancelled', cancelled_at: new Date().toISOString() });

      // Fire-and-forget admin alert: order cancelled by customer
      supabase.functions.invoke("send-admin-alert", {
        body: {
          type: "order_status_change",
          payload: {
            order_id: order.id,
            order_number: order.order_number,
            new_status: "CANCELLED",
            customer_name: order.customer_name,
            reason: "Cancelled by customer",
          },
        },
      }).catch(() => {});

      toast.success("Order cancelled", {
        description: "Opening WhatsApp to notify the seller...",
      });

      // Open WhatsApp to notify seller
      if (data.merchantWhatsAppUrl) {
        window.open(data.merchantWhatsAppUrl, '_blank');
      }

    } catch (error) {
      console.error("Cancel error:", error);
      toast.error("Failed to cancel order", {
        description: error instanceof Error ? error.message : "Please try again",
      });
    } finally {
      setIsCancelling(false);
    }
  };

  const handleSaveChanges = async () => {
    if (!order || !orderToken || !editDate) return;

    setIsSaving(true);

    try {
      const formattedDate = format(editDate, 'EEEE, MMMM d, yyyy');
      
      const { data, error } = await supabase.functions.invoke('update-order', {
        body: {
          orderId: order.id,
          orderToken,
          action: 'update',
          location: editLocation,
          preferredDate: formattedDate,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to update order');

      setOrder({ 
        ...order, 
        location: editLocation,
        preferred_date: formattedDate,
      });
      setIsEditing(false);
      
      toast.success("Order updated", {
        description: "Opening WhatsApp to notify the seller...",
      });

      // Open WhatsApp to notify seller
      if (data.merchantWhatsAppUrl) {
        window.open(data.merchantWhatsAppUrl, '_blank');
      }

    } catch (error) {
      console.error("Update error:", error);
      toast.error("Failed to update order", {
        description: error instanceof Error ? error.message : "Please try again",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <main className="container flex-1 py-8">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <main className="container flex-1 py-8">
          <div className="mb-6 flex items-center gap-4">
            <BackButton />
            <h1 className="font-display text-3xl">Order Not Found</h1>
          </div>
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Package className="mb-4 h-16 w-16 text-muted-foreground" />
              <h3 className="mb-2 text-xl font-medium">Order not found</h3>
              <p className="mb-6 max-w-sm text-muted-foreground">
                We couldn't find this order. It may have been deleted or the link is invalid.
              </p>
              <Button onClick={() => navigate('/my-orders')}>
                View My Orders
              </Button>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  const StatusIcon = statusConfig[order.status]?.icon || Clock;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      
      <main className="container flex-1 py-8 px-4">
        <div className="mb-6">
          <div className="flex flex-wrap items-start gap-3">
            <BackButton />
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-2xl sm:text-3xl">{formatOrderNumber(order.order_number)}</h1>
                <Badge variant="outline" className="gap-1">
                  <span className={`h-2 w-2 rounded-full ${statusConfig[order.status]?.bgColor}`} />
                  {statusConfig[order.status]?.label}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">Placed on {formatDate(order.created_at)}</p>
            </div>
            {canModifyOrder && orderToken && !isEditing && (
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} className="shrink-0">
                <Edit2 className="mr-2 h-4 w-4" />
                Edit
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Order Items */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Order Items
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {order.line_items.map((item, i) => (
                <div key={i} className="flex items-center gap-4 rounded-lg border border-border p-3">
                  {item.image_url && (
                    <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-md bg-muted">
                      <img src={item.image_url} alt={item.title} className="h-full w-full object-cover" />
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="font-medium">{item.title}</p>
                    <p className="text-sm text-muted-foreground">Qty: {item.quantity}</p>
                  </div>
                  <span className="font-semibold">EC${parseFloat(item.price).toFixed(2)}</span>
                </div>
              ))}
              
              <div className="border-t border-border pt-4 flex justify-between">
                <span className="text-lg font-semibold">Total</span>
                <span className="font-display text-2xl text-primary">
                  EC${order.total_price.toFixed(2)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Order Details / Edit Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Meetup Details
                </span>
                {isEditing && (
                  <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isEditing ? (
                <>
                  {/* Edit Location */}
                  <div className="space-y-2">
                    <Label>Meetup Location</Label>
                    <RadioGroup value={editLocation} onValueChange={setEditLocation} className="space-y-2">
                      {MEETUP_LOCATIONS.map((location) => (
                        <div
                          key={location}
                          className={cn(
                            "flex items-center space-x-3 rounded-lg border p-3 cursor-pointer transition-colors",
                            editLocation === location
                              ? "border-primary bg-primary/5"
                              : "border-border hover:bg-muted/50"
                          )}
                          onClick={() => setEditLocation(location)}
                        >
                          <RadioGroupItem value={location} id={`edit-${location}`} />
                          <Label htmlFor={`edit-${location}`} className="cursor-pointer flex-1">
                            {location}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>

                  {/* Edit Date */}
                  <div className="space-y-2">
                    <Label>Preferred Date</Label>
                    <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left">
                          <Calendar className="mr-2 h-4 w-4" />
                          {editDate ? format(editDate, "EEEE, MMMM d, yyyy") : "Select a date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={editDate}
                          onSelect={(date) => {
                            setEditDate(date);
                            setCalendarOpen(false);
                          }}
                          disabled={(date) => date < today}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <Button onClick={handleSaveChanges} className="w-full" disabled={isSaving}>
                    {isSaving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save & Notify Seller
                      </>
                    )}
                  </Button>
                </>
              ) : (
                <>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <User className="h-4 w-4 text-muted-foreground mt-1" />
                      <div>
                        <p className="text-sm text-muted-foreground">Customer</p>
                        <p className="font-medium">{order.customer_name}</p>
                      </div>
                    </div>
                    
                    {order.customer_phone && (
                      <div className="flex items-start gap-3">
                        <Phone className="h-4 w-4 text-muted-foreground mt-1" />
                        <div>
                          <p className="text-sm text-muted-foreground">Phone</p>
                          <p className="font-medium">{order.customer_phone}</p>
                        </div>
                      </div>
                    )}
                    
                    <div className="flex items-start gap-3">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-1" />
                      <div>
                        <p className="text-sm text-muted-foreground">Location</p>
                        <p className="font-medium">{order.location}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-3">
                      <Calendar className="h-4 w-4 text-muted-foreground mt-1" />
                      <div>
                        <p className="text-sm text-muted-foreground">Preferred Date</p>
                        <p className="font-medium">{order.preferred_date}</p>
                      </div>
                    </div>
                    
                    {order.note && (
                      <div className="flex items-start gap-3">
                        <MessageSquare className="h-4 w-4 text-muted-foreground mt-1" />
                        <div>
                          <p className="text-sm text-muted-foreground">Note</p>
                          <p className="font-medium">{order.note}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {order.status === 'cancelled' && order.cancelled_at && (
                    <div className="rounded-lg bg-destructive/10 p-3 mt-4">
                      <p className="text-sm text-destructive">
                        Cancelled on {formatDate(order.cancelled_at)}
                      </p>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        {canModifyOrder && orderToken && !isEditing && (
          <Card className="mt-6">
            <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4">
              <div>
                <p className="font-medium">Need to cancel this order?</p>
                <p className="text-sm text-muted-foreground">
                  The seller will be notified automatically via WhatsApp
                </p>
              </div>
              
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={isCancelling}>
                    {isCancelling ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Cancelling...
                      </>
                    ) : (
                      <>
                        <XCircle className="mr-2 h-4 w-4" />
                        Cancel Order
                      </>
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancel Order {formatOrderNumber(order.order_number)}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will cancel your order and notify the seller. Any deposit may be non-refundable per the deposit policy.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep Order</AlertDialogCancel>
                    <AlertDialogAction onClick={handleCancelOrder} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Yes, Cancel Order
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        )}

        {/* Contact */}
        <Card className="mt-6">
          <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4">
            <div>
              <p className="font-medium">Have questions about your order?</p>
              <p className="text-sm text-muted-foreground">
                Contact us directly on WhatsApp
              </p>
            </div>
            <Button 
              variant="outline"
              onClick={() => {
                const message = `Hi, I have a question about order ${formatOrderNumber(order.order_number)}`;
                window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`, '_blank');
              }}
            >
              <MessageSquare className="mr-2 h-4 w-4" />
              Message on WhatsApp
            </Button>
          </CardContent>
        </Card>
      </main>

      <Footer />
    </div>
  );
}
