import { defineProperties } from './structure.js';
import { MemberType, getAccessors } from './member.js';
import { getMemoryCopier, getMemoryResetter } from './memory.js';
import { requireDataView } from './data-view.js';
import { addSpecialAccessors } from './special.js';
import { throwNoInitializer, throwNotInErrorSet, throwUnknownErrorNumber } from './error.js';
import { copyPointer, resetPointer } from './pointer.js';
import { getChildVivificators, getPointerVisitor } from './struct.js';
import { ALIGN, CHILD_VIVIFICATOR, MEMORY, MEMORY_COPIER, MEMORY_RESETTER, POINTER_VISITOR,
  SIZE,
  SLOTS } from './symbol.js';

export function finalizeErrorUnion(s, env) {
  const {
    byteSize,
    align,
    instance: { members },
    options,
    hasPointer,
  } = s;
  const { get: getValue, set: setValue } = getAccessors(members[0], options);
  const { get: getError, set: setError } = getAccessors(members[1], options);
  const { structure: errorStructure } = members[1];
  const { constructor: ErrorSet } = errorStructure;
  const set = function(value) {
    if (value instanceof Error) {
      if (!(value instanceof ErrorSet)) {
        throwNotInErrorSet(errorStructure);
      }
      this[MEMORY_RESETTER]();
      this[POINTER_VISITOR]?.(resetPointer);
      setError.call(this, value.index);
    } else {
      setValue.call(this, value);
      setError.call(this, 0);
    }
  };
  const get = function() {
    const errorNumber = getError.call(this);
    if (errorNumber !== 0) {
      const err = ErrorSet(errorNumber);
      if (!err) {
        throwUnknownErrorNumber(errorStructure, errorNumber);
      }
      throw err;
    } else {
      return getValue.call(this);
    }
  };
  const check = function() {
    const errorNumber = getError.call(this);
    return (errorNumber === 0);
  };
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
      initializer.call(this, arg);
    } else {
      return self;
    }
  };
  const initializer = function(arg) {
    if (arg instanceof constructor) {
      this[MEMORY_COPIER](arg);
      if (hasPointer) {
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
    [POINTER_VISITOR]: hasPointer && { value: getPointerVisitor(s, { isChildActive: check }) },
  });
  defineProperties(constructor, {
    [ALIGN]: { value: align },
    [SIZE]: { value: byteSize },
  })
  addSpecialAccessors(s);
  return constructor;
}

