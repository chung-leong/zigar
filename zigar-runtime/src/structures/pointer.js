import { MemberType, StructureFlag, StructureType } from '../constants.js';
import { mixin } from '../environment.js';
import {
  ConstantConstraint, FixedMemoryTargetRequired, InaccessiblePointer, InvalidPointerTarget,
  InvalidSliceLength, NoCastingToPointer, NullPointer, ReadOnlyTarget, throwReadOnly,
  warnImplicitArrayCreation
} from '../errors.js';
import { defineMember } from '../member.js';
import { createConstructor, defineProperties } from '../object.js';
import {
  ADDRESS,
  CONST_PROXY, CONST_TARGET,
  ENVIRONMENT, FIXED,
  LENGTH,
  MAX_LENGTH, MEMORY,
  PARENT,
  PROXY,
  RESTORE,
  SELF,
  SETTERS,
  SIZE, SLOTS, TARGET, TARGET_UPDATER, TYPE,
  TYPED_ARRAY,
  VISIT
} from '../symbols.js';

export default mixin({
  definePointer(structure, env) {
    const {
      name,
      type,
      flags,
      byteSize,
      instance: { members: [ member ] },
    } = structure;
    const {
      runtimeSafety = true,
    } = env;
    const { structure: targetStructure } = member;
    const { type: targetType, sentinel, byteSize: elementSize = 1 } = targetStructure;
    // length for slice can be zero or undefined
    const hasLengthInMemory = type === StructureType.SlicePointer;
    const addressSize = (hasLengthInMemory) ? byteSize / 2 : byteSize;
    const { get: getAddressInMemory, set: setAddressInMemory } = defineMember({
      type: MemberType.Uint,
      bitOffset: 0,
      bitSize: addressSize * 8,
      byteSize: addressSize,
      structure: { byteSize: addressSize },
    }, env);
    const { get: getLengthInMemory, set: setLengthInMemory } = (hasLengthInMemory) ? defineMember({
      type: MemberType.Uint,
      bitOffset: addressSize * 8,
      bitSize: addressSize * 8,
      byteSize: addressSize,
      structure: { name: 'usize', byteSize: addressSize },
    }, env) : {};
    const updateTarget = function(all = true, active = true) {
      if (all || this[MEMORY][FIXED]) {
        if (active) {
          const address = getAddressInMemory.call(this);
          const length = (hasLengthInMemory)
          ? getLengthInMemory.call(this)
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
            if (hasLengthInMemory) {
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
      setAddressInMemory.call(this, address);
      this[LAST_ADDRESS] = address;
    };
    const setLength = (hasLengthInMemory || sentinel)
    ? function(length) {
        setLengthInMemory?.call?.(this, length);
        this[LAST_LENGTH] = length;
      }
    : null;
    const getTargetObject = function() {
      const pointer = this[SELF] ?? this;
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
      const pointer = this[SELF] ?? this;
      // the target sits in fixed memory--apply the change immediately
      if (arg) {
        if (arg[MEMORY][FIXED]) {
          const address = thisEnv.getViewAddress(arg[MEMORY]);
          setAddress.call(this, address);
          if (hasLengthInMemory) {
            setLength.call(this, arg.length);
          }
        } else {
          if (pointer[MEMORY][FIXED]) {
            throw new FixedMemoryTargetRequired(structure, arg);
          }
        }
      } else if (pointer[MEMORY][FIXED]) {
        setAddress.call(this, 0);
        if (hasLengthInMemory) {
          setLength.call(this, 0);
        }
      }
      pointer[SLOTS][0] = arg ?? null;
      if (hasLengthInMemory) {
        pointer[MAX_LENGTH] = undefined;
      }
    };
    const getTarget = (flags & StructureFlag.HasValue)
    ? function() {
        const target = getTargetObject.call(this);
        return target[SELF];
      }
    : getTargetObject;
    const setTarget = !isConst
    ? function(value) {
        const target = getTargetObject.call(this);
        return target[SELF] = value;
      }
    : throwReadOnly;
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
        if (hasLengthInMemory) {
          max = this[MAX_LENGTH] ??= target.length;
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
      ? thisEnv.obtainView(dv.buffer, dv.byteOffset, byteLength)
      // need to ask V8 for a larger external buffer
      : thisEnv.obtainFixedView(fixed.address, byteLength);
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
      } else if (isCompatiblePointer(arg, Target, type)) {
        // casting between C/multi/slice pointers
        return new constructor(arg);
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
    const thisEnv = this;
    const initializer = function(arg) {
      const Target = targetStructure.constructor;
      if (isPointerOf(arg, Target)) {
        // initialize with the other pointer'structure target
        if (!isConst && arg.constructor.const) {
          throw new ConstantConstraint(structure, arg);
        }
        arg = arg[SLOTS][0];
      } else if (flags & StructureFlag.IsMultiple) {
        if (isCompatiblePointer(arg, Target, type)) {
          arg = Target(arg[SLOTS][0][MEMORY]);
        }
      } else if (name === '*anyopaque' && arg) {
        if (isPointer(arg.constructor[TYPE])) {
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
          if (isConst) {
            arg = constTarget;
          } else {
            throw new ReadOnlyTarget(structure);
          }
        }
      } else if (type === StructureType.CPointer && arg instanceof Target.child) {
        arg = Target(arg[MEMORY]);
      } else if (isCompatibleBuffer(arg, Target)) {
        // autocast to target type
        const dv = thisEnv.extractView(targetStructure, arg);
        arg = Target(dv);
      } else if (arg != undefined && !arg[MEMORY]) {
        if (type === StructureType.CPointer) {
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
        if (runtimeSafety) {
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
        if (type !== StructureType.CPointer || arg !== null) {
          throw new InvalidPointerTarget(structure, arg);
        }
      }
      this[TARGET] = arg;
    };
    const getTargetPrimitive = (targetType === StructureType.Primitive)
    ? function(hint) {
        const target = this[TARGET];
        return target[Symbol.toPrimitive](hint);
      }
    : null;
    const getSliceOf = (targetType === StructureType.Slice)
    ? function(begin, end) {
        const target = this[TARGET];
        const newTarget = target.slice(begin, end);
        return new constructor(newTarget);
      }
    : null;
    const getSubarrayOf = (targetType === StructureType.Slice)
    ? function(begin, end, options) {
        const target = this[TARGET];
        const newTarget = target.subarray(begin, end, options);
        return new constructor(newTarget);
      }
    : null;
    const constructor = structure.constructor = createConstructor(structure, { initializer, alternateCaster, finalizer }, env);
    const instanceDescriptors = {
      '*': { get: getTarget, set: setTarget },
      '$': { get: getProxy, set: initializer },
      length: { get: getTargetLength, set: setTargetLength },
      delete: { value: deleteTarget },
      slice: getSliceOf && { value: getSliceOf },
      subarray: getSubarrayOf && { value: getSubarrayOf },
      [Symbol.toPrimitive]: getTargetPrimitive && { value: getTargetPrimitive },
      [TARGET]: { get: getTargetObject, set: setTargetObject },
      [TARGET_UPDATER]: { value: updateTarget },
      [ADDRESS]: { value: setAddress },
      [LENGTH]: setLength && { value: setLength },
      [VISIT]: { value: visitPointer },
      [LAST_ADDRESS]: { value: undefined, writable: true },
      [LAST_LENGTH]: setLength && { value: undefined, writable: true },
    };
    const staticDescriptors = {
      child: { get: () => targetStructure.constructor },
      const: { value: isConst },
    };
    return this.attachDescriptors(structure, instanceDescriptors, staticDescriptors);
  },
});

export function isNeededByStructure(structure) {
  return structure.type === StructureType.Pointer:
}

function deleteTarget() {
  const target = this[TARGET];
  target?.delete();
}

export function getProxy() {
  return this[PROXY];
}

// function needed in object.js so it's defined there
export { copyPointer } from '.../../src/object.js';

export function resetPointer({ isActive }) {
}

function throwInaccessible() {
  throw new InaccessiblePointer();
};

const builtinVisitors = {
  copy({ source }) {
    const target = source[SLOTS][0];
    if (target) {
      this[TARGET_SETTER](target);
    }
  },
  reset({ isActive }) {
    if (this[SLOTS][0] && !isActive(this)) {
      this[SLOTS][0] = undefined;
    }
  },
  disable() {
    const disabledProp = { get: throwInaccessible, set: throwInaccessible };
    defineProperties(this[SELF], {
      '*': disabledProp,
      '$': disabledProp,
      [SELF]: disabledProp,
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

function isCompatiblePointer(arg, Target, type) {
  // FIXME
  if (type !== StructureType.SinglePointer) {
    if (arg?.constructor?.child?.child === Target.child && arg['*']) {
      return true;
    } else if (type === StructureType.CPointer && isPointerOf(arg, Target.child)) {
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
    if (name === SELF) {
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
    const ptr = target[SELF];
    if (ptr && !(name in ptr)) {
      target[name] = value;
    } else {
      throwReadOnly();
    }
    return true;
  }
};

export function isCompatibleBuffer(arg, constructor) {
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

export function always() {
  return true;
}

export function never() {
  return false;
}

