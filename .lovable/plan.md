

## Fix: Order Creation Reload Loop

### Problem
The Checkout page redirects to `/cart` whenever `items.length === 0` (line 222-226). Zustand's `persist` middleware initializes with empty state (`items: []`) before hydrating from localStorage. During that brief hydration window, the redirect fires, sending the user away before cart data loads. This creates a loop where the user keeps getting bounced.

### Root Cause
```
1. User navigates to /checkout
2. Zustand store initializes with items: [] (default)
3. useEffect fires: items.length === 0 → navigate('/cart')
4. User gets redirected before localStorage hydration completes
5. User navigates back → same thing happens again
```

### Fix

**1. Add hydration tracking to cart store** (`src/stores/cartStore.ts`)
- Add a `_hasHydrated` boolean to the store
- Use zustand persist's `onRehydrateStorage` callback to set it to `true` after hydration

**2. Guard the empty-cart redirect** (`src/pages/Checkout.tsx`)
- Only redirect to `/cart` when the store has confirmed hydration AND items are empty
- Show a brief loading state while hydration is pending

### Technical Details

In `cartStore.ts`, add:
```typescript
_hasHydrated: false,
setHasHydrated: (val: boolean) => set({ _hasHydrated: val }),
```
And in persist config:
```typescript
onRehydrateStorage: () => (state) => {
  state?.setHasHydrated(true);
},
```

In `Checkout.tsx`, change the redirect effect:
```typescript
const hasHydrated = useCartStore(s => s._hasHydrated);

useEffect(() => {
  if (hasHydrated && items.length === 0 && !orderCompletingRef.current) {
    navigate('/cart');
  }
}, [hasHydrated, items.length, navigate]);
```

And add an early return while not hydrated:
```typescript
if (!hasHydrated) {
  return <div className="min-h-screen flex items-center justify-center">
    <Loader2 className="h-6 w-6 animate-spin" />
  </div>;
}
```

### Files Changed
- `src/stores/cartStore.ts` — Add hydration state tracking
- `src/pages/Checkout.tsx` — Gate redirect on hydration complete

