import { StructureType } from './structure.js';
import { requireDataView, getDataView, isCompatible, isBuffer } from './data-view.js';
import { MemberType, getAccessors } from './member.js';
import { MEMORY, PROXY, SLOTS, ZIG, PARENT } from './symbol.js';
import {
  throwNoCastingToPointer,
  throwInaccessiblePointer,
  throwInvalidPointerTarget,
  throwAssigningToConstant,
  throwConstantConstraint,
  throwNoInitializer,
  throwFixedMemoryTargetRequired,
  addArticle,
} from './error.js';

export function finalizePointer(s) {
  const {
    size,
    instance: {
      members: [ member ],
    },
    isConst,
    options,
  } = s;
  const {
    runtimeSafety = true,
  } = options;
  const { structure: targetStructure } = member;
  const isTargetSlice = (targetStructure.type === StructureType.Slice);
  const isTargetPointer = (targetStructure.type === StructureType.Pointer);
  const addressSize = (isTargetSlice) ? size / 2 : size;
  const usizeStructure = { name: 'usize', size: addressSize };
  const setAddress = getAccessors({
    type: MemberType.Int,
    isSigned: false,
    bitOffset: 0,
    bitSize: addressSize * 8,
    byteSize: addressSize,
    structure: usizeStructure,
  }, options).set;
  const setLength = (isTargetSlice) ? getAccessors({
    type: MemberType.Int,
    isSigned: false,
    bitOffset: addressSize * 8,
    bitSize: addressSize * 8,
    byteSize: addressSize,
    structure: usizeStructure,
  }, options).set : null;
  const constructor = s.constructor = function(arg) {
    const calledFromZig = (this === ZIG);
    const calledFromParent = (this === PARENT);
    let creating = this instanceof constructor;
    let self, dv;
    if (creating) {
      if (arguments.length === 0) {
        throwNoInitializer(s);
      }
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
          // allow casting to slice through constructor of its pointer
          creating = true;
          arg = Target(arg);
        } else {
          throwNoCastingToPointer(s);
        }
      }
    }
    self[MEMORY] = dv;
    self[SLOTS] = { 0: null };
    self[ZIG] = calledFromZig;
    if (creating) {
      initializer.call(self, arg);
    }
    return createProxy.call(self, isConst, isTargetPointer);
  };
  const initializer = s.initializer = function(arg) {
    if (arg instanceof constructor) {
      if (inFixedMemory(this)) {
        initializer.call(this, arg[SLOTS][0]);
      } else {
        // not doing memory copying since the value stored there likely isn't valid
        pointerCopier.call(this, arg);
      }
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
            const autoObj = new Target(arg);
            if (runtimeSafety) {
              // creation of a new slice using a typed array is probably
              // not what the user wants; it's more likely that the intention
              // is to point to the typed array but there's a mismatch (e.g. u32 vs i32)
              if (targetStructure.typedArray && isBuffer(arg?.buffer)) {
                const created = addArticle(targetStructure.typedArray.name);
                const source = addArticle(arg.constructor.name);
                console.warn(`Implicitly creating ${created} from ${source}`);
              }
            }
            arg = autoObj;
          } else {
            throwInvalidPointerTarget(s, arg);
          }
        }
        if (inFixedMemory(this)) {
          if (inFixedMemory(arg)) {
            const { address } = inFixedMemory(arg);
            setAddress.call(this, address);
            if (setLength) {
              setLength.call(this, arg.length);
            }
          } else {
            throwFixedMemoryTargetRequired(s, arg);
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
    Object.defineProperty(this[SLOTS], 0, {
      get: throwInaccessiblePointer,
      set: throwInaccessiblePointer,
      configurable: true
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

function inFixedMemory(arg) {
  if (process.env.ZIGAR_TARGET === 'NODE-CPP-EXT') {
    return arg?.[MEMORY]?.buffer?.[MEMORY];
  } else {
    return arg?.[MEMORY]?.[MEMORY];
  }
}

function createProxy(isConst, isTargetPointer) {
  const handlers = (!isTargetPointer) ? (isConst) ? constProxyHandlers : proxyHandlers : {};
  const proxy = new Proxy(this, handlers);
  // hide the proxy so console wouldn't display a recursive structure
  Object.defineProperty(this, PROXY, { value: proxy });
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
      case Symbol.toStringTag:
      case Symbol.toPrimitive:
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
      case Symbol.toStringTag:
      case Symbol.toPrimitive:
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
      case Symbol.toStringTag:
      case Symbol.toPrimitive:
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
    const targetKeys = Object.getOwnPropertyNames(pointer[SLOTS][0]);
    return [ ...targetKeys, PROXY ];
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
  getOwnPropertyDescriptor(pointer, name) {
    switch (name) {
      case ZIG:
      case SLOTS:
      case MEMORY:
        return Object.getOwnPropertyDescriptor(pointer, name);
      default:
        const descriptor = Object.getOwnPropertyDescriptor(pointer[SLOTS][0], name);
        if (descriptor?.set) {
          descriptor.set = undefined;
        }
        return descriptor;
    }
    /* c8 ignore next -- unreachable */
  },
};
