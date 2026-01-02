import { useState } from "react";
import { 
  ShoppingBag, 
  Minus, 
  Plus, 
  Trash2, 
  Loader2,
  Shield,
  Wallet,
  MapPin,
  ExternalLink
} from "lucide-react";
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
import { createStorefrontCheckout } from "@/lib/shopify";
import { toast } from "sonner";

export function CartDrawer() {
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  
  const {
    items,
    isOpen,
    setOpen,
    updateQuantity,
    removeItem,
    getTotalItems,
    getTotalPrice,
    clearCart,
  } = useCartStore();

  const totalItems = getTotalItems();
  const totalPrice = getTotalPrice();

  const handleCheckout = async () => {
    if (items.length === 0) return;

    setIsCheckingOut(true);
    try {
      const checkoutItems = items.map(item => ({
        variantId: item.variantId,
        quantity: item.quantity,
      }));

      const checkoutUrl = await createStorefrontCheckout(checkoutItems);
      
      // Clear cart and close drawer before redirecting
      clearCart();
      setOpen(false);
      
      // Open Shopify checkout in new tab
      window.open(checkoutUrl, '_blank');
      
      toast.success("Redirecting to checkout...");
    } catch (error) {
      console.error('Checkout failed:', error);
      toast.error("Failed to create checkout. Please try again.");
    } finally {
      setIsCheckingOut(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={setOpen}>
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
          <SheetTitle className="font-display text-xl">Your Cart</SheetTitle>
        </SheetHeader>

        <div className="flex flex-1 flex-col pt-4 min-h-0">
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
          {items.length > 0 && (
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
                    Secure Checkout
                  </span>
                  <span className="flex items-center gap-1">
                    <Wallet className="h-3 w-3 text-primary/60" />
                    Multiple Payment Options
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
                  onClick={handleCheckout}
                  className="w-full gap-2"
                  size="lg"
                  disabled={isCheckingOut}
                >
                  {isCheckingOut ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Creating Checkout...
                    </>
                  ) : (
                    <>
                      <ExternalLink className="h-5 w-5" />
                      Checkout
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
