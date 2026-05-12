import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  MessageSquare,
  AlertTriangle,
  Loader2,
  Check,
  Circle,
  Package,
  ShoppingBag,
  Tag,
  X,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useCartStore } from "@/stores/cartStore";
import { useAnalyticsTracker } from "@/hooks/useAnalyticsTracker";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSiteSettings } from "@/hooks/useSiteSettings";

const MEETUP_LOCATIONS = ["Castries", "Gros Islet", "Vieux Fort"];
const FALLBACK_WHATSAPP_NUMBER = "7587185478";

const ALL_PICKUP_TIME_SLOTS = [
  "8:00 AM", "8:30 AM", "9:00 AM", "9:30 AM", "10:00 AM", "10:30 AM",
  "11:00 AM", "11:30 AM", "12:00 PM", "12:30 PM",
  "1:00 PM", "1:30 PM", "2:00 PM", "2:30 PM",
  "3:00 PM", "3:30 PM", "4:00 PM", "4:30 PM", "5:00 PM", "5:30 PM",
];

function parseSlotHour(slot: string): number {
  const [time, period] = slot.split(" ");
  let [hours, minutes] = time.split(":").map(Number);
  if (period === "PM" && hours !== 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;
  return hours + minutes / 60;
}

function getDefaultDate(): Date {
  const now = new Date();
  const currentHour = now.getHours() + now.getMinutes() / 60;
  // If past 5:30 PM (17.5), default to tomorrow
  if (currentHour >= 17.5) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow;
  }
  return now;
}

function getAvailableTimeSlots(selectedDate: Date | undefined): string[] {
  if (!selectedDate) return ALL_PICKUP_TIME_SLOTS;
  const now = new Date();
  const isToday = selectedDate.toDateString() === now.toDateString();
  if (!isToday) return ALL_PICKUP_TIME_SLOTS;
  const currentHour = now.getHours() + now.getMinutes() / 60;
  return ALL_PICKUP_TIME_SLOTS.filter(slot => parseSlotHour(slot) > currentHour);
}

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
  const [customerEmail, setCustomerEmail] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date>(getDefaultDate());
  const [pickupTime, setPickupTime] = useState('');
  const [note, setNote] = useState('');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [depositAcknowledged, setDepositAcknowledged] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const orderCompletingRef = useRef(false);

  // Discount code state
  const [discountCode, setDiscountCode] = useState('');
  const [isValidatingDiscount, setIsValidatingDiscount] = useState(false);
  const [appliedDiscount, setAppliedDiscount] = useState<{
    code: string;
    valueType: string;
    value: string;
    title: string;
    welcomeDiscountId?: string; // Track if this is the auto-applied welcome discount
  } | null>(null);
  const [discountError, setDiscountError] = useState<string | null>(null);

  const {
    items,
    getTotalPrice,
    clearCart,
    getUniqueVendors,
  } = useCartStore();
  const { trackEvent } = useAnalyticsTracker();

  // Track checkout started
  useEffect(() => {
    if (items.length > 0) {
      trackEvent({ eventType: "checkout_started", metadata: { itemCount: items.length } });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const vendors = getUniqueVendors();
  const totalPrice = getTotalPrice();
  const currentSeller = vendors[0] || null;
  const { data: siteSettings } = useSiteSettings();

  // Calculate discount amount
  const discountAmount = appliedDiscount
    ? appliedDiscount.valueType === 'percentage'
      ? totalPrice * (Math.abs(parseFloat(appliedDiscount.value)) / 100)
      : Math.min(Math.abs(parseFloat(appliedDiscount.value)), totalPrice)
    : 0;
  const finalPrice = totalPrice - discountAmount;

  const handleApplyDiscount = async () => {
    const code = discountCode.trim();
    if (!code) return;

    setIsValidatingDiscount(true);
    setDiscountError(null);

    try {
      const { data, error } = await supabase.functions.invoke('validate-discount', {
        body: { code },
      });

      if (error) throw error;

      if (data?.valid && data.discount) {
        setAppliedDiscount(data.discount);
        setDiscountCode('');
        toast.success(`Discount "${data.discount.code}" applied!`, { position: 'top-center' });
      } else {
        setDiscountError(data?.error || 'Invalid discount code');
      }
    } catch (err) {
      console.error('Discount validation error:', err);
      setDiscountError('Could not validate discount code');
    } finally {
      setIsValidatingDiscount(false);
    }
  };

  const handleRemoveDiscount = () => {
    setAppliedDiscount(null);
    setDiscountError(null);
  };

  const hasHydrated = useCartStore(s => s._hasHydrated);

  // Redirect if cart is empty (skip during order completion and before hydration)
  useEffect(() => {
    if (hasHydrated && items.length === 0 && !orderCompletingRef.current) {
      navigate('/cart');
    }
  }, [hasHydrated, items.length, navigate]);

  // Auto-fill customer info from profile
  useEffect(() => {
    const loadCustomerProfile = async () => {
      if (profileLoaded) return;
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('customer_profiles')
        .select('full_name, phone, email, preferred_location, meetup_notes')
        .eq('user_id', user.id)
        .single();

      if (profile) {
        if (profile.full_name && !customerName) {
          setCustomerName(profile.full_name);
        }
        if (profile.phone && !customerPhone) {
          setCustomerPhone(profile.phone);
        }
        if (profile.email && !customerEmail) {
          setCustomerEmail(profile.email);
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

  // Auto-apply welcome discount for signed-up customers
  useEffect(() => {
    const checkWelcomeDiscount = async () => {
      if (appliedDiscount) return; // Don't override if user already applied a code

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: discount } = await supabase
        .from('customer_discounts')
        .select('*')
        .eq('user_id', user.id)
        .eq('discount_type', 'welcome')
        .eq('is_used', false)
        .maybeSingle();

      if (discount) {
        setAppliedDiscount({
          code: 'WELCOME10',
          valueType: 'fixed_amount',
          value: String(discount.discount_amount),
          title: 'Welcome Discount',
          welcomeDiscountId: discount.id,
        });
        toast.success(`EC$${discount.discount_amount} welcome discount auto-applied!`, { position: 'top-center' });
      }
    };

    checkWelcomeDiscount();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-apply discount code from /discount/:code URL
  useEffect(() => {
    if (appliedDiscount) return;
    const savedCode = sessionStorage.getItem("luut-discount-code");
    if (savedCode) {
      sessionStorage.removeItem("luut-discount-code");
      setDiscountCode(savedCode);
      // Auto-trigger validation
      setTimeout(() => {
        const applyBtn = document.querySelector('[data-auto-apply-discount]') as HTMLButtonElement;
        if (applyBtn) applyBtn.click();
      }, 300);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset pickup time if no longer available after date change
  useEffect(() => {
    if (pickupTime && !getAvailableTimeSlots(selectedDate).includes(pickupTime)) {
      setPickupTime('');
    }
  }, [selectedDate]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!hasHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const isNameValid = customerName.trim().length >= 2;
  const isPhoneValid = customerPhone.trim().length >= 7;
  const isLocationValid = selectedLocation !== '';
  const isDateValid = selectedDate !== undefined;
  const isPickupTimeValid = pickupTime !== '';
  const isDepositAcknowledged = depositAcknowledged;
  const isFormComplete = isNameValid && isPhoneValid && isLocationValid && isDateValid && isPickupTimeValid && isDepositAcknowledged;

  // Get start of today as minimum date
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const availableTimeSlots = getAvailableTimeSlots(selectedDate);


  const getSellerWhatsApp = async (vendorName: string): Promise<string> => {
    try {
      const { data } = await supabase.rpc('rpc_get_seller_contact', {
        p_seller_name: vendorName,
      });
      const contact = Array.isArray(data) ? data[0] : data;

      if (contact?.whatsapp) {
        return contact.whatsapp.replace(/[\s\-\(\)]/g, '');
      }

      if (contact?.phone) {
        return contact.phone.replace(/[\s\-\(\)]/g, '');
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
      // For multi-vendor carts, use fallback merchant number
      const sellerVendor = vendors.length === 1 ? (currentSeller || items[0]?.product.node.vendor || '') : '';
      const sellerWhatsApp = vendors.length === 1
        ? await getSellerWhatsApp(sellerVendor)
        : FALLBACK_WHATSAPP_NUMBER;
      // Wrap edge function call with a timeout to prevent infinite loading
      const invokePromise = supabase.functions.invoke('create-draft-order', {
          body: {
            customerName: customerName.trim(),
            customerPhone: customerPhone.trim(),
            customerEmail: customerEmail.trim() || null,
            location: selectedLocation,
            preferredDate: formattedDate,
            pickupTime,
            note: note.trim() || null,
            lineItems,
            totalPrice: finalPrice,
            sellerVendor: vendors.length === 1 ? (currentSeller || '') : '',
            discountCode: appliedDiscount?.code || null,
          },
        });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Order request timed out. Please try again.')), 30000)
      );

      const { data, error } = await Promise.race([invokePromise, timeoutPromise]);

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

      // Customer-facing confirmation message (spec format)
      const productNames = items
        .map(item => `${item.product.node.title}${item.quantity > 1 ? ` ×${item.quantity}` : ''}`)
        .join(', ');
      const customerConfirmMessage =
        `Hi Luut SLU, I want to confirm my order ${data.draftOrder.name}.\n` +
        `Name: ${customerName.trim()}\n` +
        `Items: ${productNames}\n` +
        `Total: EC$${finalPrice.toFixed(2)}\n` +
        `Pickup location: ${selectedLocation}\n` +
        `Please confirm availability.`;

      let message = `🛒 *NEW ORDER: ${data.draftOrder.name}*\n\n`;
      message += `👤 Name: ${customerName.trim()}\n`;
      message += `📱 Phone: ${customerPhone.trim()}\n\n`;
      message += `📦 *Products:*\n${productList}\n\n`;
      if (appliedDiscount && discountAmount > 0) {
        message += `💰 Subtotal: EC$${totalPrice.toFixed(2)}\n`;
        message += `🏷️ Discount (${appliedDiscount.code}): −EC$${discountAmount.toFixed(2)}\n`;
        message += `💰 *Total: EC$${finalPrice.toFixed(2)}*\n\n`;
      } else {
        message += `💰 *Total: EC$${finalPrice.toFixed(2)}*\n\n`;
      }
      message += `📍 Meetup Location: ${selectedLocation}\n`;
      message += `📅 Preferred Date: ${formattedDate}\n`;
      message += `⏰ Pickup Time: ${pickupTime}\n`;
      message += `\n💳 Payment: Pay on pickup`;
      
      if (note.trim()) {
        message += `\n\n📝 Note: ${note.trim()}`;
      }

      // Add order tracking link if we have a local order
      if (data.localOrderId && data.localOrderToken) {
        const baseUrl = window.location.origin;
        const orderUrl = `${baseUrl}/order/${data.localOrderId}?token=${data.localOrderToken}`;
        message += `\n\n🔗 *View Order:* ${orderUrl}`;
      }

      const encodedMessage = encodeURIComponent(message);
      const whatsappUrl = `https://wa.me/${sellerWhatsApp}?text=${encodedMessage}`;

      // Customer confirmation WhatsApp URL (used by popup + reminder banner)
      const customerWhatsappUrl = `https://wa.me/${sellerWhatsApp}?text=${encodeURIComponent(customerConfirmMessage)}`;

      // Save order confirmation data to localStorage for the confirmation page
      const orderConfirmationData = {
        orderId: data.localOrderId,
        orderToken: data.localOrderToken,
        orderName: data.draftOrder.name,
        sellerName: sellerVendor || 'Seller',
        sellerWhatsApp,
        whatsappUrl: customerWhatsappUrl,
        whatsappMessage: customerConfirmMessage,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        items: items.map(item => ({
          title: item.product.node.title,
          quantity: item.quantity,
          price: item.price.amount,
          vendor: item.product.node.vendor,
        })),
        totalPrice: finalPrice,
        discountCode: appliedDiscount?.code || null,
        discountAmount: discountAmount > 0 ? discountAmount : null,
        subtotal: totalPrice,
        location: selectedLocation,
        preferredDate: formattedDate,
        pickupTime,
        note: note.trim() || undefined,
        source: 'website',
        isPos: false,
        timestamp: Date.now(),
      };

      localStorage.setItem('luut-order-confirmed', JSON.stringify(orderConfirmationData));

      // Mark welcome discount as used if applicable
      if (appliedDiscount?.welcomeDiscountId && data.localOrderId) {
        await supabase
          .from('customer_discounts')
          .update({
            is_used: true,
            used_at: new Date().toISOString(),
            used_on_order_id: data.localOrderId,
          })
          .eq('id', appliedDiscount.welcomeDiscountId);
      }

      orderCompletingRef.current = true;
      navigate('/order-confirmed', { replace: true });
      // Delay cart clear to avoid race with the empty-cart redirect effect
      setTimeout(() => clearCart(), 200);

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
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
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

            {/* Email (Optional) */}
            <ChecklistItem completed={customerEmail.trim().length > 0} label="Email (optional)">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="your@email.com"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  className="pl-10"
                  type="email"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Get order confirmations and pickup reminders by email
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

                {/* Discount Code Input */}
                <div className="border-t border-border pt-3 mt-2">
                  {appliedDiscount ? (
                    <div className="flex items-center justify-between rounded-md border border-primary/30 bg-primary/5 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Tag className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium text-primary">
                          {appliedDiscount.welcomeDiscountId ? '🎉 Welcome Discount' : appliedDiscount.code}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          ({appliedDiscount.valueType === 'percentage'
                            ? `${Math.abs(parseFloat(appliedDiscount.value))}% off`
                            : `EC$${Math.abs(parseFloat(appliedDiscount.value)).toFixed(2)} off`})
                        </span>
                      </div>
                      {!appliedDiscount.welcomeDiscountId && (
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleRemoveDiscount}>
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Tag className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          placeholder="Discount code"
                          value={discountCode}
                          onChange={(e) => {
                            setDiscountCode(e.target.value.toUpperCase());
                            setDiscountError(null);
                          }}
                          className="pl-10 uppercase"
                          onKeyDown={(e) => e.key === 'Enter' && handleApplyDiscount()}
                        />
                      </div>
                      <Button
                        variant="outline"
                        onClick={handleApplyDiscount}
                        disabled={!discountCode.trim() || isValidatingDiscount}
                        data-auto-apply-discount
                      >
                        {isValidatingDiscount ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply'}
                      </Button>
                    </div>
                  )}
                  {discountError && (
                    <p className="text-xs text-destructive mt-1">{discountError}</p>
                  )}
                </div>

                {/* Price Breakdown */}
                <div className="border-t border-border pt-2 mt-2 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>EC${totalPrice.toFixed(2)}</span>
                  </div>
                  {appliedDiscount && (
                    <div className="flex justify-between text-sm text-primary">
                      <span>Discount</span>
                      <span>−EC${discountAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-1">
                    <span className="font-semibold">Total</span>
                    <span className="font-display text-primary font-semibold">
                      EC${finalPrice.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
              {/* Checkout Reminder */}
              {siteSettings?.checkoutReminder?.enabled && !appliedDiscount && (
                <p className="text-xs text-primary mt-2 flex items-center gap-1">
                  <Tag className="h-3 w-3" />
                  {siteSettings.checkoutReminder.message}
                </p>
              )}
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
                    disabled={(date) => date < today}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </ChecklistItem>

            {/* Pickup Time Slot */}
            <ChecklistItem completed={isPickupTimeValid} label="Pickup Time Slot">
              <Select value={pickupTime} onValueChange={setPickupTime}>
                <SelectTrigger className="w-full">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <SelectValue placeholder="Select a time slot" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {availableTimeSlots.length > 0 ? (
                    availableTimeSlots.map((slot) => (
                      <SelectItem key={slot} value={slot}>{slot}</SelectItem>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-sm text-muted-foreground">No slots available today</div>
                  )}
                </SelectContent>
              </Select>
              {availableTimeSlots.length === 0 && selectedDate?.toDateString() === new Date().toDateString() && (
                <p className="text-xs text-destructive mt-1">
                  All time slots have passed for today. Please select tomorrow.
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Pickups available 8AM–6PM.
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
          {!isFormComplete && !siteSettings?.freezeCheckout && (
            <p className="mb-3 text-center text-sm text-muted-foreground">
              Complete all required fields to continue
            </p>
          )}
          
          {siteSettings?.freezeCheckout ? (
            <div className="space-y-3 text-center">
              <div className="flex items-center justify-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4" />
                Checkout temporarily paused. Check back soon.
              </div>
              <Button onClick={() => navigate('/shop')} variant="outline" className="w-full" size="lg">
                Continue Browsing
              </Button>
            </div>
          ) : (
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
          )}
        </div>
      </main>
    </div>
  );
}
