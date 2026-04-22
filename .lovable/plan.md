

## Black-screen safety net + cache reset

### What's actually wrong
Nothing right now. The preview renders correctly (verified in browser: hero, header, nav, chat widget all visible; 150/150 network requests returned 200). The black screen was caused by the **previous** Vite chunking change splitting React / react-query / Supabase across chunks, which was already reverted last turn — all four are now consolidated into one `react-vendor` chunk.

The remaining problem is that **if a future startup error ever happens, the `<div id="root">` stays empty** and the user sees a blank page with no message. We'll fix that.

### Changes

**1. Add a top-level `ErrorBoundary` (new file `src/components/ErrorBoundary.tsx`)**

A class component that catches any render-time error in the tree, logs it, and shows a visible fallback UI with a "Reload" button — instead of an empty `<div>`.

**2. Wrap the app in `src/App.tsx`**

Wrap the `<QueryClientProvider>` subtree in `<ErrorBoundary>` so:
- A crash in any provider, route, or page shows the fallback (not a black screen).
- The fallback offers a one-click reload that also clears the stale `chunk_reload` sessionStorage flag (so the lazyRetry helper isn't stuck).

**3. Add a non-JS fallback in `index.html`**

Inside `<div id="root">`, put a minimal inline-styled "Loading…" block + `<noscript>` message. This guarantees the screen is never literally black — even before any JS executes or if JS is disabled.

**4. Bump module cache by clearing the lazyRetry sentinel on app boot**

In `src/main.tsx`, add `sessionStorage.removeItem("chunk_reload")` on startup so a once-broken session can't get into a "won't retry" state after we ship a fix.

### Files touched
- `src/components/ErrorBoundary.tsx` — new
- `src/App.tsx` — wrap providers in `<ErrorBoundary>`
- `src/main.tsx` — clear stale chunk-reload flag on boot
- `index.html` — inline loading fallback inside `#root`

### Out of scope
- Reworking Vite chunking (already correct — React + ecosystem in one chunk).
- Any auth / session / data-loading changes (the page renders fine without them).
- Changing the Header, Index, or any feature component.

### Verification
- Hard-refresh the preview → page renders (already works).
- Temporarily throw inside `<Index>` → fallback "Something went wrong" card shows with a Reload button (not a black screen).
- Disable JS in devtools → "This site requires JavaScript" message visible (not black).
- Clear sessionStorage and reload → no `chunk_reload` value lingers.

### If you still see black on your end
That's a stale browser cache from the old broken chunks. After this ships, do one hard reload (Cmd/Ctrl-Shift-R) — the safety net guarantees you'll see either the homepage or a clear error card, never an empty page again.

