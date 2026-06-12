## Meta Pixel Tracking

Insert the provided Meta (Facebook/Instagram) Pixel code block into `index.html` immediately after the opening `<head>` tag. No other file changes.

**Technical detail:**
- File: `index.html`
- Insertion point: line 3, right after `<head>`
- The block contains the `fbq` init script, PageView event, and noscript fallback image.

**Verification:**
- Build the project to confirm no syntax errors.
- Confirm the snippet appears in the rendered `<head>`.

No configuration changes, no dependency installs, no backend work.