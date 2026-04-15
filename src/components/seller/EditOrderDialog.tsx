import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SellerOrder } from "@/hooks/useSellerOrders";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";
import { CalendarIcon, Loader2, Minus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface EditOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: SellerOrder | null;
  onSave: () => void;
}

const LOCATIONS = ["Castries", "Gros Islet", "Rodney Bay", "Vieux Fort"];
const TIME_SLOTS = [
  "9:00 AM - 11:00 AM",
  "11:00 AM - 1:00 PM",
  "1:00 PM - 3:00 PM",
  "3:00 PM - 5:00 PM",
  "5:00 PM - 7:00 PM",
];

interface ProductOption {
  id: string;
  name: string;
  price: number;
  images: string[] | null;
}

export function EditOrderDialog({ open, onOpenChange, order, onSave }: EditOrderDialogProps) {
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState<Date | undefined>();
  const [location, setLocation] = useState("");
  const [pickupTime, setPickupTime] = useState("");
  const [sellerNotes, setSellerNotes] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [items, setItems] = useState<{ id: string; name: string; quantity: number; unit_price: number; product_id: string | null; image_url: string | null }[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);

  // Fetch available products when dialog opens
  useEffect(() => {
    if (!open || !order) return;
    const fetchProducts = async () => {
      // Get the seller_id from the order items
      const sellerId = order.items[0]?.seller_id;
      if (!sellerId) return;
      
      const { data } = await supabase
        .from("seller_products")
        .select("id, name, price, images")
        .eq("seller_id", sellerId)
        .eq("status", "active")
        .order("name");
      
      if (data) setProducts(data);
    };
    fetchProducts();
  }, [open, order]);

  useEffect(() => {
    if (order) {
      setDate(new Date(order.preferred_date));
      setLocation(order.location);
      setPickupTime(order.pickup_time || order.pickup_time_window || "");
      setSellerNotes(order.seller_notes || "");
      setCustomerName(order.customer_name || "");
      setCustomerPhone(order.customer_phone || "");
      setItems(
        order.items.map((item) => ({
          id: item.id,
          name: item.product_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          product_id: item.product_id,
          image_url: item.product_image_url,
        }))
      );
    }
  }, [order]);

  const handleQuantityChange = (itemId: string, delta: number) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? { ...item, quantity: Math.max(1, item.quantity + delta) }
          : item
      )
    );
  };

  const handleRemoveItem = (itemId: string) => {
    if (items.length <= 1) {
      toast.error("Order must have at least one item");
      return;
    }
    setItems((prev) => prev.filter((item) => item.id !== itemId));
  };

  const handlePriceChange = (itemId: string, newPrice: string) => {
    const price = parseFloat(newPrice) || 0;
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, unit_price: price } : item
      )
    );
  };

  const handleNameChange = (itemId: string, newName: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, name: newName, product_id: null } : item
      )
    );
  };

  const handleProductSelect = (itemId: string, productId: string) => {
    if (productId === "__custom__") {
      // Switch to custom/manual entry
      setItems((prev) =>
        prev.map((item) =>
          item.id === itemId ? { ...item, name: "", product_id: null, image_url: null } : item
        )
      );
      return;
    }
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? { ...item, name: product.name, unit_price: product.price, product_id: product.id, image_url: product.images?.[0] || null }
          : item
      )
    );
  };

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      { id: `new-${Date.now()}`, name: "", quantity: 1, unit_price: 0, product_id: null, image_url: null },
    ]);
  };

  const handleSave = async () => {
    if (!order || !date) return;

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const newTotal = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);

      // Build updated line_items JSON
      const updatedLineItems = items.map((item) => ({
        title: item.name,
        quantity: item.quantity,
        price: item.unit_price.toFixed(2),
      }));

      // Update order
      const { error: orderError } = await supabase
        .from("orders")
        .update({
          preferred_date: format(date, "EEEE, MMMM d, yyyy"),
          location,
          pickup_time: pickupTime,
          seller_notes: sellerNotes,
          customer_name: customerName,
          customer_phone: customerPhone || null,
          total_price: newTotal,
          line_items: updatedLineItems,
          updated_at: new Date().toISOString(),
          last_edited_at: new Date().toISOString(),
          last_edited_by: user?.id || null,
        })
        .eq("id", order.id);

      if (orderError) throw orderError;

      // Update existing items (quantity, price, and name)
      for (const item of items) {
        if (item.id.startsWith("new-")) continue; // skip new items here
        const originalItem = order.items.find((i) => i.id === item.id);
        if (originalItem && (originalItem.quantity !== item.quantity || originalItem.unit_price !== item.unit_price || originalItem.product_name !== item.name)) {
          const { error: itemError } = await supabase
            .from("order_items")
            .update({
              product_name: item.name,
              product_id: item.product_id,
              product_image_url: item.image_url,
              quantity: item.quantity,
              unit_price: item.unit_price,
              total_price: item.quantity * item.unit_price,
            })
            .eq("id", item.id);

          if (itemError) throw itemError;
        }
      }

      // Insert new items
      const newItems = items.filter((item) => item.id.startsWith("new-"));
      if (newItems.length > 0) {
        const { error: insertError } = await supabase
          .from("order_items")
          .insert(
            newItems.map((item) => ({
              order_id: order.id,
              product_name: item.name,
              product_image_url: item.image_url,
              quantity: item.quantity,
              unit_price: item.unit_price,
              total_price: item.quantity * item.unit_price,
              product_id: item.product_id,
              seller_id: order.items[0]?.seller_id || null,
            }))
          );

        if (insertError) throw insertError;
      }

      // Delete removed items
      const removedItemIds = order.items
        .filter((original) => !items.find((i) => i.id === original.id))
        .map((i) => i.id);

      if (removedItemIds.length > 0) {
        const { error: deleteError } = await supabase
          .from("order_items")
          .delete()
          .in("id", removedItemIds);

        if (deleteError) throw deleteError;
      }


      toast.success("Order updated successfully");
      onSave();
      onOpenChange(false);
    } catch (error) {
      console.error("Error updating order:", error);
      toast.error("Failed to update order");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "XCD",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Order</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Customer Name */}
          <div className="space-y-2">
            <Label>Customer Name</Label>
            <Input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Customer name"
            />
          </div>

          {/* Customer Phone */}
          <div className="space-y-2">
            <Label>Customer Phone</Label>
            <Input
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="Phone number"
            />
          </div>

          {/* Pickup Date */}
          <div className="space-y-2">
            <Label>Pickup Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP") : "Select date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                   mode="single"
                   selected={date}
                   onSelect={setDate}
                   className="p-3 pointer-events-auto"
                 />
              </PopoverContent>
            </Popover>
          </div>

          {/* Pickup Time */}
          <div className="space-y-2">
            <Label>Pickup Time</Label>
            <Select value={pickupTime} onValueChange={setPickupTime}>
              <SelectTrigger>
                <SelectValue placeholder="Select time" />
              </SelectTrigger>
              <SelectContent>
                {TIME_SLOTS.map((slot) => (
                  <SelectItem key={slot} value={slot}>
                    {slot}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Location */}
          <div className="space-y-2">
            <Label>Pickup Location</Label>
            <Select value={location} onValueChange={setLocation}>
              <SelectTrigger>
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

          {/* Items */}
          <div className="space-y-2">
            <Label>Order Items</Label>
            <div className="space-y-3 rounded-lg border border-border p-3">
              {items.map((item) => (
                <div key={item.id} className="space-y-1 pb-2 border-b border-border last:border-0">
                  <div className="flex items-center justify-between gap-2">
                    <Select
                      value={item.product_id || "__custom__"}
                      onValueChange={(val) => handleProductSelect(item.id, val)}
                    >
                      <SelectTrigger className="h-8 text-sm flex-1 min-w-0">
                        <SelectValue placeholder="Select product">
                          {item.name || "Select product"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} — EC${p.price}
                          </SelectItem>
                        ))}
                        <SelectItem value="__custom__">Custom item...</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive shrink-0"
                      onClick={() => handleRemoveItem(item.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  {!item.product_id && (
                    <Input
                      value={item.name}
                      onChange={(e) => handleNameChange(item.id, e.target.value)}
                      placeholder="Enter custom item name"
                      className="h-7 text-xs"
                    />
                  )}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      <Label className="text-xs text-muted-foreground">Price:</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.unit_price}
                        onChange={(e) => handlePriceChange(item.id, e.target.value)}
                        className="h-7 w-20 text-xs"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleQuantityChange(item.id, -1)}
                        disabled={item.quantity <= 1}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleQuantityChange(item.id, 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {formatCurrency(item.unit_price * item.quantity)}
                    </span>
                  </div>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={handleAddItem}
              >
                <Plus className="h-3 w-3 mr-1" /> Add Item
              </Button>
              <div className="border-t border-border pt-3 flex justify-between text-sm font-medium">
                <span>Total</span>
                <span>
                  {formatCurrency(items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0))}
                </span>
              </div>
            </div>
          </div>

          {/* Seller Notes */}
          <div className="space-y-2">
            <Label>Seller Notes (internal)</Label>
            <Textarea
              placeholder="Add internal notes..."
              value={sellerNotes}
              onChange={(e) => setSellerNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
