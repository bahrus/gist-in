// @ts-check
/** @import {Actions, PAP, AllProps, AP} from './types/gist-in/types' */;
/** @import {RoundaboutOptions} from './types/roundabout/types' */;
/** @import {ElementEnhancementGateway, SpawnContext} from './types/assign-gingerly/types' */;
/** @import {EMC} from './types/mount-observer/types' */;
/** @import {RAConfig} from './types/roundabout/types' */;

/**
 * @implements {Actions}
 */
class GistIn {

    /**
     * @this {AllProps & Actions}
     * @param {Element & ElementEnhancementGateway} enhancedElement
     * @param {SpawnContext} ctx
     * @param {PAP} initVals
     */
    constructor(enhancedElement, ctx, initVals){
        this.init(this, enhancedElement, ctx, initVals);
    }

    /**
     * @param {AllProps} self
     * @param {Element & ElementEnhancementGateway} enhancedElement
     * @param {SpawnContext} ctx
     * @param {PAP} initVals
     */
    async init(self, enhancedElement, ctx, initVals){
        const {customData} = /** @type {EMC<any, AllProps, Element, RAConfig<AllProps, Actions>>} */ (ctx.emc);
        /**
         * @type {RoundaboutOptions}
         */
        const raOptions = {
            ...customData,
            vm: self,
            initialPropVals: {
                enhancedElement,
                ...customData?.defaultPropVals,
                ...initVals
            }
        };
        (await import('roundabout-lib/roundabout.js')).roundabout(raOptions);
    }

    /**
     * Finds the `<template gist-in="…" gist-in-for="…">`'s marker, fetches
     * the content (via a plain `fetch()`, or via `fifteenth`'s `get()` for a
     * `gist://` USL), sanitizes it into a scratch element using `pipe-in`'s
     * `fetch-and-set.js` helper, then swaps that content in for the marker
     * comment. Removes the template on success.
     * @param {AP} self
     * @returns {import('./types/gist-in/types').ProPAP}
     */
    async hydrate(self){
        const { enhancedElement, url, markerName, forHint, showEditLink, sanitizer, method } = self;

        const root = /** @type {Document | ShadowRoot} */ (enhancedElement.getRootNode());
        const marker = this.#findMarker(root, markerName, forHint);
        if(!marker){
            console.warn(`[gist-in] marker "${markerName}" not found (searched ${forHint ? `"${forHint}"` : 'the whole root'}).`);
            return /** @type {PAP} */ ({resolved: false});
        }

        // `gist-in-method=setHTMLUnsafe` / `gist-in-sanitizer` — the
        // platform's *default* sanitizer strips elements like `<option>`
        // entirely (verified), so patching real form controls (the README's
        // own flagship example) needs one of these, same escape hatches
        // `pipe-in` documents for its own `[base]-sanitizer` / `*Unsafe`
        // methods — gated exactly the same way `pipe-in.js` gates them.
        const { fetchText, setInto, isOverrideTrusted } = await import('pipe-in/fetch-and-set.js');
        const wantsOverride = method === 'setHTMLUnsafe' || sanitizer !== undefined;
        // A `gist://` USL's real destination is always the fixed
        // gist.githubusercontent.com CDN, never attacker-steerable via the
        // alias/owner/id — trusted the same way a same-origin path is,
        // without needing an import-map entry pointed at that host too.
        const isGistUsl = url.startsWith('gist://');
        if(!isGistUsl && !isOverrideTrusted(url, wantsOverride)){
            console.warn(
                `[gist-in] Security: "${method}"${sanitizer !== undefined ? ' with a custom sanitizer' : ''} ` +
                `requires a same-origin path, an import-map-mapped bare specifier, or a gist:// USL. ` +
                `URL "${url}" is not permitted.`
            );
            return /** @type {PAP} */ ({resolved: false});
        }

        // A detached scratch element to receive the sanitized content — never
        // inserted into the document at all; `setHTML`/`setHTMLUnsafe` (see
        // `pipe-in/fetch-and-set.js`) work fine on a fully detached element.
        const scratch = document.createElement('div');
        const setOpts = { unsafe: method === 'setHTMLUnsafe', sanitizer };

        try {
            if(isGistUsl){
                await this.#ensureGistProtocol();
                const { get } = await import('fifteenth/get.js');
                const content = await get(url);
                if(content == null){
                    throw new Error(`no content found for "${url}" (unmapped alias, or the gist/file doesn't exist)`);
                }
                const text = typeof content === 'string' ? content : JSON.stringify(content);
                setInto(scratch, text, setOpts);
            } else {
                const text = await fetchText(url);
                setInto(scratch, text, setOpts);
            }

            const nodes = Array.from(scratch.childNodes);
            marker.replaceWith(...nodes);
        } catch(e) {
            console.error(`[gist-in] failed to fetch/patch "${url}":`, e);
            return /** @type {PAP} */ ({resolved: false});
        }

        if(this.#wantsEditLink(showEditLink)){
            const link = this.#buildEditLink(url);
            if(link) enhancedElement.after(link);
        }

        // "The template could be removed after serving its purpose."
        enhancedElement.remove();

        return /** @type {PAP} */ ({resolved: true});
    }

    /**
     * gist-in only ever *reads* — it never needs `getToken`, unlike
     * `be-persistent`'s use of `gist://`, which also writes. So it can safely
     * register `fifteenth`'s `gist` protocol itself, with no host-page setup
     * required, *as long as nothing already has* — a page that also uses
     * `gist://` for its own (write-capable) purposes via `configureGist()`
     * keeps whatever config it set; gist-in never overwrites it.
     */
    async #ensureGistProtocol(){
        const { getProtocolReader } = await import('fifteenth/protocolRegistry.js');
        if(getProtocolReader('gist')) return;
        const { configureGist } = await import('fifteenth/gist.js');
        configureGist({ readVia: 'raw' });
    }

    /**
     * `<?marker name="…">` parses as a real `ProcessingInstruction` node
     * (`.target === 'marker'`, `.data === 'name="…"'`) — verified against a
     * real, current browser (this is *not* the "HTML has no PI node type,
     * `<?…>` becomes a bogus comment" behavior standard/older HTML parsing
     * describes; this build genuinely implements the Declarative Partial
     * Updates proposal's PI syntax). Either way it's invisible to
     * `querySelector`/CSS, so it needs a node-type-aware walk —
     * `TreeWalker` + `NodeFilter.SHOW_PROCESSING_INSTRUCTION` here. `hint`,
     * when given, narrows the walk to the subtree(s) of whichever element(s)
     * it matches; first marker found (in document order) wins.
     * @param {Document | ShadowRoot} root
     * @param {string} name
     * @param {string=} hint
     * @returns {ProcessingInstruction | null}
     */
    #findMarker(root, name, hint){
        const scopes = hint ? Array.from(root.querySelectorAll(hint)) : [root];
        for(const scope of scopes){
            const walker = document.createTreeWalker(scope, NodeFilter.SHOW_PROCESSING_INSTRUCTION);
            /** @type {ProcessingInstruction | null} */
            let node;
            while((node = /** @type {ProcessingInstruction | null} */ (walker.nextNode()))){
                if(node.target !== 'marker') continue;
                const m = /^name=(["'])(.*?)\1\s*$/.exec(node.data.trim());
                if(m && m[2] === name) return node;
            }
        }
        return null;
    }

    /**
     * `gist-in-show-edit-link` on the element, or the page-wide
     * `?gist-in-show-edit-link=true` query-string override.
     * @param {boolean} attrVal
     * @returns {boolean}
     */
    #wantsEditLink(attrVal){
        if(attrVal) return true;
        try {
            return new URLSearchParams(location.search).get('gist-in-show-edit-link') === 'true';
        } catch {
            return false;
        }
    }

    /**
     * Builds a link to GitHub's own gist edit view. GitHub itself gates
     * access (an unauthenticated or non-owner visitor is redirected to sign
     * in, then back to this same URL) — gist-in never needs to know who can
     * edit, it just always renders the link.
     *
     * Only handles the URL shapes that carry the owner + id directly (a
     * literal `gist.githubusercontent.com` raw URL, or the explicit
     * `gist://<owner>/<id>/raw[/<sha>]/<file>` USL) — an alias/`=<id>` USL
     * has no owner available without an extra resolution step, so no edit
     * link is produced for those (logged, not thrown).
     * @param {string} url
     * @returns {HTMLAnchorElement | null}
     */
    #buildEditLink(url){
        const httpUrl = url.startsWith('gist://')
            ? 'https://gist.githubusercontent.com/' + url.slice('gist://'.length)
            : url;
        const m = /^https:\/\/gist\.githubusercontent\.com\/([^/]+)\/([^/]+)\/raw\/(?:[^/]+\/)?([^/?#]+)$/.exec(httpUrl);
        if(!m){
            console.warn(`[gist-in] can't infer an edit URL from "${url}" (need an owner+id raw URL, or an owner/id gist:// form) — skipping the edit link.`);
            return null;
        }
        const [, owner, id, file] = m;
        const slug = file.toLowerCase().replaceAll('.', '-');
        const a = document.createElement('a');
        a.href = `https://gist.github.com/${owner}/${id}/edit#file-${slug}`;
        a.target = '_blank';
        a.rel = 'noopener';
        a.textContent = `Edit ${file}`;
        return a;
    }
}

export { GistIn }
