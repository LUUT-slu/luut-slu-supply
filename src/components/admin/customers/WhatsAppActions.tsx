import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageCircle, Gift, Bell, Sparkles, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { markCustomerContacted } from "@/hooks/useAdminCustomers";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface Props {
  userId: string;
  name: string | null;
  phone: string | null;
}

const cleanPhone = (p: string) => p.replace(/[^\d+]/g, "").replace(/^\+/, "");

export function WhatsAppActions({ userId, name, phone }: Props) {
  const qc = useQueryClient();
  const [restockProduct, setRestockProduct] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [customMsg, setCustomMsg] = useState("");

  const firstName = name?.split(" ")[0] || "there";

  const send = async (template: string, message: string) => {
    if (!phone) {
      toast.error("No phone number on file");
      return;
    }
    const url = `https://wa.me/${cleanPhone(phone)}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank", "noopener,noreferrer");

    // Log a note + bump last_contacted_at
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("customer_notes").insert({
        user_id: userId,
        note: `Sent ${template} via WhatsApp`,
        created_by: user.id,
      });
      await markCustomerContacted(userId);
      qc.invalidateQueries({ queryKey: ["admin-customer-notes", userId] });
      qc.invalidateQueries({ queryKey: ["admin-customer-detail", userId] });
      qc.invalidateQueries({ queryKey: ["admin-customers"] });
    }
    toast.success("WhatsApp opened — message logged");
  };

  if (!phone) {
    return (
      <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        No phone number on file. Add one in the customer profile to enable WhatsApp actions.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="h-4 w-4" /> Quick templates
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button
            variant="outline"
            className="w-full justify-start gap-2 h-11"
            onClick={() =>
              send("welcome", `Welcome to LUUT, ${firstName}! Reply with any questions about your order.`)
            }
          >
            <MessageCircle className="h-4 w-4" /> Send welcome message
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start gap-2 h-11"
            onClick={() =>
              send("follow-up", `Hey ${firstName}, following up on your last order. Everything good?`)
            }
          >
            <Send className="h-4 w-4" /> Send follow-up
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Bell className="h-4 w-4" /> Restock alert
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Input
            placeholder="Product name"
            value={restockProduct}
            onChange={(e) => setRestockProduct(e.target.value)}
            className="h-11"
          />
          <Button
            className="w-full h-11"
            disabled={!restockProduct.trim()}
            onClick={() =>
              send(
                "restock",
                `Hey ${firstName}, the ${restockProduct} you were interested in is back in stock! Reply to grab one.`
              )
            }
          >
            Send restock alert
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Gift className="h-4 w-4" /> Promo code
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Input
            placeholder="Discount code (e.g. LUUT10)"
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value)}
            className="h-11"
          />
          <Button
            className="w-full h-11"
            disabled={!promoCode.trim()}
            onClick={() =>
              send("promo", `${firstName}, here's an exclusive code for you: ${promoCode}`)
            }
          >
            Send promo
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Custom message</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Textarea
            placeholder="Type your message…"
            value={customMsg}
            onChange={(e) => setCustomMsg(e.target.value)}
            rows={4}
          />
          <Button
            className="w-full h-11"
            disabled={!customMsg.trim()}
            onClick={() => send("custom", customMsg)}
          >
            Send custom
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
