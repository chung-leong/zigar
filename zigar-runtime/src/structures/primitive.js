import { mixin } from '../environment.js';
import { InvalidInitializer } from '../errors.js';
import { COPY } from '../symbols.js';
import { StructureType } from './all.js';

export default mixin({
  definePrimitive(structure, descriptors) {
    const {
      instance: { members: [ member ] },
    } = structure;
    const propApplier = this.createApplier(structure);
    const initializer = function(arg) {
      if (arg instanceof constructor) {
        this[COPY](arg);
      } else {
        if (arg && typeof(arg) === 'object') {
          if (propApplier.call(this, arg) === 0) {
            const type = getTypeName(member);
            throw new InvalidInitializer(structure, type, arg);
          }
        } else if (arg !== undefined) {
          set.call(this, arg);
        }
      }
    };
    const constructor = this.createConstructor(structure, { initializer });
    descriptors.$ = this.defineMember(member);
    descriptors[Symbol.toPrimitive] = { value: get };
    return constructor;
  },
  finalizePrimitive(structure, descriptors, staticDescriptors) {
    const {
      instance: { members: [ member ] },
    } = structure;
    staticDescriptors[TYPED_ARRAY] = defineValue(this.getTypedArray(member));
  },
});

export function isNeededByStructure(structure) {
  return structure.type === StructureType.Primitive;
}

function getTypeName({ type, bitSize }) {
  switch (type) {
    case MemberType.Bool: return 'boolean';
    case MemberType.Int:
    case MemberType.Uint:
      if (bitSize <= 32) {
        return 'bigint';
      }
    case MemberType.Float: return 'number';
  }
}
