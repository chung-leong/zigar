import { getDataView, isBuffer, isCompatible } from './data-view.js';
import {
  throwConstantConstraint, throwFixedMemoryTargetRequired, throwInaccessiblePointer,
  throwInvalidPointerTarget, throwNoCastingToPointer, throwNullPointer, throwReadOnlyTarget,
  warnImplicitArrayCreation
} from './error.js';
import { MemberType, getDescriptor, isValueExpected } from './member.js';
import { getDestructor, getMemoryCopier, restoreMemory } from './memory.js';
import { convertToJSON, getValueOf } from './special.js';
import { StructureType, attachDescriptors, createConstructor, defineProperties } from './structure.js';
import {
  ALIGN, CONST, COPIER, ENVIRONMENT, FIXED_LOCATION, GETTER, LOCATION_GETTER, LOCATION_SETTER,
  MEMORY, NORMALIZER, PARENT, POINTER, POINTER_VISITOR, PROXY, SETTER, SIZE, SLOTS, TARGET_GETTER,
  TARGET_SETTER, VIVIFICATOR
} from './symbol.js';

export function definePointer(structure, env) {
  const {
    byteSize,
    align,
    instance: { members: [ member ] },
    isConst,
  } = structure;
  const {
    runtimeSafety = true,
  } = env;
  const { structure: targetStructure } = member;
  const { sentinel } = targetStructure;
  const hasLength = (targetStructure.type === StructureType.Slice) && !sentinel;  
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
  const updateTarget = function() {
    const prevLocation = this[FIXED_LOCATION];
    if (prevLocation) {
      const location = this[LOCATION_GETTER]();
      if (location.address !== prevLocation.address || location.length !== prevLocation.length) {
        const { constructor: Target } = targetStructure;
        const dv = env.findMemory(location.address, location.length * Target[SIZE]);
        const target = Target.call(ENVIRONMENT, dv, { writable: !isConst });
        this[SLOTS][0] = target;
        this[FIXED_LOCATION] = location;
      }
    }    
  };
  const getTargetObject = function() {
    updateTarget.call(this);
    return this[SLOTS][0] ?? throwNullPointer();
  };
  const setTargetObject = function(arg) {
    if (env.inFixedMemory(this)) {
      // the pointer sits in fixed memory--apply the change immediately
      if (env.inFixedMemory(arg)) {
        const loc = {
          address: env.getViewAddress(arg[MEMORY]),
          length: (hasLength) ? arg.length : 1
        };
        addressSetter.call(this, loc);
        this[FIXED_LOCATION] = loc;
      } else {
        throwFixedMemoryTargetRequired(structure, arg);
      }
    }
    this[SLOTS][0] = arg;
  };
  const getTarget = isValueExpected(targetStructure)
  ? function() {
      const target = getTargetObject.call(this);
      return target[GETTER]();
    }
  : getTargetObject;
  const setTarget = function(value) {
    updateTarget.call(this);
    const object = this[SLOTS][0] ?? throwNullPointer();
    return object[SETTER](value);
  };
  const alternateCaster = function(arg, options) {
    const Target = targetStructure.constructor;
    if ((this === ENVIRONMENT || this === PARENT) || arg instanceof constructor) {
      // casting from buffer to pointer is allowed only if request comes from the runtime
      // casting from writable to read-only is also allowed
      return false;
    } else if (isPointerOf(arg, Target)) {
      // const/non-const casting
      return new constructor(Target(arg['*'], { writable: !isConst }), options);
    } else if (targetStructure.type === StructureType.Slice) {
      // allow casting to slice through constructor of its pointer
      return new constructor(Target(arg), options);
    } else {
      throwNoCastingToPointer(structure);
    }
  };
  const finalizer = function() {
    const handlers = (targetStructure.type === StructureType.Pointer) ? {} : proxyHandlers;
    const proxy = new Proxy(this, handlers);
    // hide the proxy so console wouldn't display a recursive structure
    Object.defineProperty(this, PROXY, { value: proxy });
    return proxy;
  };
  const initializer = function(arg) {
    const Target = targetStructure.constructor;
    if (isPointerOf(arg, Target)) {
      // initialize with the other pointer'structure target
      if (!isConst && arg.constructor.const) {
        throwConstantConstraint(structure, arg);
      }
      arg = arg[SLOTS][0];
    }
    if (arg instanceof Target) {
      /* wasm-only */
      restoreMemory.call(arg);
      /* wasm-only-end */
      if (isConst && !arg[CONST]) {
        // create read-only version
        arg = Target(arg, { writable: false });
      } else if (!isConst && arg[CONST]) {
        throwReadOnlyTarget(structure);       
      }
    } else if (isCompatible(arg, Target)) {
      // autocast to target type
      const dv = getDataView(targetStructure, arg, env);
      arg = Target(dv, { writable: !isConst });
    } else if (arg !== undefined && !arg[MEMORY]) {
      // autovivificate target object
      const fixed = env.inFixedMemory(this);
      const autoObj = new Target(arg, { writable: !isConst, fixed });
      if (runtimeSafety) {
        // creation of a new slice using a typed array is probably
        // not what the user wants; it's more likely that the intention
        // is to point to the typed array but there's a mismatch (e.g. u32 vs i32)
        if (targetStructure.typedArray && isBuffer(arg?.buffer)) {
          warnImplicitArrayCreation(targetStructure, arg);
        }
      }
      arg = autoObj;
    } else if (arg !== undefined) {
      throwInvalidPointerTarget(structure, arg);
    }
    this[TARGET_SETTER](arg);
  };
  const constructor = structure.constructor = createConstructor(structure, { initializer, alternateCaster, finalizer }, env);
  const addressSetter = function({ address, length }) {
    setAddress.call(this, address);
    setLength?.call(this, length);
  };
  const addressGetter = function() {
    const address = getAddress.call(this);
    const length = (getLength) 
    ? getLength.call(this)
    : (sentinel)
      ? (address) ? env.findSentinel(address, sentinel.bytes) + 1 : 0
      : 1;
    return { address, length };
  };
  const instanceDescriptors = {
    '*': { get: getTarget, set: setTarget },
    '$': { get: getProxy, set: initializer },
    valueOf: { value: getValueOf },
    toJSON: { value: convertToJSON },
    delete: { value: getDestructor(env) },
    [Symbol.toPrimitive]: (targetStructure.type === StructureType.Primitive) && { value: getPointerPrimitve },
    [TARGET_GETTER]: { value: getTargetObject },
    [TARGET_SETTER]: { value: setTargetObject },
    [LOCATION_GETTER]: { value: addressGetter },
    [LOCATION_SETTER]: { value: addressSetter },
    [POINTER_VISITOR]: { value: visitPointer },
    [COPIER]: { value: getMemoryCopier(byteSize) },
    [VIVIFICATOR]: { value: throwNullPointer },
    [NORMALIZER]: { value: normalizePointer },
    [FIXED_LOCATION]: { value: undefined, writable: true },
  };
  const staticDescriptors = {
    child: { get: () => targetStructure.constructor },
    const: { value: isConst },
    [ALIGN]: { value: align },
    [SIZE]: { value: byteSize },
  };
  return attachDescriptors(constructor, instanceDescriptors, staticDescriptors);
}

function normalizePointer(cb) {
  let value;
  try {
    value = this['*'];
  } catch (err) {
    value = Symbol.for('inaccessible');
  }
  return cb(value);
}

function getPointerPrimitve(hint) {
  const target = this[SLOTS][0];
  return target[Symbol.toPrimitive](hint);
}

export function getProxy() {
  return this[PROXY];
}

export function copyPointer({ source }) {
  const target = source[SLOTS][0];
  if (target) {
    this[TARGET_SETTER](target);
  }
}

export function resetPointer({ isActive }) {
  if (this[SLOTS][0] && !isActive(this)) {
    this[SLOTS][0] = undefined;
  }
}

export function disablePointer() {
  const disabledProp = { get: throwInaccessiblePointer, set: throwInaccessiblePointer };
  const disabledFunc = { value: throwInaccessiblePointer };
  defineProperties(this[POINTER], {
    '*': disabledProp,
    '$': disabledProp,
    [GETTER]: disabledFunc,
    [SETTER]: disabledFunc,
    [TARGET_GETTER]: disabledFunc,
  });
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

const proxyHandlers = {
  get(pointer, name) {
    if (name === POINTER) {
      return pointer;
    } else if (name in pointer) {
      return pointer[name];
    } else {
      const target = pointer[TARGET_GETTER]();
      return target[name];
    }
  },
  set(pointer, name, value) {
    if (name in pointer) {
      pointer[name] = value;
    } else {
      const target = pointer[TARGET_GETTER]();
      target[name] = value;
    }
    return true;
  },
  deleteProperty(pointer, name) {
    if (name in pointer) {
      delete pointer[name];
    } else {
      const target = pointer[TARGET_GETTER]();
      delete target[name];
    }
    return true;
  },
  has(pointer, name) {
    if (name in pointer) {
      return true;
    } else {
      const target = pointer[TARGET_GETTER]();
      return name in target;
    }
  },
};

export function always() {
  return true;
}

export function never() {
  return false;
}
