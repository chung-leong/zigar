import { ObjectCache, defineProperties, needSlots } from './structure.js';
import { MemberType, getDescriptor } from './member.js';
import { getDestructor, getMemoryCopier, getMemoryResetter } from './memory.js';
import { requireDataView }  from './data-view.js';
import { getChildVivificator, getPointerVisitor } from './struct.js';
import { throwNoInitializer, throwReadOnly } from './error.js';
import { copyPointer, resetPointer } from './pointer.js';
import { ALIGN, CHILD_VIVIFICATOR, MEMORY, MEMORY_COPIER, POINTER_VISITOR, SIZE, SLOTS, 
  VALUE_RESETTER } from './symbol.js';

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
      self = this;
      dv = env.allocateMemory(byteSize, align, fixed);
    } else {
      dv = requireDataView(s, arg, env);
      if (self = cache.find(dv, writable)) {
        return self;
      }
      self = Object.create(constructor.prototype); 
    }
    self[MEMORY] = dv;
    if (hasSlots) {
      self[SLOTS] = {};
    }
    if (creating) {
      initializer.call(self, arg);
    }
    if (!writable) {
      defineProperties(self, {
        '$': { get, set: throwReadOnly, configurable: true },
        [CHILD_VIVIFICATOR]: hasObject && { value: getChildVivificator(s, false) },
      });
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
  defineProperties(constructor.prototype, {
    delete: { value: getDestructor(env), configurable: true },
    $: { get, set, configurable: true },
    [MEMORY_COPIER]: { value: getMemoryCopier(byteSize) },
    [VALUE_RESETTER]: { value: getMemoryResetter(valueBitOffset / 8, valueByteSize) },
    [CHILD_VIVIFICATOR]: hasObject && { value: getChildVivificator(s, true) },
    [POINTER_VISITOR]: hasPointer && { value: getPointerVisitor(s, { isChildActive: check }) },
  });
  defineProperties(constructor, {
    [ALIGN]: { value: align },
    [SIZE]: { value: byteSize },
  });
  return constructor;
}
