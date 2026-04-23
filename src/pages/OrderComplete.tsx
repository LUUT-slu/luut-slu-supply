import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { CheckCircle2, MessageCircle, ShoppingBag, ArrowRight, Store } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const FALLBACK_WHATSAPP_NUMBER = "17587185478";

interface PendingOrderData {
  customerName: string;
  location: string;
  preferredDate: string;
  note?: string;
  items: Array<{
    title: string;
    quantity: number;
    price: string;
    vendor?: string;
  }>;
  totalPrice: number;
  timestamp: number;
  sellerVendor?: string;
  sellerWhatsApp?: string;
}

export default function OrderComplete() {
  const [orderData, setOrderData] = useState<PendingOrderData | null>(null);
  const [whatsappOpened, setWhatsappOpened] = useState(false);
  const [sellerWhatsApp, setSellerWhatsApp] = useState<string>(FALLBACK_WHATSAPP_NUMBER);

  // Look up seller's WhatsApp number from their profile
  const getSellerWhatsApp = async (vendorName: string): Promise<string> => {
    try {
      const { data: contactRows } = await supabase
        .rpc('rpc_get_seller_contact', { p_seller_name: vendorName });
      const sellerProfile = Array.isArray(contactRows) ? contactRows[0] : null;

      if (sellerProfile?.whatsapp) {
        return sellerProfile.whatsapp.replace(/[\s\-\(\)]/g, '');
      }
      
      if (sellerProfile?.phone) {
        return sellerProfile.phone.replace(/[\s\-\(\)]/g, '');
      }

      return FALLBACK_WHATSAPP_NUMBER;
    } catch (error) {
      console.error("Error fetching seller WhatsApp:", error);
      return FALLBACK_WHATSAPP_NUMBER;
    }
  };

  useEffect(() => {
    // Retrieve pending order data from localStorage
    const pendingData = localStorage.getItem("luut-pending-order");
    if (pendingData) {
      try {
        const parsed = JSON.parse(pendingData) as PendingOrderData;
        // Only use if less than 1 hour old
        if (Date.now() - parsed.timestamp < 3600000) {
          setOrderData(parsed);
          
          // Determine seller WhatsApp
          const vendorName = parsed.sellerVendor || parsed.items[0]?.vendor || '';
          
          if (parsed.sellerWhatsApp) {
            setSellerWhatsApp(parsed.sellerWhatsApp);
          } else if (vendorName) {
            getSellerWhatsApp(vendorName).then(setSellerWhatsApp);
          }
          
          // Auto-open WhatsApp after a short delay
          setTimeout(() => {
            openWhatsApp(parsed, parsed.sellerWhatsApp || sellerWhatsApp);
            setWhatsappOpened(true);
          }, 1000);
        }
        // Clear the pending order data
        localStorage.removeItem("luut-pending-order");
      } catch (e) {
        console.error("Failed to parse pending order data:", e);
      }
    }
  }, []);

  const openWhatsApp = (data: PendingOrderData, whatsAppNumber?: string) => {
    const itemsList = data.items
      .map(item => `• ${item.title}${item.quantity > 1 ? ` ×${item.quantity}` : ''} - EC$${parseFloat(item.price).toFixed(2)}`)
      .join('\n');

    const message = encodeURIComponent(
      `🛒 *NEW ORDER - Shopify Checkout Complete*\n\n` +
      `👤 Customer: ${data.customerName}\n` +
      `📍 Meetup Location: ${data.location}\n` +
      `📅 Preferred Date: ${data.preferredDate}\n` +
      `${data.note ? `📝 Note: ${data.note}\n` : ''}` +
      `\n*Items:*\n${itemsList}\n\n` +
      `💰 Total: EC$${data.totalPrice.toFixed(2)}\n\n` +
      `💳 Payment: Pay on pickup\n\n` +
      `Please confirm the meetup time. Thank you!`
    );

    const numberToUse = whatsAppNumber || sellerWhatsApp || FALLBACK_WHATSAPP_NUMBER;
    window.open(`https://wa.me/${numberToUse}?text=${message}`, '_blank');
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      
      <main className="flex-1">
        <div className="container max-w-2xl py-12 px-4">
          <div className="text-center">
            <div className="mb-6 flex justify-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
                <CheckCircle2 className="h-10 w-10 text-primary" />
              </div>
            </div>

            <h1 className="font-display text-3xl mb-2">Order Complete!</h1>
            <p className="text-muted-foreground mb-8">
              Thank you for your order. Your payment has been processed.
            </p>

            {orderData ? (
              <div className="space-y-6">
                {/* Seller indicator */}
                {orderData.sellerVendor && (
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Store className="h-4 w-4" />
                    <span>Order from <span className="font-medium text-foreground">{orderData.sellerVendor}</span></span>
                  </div>
                )}

                {/* Order Summary */}
                <div className="rounded-lg border border-border bg-card p-6 text-left">
                  <h2 className="font-semibold mb-4">Order Details</h2>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Customer</span>
                      <span>{orderData.customerName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Meetup Location</span>
                      <span>{orderData.location}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Preferred Date</span>
                      <span>{orderData.preferredDate}</span>
                    </div>
                    {orderData.note && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Note</span>
                        <span className="text-right max-w-[200px]">{orderData.note}</span>
                      </div>
                    )}
                    <div className="border-t border-border pt-3 mt-3">
                      {orderData.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between py-1">
                          <span className="truncate flex-1 pr-2">
                            {item.title} {item.quantity > 1 && `×${item.quantity}`}
                          </span>
                          <span>EC${parseFloat(item.price).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="border-t border-border pt-3 mt-3 flex justify-between font-semibold">
                      <span>Total</span>
                      <span className="text-primary">EC${orderData.totalPrice.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* WhatsApp Section */}
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-6">
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <MessageCircle className="h-5 w-5 text-primary" />
                    Message {orderData.sellerVendor || 'Seller'} on WhatsApp
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {whatsappOpened 
                      ? "WhatsApp should have opened. Tap Send to confirm your order details."
                      : "Send your order details via WhatsApp to confirm the meetup time."
                    }
                  </p>
                  <Button 
                    onClick={() => openWhatsApp(orderData, sellerWhatsApp)}
                    className="w-full gap-2"
                    size="lg"
                  >
                    <MessageCircle className="h-5 w-5" />
                    {whatsappOpened ? "Open WhatsApp Again" : "Message Seller on WhatsApp"}
                  </Button>
                </div>

                {/* Next Steps */}
                <div className="rounded-lg border border-border bg-card p-6 text-left">
                  <h3 className="font-semibold mb-3">What's Next?</h3>
                  <ol className="text-sm space-y-2 text-muted-foreground list-decimal list-inside">
                    <li>Send the WhatsApp message to confirm your order</li>
                    <li>The seller will confirm the exact meetup time and spot</li>
                    <li>Meet at {orderData.location} on your preferred date</li>
                    <li>Pay on pickup and collect your items</li>
                  </ol>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="rounded-lg border border-border bg-card p-6">
                  <p className="text-muted-foreground mb-4">
                    If you just completed a Shopify checkout, your order has been received.
                    You can message us on WhatsApp to confirm your meetup details.
                  </p>
                  <Button 
                    onClick={() => window.open(`https://wa.me/${FALLBACK_WHATSAPP_NUMBER}?text=${encodeURIComponent("Hi! I just completed a Shopify checkout and would like to arrange a meetup.")}`, '_blank')}
                    variant="outline"
                    className="gap-2"
                  >
                    <MessageCircle className="h-5 w-5" />
                    Contact on WhatsApp
                  </Button>
                </div>
              </div>
            )}

            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/shop">
                <Button variant="outline" className="gap-2 w-full sm:w-auto">
                  <ShoppingBag className="h-5 w-5" />
                  Continue Shopping
                </Button>
              </Link>
              <Link to="/">
                <Button variant="ghost" className="gap-2 w-full sm:w-auto">
                  <ArrowRight className="h-5 w-5" />
                  Back to Home
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}