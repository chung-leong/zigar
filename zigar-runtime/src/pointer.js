import { getDataView, isCompatible } from './data-view.js';
import {
  ConstantConstraint, FixedMemoryTargetRequired, InaccessiblePointer, InvalidPointerTarget,
  InvalidSliceLength, NoCastingToPointer, NullPointer, ReadOnlyTarget, throwReadOnly,
  warnImplicitArrayCreation
} from './error.js';
import { getDescriptor, isValueExpected } from './member.js';
import { getMemoryCopier } from './memory.js';
import { attachDescriptors, createConstructor, defineProperties } from './object.js';
import { convertToJSON, getValueOf } from './special.js';
import {
  ADDRESS, ADDRESS_SETTER, ALIGN, CONST_PROXY, CONST_TARGET, COPIER, ENVIRONMENT, FIXED, GETTER,
  LENGTH, LENGTH_SETTER, MAX_LENGTH, MEMORY, MEMORY_RESTORER, PARENT, POINTER, POINTER_VISITOR,
  PROXY, SETTER, SIZE, SLOTS, TARGET_GETTER, TARGET_SETTER, TARGET_UPDATER, TYPE, WRITE_DISABLER
} from './symbol.js';
import { MemberType, StructureType, isPointer } from './types.js';

export function definePointer(structure, env) {
  const {
    type,
    byteSize,
    align,
    instance: { members: [ member ] },
    isConst,
  } = structure;
  const {
    runtimeSafety = true,
  } = env;
  const { structure: targetStructure } = member;
  const { type: targetType, sentinel, byteSize: elementSize } = targetStructure;
  // length for slice can be zero or undefined
  const hasLengthInMemory = type === StructureType.SlicePointer;
  const addressSize = (hasLengthInMemory) ? byteSize / 2 : byteSize;
  const { get: getAddressInMemory, set: setAddressInMemory } = getDescriptor({
    type: MemberType.Uint,
    bitOffset: 0,
    bitSize: addressSize * 8,
    byteSize: addressSize,
    structure: { byteSize: addressSize },
  }, env);
  const { get: getLengthInMemory, set: setLengthInMemory } = (hasLengthInMemory) ? getDescriptor({
    type: MemberType.Uint,
    bitOffset: addressSize * 8,
    bitSize: addressSize * 8,
    byteSize: addressSize,
    structure: { name: 'usize', byteSize: addressSize },
  }, env) : {};
  const updateTarget = function(always = true, active = true) {
    if (always || this[MEMORY][FIXED]) {
      if (active) {
        const address = getAddressInMemory.call(this);
        const length = (hasLengthInMemory)
        ? getLengthInMemory.call(this)
        : (sentinel)
          ? env.findSentinel(address, sentinel.bytes) + 1
          : 1;
        if (address !== this[ADDRESS] || length !== this[LENGTH]) {
          const Target = targetStructure.constructor;
          const dv = env.findMemory(address, length, Target[SIZE]);
          const newTarget = (dv) ? Target.call(ENVIRONMENT, dv) : null;
          this[SLOTS][0] = newTarget;
          this[ADDRESS] = address;
          this[LENGTH] = length;
          if (hasLengthInMemory) {
            this[MAX_LENGTH] = length;
          }
          return newTarget;
        }
      } else {
        return this[SLOTS][0] = undefined;
      }
    }
    return this[SLOTS][0];
  };
  const setAddress = function(address) {
    setAddressInMemory.call(this, address);
    this[ADDRESS] = address;
  };
  const setLength = (hasLengthInMemory || sentinel)
  ? function(length) {
      setLengthInMemory?.call?.(this, length);
      this[LENGTH] = length;
    }
  : null;
  const getTargetObject = function() {
    const pointer = this[POINTER] ?? this;
    const target = updateTarget.call(pointer, false);
    if (!target) {
      throw new NullPointer();
    }
    return (isConst) ? getConstProxy(target) : target;
  };
  const setTargetObject = function(arg) {
    const pointer = this[POINTER] ?? this;
    if (pointer[MEMORY][FIXED]) {
      // the pointer sits in fixed memory--apply the change immediately
      if (arg[MEMORY][FIXED]) {
        const address = env.getViewAddress(arg[MEMORY]);
        setAddress.call(this, address);
        if (hasLengthInMemory) {
          setLength.call(this, arg.length);
        }
      } else {
        throw new FixedMemoryTargetRequired(structure, arg);
      }
    }
    pointer[SLOTS][0] = arg;
    if (hasLengthInMemory) {
      this[MAX_LENGTH] = arg.length;
    }
  };
  const getTarget = isValueExpected(targetStructure)
  ? function() {
      const target = getTargetObject.call(this);
      return target[GETTER]();
    }
  : getTargetObject;
  const setTarget = !isConst
  ? function(value) {
      const target = getTargetObject.call(this);
      return target[SETTER](value);
    }
  : throwReadOnly;
  const getTargetLength = function() {
    const target = getTargetObject.call(this);
    return target.length;
  }
  const setTargetLength = function(len) {
    len = len | 0;
    const target = getTargetObject.call(this);
    const dv = target[MEMORY];
    const fixed = dv[FIXED];
    const bytesAvailable = dv.buffer.byteLength - dv.byteOffset;
    // determine the maximum length
    let max;
    if (!fixed) {
      if (hasLengthInMemory) {
        max = this[MAX_LENGTH];
      } else {
        max = (bytesAvailable / elementSize) | 0;
      }
    }
    if (len < 0 || len > max) {
      throw new InvalidSliceLength(len, max);
    }
    const byteLength = len * elementSize;
    const newDV = (byteLength <= bytesAvailable)
    // can use the same buffer
    ? env.obtainView(dv.buffer, dv.byteOffset, byteLength)
    // need to ask V8 for a larger external buffer
    : env.obtainFixedView(fixed.address, byteLength);
    const Target = targetStructure.constructor;
    this[SLOTS][0] = Target.call(ENVIRONMENT, newDV);
    if (hasLengthInMemory) {
      setLength?.call(this, len);
    }
  };
  const alternateCaster = function(arg, options) {
    const Target = targetStructure.constructor;
    if ((this === ENVIRONMENT || this === PARENT) || arg instanceof constructor) {
      // casting from buffer to pointer is allowed only if request comes from the runtime
      // casting from writable to read-only is also allowed
      return false;
    } else if (isPointerOf(arg, Target)) {
      // const/non-const casting
      return new constructor(Target(arg['*']), options);
    } else if (targetType === StructureType.Slice) {
      // allow casting to slice through constructor of its pointer
      return new constructor(Target(arg), options);
    } else {
      throw new NoCastingToPointer(structure);
    }
  };
  const finalizer = function() {
    const handlers = isPointer(targetType) ? {} : proxyHandlers;
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
      /* WASM-ONLY */
      arg[MEMORY_RESTORER]();
      /* WASM-ONLY-END */
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
      const autoObj = new Target(arg, { fixed: !!this[MEMORY][FIXED] });
      if (runtimeSafety) {
        // creation of a new slice using a typed array is probably
        // not what the user wants; it's more likely that the intention
        // is to point to the typed array but there's a mismatch (e.g. u32 vs i32)
        if (targetStructure.typedArray) {
          const tag = arg?.buffer?.[Symbol.toStringTag];
          if (tag === 'ArrayBuffer' || tag === 'SharedArrayBuffer') {
            warnImplicitArrayCreation(targetStructure, arg);
          }
        }
      }
      arg = autoObj;
    } else if (arg !== undefined) {
      throw new InvalidPointerTarget(structure, arg);
    }
    this[TARGET_SETTER](arg);
  };
  const constructor = structure.constructor = createConstructor(structure, { initializer, alternateCaster, finalizer }, env);
  const instanceDescriptors = {
    '*': { get: getTarget, set: setTarget },
    '$': { get: getProxy, set: initializer },
    length: { get: getTargetLength, set: setTargetLength },
    valueOf: { value: getValueOf },
    toJSON: { value: convertToJSON },
    delete: { value: deleteTarget },
    [Symbol.toPrimitive]: (targetType === StructureType.Primitive) && { value: getTargetPrimitive },
    [TARGET_GETTER]: { value: getTargetObject },
    [TARGET_SETTER]: { value: setTargetObject },
    [TARGET_UPDATER]: { value: updateTarget },
    [ADDRESS_SETTER]: { value: setAddress },
    [LENGTH_SETTER]: setLength && { value: setLength },
    [POINTER_VISITOR]: { value: visitPointer },
    [COPIER]: { value: getMemoryCopier(byteSize) },
    [WRITE_DISABLER]: { value: makePointerReadOnly },
    [ADDRESS]: { value: undefined, writable: true },
    [LENGTH]: setLength && { value: undefined, writable: true },
  };
  const staticDescriptors = {
    child: { get: () => targetStructure.constructor },
    const: { value: isConst },
    [ALIGN]: { value: align },
    [SIZE]: { value: byteSize },
    [TYPE]: { value: structure.type },
  };
  return attachDescriptors(constructor, instanceDescriptors, staticDescriptors, env);
}

function makePointerReadOnly() {
  const pointer = this[POINTER];
  const descriptor = Object.getOwnPropertyDescriptor(pointer.constructor.prototype, '$');
  descriptor.set = throwReadOnly;
  Object.defineProperty(pointer, '$', descriptor);
  Object.defineProperty(pointer, CONST_TARGET, { value: pointer });
}

function deleteTarget() {
  const target = this[TARGET_GETTER]();
  target?.delete();
}

function getTargetPrimitive(hint) {
  const target = this[TARGET_GETTER]();
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
      if (value?.[CONST_TARGET] === null) {
        return getConstProxy(value);
      }
      return value;
    }
  },
  set(target, name, value) {
    const ptr = target[POINTER];
    if (ptr && !(name in ptr)) {
      target[name] = value;
    } else {
      throwReadOnly();
    }
    return true;
  }
};

export function always() {
  return true;
}

export function never() {
  return false;
}
