import { useState, useEffect } from "react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { 
  ShoppingBag, 
  Minus, 
  Plus, 
  Trash2, 
  Shield,
  Wallet,
  MapPin,
  User,
  Calendar,
  MessageSquare,
  Check,
  Circle,
  Package,
  AlertTriangle,
  Phone,
  Loader2,
  Store,
} from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { Label } from "./ui/label";
import { Calendar as CalendarComponent } from "./ui/calendar";
import { Checkbox } from "./ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./ui/popover";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./ui/sheet";
import { useCartStore } from "@/stores/cartStore";
import { cn } from "@/lib/utils";
import { phoneInputProps } from "@/lib/text";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const MEETUP_LOCATIONS = ["Castries", "Gros Islet", "Vieux Fort"];
const FALLBACK_WHATSAPP_NUMBER = "7587185478"; // Admin fallback

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

// Save order to localStorage for My Orders tracking
function saveOrderToLocalStorage(orderId: string, orderToken: string) {
  const existingOrders = JSON.parse(localStorage.getItem("luut-my-orders") || "[]");
  const orderTokens = JSON.parse(localStorage.getItem("luut-order-tokens") || "{}");
  
  if (!existingOrders.includes(orderId)) {
    existingOrders.unshift(orderId);
    // Keep only last 50 orders
    if (existingOrders.length > 50) {
      existingOrders.pop();
    }
    localStorage.setItem("luut-my-orders", JSON.stringify(existingOrders));
  }
  
  // Store token for order access
  orderTokens[orderId] = orderToken;
  localStorage.setItem("luut-order-tokens", JSON.stringify(orderTokens));
}

export function CartDrawer() {
  const navigate = useNavigate();
  const [step, setStep] = useState<'cart' | 'builder'>('cart');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [note, setNote] = useState('');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [depositAcknowledged, setDepositAcknowledged] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);
  
  const {
    items,
    isOpen,
    setOpen,
    updateQuantity,
    removeItem,
    getTotalItems,
    getTotalPrice,
    clearCart,
    getCurrentSeller,
  } = useCartStore();

  const totalItems = getTotalItems();
  const totalPrice = getTotalPrice();
  const currentSeller = getCurrentSeller();

  // Auto-fill customer info from profile when proceeding to checkout
  useEffect(() => {
    const loadCustomerProfile = async () => {
      if (step !== 'builder' || profileLoaded) return;
      
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
  }, [step, profileLoaded, customerName, customerPhone, selectedLocation, note]);

  // Validation checks
  const isNameValid = customerName.trim().length >= 2;
  const isPhoneValid = customerPhone.trim().length >= 7;
  const isLocationValid = selectedLocation !== '';
  const isDateValid = selectedDate !== undefined;
  const isDepositAcknowledged = depositAcknowledged;
  const isFormComplete = isNameValid && isPhoneValid && isLocationValid && isDateValid && isDepositAcknowledged;

  const resetForm = () => {
    setStep('cart');
    setCustomerName('');
    setCustomerPhone('');
    setSelectedLocation('');
    setSelectedDate(undefined);
    setNote('');
    setDepositAcknowledged(false);
    setIsSubmitting(false);
    setProfileLoaded(false);
  };

  const handleOpenChange = (open: boolean) => {
    setOpen(open);
    if (!open) {
      resetForm();
    }
  };

  // Get start of today as minimum date
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Look up seller's WhatsApp number from their profile (via secure RPC)
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

      // Fallback to admin number
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
    
    // Prepare line items for the order
    const lineItems = items.map(item => {
      // Determine if this is a Lovable product based on variant ID
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
      // Get seller's WhatsApp number
      const sellerVendor = currentSeller || items[0]?.product.node.vendor || '';
      const sellerWhatsApp = await getSellerWhatsApp(sellerVendor);

      // Call edge function to create Shopify draft order
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

      console.log("Draft order created:", data);

      // Save order to localStorage for My Orders tracking
      if (data.localOrderId && data.localOrderToken) {
        saveOrderToLocalStorage(data.localOrderId, data.localOrderToken);
      }

      // Build customer WhatsApp message with draft order number
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

      // Encode and open WhatsApp to seller's number
      const encodedMessage = encodeURIComponent(message);
      const whatsappUrl = `https://wa.me/${sellerWhatsApp}?text=${encodedMessage}`;

      // Clear cart and close drawer
      clearCart();
      setOpen(false);
      resetForm();

      toast.success(`Order ${data.draftOrder.name} created!`, {
        description: `Opening WhatsApp to message ${sellerVendor || 'seller'}...`,
        position: "top-center",
        action: {
          label: "View Orders",
          onClick: () => navigate('/my-orders'),
        },
      });

      // Auto-open WhatsApp
      window.open(whatsappUrl, '_blank');

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

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <ShoppingBag className="h-5 w-5" />
          {totalItems > 0 && (
            <Badge className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary p-0 text-xs text-primary-foreground">
              {totalItems}
            </Badge>
          )}
        </Button>
      </SheetTrigger>

      <SheetContent className="flex h-full w-full flex-col bg-background sm:max-w-lg overflow-hidden">
        <SheetHeader className="flex-shrink-0">
          <SheetTitle className="font-display text-xl">
            {step === 'cart' ? 'Your Cart' : 'Meetup Details'}
          </SheetTitle>
        </SheetHeader>

        <div className="flex flex-1 flex-col pt-4 min-h-0 overflow-hidden">
          {/* Empty Cart View */}
          {items.length === 0 && (
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <ShoppingBag className="mb-4 h-16 w-16 text-muted-foreground" />
              <p className="mb-2 font-body text-lg">Your cart is empty</p>
              <p className="text-sm text-muted-foreground">
                Browse our products and add items to your cart
              </p>
            </div>
          )}

          {/* Cart View */}
          {step === 'cart' && items.length > 0 && (
            <>
              <div className="flex-1 overflow-y-auto pr-2">
                {/* Seller indicator */}
                {currentSeller && (
                  <div className="mb-4 flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
                    <Store className="h-4 w-4 text-primary" />
                    <span className="text-sm">
                      Shopping from <span className="font-medium text-primary">{currentSeller}</span>
                    </span>
                  </div>
                )}

                <div className="space-y-4">
                  {items.map((item) => (
                    <div
                      key={item.variantId}
                      className="flex gap-4 rounded-lg border border-border bg-card p-3"
                    >
                      <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-md bg-muted">
                        {item.product.node.images?.edges?.[0]?.node && (
                          <img
                            src={item.product.node.images.edges[0].node.url}
                            alt={item.product.node.title}
                            className="h-full w-full object-cover"
                          />
                        )}
                      </div>

                      <div className="flex flex-1 flex-col">
                        <h4 className="font-body text-sm font-medium line-clamp-2">
                          {item.product.node.title}
                        </h4>
                        {item.variantTitle !== 'Default Title' && (
                          <p className="text-xs text-muted-foreground">
                            {item.selectedOptions.map(o => o.value).join(' • ')}
                          </p>
                        )}
                        <div className="mt-auto flex items-center justify-between">
                          <span className="font-body font-semibold text-primary">
                            EC${parseFloat(item.price.amount).toFixed(2)}
                          </span>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => updateQuantity(item.variantId, item.quantity - 1)}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-6 text-center text-sm">{item.quantity}</span>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => updateQuantity(item.variantId, item.quantity + 1)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive"
                              onClick={() => removeItem(item.variantId)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex-shrink-0 space-y-4 border-t border-border pt-4">
                <div className="flex items-center justify-center gap-4 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Shield className="h-3 w-3 text-primary/60" />
                    Verified Sellers
                  </span>
                  <span className="flex items-center gap-1">
                    <Wallet className="h-3 w-3 text-primary/60" />
                    Pay on Meetup
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-primary/60" />
                    Local Pickup
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="font-body text-lg">Total</span>
                  <span className="font-display text-2xl text-primary">
                    EC${totalPrice.toFixed(2)}
                  </span>
                </div>

                <Button
                  onClick={() => setStep('builder')}
                  className="w-full"
                  size="lg"
                >
                  Proceed to Checkout
                </Button>
              </div>
            </>
          )}

          {/* Order Builder View */}
          {step === 'builder' && items.length > 0 && (
            <>
              <div className="flex-1 overflow-y-auto pr-2">
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
                          disabled={(date) => date < today}
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

              <div className="flex-shrink-0 space-y-3 border-t border-border pt-4">
                {!isFormComplete && (
                  <p className="text-center text-sm text-muted-foreground">
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
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
