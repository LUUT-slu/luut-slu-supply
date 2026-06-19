import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Minus, Package, X, ShoppingBag, Zap, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format, parse } from "date-fns";
import { Switch } from "@/components/ui/switch";
import { fetchProductVariantsById, type ShopifyVariantLite } from "@/lib/shopify";

interface Product {
  id: string;
  name: string;
  price: number;
  quantity: number;
  images: string[] | null;
  shopify_product_id: string | null;
}

interface CartItem {
  /** Unique cart line key: product.id + variantId (if any) */
  key: string;
  product: Product;
  quantity: number;
  /** Real Shopify variant gid when a variant was picked */
  variantId?: string;
  /** Display label like "Black / M" */
  variantTitle?: string;
  /** Variant-specific price overrides product price when present */
  variantPrice?: number;
  /** Variant image override */
  variantImage?: string | null;
}

interface CreateOrderDialogProps {
  sellerId: string;
  sellerName: string;
  sellerWhatsapp?: string | null;
  onOrderCreated?: () => void;
}

const LOCATIONS = ["Castries", "Gros Islet", "Rodney Bay", "Vieux Fort", "Other"];

export function CreateOrderDialog({
  sellerId,
  sellerName,
  sellerWhatsapp,
  onOrderCreated,
}: CreateOrderDialogProps) {
  const [open, setOpen] = useState(false);
  const [quickMode, setQuickMode] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [discount, setDiscount] = useState("");

  // Variant picker state
  const [variantPickerProduct, setVariantPickerProduct] = useState<Product | null>(null);
  const [variantOptions, setVariantOptions] = useState<ShopifyVariantLite[]>([]);
  const [variantLoading, setVariantLoading] = useState(false);

  // Customer form fields
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [location, setLocation] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [pickupTime, setPickupTime] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open && sellerId) {
      fetchProducts();
    }
  }, [open, sellerId]);

  const fetchProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("seller_products")
      .select("id, name, price, quantity, images, shopify_product_id")
      .eq("seller_id", sellerId)
      .eq("status", "active")
      .order("name");

    if (error) {
      toast.error("Failed to load products");
      console.error(error);
    } else {
      setProducts(data || []);
    }
    setLoading(false);
  };

  const addCartLine = (
    product: Product,
    variant?: { id: string; title: string; price: number; image?: string | null }
  ) => {
    const key = variant ? `${product.id}::${variant.id}` : product.id;
    setCart((prev) => {
      const existing = prev.find((item) => item.key === key);
      if (existing) {
        return prev.map((item) =>
          item.key === key ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [
        ...prev,
        {
          key,
          product,
          quantity: 1,
          variantId: variant?.id,
          variantTitle: variant?.title,
          variantPrice: variant?.price,
          variantImage: variant?.image ?? null,
        },
      ];
    });
  };

  const handleProductClick = async (product: Product) => {
    // Local product (no Shopify link) → just add
    if (!product.shopify_product_id) {
      addCartLine(product);
      return;
    }
    setVariantPickerProduct(product);
    setVariantLoading(true);
    setVariantOptions([]);
    const result = await fetchProductVariantsById(product.shopify_product_id);
    setVariantLoading(false);
    if (!result) {
      toast.error("Failed to load variants");
      setVariantPickerProduct(null);
      addCartLine(product);
      return;
    }
    // No variants or only the default single variant → add directly
    const meaningful = result.variants.filter((v) => v.title && v.title !== "Default Title");
    if (meaningful.length <= 1) {
      setVariantPickerProduct(null);
      const only = result.variants[0];
      if (only && meaningful.length === 1) {
        addCartLine(product, {
          id: only.id,
          title: only.title,
          price: parseFloat(only.price.amount) || product.price,
          image: only.image?.url ?? null,
        });
      } else {
        addCartLine(product);
      }
      return;
    }
    setVariantOptions(result.variants);
  };

  const pickVariant = (v: ShopifyVariantLite) => {
    if (!variantPickerProduct) return;
    addCartLine(variantPickerProduct, {
      id: v.id,
      title: v.title,
      price: parseFloat(v.price.amount) || variantPickerProduct.price,
      image: v.image?.url ?? null,
    });
    setVariantPickerProduct(null);
    setVariantOptions([]);
  };

  const updateQuantity = (key: string, delta: number) => {
    setCart(
      cart
        .map((item) => {
          if (item.key === key) {
            const newQty = item.quantity + delta;
            if (newQty <= 0) return null;
            return { ...item, quantity: newQty };
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (key: string) => {
    setCart(cart.filter((item) => item.key !== key));
  };

  const lineUnitPrice = (item: CartItem) =>
    item.variantPrice ?? item.product.price;

  const discountAmount = parseFloat(discount) || 0;
  const subtotal = cart.reduce(
    (sum, item) => sum + lineUnitPrice(item) * item.quantity,
    0
  );
  const totalPrice = Math.max(0, subtotal - discountAmount);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "XCD",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const resetForm = () => {
    setCart([]);
    setCustomerName("");
    setCustomerPhone("");
    setLocation("");
    setPreferredDate("");
    setPickupTime("");
    setNote("");
    setDiscount("");
  };

  const handleSubmit = async () => {
    if (!quickMode) {
      if (!customerName.trim()) {
        toast.error("Customer name is required");
        return;
      }
      if (!customerPhone.trim()) {
        toast.error("Customer phone is required");
        return;
      }
      if (!location) {
        toast.error("Location is required");
        return;
      }
    }
    if (!preferredDate) {
      toast.error("Date is required");
      return;
    }
    if (cart.length === 0) {
      toast.error("Add at least one product");
      return;
    }

    setSubmitting(true);

    try {
      // Convert yyyy-MM-dd to canonical full-text format to avoid timezone shifts
      const parsedDate = parse(preferredDate, "yyyy-MM-dd", new Date());
      const formattedDate = format(parsedDate, "EEEE, MMMM d, yyyy");

      // Build line items in unified create-draft-order shape
      const lineItems = cart.map((item) => ({
        variant_id: `lovable-variant-${item.product.id}`,
        product_id: item.product.id,
        quantity: item.quantity,
        title: item.product.name,
        price: String(item.product.price),
        image_url: item.product.images?.[0] || null,
        source: "lovable" as const,
        vendor: sellerName,
      }));

      const orderNote = [
        note.trim() || null,
        discountAmount > 0 ? `Discount applied: ${formatCurrency(discountAmount)}` : null,
        quickMode ? "⚡ Quick order — details pending" : null,
      ].filter(Boolean).join("\n");

      // Call unified edge function — creates DB order + Shopify Draft Order
      const { data: invokeData, error: invokeError } = await supabase.functions.invoke(
        "create-draft-order",
        {
          body: {
            customerName: quickMode ? "Quick Order" : customerName.trim(),
            customerPhone: quickMode ? "+17580000000" : customerPhone.trim(),
            location: quickMode ? "TBD" : location,
            preferredDate: formattedDate,
            pickupTime: pickupTime || undefined,
            note: orderNote || undefined,
            lineItems,
            totalPrice,
            discountCode: discount || undefined,
            orderSource: "seller_dashboard",
            createdBySellerId: sellerId,
            sellerName,
          },
        }
      );

      if (invokeError) throw invokeError;
      const orderName = invokeData?.draftOrder?.name || "";
      const syncStatus = invokeData?.shopifySyncStatus;
      if (syncStatus === "draft_failed") {
        toast.warning(`Order ${orderName} saved — Shopify sync failed. Use Resync from admin.`);
      } else {
        toast.success(`Order ${orderName} created!`);
      }

      resetForm();
      setOpen(false);
      setSubmitting(false);

      // Notify parent to refetch
      onOrderCreated?.();
    } catch (error) {
      console.error("Failed to create order:", error);
      toast.error("Failed to create order");
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Create Order
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" />
            Create New Order
          </DialogTitle>
        </DialogHeader>

        {/* Quick Mode Toggle */}
        <div className="flex items-center justify-between rounded-lg border border-border/60 p-3 bg-muted/20">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            <div>
              <p className="text-sm font-medium">Quick Order</p>
              <p className="text-xs text-muted-foreground">Item, qty, discount & date only</p>
            </div>
          </div>
          <Switch checked={quickMode} onCheckedChange={setQuickMode} />
        </div>

        <div className="space-y-4">
          {/* Customer Info Section - hidden in quick mode */}
          {!quickMode && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Customer Information</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="customerName" className="text-xs">
                  Name *
                </Label>
                <Input
                  id="customerName"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Customer name"
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="customerPhone" className="text-xs">
                  Phone *
                </Label>
                <Input
                  id="customerPhone"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="758-XXX-XXXX"
                  className="h-9"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="location" className="text-xs">
                  Location *
                </Label>
                <Select value={location} onValueChange={setLocation}>
                  <SelectTrigger id="location" className="h-9">
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    {LOCATIONS.map((loc) => (
                      <SelectItem key={loc} value={loc}>
                        {loc}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="preferredDate" className="text-xs">
                  Pickup Date *
                </Label>
                <Input
                  id="preferredDate"
                  type="date"
                  value={preferredDate}
                  onChange={(e) => setPreferredDate(e.target.value)}
                  className="h-9"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pickupTime" className="text-xs">
                Pickup Time Slot
              </Label>
              <Select value={pickupTime} onValueChange={setPickupTime}>
                <SelectTrigger id="pickupTime" className="h-9">
                  <SelectValue placeholder="Select time slot" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Morning (9 AM - 12 PM)">Morning (9 AM - 12 PM)</SelectItem>
                  <SelectItem value="Afternoon (12 PM - 3 PM)">Afternoon (12 PM - 3 PM)</SelectItem>
                  <SelectItem value="Evening (3 PM - 6 PM)">Evening (3 PM - 6 PM)</SelectItem>
                  <SelectItem value="Flexible / Any Time">Flexible / Any Time</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="note" className="text-xs">
                Note (optional)
              </Label>
              <Textarea
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Any special instructions..."
                rows={2}
              />
            </div>
          </div>
          )}

          {/* Quick mode: date + discount only */}
          {quickMode && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="preferredDateQuick" className="text-xs">Date *</Label>
                <Input
                  id="preferredDateQuick"
                  type="date"
                  value={preferredDate}
                  onChange={(e) => setPreferredDate(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="discountQuick" className="text-xs">Discount (EC$)</Label>
                <Input
                  id="discountQuick"
                  type="number"
                  min="0"
                  step="0.01"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  placeholder="0"
                  className="h-9"
                />
              </div>
            </div>
          )}

          {/* Products Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Select Products</h3>
            {loading ? (
              <div className="text-center py-4 text-sm text-muted-foreground">
                Loading products...
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-4 text-sm text-muted-foreground">
                No products available
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                {products.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => addToCart(product)}
                    className="flex items-center gap-2 p-2 rounded-lg border border-border/60 active:bg-muted/50 transition-colors text-left"
                  >
                    {product.images?.[0] ? (
                      <img
                        src={product.images[0]}
                        alt={product.name}
                        className="h-8 w-8 rounded object-cover"
                      />
                    ) : (
                      <div className="h-8 w-8 rounded bg-muted flex items-center justify-center">
                        <Package className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate">{product.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(product.price)} · {product.quantity > 0 ? `${product.quantity} left` : "Sold out"}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Cart Section */}
          {cart.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Cart ({cart.length} items)</h3>
              <div className="space-y-2">
                {cart.map((item) => (
                  <div
                    key={item.product.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border/40"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {item.product.images?.[0] ? (
                        <img
                          src={item.product.images[0]}
                          alt={item.product.name}
                          className="h-8 w-8 rounded object-cover"
                        />
                      ) : (
                        <div className="h-8 w-8 rounded bg-muted flex items-center justify-center">
                          <Package className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">
                          {item.product.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatCurrency(item.product.price * item.quantity)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => updateQuantity(item.product.id, -1)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="text-xs font-medium w-5 text-center">
                        {item.quantity}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => updateQuantity(item.product.id, 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive"
                        onClick={() => removeFromCart(item.product.id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Discount (full mode) */}
              {!quickMode && (
                <div className="space-y-1.5">
                  <Label htmlFor="discountFull" className="text-xs">Discount (EC$)</Label>
                  <Input
                    id="discountFull"
                    type="number"
                    min="0"
                    step="0.01"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    placeholder="0"
                    className="h-9"
                  />
                </div>
              )}

              {/* Total */}
              <div className="pt-2 border-t border-border/40 space-y-1">
                {discountAmount > 0 && (
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Subtotal</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>
                )}
                {discountAmount > 0 && (
                  <div className="flex items-center justify-between text-xs text-green-600">
                    <span>Discount</span>
                    <span>-{formatCurrency(discountAmount)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Total</span>
                  <span className="text-lg font-bold text-primary">
                    {formatCurrency(totalPrice)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <Button
            onClick={handleSubmit}
            disabled={submitting || cart.length === 0}
            className="w-full"
          >
            {submitting ? "Creating Order..." : "Create Order"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
