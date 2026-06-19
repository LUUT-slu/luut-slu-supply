# Add Google Calendar Event on Order Confirm

When an admin clicks **Mark Confirmed** on an order, also create a Google Calendar event using the workspace's Google Calendar connector. Existing confirm logic (`rpc_mark_order_confirmed` + Shopify tag update) stays untouched — calendar creation runs on top.

## Behavior

- **Title**: `#L0042 — John | Castries` (order_number + customer_name + location)
- **Date**: `orders.preferred_date`
- **Time**: `orders.pickup_time` if present → 1-hour timed event; otherwise all-day
- **Description**: customer name, phone, pickup location, line items with quantities, total in EC$
- **Trigger**: only on the admin confirm action in `OrderShopifyActions.tsx`. Skipped silently if no `preferred_date`. Failure shows a non-blocking toast; the confirm itself is still considered successful.

## Implementation

### 1. New edge function `supabase/functions/create-order-calendar-event/index.ts`
- Public CORS, validates `orderId` (zod).
- Uses service-role client to load the order row (id, order_number, customer_name, customer_phone, location, preferred_date, pickup_time, line_items, total_price).
- Builds the title/description from those fields.
- POSTs to the Google Calendar connector gateway:
  - URL: `https://connector-gateway.lovable.dev/google_calendar/calendar/v3/calendars/primary/events`
  - Headers: `Authorization: Bearer ${LOVABLE_API_KEY}`, `X-Connection-Api-Key: ${GOOGLE_CALENDAR_API_KEY}`
  - Body:
    - If `pickup_time` present: `start.dateTime` = `${preferred_date}T${pickup_time}` with `timeZone: "America/St_Lucia"`, `end.dateTime` = +1h.
    - Else: `start.date` / `end.date` = `preferred_date` (all-day, end is next day).
- Returns `{ success, eventId, htmlLink }` or `{ success: false, error }`.
- Does NOT modify the order row.

### 2. `src/components/orders/OrderShopifyActions.tsx`
- In `markConfirmed`, after the existing `rpc_mark_order_confirmed` + Shopify tag block, fire-and-await `supabase.functions.invoke("create-order-calendar-event", { body: { orderId: order.id } })` inside a try/catch so a calendar failure only logs `toast.message("Calendar event not created: …")` without throwing — confirm success toast still fires.
- No other call sites changed.

## Out of scope
- Reschedule / cancel sync to calendar.
- Storing the returned `eventId` on the order (can be added later if needed).
