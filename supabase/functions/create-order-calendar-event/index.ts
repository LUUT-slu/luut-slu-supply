import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GATEWAY_URL =
  "https://connector-gateway.lovable.dev/google_calendar/calendar/v3/calendars/primary/events";

const BodySchema = z.object({ orderId: z.string().uuid() });

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function parseDateToIso(input: string): string | null {
  // Accepts "YYYY-MM-DD" or human strings like "Saturday, June 20, 2026"
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input;
  const d = new Date(input);
  if (isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseTimeToHms(input: string): string | null {
  // Accepts "HH:MM", "HH:MM:SS", or "h:MM AM/PM"
  const ampm = input.trim().match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/);
  if (ampm) {
    let h = parseInt(ampm[1], 10);
    const m = ampm[2];
    const isPm = ampm[3].toLowerCase() === "pm";
    if (h === 12) h = isPm ? 12 : 0;
    else if (isPm) h += 12;
    return `${String(h).padStart(2, "0")}:${m}:00`;
  }
  const hms = input.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (hms) {
    return `${hms[1].padStart(2, "0")}:${hms[2]}:${hms[3] ?? "00"}`;
  }
  return null;
}

function addHour(hms: string): string {
  const [h, m, s] = hms.split(":");
  const nh = (parseInt(h, 10) + 1) % 24;
  return `${String(nh).padStart(2, "0")}:${m}:${s}`;
}

function addDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return json({ success: false, error: "Invalid orderId" }, 400);
    }
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
      .select(
        "id, order_number, customer_name, customer_phone, location, preferred_date, pickup_time, line_items, total_price",
      )
      .eq("id", orderId)
      .maybeSingle();

    if (error) return json({ success: false, error: error.message }, 500);
    if (!order) return json({ success: false, error: "Order not found" }, 404);
    if (!order.preferred_date) {
      return json({ success: false, error: "Order has no preferred_date; skipping" }, 200);
    }

    const orderLabel = `#L${String(order.order_number ?? "").padStart(4, "0")}`;
    const title = `${orderLabel} — ${order.customer_name ?? "Customer"} | ${order.location ?? ""}`.trim();

    const items = Array.isArray(order.line_items) ? order.line_items : [];
    const itemLines = items
      .map((i: { title?: string; name?: string; quantity?: number }) =>
        `• ${i.title ?? i.name ?? "Item"} ×${i.quantity ?? 1}`,
      )
      .join("\n");

    const description = [
      `Customer: ${order.customer_name ?? "-"}`,
      `Phone: ${order.customer_phone ?? "-"}`,
      `Pickup location: ${order.location ?? "-"}`,
      "",
      "Items:",
      itemLines || "(none)",
      "",
      `Total: EC$${Number(order.total_price ?? 0).toFixed(2)}`,
    ].join("\n");

    const isoDate = parseDateToIso(String(order.preferred_date));
    if (!isoDate) {
      return json({ success: false, error: `Unparseable preferred_date: ${order.preferred_date}` }, 400);
    }

    const eventBody: Record<string, unknown> = {
      summary: title,
      description,
    };

    const hms = order.pickup_time ? parseTimeToHms(String(order.pickup_time)) : null;
    if (hms) {
      eventBody.start = {
        dateTime: `${isoDate}T${hms}`,
        timeZone: "America/St_Lucia",
      };
      eventBody.end = {
        dateTime: `${isoDate}T${addHour(hms)}`,
        timeZone: "America/St_Lucia",
      };
    } else {
      eventBody.start = { date: isoDate };
      eventBody.end = { date: addDay(isoDate) };
    }

    console.log("Calendar event body:", JSON.stringify(eventBody));
    const gcalRes = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": GCAL_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(eventBody),
    });

    const gcalText = await gcalRes.text();
    if (!gcalRes.ok) {
      console.error("Google Calendar gateway error", gcalRes.status, gcalText);
      return json({ success: false, error: `Calendar API ${gcalRes.status}: ${gcalText}` }, 502);
    }

    const data = JSON.parse(gcalText);
    return json({ success: true, eventId: data.id, htmlLink: data.htmlLink });
  } catch (e) {
    console.error("create-order-calendar-event error", e);
    return json({ success: false, error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
