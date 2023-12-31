import { ObjectCache, StructureType, defineProperties } from './structure.js';
import { getMemoryCopier } from './memory.js';
import { requireDataView, getDataView, isCompatible, isBuffer } from './data-view.js';
import { MemberType, getDescriptor } from './member.js';
import { throwNoCastingToPointer, throwInaccessiblePointer, throwInvalidPointerTarget,
  throwAssigningToConstant, throwConstantConstraint, throwNoInitializer,
  throwFixedMemoryTargetRequired, addArticle, throwReadOnly } from './error.js';
import { ADDRESS_GETTER, ADDRESS_SETTER, ALIGN, ENVIRONMENT, LENGTH_GETTER, LENGTH_SETTER, MEMORY,
  MEMORY_COPIER, POINTER_SELF, POINTER_VISITOR, PARENT, PROXY, SLOTS, SIZE } from './symbol.js';

export function definePointer(s, env) {
  const {
    byteSize,
    align,
    instance: { members: [ member ] },
    isConst,
  } = s;
  const {
    runtimeSafety = true,
  } = env;
  const { structure: targetStructure } = member;
  const isTargetSlice = (targetStructure.type === StructureType.Slice);
  const isTargetPointer = (targetStructure.type === StructureType.Pointer);
  const hasLength = isTargetSlice && !targetStructure.sentinel;
  const addressSize = (hasLength) ? byteSize / 2 : byteSize;
  const { get: getAddress, set: setAddress } = getDescriptor({
    type: MemberType.Uint,
    bitOffset: 0,
    bitSize: addressSize * 8,
    byteSize: addressSize,
    structure: { byteSize: addressSize },
  }, env);
  const { get: getLength, set: setLength } = (hasLength) ? getDescriptor({
    type: MemberType.Uint,
    bitOffset: addressSize * 8,
    bitSize: addressSize * 8,
    byteSize: addressSize,
    structure: { name: 'usize', byteSize: addressSize },
  }, env) : {};
  const cache = new ObjectCache();
  const constructor = s.constructor = function(arg, options = {}) {
    const {
      writable = true,
      fixed = false,
    } = options;
    const calledFromEnviroment = this === ENVIRONMENT;
    const calledFromParent = this === PARENT;
    let creating = this instanceof constructor;
    let self, dv;
    if (creating) {
      if (arguments.length === 0) {
        throwNoInitializer(s);
      }
      self = this;
      dv = env.allocateMemory(byteSize, align, fixed);
    } else {
      if (calledFromEnviroment || calledFromParent) {
        dv = requireDataView(s, arg, env);
        if (self = cache.find(dv, writable)) {
          return self;
        }
        self = Object.create(constructor.prototype); 
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
        dv = env.allocateMemory(byteSize, align, fixed);
        self = Object.create(constructor.prototype); 
      }
    }
    self[MEMORY] = dv;
    self[SLOTS] = { 0: null };
    if (creating) {
      initializer.call(self, arg);
    }
    if (!writable) {
      defineProperties(self, {
        '$': { get: getProxy, set: throwReadOnly, configurable: true, },
      });
    }
    const proxy = createProxy.call(self, isConst, isTargetPointer);
    return cache.save(dv, writable, proxy);
  };
  const initializer = function(arg) {
    if (arg instanceof constructor) {
      if (env.inFixedMemory(this)) {
        // initialize with the other pointer's target
        initializer.call(this, arg[SLOTS][0]);
      } else {
        // copy the object stored in slots 0, not copying memory of the other object
        // since the value stored there likely isn't valid
        copyPointer.call(this, { source: arg });
      }
    } else {
      const Target = targetStructure.constructor;
      if (isPointerOf(arg, Target)) {
        if (!isConst && arg.constructor.const) {
          throwConstantConstraint(s, arg);
        }
        copyPointer.call(this, { source: arg });
      } else {
        if (!(arg instanceof Target)) {
          if (isCompatible(arg, Target)) {
            // autocast to target type
            const dv = getDataView(targetStructure, arg, env);
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
        if (env.inFixedMemory(this)) {
          // the pointer sits in shared memory--apply the change immediately
          if (env.inFixedMemory(arg)) {
            const address = env.getViewAddress(arg[MEMORY]);
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
  defineProperties(constructor.prototype, {
    '*': { get: getTarget, set: (isConst) ? throwReadOnly : setTarget, configurable: true },
    '$': { get: getProxy, set: initializer, configurable: true, },
    'valueOf': { value: getTargetValue, configurable: true, writable: true },
    [ADDRESS_GETTER]: { value: getAddress },
    [ADDRESS_SETTER]: { value: setAddress },
    [LENGTH_GETTER]: hasLength && { value: getLength },
    [LENGTH_SETTER]: hasLength && { value: setLength },
    [POINTER_VISITOR]: { value: visitPointer },
    [MEMORY_COPIER]: { value: getMemoryCopier(byteSize) },
  });
  defineProperties(constructor, {
    child: { get: () => targetStructure.constructor },
    const: { value: isConst },
    [ALIGN]: { value: align },
    [SIZE]: { value: byteSize },
  });
  return constructor;
}

export function getProxy() {
  return this[PROXY];
}

export function copyPointer({ source }) {
  this[SLOTS][0] = source[SLOTS][0];
}

export function resetPointer() {
  this[SLOTS][0] = null;
}

export function disablePointer() {
  Object.defineProperty(this[SLOTS], 0, {
    get: throwInaccessiblePointer,
    set: throwInaccessiblePointer,
    configurable: true
  });
}

function getTarget() {
  const object = this[SLOTS][0];
  return object?.$ ?? null;
}

function setTarget(value) {
  const object = this[SLOTS][0];
  object.$ = value;
}

function getTargetValue() {
  const object = this[SLOTS][0];
  return object.$.valueOf();
}

function visitPointer(fn, options = {}) {
  const {
    source,
    isActive = always,
    isMutable = always,
  } = options;
  fn.call(this, { source, isActive, isMutable });
}

function isPointerOf(arg, Target) {
  return (arg?.constructor?.child === Target && arg['*']);
}

function createProxy(isConst, isTargetPointer) {
  const handlers = (!isTargetPointer) ? (isConst) ? constProxyHandlers : proxyHandlers : {};
  const proxy = new Proxy(this, handlers);
  // hide the proxy so console wouldn't display a recursive structure
  Object.defineProperty(this, PROXY, { value: proxy });
  return proxy;
}

const isPointerKeys = {
  '$': true,
  '*': true,
  constructor: true,
  valueOf: true,
  memory: true,
  slots: true,
  [SLOTS]: true,
  [MEMORY]: true,
  [PROXY]: true,
  [ADDRESS_GETTER]: true,
  [ADDRESS_SETTER]: true,
  [LENGTH_GETTER]: true,
  [LENGTH_SETTER]: true,
  [POINTER_VISITOR]: true,
  [Symbol.toStringTag]: true,
  [Symbol.toPrimitive]: true,
};

const proxyHandlers = {
  get(pointer, name) {
    if (name === POINTER_SELF) {
      return pointer;
    } else if (isPointerKeys[name]) {
      return pointer[name];
    } else {
      return pointer[SLOTS][0][name];
    }
  },
  set(pointer, name, value) {
    if (isPointerKeys[name]) {
      pointer[name] = value;
    } else {
      pointer[SLOTS][0][name] = value;
    }
    return true;
  },
  deleteProperty(pointer, name) {
    if (isPointerKeys[name]) {
      delete pointer[name];
    } else {
      delete pointer[SLOTS][0][name];
    }
    return true;
  },
  has(pointer, name) {
    if (isPointerKeys[name]) {
      return true;
    }
    const target = pointer[SLOTS][0];
    if (!target) {
      return false;
    }
    return name in target;
  },
  ownKeys(pointer) {
    const targetKeys = Object.getOwnPropertyNames(pointer[SLOTS][0]);
    return [ ...targetKeys, PROXY, POINTER_VISITOR ];
  },
  getOwnPropertyDescriptor(pointer, name) {
    if (isPointerKeys[name]) {
      return Object.getOwnPropertyDescriptor(pointer, name);
    } else {
      return Object.getOwnPropertyDescriptor(pointer[SLOTS][0], name);
    }
  },
};

const constProxyHandlers = {
  ...proxyHandlers,
  set(pointer, name, value) {
    if (isPointerKeys[name]) {
      pointer[name] = value;
    } else {
      throwAssigningToConstant(pointer);
    }
    return true;
  },
  getOwnPropertyDescriptor(pointer, name) {
    if (isPointerKeys[name]) {
      return Object.getOwnPropertyDescriptor(pointer, name);
    } else {
      const descriptor = Object.getOwnPropertyDescriptor(pointer[SLOTS][0], name);
      if (descriptor?.set) {
        descriptor.set = undefined;
      }
      return descriptor;
    }
    /* c8 ignore next -- unreachable */
  },
};

export function always() {
  return true;
}
