//@ts-check

/** @import {EMC} from './types/mount-observer/types' */;
/** @import {AllProps, Actions} from './types/gist-in/types' */
/** @import {RAConfig} from './types/roundabout/types' */

/**
 * @type {EMC<any, AllProps, Element, RAConfig<AllProps, Actions> >}
 */
export const emc = {
    enhConfig: {
        enhKey: 'GistIn',
        spawn: 'gist-in/gist-in.js',
        withAttrs: {
            base: 'gist-in',
            _base: { mapsTo: 'url', instanceOf: 'String' },
            markerName: '${base}-for',
            forHint: '${base}-for-hint',
            showEditLink: '${base}-show-edit-link',
            _showEditLink: { instanceOf: 'Boolean' },
            sanitizer: '${base}-sanitizer',
            _sanitizer: { instanceOf: 'Object' },
            method: '${base}-method',
        }
    },
    customData: {
        weakRef: {
            properties: ['enhancedElement']
        },
        actions: {
            hydrate: {
                ifAllOf: ['url', 'markerName', 'enhancedElement']
            }
        },
        defaultPropVals: {
            method: 'setHTML',
        }
    }
};

export function render(){
    return JSON.stringify(emc, null, 4);
}

console.log(render());
