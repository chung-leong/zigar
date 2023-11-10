import { defineProperties } from './structure.js';
import { MemberType, getAccessors } from './member.js';
import { getMemoryCopier, getMemoryResetter } from './memory.js';
import { requireDataView }  from './data-view.js';
import { getChildVivificators, getPointerVisitor } from './struct.js';
import { addSpecialAccessors } from './special.js';
import { MEMORY, POINTER_VISITOR, SLOTS, MEMORY_COPIER, MEMORY_RESETTER, CHILD_VIVIFICATOR } from './symbol.js';
import { throwNoInitializer } from './error.js';
import { copyPointer, resetPointer } from './pointer.js';

export function finalizeOptional(s, env) {
  const {
    byteSize,
    align,
    instance: { members },
    options,
    hasPointer,
  } = s;
  const { get: getValue, set: setValue } = getAccessors(members[0], options);
  const { get: getPresent, set: setPresent } = getAccessors(members[1], options);
  const get = function() {
    const present = getPresent.call(this);
    if (present) {
      return getValue.call(this);
    } else {
      return null;
    }
  };
  const set = function(value) {
    if (value != null) {
      setPresent.call(this, true);
      setValue.call(this, value);
    } else {
      this[MEMORY_RESETTER]();
      this[POINTER_VISITOR]?.(resetPointer);
    }
  };
  const check = getPresent;
  const hasObject = !!members.find(m => m.type === MemberType.Object);
  const constructor = s.constructor = function(arg) {
    const creating = this instanceof constructor;
    let self, dv;
    if (creating) {
      if (arguments.length === 0) {
        throwNoInitializer(s);
      }
      self = this;
      dv = env.createBuffer(byteSize, align);
    } else {
      self = Object.create(constructor.prototype);
      dv = requireDataView(s, arg);
    }
    self[MEMORY] = dv;
    if (hasObject) {
      self[SLOTS] = {};
    }
    if (creating) {
      initializer.call(self, arg);
    } else {
      return self;
    }
  };
  const initializer = function(arg) {
    if (arg instanceof constructor) {
      this[MEMORY_COPIER](arg);
      if (hasPointer) {
        // don't bother copying pointers when it's empty
        if (check.call(this)) {
          this[POINTER_VISITOR](copyPointer, { vivificate: true, source: arg });
        }
      }
    } else {
      this.$ = arg;
    }
  };
  defineProperties(constructor.prototype, {
    '$': { get, set, configurable: true },
    [MEMORY_COPIER]: { value: getMemoryCopier(byteSize) },
    [MEMORY_RESETTER]: { value: getMemoryResetter(byteSize) },
    [CHILD_VIVIFICATOR]: hasObject && { value: getChildVivificators(s) },
    [POINTER_VISITOR]: hasPointer && { value: getPointerVisitor(s, check) },
  });
  defineProperties(constructor, {
    [ALIGN]: { value: align },
  });
  addSpecialAccessors(s);
  return constructor;
}
