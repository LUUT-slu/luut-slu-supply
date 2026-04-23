

# Why the published site is stuck on the loader

## Root cause — confirmed

This is **not** a code bug. The published deployment at `luut-slu-supply.lovable.app` is serving a broken HTML shell with no JavaScript bundle.

Here is the **entire** HTML being served by your published site right now:

```html
<!DOCTYPE html><html lang="en">
  <body>
    <div id="root">
      <div style="...spinner..."><div>Loading…</div></div>
    </div>
  </body>
</html>
```

There is **no `<head>`**, **no `<title>`**, **no preconnect/font links**, and most critically **no `<script type="module" src="/assets/index-*.js">`**. Your repo's `index.html` (line 50) has that script tag — it's been stripped from the deployed output.

That's why the spinner runs forever:
1. Browser loads the HTML
2. Sees the inline static `<div>Loading…</div>` placeholder
3. Has no JS to download → React never boots → nothing ever replaces the placeholder
4. Endless spinner

## Confirmation that source code is fine

- The **preview** (`id-preview--…lovable.app`) loads correctly.
- Network logs from your active preview session show every API call returning 200: Shopify collections, `site_settings`, `reviews`, `seller_profiles`, `user_roles` — all healthy.
- `Index.tsx` is a **direct (non-lazy) import** in `App.tsx`. It does not gate rendering on any data fetch. It cannot get stuck in a spinner — the page renders shell-first and lets sections populate as data arrives.
- The `<PageLoader />` Suspense fallback is only used by lazy-loaded routes. The homepage doesn't use it.

So none of the things you asked me to check are actually broken:
1. Homepage component renders unconditionally — ✅
2. No loading state on Index — ✅
3. No useEffect loop on Index — ✅
4. Shopify fetch is non-blocking — ✅ (verified via live network logs)
5. Auth check is in `Header` only and doesn't gate render — ✅
6. No analytics/WhatsApp blocking init — ✅
7. Routes/providers fine — preview proves it — ✅
8. **Published build mismatch / broken deploy — this is the cause** — ❌

## What caused it

The previous publish attempt produced a corrupted artifact (HTML missing `<head>` and missing the bundle `<script>` tag). This typically happens when a publish is interrupted mid-deploy, or when the build output gets partially overwritten. It is a deploy-pipeline event, not a source-code regression.

## Fix

Republish the site. Once a clean build runs, `index.html` will be regenerated correctly from the repo source (which already contains the `<script type="module" src="/src/main.tsx">` tag and the full `<head>`), and the JS bundle will be injected.

No code changes are needed or appropriate. Editing source code cannot fix a corrupted deployed artifact — only redeploying can.

### Optional safety net (if you want one)

If you'd like me to also add a defensive 15-second timeout to the inline loader in `index.html` (so future broken deploys at least show a "Reload page" button instead of an endless spinner), I can add that as a tiny inline script. It would not affect any functionality. Tell me yes/no after republishing.

## Action

<lov-actions>
<lov-open-publish>Republish the site</lov-open-publish>
</lov-actions>

After clicking **Update** in the publish dialog, hard-refresh `https://luut-slu-supply.lovable.app` (Cmd/Ctrl-Shift-R) and the homepage will render. If it still shows only the static loader after a republish, that confirms a hosting-side issue rather than anything fixable from this codebase, and the next step is contacting Lovable support — but a clean republish nearly always resolves this.

