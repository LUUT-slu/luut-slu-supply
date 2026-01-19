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
import { Badge } from "@/components/ui/badge";
import { Plus, Minus, Package, X, ShoppingBag } from "lucide-react";
import { toast } from "sonner";

interface Product {
  id: string;
  name: string;
  price: number;
  quantity: number;
  images: string[] | null;
}

interface CartItem {
  product: Product;
  quantity: number;
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
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Customer form fields
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [location, setLocation] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
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
      .select("id, name, price, quantity, images")
      .eq("seller_id", sellerId)
      .eq("status", "active")
      .gt("quantity", 0)
      .order("name");

    if (error) {
      toast.error("Failed to load products");
      console.error(error);
    } else {
      setProducts(data || []);
    }
    setLoading(false);
  };

  const addToCart = (product: Product) => {
    const existing = cart.find((item) => item.product.id === product.id);
    if (existing) {
      if (existing.quantity < product.quantity) {
        setCart(
          cart.map((item) =>
            item.product.id === product.id
              ? { ...item, quantity: item.quantity + 1 }
              : item
          )
        );
      } else {
        toast.error("Not enough stock");
      }
    } else {
      setCart([...cart, { product, quantity: 1 }]);
    }
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(
      cart
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            if (newQty <= 0) return null;
            if (newQty > item.product.quantity) {
              toast.error("Not enough stock");
              return item;
            }
            return { ...item, quantity: newQty };
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter((item) => item.product.id !== productId));
  };

  const totalPrice = cart.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );

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
    setNote("");
  };

  const handleSubmit = async () => {
    // Validation
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
    if (!preferredDate) {
      toast.error("Preferred date is required");
      return;
    }
    if (cart.length === 0) {
      toast.error("Add at least one product");
      return;
    }

    setSubmitting(true);

    try {
      // Build line_items for the order
      const lineItems = cart.map((item) => ({
        title: item.product.name,
        quantity: item.quantity,
        price: item.product.price,
        product_id: item.product.id,
        image_url: item.product.images?.[0] || null,
      }));

      // Create order in database
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          customer_name: customerName.trim(),
          customer_phone: customerPhone.trim(),
          location,
          preferred_date: preferredDate,
          note: note.trim() || null,
          total_price: totalPrice,
          line_items: lineItems,
          status: "pending",
          currency_code: "XCD",
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order_items for seller attribution
      const orderItems = cart.map((item) => ({
        order_id: order.id,
        product_id: item.product.id,
        seller_id: sellerId,
        product_name: item.product.name,
        product_image_url: item.product.images?.[0] || null,
        quantity: item.quantity,
        unit_price: item.product.price,
        total_price: item.product.price * item.quantity,
      }));

      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(orderItems);

      if (itemsError) {
        console.error("Failed to create order items:", itemsError);
      }

      // Record product sales for analytics
      const sales = cart.map((item) => ({
        product_id: item.product.id,
        variant_id: item.product.id,
        product_title: item.product.name,
        product_handle: item.product.name.toLowerCase().replace(/\s+/g, "-"),
        product_image_url: item.product.images?.[0] || null,
        quantity: item.quantity,
        price_amount: item.product.price,
        seller_user_id: (async () => {
          const { data } = await supabase
            .from("seller_profiles")
            .select("user_id")
            .eq("id", sellerId)
            .single();
          return data?.user_id;
        })(),
        sold_at: new Date().toISOString(),
      }));

      // Get seller user_id for sales tracking
      const { data: sellerData } = await supabase
        .from("seller_profiles")
        .select("user_id")
        .eq("id", sellerId)
        .single();

      if (sellerData) {
        const salesRecords = cart.map((item) => ({
          product_id: item.product.id,
          variant_id: item.product.id,
          product_title: item.product.name,
          product_handle: item.product.name.toLowerCase().replace(/\s+/g, "-"),
          product_image_url: item.product.images?.[0] || null,
          quantity: item.quantity,
          price_amount: item.product.price,
          seller_user_id: sellerData.user_id,
          sold_at: new Date().toISOString(),
        }));

        await supabase.from("product_sales").insert(salesRecords);
      }

      // Deduct stock
      for (const item of cart) {
        await supabase
          .from("seller_products")
          .update({ quantity: item.product.quantity - item.quantity })
          .eq("id", item.product.id);
      }

      toast.success(`Order #L${String(order.order_number).padStart(4, "0")} created!`);
      resetForm();
      setOpen(false);
      onOrderCreated?.();
    } catch (error) {
      console.error("Failed to create order:", error);
      toast.error("Failed to create order");
    } finally {
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

        <div className="space-y-4">
          {/* Customer Info Section */}
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
                  min={new Date().toISOString().split("T")[0]}
                />
              </div>
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
                    className="flex items-center gap-2 p-2 rounded-lg border border-border/60 hover:border-primary/50 hover:bg-muted/30 transition-colors text-left"
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
                        {formatCurrency(product.price)} · {product.quantity} left
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
                        className="h-6 w-6 text-destructive hover:text-destructive"
                        onClick={() => removeFromCart(item.product.id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Total */}
              <div className="flex items-center justify-between pt-2 border-t border-border/40">
                <span className="text-sm font-medium">Total</span>
                <span className="text-lg font-bold text-primary">
                  {formatCurrency(totalPrice)}
                </span>
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
