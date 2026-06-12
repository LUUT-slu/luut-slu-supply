import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ShoppingBag, Minus, Plus, Trash2, Shield, Wallet, MapPin, Store, Tag, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCartStore } from "@/stores/cartStore";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { fbqTrack } from "@/lib/metaPixel";

export default function Cart() {
  const navigate = useNavigate();
  const {
    items,
    updateQuantity,
    removeItem,
    getTotalItems,
    getTotalPrice,
    getUniqueVendors,
  } = useCartStore();

  const totalItems = getTotalItems();
  const totalPrice = getTotalPrice();
  const vendors = getUniqueVendors();
  const { data: siteSettings } = useSiteSettings();

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
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <ShoppingBag className="mb-6 h-20 w-20 text-muted-foreground/50" />
            <h2 className="mb-2 font-display text-2xl">Your Cart is Empty</h2>
            <p className="mb-8 text-muted-foreground">Add an item to continue.</p>
            <Button asChild size="lg">
              <Link to="/shop">Back to Shop</Link>
            </Button>
          </div>
        ) : (
          <div className="flex flex-1 flex-col">
            <div className="flex-1 overflow-y-auto px-4 py-6">
              {/* Vendor indicator */}
              {vendors.length > 0 && (
                <div className="mb-6 flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
                  <Store className="h-4 w-4 text-primary" />
                  <span className="text-sm">
                    Shopping from{" "}
                    <span className="font-medium text-primary">
                      {vendors.join(", ")}
                    </span>
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
                      {vendors.length > 1 && item.product.node.vendor && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {item.product.node.vendor}
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
              {siteSettings?.checkoutReminder?.enabled && (
                <div className="mb-3 flex items-center gap-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-primary">
                  <Tag className="h-3 w-3 flex-shrink-0" />
                  <span>{siteSettings.checkoutReminder.message}</span>
                </div>
              )}
              <div className="mb-4 flex items-center justify-between">
                <span className="font-body text-lg">Total</span>
                <span className="font-display text-2xl text-primary">
                  EC${totalPrice.toFixed(2)}
                </span>
              </div>
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
                  onClick={() => {
                    fbqTrack("InitiateCheckout", {
                      content_ids: items.map((i) => i.variantId),
                      contents: items.map((i) => ({
                        id: i.variantId,
                        quantity: i.quantity,
                      })),
                      num_items: totalItems,
                      value: totalPrice,
                      currency: items[0]?.price.currencyCode || "XCD",
                    });
                    navigate('/checkout');
                  }}
                  className="w-full"
                  size="lg"
                >
                  Checkout
                </Button>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
