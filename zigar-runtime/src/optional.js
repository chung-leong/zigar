import { MemberType, getAccessors } from './member.js';
import { getMemoryCopier, getMemoryResetter, restoreMemory, getPointerAlign } from './memory.js';
import { requireDataView }  from './data-view.js';
import { addChildVivificators, addPointerVisitor } from './struct.js';
import { addSpecialAccessors } from './special.js';
import { MEMORY, POINTER_VISITOR, SLOTS } from './symbol.js';
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
  const hasObject = !!members.find(m => m.type === MemberType.Object);
  const ptrAlign = getPointerAlign(align);
  const constructor = s.constructor = function(arg) {
    const creating = this instanceof constructor;
    let self, dv;
    if (creating) {
      if (arguments.length === 0) {
        throwNoInitializer(s);
      }
      self = this;
      dv = env.allocMemory(byteSize, ptrAlign);
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
  const copy = getMemoryCopier(byteSize);
  const initializer = function(arg) {
    if (arg instanceof constructor) {
      restoreMemory.call(this);
      restoreMemory.call(arg);
      copy(this[MEMORY], arg[MEMORY]);
      if (hasPointer) {
        // don't bother copying pointers when it's empty
        if (check.call(this)) {
          this[POINTER_VISITOR](true, arg, copyPointer);
        }
      }
    } else {
      this.$ = arg;
    }
  };
  const { get, set, check } = getOptionalAccessors(members, byteSize, options);
  Object.defineProperty(constructor.prototype, '$', { get, set, configurable: true });
  if (hasObject) {
    addChildVivificators(s);
    if (hasPointer) {
      addPointerVisitor(s);
    }
  }
  addSpecialAccessors(s);
  return constructor;
}

export function getOptionalAccessors(members, byteSize, options) {
  const { get: getValue, set: setValue } = getAccessors(members[0], options);
  const { get: getPresent, set: setPresent } = getAccessors(members[1], options);
  const reset = getMemoryResetter(byteSize);
  return {
    get: function() {
      const present = getPresent.call(this);
      if (present) {
        return getValue.call(this);
      } else {
        this[POINTER_VISITOR]?.(false, null, resetPointer);
        return null;
      }
    },
    set: function(value) {
      if (value != null) {
        setPresent.call(this, true);
        setValue.call(this, value);
      } else {
        reset(this[MEMORY]);
        this[POINTER_VISITOR]?.(false, null, resetPointer);
      }
    },
    check: getPresent
  };
}
