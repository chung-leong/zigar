import { MemberType, getAccessors } from './member.js';
import { getMemoryCopier, getMemoryResetter } from './memory.js';
import { requireDataView } from './data-view.js';
import { addSpecialAccessors } from './special.js';
import { throwNoInitializer, throwNotInErrorSet, throwUnknownErrorNumber } from './error.js';
import { MEMORY, POINTER_VISITOR, SLOTS } from './symbol.js';
import { copyPointer, resetPointer } from './pointer.js';
import { addChildVivificators, addPointerVisitor } from './struct.js';

export function finalizeErrorUnion(s) {
  const {
    byteSize,
    instance: { members },
    options,
    hasPointer,
  } = s;
  const hasObject = !!members.find(m => m.type === MemberType.Object);
  const constructor = s.constructor = function(arg) {
    const creating = this instanceof constructor;
    let self, dv;
    if (creating) {
      if (arguments.length === 0) {
        throwNoInitializer(s);
      }
      self = this;
      dv = new DataView(new ArrayBuffer(byteSize));
    } else {
      self = Object.create(constructor.prototype);
      dv = requireDataView(s, arg);
    }
    self[MEMORY] = dv;
    if (hasObject) {
      self[SLOTS] = {};
    }
    if (creating) {
      initializer.call(this, arg);
    } else {
      return self;
    }
  };
  const copy = getMemoryCopier(byteSize);
  const initializer = function(arg) {
    if (arg instanceof constructor) {
      copy(this[MEMORY], arg[MEMORY]);
      if (hasPointer) {
        if (check.call(this)) {
          this[POINTER_VISITOR](true, arg, copyPointer);
        }
      }
    } else {
      this.$ = arg;
    }
  };
  const { get, set, check } = getErrorUnionAccessors(members, byteSize, options);
  Object.defineProperty(constructor.prototype, '$', { get, set, configurable: true });
  if (hasObject) {
    addChildVivificators(s);
    if (hasPointer) {
      debugger;
      addPointerVisitor(s);
    }
  }
  addSpecialAccessors(s);
  return constructor;
}

export function getErrorUnionAccessors(members, byteSize, options) {
  const { get: getValue, set: setValue } = getAccessors(members[0], options);
  const { get: getError, set: setError } = getAccessors(members[1], options);
  const { structure: errorStructure } = members[1];
  const { constructor: ErrorSet } = errorStructure;
  const reset = getMemoryResetter(byteSize)
  return {
    get: function() {
      const errorNumber = getError.call(this);
      if (errorNumber !== 0) {
        const err = ErrorSet(errorNumber);
        if (!err) {
          throwUnknownErrorNumber(errorStructure, errorNumber);
        }
        debugger;
        this[POINTER_VISITOR]?.(false, null, resetPointer);
        throw err;
      } else {
        return getValue.call(this);
      }
    },
    set: function(value) {
      if (value instanceof Error) {
        if (!(value instanceof ErrorSet)) {
          throwNotInErrorSet(errorStructure);
        }
        reset(this[MEMORY]);
        setError.call(this, value.index);
        this[POINTER_VISITOR]?.(false, null, resetPointer);
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
