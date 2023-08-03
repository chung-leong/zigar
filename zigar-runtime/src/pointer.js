import { StructureType } from './structure.js';
import { MemberType, getAccessors } from './member.js';
import { getDataView } from './data-view.js';
import { MEMORY, SLOTS, SOURCE, ZIG } from './symbol.js';

export function finalizePointer(s) {
  const {
    size,
    instance: {
      members: [ member ],
    },
    options,
  } = s;
  const { structure: target } = member;
  const constructor = s.constructor = function(arg) {
    const creating = this instanceof constructor;
    let self, dv;
    if (creating) {
      self = this;
      dv = new DataView(new ArrayBuffer(size));
    } else {
      self = Object.create(constructor.prototype);
      dv = getDataView(s, arg);
    }
    Object.defineProperties(self, {
      [MEMORY]: { value: dv, configurable: true },
      [SLOTS]: { value: { 0: null } },
      // a boolean value indicating whether Zig currently owns the pointer
      [ZIG]: { value: this === ZIG, writable: true },
    });
    if (creating) {
      initializer.call(this, arg);
    } else {
      return self;
    }
  };
  const { TypedArray } = target;
  const initializer = s.initializer = function(arg) {
    if (arg instanceof constructor) {
      // not doing memory copying since values stored there might not be valid anyway
      pointerCopier.call(this);
    } else {
      const Target = target.constructor;
      if (!(arg instanceof Target)) {
        // automatically create target
        arg = new Target(arg);
      }
      this[SLOTS][0] = arg;
    }
  };
  const retriever = function() { return this };
  const pointerCopier = s.pointerCopier = function(arg) {
    this[SLOTS][0] = arg[SLOTS][0];
  };
  const getTarget = function() {
    return this[SLOTS][0];
  }
  const getTargetValue = function() {
    const object = this[SLOTS][0];
    return object.$;
  };
  const setTargetValue = (member.isConst) ? undefined : function(value) {
    const object = this[SLOTS][0];
    object.$ = value;
  };
  Object.defineProperties(constructor.prototype, {
    '&': { get: getTarget, configurable: true },
    '*': { get: getTargetValue, set: setTargetValue, configurable: true },
    '$': { get: retriever, set: initializer, configurable: true, },
  });
  return constructor;
}

