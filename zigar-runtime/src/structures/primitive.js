import { StructureType } from '../constants.js';
import { mixin } from '../environment.js';
import { InvalidInitializer } from '../errors.js';
import { BIT_SIZE, COPY, INITIALIZE, PRIMITIVE, TYPED_ARRAY } from '../symbols.js';
import { defineValue } from '../utils.js';

export default mixin({
  definePrimitive(structure, descriptors) {
    const {
      instance: { members: [ member ] },
    } = structure;
    const propApplier = this.createApplier(structure);
    const { get, set } = this.defineMember(member);
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
    const constructor = this.createConstructor(structure);
    descriptors.$ = { get, set: initializer };
    descriptors[INITIALIZE] = defineValue(initializer);
    descriptors[Symbol.toPrimitive] = defineValue(get);
    return constructor;
  },
  finalizePrimitive(structure, descriptors, staticDescriptors) {
    const {
      instance: { members: [ member ] },
    } = structure;
    const typedArray = this.getTypedArray(member);
    if (typedArray) {
      staticDescriptors[TYPED_ARRAY] = defineValue(typedArray);
    }
    staticDescriptors[BIT_SIZE] = defineValue(member.bitSize);
    staticDescriptors[PRIMITIVE] = defineValue(member.type);
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
