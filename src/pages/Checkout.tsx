import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  User,
  Phone,
  MapPin,
  Calendar,
  MessageSquare,
  AlertTriangle,
  Loader2,
  Check,
  Circle,
  Package,
  ShoppingBag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useCartStore } from "@/stores/cartStore";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const MEETUP_LOCATIONS = ["Castries", "Gros Islet", "Vieux Fort"];
const FALLBACK_WHATSAPP_NUMBER = "7587185478";

interface ChecklistItemProps {
  completed: boolean;
  label: string;
  children: React.ReactNode;
}

function ChecklistItem({ completed, label, children }: ChecklistItemProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {completed ? (
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary">
            <Check className="h-3 w-3 text-primary-foreground" />
          </div>
        ) : (
          <Circle className="h-5 w-5 text-muted-foreground" />
        )}
        <span className={cn(
          "font-body text-sm font-medium",
          completed ? "text-foreground" : "text-muted-foreground"
        )}>
          {label}
        </span>
      </div>
      <div className="ml-7">
        {children}
      </div>
    </div>
  );
}

function saveOrderToLocalStorage(orderId: string, orderToken: string) {
  const existingOrders = JSON.parse(localStorage.getItem("luut-my-orders") || "[]");
  const orderTokens = JSON.parse(localStorage.getItem("luut-order-tokens") || "{}");
  
  if (!existingOrders.includes(orderId)) {
    existingOrders.unshift(orderId);
    if (existingOrders.length > 50) {
      existingOrders.pop();
    }
    localStorage.setItem("luut-my-orders", JSON.stringify(existingOrders));
  }
  
  orderTokens[orderId] = orderToken;
  localStorage.setItem("luut-order-tokens", JSON.stringify(orderTokens));
}

export default function Checkout() {
  const navigate = useNavigate();
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [note, setNote] = useState('');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [depositAcknowledged, setDepositAcknowledged] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const orderCompletingRef = useRef(false);

  const {
    items,
    getTotalPrice,
    clearCart,
    getCurrentSeller,
  } = useCartStore();

  const totalPrice = getTotalPrice();
  const currentSeller = getCurrentSeller();

  // Redirect if cart is empty (skip during order completion)
  useEffect(() => {
    if (items.length === 0 && !orderCompletingRef.current) {
      navigate('/cart');
    }
  }, [items.length, navigate]);

  // Auto-fill customer info from profile
  useEffect(() => {
    const loadCustomerProfile = async () => {
      if (profileLoaded) return;
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('customer_profiles')
        .select('full_name, phone, preferred_location, meetup_notes')
        .eq('user_id', user.id)
        .single();

      if (profile) {
        if (profile.full_name && !customerName) {
          setCustomerName(profile.full_name);
        }
        if (profile.phone && !customerPhone) {
          setCustomerPhone(profile.phone);
        }
        if (profile.preferred_location && !selectedLocation && MEETUP_LOCATIONS.includes(profile.preferred_location)) {
          setSelectedLocation(profile.preferred_location);
        }
        if (profile.meetup_notes && !note) {
          setNote(profile.meetup_notes);
        }
        setProfileLoaded(true);
      }
    };

    loadCustomerProfile();
  }, [profileLoaded, customerName, customerPhone, selectedLocation, note]);

  // Validation
  const isNameValid = customerName.trim().length >= 2;
  const isPhoneValid = customerPhone.trim().length >= 7;
  const isLocationValid = selectedLocation !== '';
  const isDateValid = selectedDate !== undefined;
  const isDepositAcknowledged = depositAcknowledged;
  const isFormComplete = isNameValid && isPhoneValid && isLocationValid && isDateValid && isDepositAcknowledged;

  // Get tomorrow as minimum date
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const getSellerWhatsApp = async (vendorName: string): Promise<string> => {
    try {
      const { data: sellerProfile } = await supabase
        .from('seller_profiles')
        .select('whatsapp, phone')
        .eq('seller_name', vendorName)
        .eq('is_approved', true)
        .maybeSingle();

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

  const handleConfirmOrder = async () => {
    if (!isFormComplete || !selectedDate || isSubmitting) return;

    setIsSubmitting(true);

    const formattedDate = format(selectedDate, 'EEEE, MMMM d, yyyy');
    
    const lineItems = items.map(item => {
      const isLovableProduct = item.variantId.startsWith('lovable-variant-');
      
      return {
        variant_id: item.variantId,
        product_id: item.product.node.id,
        quantity: item.quantity,
        title: item.product.node.title,
        price: item.price.amount,
        image_url: item.product.node.images?.edges?.[0]?.node?.url || null,
        vendor: item.product.node.vendor,
        source: isLovableProduct ? 'lovable' : 'shopify',
      };
    });

    try {
      const sellerVendor = currentSeller || items[0]?.product.node.vendor || '';
      const sellerWhatsApp = await getSellerWhatsApp(sellerVendor);

      const { data, error } = await supabase.functions.invoke('create-draft-order', {
        body: {
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          location: selectedLocation,
          preferredDate: formattedDate,
          note: note.trim() || null,
          lineItems,
          totalPrice,
          sellerVendor,
        },
      });

      if (error) throw error;

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to create draft order');
      }

      if (data.localOrderId && data.localOrderToken) {
        saveOrderToLocalStorage(data.localOrderId, data.localOrderToken);
      }

      const productList = items.map(item => {
        const itemTotal = (parseFloat(item.price.amount) * item.quantity).toFixed(2);
        return `• ${item.product.node.title}${item.quantity > 1 ? ` × ${item.quantity}` : ''} — EC$${itemTotal}`;
      }).join('\n');

      let message = `🛒 *NEW ORDER: ${data.draftOrder.name}*\n\n`;
      message += `👤 Name: ${customerName.trim()}\n`;
      message += `📱 Phone: ${customerPhone.trim()}\n\n`;
      message += `📦 *Products:*\n${productList}\n\n`;
      message += `💰 *Total: EC$${totalPrice.toFixed(2)}*\n\n`;
      message += `📍 Meetup Location: ${selectedLocation}\n`;
      message += `📅 Preferred Date: ${formattedDate}\n`;
      message += `\n💳 Payment: Pay on pickup`;
      
      if (note.trim()) {
        message += `\n\n📝 Note: ${note.trim()}`;
      }

      const encodedMessage = encodeURIComponent(message);
      const whatsappUrl = `https://wa.me/${sellerWhatsApp}?text=${encodedMessage}`;

      // Save order confirmation data to localStorage for the confirmation page
      const orderConfirmationData = {
        orderName: data.draftOrder.name,
        sellerName: sellerVendor || 'Seller',
        sellerWhatsApp,
        whatsappUrl,
        whatsappMessage: message,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        items: items.map(item => ({
          title: item.product.node.title,
          quantity: item.quantity,
          price: item.price.amount,
          vendor: item.product.node.vendor,
        })),
        totalPrice,
        location: selectedLocation,
        preferredDate: formattedDate,
        note: note.trim() || undefined,
        timestamp: Date.now(),
      };

      localStorage.setItem('luut-order-confirmed', JSON.stringify(orderConfirmationData));

      orderCompletingRef.current = true;
      clearCart();
      navigate('/order-confirmed');

    } catch (error) {
      console.error("Order creation error:", error);
      toast.error("Failed to create order", {
        description: error instanceof Error ? error.message : "Please try again",
        position: "top-center",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b border-border bg-background px-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/cart')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-display text-xl">Meetup Details</h1>
      </header>

      {/* Main Content */}
      <main className="flex flex-1 flex-col">
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="space-y-6">
            {/* Your Name */}
            <ChecklistItem completed={isNameValid} label="Your Name">
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Enter your name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="pl-10"
                />
              </div>
            </ChecklistItem>

            {/* Phone Number */}
            <ChecklistItem completed={isPhoneValid} label="Phone Number">
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="e.g. 758-123-4567"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="pl-10"
                  type="tel"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                We'll use this to contact you about your order
              </p>
            </ChecklistItem>

            {/* Order Summary */}
            <ChecklistItem completed={true} label="Order Summary">
              <div className="rounded-lg border border-border bg-card p-3 space-y-2">
                {items.map((item) => (
                  <div key={item.variantId} className="flex items-start gap-2">
                    <Package className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="font-body text-sm truncate">
                        {item.product.node.title}
                        {item.quantity > 1 && ` × ${item.quantity}`}
                      </p>
                      {item.variantTitle !== 'Default Title' && (
                        <p className="text-xs text-muted-foreground">{item.variantTitle}</p>
                      )}
                    </div>
                    <span className="text-sm font-medium">
                      EC${(parseFloat(item.price.amount) * item.quantity).toFixed(2)}
                    </span>
                  </div>
                ))}
                <div className="border-t border-border pt-2 mt-2 flex justify-between">
                  <span className="font-semibold">Total</span>
                  <span className="font-display text-primary font-semibold">
                    EC${totalPrice.toFixed(2)}
                  </span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Payment: Cash on meetup
              </p>
            </ChecklistItem>

            {/* Meetup Location */}
            <ChecklistItem completed={isLocationValid} label="Meetup Location">
              <RadioGroup
                value={selectedLocation}
                onValueChange={setSelectedLocation}
                className="space-y-2"
              >
                {MEETUP_LOCATIONS.map((location) => (
                  <div
                    key={location}
                    className={cn(
                      "flex items-center space-x-3 rounded-lg border p-3 cursor-pointer transition-colors",
                      selectedLocation === location
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/50"
                    )}
                    onClick={() => setSelectedLocation(location)}
                  >
                    <RadioGroupItem value={location} id={location} />
                    <Label htmlFor={location} className="flex items-center gap-2 cursor-pointer flex-1">
                      <MapPin className="h-4 w-4 text-primary" />
                      {location}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </ChecklistItem>

            {/* Preferred Date */}
            <ChecklistItem completed={isDateValid} label="Preferred Meetup Date">
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !selectedDate && "text-muted-foreground"
                    )}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, "EEEE, MMMM d, yyyy") : "Select a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => {
                      setSelectedDate(date);
                      setCalendarOpen(false);
                    }}
                    disabled={(date) => date < tomorrow}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              <p className="text-xs text-muted-foreground mt-2">
                Final time confirmed via WhatsApp after checkout
              </p>
            </ChecklistItem>

            {/* Optional Note */}
            <ChecklistItem completed={note.trim().length > 0} label="Add a Note (optional)">
              <div className="relative">
                <MessageSquare className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Textarea
                  placeholder="Any special requests or questions?"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="pl-10 min-h-[80px] resize-none"
                  maxLength={200}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1 text-right">
                {note.length}/200
              </p>
            </ChecklistItem>

            {/* Deposit Acknowledgment */}
            <ChecklistItem completed={isDepositAcknowledged} label="Deposit Policy (required)">
              <div 
                className={cn(
                  "flex items-start space-x-3 rounded-lg border p-3 cursor-pointer transition-colors",
                  depositAcknowledged
                    ? "border-primary bg-primary/5"
                    : "border-destructive/50 bg-destructive/5"
                )}
                onClick={() => setDepositAcknowledged(!depositAcknowledged)}
              >
                <Checkbox 
                  id="deposit-acknowledgment"
                  checked={depositAcknowledged}
                  onCheckedChange={(checked) => setDepositAcknowledged(checked === true)}
                  className="mt-0.5"
                />
                <Label 
                  htmlFor="deposit-acknowledgment" 
                  className="cursor-pointer text-sm leading-relaxed"
                >
                  <span className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
                    <span>
                      Deposits are non-refundable. If I do not show up at the agreed pickup time, my deposit is forfeited and the item will be immediately resold.
                    </span>
                  </span>
                </Label>
              </div>
            </ChecklistItem>
          </div>
        </div>

        {/* Sticky Footer */}
        <div className="sticky bottom-0 border-t border-border bg-background px-4 py-4">
          {!isFormComplete && (
            <p className="mb-3 text-center text-sm text-muted-foreground">
              Complete all required fields to continue
            </p>
          )}
          
          <Button
            onClick={handleConfirmOrder}
            className="w-full"
            size="lg"
            disabled={!isFormComplete || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating Order...
              </>
            ) : (
              <>
                <MessageSquare className="mr-2 h-4 w-4" />
                Confirm Order via WhatsApp
              </>
            )}
          </Button>
        </div>
      </main>
    </div>
  );
}
