import { useState } from "react";
import {
  MessageCircle,
  Check,
  AlertTriangle,
  X,
  Clock,
  CalendarClock,
  Copy,
  Send,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export interface QuickMessageOrder {
  id: string;
  order_number: number;
  customer_name: string;
  customer_phone?: string | null;
  location: string;
  preferred_date: string;
  pickup_time?: string | null;
  pickup_time_window?: string | null;
  total_price: number;
  order_token?: string | null;
  items: { product_name: string; quantity: number }[];
}

interface TemplateCtx {
  order: QuickMessageOrder;
  sellerName?: string;
  orderNum: string;
  itemsList: string;
  pickupTime: string;
  totalFmt: string;
  trackLink: string;
  dateDisplay: string;
}

interface Template {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  build: (ctx: TemplateCtx) => string;
}

const templates: Template[] = [
  {
    key: "confirm",
    label: "Confirm Order",
    icon: Check,
    build: ({ order, sellerName, orderNum, itemsList, pickupTime, totalFmt, trackLink, dateDisplay }) =>
      `Hi ${order.customer_name}! This is ${sellerName || "your seller"} confirming your Luut order ${orderNum}.\n\n📦 Items: ${itemsList}\n📍 Pickup: ${order.location}\n📅 Date: ${dateDisplay}${pickupTime ? `\n🕐 Time: ${pickupTime}` : ""}\n💰 Total: ${totalFmt}${trackLink}\n\nSee you then! 🔥`,
  },
  {
    key: "oos",
    label: "Item Out of Stock",
    icon: AlertTriangle,
    build: ({ order, orderNum }) =>
      `Hey ${order.customer_name}, small update on your Luut order ${orderNum} — one of the items just sold out on our end. Happy to offer a swap or a refund for that item, your call. Rest of the order is still good to go.`,
  },
  {
    key: "noshow",
    label: "No-Show Follow-Up",
    icon: X,
    build: ({ order, orderNum }) =>
      `Hey ${order.customer_name}, missed you at pickup for order ${orderNum} today. No stress — want to reschedule? Just let me know a day/time that works and we'll lock it in.`,
  },
  {
    key: "thanks",
    label: "Thank You",
    icon: MessageCircle,
    build: ({ order, orderNum }) =>
      `Thanks for shopping Luut, ${order.customer_name}! Order ${orderNum} all sorted. Tag us @luutslu if you post it — we love seeing the fits 🖤`,
  },
  {
    key: "reminder",
    label: "Pickup Reminder",
    icon: Clock,
    build: ({ order, orderNum, pickupTime, dateDisplay }) =>
      `Quick reminder — your Luut pickup for order ${orderNum} is set for ${dateDisplay}${pickupTime ? `, ${pickupTime}` : ""} at ${order.location}. See you soon!`,
  },
  {
    key: "reschedule",
    label: "Reschedule",
    icon: CalendarClock,
    build: ({ order, orderNum }) =>
      `Hey ${order.customer_name}, need to shift your pickup for order ${orderNum}? Just send me a new day/time that works and I'll update it on our end.`,
  },
];

function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 7) return `1758${digits}`;
  if (digits.length === 10) return `1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return digits;
  return digits;
}

function displayDate(dateStr: string): string {
  if (/^[A-Z][a-z]+,\s/.test(dateStr)) return dateStr;
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function buildCtx(order: QuickMessageOrder, sellerName?: string): TemplateCtx {
  const orderNum = `#L${String(order.order_number).padStart(4, "0")}`;
  const itemsList = order.items.map((i) => `${i.product_name} ×${i.quantity}`).join(", ");
  const pickupTime = order.pickup_time || order.pickup_time_window || "";
  const totalFmt = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "XCD",
    minimumFractionDigits: 0,
  }).format(order.total_price);
  const trackLink = order.order_token
    ? `\n\n🔗 Track your order & create an account: ${window.location.origin}/order-status/${order.id}?token=${order.order_token}`
    : "";
  return {
    order,
    sellerName,
    orderNum,
    itemsList,
    pickupTime,
    totalFmt,
    trackLink,
    dateDisplay: displayDate(order.preferred_date),
  };
}

interface Props {
  order: QuickMessageOrder;
  sellerName?: string;
  openKey?: string | null;
  onOpenChange?: (key: string | null) => void;
}

export function WhatsAppQuickMessages({ order, sellerName, openKey, onOpenChange }: Props) {
  const [internalKey, setInternalKey] = useState<string | null>(null);
  const activeKey = openKey !== undefined ? openKey : internalKey;
  const setActiveKey = (k: string | null) => {
    if (onOpenChange) onOpenChange(k);
    else setInternalKey(k);
  };

  const [draft, setDraft] = useState("");
  const active = templates.find((t) => t.key === activeKey) || null;

  const openTemplate = (key: string) => {
    const t = templates.find((x) => x.key === key);
    if (!t) return;
    setDraft(t.build(buildCtx(order, sellerName)));
    setActiveKey(key);
  };

  // Reset draft when opened externally
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setActiveKey(null);
    } else if (activeKey && !draft) {
      const t = templates.find((x) => x.key === activeKey);
      if (t) setDraft(t.build(buildCtx(order, sellerName)));
    }
  };

  // Seed when activeKey changes from parent
  if (active && !draft) {
    // lazy seed on first render with an external key
    setDraft(active.build(buildCtx(order, sellerName)));
  }

  const copyDraft = async () => {
    try {
      await navigator.clipboard.writeText(draft);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Copy failed");
    }
  };

  const sendWhatsApp = () => {
    if (!order.customer_phone) {
      toast.error("No phone number available");
      return;
    }
    const phone = normalizePhone(order.customer_phone);
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(draft)}`, "_blank");
    setActiveKey(null);
    setDraft("");
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-primary" />
            WhatsApp Quick Messages
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2">
            {templates.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => openTemplate(t.key)}
                  className="flex items-center gap-2 text-xs px-3 py-2.5 rounded-lg text-left bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors touch-manipulation"
                >
                  <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
                  <span className="truncate">{t.label}</span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!active} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              {active && <active.icon className="h-4 w-4 text-primary" />}
              {active?.label}
            </DialogTitle>
          </DialogHeader>
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={8}
            className="resize-none text-sm"
          />
          <div className="flex gap-2">
            <Button variant="outline" onClick={copyDraft} className="flex-1">
              <Copy className="h-4 w-4 mr-2" /> Copy
            </Button>
            <Button onClick={sendWhatsApp} className="flex-1" disabled={!order.customer_phone}>
              <Send className="h-4 w-4 mr-2" /> Send via WhatsApp
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
