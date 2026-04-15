

# Fix Order Date Restriction + Pickup Logic

## Problem
Four files enforce a "tomorrow minimum" date restriction, blocking same-day orders. Pickup time slots are 9 AM–5 PM but need to be 8 AM–6 PM with same-day filtering.

## Changes

### 1. Checkout.tsx
- Remove `const tomorrow` variable (line 288-289)
- Change calendar `disabled` from `date < tomorrow` to `date < today` (start of today)
- Expand `PICKUP_TIME_SLOTS` to 8:00 AM–5:30 PM range (adding 8:00 AM, 8:30 AM slots; already has up to 5 PM)
- Add smart same-day filtering: when selected date is today, filter out time slots that have already passed
- Default `selectedDate` to today instead of undefined
- If current time is past 5:30 PM, auto-default to tomorrow

### 2. CartDrawer.tsx
- Same calendar fix: remove `tomorrow`, allow today's date
- Remove the `disabled={(date) => date < tomorrow}` restriction

### 3. OrderDetails.tsx (customer edit flow)
- Same fix: remove `tomorrow`, allow today onward

### 4. EditOrderDialog.tsx (seller edit)
- Already allows today (`date < new Date()`) — just needs `pointer-events-auto` class fix
- No date restriction changes needed here

### 5. CreateOrderDialog.tsx (seller manual orders)
- `min` on date input already allows today — no change needed
- Time slots use Morning/Afternoon/Evening format — keep as-is for seller simplicity

### Pickup Time Logic (Checkout.tsx)
- New `PICKUP_TIME_SLOTS` array: 8:00 AM through 5:30 PM in 30-min increments
- Helper function: `getAvailableTimeSlots(selectedDate)` returns all slots if future date, or only future slots if today
- When user picks today and all slots have passed, show message "No slots available today" and auto-suggest tomorrow
- Reset `pickupTime` when date changes and the previously selected slot is no longer available
- Update helper text to "Pickups available 8AM–6PM"

### Files Modified
| File | Change |
|---|---|
| `src/pages/Checkout.tsx` | Allow today, expand hours to 8AM–6PM, smart same-day slot filtering, default to today |
| `src/components/CartDrawer.tsx` | Allow today's date in calendar |
| `src/pages/OrderDetails.tsx` | Allow today's date in calendar |
| `src/components/seller/EditOrderDialog.tsx` | Add `pointer-events-auto` to calendar |

No database or migration changes needed.

