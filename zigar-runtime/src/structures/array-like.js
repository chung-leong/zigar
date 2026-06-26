import { ArrayFlag, SliceFlag, StructureType } from '../constants.js';
import { mixin } from '../environment.js';
import { MEMORY, NO_CACHE, PARENT, RESTORE, SLOTS } from '../symbols.js';
import { defineProperties } from '../utils.js';

export default mixin({
  defineFinalizerArray({ get, set }) {
    return {
      value() {
        defineProperties(this, {
          get: { value: get.bind(this) },
          set: set && { value: set.bind(this) },
        });
        return this;
      },
    };
  },
  defineVivificatorArray(structure) {
    const { instance: { members: [ member ]} } = structure;
    const { byteSize, structure: elementStructure } = member;
    const thisEnv = this;
    const value = function getChild(index) {
      const { constructor } = elementStructure;
      const dv = (process.env.TARGET === 'wasm') ? this[RESTORE]() : this[MEMORY];
      const parentOffset = dv.byteOffset;
      const offset = parentOffset + byteSize * index;
      const childDV = thisEnv.obtainView(dv.buffer, offset, byteSize, !dv[NO_CACHE]);
      const object = this[SLOTS][index] = constructor.call(PARENT, childDV);
      return object;
    };
    return { value };
  },
  hasStringProperty(structure) {
    switch (structure.type) {
      case StructureType.Array:
        if (structure.flags & ArrayFlag.IsString) {
          return true;
        }
      case StructureType.Slice:
        if (structure.flags & SliceFlag.IsString) {
          return true;
        }
    }
    switch (structure.type) {
      case StructureType.Array:
      case StructureType.Slice:
      case StructureType.Optional:
      case StructureType.ErrorUnion:
      case StructureType.Pointer:
        return this.hasStringProperty(structure.instance.members[0].structure);
    }  
    return false;
  }  
});
