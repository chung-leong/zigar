import { StructureType, attachDescriptors, createConstructor } from './structure.js';
import { getDestructor, getMemoryCopier } from './memory.js';
import { getDataView, isCompatible, isBuffer } from './data-view.js';
import { MemberType, getDescriptor } from './member.js';
import { throwNoCastingToPointer, throwInaccessiblePointer, throwInvalidPointerTarget,
  throwConstantConstraint, throwFixedMemoryTargetRequired, throwNullPointer,
  throwReadOnlyTarget, warnImplicitArrayCreation} from './error.js';
import { ADDRESS_GETTER, ADDRESS_SETTER, ALIGN, CHILD_VIVIFICATOR, CONST, ENVIRONMENT, MEMORY, 
  MEMORY_COPIER, PARENT, POINTER_SELF, POINTER_VISITOR, PROXY, SLOTS, SIZE, 
  VALUE_NORMALIZER } from './symbol.js';
import { convertToJSON, getBase64Accessors, getDataViewAccessors, getValueOf } from './special.js';

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
    dataView: getDataViewAccessors(structure),
    base64: getBase64Accessors(structure),
    valueOf: { value: getValueOf },
    toJSON: { value: convertToJSON },
    delete: { value: getDestructor(env) },
    [ADDRESS_GETTER]: { value: addressGetter },
    [ADDRESS_SETTER]: { value: addressSetter },
    [POINTER_VISITOR]: { value: visitPointer },
    [MEMORY_COPIER]: { value: getMemoryCopier(byteSize) },
    [CHILD_VIVIFICATOR]: { value: throwNullPointer },
    [VALUE_NORMALIZER]: { value: normalizePointer },
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
  const target = this['*'];
  return target[VALUE_NORMALIZER]?.(map, forJSON) ?? target;
}

export function getProxy() {
  return this[PROXY];
}

export function copyPointer({ source }) {
  this[SLOTS][0] = source[SLOTS][0];
}

export function resetPointer({ isActive }) {
  if (this[SLOTS][0] && !isActive(this)) {
    this[SLOTS][0] = null;
  }
}

export function disablePointer() {
  Object.defineProperty(this[SLOTS], 0, {
    get: throwInaccessiblePointer,
    set: throwInaccessiblePointer,
    configurable: true
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

const isPointerKeys = {
  '$': true,
  '*': true,
  constructor: true,
  valueOf: true,
  [CONST]: true,
  [SLOTS]: true,
  [MEMORY]: true,
  [PROXY]: true,
  [ADDRESS_GETTER]: true,
  [ADDRESS_SETTER]: true,
  [POINTER_VISITOR]: true,
  [CHILD_VIVIFICATOR]: true,
  [VALUE_NORMALIZER]: true,
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
};

export function always() {
  return true;
}
