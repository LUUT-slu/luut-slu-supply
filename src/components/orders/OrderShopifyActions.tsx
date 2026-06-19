import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ExternalLink, RefreshCw, MessageCircle, CheckCircle2, XCircle, Ban, Send } from "lucide-react";

const SHOPIFY_ADMIN_BASE = "https://lovable-project-yf43m.myshopify.com/admin/draft_orders";

interface Props {
  order: {
    id: string;
    order_number?: number;
    customer_name?: string;
    customer_phone?: string | null;
    total_price?: number;
    location?: string;
    line_items?: any;
    shopify_draft_order_id?: string | null;
    shopify_draft_order_name?: string | null;
    shopify_draft_order_invoice_url?: string | null;
    shopify_sync_status?: string | null;
    shopify_sync_error?: string | null;
    communication_status?: string | null;
    order_source?: string | null;
    order_status?: string | null;
  };
  isAdmin?: boolean;
  onChanged?: () => void;
}

export function OrderShopifyActions({ order, isAdmin = false, onChanged }: Props) {
  const [busy, setBusy] = useState<string | null>(null);

  const sync = order.shopify_sync_status || "not_synced";
  const comm = order.communication_status || "pending_whatsapp";

  const run = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    try { await fn(); toast.success(ok); onChanged?.(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Action failed"); }
    finally { setBusy(null); }
  };

  const resync = () => run("resync", async () => {
    const { data, error } = await supabase.functions.invoke("create-draft-order", {
      body: {
        existingOrderId: order.id,
        customerName: order.customer_name,
        customerPhone: order.customer_phone || "",
        location: order.location,
        preferredDate: "(resync)",
        lineItems: Array.isArray(order.line_items) ? order.line_items : [],
        totalPrice: order.total_price,
        orderSource: order.order_source || "customer_checkout",
      },
    });
    if (error) throw error;
    if (data?.shopifySyncStatus === "draft_failed") throw new Error("Shopify rejected the resync");
  }, "Draft order resynced");

  const markConfirmed = () => run("confirmed", async () => {
    const { error } = await supabase.rpc("rpc_mark_order_confirmed", { p_order_id: order.id });
    if (error) throw error;
    if (order.shopify_draft_order_id) {
      await supabase.functions.invoke("update-draft-order-tags", {
        body: { orderId: order.id, addTags: ["WhatsApp Confirmed"], removeTags: ["Pending WhatsApp Confirmation"] },
      });
    }
    try {
      const { data, error: calErr } = await supabase.functions.invoke(
        "create-order-calendar-event",
        { body: { orderId: order.id } },
      );
      if (calErr) throw calErr;
      if (data && data.success === false) throw new Error(data.error || "Calendar failed");
    } catch (e) {
      toast.message(`Calendar event not created: ${e instanceof Error ? e.message : "unknown error"}`);
    }
  }, "Marked WhatsApp confirmed");

  const markNoResponse = () => run("noresp", async () => {
    const { error } = await supabase.rpc("rpc_mark_no_response", { p_order_id: order.id });
    if (error) throw error;
    if (order.shopify_draft_order_id) {
      await supabase.functions.invoke("update-draft-order-tags", {
        body: { orderId: order.id, addTags: ["No Response"] },
      });
    }
  }, "Marked no response");

  const cancel = () => run("cancel", async () => {
    const reason = window.prompt("Cancellation reason?") || "";
    const { error } = await supabase.rpc("rpc_cancel_order", { p_order_id: order.id, p_reason: reason });
    if (error) throw error;
    // Also delete the Shopify draft order if one exists
    if (order.shopify_draft_order_id) {
      await supabase.functions.invoke("cancel-draft-order", {
        body: { draftOrderId: order.shopify_draft_order_id, localOrderId: order.id },
      }).catch((e) => console.warn("Shopify draft cancel failed:", e));
    }
  }, "Order cancelled");

  const complete = () => run("complete", async () => {
    const { error } = await supabase.functions.invoke("complete-draft-order", {
      body: { orderId: order.id, paymentPending: false },
    });
    if (error) throw error;
  }, "Shopify order completed (paid)");

  const requestCompletion = () => run("reqcomplete", async () => {
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("order_events").insert({
      order_id: order.id,
      actor_user_id: u.user?.id,
      event_type: "completion_requested",
      event_payload: {},
    });
    if (error) throw error;
  }, "Admin notified");

  const msgCustomer = () => {
    const phone = (order.customer_phone || "").replace(/\D/g, "");
    const orderName = order.shopify_draft_order_name || `#L${String(order.order_number || "").padStart(4, "0")}`;
    const items = (Array.isArray(order.line_items) ? order.line_items : [])
      .map((i: any) => `${i.title} ×${i.quantity}`).join(", ");
    const msg = `Hi ${order.customer_name || ""}, this is Luut SLU confirming your order ${orderName}.\nItems: ${items}\nTotal: EC$${Number(order.total_price || 0).toFixed(2)}\nPickup: ${order.location || ""}.\nReply here to confirm.`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  return (
    <div className="space-y-2 rounded-lg border border-border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {order.order_source && <Badge variant="outline">{order.order_source.replace(/_/g, " ")}</Badge>}
        <Badge variant={sync === "draft_failed" ? "destructive" : sync === "completed" ? "default" : "secondary"}>
          Shopify: {sync.replace(/_/g, " ")}
        </Badge>
        <Badge variant={comm === "whatsapp_confirmed" ? "default" : "secondary"}>
          WA: {comm.replace(/_/g, " ")}
        </Badge>
        {order.shopify_draft_order_name && (
          <span className="text-muted-foreground">{order.shopify_draft_order_name}</span>
        )}
      </div>
      {order.shopify_sync_error && (
        <p className="text-xs text-destructive">{order.shopify_sync_error}</p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={msgCustomer} disabled={!order.customer_phone}>
          <MessageCircle className="h-3.5 w-3.5 mr-1" /> Message Customer
        </Button>
        {order.shopify_draft_order_id && (
          <Button size="sm" variant="outline" asChild>
            <a href={`${SHOPIFY_ADMIN_BASE}/${order.shopify_draft_order_id}`} target="_blank" rel="noreferrer">
              <ExternalLink className="h-3.5 w-3.5 mr-1" /> Open Draft
            </a>
          </Button>
        )}
        <Button size="sm" variant="outline" disabled={busy === "resync"} onClick={resync}>
          <RefreshCw className="h-3.5 w-3.5 mr-1" /> {sync === "draft_failed" ? "Retry Draft" : "Resync"}
        </Button>
        <Button size="sm" variant="outline" disabled={busy === "confirmed"} onClick={markConfirmed}>
          <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Mark Confirmed
        </Button>
        <Button size="sm" variant="outline" disabled={busy === "noresp"} onClick={markNoResponse}>
          <XCircle className="h-3.5 w-3.5 mr-1" /> No Response
        </Button>
        {isAdmin ? (
          <>
            <Button size="sm" variant="outline" disabled={busy === "complete" || !order.shopify_draft_order_id} onClick={complete}>
              <Send className="h-3.5 w-3.5 mr-1" /> Complete in Shopify
            </Button>
            <Button size="sm" variant="destructive" disabled={busy === "cancel"} onClick={cancel}>
              <Ban className="h-3.5 w-3.5 mr-1" /> Cancel
            </Button>
          </>
        ) : (
          <Button size="sm" variant="outline" disabled={busy === "reqcomplete"} onClick={requestCompletion}>
            <Send className="h-3.5 w-3.5 mr-1" /> Request Admin Completion
          </Button>
        )}
      </div>
    </div>
  );
}
