## Goal
Add a post-checkout WhatsApp confirmation popup on the order success screen and track a "communication status" so admin/seller can see which orders are still awaiting WhatsApp confirmation.

## Changes

### 1. New popup component — `src/components/order/WhatsAppConfirmPopup.tsx`
Mobile-first dialog (uses existing `Dialog` shadcn component, black/gold theme).
- Title: "Confirm Your Order on WhatsApp"
- Body: "Your order was created. To fully confirm it, send us a quick WhatsApp message so we can lock it in and arrange pickup."
- Primary button: "Confirm on WhatsApp" (large, gold) → opens `whatsappUrl`, marks status `whatsapp_opened`, closes popup.
- Secondary: "Review Order" → just closes popup.
- Small text: "Meetups: Castries / Gros Islet / Rodney Bay."

### 2. Update `src/pages/OrderConfirmed.tsx`
- Remove auto-open of WhatsApp (lines 60–69). Instead show `WhatsAppConfirmPopup` automatically on mount.
- Build pre-filled message in the spec format:
  ```
  Hi Luut SLU, I want to confirm my order #{order_number}.
  Name: {customer_name}
  Items: {product_names}
  Total: EC${order_total}
  Pickup location: {pickup_location}
  Please confirm availability.
  ```
  (Reuse `whatsappUrl` if present, otherwise rebuild from `orderData`.)
- Add a persistent reminder banner at top of the page when `communication_status !== 'whatsapp_opened'`:
  > "Your order is not fully confirmed yet. Tap below to confirm on WhatsApp."  
  with a "Confirm on WhatsApp" button.
- Skip popup + banner entirely if order source is Shopify POS (`source === 'pos'` or `shopify_pos_location_id` present) or already confirmed.

### 3. Database: add `communication_status` to `orders`
Migration adds column with values:
- `pending_whatsapp` (default for new website orders)
- `whatsapp_opened` (set when customer taps the WA button)
- `confirmed` (admin/seller marks manually)
- `no_response` (seller marks)

POS-synced orders default to `confirmed` via Checkout/sync logic.

### 4. Set status on creation
- `supabase/functions/create-order/index.ts`: insert `communication_status: 'pending_whatsapp'`.
- POS sync function: insert `communication_status: 'confirmed'`.

### 5. Update status when customer taps WhatsApp
From the popup / banner button, call a small RPC `rpc_mark_whatsapp_opened(order_id, order_token)` that updates `communication_status` to `whatsapp_opened` only if currently `pending_whatsapp`. Token-gated so unauthenticated buyers can update their just-created order.

### 6. Admin & Seller dashboards
- Add filter chip "Pending WhatsApp Confirmation" on:
  - `src/pages/AdminOrdersPage.tsx`
  - `src/pages/seller/SellerOrders.tsx`
- Add a small badge on each order row when `communication_status === 'pending_whatsapp'`.
- Order detail (admin + seller) gets action buttons: **Mark Contacted**, **Mark Confirmed**, **Mark No Response** (all flip `communication_status`). Sellers only see orders containing their items (existing RLS already enforces this).

### 7. Out of scope
- No changes to checkout flow, payment, cart, or order creation logic itself.
- No new email/WA automation — popup is purely client-side trigger.
- No changes to the existing `wa.me` business number resolution (reuses `sellerWhatsApp` logic).

## Technical notes
- `communication_status` is a plain `text` column with a CHECK constraint, no enum, to keep migration simple.
- RLS: column inherits the existing `orders` policies. The new RPC is `SECURITY DEFINER` and validates `order_token` so anon customers can mark their own order as `whatsapp_opened` right after checkout.
- Popup uses existing `Dialog` primitive; styled with `bg-background`, `border-primary`, gold CTA — matches current theme tokens, no new colors.
- Reminder banner uses existing `Alert` component variants.
