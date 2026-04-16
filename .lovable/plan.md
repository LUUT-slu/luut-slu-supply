

## Two AI Features: Customer Chatbot + Seller Description Generator

### Feature 1: AI Customer Chatbot

A floating chat widget on the storefront that helps customers find products, answer questions about policies, and navigate the marketplace.

**Edge Function: `supabase/functions/ai-chat/index.ts`**
- Uses Lovable AI gateway with `google/gemini-3-flash-preview`
- System prompt includes: marketplace context (Luut SLU, Saint Lucia, Pay on Meetup), product catalog awareness, policy info (meetup locations, deposit policy, refund policy)
- Accepts `messages` array, streams SSE response back
- Includes a tool call to search products by querying the `seller_products` table and Shopify data

**Component: `src/components/AIChatWidget.tsx`**
- Floating chat bubble (bottom-left to avoid conflict with WhatsApp button on bottom-right)
- Opens a chat panel with message history, input field, and streaming AI responses
- Renders markdown in AI responses via `react-markdown`
- Mobile responsive (full-width drawer on mobile, panel on desktop)
- Messages stored in local state only (no persistence needed)

**Integration:**
- Added to `src/pages/Index.tsx` and other storefront pages alongside existing `ChatButton`
- Uses the SSE streaming pattern from the AI gateway docs

### Feature 2: AI Product Description Generator

A "Generate Description" button on the seller product form that creates a compelling product description from the product name, category, and price.

**Edge Function: `supabase/functions/ai-generate-description/index.ts`**
- Uses Lovable AI gateway with `google/gemini-3-flash-preview`
- Non-streaming (simple invoke)
- System prompt: "Write a short, appealing product description for a Saint Lucia marketplace. Max 200 characters. Tone: casual, local, trustworthy."
- Accepts `productName`, `category`, `price` — returns generated description text

**Integration in `src/pages/seller/SellerProductForm.tsx`:**
- Add a "Generate with AI" button next to the Description field
- On click, calls the edge function with current form data
- Populates the description textarea with the result
- Shows loading state during generation

### Config
- Add both functions to `supabase/config.toml` with `verify_jwt = false`
- No new secrets needed (uses existing `LOVABLE_API_KEY`)
- No database changes needed

### Files Changed/Created
1. `supabase/functions/ai-chat/index.ts` — New edge function for chatbot
2. `supabase/functions/ai-generate-description/index.ts` — New edge function for descriptions
3. `src/components/AIChatWidget.tsx` — New chat widget component
4. `src/pages/Index.tsx` — Add chat widget
5. `src/pages/seller/SellerProductForm.tsx` — Add generate description button
6. `supabase/config.toml` — Add function configs

