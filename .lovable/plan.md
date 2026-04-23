
# Fix the live production bootstrap failure

## Confirmed production-only root cause

The live site is no longer failing because of a missing script tag.

What the production checks confirmed on `https://luut-slu-supply.lovable.app/`:

- The live HTML now includes the built entry script:
  - `/assets/index-D7C-PLAO.js`
- The main production assets all return `200`:
  - `index-D7C-PLAO.js`
  - `react-vendor-DdwU5BHh.js`
  - `radix-6PHzDgb5.js`
  - `index-Co_o2SY6.css`
- The live document is serving a current deployment:
  - `x-deployment-id: 8608796b-e720-4810-8895-c8deba2cfd15`
- There are no failed chunk or asset requests during bootstrap.
- The recharts/charts fix is already live:
  - the live entry no longer references a separate `charts` chunk.

The exact bootstrap failure is now this runtime crash in production console:

```text
TypeError: Cannot read properties of undefined (reading 'forwardRef')
at https://luut-slu-supply.lovable.app/assets/radix-6PHzDgb5.js
```

## Exact cause

This is a production chunk-splitting bug in `vite.config.ts`, not a homepage/data issue.

Current `manualChunks` still forces `@radix-ui` into its own `radix` chunk:

```ts
if (id.includes("@radix-ui")) return "radix";
```

But the live built files show a circular dependency between the two startup chunks:

```text
radix-6PHzDgb5.js -> imports React from react-vendor-DdwU5BHh.js
react-vendor-DdwU5BHh.js -> imports helpers from radix-6PHzDgb5.js
```

That circular init order means `radix` executes before the React export it needs is ready, so `forwardRef` is undefined and the app crashes before React mounts.

## The recent change causing this outage

The current `manualChunks` strategy in `vite.config.ts` is the cause.

The earlier recharts fix removed the old `charts` TDZ failure, but leaving `@radix-ui` split into a separate `radix` chunk created a new production-only bootstrap cycle between `radix` and `react-vendor`.

## What to change

### 1. Fix chunking in `vite.config.ts`
Make startup dependencies load in one direction only.

Implementation:
- remove the dedicated `radix` chunk rule:
  - `if (id.includes("@radix-ui")) return "radix";`
- bundle `@radix-ui` with `react-vendor`, or simplify `manualChunks` further so Vite handles it safely
- keep the recharts protection, but avoid any split where `react-vendor` and UI primitives import each other across chunks

Preferred safe change:
- move `@radix-ui` into `react-vendor`

## 2. Rebuild and republish a fresh production build
Goal:
- generate new hashed assets
- replace deployment `8608796b-e720-4810-8895-c8deba2cfd15`
- ensure live HTML points to the new asset set

This is not primarily a cache invalidation issue:
- the live HTML already has `cache-control: no-cache, must-revalidate, max-age=0`

So the correct fix is a fresh publish after the chunking fix, not just waiting for cache expiry.

## 3. Add minimal boot diagnostics
In `src/main.tsx` and/or startup error handling:
- log a clear boot marker when React starts
- log uncaught chunk/bootstrap errors once in production
- keep the timeout fallback, but make it diagnostic rather than the first clue

This makes future publish regressions immediately identifiable on the live domain.

## 4. Verify on the live domain after publish
Production verification should confirm all of the following on `https://luut-slu-supply.lovable.app/`:

1. Document response contains the built asset tags.
2. New deployment id is present in response headers.
3. Main JS entry returns `200`.
4. No bootstrap console error from `radix-*.js`.
5. No circular `react-vendor` <-> `radix` startup crash remains.
6. Homepage renders actual content instead of the loading shell.

## 5. Rollback rule if needed
If the first corrected publish still fails on the live domain:
- immediately restore the last known-good History version
- then reapply only the chunking fix and republish again

## Files to change
- `vite.config.ts`
- optionally `src/main.tsx` for production boot diagnostics

## Expected outcome
- live production boots React normally
- homepage opens on the published domain
- no missing chunks
- no `forwardRef` bootstrap crash
- recharts fix remains in place without reintroducing the old charts error
