import { getDataView, isBuffer, isCompatible } from './data-view.js';
import {
  throwConstantConstraint, throwFixedMemoryTargetRequired, throwInaccessiblePointer,
  throwInvalidPointerTarget, throwNoCastingToPointer, throwNullPointer, throwReadOnlyTarget,
  warnImplicitArrayCreation
} from './error.js';
import { MemberType, getDescriptor } from './member.js';
import { getDestructor, getMemoryCopier } from './memory.js';
import { convertToJSON, getValueOf } from './special.js';
import { StructureType, attachDescriptors, createConstructor, defineProperties } from './structure.js';
import {
  ALIGN, CONST, COPIER, ENVIRONMENT, GETTER, MEMORY, NORMALIZER, PARENT, POINTER, PROXY, SETTER,
  SIZE, SLOTS, VISITOR, VIVIFICATOR
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
  const isTargetSlice = (targetStructure.type === StructureType.Slice);
  const isTargetPointer = (targetStructure.type === StructureType.Pointer);
  const hasLength = isTargetSlice && !sentinel;  
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
  const { get, set } = getDescriptor(member, env);
  const alternateCaster = function(arg, options) {
    const Target = targetStructure.constructor;
    if (isPointerOf(arg, Target)) {
      // const/non-const casting
      return new constructor(Target(arg['*'], { writable: !isConst }), options);
    } else if (this === ENVIRONMENT || this === PARENT) {
      // allow the runtime environment to cast to pointer
      return false;
    } else if (isTargetSlice) {
      // allow casting to slice through constructor of its pointer
      return new constructor(Target(arg), options);
    } else {
      throwNoCastingToPointer(structure);
    }
  };
  const finalizer = function() {
    const handlers = (isTargetPointer) ? {} : proxyHandlers;
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
    } else if (isTargetSlice) {
      // autovivificate target object
      const autoObj = new Target(arg, { writable: !isConst });
      if (runtimeSafety) {
        // creation of a new slice using a typed array is probably
        // not what the user wants; it's more likely that the intention
        // is to point to the typed array but there's a mismatch (e.g. u32 vs i32)
        if (targetStructure.typedArray && isBuffer(arg?.buffer)) {
          warnImplicitArrayCreation(targetStructure, arg);
        }
      }
      arg = autoObj;
    } else {
      throwInvalidPointerTarget(structure, arg);
    }
    if (env.inFixedMemory(this)) {
      // the pointer sits in fixed memory--apply the change immediately
      if (env.inFixedMemory(arg)) {
        const address = env.getViewAddress(arg[MEMORY]);
        setAddress.call(this, address);
        if (setLength) {
          setLength.call(this, arg.length);
        }
      } else {
        throwFixedMemoryTargetRequired(structure, arg);
      }
    }
    this[SLOTS][0] = arg;
  };
  const constructor = structure.constructor = createConstructor(structure, { initializer, alternateCaster, finalizer }, env);
  const addressSetter = (hasLength) 
  ? function(address, length) {
      setAddress.call(this, address);
      setLength.call(this, length);
    }
  : setAddress;
  const addressGetter = (hasLength)
  ? function() {
    const address = getAddress.call(this);
    const length = getLength.call(this);
    return [ address, length ];
  } 
  : (sentinel)
  ? function() {
    const address = getAddress.call(this);
    const length = (address) ? env.findSentinel(address, sentinel.bytes) + 1 : 0;
    return [ address, length ];
  }
  : function() {
    const address = getAddress.call(this);
    return [ address, 1 ];
  };
  const instanceDescriptors = {
    '*': { get, set },
    '$': { get: getProxy, set: initializer },
    valueOf: { value: getValueOf },
    toJSON: { value: convertToJSON },
    delete: { value: getDestructor(env) },
    [GETTER]: { value: addressGetter },
    [SETTER]: { value: addressSetter },
    [VISITOR]: { value: visitPointer },
    [COPIER]: { value: getMemoryCopier(byteSize) },
    [VIVIFICATOR]: { value: throwNullPointer },
    [NORMALIZER]: { value: normalizePointer },
  };
  const staticDescriptors = {
    child: { get: () => targetStructure.constructor },
    const: { value: isConst },
    [ALIGN]: { value: align },
    [SIZE]: { value: byteSize },
  };
  return attachDescriptors(constructor, instanceDescriptors, staticDescriptors);
}

function normalizePointer(map, forJSON) {
  try {
    const target = this['*'];
    return target[NORMALIZER]?.(map, forJSON) ?? target;  
  } catch (err) {
  }
}

export function getProxy() {
  return this[PROXY];
}

export function copyPointer({ source }) {
  this[SLOTS][0] = source[SLOTS][0];
}

export function resetPointer({ isActive }) {
  if (this[SLOTS][0] && !isActive(this)) {
    this[SLOTS][0] = undefined;
  }
}

export function disablePointer() {
  const disabled = { get: throwInaccessiblePointer, set: throwInaccessiblePointer };
  defineProperties(this, {
    '*': disabled,
    '$': disabled,
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
      return pointer['*'][name];
    }
  },
  set(pointer, name, value) {
    if (name in pointer) {
      pointer[name] = value;
    } else {
      pointer['*'][name] = value;
    }
    return true;
  },
  deleteProperty(pointer, name) {
    if (name in pointer) {
      delete pointer[name];
    } else {
      delete pointer['*'][name];
    }
    return true;
  },
  has(pointer, name) {
    if (name in pointer) {
      return true;
    } else {
      return name in pointer['*'];
    }
  },
};

export function always() {
  return true;
}

export function never() {
  return false;
}
