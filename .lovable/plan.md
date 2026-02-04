

# Replace WhatsApp Button with Shopify Inbox Chat Button

## Overview
Remove all WhatsApp floating buttons and replace them with a "Chat" button that opens your Shopify Inbox chat page at `https://lovable-project-yf43m.myshopify.com/pages/chat` in a new tab.

---

## What Will Change

### Chat Button Behavior
- **Floating button**: Bottom-right, gold accent (matches site branding)
- **On click**: Opens Shopify chat page in new tab
- **Label**: "Chat" (floating shows icon only, inline shows "Chat with Us")
- **No WhatsApp**: Removes all green WhatsApp styling

### Text Updates
- Footer: "WhatsApp is our main channel" → "Chat with us for support"
- Contact page: Update primary CTA messaging

---

## Implementation Plan

### 1. Create New ChatButton Component
**New file: `src/components/ChatButton.tsx`**

The new component will:
- Accept same variants as WhatsAppButton (floating, default, outline)
- Use `MessageCircle` icon from lucide-react
- Use `bg-primary` (gold) instead of `bg-whatsapp` (green)
- Open `https://lovable-project-yf43m.myshopify.com/pages/chat` in new tab

```
Floating variant:
┌───────────┐
│    💬     │  ← Gold circle, bottom-right
└───────────┘

Inline variant:
┌─────────────────────┐
│ 💬 Chat with Us     │  ← Gold button
└─────────────────────┘
```

### 2. Replace All WhatsAppButton Usages

| File | Usage | Change |
|------|-------|--------|
| `src/pages/Index.tsx` | Inline + Floating | Replace both with ChatButton |
| `src/pages/Contact.tsx` | Inline + Floating | Replace + update text content |
| `src/pages/ProductDetail.tsx` | Floating | Replace with ChatButton |
| `src/pages/Shop.tsx` | Floating | Replace with ChatButton |
| `src/pages/ShopCategory.tsx` | Floating | Replace with ChatButton |
| `src/pages/Sellers.tsx` | Inline + Floating | Replace both |
| `src/pages/SellerProfile.tsx` | Inline + Floating | Replace both |
| `src/pages/SellOnLuut.tsx` | Inline + Floating | Replace both |
| `src/pages/RefundPolicy.tsx` | Inline + Floating | Replace both |
| `src/pages/MeetupPolicy.tsx` | Inline + Floating | Replace both |
| `src/pages/DepositPolicy.tsx` | Inline + Floating | Replace both |
| `src/components/Footer.tsx` | Inline | Replace + update text |

### 3. Update Page Content Text

**Contact.tsx:**
- "WHATSAPP IS OUR MAIN CHANNEL" → "CHAT WITH US"
- "message us on WhatsApp" → "start a chat with us"
- Remove green border styling on primary card

**Footer.tsx:**
- "WhatsApp is our main communication channel" → "Chat with us for quick support"

**Index.tsx:**
- "message us directly on WhatsApp" → "start a chat with us"

---

## Files Summary

| File | Action |
|------|--------|
| `src/components/ChatButton.tsx` | CREATE - New Shopify Inbox chat button |
| `src/pages/Index.tsx` | MODIFY - Replace WhatsApp buttons |
| `src/pages/Contact.tsx` | MODIFY - Replace buttons + update text |
| `src/pages/ProductDetail.tsx` | MODIFY - Replace floating button |
| `src/pages/Shop.tsx` | MODIFY - Replace floating button |
| `src/pages/ShopCategory.tsx` | MODIFY - Replace floating button |
| `src/pages/Sellers.tsx` | MODIFY - Replace both buttons |
| `src/pages/SellerProfile.tsx` | MODIFY - Replace both buttons |
| `src/pages/SellOnLuut.tsx` | MODIFY - Replace both buttons |
| `src/pages/RefundPolicy.tsx` | MODIFY - Replace both buttons |
| `src/pages/MeetupPolicy.tsx` | MODIFY - Replace both buttons |
| `src/pages/DepositPolicy.tsx` | MODIFY - Replace both buttons |
| `src/components/Footer.tsx` | MODIFY - Replace button + update text |

---

## What Stays the Same
- **Order confirmation WhatsApp flows** (checkout → seller notification) - these remain for business operations
- All other site functionality
- Footer social links (Instagram, Facebook)

---

## Not Changed (Business Logic)
The following files contain WhatsApp links for **business-critical order notifications** (seller-to-customer, admin-to-partner). These are not changed since they serve a different purpose:
- `Checkout.tsx` - Order confirmation to seller
- `OrderComplete.tsx` - Order details to seller
- `SellerOrders.tsx` - Seller messaging customers
- `AdminOrdersPage.tsx` - Admin notifications
- Edge functions for order processing

