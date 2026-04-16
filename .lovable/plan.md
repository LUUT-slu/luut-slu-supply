

## Transactional Email System with Resend

### Overview
Set up a Resend-powered email system that sends order confirmation, pickup details, and order-ready emails to customers. This requires adding an email field to checkout since one doesn't exist today.

### Problem: No Customer Email Collected
The current checkout collects name and phone only — no email. The `orders` table has no email column. This must be added first.

### Database Changes

**Migration: Add `customer_email` to `orders` table**
```sql
ALTER TABLE public.orders ADD COLUMN customer_email text;
```
Nullable — email remains optional so existing orders and non-email checkouts still work.

### New Edge Function: `send-order-email`

Single edge function that handles all three email types based on a `type` parameter:
- `order_confirmation` — sent after order creation
- `order_confirmed` — sent when seller confirms order
- `order_ready` — sent when order is marked completed/ready

Uses the `RESEND_API_KEY` secret (already configured) via the Resend connector gateway pattern with `LOVABLE_API_KEY`.

Builds clean, mobile-friendly HTML emails with Luut SLU branding. Each email includes:
- Customer name, order number
- Items list with prices
- Pickup location, date, time
- Total price
- Appropriate messaging per email type

Only sends if `customer_email` is present on the order.

### Checkout Changes (`src/pages/Checkout.tsx`)

1. Add optional `customerEmail` state field with email input (Mail icon, placed after phone)
2. Pass `customerEmail` to `create-draft-order` edge function
3. Auto-fill from `customer_profiles.email` if logged in (existing autofill pattern)

### Edge Function Changes (`create-draft-order/index.ts`)

1. Accept `customerEmail` in the request body
2. Save to `orders.customer_email`
3. After successful order creation, call `send-order-email` with `type: order_confirmation`

### Status Change Email Triggers

**`src/pages/seller/SellerOrderDetail.tsx`** — After `handleStatusChange`:
- When status changes to `confirmed` → invoke `send-order-email` with `type: order_confirmed`
- When status changes to `completed` → invoke `send-order-email` with `type: order_ready`

**`src/pages/AdminOrders.tsx`** — Same triggers for admin status changes.

### Edge Function Config (`supabase/config.toml`)
```toml
[functions.send-order-email]
verify_jwt = false
```

### Email Templates (inline HTML in edge function)

Clean minimal design with:
- Luut SLU header
- Order number prominently displayed
- Items table
- Pickup details card
- Mobile-responsive layout
- Brand colors from site

### Files Changed
1. `supabase/migrations/` — Add `customer_email` column
2. `supabase/functions/send-order-email/index.ts` — New edge function
3. `supabase/functions/create-draft-order/index.ts` — Save email, trigger confirmation
4. `supabase/config.toml` — Add function config
5. `src/pages/Checkout.tsx` — Add email input field, pass to edge function
6. `src/pages/seller/SellerOrderDetail.tsx` — Trigger emails on status change
7. `src/pages/AdminOrders.tsx` — Trigger emails on status change

### Security
- Email only sent if customer provided one (no empty sends)
- Resend API key accessed via server-side env only
- No sensitive data exposed to client beyond what's already shown

