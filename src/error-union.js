import { MemberType, getAccessors } from './member.js';
import { getCopyFunction } from './memory.js';
import { getDataView } from './data-view.js';
import { createChildObjects } from './struct.js';
import { throwNotInErrorSet, throwUnknownErrorNumber } from './error.js';
import { MEMORY, SLOTS } from './symbol.js';

export function finalizeErrorUnion(s) {
  const {
    name,
    size,
    instance: { members },
    options,
  } = s;
  const copy = getCopyFunction(size);
  const objectMembers = members.filter(m => m.type === MemberType.Object);
  const copier = s.copier = function (dest, src) {
    copy(dest[MEMORY], src[MEMORY]);
    // FIXME
    if (objectMembers.length !== 0) {
      dest[SLOTS] = { ...src[SLOTS] };
    }
  };
  const constructor = s.constructor = function(arg) {
    const creating = this instanceof constructor;
    let self, dv;
    if (creating) {
      // new operation
      self = this;
      dv = new DataView(new ArrayBuffer(size));
    } else {
      self = Object.create(constructor.prototype);
      dv = getDataView(s, arg);
    }
    Object.defineProperties(self, {
      [MEMORY]: { value: dv },
    });
    createChildObjects.call(self, objectMembers, dv);
    if (creating) {
      this.set(arg);
    } else {
      return self;
    }
  };
  const { get, set } = getErrorUnionAccessors(members, options);
  Object.defineProperties(constructor.prototype, {
    get: { value: get, configurable: true, writable: true },
    set: { value: set, configurable: true, writable: true },
  });
  return constructor;
}

export function getErrorUnionAccessors(members, options) {
  const { get: getValue, set: setValue } = getAccessors(members[0], options);
  const { get: getError, set: setError } = getAccessors(members[1], options);
  const { structure } = members[1];
  return {
    get: function() {
      const errorNumber = getError.call(this);
      if (errorNumber !== 0) {
        const { constructor } = structure;
        const err = constructor(errorNumber);
        if (!err) {
          throwUnknownErrorNumber(structure, errorNumber);
        }
        throw err;
      } else {
        return getValue.call(this);
      }
    },
    set: function(value) {
      let errorNumber;
      if (value instanceof Error) {
        const { constructor } = structure;
        if (!(value instanceof constructor)) {
          throwNotInErrorSet(structure);
        }
        errorNumber = Number(value);
        value = null;
      }
      setValue.call(this, value);
      setError.call(this, errorNumber);
    },
  };
}
