import { useState } from "react";
import { ShoppingBag, Minus, Plus, Trash2, ArrowLeft, MapPin, CreditCard, MessageCircle } from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./ui/sheet";
import { useCartStore } from "@/stores/cartStore";

const WHATSAPP_NUMBER = "17586947599";
const MEETUP_LOCATIONS = ["Castries", "Gros Islet", "Rodney Bay"];

export function CartDrawer() {
  const [step, setStep] = useState<'cart' | 'review'>('cart');
  const {
    items,
    isOpen,
    setOpen,
    updateQuantity,
    removeItem,
    getTotalItems,
    getTotalPrice,
  } = useCartStore();

  const totalItems = getTotalItems();
  const totalPrice = getTotalPrice();

  const handleOpenChange = (open: boolean) => {
    setOpen(open);
    if (!open) {
      setStep('cart');
    }
  };

  const getWhatsAppMessage = () => {
    const productList = items
      .map(item => `${item.product.node.title}${item.variantTitle !== 'Default Title' ? ` (${item.variantTitle})` : ''}${item.quantity > 1 ? ` x${item.quantity}` : ''}`)
      .join('\n');
    
    const totalEC = totalPrice.toFixed(2);
    
    return `Hi Luut SLU 👋
I'm ready to confirm my order.

Product:
${productList}

Price: EC$${totalEC}
Location: [Castries / Gros Islet / Rodney Bay]

Please let me know availability and the best time to meet.`;
  };

  const handleConfirmOnWhatsApp = () => {
    const message = encodeURIComponent(getWhatsAppMessage());
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${message}`, '_blank');
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

      <SheetContent className="flex h-full w-full flex-col bg-background sm:max-w-lg">
        <SheetHeader className="flex-shrink-0">
          <SheetTitle className="font-display text-xl">
            {step === 'cart' ? 'Your Cart' : 'Review Order'}
          </SheetTitle>
        </SheetHeader>

        <div className="flex flex-1 flex-col pt-4 min-h-0">
          {items.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <ShoppingBag className="mb-4 h-16 w-16 text-muted-foreground" />
              <p className="mb-2 font-body text-lg">Your cart is empty</p>
              <p className="text-sm text-muted-foreground">
                Browse our outfits and add items to your cart
              </p>
            </div>
          ) : step === 'cart' ? (
            // Cart View
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
                <div className="flex items-center justify-between">
                  <span className="font-body text-lg">Total</span>
                  <span className="font-display text-2xl text-primary">
                    EC${totalPrice.toFixed(2)}
                  </span>
                </div>

                <Button
                  onClick={() => setStep('review')}
                  className="w-full"
                  size="lg"
                >
                  Proceed to Checkout
                </Button>
              </div>
            </>
          ) : (
            // Review View
            <>
              <div className="flex-1 overflow-y-auto pr-2">
                <div className="space-y-6">
                  {/* Order Summary */}
                  <div className="space-y-3">
                    <h3 className="font-body font-semibold text-sm uppercase tracking-wide text-muted-foreground">
                      Order Summary
                    </h3>
                    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
                      {items.map((item) => (
                        <div key={item.variantId} className="flex justify-between items-start">
                          <div>
                            <p className="font-body text-sm font-medium">
                              {item.product.node.title}
                              {item.quantity > 1 && ` × ${item.quantity}`}
                            </p>
                            {item.variantTitle !== 'Default Title' && (
                              <p className="text-xs text-muted-foreground">
                                {item.variantTitle}
                              </p>
                            )}
                          </div>
                          <span className="font-body text-sm">
                            EC${(parseFloat(item.price.amount) * item.quantity).toFixed(2)}
                          </span>
                        </div>
                      ))}
                      <div className="border-t border-border pt-3 flex justify-between">
                        <span className="font-body font-semibold">Total</span>
                        <span className="font-display text-lg text-primary font-semibold">
                          EC${totalPrice.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Payment Method */}
                  <div className="space-y-3">
                    <h3 className="font-body font-semibold text-sm uppercase tracking-wide text-muted-foreground">
                      Payment Method
                    </h3>
                    <div className="rounded-lg border border-border bg-card p-4 flex items-center gap-3">
                      <CreditCard className="h-5 w-5 text-primary" />
                      <span className="font-body text-sm">Pay on meetup (cash)</span>
                    </div>
                  </div>

                  {/* Meetup Locations */}
                  <div className="space-y-3">
                    <h3 className="font-body font-semibold text-sm uppercase tracking-wide text-muted-foreground">
                      Available Meetup Locations
                    </h3>
                    <div className="rounded-lg border border-border bg-card p-4 space-y-2">
                      {MEETUP_LOCATIONS.map((location) => (
                        <div key={location} className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-primary" />
                          <span className="font-body text-sm">{location}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Note */}
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                    <p className="font-body text-sm text-muted-foreground">
                      <strong className="text-foreground">Note:</strong> Final availability and meetup time will be confirmed on WhatsApp.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex-shrink-0 space-y-3 border-t border-border pt-4">
                <Button
                  onClick={handleConfirmOnWhatsApp}
                  className="w-full gap-2"
                  size="lg"
                >
                  <MessageCircle className="h-5 w-5" />
                  Confirm Order on WhatsApp
                </Button>
                
                <Button
                  onClick={() => setStep('cart')}
                  variant="ghost"
                  className="w-full gap-2"
                  size="sm"
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
