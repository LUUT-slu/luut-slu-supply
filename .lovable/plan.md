## Goal

When Complete is clicked on the website, the linked Shopify draft order should convert to an order with financial status **Paid** (not Pending).

## Current behavior

`complete-draft-order` already calls Shopify's `draft_orders/{id}/complete.json` endpoint, but it sends `payment_gateway` and `payment_pending` in the JSON **body**. Shopify's complete-draft endpoint reads those as **query string** parameters and ignores the body — so the resulting order defaults to Pending.

## Change

In `supabase/functions/complete-draft-order/index.ts`:

- Build the completion URL with `?payment_pending=false` as a query parameter instead of a body field.
- Send the PUT with no JSON body (or empty body), matching Shopify's spec.
- Keep the existing local-first completion flow, error recording to `shopify_sync_status` / `shopify_sync_error`, and audit events — no change there.
- Keep the existing `paymentPending` request field so a future "mark completed but unpaid" case can pass `paymentPending: true` and get `?payment_pending=true`. Today all callers leave it `false`, so every Complete click produces a Paid order.

## Out of scope

- No UI changes.
- No changes to cancel/create draft flows.
- No new "was it actually marked paid?" verification round-trip — the Shopify response already returns the created order id, which we continue to store in `shopify_order_id`.

## Verification

After deploy, click Complete on a test order and confirm the resulting Shopify order shows financial status **Paid** with payment gateway **Manual**.
