import { StructureType } from './structure.js';
import { getDataView } from './data-view.js';
import { throwInvalidPointerTarget } from './error.js';
import { MEMORY, PROXY, SLOTS, SOURCE, ZIG } from './symbol.js';

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
      initializer.call(self, arg);
    }
    return createProxy.call(self, target);
  };
  const initializer = s.initializer = function(arg) {
    if (arg instanceof constructor) {
      // not doing memory copying since values stored there might not be valid anyway
      pointerCopier.call(this, arg);
    } else {
      const Target = target.constructor;
      if (!(arg instanceof Target)) {
        throwInvalidPointerTarget(s, arg);
      }
      this[SLOTS][0] = arg;
    }
  };
  // return the proxy object if one is used
  const retriever = function() { return this[PROXY] ?? this };
  const pointerCopier = s.pointerCopier = function(arg) {
    this[SLOTS][0] = arg[SLOTS][0];
  };
  const pointerResetter = s.pointerResetter = function() {
    this[SLOTS][0] = null;
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

function createProxy(target) {
  const proxy = new Proxy(this, (target.type !== StructureType.Pointer) ? proxyHandlers : {});
  this[PROXY] = proxy;
  return proxy;
}

const proxyHandlers = {
  get(pointer, name) {
    switch (name) {
      case '$':
      case '*':
      // pointerCopier can be given the proxy object
      // should avoid placing these functions in the structure object
      case SLOTS:
        return pointer[name];
      default:
        return pointer[SLOTS][0][name];
    }
  },
  set(pointer, name, value) {
    switch (name) {
      case '$':
      case '*':
        pointer[name] = value;
        break;
      default:
        pointer[SLOTS][0][name] = value;
    }
    return true;
  },
  deleteProperty(pointer, name) {
    switch (name) {
      case '$':
      case '*':
        delete pointer[name];
        break;
      default:
        delete pointer[SLOTS][0][name];
    }
    return true;
  },
};
