import { StructureFlag } from '../constants.js';
import { mixin } from '../environment.js';
import { SLOTS, VISIT, VIVIFICATE } from '../symbols.js';
import { always } from '../utils.js';

export default mixin({
  defineVisitorStruct(structure, visitorOptions = {}) {
    const {
      isChildActive = always,
      isChildMutable = always,
    } = visitorOptions;
    const { instance: { members } } = structure;
    const pointerMembers = members.filter(m => m.structure?.flags & StructureFlag.HasPointer);
    const value = function visitPointers(cb, options = {}) {
      const {
        source,
        vivificate = false,
        isActive = always,
        isMutable = always,
      } = options;
      const childOptions = {
        ...options,
        isActive: (object) => {
          // make sure parent object is active, then check whether the child is active
          return isActive(this) && isChildActive.call(this, object);
        },
        isMutable: (object) => {
          return isMutable(this) && isChildMutable.call(this, object);
        },
      };
      for (const { slot } of pointerMembers) {
        if (source) {
          // when src is a the struct's template, most slots will likely be empty,
          // since pointer fields aren't likely to have default values
          const srcChild = source[SLOTS]?.[slot];
          if (!srcChild) {
            continue;
          }
          childOptions.source = srcChild;
        }
        const child = this[SLOTS][slot] ?? (vivificate ? this[VIVIFICATE](slot) : null);
        if (child) {
          child[VISIT](cb, childOptions);
        }
      }
    };
    return { value };
  }
});

export function isNeededByStructure(structure) {
  const { type, flags } = structure;
  switch (type) {
    case StructureType.ArgStruct:
    case StructureType.VariadicStruct:
    case StructureType.Struct:
    case StructureType.Union:
    case StructureType.ErrorUnion:
    case StructureType.Optional:
      return !!(flags & StructureFlag.HasPointer);
  }
  return false;
}
