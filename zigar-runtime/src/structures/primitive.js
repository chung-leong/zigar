import { getTypedArrayClass } from '../../data-view.js';
import { mixin } from '../class.js';
import { InvalidInitializer } from '../error.js';
import { BIT_SIZE, COPIER, PRIMITIVE } from '../symbol.js';
import { StructureType } from './all.js';

export default mixin({
  definePrimitive(structure) {
    const {
      byteSize,
      align,
      instance: { members: [ member ] },
    } = structure;
    const { get, set } = this.getDescriptor(member);
    const propApplier = this.createPropertyApplier(structure);
    const initializer = function(arg) {
      if (arg instanceof constructor) {
        this[COPIER](arg);
      } else {
        if (arg && typeof(arg) === 'object') {
          if (propApplier.call(this, arg) === 0) {
            const type = getPrimitiveType(member);
            throw new InvalidInitializer(structure, type, arg);
          }
        } else if (arg !== undefined) {
          set.call(this, arg);
        }
      }
    };
    const constructor = structure.constructor = this.createConstructor(structure, { initializer });
    const instanceDescriptors = {
      $: { get, set },
      [Symbol.toPrimitive]: { value: get },
    };
    const staticDescriptors = {
      [BIT_SIZE]: { value: member.bitSize },
      [PRIMITIVE]: { value: member.type },
    };
    structure.TypedArray = getTypedArrayClass(member);
    return this.attachDescriptors(structure, instanceDescriptors, staticDescriptors);
  }
});

export function isNeededByStructure(structure) {
  return structure.type === StructureType.Primitive;
}

export function getPrimitiveClass({ type, bitSize }) {
  if (type === MemberType.Int || type === MemberType.Uint) {
    if (bitSize <= 32) {
      return Number;
    } else {
      return BigInt;
    }
  } else if (type === MemberType.Float) {
    return Number;
  } else if (type === MemberType.Bool) {
    return Boolean;
  }
}

export function getPrimitiveType(member) {
  const Primitive = getPrimitiveClass(member);
  if (Primitive) {
    return typeof(Primitive(0));
  }
}