import { attachDescriptors, createConstructor } from './structure.js';
import { MemberType, getDescriptor } from './member.js';
import { getDestructor, getMemoryCopier, getMemoryResetter } from './memory.js';
import { copyPointer, resetPointer } from './pointer.js';
import { getChildVivificator, getPointerVisitor } from './struct.js';
import { ALIGN, CHILD_VIVIFICATOR, MEMORY_COPIER, POINTER_VISITOR, SIZE, VALUE_NORMALIZER,
  VALUE_RESETTER } from './symbol.js';
import { getBase64Accessors, getDataViewAccessors, getValueOf } from './special.js';

export function defineErrorUnion(structure, env) {
  const {
    byteSize,
    align,
    instance: { members },
    hasPointer,
  } = structure;
  const { get: getValue, set: setValue } = getDescriptor(members[0], env);
  const { get: getError, set: setError } = getDescriptor(members[1], env);
  const set = function(value) {
    if (value instanceof Error) {
      setError.call(this, value);
      this[VALUE_RESETTER]();
      this[POINTER_VISITOR]?.(resetPointer);
    } else {
      // call setValue() first, in case it throws
      setValue.call(this, value);
      setError.call(this, null);
    }
  };
  const get = function() {
    const error = getError.call(this);
    if (error) {
      throw error;
    } else {
      return getValue.call(this);
    }
  };
  const check = function() {
    const error = getError.call(this);
    return !error;
  };
  const hasObject = !!members.find(m => m.type === MemberType.Object);
  const initializer = function(arg) {
    if (arg instanceof constructor) {
      this[MEMORY_COPIER](arg);
      if (hasPointer) {
        if (check.call(this)) {
          this[POINTER_VISITOR](copyPointer, { vivificate: true, source: arg });
        }
      }
    } else {
      this.$ = arg;
    }
  };
  const constructor = structure.constructor = createConstructor(structure, { initializer }, env);
  const { bitOffset: valueBitOffset, byteSize: valueByteSize } = members[0];
  const instanceDescriptors = {
    '$': { get, set },
    dataView: getDataViewAccessors(structure),
    base64: getBase64Accessors(structure),
    valueOf: { value: getValueOf },
    toJSON: { value: getValueOf },
    delete: { value: getDestructor(env) },
    [MEMORY_COPIER]: { value: getMemoryCopier(byteSize) },
    [VALUE_RESETTER]: { value: getMemoryResetter(valueBitOffset / 8, valueByteSize) },
    [CHILD_VIVIFICATOR]: hasObject && { value: getChildVivificator(structure) },
    [POINTER_VISITOR]: hasPointer && { value: getPointerVisitor(structure, { isChildActive: check }) },
    [VALUE_NORMALIZER]: { value: normalizeErrorUnion },
  };
  const staticDescriptors = {
    [ALIGN]: { value: align },
    [SIZE]: { value: byteSize },
  };
  return attachDescriptors(constructor, instanceDescriptors, staticDescriptors);
}

export function normalizeErrorUnion(map) {
  const value = this.$;
  return value[VALUE_NORMALIZER](map);
}