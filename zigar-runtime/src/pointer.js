import { StructureType } from './structure.js';
import { requireDataView, getDataView, isCompatible, isBuffer } from './data-view.js';
import { MEMORY, PROXY, SLOTS, ZIG, PARENT } from './symbol.js';
import {
  throwNoCastingToPointer,
  throwInaccessiblePointer,
  throwInvalidPointerTarget,
  throwAssigningToConstant,
  throwConstantConstraint,
  addArticle,
} from './error.js';

export function finalizePointer(s) {
  const {
    size,
    instance: {
      members: [ member ],
    },
  } = s;
  const { isConst, structure: targetStructure } = member;
  const isTargetSlice = targetStructure.type;
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
        const Target = targetStructure.constructor;
        if (isPointerOf(arg, Target)) {
          creating = true;
          arg = arg['*'];
        } else if (isTargetSlice) {
          creating = true;
          warnTypedArray?.(arg);
          arg = constructor.child(arg);
        } else {
          throwNoCastingToPointer(s);
        }
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
    return createProxy.call(self, member);
  };
  const warnTypedArray = (targetStructure.typedArray) ? function(arg) {
    if (isBuffer(arg?.buffer)) {
      const created = addArticle(targetStructure.typedArray.name);
      const source = addArticle(arg.constructor.name);
      console.warn(`Implicitly creating ${created} from ${source}`);
    }
  } : null;
  const initializer = s.initializer = function(arg) {
    if (arg instanceof constructor) {
      // not doing memory copying since the value stored there likely isn't valid anyway
      pointerCopier.call(this, arg);
    } else {
      const Target = targetStructure.constructor;
      if (isPointerOf(arg, Target)) {
        if (!isConst && arg.constructor.const) {
          throwConstantConstraint(s, arg);
        }
        pointerCopier.call(this, arg);
      } else {
        if (!(arg instanceof Target)) {
          if (isCompatible(arg, Target)) {
            // autocast to target type
            const dv = getDataView(targetStructure, arg);
            arg = Target(dv);
          } else if (isTargetSlice) {
            // autovivificate target object
            warnTypedArray?.(arg);
            arg = new Target(arg);
          } else {
            throwInvalidPointerTarget(s, arg);
          }
        }
        this[SLOTS][0] = arg;
      }
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
  const setTargetValue = (isConst) ? undefined : function(value) {
    const object = this[SLOTS][0];
    object.$ = value;
  };
  Object.defineProperties(constructor.prototype, {
    '*': { get: getTargetValue, set: setTargetValue, configurable: true },
    '$': { get: retriever, set: initializer, configurable: true, },
  });
  Object.defineProperties(constructor, {
    child: { get: () => targetStructure.constructor },
    const: { value: isConst },
  });
  return constructor;
}

function isPointerOf(arg, Target) {
  return (arg?.constructor?.child === Target && arg['*']);
}

function createProxy({ structure, isConst }) {
  const descriptors = (structure.type !== StructureType.Pointer)
    ? (isConst) ? constProxyHandlers : proxyHandlers
    : {};
  const proxy = new Proxy(this, descriptors);
  this[PROXY] = proxy;
  return proxy;
}

const proxyHandlers = {
  get(pointer, name) {
    switch (name) {
      case '$':
      case '*':
      case 'constructor':
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
      case 'constructor':
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
      case 'constructor':
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

const constProxyHandlers = {
  ...proxyHandlers,
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
        throwAssigningToConstant(pointer);
    }
    return true;
  },
};