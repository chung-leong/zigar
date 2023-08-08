import { MemberType, getAccessors } from './member.js';
import { getMemoryCopier, getMemoryResetter } from './memory.js';
import { requireDataView } from './data-view.js';
import { createChildObjects, getPointerCopier, getPointerResetter } from './struct.js';
import { addJSONHandlers } from './json.js';
import { throwNotInErrorSet, throwUnknownErrorNumber } from './error.js';
import { MEMORY, SLOTS } from './symbol.js';

export function finalizeErrorUnion(s) {
  const {
    name,
    size,
    instance: { members },
    options,
  } = s;
  const objectMembers = members.filter(m => m.type === MemberType.Object);
  const constructor = s.constructor = function(arg) {
    const creating = this instanceof constructor;
    let self, dv;
    if (creating) {
      // new operation
      self = this;
      dv = new DataView(new ArrayBuffer(size));
    } else {
      self = Object.create(constructor.prototype);
      dv = requireDataView(s, arg);
    }
    Object.defineProperties(self, {
      [MEMORY]: { value: dv, configurable: true },
    });
    if (objectMembers.length > 0) {
      createChildObjects.call(self, objectMembers, this, dv);
    }
    if (creating) {
      initializer.call(this, arg);
    } else {
      return self;
    }
  };
  const copy = getMemoryCopier(size);
  const initializer = s.initializer = function(arg) {
    if (arg instanceof constructor) {
      copy(this[MEMORY], arg[MEMORY]);
      if (pointerCopier) {
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
  const { get, set, check } = getErrorUnionAccessors(members, size, options);
  Object.defineProperties(constructor.prototype, {
    $: { get, set, configurable: true },
  });
  addJSONHandlers(s);
  return constructor;
}

export function getErrorUnionAccessors(members, size, options) {
  const { get: getValue, set: setValue } = getAccessors(members[0], options);
  const { get: getError, set: setError } = getAccessors(members[1], options);
  const { structure: valueStructure = {} } = members[0];
  const { structure: errorStructure } = members[1];
  const reset = getMemoryResetter(size)
  return {
    get: function() {
      const errorNumber = getError.call(this);
      if (errorNumber !== 0) {
        const { constructor } = errorStructure;
        const err = constructor(errorNumber);
        if (!err) {
          throwUnknownErrorNumber(errorStructure, errorNumber);
        }
        throw err;
      } else {
        return getValue.call(this);
      }
    },
    set: function(value) {
      if (value instanceof Error) {
        const { constructor } = errorStructure;
        const { pointerResetter } = valueStructure;
        if (!(value instanceof constructor)) {
          throwNotInErrorSet(errorStructure);
        }
        reset(this[MEMORY]);
        setError.call(this, Number(value));
        if (pointerResetter) {
          pointerResetter.call(this[SLOTS][0]);
        }
      } else {
        setValue.call(this, value);
        setError.call(this, 0);
      }
    },
    check: function() {
      const errorNumber = getError.call(this);
      return (errorNumber === 0);
    },
  };
}
