import { attachDescriptors, createConstructor } from './structure.js';
import { MemberType, getDescriptor } from './member.js';
import { getDestructor, getMemoryCopier, getMemoryResetter } from './memory.js';
import { getChildVivificator, getPointerVisitor } from './struct.js';
import { copyPointer, resetPointer } from './pointer.js';
import { ALIGN, CHILD_VIVIFICATOR, MEMORY_COPIER, POINTER_VISITOR, SIZE, SLOTS, VALUE_NORMALIZER, 
  VALUE_RESETTER } from './symbol.js';
import { getBase64Accessors, getDataViewAccessors, getValueOf } from './special.js';

export function defineOptional(structure, env) {
  const {
    byteSize,
    align,
    instance: { members },
    hasPointer,
  } = structure;
  const { get: getValue, set: setValue } = getDescriptor(members[0], env);
  const { get: getPresent, set: setPresent } = getDescriptor(members[1], env);
  // optionals containing pointers use the pointer itself as indication of presence
  const hasPresentFlag = !(members[0].bitSize > 0 && members[0].bitOffset === members[1].bitOffset);
  const get = (hasPresentFlag)
  ? function() {
      const present = getPresent.call(this);
      if (present) {
        return getValue.call(this);
      } else {
        this[POINTER_VISITOR]?.(resetPointer);
        return null;
      }
    }
  : function() {
    const value = getValue.call(this);
    return (value[SLOTS][0]) ? value : null;
  };
  const set = (hasPresentFlag)
  ? function(value) {
      if (value !== null) {
        // call setValue() first, in case it throws
        setValue.call(this, value);
        setPresent.call(this, true);
      } else {      
        setPresent.call(this, false);
        this[VALUE_RESETTER]();
        this[POINTER_VISITOR]?.(resetPointer);
      }
    }
  : function(value) {
    if (value !== null) {
      setValue.call(this, value);
    } else {
      setPresent.call(this, false);
      this[POINTER_VISITOR]?.(resetPointer);
    }
  };
  const check = (hasPresentFlag) ? getPresent : function() { 
    return !!getValue.call(this)[SLOTS][0];
  };
  const initializer = function(arg) {
    if (arg instanceof constructor) {
      this[MEMORY_COPIER](arg);
      if (hasPointer) {
        // don't bother copying pointers when it's empty
        if (check.call(arg)) {
          this[POINTER_VISITOR](copyPointer, { vivificate: true, source: arg });
        }
      }
    } else {
      set.call(this, arg);
    }
  };
  const constructor = structure.constructor = createConstructor(structure, { initializer }, env);
  const { bitOffset: valueBitOffset, byteSize: valueByteSize } = members[0];
  const hasObject = !!members.find(m => m.type === MemberType.Object);
  const instanceDescriptors = {
    $: { get, set },
    dataView: getDataViewAccessors(structure),
    base64: getBase64Accessors(structure),
    valueOf: { value: getValueOf },
    toJSON: { value: getValueOf },
    delete: { value: getDestructor(env) },
    [MEMORY_COPIER]: { value: getMemoryCopier(byteSize) },
    [VALUE_RESETTER]: { value: getMemoryResetter(valueBitOffset / 8, valueByteSize) },
    [CHILD_VIVIFICATOR]: hasObject && { value: getChildVivificator(structure) },
    [POINTER_VISITOR]: hasPointer && { value: getPointerVisitor(structure, { isChildActive: check }) },
    [VALUE_NORMALIZER]: { value: normalizeOptional },
  };
  const staticDescriptors = {
    [ALIGN]: { value: align },
    [SIZE]: { value: byteSize },
  };
  return attachDescriptors(constructor, instanceDescriptors, staticDescriptors);
}

export function normalizeOptional(map) {
  const value = this.$;
  return value[VALUE_NORMALIZER]?.(map) ?? value;
}