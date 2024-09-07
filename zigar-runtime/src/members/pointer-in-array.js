import { StructureFlag } from '../constants.js';
import { mixin } from '../environment.js';
import { SLOTS, VISIT, VIVIFICATE } from '../symbols.js';

export default mixin({
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

export function isNeededByStructure(structure) {
  const { type, flags } = structure;
  switch (type) {
    case StructureType.Array:
    case StructureType.Slice:
      return !!(flags & StructureFlag.HasPointer);
  }
  return false;
}