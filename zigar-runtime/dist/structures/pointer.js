import { PointerFlag, StructureType, MemberType, PrimitiveFlag, SliceFlag, StructureFlag } from '../constants.js';
import { mixin } from '../environment.js';
import { NoCastingToPointer, throwReadOnly, NullPointer, ConstantConstraint, ReadOnlyTarget, InvalidPointerTarget, PreviouslyFreed, InvalidSliceLength, ZigMemoryTargetRequired } from '../errors.js';
import { CAST, ENVIRONMENT, PARENT, LAST_LENGTH, TARGET, INITIALIZE, FINALIZE, MEMORY, SLOTS, PROXY, UPDATE, ADDRESS, LENGTH, VISIT, LAST_ADDRESS, MAX_LENGTH, POINTER, TYPE, RESTORE, CONST_TARGET, SETTERS, TYPED_ARRAY, ZIG, SENTINEL, SIZE } from '../symbols.js';
import { defineValue, getProxy, isCompatibleType, isCompatibleInstanceOf, usizeInvalid, findElements } from '../utils.js';

var pointer = mixin({
  definePointer(structure, descriptors) {
    const {
      flags,
      byteSize,
      instance: { members: [ member ] },
    } = structure;
    const { structure: targetStructure } = member;
    const {
      type: targetType,
      flags: targetFlags,
      byteSize: targetSize = 1
    } = targetStructure;
    // length for slice can be zero or undefined
    const addressSize = (flags & PointerFlag.HasLength) ? byteSize / 2 : byteSize;
    const { get: readAddress, set: writeAddress } = this.defineMember({
      type: MemberType.Uint,
      bitOffset: 0,
      bitSize: addressSize * 8,
      byteSize: addressSize,
      structure: { byteSize: addressSize },
    });
    const { get: readLength, set: writeLength } = (flags & PointerFlag.HasLength) ? this.defineMember({
      type: MemberType.Uint,
      bitOffset: addressSize * 8,
      bitSize: addressSize * 8,
      byteSize: addressSize,
      structure: {
        flags: PrimitiveFlag.IsSize,
        byteSize: addressSize
      },
    }) : {};
    const updateTarget = function(context, all = true, active = true) {
      if (all || this[MEMORY][ZIG]) {
        if (active) {
          const Target = constructor.child;
          const address = readAddress.call(this);
          const length = (flags & PointerFlag.HasLength)
          ? readLength.call(this)
          : (targetType === StructureType.Slice && targetFlags & SliceFlag.HasSentinel)
            ? thisEnv.findSentinel(address, Target[SENTINEL].bytes) + 1
            : 1;
          if (address !== this[LAST_ADDRESS] || length !== this[LAST_LENGTH]) {
            const dv = thisEnv.findMemory(context, address, length, Target[SIZE]);
            const newTarget = (dv) ? Target.call(ENVIRONMENT, dv) : null;
            this[SLOTS][0] = newTarget;
            this[LAST_ADDRESS] = address;
            this[LAST_LENGTH] = length;
            if (flags & PointerFlag.HasLength) {
              this[MAX_LENGTH] = null;
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
    const sentinelCount = (targetFlags & SliceFlag.HasSentinel) ? 1 : 0;
    const setLength = (flags & PointerFlag.HasLength || targetFlags & SliceFlag.HasSentinel)
    ? function(length) {
        writeLength?.call?.(this, length - sentinelCount);
        this[LAST_LENGTH] = length;
      }
    : null;
    const getTargetObject = function() {
      const pointer = this[POINTER] ?? this;
      const empty = !pointer[SLOTS][0];
      const target = updateTarget.call(pointer, null, empty);
      if (!target) {
        if (flags & PointerFlag.IsNullable) {
          return null;
        }
        throw new NullPointer();
      }
      return (flags & PointerFlag.IsConst) ? getConstProxy(target) : target;
    };
    const setTargetObject = function(arg) {
      if (arg === undefined) {
        return;
      }
      const pointer = this[POINTER] ?? this;
      if (arg) {
        const zig = arg[MEMORY][ZIG];
        if (zig) {
          // the target sits in Zig memory--apply the change immediately
          const { address, js } = zig;
          setAddress.call(this, address);
          setLength?.call?.(this, arg.length);
          if (js) {
            // remove the fake Zig memory attributes now that we've bypassed the check
            arg[MEMORY][ZIG] = undefined;
          }
        } else {
          if (pointer[MEMORY][ZIG]) {
            throw new ZigMemoryTargetRequired();
          }
        }
      } else if (pointer[MEMORY][ZIG]) {
        setAddress.call(this, 0);
        setLength?.call?.(this, 0);
      }
      pointer[SLOTS][0] = arg ?? null;
      if (flags & PointerFlag.HasLength) {
        pointer[MAX_LENGTH] = null;
      }
    };
    const getTarget = (targetFlags & StructureFlag.HasValue)
    ? function() {
        const target = getTargetObject.call(this);
        return target.$;
      }
    : getTargetObject;
    const setTarget = (flags & PointerFlag.IsConst)
    ? throwReadOnly
    : function(value) {
        const target = getTargetObject.call(this);
        return target.$ = value;
      };
    const getTargetLength = function() {
      const target = getTargetObject.call(this);
      return (target) ? target.length : 0;
    };
    const setTargetLength = function(len) {
      len = len | 0;
      const target = getTargetObject.call(this);
      if (target) {
        if (target.length === len) {
          return;
        }
      } else {
        if (len !== 0) {
          throw new InvalidSliceLength(len, 0);
        }
        return;
      }
      {
        target[RESTORE]?.();
      }
      const dv = target[MEMORY];
      const zig = dv[ZIG];
      // determine the maximum length
      let max;
      if (!zig) {
        if (flags & PointerFlag.HasLength) {
          this[MAX_LENGTH] ||= target.length;
          max = this[MAX_LENGTH];
        } else {
          const bytesAvailable = dv.buffer.byteLength - dv.byteOffset;
          max = (bytesAvailable / targetSize) | 0;
        }
      }
      if (len < 0 || len > max) {
        throw new InvalidSliceLength(len, max);
      }
      const byteLength = len * targetSize;
      const newDV = (zig)
      ? thisEnv.obtainZigView(zig.address, byteLength)
      : thisEnv.obtainView(dv.buffer, dv.byteOffset, byteLength);
      const Target = targetStructure.constructor;
      this[SLOTS][0] = Target.call(ENVIRONMENT, newDV);
      setLength?.call?.(this, len);
    };
    const thisEnv = this;
    const initializer = function(arg, allocator) {
      const Target = targetStructure.constructor;
      if (isPointerOf(arg, Target)) {
        // initialize with the other pointer'structure target
        if (!(flags & PointerFlag.IsConst) && arg.constructor.const) {
          throw new ConstantConstraint(structure, arg);
        }
        arg = arg[SLOTS][0];
      } else if (flags & PointerFlag.IsMultiple) {
        if (isCompatiblePointer(arg, Target, flags)) {
          arg = Target(arg[SLOTS][0][MEMORY]);
        }
      } else if (targetType === StructureType.Slice && (targetFlags & SliceFlag.IsOpaque) && arg) {
        if (arg.constructor[TYPE] === StructureType.Pointer) {
          arg = arg[TARGET]?.[MEMORY];
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
        {
          arg[RESTORE]?.();
        }
        const constTarget = arg[CONST_TARGET];
        if (constTarget) {
          if (flags & PointerFlag.IsConst) {
            arg = constTarget;
          } else {
            throw new ReadOnlyTarget(structure);
          }
        }
      } else if (isCompatibleInstanceOf(arg, Target)) {
        // compatible object from a different module
        arg = Target.call(ENVIRONMENT, arg[MEMORY]);
      } else if (flags & PointerFlag.IsSingle && flags & PointerFlag.IsMultiple && arg instanceof Target.child) {
        // C pointer
        arg = Target(arg[MEMORY]);
      } else if (isCompatibleBuffer(arg, Target)) {
        // autocast to target type
        const dv = thisEnv.extractView(targetStructure, arg);
        arg = Target(dv);
      } else if (arg != undefined && !arg[MEMORY]) {
        if (flags & PointerFlag.IsSingle && flags & PointerFlag.IsMultiple) {
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
        if (TYPED_ARRAY in Target && arg?.buffer && arg[Symbol.iterator]) {
          throw new InvalidPointerTarget(structure, arg);
        }
        // autovivificate target object
        const autoObj = new Target(arg, { allocator });
        arg = autoObj;
      } else if (arg !== undefined) {
        if (!(flags & PointerFlag.IsNullable) || arg !== null) {
          throw new InvalidPointerTarget(structure, arg);
        }
      }
      const zig = arg?.[MEMORY]?.[ZIG];
      if (zig?.address === usizeInvalid) {
        throw new PreviouslyFreed(arg);
      }
      this[TARGET] = arg;
    };
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
    descriptors[Symbol.toPrimitive] = (targetType === StructureType.Primitive) && {
      value(hint) {
        return this[TARGET][Symbol.toPrimitive](hint);
      }
    };
    descriptors[INITIALIZE] = defineValue(initializer);
    descriptors[FINALIZE] = {
      value() {
        const handlers = (targetType !== StructureType.Pointer) ? proxyHandlers : {};
        let self;
        if (targetType === StructureType.Function) {
          // use an empty function as object so the proxy's apply() method is triggered
          self = function() {};
          self[MEMORY] = this[MEMORY];
          self[SLOTS] = this[SLOTS];
          Object.setPrototypeOf(self, constructor.prototype);
        } else {
          self = this;
        }
        const proxy = new Proxy(self, handlers);
        // hide the proxy so console wouldn't display a recursive structure
        Object.defineProperty(self, PROXY, { value: proxy });
        return proxy;
      }
    };
    descriptors[TARGET] = { get: getTargetObject, set: setTargetObject };
    descriptors[UPDATE] = defineValue(updateTarget);
    descriptors[ADDRESS] = { set: setAddress };
    descriptors[LENGTH] = { set: setLength };
    descriptors[VISIT] = this.defineVisitor();
    descriptors[LAST_ADDRESS] = defineValue(0);
    descriptors[LAST_LENGTH] = defineValue(0);
    descriptors[MAX_LENGTH] = (flags & PointerFlag.HasLength) && defineValue(null);
    // disable these so the target's properties are returned instead through auto-dereferencing
    descriptors.dataView = descriptors.base64 = undefined;
    return constructor;
  },
  finalizePointer(structure, staticDescriptors) {
    const {
      flags,
      constructor,
      instance: { members: [ member ] },
    } = structure;
    const { structure: targetStructure } = member;
    const { type: targetType, constructor: Target } = targetStructure;
    staticDescriptors.child = (Target) ? defineValue(Target) : {
      // deal with self-referencing pointer
      get() { return targetStructure.constructor }
    };
    staticDescriptors.const = defineValue(!!(flags & PointerFlag.IsConst));
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

function isPointerOf(arg, Target) {
  return isCompatibleType(arg?.constructor?.child, Target) && arg['*'];
}

function isCompatiblePointer(arg, Target, flags) {
  if (flags & PointerFlag.IsMultiple) {
    if (arg?.constructor?.child?.child === Target.child && arg['*']) {
      return true;
    } else if (flags & PointerFlag.IsSingle && isPointerOf(arg, Target.child)) {
      // C pointer
      return true;
    }
  }
  return false;
}

const constProxies = new WeakMap();

function getConstProxy(target) {
  let proxy = constProxies.get(target);
  if (!proxy) {
    const pointer = target[POINTER];
    if (pointer) {
      proxy = new Proxy(pointer, readOnlyProxyHandlers);
    } else {
      proxy = new Proxy(target, constTargetProxyHandlers);
    }
    constProxies.set(target, proxy);
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
  apply(pointer, thisArg, args) {
    const f = pointer['*'];
    return f.apply(thisArg, args);
  },
};

const readOnlyProxyHandlers = {
  ...proxyHandlers,
  set(pointer, name, value) {
    if (name in pointer) {
      throwReadOnly();
    } else {
      const target = pointer[TARGET];
      target[name] = value;
    }
    return true;
  },
};

const constTargetProxyHandlers = {
  get(target, name) {
    if (name === CONST_TARGET) {
      return target;
    } else {
      const value = target[name];
      if (value?.[MEMORY]) {
        return getConstProxy(value);
      } else {
        return value;
      }
    }
  },
  set(target, name, value) {
    throwReadOnly();
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

export { pointer as default };
