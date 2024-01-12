import { getDataView, getTypedArrayClass } from './data-view.js';
import { throwInvalidInitializer } from './error.js';
import { MemberType, getDescriptor } from './member.js';
import { getDestructor, getMemoryCopier } from './memory.js';
import { convertToJSON, getBase64Accessors, getDataViewAccessors, getTypedArrayAccessors, getValueOf } from './special.js';
import { attachDescriptors, createConstructor, createPropertyApplier } from './structure.js';
import { ALIGN, COPIER, ITEMS, NAME, NORMALIZER, SIZE, TAG } from './symbol.js';

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
    } else if (arg !== undefined) {
      set.call(this, arg);
    }
  };
  const alternateCaster = function(arg) {
    if (typeof(arg)  === 'string') {
      return constructor[arg];
    } else if (typeof(arg) === 'number' || typeof(arg) === 'bigint') {
      return constructor[ITEMS][arg];
    } else if (arg?.[TAG] instanceof constructor) {
      // a tagged union, return the active tag
      return arg[TAG];
    } else if (!getDataView(structure, arg, env)) {
      throwInvalidInitializer(structure, expected, arg);
    } else {
      return false;
    }
  };
  const constructor = structure.constructor = createConstructor(structure, { initializer, alternateCaster }, env);
  const typedArray = structure.typedArray = getTypedArrayClass(member);
  const toPrimitive = function(hint) {
    if (hint === 'string') {
      return this[NAME];
    } else {
      return getIndex.call(this);
    }
  };
  const instanceDescriptors = {
    $: { get, set },
    dataView: getDataViewAccessors(structure),
    base64: getBase64Accessors(structure),
    typedArray: typedArray && getTypedArrayAccessors(structure),
    valueOf: { value: getValueOf },
    toJSON: { value: convertToJSON },
    delete: { value: getDestructor(env) },
    [Symbol.toPrimitive]: { value: toPrimitive },
    [COPIER]: { value: getMemoryCopier(byteSize) },
    [NORMALIZER]: { value: normalizeEnumerationItem },
  };
  const staticDescriptors = {
    [ALIGN]: { value: align },
    [SIZE]: { value: byteSize },
    [ITEMS]: { value: {} },
  };
  return attachDescriptors(constructor, instanceDescriptors, staticDescriptors);
};

export function normalizeEnumerationItem(map, forJSON) {
  const item = this.$;
  return item[NAME];
}
