import { ObjectCache, attachDescriptors, needSlots } from './structure.js';
import { MemberType, getDescriptor } from './member.js';
import { getDestructor, getMemoryCopier, getMemoryResetter } from './memory.js';
import { requireDataView }  from './data-view.js';
import { getChildVivificator, getPointerVisitor } from './struct.js';
import { throwNoInitializer } from './error.js';
import { copyPointer, resetPointer } from './pointer.js';
import { ALIGN, CHILD_VIVIFICATOR, CONST, MEMORY, MEMORY_COPIER, POINTER_VISITOR, SIZE, SLOTS, 
  VALUE_NORMALIZER, VALUE_RESETTER } from './symbol.js';
import { getBase64Accessors, getDataViewAccessors, getValueOf } from './special.js';

export function defineOptional(s, env) {
  const {
    byteSize,
    align,
    instance: { members },
    hasPointer,
  } = s;
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
  const hasObject = !!members.find(m => m.type === MemberType.Object);
  const hasSlots = needSlots(s);
  const cache = new ObjectCache();
  const constructor = s.constructor = function(arg, options = {}) {
    const {
      writable = true,
      fixed = false,
    } = options;
    const creating = this instanceof constructor;
    let self, dv;
    if (creating) {
      if (arguments.length === 0) {
        throwNoInitializer(s);
      }
      self = (writable) ? this : Object.create(constructor[CONST].prototype);
      dv = env.allocateMemory(byteSize, align, fixed);
    } else {
      dv = requireDataView(s, arg, env);
      if (self = cache.find(dv, writable)) {
        return self;
      }
      const c = (writable) ? constructor : constructor[CONST];
      self = Object.create(c.prototype); 
    }
    self[MEMORY] = dv;
    if (hasSlots) {
      self[SLOTS] = {};
    }
    if (creating) {
      initializer.call(self, arg);
    }
    return cache.save(dv, writable, self);
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
      this.$ = arg;
    }
  };
  const { bitOffset: valueBitOffset, byteSize: valueByteSize } = members[0];
  const instanceDescriptors = {
    $: { get, set },
    dataView: getDataViewAccessors(s),
    base64: getBase64Accessors(),
    valueOf: { value: getValueOf },
    toJSON: { value: getValueOf },
    delete: { value: getDestructor(env) },
    [MEMORY_COPIER]: { value: getMemoryCopier(byteSize) },
    [VALUE_RESETTER]: { value: getMemoryResetter(valueBitOffset / 8, valueByteSize) },
    [CHILD_VIVIFICATOR]: hasObject && { value: getChildVivificator(s) },
    [POINTER_VISITOR]: hasPointer && { value: getPointerVisitor(s, { isChildActive: check }) },
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