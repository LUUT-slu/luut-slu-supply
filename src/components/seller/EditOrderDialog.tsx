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

export function EditOrderDialog({ open, onOpenChange, order, onSave }: EditOrderDialogProps) {
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState<Date | undefined>();
  const [location, setLocation] = useState("");
  const [pickupTime, setPickupTime] = useState("");
  const [sellerNotes, setSellerNotes] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [items, setItems] = useState<{ id: string; name: string; quantity: number; unit_price: number }[]>([]);

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

      // Update items (quantity and price)
      for (const item of items) {
        const originalItem = order.items.find((i) => i.id === item.id);
        if (originalItem && (originalItem.quantity !== item.quantity || originalItem.unit_price !== item.unit_price)) {
          const { error: itemError } = await supabase
            .from("order_items")
            .update({
              quantity: item.quantity,
              unit_price: item.unit_price,
              total_price: item.quantity * item.unit_price,
            })
            .eq("id", item.id);

          if (itemError) throw itemError;
        }
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

      // Recalculate order total
      const newTotal = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
      await supabase.from("orders").update({ total_price: newTotal }).eq("id", order.id);

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
                   disabled={(d) => { const t = new Date(); t.setHours(0,0,0,0); return d < t; }}
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
                <div key={item.id} className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium line-clamp-1">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(item.unit_price)} each
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
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
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => handleRemoveItem(item.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
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
