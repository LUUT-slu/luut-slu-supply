## Goal

Restructure `src/pages/seller/SellerOrderDetail.tsx` so the action surface matches the attached reference: a small set of primary actions always visible, everything else collapsed under "More options", plus a new "WhatsApp Quick Messages" section with editable pre-filled templates.

Scope: presentation only. All existing handlers (status changes, calendar, reschedule, edit, archive, delete, Shopify sync) are reused as-is — nothing is removed, just regrouped.

## Layout (top → bottom)

1. **Header** — back button, order number, status badge, "Created …" line. Status `<Select>` stays for quick status jumps (kept — sellers rely on it).
2. **Customer + Pickup card** — merged card, name/phone with Call + WhatsApp icon buttons on the right, divider, pickup location/date/time. Matches reference.
3. **Order Items card** — collapsible (closed by default on mobile, open on desktop), header shows "N items · EC$total". Notes render inside when expanded.
4. **WhatsApp Quick Messages card** — new. 2-col grid of template chips: Confirm Order, Item Out of Stock, No-Show Follow-Up, Thank You, Pickup Reminder, Reschedule. Tapping one opens a bottom-sheet modal with editable textarea pre-filled from order data, then Copy / Send via WhatsApp buttons.
5. **Primary actions row** — 2-col grid, always visible:
   - **Mark Completed** (primary/gold styling via existing `default` button variant) → `handleStatusChange("completed")`. Hidden if already completed/cancelled.
   - **Message Customer** → opens the Confirm Order template modal (same flow as quick messages).
6. **Open Shopify Draft** — full-width outlined button, only shown when `order.shopify_draft_order_id` exists. Opens `https://lovable-project-yf43m.myshopify.com/admin/draft_orders/{id}` in a new tab (same base URL already used in `OrderShopifyActions`).
7. **More options** toggle → expands a card listing: Mark No-Show, Reschedule, Add to Calendar, Edit Order, Resync (Shopify), Request Admin Completion (non-admins only), Cancel Order, Archive Order, Delete Order (when `canDelete`). Each wired to its existing handler.
8. **Shopify status strip** — keep the compact status/badges portion of `OrderShopifyActions` (sync status, WA comm status, draft name, error). Move its buttons into "More options" so the badges stay visible but the button clutter is gone. Simplest path: render a slim inline strip here and skip mounting `OrderShopifyActions` at the top; wire Resync / Request Admin Completion in the More menu directly (small duplication of two `supabase.functions.invoke` calls already in that component).
9. **AI Order Helper** and **SellerAIPanel** remain where they are (unchanged).

Sidebar/Quick Actions card (lines 566–692) is removed — its actions are redistributed into Primary + More options.

## WhatsApp templates

All templates receive `{ order, profile }` and produce a string that includes the order token track link (existing pattern from `messageCustomer`). Templates:

- **Confirm Order** — greeting + items + pickup + total + track link.
- **Item Out of Stock** — apology, offer swap/refund.
- **No-Show Follow-Up** — missed you, want to reschedule?
- **Thank You** — post-pickup thanks + IG tag.
- **Pickup Reminder** — date/time/location reminder.
- **Reschedule** — ask for new day/time.

Template modal (new small component or inline): bottom sheet on mobile (`fixed inset-x-0 bottom-0`), centered dialog on desktop via shadcn `Dialog`. Contents: title with icon, editable `<Textarea>` seeded from template, Copy button, "Send via WhatsApp" button that opens `https://wa.me/{normalizedPhone}?text={encoded draft}`.

## Technical notes

- New file `src/components/seller/WhatsAppQuickMessages.tsx` exporting the templates array + the section UI + the preview modal. Keeps `SellerOrderDetail.tsx` from bloating.
- Reuse existing `normalizePhone`, `formatCurrency`, `formatOrderNumber`, `displayDate` — pass them in or duplicate the small helpers inside the component.
- "Message Customer" primary button reuses the same modal by preselecting the Confirm Order template (so sellers still get an editable preview instead of jumping straight to WhatsApp — this is a small UX upgrade over today's behavior, matching the reference).
- No design tokens changed. Uses existing shadcn `Card`, `Button`, `Dialog`, `Textarea`, `Separator`. No hardcoded colors — the reference's gold/navy is achieved via existing `primary` / `secondary` variants so it stays consistent with the app's Inter/dark ecommerce theme.
- No backend, RLS, schema, or hook changes. `useSellerOrders`, `EditOrderDialog`, calendar functions, RPCs all untouched.
- Mobile-first: primary row and template grid are 2-col; "More options" content collapses to a single vertical list. Desktop keeps the 3-col grid layout you have today (main content + this action stack on the right), so nothing regresses on wide screens.

## Files touched

- `src/pages/seller/SellerOrderDetail.tsx` — reorganize JSX below the header; remove the Quick Actions sidebar card; add Primary row, Shopify Draft button, More options collapsible, and mount the new WhatsApp section.
- `src/components/seller/WhatsAppQuickMessages.tsx` — new component (templates + grid + preview modal).
- `src/components/orders/OrderShopifyActions.tsx` — leave file in place (still used elsewhere); on the order detail page we render a slim inline badges strip instead. No edits to this file required.
