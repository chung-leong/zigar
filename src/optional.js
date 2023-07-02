import { MemberType, getAccessors } from './member.js';
import { MEMORY, SLOTS } from './symbol.js';

export function finalizeOptional(s) {
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
  const { get, set } = getOptionalAccessors(members, options);
  Object.defineProperties(constructor.prototype, {
    get: { value: get, configurable: true, writable: true },
    set: { value: set, configurable: true, writable: true },
  });
  return constructor;
}

export function getOptionalAccessors(members, options) {
  const { get: getValue, set: setValue } = getAccessors(members[0], options);
  const { get: getPresent, set: setPresent } = getAccessors(members[1], options);
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
      setPresent.call(this, value != null);
      setValue.call(this, value);
    },
  };
}
