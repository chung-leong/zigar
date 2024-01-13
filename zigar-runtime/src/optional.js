import { MemberType, getDescriptor } from './member.js';
import { getDestructor, getMemoryCopier, getMemoryResetter } from './memory.js';
import { copyPointer, resetPointer } from './pointer.js';
import { convertToJSON, getBase64Descriptor, getDataViewDescriptor, getValueOf } from './special.js';
import { getChildVivificator, getPointerVisitor } from './struct.js';
import { attachDescriptors, createConstructor } from './structure.js';
import {
  ALIGN,
  COPIER,
  NORMALIZER,
  POINTER_VISITOR,
  RESETTER,
  SIZE,
  VIVIFICATOR
} from './symbol.js';

export function defineOptional(structure, env) {
  const {
    byteSize,
    align,
    instance: { members },
    hasPointer,
  } = structure;
  const { get: getValue, set: setValue } = getDescriptor(members[0], env);
  const { get: getPresent, set: setPresent } = getDescriptor(members[1], env);
  const hasPresentFlag = !(members[0].bitSize > 0 && members[0].bitOffset === members[1].bitOffset);  
  const get = function() {
    const present = getPresent.call(this);
    if (present) {
      return getValue.call(this);
    } else {
      this[POINTER_VISITOR]?.(resetPointer);
      return null;
    }
  };
  const isValueVoid = members[0].type === MemberType.Void;
  const isChildActive = getPresent;
  const initializer = function(arg) {
    if (arg instanceof constructor) {
      this[COPIER](arg);
      if (hasPointer) {
        // don't bother copying pointers when it's empty
        if (isChildActive.call(arg)) {
          this[POINTER_VISITOR](copyPointer, { vivificate: true, source: arg });
        }
      }      
    } else if (arg === null) {
      setPresent.call(this, false);
      this[RESETTER]?.();
      // clear references so objects can be garbage-collected
      this[POINTER_VISITOR]?.(resetPointer);
    } else if (arg !== undefined || isValueVoid) {      
      // call setValue() first, in case it throws
      setValue.call(this, arg);
      if (hasPresentFlag || !env.inFixedMemory(this)) {
        // since setValue() wouldn't write address into memory when the pointer is in 
        // relocatable memory, we need to use setPresent() in order to write something 
        // non-zero there so that we know the field is populated
        setPresent.call(this, true);
      }
    }
  };
  const constructor = structure.constructor = createConstructor(structure, { initializer }, env);
  const { bitOffset: valueBitOffset, byteSize: valueByteSize } = members[0];
  const hasObject = !!members.find(m => m.type === MemberType.Object);
  const instanceDescriptors = {
    $: { get, set: initializer },
    dataView: getDataViewDescriptor(structure),
    base64: getBase64Descriptor(structure),
    valueOf: { value: getValueOf },
    toJSON: { value: convertToJSON },
    delete: { value: getDestructor(env) },
    [COPIER]: { value: getMemoryCopier(byteSize) },
    // no need to reset the value when it's a pointer, since setPresent() would null out memory used by the pointer
    [RESETTER]: !hasPointer && { value: getMemoryResetter(valueBitOffset / 8, valueByteSize) },
    [VIVIFICATOR]: hasObject && { value: getChildVivificator(structure) },
    [POINTER_VISITOR]: hasPointer && { value: getPointerVisitor(structure, { isChildActive }) },
    [NORMALIZER]: { value: normalizeOptional },
  };
  const staticDescriptors = {
    [ALIGN]: { value: align },
    [SIZE]: { value: byteSize },
  };
  return attachDescriptors(constructor, instanceDescriptors, staticDescriptors);
}

export function normalizeOptional(map, forJSON) {
  const value = this.$;
  return value?.[NORMALIZER]?.(map, forJSON) ?? value;
}