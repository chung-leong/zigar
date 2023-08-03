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
  const isSlice = (target.type === StructureType.Slice);
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
      initializer.call(self, arg);
    }
    if (isSlice) {
      return createSliceProxy.call(self);
    } else if (creating) {
      return self;
    }
  };
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
  const getTargetValue = function() {
    const object = this[SLOTS][0];
    return object.$;
  };
  const setTargetValue = (member.isConst) ? undefined : function(value) {
    const object = this[SLOTS][0];
    object.$ = value;
  };
  Object.defineProperties(constructor.prototype, {
    '*': { get: getTargetValue, set: setTargetValue, configurable: true },
    '$': { get: retriever, set: initializer, configurable: true, },
  });
  return constructor;
}

function createSliceProxy() {
  return new Proxy(this, proxyHandlers);
}

const proxyHandlers = {
  get(target, name) {
    const slice = target[SLOTS][0][SOURCE];
    const index = (typeof(name) === 'symbol') ? 0 : name|0;
    if (index !== 0 || index == name) {
      return slice.get(index);
    } else {
      switch (name) {
        case 'get':
          if (!target[GETTER]) {
            target[GETTER] = slice.get.bind(slice);
          }
          return target[GETTER];
        case 'set':
          if (!target[SETTER]) {
            target[SETTER] = slice.set.bind(slice);
          }
          return target[SETTER];
        case 'length':
          return slice.length;
        default:
          return this[name];
      }
    }
  },
  set(target, name, value) {
    const slice = target[SLOTS][0][SOURCE];
    const index = (typeof(name) === 'symbol') ? 0 : name|0;
    if (index !== 0 || index == name) {
      slice.set(index, value);
    } else {
      switch (name) {
        case 'get':
          target[GETTER] = value;
          break;
        case 'set':
          target[SETTER] = value;
          break;
        default:
          target[name] = value;
      }
    }
    return true;
  },
  deleteProperty(target, name) {
    const index = (typeof(name) === 'symbol') ? 0 : name|0;
    if (index !== 0 || index == name) {
      return false;
    } else {
      switch (name) {
        case 'get':
          delete target[GETTER];
          break;
        case 'set':
          delete target[SETTER];
          break;
        default:
          delete target[name];
      }
      return true;
    }
  },
};
