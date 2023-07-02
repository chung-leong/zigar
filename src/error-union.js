import { MemberType, getAccessors } from './member.js';
import { MEMORY, SLOTS } from './symbol.js';
import { throwNotInErrorSet, throwUnknownErrorNumber } from './error.js';

export function finalizeErrorUnion(s) {
  const {
    name,
    size,
    instance: { members },
    options,
  } = s;
  const copy = getCopyFunction(size);
  const hasObject = !!members.find(m => m.type === MemberType.Object);
  const copier = s.copier = function (dest, src) {
    copy(dest[MEMORY], src[MEMORY]);
    if (hasObject) {
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
      dv = getDataView(arg, name, size);
    }
    Object.defineProperties(self, {
      [MEMORY]: { value: dv },
    });
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
  attachName(s);
  return constructor;
}

export function getErrorUnionAccessors(members, options) {
  const { get: getValue, set: setValue } = getAccessors(members[0], options);
  const { get: getError, set: setError } = getAccessors(members[1], options);
  const { structure } = members[1];
  return {
    get: function() {
      const error = getError.call(this);
      if (error !== 0) {
        const { constructor } = structure;
        const err = constructor(error);
        if (!err) {
          throwUnknownErrorNumber(error);
        }
        throw err;
      } else {
        return getValue.call(this);
      }
    },
    set: function(value) {
      let error;
      if (value instanceof Error) {
        const { constructor, name } = structure;
        error = Number(value);
        value = null;
        if (!constructor(error)) {
          throwNotInErrorSet(name);
        }
      }
      setValue.call(this, value);
      setError.call(this, error);
    },
  };
}
