import { StructureType } from './structure.js';
import { requireDataView, getDataView } from './data-view.js';
import { MEMORY, PROXY, SLOTS, ZIG, PARENT } from './symbol.js';
import { throwNoCastingToPointer, throwInaccessiblePointer } from './error.js';

export function finalizePointer(s) {
  const {
    size,
    instance: {
      members: [ member ],
    },
  } = s;
  const { structure: target = {} } = member;
  const constructor = s.constructor = function(arg) {
    const calledFromZig = (this === ZIG);
    const calledFromParent = (this === PARENT);
    let creating = this instanceof constructor;
    let self, dv;
    if (creating) {
      self = this;
      dv = new DataView(new ArrayBuffer(size));
    } else {
      self = Object.create(constructor.prototype);
      if (calledFromZig || calledFromParent) {
        dv = requireDataView(s, arg);
      } else {
        throwNoCastingToPointer(s);
      }
    }
    Object.defineProperties(self, {
      [MEMORY]: { value: dv, configurable: true },
      [SLOTS]: { value: { 0: null } },
      // a boolean value indicating whether Zig currently owns the pointer
      [ZIG]: { value: calledFromZig, writable: true },
    });
    if (creating) {
      initializer.call(self, arg);
    }
    return createProxy.call(self, target);
  };
  const initializer = s.initializer = function(arg) {
    if (arg instanceof constructor) {
      // not doing memory copying since the value stored there probably isn't valid anyway
      pointerCopier.call(this, arg);
    } else {
      const Target = target.constructor;
      if (!(arg instanceof Target)) {
        const dv = getDataView(target, arg);
        if (dv) {
          // autocast to target type
          arg = Target(dv);
        } else {
          // autovivificate target object
          arg = new Target(arg);
        }
      }
      this[SLOTS][0] = arg;
    }
  };
  // return the proxy object if one is used
  const retriever = function() { return this[PROXY] };
  const pointerCopier = s.pointerCopier = function(arg) {
    this[SLOTS][0] = arg[SLOTS][0];
  };
  const pointerResetter = s.pointerResetter = function() {
    this[SLOTS][0] = null;
  };
  const pointerDisabler = s.pointerDisabler = function() {
    Object.defineProperties(this[SLOTS], {
      0: { get: throwInaccessiblePointer, set: throwInaccessiblePointer, configurable: true },
    });
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
      case ZIG:
      case SLOTS:
      case MEMORY:
        return pointer[name];
      default:
        return pointer[SLOTS][0][name];
    }
  },
  set(pointer, name, value) {
    switch (name) {
      case '$':
      case '*':
      case ZIG:
      case SLOTS:
      case MEMORY:
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
      case ZIG:
      case SLOTS:
      case MEMORY:
        delete pointer[name];
        break;
      default:
        delete pointer[SLOTS][0][name];
    }
    return true;
  },
  has(pointer, name) {
    return name in pointer[SLOTS][0];
  },
  ownKeys(pointer) {
    return [ ...Object.getOwnPropertyNames(pointer[SLOTS][0]), SLOTS, ZIG, MEMORY ];
  },
  getOwnPropertyDescriptor(pointer, name) {
    switch (name) {
      case ZIG:
      case SLOTS:
      case MEMORY:
        return Object.getOwnPropertyDescriptor(pointer, name);
      default:
        return Object.getOwnPropertyDescriptor(pointer[SLOTS][0], name);
    }
  },
};
