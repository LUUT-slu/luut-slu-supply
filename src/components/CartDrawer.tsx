import { useState } from "react";
import { format } from "date-fns";
import { 
  ShoppingBag, 
  Minus, 
  Plus, 
  Trash2, 
  ArrowLeft, 
  MapPin, 
  User, 
  Calendar, 
  MessageSquare,
  Check,
  Circle,
  Package,
  Loader2,
  CheckCircle2,
  Copy,
  MessageCircle,
  Shield,
  Wallet,
  AlertTriangle
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
import { useCartStore, OrderConfirmation } from "@/stores/cartStore";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const WHATSAPP_NUMBER = "17587185478"; // +1 (758) 718-5478
const MEETUP_LOCATIONS = ["Castries", "Gros Islet", "Rodney Bay"];

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

function OrderConfirmationView({ order, onClose }: { order: OrderConfirmation; onClose: () => void }) {
  const handleCopyOrderNumber = () => {
    navigator.clipboard.writeText(order.name);
    toast.success("Order number copied!");
  };

  return (
    <div className="flex flex-1 flex-col min-h-0 overflow-y-auto">
      <div className="flex flex-col items-center text-center px-4 py-6">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
          <CheckCircle2 className="h-10 w-10 text-primary" />
        </div>
        
        <h2 className="font-display text-2xl mb-2">Order Confirmed!</h2>
        <p className="text-muted-foreground mb-6">Your order has been created successfully</p>
        
        {/* Order Number */}
        <div className="mb-6 rounded-lg border border-border bg-card p-4 w-full max-w-sm">
          <p className="text-sm text-muted-foreground mb-1">Order Number</p>
          <div className="flex items-center justify-center gap-2">
            <span className="font-display text-3xl text-primary">{order.name}</span>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleCopyOrderNumber}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Order Summary */}
        <div className="rounded-lg border border-border bg-card p-4 w-full max-w-sm text-left mb-6">
          <h3 className="font-semibold mb-3">Order Details</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Customer</span>
              <span>{order.customerName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Location</span>
              <span>{order.location}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Date</span>
              <span>{order.preferredDate}</span>
            </div>
            <div className="border-t border-border pt-2 mt-2">
              {order.lineItems.map((item, idx) => (
                <div key={idx} className="flex justify-between py-1">
                  <span className="truncate flex-1 pr-2">
                    {item.title} {item.quantity > 1 && `×${item.quantity}`}
                  </span>
                  <span>EC${parseFloat(item.price).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-border pt-2 mt-2 flex justify-between font-semibold">
              <span>Total</span>
              <span className="text-primary">EC${parseFloat(order.totalPrice).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Next Steps */}
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 w-full max-w-sm text-left mb-6">
          <h3 className="font-semibold mb-2 flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-primary" />
            What's Next?
          </h3>
          <ol className="text-sm space-y-1 text-muted-foreground list-decimal list-inside">
            <li>WhatsApp opened with your order — tap Send</li>
            <li>Meet at {order.location} on your preferred date</li>
            <li>Pay cash on meetup</li>
          </ol>
        </div>

        {/* Action Buttons */}
        <div className="w-full max-w-sm space-y-3">
          <Button 
            onClick={() => {
              const itemsList = order.lineItems
                .map(item => `${item.title}${item.quantity > 1 ? ` x${item.quantity}` : ''}`)
                .join('\n');
              const message = encodeURIComponent(
                `🛒 *NEW ORDER ${order.name}*\n\n` +
                `👤 Customer: ${order.customerName}\n` +
                `📍 Location: ${order.location}\n` +
                `📅 Date: ${order.preferredDate}\n` +
                `${order.note ? `📝 Note: ${order.note}\n` : ''}` +
                `\n*Items:*\n${itemsList}\n\n` +
                `💰 Total: EC$${parseFloat(order.totalPrice).toFixed(2)}\n\n` +
                `Please confirm the meetup time. Thank you!`
              );
              window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${message}`, '_blank');
            }}
            variant="outline" 
            className="w-full gap-2" 
            size="lg"
          >
            <MessageCircle className="h-5 w-5" />
            Didn't open? Tap here
          </Button>
          <Button onClick={onClose} className="w-full" size="lg">
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}

export function CartDrawer() {
  const [step, setStep] = useState<'cart' | 'builder' | 'confirmed'>('cart');
  const [customerName, setCustomerName] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [note, setNote] = useState('');
  const [depositAcknowledged, setDepositAcknowledged] = useState(false);
  
  const {
    items,
    isLoading,
    isOpen,
    setOpen,
    updateQuantity,
    removeItem,
    getTotalItems,
    getTotalPrice,
    createOrder,
    confirmedOrder,
    clearConfirmedOrder,
  } = useCartStore();

  const totalItems = getTotalItems();
  const totalPrice = getTotalPrice();

  // Validation checks
  const isNameValid = customerName.trim().length >= 2;
  const isLocationValid = selectedLocation !== '';
  const isDateValid = selectedDate !== undefined;
  const isDepositAcknowledged = depositAcknowledged;
  const isFormComplete = isNameValid && isLocationValid && isDateValid && isDepositAcknowledged;

  const resetForm = () => {
    setStep('cart');
    setCustomerName('');
    setSelectedLocation('');
    setSelectedDate(undefined);
    setNote('');
    setDepositAcknowledged(false);
  };

  const handleOpenChange = (open: boolean) => {
    setOpen(open);
    if (!open) {
      resetForm();
      clearConfirmedOrder();
    }
  };

  const handleConfirmOrder = async () => {
    if (!isFormComplete || !selectedDate) return;

    try {
      const formattedDate = format(selectedDate, 'EEEE, MMMM d, yyyy');
      const order = await createOrder({
        customerName: customerName.trim(),
        location: selectedLocation,
        preferredDate: formattedDate,
        note: note.trim() || undefined,
      });

      if (order) {
        setStep('confirmed');
        toast.success(`Order ${order.name} created!`);
        
        // Auto-open WhatsApp with order details
        const itemsList = items
          .map(item => `${item.product.node.title}${item.quantity > 1 ? ` x${item.quantity}` : ''}`)
          .join('\n');
        
        const message = encodeURIComponent(
          `🛒 *NEW ORDER ${order.name}*\n\n` +
          `👤 Customer: ${customerName.trim()}\n` +
          `📍 Location: ${selectedLocation}\n` +
          `📅 Date: ${formattedDate}\n` +
          `${note.trim() ? `📝 Note: ${note.trim()}\n` : ''}` +
          `\n*Items:*\n${itemsList}\n\n` +
          `💰 Total: EC$${getTotalPrice().toFixed(2)}\n\n` +
          `Please confirm the meetup time. Thank you!`
        );
        
        // Small delay to ensure confirmation shows first
        setTimeout(() => {
          window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${message}`, '_blank');
        }, 500);
      }
    } catch (error) {
      console.error('Order creation failed:', error);
      toast.error("Failed to create order. Please try again.");
    }
  };

  const handleClose = () => {
    handleOpenChange(false);
  };

  // Get tomorrow as minimum date
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

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

      <SheetContent className="flex h-full w-full flex-col bg-background sm:max-w-lg">
        <SheetHeader className="flex-shrink-0">
          <SheetTitle className="font-display text-xl">
            {step === 'cart' && 'Your Cart'}
            {step === 'builder' && 'Complete Your Order'}
            {step === 'confirmed' && 'Order Placed'}
          </SheetTitle>
        </SheetHeader>

        <div className="flex flex-1 flex-col pt-4 min-h-0">
          {/* Confirmation View */}
          {step === 'confirmed' && confirmedOrder && (
            <OrderConfirmationView order={confirmedOrder} onClose={handleClose} />
          )}

          {/* Empty Cart View */}
          {step !== 'confirmed' && items.length === 0 && !confirmedOrder && (
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
                {/* Trust indicators */}
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
                    <Popover>
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
                          onSelect={setSelectedDate}
                          disabled={(date) => date < tomorrow}
                          initialFocus
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                    <p className="text-xs text-muted-foreground mt-2">
                      Final time will be confirmed on WhatsApp
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

                  {/* Deposit Acknowledgment - Required */}
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
                  className="w-full gap-2"
                  size="lg"
                  disabled={!isFormComplete || isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Creating Order...
                    </>
                  ) : (
                    <>
                      <Check className="h-5 w-5" />
                      Confirm Order
                    </>
                  )}
                </Button>
                
                <Button
                  onClick={() => setStep('cart')}
                  variant="ghost"
                  className="w-full gap-2"
                  size="sm"
                  disabled={isLoading}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Cart
                </Button>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}