import { MemberFlag, MemberType, StructureFlag, StructureType } from '../constants.js';
import { mixin } from '../environment.js';
import {
  ConstantConstraint, FixedMemoryTargetRequired, InaccessiblePointer, InvalidPointerTarget,
  InvalidSliceLength, NoCastingToPointer, NullPointer, ReadOnlyTarget, throwReadOnly,
  warnImplicitArrayCreation
} from '../errors.js';
import {
  ADDRESS, CAST, CONST_PROXY, CONST_TARGET, ENVIRONMENT, FINALIZE, FIXED, INITIALIZE, LAST_ADDRESS,
  LAST_LENGTH, LENGTH, MAX_LENGTH, MEMORY, PARENT, POINTER, PROXY, RESTORE, SETTERS, SIZE, SLOTS,
  TARGET, TYPE, TYPED_ARRAY, UPDATE, VISIT
} from '../symbols.js';
import { defineProperties, defineValue, findElements, getProxy } from '../utils.js';

export default mixin({
  definePointer(structure, descriptors) {
    const {
      name,
      flags,
      byteSize,
      instance: { members: [ member ] },
    } = structure;
    const { structure: targetStructure } = member;
    const {
      type: targetType,
      flags: targetFlags,
      sentinel,
      byteSize: targetSuze = 1
    } = targetStructure;
    // length for slice can be zero or undefined
    const addressSize = (flags & StructureFlag.HasLength) ? byteSize / 2 : byteSize;
    const { get: readAddress, set: writeAddress } = this.defineMember({
      type: MemberType.Uint,
      bitOffset: 0,
      bitSize: addressSize * 8,
      byteSize: addressSize,
      structure: { byteSize: addressSize },
    });
    const { get: readLength, set: writeLength } = (flags & StructureFlag.HasLength) ? this.defineMember({
      type: MemberType.Uint,
      flags: MemberFlag.IsSize,
      bitOffset: addressSize * 8,
      bitSize: addressSize * 8,
      byteSize: addressSize,
      structure: { byteSize: addressSize },
    }) : {};
    const zero = (addressSize > 4) ? 0n : 0;
    const updateTarget = function(all = true, active = true) {
      if (all || this[MEMORY][FIXED]) {
        if (active) {
          const address = readAddress.call(this);
          const length = (flags & StructureFlag.HasLength)
          ? readLength.call(this)
          : (sentinel?.isRequired)
            ? thisEnv.findSentinel(address, sentinel.bytes) + 1
            : 1;
          if (address !== this[LAST_ADDRESS] || length !== this[LAST_LENGTH]) {
            const Target = targetStructure.constructor;
            const dv = thisEnv.findMemory(address, length, Target[SIZE]);
            const newTarget = (dv) ? Target.call(ENVIRONMENT, dv) : null;
            this[SLOTS][0] = newTarget;
            this[LAST_ADDRESS] = address;
            this[LAST_LENGTH] = length;
            if (flags & StructureFlag.HasLength) {
              this[MAX_LENGTH] = undefined;
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
      writeAddress.call(this, address);
      this[LAST_ADDRESS] = address;
    };
    const setLength = (flags & StructureFlag.HasLength || sentinel)
    ? function(length) {
        writeLength?.call?.(this, length);
        this[LAST_LENGTH] = length;
      }
    : null;
    const getTargetObject = function() {
      const pointer = this[POINTER] ?? this;
      const target = updateTarget.call(pointer, false);
      if (!target) {
        if (flags & StructureFlag.IsNullable) {
          return null;
        }
        throw new NullPointer();
      }
      return (flags & StructureFlag.IsConst) ? getConstProxy(target) : target;
    };
    const setTargetObject = function(arg) {
      if (arg === undefined) {
        return;
      }
      const pointer = this[POINTER] ?? this;
      // the target sits in fixed memory--apply the change immediately
      if (arg) {
        if (arg[MEMORY][FIXED]) {
          const address = thisEnv.getViewAddress(arg[MEMORY]);
          setAddress.call(this, address);
          setLength?.call?.(this, arg.length);
        } else {
          if (pointer[MEMORY][FIXED]) {
            throw new FixedMemoryTargetRequired(structure, arg);
          }
        }
      } else if (pointer[MEMORY][FIXED]) {
        setAddress.call(this, zero);
        setLength?.call?.(this, zero);
      }
      pointer[SLOTS][0] = arg ?? null;
      if (flags & StructureFlag.HasLength) {
        pointer[MAX_LENGTH] = undefined;
      }
    };
    const getTarget = (targetFlags & StructureFlag.HasValue)
    ? function() {
        const target = getTargetObject.call(this);
        return target.$;
      }
    : getTargetObject;
    const setTarget = (flags & StructureFlag.IsConst)
    ? throwReadOnly
    : function(value) {
        const target = getTargetObject.call(this);
        return target.$ = value;
      };
    const getTargetLength = function() {
      const target = getTargetObject.call(this);
      return (target) ? target.length : 0;
    }
    const setTargetLength = function(len) {
      len = len | 0;
      const target = getTargetObject.call(this);
      if (!target) {
        if (len !== 0) {
          throw new InvalidSliceLength(len, 0);
        }
        return;
      }
      const dv = target[MEMORY];
      const fixed = dv[FIXED];
      const bytesAvailable = dv.buffer.byteLength - dv.byteOffset;
      // determine the maximum length
      let max;
      if (!fixed) {
        if (flags & StructureFlag.HasLength) {
          max = this[MAX_LENGTH] ??= target.length;
        } else {
          max = (bytesAvailable / targetSuze) | 0;
        }
      }
      if (len < 0 || len > max) {
        throw new InvalidSliceLength(len, max);
      }
      const byteLength = len * targetSuze;
      const newDV = (byteLength <= bytesAvailable)
      // can use the same buffer
      ? thisEnv.obtainView(dv.buffer, dv.byteOffset, byteLength)
      // need to ask V8 for a larger external buffer
      : thisEnv.obtainFixedView(fixed.address, byteLength);
      const Target = targetStructure.constructor;
      this[SLOTS][0] = Target.call(ENVIRONMENT, newDV);
      setLength?.call?.(this, len);
    };
    const thisEnv = this;
    const initializer = function(arg) {
      const Target = targetStructure.constructor;
      if (isPointerOf(arg, Target)) {
        // initialize with the other pointer'structure target
        if (!(flags & StructureFlag.IsConst) && arg.constructor.const) {
          throw new ConstantConstraint(structure, arg);
        }
        arg = arg[SLOTS][0];
      } else if (flags & StructureFlag.IsMultiple) {
        if (isCompatiblePointer(arg, Target, flags)) {
          arg = Target(arg[SLOTS][0][MEMORY]);
        }
      } else if (name === '*anyopaque' && arg) {
        if (arg.constructor[TYPE] === StructureType.Pointer) {
          arg = arg['*']?.[MEMORY];
        } else if (arg[MEMORY]) {
          arg = arg[MEMORY];
        } else if (arg?.buffer instanceof ArrayBuffer) {
          if (!(arg instanceof Uint8Array || arg instanceof DataView)) {
            const { byteOffset, byteLength } = arg;
            if (byteOffset !== undefined && byteLength !== undefined) {
              arg = new DataView(arg.buffer, byteOffset, byteLength);
            }
          }
        }
      }
      if (arg instanceof Target) {
        if (process.env.TARGET === 'wasm') {
          arg[RESTORE]?.();
        }
        const constTarget = arg[CONST_TARGET];
        if (constTarget) {
          if (flags & StructureFlag.IsConst) {
            arg = constTarget;
          } else {
            throw new ReadOnlyTarget(structure);
          }
        }0
      } else if (flags & StructureFlag.IsSingle && flags & StructureFlag.IsMultiple && arg instanceof Target.child) {
        // C pointer
        arg = Target(arg[MEMORY]);
      } else if (isCompatibleBuffer(arg, Target)) {
        // autocast to target type
        const dv = thisEnv.extractView(targetStructure, arg);
        arg = Target(dv);
      } else if (arg != undefined && !arg[MEMORY]) {
        if (flags & StructureFlag.IsSingle && flags & StructureFlag.IsMultiple) {
          // C pointer
          if (typeof(arg) === 'object' && !arg[Symbol.iterator]) {
            let single = true;
            // make sure the object doesn't contain special props for the slice
            const propSetters = Target.prototype[SETTERS];
            for (const key of Object.keys(arg)) {
              const set = propSetters[key];
              if (set?.special) {
                single = false;
                break;
              }
            }
            if (single) {
              arg = [ arg ];
            }
          }
        }
        // autovivificate target object
        const autoObj = new Target(arg, { fixed: !!this[MEMORY][FIXED] });
        if (thisEnv.runtimeSafety) {
          // creation of a new slice using a typed array is probably
          // not what the user wants; it's more likely that the intention
          // is to point to the typed array but there's a mismatch (e.g. u32 vs i32)
          if (TYPED_ARRAY in Target) {
            const tag = arg?.buffer?.[Symbol.toStringTag];
            if (tag === 'ArrayBuffer' || tag === 'SharedArrayBuffer') {
              warnImplicitArrayCreation(targetStructure, arg);
            }
          }
        }
        arg = autoObj;
      } else if (arg !== undefined) {
        if (!(flags & StructureFlag.IsNullable) || arg !== null) {
          throw new InvalidPointerTarget(structure, arg);
        }
      }
      this[TARGET] = arg;
    };
    const destructor = descriptors.delete.value;
    const constructor = this.createConstructor(structure);
    descriptors['*'] = { get: getTarget, set: setTarget };
    descriptors.$ = { get: getProxy, set: initializer };
    descriptors.length = { get: getTargetLength, set: setTargetLength };
    descriptors.slice = (targetType === StructureType.Slice) && {
      value(begin, end) {
        const newTarget = this[TARGET].slice(begin, end);
        return new constructor(newTarget);
      }
    };
    descriptors.subarray = (targetType === StructureType.Slice) && {
      value(begin, end, options) {
        const newTarget = this[TARGET].subarray(begin, end, options);
        return new constructor(newTarget);
      }
    };
    descriptors.delete = {
      value() {
        this[TARGET]?.delete();
        destructor.call(this);
      }
    },
    descriptors[Symbol.toPrimitive] = (targetType === StructureType.Primitive) && {
      value(hint) {
        return this[TARGET][Symbol.toPrimitive](hint);
      }
    };
    descriptors[INITIALIZE] = defineValue(initializer);
    descriptors[FINALIZE] = {
      value() {
        const handlers = (targetType === StructureType.Pointer) ? {} : proxyHandlers;
        const proxy = new Proxy(this, handlers);
        // hide the proxy so console wouldn't display a recursive structure
        Object.defineProperty(this, PROXY, { value: proxy });
        return proxy;
      }
    };
    descriptors[TARGET] = { get: getTargetObject, set: setTargetObject };
    descriptors[UPDATE] = defineValue(updateTarget);
    descriptors[ADDRESS] = { set: setAddress };
    descriptors[LENGTH] = { set: setLength };
    descriptors[VISIT] = defineValue(visitPointer);
    descriptors[LAST_ADDRESS] = defineValue(0);
    descriptors[LAST_LENGTH] = defineValue(0);
    return constructor;
  },
  finalizePointer(structure, staticDescriptors) {
    const {
      flags,
      constructor,
      instance: { members: [ member ] },
    } = structure;
    const { type: targetType, constructor: Target } = member.structure;
    staticDescriptors.child = defineValue(Target);
    staticDescriptors.const = defineValue(!!(flags & StructureFlag.IsConst));
    staticDescriptors[CAST] = {
      value(arg, options) {
        if (this === ENVIRONMENT || this === PARENT || arg instanceof constructor) {
          // casting from buffer to pointer is allowed only if request comes from the runtime
          // casting from writable to read-only is also allowed
          return false;
        } else if (isPointerOf(arg, Target)) {
          // const/non-const casting
          return new constructor(Target(arg['*']), options);
        } else if (isCompatiblePointer(arg, Target, flags)) {
          // casting between C/multi/slice pointers
          return new constructor(arg);
        } else if (targetType === StructureType.Slice) {
          // allow casting to slice through constructor of its pointer
          return new constructor(Target(arg), options);
        } else {
          throw new NoCastingToPointer(structure);
        }
      }
    };
  }
});

export function isNeededByStructure(structure) {
  return structure.type === StructureType.Pointer;
}

function throwInaccessible() {
  throw new InaccessiblePointer();
};

const builtinVisitors = {
  copy({ source }) {
    const target = source[SLOTS][0];
    if (target) {
      this[TARGET] = target;
    }
  },
  reset({ isActive }) {
    if (this[SLOTS][0] && !isActive(this)) {
      this[SLOTS][0] = undefined;
    }
  },
  disable() {
    const disabledProp = { get: throwInaccessible, set: throwInaccessible };
    defineProperties(this[POINTER], {
      '*': disabledProp,
      '$': disabledProp,
      [POINTER]: disabledProp,
      [TARGET]: disabledProp,
    });
  },
};

function visitPointer(visitor, options = {}) {
  const {
    source,
    isActive = always,
    isMutable = always,
  } = options;
  let fn;
  if (typeof(visitor) === 'string') {
    fn = builtinVisitors[visitor];
    if (process.env.DEV) {
      if (!fn) {
        throw new Error(`Unrecognized visitor: ${visitor}`);
      }
    }
  } else {
    fn = visitor;
    if (process.env.DEV) {
      if (typeof(fn) !== 'function') {
        throw new Error(`Invalid visitor: ${visitor}`);
      }
    }
  }
  fn.call(this, { source, isActive, isMutable });
}

function isPointerOf(arg, Target) {
  return (arg?.constructor?.child === Target && arg['*']);
}

function isCompatiblePointer(arg, Target, flags) {
  if (flags & StructureFlag.IsMultiple) {
    if (arg?.constructor?.child?.child === Target.child && arg['*']) {
      return true;
    } else if (flags & StructureFlag.IsSingle && isPointerOf(arg, Target.child)) {
      // C pointer
      return true;
    }
  }
  return false;
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
      const target = pointer[TARGET];
      return target[name];
    }
  },
  set(pointer, name, value) {
    if (name in pointer) {
      pointer[name] = value;
    } else {
      const target = pointer[TARGET];
      target[name] = value;
    }
    return true;
  },
  deleteProperty(pointer, name) {
    if (name in pointer) {
      delete pointer[name];
    } else {
      const target = pointer[TARGET];
      delete target[name];
    }
    return true;
  },
  has(pointer, name) {
    if (name in pointer) {
      return true;
    } else {
      const target = pointer[TARGET];
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

function isCompatibleBuffer(arg, constructor) {
  // TODO: merge this with extractView in mixin "view-management"
  const tag = arg?.[Symbol.toStringTag];
  if (tag) {
    const typedArray = constructor[TYPED_ARRAY];
    if (typedArray) {
      switch (tag) {
        case typedArray.name:
        case 'DataView':
          return true;
        case 'ArrayBuffer':
        case 'SharedArrayBuffer':
          return typedArray === Uint8Array || typedArray === Int8Array;
        case 'Uint8ClampedArray':
          return typedArray === Uint8Array;
      }
    }
    if (constructor.child) {
      if (findElements(arg, constructor.child) !== undefined) {
        return true;
      }
    }
  }
  return false;
}
