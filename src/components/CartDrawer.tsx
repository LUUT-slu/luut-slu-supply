import { ShoppingBag, Minus, Plus, Trash2, ExternalLink, Loader2 } from "lucide-react";
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
import { WhatsAppButton } from "./WhatsAppButton";
import { toast } from "sonner";

export function CartDrawer() {
  const {
    items,
    isLoading,
    isOpen,
    setOpen,
    updateQuantity,
    removeItem,
    createCheckout,
    getTotalItems,
    getTotalPrice,
  } = useCartStore();

  const totalItems = getTotalItems();
  const totalPrice = getTotalPrice();

  const handleCheckout = async () => {
    const checkoutUrl = await createCheckout();
    if (checkoutUrl) {
      window.open(checkoutUrl, '_blank');
      setOpen(false);
    } else {
      toast.error("Failed to create checkout. Please try WhatsApp instead.");
    }
  };

  const getWhatsAppMessage = () => {
    const itemsList = items
      .map(item => `- ${item.product.node.title} (${item.variantTitle}) x${item.quantity}`)
      .join('\n');
    return `Hi! I'd like to order:\n\n${itemsList}\n\nTotal: $${totalPrice.toFixed(2)} XCD`;
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
          {items.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <ShoppingBag className="mb-4 h-16 w-16 text-muted-foreground" />
              <p className="mb-2 font-body text-lg">Your cart is empty</p>
              <p className="text-sm text-muted-foreground">
                Browse our outfits and add items to your cart
              </p>
            </div>
          ) : (
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
                        <p className="text-xs text-muted-foreground">
                          {item.selectedOptions.map(o => o.value).join(' • ')}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Sold by: {item.product.node.vendor || 'Luut SLU'}
                        </p>
                        <div className="mt-auto flex items-center justify-between">
                          <span className="font-body font-semibold text-primary">
                            ${parseFloat(item.price.amount).toFixed(2)}
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
                    ${totalPrice.toFixed(2)} XCD
                  </span>
                </div>

                <div className="space-y-2">
                  <WhatsAppButton
                    message={getWhatsAppMessage()}
                    className="w-full"
                    size="lg"
                  >
                    Message on WhatsApp
                  </WhatsAppButton>

                  <Button
                    onClick={handleCheckout}
                    variant="outline"
                    className="w-full"
                    size="lg"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating Checkout...
                      </>
                    ) : (
                      <>
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Checkout Online
                      </>
                    )}
                  </Button>
                </div>

                <p className="text-center text-xs text-muted-foreground">
                  Pay on meetup (cash) or deposit for pre-orders
                </p>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
