import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GATEWAY_BASE =
  "https://connector-gateway.lovable.dev/google_calendar/calendar/v3/calendars/primary/events";

const BodySchema = z.object({ orderId: z.string().uuid() });

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ success: false, error: "Invalid orderId" }, 400);
    const { orderId } = parsed.data;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const GCAL_KEY = Deno.env.get("GOOGLE_CALENDAR_API_KEY");
    if (!LOVABLE_API_KEY || !GCAL_KEY) {
      return json({ success: false, error: "Calendar connector not configured" }, 500);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: order, error } = await supabase
      .from("orders")
      .select("id, calendar_event_id")
      .eq("id", orderId)
      .maybeSingle();

    if (error) return json({ success: false, error: error.message }, 500);
    if (!order) return json({ success: false, error: "Order not found" }, 404);
    if (!order.calendar_event_id) {
      return json({ success: true, skipped: true, reason: "No calendar_event_id on order" });
    }

    const res = await fetch(`${GATEWAY_BASE}/${encodeURIComponent(order.calendar_event_id)}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": GCAL_KEY,
      },
    });

    // 200/204 = deleted; 410 = already gone; 404 = not found — treat all as success
    if (!res.ok && ![404, 410].includes(res.status)) {
      const text = await res.text();
      console.error("Google Calendar delete error", res.status, text);
      return json({ success: false, error: `Calendar API ${res.status}: ${text}` }, 502);
    }

    await supabase.from("orders").update({ calendar_event_id: null }).eq("id", orderId);
    return json({ success: true });
  } catch (e) {
    console.error("delete-order-calendar-event error", e);
    return json({ success: false, error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
