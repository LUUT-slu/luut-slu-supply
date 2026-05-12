import { useEffect, useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { CheckCircle2, MessageCircle, ShoppingBag, MapPin, Calendar, Package, Clock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { WhatsAppConfirmPopup } from "@/components/order/WhatsAppConfirmPopup";

interface OrderConfirmationData {
  orderId?: string;
  orderToken?: string;
  orderName: string;
  sellerName: string;
  sellerWhatsApp: string;
  whatsappUrl: string;
  whatsappMessage: string;
  customerName: string;
  customerPhone: string;
  items: Array<{
    title: string;
    quantity: number;
    price: string;
    vendor?: string;
  }>;
  totalPrice: number;
  location: string;
  preferredDate: string;
  pickupTime?: string;
  note?: string;
  source?: string;
  isPos?: boolean;
  timestamp: number;
}

export default function OrderConfirmed() {
  const navigate = useNavigate();
  const [orderData, setOrderData] = useState<OrderConfirmationData | null>(null);
  const [whatsappOpened, setWhatsappOpened] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [popupOpen, setPopupOpen] = useState(false);
  const didShowPopup = useRef(false);

  useEffect(() => {
    const stored = localStorage.getItem("luut-order-confirmed");
    if (!stored) {
      setLoaded(true);
      navigate("/my-orders", { replace: true });
      return;
    }

    try {
      const parsed = JSON.parse(stored) as OrderConfirmationData;
      if (Date.now() - parsed.timestamp > 3600000) {
        localStorage.removeItem("luut-order-confirmed");
        setLoaded(true);
        navigate("/my-orders", { replace: true });
        return;
      }

      setOrderData(parsed);
      setLoaded(true);
      localStorage.removeItem("luut-order-confirmed");

      const isPos = parsed.isPos || parsed.source === "pos";
      if (!isPos && !didShowPopup.current) {
        didShowPopup.current = true;
        setTimeout(() => setPopupOpen(true), 400);
      }
    } catch {
      localStorage.removeItem("luut-order-confirmed");
      setLoaded(true);
      navigate("/my-orders", { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const markWhatsappOpened = async () => {
    if (!orderData?.orderId || !orderData?.orderToken) return;
    try {
      await supabase.rpc("rpc_mark_whatsapp_opened", {
        p_order_id: orderData.orderId,
        p_token: orderData.orderToken,
      });
    } catch (e) {
      console.error("Failed to mark whatsapp opened:", e);
    }
  };

  const handleOpenWhatsApp = () => {
    if (!orderData) return;
    window.open(orderData.whatsappUrl, "_blank");
    setWhatsappOpened(true);
    setPopupOpen(false);
    markWhatsappOpened();
  };

  if (!loaded || !orderData) return null;

  const isPos = orderData.isPos || orderData.source === "pos";
  const showPendingBanner = !isPos && !whatsappOpened;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="flex flex-1 flex-col items-center justify-start px-4 py-8">
        <div className="w-full max-w-md space-y-6">
          {/* Success Header */}
          <div className="text-center space-y-3">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <CheckCircle2 className="h-8 w-8 text-primary" />
            </div>
            <h1 className="font-display text-2xl">Order Created!</h1>
            <p className="text-lg font-semibold text-primary">{orderData.orderName}</p>
          </div>

          {/* Pending WhatsApp Confirmation Banner */}
          {showPendingBanner && (
            <div className="rounded-xl border-2 border-primary bg-primary/5 p-4 space-y-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <p className="text-sm">
                  Your order is not fully confirmed yet. Tap below to confirm on WhatsApp.
                </p>
              </div>
              <Button
                onClick={handleOpenWhatsApp}
                className="w-full gap-2 h-12"
                size="lg"
              >
                <MessageCircle className="h-5 w-5" />
                Confirm on WhatsApp
              </Button>
            </div>
          )}

          {whatsappOpened && (
            <div className="rounded-xl border border-border bg-card p-4 text-center text-sm text-muted-foreground">
              WhatsApp opened — please send the message to lock in your meetup.
              <Button
                onClick={handleOpenWhatsApp}
                variant="outline"
                size="sm"
                className="w-full gap-2 mt-3"
              >
                <MessageCircle className="h-4 w-4" />
                Open WhatsApp Again
              </Button>
            </div>
          )}

          {/* Order Summary */}
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <h3 className="font-semibold text-sm">Order Summary</h3>
            <div className="space-y-2">
              {orderData.items.map((item, idx) => (
                <div key={idx} className="flex items-start gap-2 text-sm">
                  <Package className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <span className="flex-1 truncate">
                    {item.title}
                    {item.quantity > 1 && ` × ${item.quantity}`}
                  </span>
                  <span className="font-medium">
                    EC${(parseFloat(item.price) * item.quantity).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
            <div className="border-t border-border pt-2 flex justify-between font-semibold text-sm">
              <span>Total</span>
              <span className="text-primary">EC${orderData.totalPrice.toFixed(2)}</span>
            </div>
          </div>

          {/* Meetup Details */}
          <div className="rounded-lg border border-border bg-card p-4 space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary shrink-0" />
              <span>Meetup: <span className="font-medium">{orderData.location}</span></span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary shrink-0" />
              <span>Date: <span className="font-medium">{orderData.preferredDate}</span></span>
            </div>
            {orderData.pickupTime && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary shrink-0" />
                <span>Time: <span className="font-medium">{orderData.pickupTime}</span></span>
              </div>
            )}
            {orderData.note && (
              <p className="text-muted-foreground pl-6">Note: {orderData.note}</p>
            )}
          </div>

          {/* Secondary Actions */}
          <div className="flex flex-col gap-2 pt-2">
            <Link to="/my-orders" className="w-full">
              <Button variant="outline" className="w-full gap-2">
                View My Orders
              </Button>
            </Link>
            <Link to="/shop" className="w-full">
              <Button variant="ghost" className="w-full gap-2">
                <ShoppingBag className="h-4 w-4" />
                Continue Shopping
              </Button>
            </Link>
          </div>
        </div>
      </main>

      <WhatsAppConfirmPopup
        open={popupOpen}
        onOpenChange={setPopupOpen}
        onConfirm={handleOpenWhatsApp}
      />
    </div>
  );
}
