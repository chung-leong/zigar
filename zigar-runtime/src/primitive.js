import { getCompatibleTags, getTypedArrayClass } from './data-view.js';
import { throwInvalidInitializer } from './error.js';
import { MemberType, getDescriptor, isByteAligned } from './member.js';
import { getDestructor, getMemoryCopier } from './memory.js';
import { convertToJSON, getBase64Descriptor, getDataViewDescriptor, getTypedArrayDescriptor, getValueOf, normalizeValue } from './special.js';
import { attachDescriptors, createConstructor, createPropertyApplier } from './structure.js';
import { ALIGN, COMPAT, COPIER, NORMALIZER, SIZE } from './symbol.js';

export function definePrimitive(structure, env) {
  const {
    byteSize,
    align,
    instance: { members: [ member ] },
  } = structure;
  const { get, set } = getDescriptor(member, env);
  const propApplier = createPropertyApplier(structure);
  const initializer = function(arg) {
    if (arg instanceof constructor) {
      this[COPIER](arg);
    } else {
      if (arg && typeof(arg) === 'object') {
        if (propApplier.call(this, arg) === 0) {
          const type = getPrimitiveType(member);
          throwInvalidInitializer(structure, type, arg);
        }
      } else if (arg !== undefined) {
        set.call(this, arg);
      }
    }
  };
  const constructor = structure.constructor = createConstructor(structure, { initializer }, env);
  const typedArray = structure.typedArray = getTypedArrayClass(member);
  const instanceDescriptors = {
    $: { get, set },
    dataView: getDataViewDescriptor(structure),
    base64: getBase64Descriptor(structure),
    typedArray: typedArray && getTypedArrayDescriptor(structure),
    valueOf: { value: getValueOf },
    toJSON: { value: convertToJSON },
    delete: { value: getDestructor(env) },
    [Symbol.toPrimitive]: { value: get },
    [COPIER]: { value: getMemoryCopier(byteSize) },
    [NORMALIZER]: { value: normalizeValue },
  };
  const staticDescriptors = {
    [COMPAT]: { value: getCompatibleTags(structure) },
    [ALIGN]: { value: align },
    [SIZE]: { value: byteSize },
  };
  return attachDescriptors(constructor, instanceDescriptors, staticDescriptors);
};

export function getIntRange(member) {
  const { type, bitSize } = member;
  const signed = (type === MemberType.Int);
  let magBits = (signed) ? bitSize - 1 : bitSize;
  if (bitSize <= 32) {
    const max = 2 ** magBits - 1;
    const min = (signed) ? -(2 ** magBits) : 0;
    return { min, max };
  } else {
    magBits = BigInt(magBits);
    const max = 2n ** magBits - 1n;
    const min = (signed) ? -(2n ** magBits) : 0n;
    return { min, max };
  }
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

export function isExtendedType(member) {
  if (!isByteAligned(member)) {
    return true;
  }
  const { type, bitSize } = member;
  if (type === MemberType.Int || type === MemberType.EnumerationItem) {
    return !(bitSize === 8 || bitSize === 16 || bitSize === 32 || bitSize === 64);
  } else if (type === MemberType.Float) {
    return !(bitSize === 32 || bitSize === 64);
  } else {
    return false;
  }
}
