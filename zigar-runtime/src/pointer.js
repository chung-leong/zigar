import { getDataView, isBuffer, isCompatible } from './data-view.js';
import {
  ConstantConstraint, FixedMemoryTargetRequired, InaccessiblePointer, InvalidPointerTarget,
  NoCastingToPointer, NullPointer, ReadOnlyTarget, throwReadOnly, warnImplicitArrayCreation
} from './error.js';
import { getDescriptor, isValueExpected } from './member.js';
import { getMemoryCopier, restoreMemory } from './memory.js';
import { attachDescriptors, createConstructor, defineProperties } from './object.js';
import { convertToJSON, getValueOf } from './special.js';
import {
  ALIGN, CONST_PROXY, CONST_TARGET, COPIER, ENVIRONMENT, FIXED_LOCATION, GETTER, LOCATION_GETTER,
  LOCATION_SETTER, MEMORY, NORMALIZER, PARENT, POINTER, POINTER_VISITOR, PROXY, SETTER, SIZE,
  SLOTS, TARGET_GETTER, TARGET_SETTER, VIVIFICATOR
} from './symbol.js';
import { MemberType, StructureType } from './types.js';

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
  const { type, sentinel, length } = targetStructure;
  // length for slice can be zero or undefined
  const hasLength = (type === StructureType.Slice) && targetStructure.length === undefined && !sentinel;  
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
        const target = Target.call(ENVIRONMENT, dv);
        this[SLOTS][0] = target;
        this[FIXED_LOCATION] = location;
      }
    }    
  };
  const getTargetObject = function() {
    updateTarget.call(this);
    const target = this[SLOTS][0];
    if (!target) {
      throw new NullPointer();
    }
    return (isConst) ? getConstProxy(target) : target;
  };
  const setTargetObject = function(arg) {
    if (env.inFixedMemory(this)) {
      // the pointer sits in fixed memory--apply the change immediately
      if (env.inFixedMemory(arg)) {
        const loc = {
          address: env.getViewAddress(arg[MEMORY]),
          length: (hasLength) ? arg.length : fixedLength
        };
        addressSetter.call(this, loc);
        this[FIXED_LOCATION] = loc;
      } else {
        throw new FixedMemoryTargetRequired(structure, arg);
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
  const setTarget = !isConst
  ? function(value) {
      updateTarget.call(this);
      const object = this[SLOTS][0];
      if (!object) {
        throw new NullPointer();
      }
      return object[SETTER](value);
    } 
  : throwReadOnly;
  const alternateCaster = function(arg, options) {
    const Target = targetStructure.constructor;
    if ((this === ENVIRONMENT || this === PARENT) || arg instanceof constructor) {
      // casting from buffer to pointer is allowed only if request comes from the runtime
      // casting from writable to read-only is also allowed
      return false;
    } else if (isPointerOf(arg, Target)) {
      // const/non-const casting
      return new constructor(Target(arg['*']), options);
    } else if (type === StructureType.Slice) {
      // allow casting to slice through constructor of its pointer
      return new constructor(Target(arg), options);
    } else {
      throw new NoCastingToPointer(structure);
    }
  };
  const finalizer = function() {
    const handlers = (type === StructureType.Pointer) ? {} : proxyHandlers;
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
        throw new ConstantConstraint(structure, arg);
      }
      arg = arg[SLOTS][0];
    }
    if (arg instanceof Target) {
      /* wasm-only */
      restoreMemory.call(arg);
      /* wasm-only-end */
      const constTarget = arg[CONST_TARGET];
      if (constTarget) {
        if (isConst) {
          arg = constTarget;
        } else {
          throw new ReadOnlyTarget(structure);
        }
      }
    } else if (isCompatible(arg, Target)) {
      // autocast to target type
      const dv = getDataView(targetStructure, arg, env);
      arg = Target(dv);
    } else if (arg !== undefined && !arg[MEMORY]) {
      // autovivificate target object
      const fixed = env.inFixedMemory(this);
      const autoObj = new Target(arg, { fixed });
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
      throw new InvalidPointerTarget(structure, arg);
    }
    this[TARGET_SETTER](arg);
  };
  const constructor = structure.constructor = createConstructor(structure, { initializer, alternateCaster, finalizer }, env);
  const addressSetter = function({ address, length }) {
    setAddress.call(this, address);
    setLength?.call(this, length);
  };
  const fixedLength = (type != StructureType.Slice) ? 1 : length;
  const addressGetter = function() {
    const address = getAddress.call(this);
    const length = (getLength) 
    ? getLength.call(this)
    : (sentinel)
      ? (address) ? env.findSentinel(address, sentinel.bytes) + 1 : 0
      : fixedLength;
    return { address, length };
  };
  const instanceDescriptors = {
    '*': { get: getTarget, set: setTarget },
    '$': { get: getProxy, set: initializer },
    valueOf: { value: getValueOf },
    toJSON: { value: convertToJSON },
    delete: { value: deleteTarget },
    [Symbol.toPrimitive]: (type === StructureType.Primitive) && { value: getPointerPrimitve },
    [TARGET_GETTER]: { value: getTargetObject },
    [TARGET_SETTER]: { value: setTargetObject },
    [LOCATION_GETTER]: { value: addressGetter },
    [LOCATION_SETTER]: { value: addressSetter },
    [POINTER_VISITOR]: { value: visitPointer },
    [COPIER]: { value: getMemoryCopier(byteSize) },
    [VIVIFICATOR]: { value: () => { throw new NullPointer() } },
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

function deleteTarget() {
  const target = this[SLOTS][0];
  target?.delete();
}

function getPointerPrimitve(hint) {
  const target = this[SLOTS][0];
  return target[Symbol.toPrimitive](hint);
}

export function getProxy() {
  return this[PROXY];
}

// function needed in object.js so it's defined there
export { copyPointer } from '../src/object.js';

export function resetPointer({ isActive }) {
  if (this[SLOTS][0] && !isActive(this)) {
    this[SLOTS][0] = undefined;
  }
}

export function disablePointer() {
  const throwError = () => { throw new InaccessiblePointer() };
  const disabledProp = { get: throwError, set: throwError };
  const disabledFunc = { value: throwError };
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

function getConstProxy(target) {
  let proxy = target[CONST_PROXY];
  if (!proxy) {
    Object.defineProperty(target, CONST_PROXY, { value: undefined, configurable: true })
    proxy = new Proxy(target, constTargetHandlers);
    Object.defineProperty(target, CONST_PROXY, { value: proxy })
  }
  return proxy;
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

const constTargetHandlers = {
  get(target, name) {
    if (name === CONST_TARGET) {
      return target;
    } else {
      const value = target[name];
      if (typeof(value) === 'object' && value[CONST_TARGET] === null) {
        return getConstProxy(value);
      } 
      return value;
    }
  },
  set(target, name, value) {
    const ptr = target[POINTER];
    if (ptr && !(name in ptr)) {
      ptr[name] = value;
      return true;
    }
    throwReadOnly();
  }
};

export function always() {
  return true;
}

export function never() {
  return false;
}
