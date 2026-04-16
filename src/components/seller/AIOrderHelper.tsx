import { useState } from "react";
import { Sparkles, Loader2, MessageSquare, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSellerAIInvoke } from "@/hooks/useSellerAI";
import { toast } from "sonner";

interface OrderData {
  orderNumber: string;
  customerName: string;
  customerPhone?: string | null;
  status: string;
  totalPrice: number;
  location: string;
  preferredDate: string;
  pickupTime?: string | null;
  items: { product_name: string; quantity: number }[];
  sellerName?: string;
}

interface AIOrderHelperProps {
  order: OrderData;
}

export function AIOrderHelper({ order }: AIOrderHelperProps) {
  const [result, setResult] = useState("");
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const { invoke, loading } = useSellerAIInvoke();

  const handleAction = async (action: string, prompt: string) => {
    setActiveAction(action);
    const response = await invoke(prompt, "order");
    if (response) {
      setResult(response);
    }
    setActiveAction(null);
  };

  const draftPickupReminder = () => {
    handleAction("reminder", `Draft a WhatsApp pickup reminder message for:
Customer: ${order.customerName}
Order: ${order.orderNumber}
Items: ${order.items.map(i => `${i.product_name} ×${i.quantity}`).join(", ")}
Location: ${order.location}
Date: ${order.preferredDate}
${order.pickupTime ? `Time: ${order.pickupTime}` : ""}
Total: EC$${order.totalPrice}
Seller: ${order.sellerName || "Luut seller"}

Make it friendly, include emojis, WhatsApp-ready. Output ONLY the message text.`);
  };

  const draftFollowUp = () => {
    handleAction("followup", `Draft a WhatsApp follow-up message for order ${order.orderNumber}.
Customer: ${order.customerName}
Status: ${order.status}
Items: ${order.items.map(i => i.product_name).join(", ")}
The order needs attention/confirmation.
Make it polite but clear. Output ONLY the message text.`);
  };

  const summarizeOrder = () => {
    handleAction("summary", `Give me a brief summary of this order:
Order: ${order.orderNumber}
Customer: ${order.customerName}
Phone: ${order.customerPhone || "not provided"}
Status: ${order.status}
Items: ${order.items.map(i => `${i.product_name} ×${i.quantity}`).join(", ")}
Location: ${order.location}
Pickup: ${order.preferredDate} ${order.pickupTime || ""}
Total: EC$${order.totalPrice}

Highlight any issues or action items.`);
  };

  const copyResult = () => {
    navigator.clipboard.writeText(result);
    toast.success("Copied to clipboard");
  };

  const openInWhatsApp = () => {
    if (!order.customerPhone) {
      toast.error("No phone number available");
      return;
    }
    const digits = order.customerPhone.replace(/\D/g, "");
    const phone = digits.length === 7 ? `1758${digits}` : digits.length === 10 ? `1${digits}` : digits;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(result)}`, "_blank");
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
        <Sparkles className="h-3 w-3 text-primary" />
        <span className="font-medium">AI Actions</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-1 text-xs h-7"
          onClick={draftPickupReminder}
          disabled={loading}
        >
          {activeAction === "reminder" && loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <MessageSquare className="h-3 w-3" />}
          Pickup Reminder
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-1 text-xs h-7"
          onClick={draftFollowUp}
          disabled={loading}
        >
          {activeAction === "followup" && loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <MessageSquare className="h-3 w-3" />}
          Follow Up
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-1 text-xs h-7"
          onClick={summarizeOrder}
          disabled={loading}
        >
          {activeAction === "summary" && loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <ClipboardList className="h-3 w-3" />}
          Summarize
        </Button>
      </div>

      {result && (
        <div className="mt-2 rounded-lg border border-border bg-muted/50 p-3">
          <p className="text-sm whitespace-pre-wrap mb-2">{result}</p>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" className="text-xs h-7" onClick={copyResult}>
              Copy
            </Button>
            {order.customerPhone && (
              <Button type="button" size="sm" className="text-xs h-7 gap-1" onClick={openInWhatsApp}>
                <MessageSquare className="h-3 w-3" />
                Send via WhatsApp
              </Button>
            )}
            <Button type="button" size="sm" variant="ghost" className="text-xs h-7 ml-auto" onClick={() => setResult("")}>
              Dismiss
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
