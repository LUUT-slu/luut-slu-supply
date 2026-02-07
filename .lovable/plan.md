

# Fix: Cart Redirect Racing Order Confirmation

## Root Cause

In `Checkout.tsx`, the checkout flow does this:

```text
Line 278: clearCart()        --> items becomes []
Line 107: useEffect fires    --> items.length === 0 --> navigate('/cart')  [RACE WINNER]
Line 279: navigate('/order-confirmed')                                    [TOO LATE]
```

The "redirect if cart is empty" safety guard (lines 107-112) reacts to `clearCart()` and sends the user to `/cart` before the intended `/order-confirmed` navigation happens.

## Fix

Add a ref to track when an order submission is in progress. The cart-empty guard should skip its redirect when `isSubmitting` is true (or when we've just completed an order).

### Change 1: `src/pages/Checkout.tsx`

**Add a ref to bypass the cart-empty redirect during submission:**

- Add a `useRef` (`orderCompletingRef`) initialized to `false`
- Set it to `true` right before `clearCart()` is called
- In the cart-empty `useEffect`, check the ref and skip the redirect if it's `true`

```typescript
// Add ref
const orderCompletingRef = useRef(false);

// Update the cart-empty guard (lines 107-112)
useEffect(() => {
  if (items.length === 0 && !orderCompletingRef.current) {
    navigate('/cart');
  }
}, [items.length, navigate]);

// Before clearCart (around line 278)
orderCompletingRef.current = true;
clearCart();
navigate('/order-confirmed');
```

### Change 2: `src/pages/OrderConfirmed.tsx`

No structural changes needed. The auto-open WhatsApp logic with the `setTimeout(500ms)` on mount is correct and will work once the user actually lands on this page instead of being redirected to `/cart`.

## Files Modified

| File | Change |
|------|--------|
| `src/pages/Checkout.tsx` | Add `orderCompletingRef` to prevent cart-empty redirect during order completion |

## Why This Works

- The ref is synchronous (unlike state), so it's guaranteed to be `true` before the `useEffect` runs
- The cart-empty guard still protects against users who land on `/checkout` with no items
- After `clearCart()` + `navigate('/order-confirmed')`, the user arrives at the confirmation page where WhatsApp auto-opens

## Expected Flow After Fix

```text
1. User clicks "Confirm Order"
2. Edge function creates order
3. orderCompletingRef = true
4. clearCart() --> items = []
5. useEffect sees items.length === 0 BUT orderCompletingRef is true --> SKIPS redirect
6. navigate('/order-confirmed')
7. OrderConfirmed page loads
8. Auto-opens WhatsApp with pre-filled message (500ms delay)
9. Shows fallback "Message Seller" button
10. User returns to site --> clicks "View My Orders"
```

