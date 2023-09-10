import { MemberType, getAccessors } from './member.js';
import { getMemoryCopier, getMemoryResetter, restoreMemory } from './memory.js';
import { requireDataView }  from './data-view.js';
import { createChildObjects, getPointerCopier, getPointerResetter, getPointerDisabler } from './struct.js';
import { addSpecialAccessors } from './special.js';
import { MEMORY, SLOTS } from './symbol.js';
import { throwNoInitializer } from './error.js';

export function finalizeOptional(s) {
  const {
    size,
    instance: { members },
    options,
  } = s;
  const objectMembers = members.filter(m => m.type === MemberType.Object);
  const constructor = s.constructor = function(arg) {
    const creating = this instanceof constructor;
    let self, dv;
    if (creating) {
      if (arguments.length === 0) {
        throwNoInitializer(s);
      }
      self = this;
      dv = new DataView(new ArrayBuffer(size));
    } else {
      self = Object.create(constructor.prototype);
      dv = requireDataView(s, arg);
    }
    self[MEMORY] = dv;
    if (objectMembers.length > 0) {
      createChildObjects.call(self, objectMembers, this, dv);
    }
    if (creating) {
      initializer.call(self, arg);
    } else {
      return self;
    }
  };
  const copy = getMemoryCopier(size);
  const initializer = s.initializer = function(arg) {
    if (arg instanceof constructor) {
      restoreMemory.call(this);
      restoreMemory.call(arg);
      copy(this[MEMORY], arg[MEMORY]);
      if (pointerCopier) {
        // don't bother copying pointers when it's empty
        if (check.call(this)) {
          pointerCopier.call(this, arg);
        }
      }
    } else {
      this.$ = arg;
    }
  };
  const pointerCopier = s.pointerCopier = getPointerCopier(objectMembers);
  const pointerResetter = s.pointerResetter = getPointerResetter(objectMembers);
  const pointerDisabler = s.pointerDisabler = getPointerDisabler(objectMembers);
  const { get, set, check } = getOptionalAccessors(members, size, options);
  Object.defineProperty(constructor.prototype, '$', { get, set, configurable: true });
  addSpecialAccessors(s);
  return constructor;
}

export function getOptionalAccessors(members, size, options) {
  const { get: getValue, set: setValue } = getAccessors(members[0], options);
  const { get: getPresent, set: setPresent } = getAccessors(members[1], options);
  const { structure: valueStructure } = members[0];
  const reset = getMemoryResetter(size);
  return {
    get: function() {
      const present = getPresent.call(this);
      if (present) {
        return getValue.call(this);
      } else {
        return null;
      }
    },
    set: function(value) {
      if (value != null) {
        setPresent.call(this, true);
        setValue.call(this, value);
      } else {
        reset(this[MEMORY]);
        const { pointerResetter } = valueStructure;
        if (pointerResetter) {
          pointerResetter.call(this[SLOTS][0]);
        }
      }
    },
    check: getPresent
  };
}
