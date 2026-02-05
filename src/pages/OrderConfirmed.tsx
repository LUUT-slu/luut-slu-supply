import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { CheckCircle2, MessageCircle, ShoppingBag, MapPin, Calendar, Package } from "lucide-react";
import { Button } from "@/components/ui/button";

interface OrderConfirmationData {
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
  note?: string;
  timestamp: number;
}

export default function OrderConfirmed() {
  const navigate = useNavigate();
  const [orderData, setOrderData] = useState<OrderConfirmationData | null>(null);
  const [whatsappOpened, setWhatsappOpened] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("luut-order-confirmed");
    if (!stored) {
      navigate("/my-orders");
      return;
    }

    try {
      const parsed = JSON.parse(stored) as OrderConfirmationData;
      // Only use if less than 1 hour old
      if (Date.now() - parsed.timestamp > 3600000) {
        localStorage.removeItem("luut-order-confirmed");
        navigate("/my-orders");
        return;
      }

      setOrderData(parsed);

      // Auto-open WhatsApp on fresh page load (better popup success rate)
      setTimeout(() => {
        const popup = window.open(parsed.whatsappUrl, "_blank");
        if (popup) {
          setWhatsappOpened(true);
        }
      }, 500);
    } catch {
      navigate("/my-orders");
    }
  }, [navigate]);

  const handleOpenWhatsApp = () => {
    if (!orderData) return;
    window.open(orderData.whatsappUrl, "_blank");
    setWhatsappOpened(true);
  };

  if (!orderData) {
    return null;
  }

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

          {/* WhatsApp CTA - The most important element */}
          <div className="rounded-xl border-2 border-primary bg-primary/5 p-6 space-y-4">
            <div className="text-center space-y-2">
              <h2 className="font-display text-lg font-semibold">
                Send your order to {orderData.sellerName}
              </h2>
              <p className="text-sm text-muted-foreground">
                {whatsappOpened
                  ? "WhatsApp should have opened. Tap the button below if it didn't."
                  : "Tap the button below to send your order details via WhatsApp. This confirms your meetup."}
              </p>
            </div>

            <Button
              onClick={handleOpenWhatsApp}
              className="w-full gap-2 text-base"
              size="lg"
            >
              <MessageCircle className="h-5 w-5" />
              {whatsappOpened ? "Open WhatsApp Again" : "Message Seller on WhatsApp"}
            </Button>
          </div>

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
    </div>
  );
}
