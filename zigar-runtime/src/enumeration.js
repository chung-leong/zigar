import { attachDescriptors, createConstructor, createPropertyApplier } from './structure.js';
import { MemberType, getDescriptor } from './member.js';
import { getDestructor, getMemoryCopier } from './memory.js';
import { getDataView, getTypedArrayClass } from './data-view.js';
import { throwInvalidInitializer } from './error.js';
import { ALIGN, ENUM_ITEM, ENUM_ITEMS, ENUM_NAME, MEMORY_COPIER, SIZE, VALUE_NORMALIZER } from './symbol.js';
import { getBase64Accessors, getDataViewAccessors, getTypedArrayAccessors, getValueOf } from './special.js';

export function defineEnumerationShape(structure, env) {
  const {
    byteSize,
    align,
    instance: {
      members: [ member ],
    },
  } = structure;
  const { get: getIndex } = getDescriptor(member, env);
  // get the enum descriptor instead of the int/uint descriptor
  const { get, set } = getDescriptor({ ...member, type: MemberType.EnumerationItem, structure }, env);
  const expected = [ 'string', 'number', 'tagged union' ];
  const propApplier = createPropertyApplier(structure);
  const initializer = function(arg) {
    if (arg && typeof(arg) === 'object') {
      if (propApplier.call(this, arg) === 0) {
        throwInvalidInitializer(structure, expected, arg);
      }
    } else {
      set.call(this, arg);
    }
  };
  const alternateCaster = function(arg) {
    if (typeof(arg)  === 'string') {
      return constructor[arg];
    } else if (typeof(arg) === 'number' || typeof(arg) === 'bigint') {
      return constructor[ENUM_ITEMS][arg];
    } else if (arg?.[ENUM_ITEM] instanceof constructor) {
      // a tagged union, return the active tag
      return arg[ENUM_ITEM];
    } else if (!getDataView(structure, arg, env)) {
      throwInvalidInitializer(structure, expected, arg);
    } else {
      return false;
    }
  };
  const constructor = structure.constructor = createConstructor(structure, { initializer, alternateCaster }, env);
  const typedArray = structure.typedArray = getTypedArrayClass(member);
  const instanceDescriptors = {
    $: { get, set },
    dataView: getDataViewAccessors(structure),
    base64: getBase64Accessors(structure),
    typedArray: typedArray && getTypedArrayAccessors(structure),
    valueOf: { value: getValueOf },
    toJSON: { value: getValueOf },
    delete: { value: getDestructor(env) },
    [Symbol.toPrimitive]: { value: getIndex },
    [MEMORY_COPIER]: { value: getMemoryCopier(byteSize) },
    [VALUE_NORMALIZER]: { value: normalizeEnumerationItem },
  };
  const staticDescriptors = {
    [ALIGN]: { value: align },
    [SIZE]: { value: byteSize },
    [ENUM_ITEMS]: { value: {} },
  };
  return attachDescriptors(constructor, instanceDescriptors, staticDescriptors);
};

export function normalizeEnumerationItem(map) {
  return this[ENUM_NAME];
}
