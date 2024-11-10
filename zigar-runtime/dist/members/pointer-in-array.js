import { mixin } from '../environment.js';
import { SLOTS, VIVIFICATE, VISIT } from '../symbols.js';
import { always } from '../utils.js';

var pointerInArray = mixin({
  defineVisitorArray(structure) {
    const value = function visitPointers(cb, options = {}) {
      const {
        source,
        vivificate = false,
        isActive = always,
        isMutable = always,
      } = options;
      const childOptions = {
        ...options,
        isActive: () => isActive(this),
        isMutable: () => isMutable(this),
      };
      for (let i = 0, len = this.length; i < len; i++) {
        // no need to check for empty slots, since that isn't possible
        if (source) {
          childOptions.source = source?.[SLOTS][i];
        }
        const child = this[SLOTS][i] ?? (vivificate ? this[VIVIFICATE](i) : null);
        if (child) {
          child[VISIT](cb, childOptions);
        }
      }
    };
    return { value };
  },
});

export { pointerInArray as default };
