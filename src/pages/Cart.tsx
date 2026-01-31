import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ShoppingBag, Minus, Plus, Trash2, Shield, Wallet, MapPin, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCartStore } from "@/stores/cartStore";

export default function Cart() {
  const navigate = useNavigate();
  const {
    items,
    updateQuantity,
    removeItem,
    getTotalItems,
    getTotalPrice,
    getCurrentSeller,
  } = useCartStore();

  const totalItems = getTotalItems();
  const totalPrice = getTotalPrice();
  const currentSeller = getCurrentSeller();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b border-border bg-background px-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-display text-xl">Cart</h1>
        {totalItems > 0 && (
          <span className="text-sm text-muted-foreground">({totalItems} {totalItems === 1 ? 'item' : 'items'})</span>
        )}
      </header>

      {/* Main Content */}
      <main className="flex flex-1 flex-col">
        {items.length === 0 ? (
          /* Empty State */
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <ShoppingBag className="mb-6 h-20 w-20 text-muted-foreground/50" />
            <h2 className="mb-2 font-display text-2xl">Your Cart is Empty</h2>
            <p className="mb-8 text-muted-foreground">Add an item to continue.</p>
            <Button asChild size="lg">
              <Link to="/shop">Back to Shop</Link>
            </Button>
          </div>
        ) : (
          /* Cart Items */
          <div className="flex flex-1 flex-col">
            <div className="flex-1 overflow-y-auto px-4 py-6">
              {/* Seller indicator */}
              {currentSeller && (
                <div className="mb-6 flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
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
                    className="flex gap-4 rounded-xl border border-border bg-card p-4"
                  >
                    <div className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-lg bg-muted">
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
                      <div className="mt-auto flex items-center justify-between pt-2">
                        <span className="font-body text-lg font-semibold text-primary">
                          EC${parseFloat(item.price.amount).toFixed(2)}
                        </span>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-9 w-9"
                            onClick={() => updateQuantity(item.variantId, item.quantity - 1)}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span className="w-8 text-center font-body text-base">{item.quantity}</span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-9 w-9"
                            onClick={() => updateQuantity(item.variantId, item.quantity + 1)}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-destructive hover:bg-destructive/10"
                            onClick={() => removeItem(item.variantId)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Trust badges */}
              <div className="mt-8 flex items-center justify-center gap-6 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Shield className="h-4 w-4 text-primary/60" />
                  Verified Sellers
                </span>
                <span className="flex items-center gap-1.5">
                  <Wallet className="h-4 w-4 text-primary/60" />
                  Pay on Meetup
                </span>
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-primary/60" />
                  Local Pickup
                </span>
              </div>
            </div>

            {/* Sticky Footer */}
            <div className="sticky bottom-0 border-t border-border bg-background px-4 py-4">
              <div className="mb-4 flex items-center justify-between">
                <span className="font-body text-lg">Total</span>
                <span className="font-display text-2xl text-primary">
                  EC${totalPrice.toFixed(2)}
                </span>
              </div>
              <Button
                onClick={() => navigate('/checkout')}
                className="w-full"
                size="lg"
              >
                Checkout
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
