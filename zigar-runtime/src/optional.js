import { MemberType, getAccessors } from './member.js';
import { getMemoryCopier, getMemoryResetter, restoreMemory, getPointerAlign } from './memory.js';
import { requireDataView }  from './data-view.js';
import { addChildVivificators, addPointerVisitor } from './struct.js';
import { addSpecialAccessors } from './special.js';
import { MEMORY, FIELD_VALIDATOR, POINTER_VISITOR, SLOTS } from './symbol.js';
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
  const reset = getMemoryResetter(byteSize);
  const get = function() {
    const present = getPresent.call(this);
    if (present) {
      return getValue.call(this);
    } else {
      this[POINTER_VISITOR]?.(resetPointer);
      return null;
    }
  };
  const set = function(value) {
    if (value != null) {
      setPresent.call(this, true);
      setValue.call(this, value);
    } else {
      reset(this[MEMORY]);
      this[POINTER_VISITOR]?.(resetPointer);
    }
  };
  const check = getPresent;
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
      /* WASM-ONLY */
      restoreMemory.call(this);
      restoreMemory.call(arg);
      /* WASM-ONLY-END */
      copy(this[MEMORY], arg[MEMORY]);
      if (hasPointer) {
        // don't bother copying pointers when it's empty
        if (check.call(this)) {
          this[POINTER_VISITOR](copyPointer, { vivificate: true, source: arg});
        }
      }
    } else {
      this.$ = arg;
    }
  };
  Object.defineProperty(constructor.prototype, '$', { get, set, configurable: true });
  if (hasObject) {
    addChildVivificators(s);
    if (hasPointer) {
      // function used by pointer visitor to see whether pointer field is active
      Object.defineProperty(constructor.prototype, FIELD_VALIDATOR, { value: check });
      addPointerVisitor(s);
    }
  }
  addSpecialAccessors(s);
  return constructor;
}
