# Phase I implementation

## Bruce's Ask

Can you please scope out the [gist-in readme](../README.md) and list below what clarifications / concerns / suggestions for improvements you might have?

---

## Claude's Review

Repo is genuinely pre-implementation (just the README + a `types` submodule, no
source yet), so this is a spec review, not a code review. Grouped per your
three buckets.

### Clarifications needed

1. **`<?marker name="options">` is a comment node, not an element — this
   changes the whole discovery story.** HTML (unlike XML/XHTML) has no
   processing-instruction node type; the tokenizer treats any `<?…>` as a
   parse error and emits a **bogus comment**. So after the browser parses that
   markup, `<?marker name="options">` exists in the DOM as a `Comment` node
   whose data is roughly `?marker name="options"`. That means:
   - It is **never reachable via `querySelector`/`querySelectorAll`/CSS**
     (those only match elements) — so `document.all` doesn't help either (same
     elements-only limitation). The only ways to find it are `childNodes`
     traversal, or a `TreeWalker`/`NodeIterator` with
     `NodeFilter.SHOW_COMMENT`, or XPath's `comment()` node test via
     `document.evaluate`. I'd reach for `TreeWalker` — it's the modern,
     idiomatic answer to "find comment nodes matching a pattern" and doesn't
     need XPath's string-based query syntax.
   - This is also, I think, the *precise* reason `gist-in-for-hint` needs to
     name the marker's **parent**, not the marker itself — a CSS selector
     fundamentally cannot target the comment, only an element that contains
     it. Worth saying that explicitly in the README, since right now it reads
     as a performance optimization ("searching... is taxing") when it's
     actually closer to a hard requirement once you don't have the hint (full
     document walk with `SHOW_COMMENT`, vs. one element's `childNodes`).
   - Given that, is `<?marker name="…">` — a syntax that *looks* like it wants
     to be a distinct DOM node type but isn't one — the shape you want? A
     literal, deliberately-inert custom element (`<gist-in-marker
     name="options"></gist-in-marker>`) would sidestep the whole comment-node
     detour: it's directly reachable with
     `querySelector('gist-in-marker[name="options"]')`, no hint attribute
     needed at all, and no divergence from how every other enhancement in this
     ecosystem (`pipe-in`, `be-persistent`, …) is discovered. The tradeoff is
     it's a real (if unregistered) element sitting in the render tree rather
     than a comment, which matters if `<select>` (as in the example) can't
     legally contain arbitrary child elements per its content model — a
     comment node *can* sit inside a `<select>` without complaint, an unknown
     element technically can't. So the marker's *location* may be exactly why
     you reached for a comment in the first place — worth confirming that's
     the reasoning, because it changes which suggestion below actually helps.
   - Distinct from `pipe-in`'s own `<?start>`/`<?end>`: those never touch the
     DOM at all — `snip.js` matches them as plain substrings in the *raw
     fetched text*, before the browser ever parses it, so it doesn't matter
     that a real browser would mangle `<?start>` if it were parsed — it never
     is. `gist-in`'s `<?marker>` lives in the **host page**, which *is*
     parsed, so the comment-node behavior above applies to it and not to
     `pipe-in`'s markers. Two syntaxes that look alike but live in different
     worlds — worth calling that difference out explicitly in the docs so
     nobody assumes `[base]-start`/`[base]-end` parity.

2. **`gist-in-for` matching multiple markers / multiple parents.** If
   `gist-in-for-hint` is a selector that matches more than one element (e.g. a
   repeated card layout), or if more than one `<?marker name="options">`
   exists on the page, does one `<template gist-in-for="options">` patch *all*
   of them, or only the first? The README doesn't say. I'd guess "all," since
   that's the more generally useful default and matches a broadcast model, but
   it's worth being explicit, and it interacts with the caching/sharing
   question below (one fetch, patched into N locations, vs. N independent
   patches).

3. **Attribute-name drift between Phase I and the Phase II sketch.** The
   Phase-II mockup renames the carrying attribute from `gist-in` to
   `gist-in-resolved`, *and* drops the `gist-in-` prefix from `gist-in-for` down
   to a bare `for`:
   ```html
   <template gist-in-resolved="…" for="options" gist-in-show-edit-link>
   ```
   If that's deliberate — the server-processed marker family is a genuinely
   different, separately-recognized attribute set from the pending one — that's
   fine, but it should be stated, since it means two separate EMC/attribute
   registrations rather than one enhancement that also reacts to a `-resolved`
   variant. If it's just drift while sketching, `gist-in-for` staying
   `gist-in-for` seems more consistent with everything else in the doc. (You
   already flagged this whole section as "worked out in more detail later," so
   I'm not pushing to nail it down now — just noting it so it doesn't calcify
   accidentally.)

4. **The edit-link section names two different flags for what reads like one
   feature:** the attribute is `gist-in-show-edit-link`, but the query-string
   trigger is written as `?gist-in-show-link=true` (no "edit"). Same flag with
   a typo, or intentionally two different things — e.g. the attribute is an
   always-on author choice, the query param is a maintainer-only override for
   content that doesn't carry the attribute? Worth a one-line clarification
   either way.

5. **"With appropriate credentials"** (for showing the edit link) — does
   `gist-in` need to actively know whether the current viewer *can* edit
   (which implies some notion of a stored GitHub token/identity, the way
   `fifteenth`'s `configureGist({ getToken })` works), or does it just render
   a plain link to GitHub and let GitHub's own login wall turn away anyone
   without access? The phrase "appropriate credentials" reads like the former,
   but I don't see a mechanism described for gist-in to know that client-side.
   I'd lean toward the simpler version (always render the link; GitHub gates
   it) unless there's a reason to hide the link entirely from viewers who
   can't use it — but that's a product call, not mine to assume.
   Relatedly: the actual target URL (`urlToEditGist`) is a placeholder — worth
   confirming the exact GitHub URL shape before this gets built (gist edit
   isn't a separate `/edit` route the way some GitHub resources have one; the
   normal gist page is itself the edit UI when you're viewing as the owner).

6. **Is the EMC/be-hive architecture assumed?** The README never says so
   explicitly, but "similar to pipe-in" plus the copied "Viewing Locally"
   steps strongly imply the same `mount-observer` + `roundabout` + `be-hive`
   enhancement pattern `pipe-in` and `be-persistent` use (an `emc.mjs` /
   `emc.json`, attribute-driven discovery, a `hydrate` action). Worth
   confirming that's the intended shape before scaffolding, since it drives
   the whole file layout.

### Concerns

1. **This is `pipe-in`'s entire security surface, without `pipe-in`'s security
   section.** Both packages inject arbitrary remote HTML into a live page.
   `pipe-in`'s README has a substantial Security section (the same-origin /
   import-map-mapped trust gate for unsafe methods, CSP guidance, CORS-proxy
   notes). `gist-in`'s README currently has none — it mentions in passing that
   it "would always apply the standard, safe sanitizing pipe-in defaults to,"
   which is reassuring, but a reader arriving at `gist-in` on its own has no
   equivalent guidance. I'd want at least a pointer: "same trust model as
   pipe-in, see its Security section" — or a restated summary — before this
   ships.

2. **No mention of `pipe-in`'s dedup/sharing, state attributes, or events.**
   `pipe-in` documents `[base]-state` (`loading`/`streaming`/`complete`/`error`
   + `aria-busy`), `load`/`error` events, a `[base]-cache` policy, and
   in-tab stream sharing with a `sessionStorage` fallback so a second element
   fetching the same URL doesn't refetch. None of that is mentioned here. Two
   read on this: either it's all deliberately deferred for a minimal Phase I
   (fetch → sanitize → patch into marker, nothing else), or it's assumed to
   carry over silently because it's "similar to pipe-in." I'd want that made
   explicit, because it's exactly the surface Phase II needs symmetry with —
   my notes on [the pipe-in / spa-ssi
   integration](../../spa-ssi/Chats/IncorporatePipeIn.md) leaned on
   `[base]-state="complete"` as the signal a server-prefetched element uses to
   tell the client "don't redo this." If `gist-in` doesn't have an equivalent
   state attribute, Phase II (server pre-embeds the gist) has no way to tell
   Phase I's client-side enhancement to stand down — the same problem that
   conversation found already existed, unfixed, in `pipe-in.js` itself.

3. **Removing the template on success may remove the only place a "done"
   signal could live.** "I'm thinking the template could be removed after
   serving its purpose" is tidy, but if there's ever a state attribute (per
   the point above), or the edit-link needs a stable anchor, or Phase II needs
   to detect "already handled" the way `pipe-in`'s `[base]-state="complete"`
   guard would — all of those want *something* left behind after success. Worth
   deciding what (if anything) survives removal before committing to "remove
   it," rather than adding that back in later as a special case.

4. **CORS is actually a non-issue here — worth saying so, not leaving it
   implicit.** I confirmed this directly in unrelated recent work: `gist.
   githubusercontent.com` sends `Access-Control-Allow-Origin: *` on raw file
   reads, so the browser-side fetch in Phase I works cross-origin with no
   proxy, unauthenticated, for any public or secret (unlisted) gist. That's a
   genuine advantage over generic `pipe-in` targets (which need CORS
   cooperation from whatever's on the other end) and is worth a line in the
   README rather than leaving readers to wonder.

5. **`package.json` doesn't back up the "Viewing Locally" steps yet.** Minor,
   expected at this stage, but concrete: step 8 says `npm run build`, step 9
   `npm run serve` — neither script exists (`scripts` only has `test`); `main`
   points at an `index.js` that doesn't exist; there's no `dependencies` list
   (`assign-gingerly`, `mount-observer`, `roundabout-lib`, `be-hive`, `spa-ssi`
   as a dev dependency — whatever the EMC architecture in clarification #6
   ends up needing). Not a problem for a spec-stage repo, just flagging it so
   it's not forgotten once implementation starts.

### Suggestions

1. **Consider building this as a thin layer over `pipe-in` rather than a
   parallel reimplementation of fetch/sanitize/stream.** The genuinely new
   thing `gist-in` adds is the marker-indirection — resolving `gist-in-for`
   to a location elsewhere in the document and patching in there instead of
   at the attribute's own element. The fetch, sanitize, snip, and stream-into
   mechanics are otherwise identical to what `pipe-in.js` already does (and,
   per the concern above, already has documented state/event/sharing
   behavior worth inheriting for free rather than re-earning). Concretely:
   `gist-in`'s hydrate could resolve the marker/parent, then either invoke
   `pipe-in`'s streaming machinery directly against that resolved location, or
   the two could share a common lower-level module. That also means any future
   fix to `pipe-in` (like the `[base]-state="complete"` guard I flagged in the
   sibling conversation) benefits `gist-in` automatically instead of needing a
   parallel patch.

2. **Let the `gist-in` URL be a `fifteenth` `gist://` USL, not just a literal
   raw URL.** The exact shape in your examples —
   `https://gist.githubusercontent.com/<owner>/<id>/raw/<sha>/<file>` — is
   precisely what `fifteenth/gist.js`'s new raw-form addressing
   (`gist://<owner>/<id>/raw/<sha>/<file>`) produces and consumes, including an
   owner-less shorthand and an alias/id-store with self-healing owner lookup.
   Accepting either form would let `gist-in="gist://my-content-alias/raw/notes.html"`
   resolve through the same alias machinery `be-persistent`'s `💾` rules use,
   instead of every consumer having to hardcode a full owner/id/sha URL by
   hand. Purely optional — the literal-URL form you have works fine on its
   own — but it's a natural fit given how closely the two already line up, and
   I'm well placed to help wire it up having just built that side.

3. **A short Security section, even a short one**, mirroring `pipe-in`'s, so
   `gist-in` doesn't rely on a reader having also read `pipe-in`'s README to
   understand what it's trusting and why.

4. **Name the marker-search algorithm explicitly once the `<?marker>` question
   above is settled** — "`TreeWalker` scoped by `gist-in-for-hint`, falling
   back to a full-document walk with `NodeFilter.SHOW_COMMENT` if no hint is
   given" (or the CSS-selector marker-element alternative) — so the
   performance tradeoff the hint attribute exists for is explicit rather than
   implied by "can be taxing."

Happy to start scaffolding (package.json, emc, the marker-resolution piece)
once you've had a chance to react to the above — didn't want to build on
assumptions you might want to correct first.

## Bruce's Response I

> **`<?marker name="options">` is a comment node, not an element — this
   changes the whole discovery story.**

> Given that, is `<?marker name="…">` — a syntax that *looks* like it wants
     to be a distinct DOM node type but isn't one — the shape you want?

I added an [explanation to the README.md](../README.md#) for why this more difficult path is being adopted.  Let me know if that is convincing or not.

> so `document.all` doesn't help either (same
     elements-only limitation)

Thanks for the info.  I updated the README.md to reflect your insight.

> **`gist-in-for` matching multiple markers / multiple parents.**

Just as with the new platform api linked to in the README.md, the match should be based on the first one found.  The content should replace the markers, just as the platform does.

> **Attribute-name drift between Phase I and the Phase II sketch.** 

I got a little sloppy there.  But I was envisioning that server side substitutions indicate to the browser that the substitution already took place by replacing gist-in attribute with gist-in-resolved.

Anyway, we can discuss that further should we ever decide to embark on phase II
> he edit-link section names two different flags for what reads like one
   feature:** the attribute is `gist-in-show-edit-link`, but the query-string
   trigger is written as `?gist-in-show-link=true` (no "edit"). 

Typo:  `?gist-in-show-edit-link=true`

>  does `gist-in` need to actively know whether the current viewer *can* edit
   (which implies some notion of a stored GitHub token/identity, the way
   `fifteenth`'s `configureGist({ getToken })` works), or does it just render
   a plain link to GitHub and let GitHub's own login wall turn away anyone
   without access?

The latter.  I updated the README.md to make that clearer, I hope.

> worth confirming the exact GitHub URL shape before this gets built (gist edit
   isn't a separate `/edit` route the way some GitHub resources have one; the
   normal gist page is itself the edit UI when you're viewing as the owner).

Correct.  I rely on your expertise to see if it is possible to infer the edit url from the raw one.

> **Is the EMC/be-hive architecture assumed?**

Yes.

>  **No mention of `pipe-in`'s dedup/sharing, state attributes, or events.**

Based on the fall back platform support, that provides no such support, I'm thinking we don't adopt something beyond what the platform supports.  But this can be revisited as more use cases are explored.

---

## Claude's Response II

Short answer: **close, and I don't think anything left is a blocker** — a
couple of small README fixes, two of my earlier suggestions you didn't react
to yet (worth a yes/no before I scaffold so I build the right shape the first
time), and the two research items you handed me, done below.

### The `<?marker>` justification — checked it, it holds up

I fetched the linked Chrome article rather than go on memory, since this is
load-bearing for the whole design. It confirms your read precisely: the
proposal's own examples are

```html
<div><?marker name="placeholder"></div>
<template for="placeholder">Here is some <em>HTML content</em>!</template>
```

and the range form

```html
<div><?start name="x">Loading…<?end></div>
```

— i.e. `<?marker>` / `<?start>`/`<?end>` *are* the platform's own vocabulary
for this, not something you invented in its shape. So "aligns with where the
platform is headed" is accurate, not just aspirational. Convincing — I'd keep
it.

One nuance worth flagging, not as a problem with the choice, just for whoever
writes the marker-finding code: the article's examples describe the
*proposed* native behavior once a browser implements this feature end-to-end
(where the platform's own patching may not need to expose these as ordinary
`Comment` nodes to script at all — "patching without affecting the DOM" reads
like the native implementation could special-case the tokens internally).
Until/unless that ships, what gist-in's own userland code sees today, in a
real browser parsing this markup right now, is still an ordinary bogus-comment
`Comment` node (same HTML-tokenizer behavior as always — `<?` isn't a
recognized construct in HTML proper yet). That doesn't change your decision at
all — it just means the `TreeWalker`/`SHOW_COMMENT` approach is the correct
*implementation technique* for gist-in's own scan, independent of whatever the
platform eventually does natively once this ships for real.

### The edit URL — inferable, and I verified it live rather than guess

```
raw:  https://gist.githubusercontent.com/<owner>/<id>/raw/<sha>/<file>
edit: https://gist.github.com/<owner>/<id>/edit#file-<file, '.' → '-', lowercased>
```

Checked against the actual example gist in the README
(`bahrus/3c9ed8541984b8cd38bc848edacf741a`, file `test.html`):

- `https://gist.github.com/bahrus/3c9ed8541984b8cd38bc848edacf741a` → `200`,
  the real gist page, and it contains `id="file-test-html"` — confirming the
  anchor slug is just the filename with `.` → `-`, lowercased.
- `.../edit` is a genuine, distinct route, not a redirect back to the plain
  page — hitting it unauthenticated 302s to
  `gist.github.com/auth/github?return_to=…%2Fedit`, i.e. GitHub itself sends
  you *back to that same edit URL* after login. That's exactly "guarded by
  github.com itself" — construct the `/edit#file-…` URL unconditionally, no
  credential-awareness needed on gist-in's side at all, matching what you
  already settled on.

So: `<owner>/<id>` come from the parts of the raw URL already in hand,
`<file>` is the already-known filename, slugified with a plain `.`→`-` +
lowercase (I only verified one filename shape — worth a second real example if
one ever has dots elsewhere in the name or non-ASCII characters, but the rule
is simple enough I'd be surprised if it's more than that).

### Two small README things to fix before implementation starts

1. The sanitizer line has a broken link — `` `For now, this would always apply the standard, []"safe" sanitizing that pipe-in defaults to](https://github.com/bahrus/pipe-in#security).` `` — stray `[]` before the quote, so it won't render as a link at all. I think you want: `` the standard ["safe" sanitizing that pipe-in defaults to](https://github.com/bahrus/pipe-in#security) ``.
2. `element.getElementRoot()` isn't a real DOM method — the actual API is
   [`Node.getRootNode()`](https://developer.mozilla.org/en-US/docs/Web/API/Node/getRootNode)
   (returns the `Document`, or the nearest `ShadowRoot`). Small, but worth
   fixing before anyone implements against the name as written.

Also purely cosmetic, not blocking: "Why comment markers?" bullet 1 is really
answering "why a `<template>` for the fetch directive" (so it can sit anywhere,
e.g. bottom of the page) — a different question from bullets 2–3 ("why a
comment for the *marker*"). Might read clearer split into two short
sub-answers, but that's a polish call, not a correctness one.

### Two suggestions from my first pass I don't think you've weighed in on yet

Everything else I raised got an answer; these two didn't, and both change what
gets scaffolded, so I'd rather ask than guess:

1. **Reuse `pipe-in`'s fetch/sanitize/stream code, even with none of its extra
   state/event/sharing surface turned on.** You've settled "don't adopt
   anything beyond what the platform supports" for *features* — but that's
   orthogonal to whether the actual fetch-and-sanitize-and-stream-into-target
   mechanics are a fresh implementation in `gist-in` or a call into `pipe-in`'s
   existing, tested code for that one piece. Reusing it costs nothing feature-
   wise (you'd just never touch the state/event/sharing bits) and means a bug
   fix in one benefits both. Want that, or is `gist-in` meant to be fully
   independent of `pipe-in` as a dependency?
2. **Accept a `fifteenth` `gist://` USL as an alternative to a literal raw
   URL.** Still on the table from before — purely additive, the literal URL
   form keeps working either way. Worth doing for v1, or defer until there's
   an actual use case for the alias indirection?

If you'd rather not spend more time on either and just want me to pick the
minimal path (no `pipe-in` dependency, literal URLs only) and start
scaffolding, say so and I'll go — neither is a blocker, they're just the kind
of thing that's cheap to decide now and annoying to redo after the fact.

## Bruce's Response II

>  **Reuse `pipe-in`'s fetch/sanitize/stream code

Great idea.

> **Accept a `fifteenth` `gist://` USL as an alternative to a literal raw
   URL.**

Sounds good.  Please proceed with implementation and add your implementation notes below.



