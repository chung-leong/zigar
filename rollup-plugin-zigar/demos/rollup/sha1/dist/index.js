const MEMORY = Symbol('memory');
const SLOTS = Symbol('slots');
const PARENT = Symbol('parent');
const NAME = Symbol('name');
const ITEMS = Symbol('items');
const PROPS = Symbol('props');
const GETTER = Symbol('getter');
const SETTER = Symbol('setter');
const ELEMENT_GETTER = Symbol('elementGetter');
const ELEMENT_SETTER = Symbol('elementSetter');
const LOCATION_GETTER = Symbol('addressGetter');
const LOCATION_SETTER = Symbol('addressSetter');
const TARGET_GETTER = Symbol('targetGetter');
const TARGET_SETTER = Symbol('targetSetter');
const FIXED_LOCATION = Symbol('fixedLocation');
const PROP_SETTERS = Symbol('propSetters');
const ALL_KEYS = Symbol('allKeys');
const LENGTH = Symbol('length');
const PROXY = Symbol('proxy');
const COMPAT = Symbol('compat');
const SIZE = Symbol('size');
const ALIGN = Symbol('align');
const ARRAY = Symbol('array');
const POINTER = Symbol('pointer');
const CONST = Symbol('const');
const CONST_PROTOTYPE = Symbol('constProto');
const COPIER = Symbol('copier');
const NORMALIZER = Symbol('normalizer');
const VIVIFICATOR = Symbol('vivificator');
const POINTER_VISITOR = Symbol('pointerVisitor');
const ENVIRONMENT = Symbol('environment');
const ATTRIBUTES = Symbol('attributes');
const MORE = Symbol('more');

function getDestructor(env) {
  return function() {
    const dv = this[MEMORY];
    this[MEMORY] = null;
    if (this[SLOTS]) {
      this[SLOTS] = {};
    }
    env.releaseFixedView(dv);
  };
}

function getMemoryCopier(size, multiple = false) {
  const copy = getCopyFunction(size, multiple);
  return function(target) {
    /* WASM-ONLY */
    restoreMemory.call(this);
    restoreMemory.call(target);
    /* WASM-ONLY-END */
    const src = target[MEMORY];
    const dest = this[MEMORY];
    copy(dest, src);
  };
}

function getCopyFunction(size, multiple = false) {
  if (!multiple) {
    const copier = copiers[size];
    if (copier) {
      return copier;
    }
  }
  if (!(size & 0x07)) return copy8x;
  if (!(size & 0x03)) return copy4x;
  if (!(size & 0x01)) return copy2x;
  return copy1x;
}

const copiers = {
  1: copy1,
  2: copy2,
  4: copy4,
  8: copy8,
  16: copy16,
  32: copy32,
};

function copy1x(dest, src) {
  for (let i = 0, len = dest.byteLength; i < len; i++) {
    dest.setInt8(i, src.getInt8(i));
  }
}

function copy2x(dest, src) {
  for (let i = 0, len = dest.byteLength; i < len; i += 2) {
    dest.setInt16(i, src.getInt16(i, true), true);
  }
}

function copy4x(dest, src) {
  for (let i = 0, len = dest.byteLength; i < len; i += 4) {
    dest.setInt32(i, src.getInt32(i, true), true);
  }
}

function copy8x(dest, src) {
  for (let i = 0, len = dest.byteLength; i < len; i += 8) {
    dest.setInt32(i, src.getInt32(i, true), true);
    dest.setInt32(i + 4, src.getInt32(i + 4, true), true);
  }
}

function copy1(dest, src) {
  dest.setInt8(0, src.getInt8(0));
}

function copy2(dest, src) {
  dest.setInt16(0, src.getInt16(0, true), true);
}

function copy4(dest, src) {
  dest.setInt32(0, src.getInt32(0, true), true);
}

function copy8(dest, src) {
  dest.setInt32(0, src.getInt32(0, true), true);
  dest.setInt32(4, src.getInt32(4, true), true);
}

function copy16(dest, src) {
  dest.setInt32(0, src.getInt32(0, true), true);
  dest.setInt32(4, src.getInt32(4, true), true);
  dest.setInt32(8, src.getInt32(8, true), true);
  dest.setInt32(12, src.getInt32(12, true), true);
}

function copy32(dest, src) {
  dest.setInt32(0, src.getInt32(0, true), true);
  dest.setInt32(4, src.getInt32(4, true), true);
  dest.setInt32(8, src.getInt32(8, true), true);
  dest.setInt32(12, src.getInt32(12, true), true);
  dest.setInt32(16, src.getInt32(16, true), true);
  dest.setInt32(20, src.getInt32(20, true), true);
  dest.setInt32(24, src.getInt32(24, true), true);
  dest.setInt32(28, src.getInt32(28, true), true);
}

function restoreMemory() {
  const dv = this[MEMORY];
  const source = dv[MEMORY];
  if (!source || dv.buffer.byteLength !== 0) {
    return false;
  }
  const { memory, address, len } = source;
  const newDV = new DataView(memory.buffer, address, len);
  newDV[MEMORY] = source;
  this[MEMORY] = newDV;
  return true;
}

const decoders = {};
const encoders = {};

function decodeText(arrays, encoding = 'utf-8') {
  let decoder = decoders[encoding];
  if (!decoder) {
    decoder = decoders[encoding] = new TextDecoder(encoding);
  }
  let array;
  if (Array.isArray(arrays)) {
    if (arrays.length === 1) {
      array = arrays[0];
    } else {
      let len = 0;
      for (const a of arrays) {
        len += a.length;
      }
      const { constructor } = arrays[0];
      array = new constructor(len);
      let offset = 0;
      for (const a of arrays) {
        array.set(a, offset);
        offset += a.length;
      }
    }
  } else {
    array = arrays;
  }
  return decoder.decode(array);
}

function encodeText(text, encoding = 'utf-8') {
  switch (encoding) {
    case 'utf-16': {
      const { length } = text;
      const ta = new Uint16Array(length);
      for (let i = 0; i < length; i++) {
        ta[i] = text.charCodeAt(i);
      }
      return ta;
    }
    default: {
      let encoder = encoders[encoding];
      if (!encoder) {
        encoder = encoders[encoding] = new TextEncoder();
      }
      return encoder.encode(text);
    }
  }
}

function encodeBase64(dv) {
  const ta = new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength);
  const bstr = String.fromCharCode.apply(null, ta);
  return btoa(bstr);
}

function decodeBase64(str) {
  const bstr = atob(str);
  const ta = new Uint8Array(bstr.length);
  for (let i = 0; i < ta.byteLength; i++) {
    ta[i] = bstr.charCodeAt(i);
  }
  return new DataView(ta.buffer);  
}

function getValueOf() {
  const map = new Map();
  const options = { error: 'throw' };
  const process = function(value) {
    const normalizer = value?.[NORMALIZER];
    if (normalizer) {
      let result = map.get(value);
      if (result === undefined) {
        result = normalizer.call(value, process, options);
        map.set(value, result);
      }
      return result;
    } else {
      return value;
    }
  };
  return process(this);
}

const INT_MAX = BigInt(Number.MAX_SAFE_INTEGER);
const INT_MIN = BigInt(Number.MIN_SAFE_INTEGER);

function convertToJSON() {
  const map = new Map();
  const options = { error: 'return' };
  const process = function(value) {
    const normalizer = value?.[NORMALIZER];
    if (normalizer) {
      if (value instanceof Error) {
        return { error: value.message };
      }      
      let result = map.get(value);
      if (result === undefined) {
        result = normalizer.call(value, process, options);
        map.set(value, result);
      }
      return result;
    } else {
      if (typeof(value) === 'bigint' && INT_MIN <= value && value <= INT_MAX) {
        return Number(value);
      } 
      return value;
    }
  };
  return process(this);
}

function normalizeValue(cb, options) {
  const value = handleError(() => this.$, options);
  return cb(value);
}

function handleError(cb, options = {}) {
  const { error = 'throw' } = options;
  try {
    return cb();
  } catch (err) {
    if (error === 'return') {
      return err;
    } else {
      throw err;
    }
  }
}

function getDataViewDescriptor(structure, handlers = {}) {
  return markAsSpecial({
    get() {
      /* WASM-ONLY */
      restoreMemory.call(this);
      /* WASM-ONLY-END */
      return this[MEMORY];
    },
    set(dv) {
      checkDataView(dv);
      setDataView.call(this, dv, structure, true, handlers);
    },
  });
}

function getBase64Descriptor(structure, handlers = {}) {
  return markAsSpecial({
    get() {
      return encodeBase64(this.dataView);
    },
    set(str) {
      if (typeof(str) !== 'string') {
        throwTypeMismatch('string', str);
      }
      const dv = decodeBase64(str);
      setDataView.call(this, dv, structure, false, handlers);
    }
  });
}

function getStringDescriptor(structure, handlers = {}) {
  const { sentinel, instance: { members }} = structure;
  const { byteSize: charSize } = members[0];
  return markAsSpecial({
    get() {
      const dv = this.dataView;
      const TypedArray = (charSize === 1) ? Int8Array : Int16Array;
      const ta = new TypedArray(dv.buffer, dv.byteOffset, this.length);
      const s = decodeText(ta, `utf-${charSize * 8}`);
      return (sentinel?.value === undefined) ? s : s.slice(0, -1);
    },
    set(str) {
      if (typeof(str) !== 'string') {
        throwTypeMismatch('a string', str);
      }
      if (sentinel?.value !== undefined) {
        if (str.charCodeAt(str.length - 1) !== sentinel.value) {
          str = str + String.fromCharCode(sentinel.value);
        }
      }
      const ta = encodeText(str, `utf-${charSize * 8}`);
      const dv = new DataView(ta.buffer);   
      setDataView.call(this, dv, structure, false, handlers);
    },
  });
}

function getTypedArrayDescriptor(structure, handlers = {}) {
  const { typedArray } = structure;
  return markAsSpecial({
    get() {
      const dv = this.dataView;
      const length = dv.byteLength / typedArray.BYTES_PER_ELEMENT;
      return new typedArray(dv.buffer, dv.byteOffset, length);
    },
    set(ta) {
      if (!isTypedArray(ta, typedArray)) {
        throwTypeMismatch(typedArray.name, ta);
      }
      const dv = new DataView(ta.buffer, ta.byteOffset, ta.byteLength);
      setDataView.call(this, dv, structure, true, handlers);
    },
  });
}

function markAsSpecial({ get, set }) {
  get.special = set.special = true;
  return { get, set };
}

function definePointer(structure, env) {
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
        throwFixedMemoryTargetRequired();
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
    } else if (isTargetSlice) {
      // allow casting to slice through constructor of its pointer
      return new constructor(Target(arg), options);
    } else {
      throwNoCastingToPointer();
    }
  };
  const finalizer = function() {
    const handlers = (isTargetPointer) ? {} : proxyHandlers$1;
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
  let target;
  try {
    target = this['*'];
  } catch (err) {
    target = Symbol.for('inaccessible');
  }
  return cb(target);
}

function getProxy() {
  return this[PROXY];
}

function copyPointer({ source }) {
  const target = source[SLOTS][0];
  if (target) {
    this[TARGET_SETTER](target);
  }
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

const proxyHandlers$1 = {
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

function always() {
  return true;
}

function defineStructShape(structure, env) {
  const {
    byteSize,
    align,
    instance: { members },
    hasPointer,
  } = structure;  
  const memberDescriptors = {};
  for (const member of members) {
    const { get, set } = getDescriptor(member, env);
    memberDescriptors[member.name] = { get, set, configurable: true, enumerable: true };
    if (member.isRequired && set) {
      set.required = true;
    }
  }
  const hasObject = !!members.find(m => m.type === MemberType.Object);
  const propApplier = createPropertyApplier(structure);
  const initializer = function(arg) {
    if (arg instanceof constructor) {
      this[COPIER](arg);
      if (hasPointer) {
        this[POINTER_VISITOR](copyPointer, { vivificate: true, source: arg });
      }
    } else if (arg && typeof(arg) === 'object') {
      propApplier.call(this, arg);
    } else if (arg !== undefined) {
      throwInvalidInitializer(structure, 'object', arg);
    }
  };
  const constructor = structure.constructor = createConstructor(structure, { initializer }, env);
  const instanceDescriptors = {
    $: { get: getSelf, set: initializer },
    dataView: getDataViewDescriptor(structure),
    base64: getBase64Descriptor(structure),
    valueOf: { value: getValueOf },
    toJSON: { value: convertToJSON },
    delete: { value: getDestructor(env) },
    ...memberDescriptors,
    [Symbol.iterator]: { value: getStructIterator },
    [COPIER]: { value: getMemoryCopier(byteSize) },
    [VIVIFICATOR]: hasObject && { value: getChildVivificator$1(structure) },
    [POINTER_VISITOR]: hasPointer && { value: getPointerVisitor$1(structure, always) },
    [NORMALIZER]: { value: normalizeStruct },
    [PROPS]: { value: members.map(m => m.name) },
  };
  const staticDescriptors = {
    [ALIGN]: { value: align },
    [SIZE]: { value: byteSize },
  };
  return attachDescriptors(constructor, instanceDescriptors, staticDescriptors);
}

function normalizeStruct(cb, options) {
  const object = {};
  for (const [ name, value ] of getStructEntries.call(this, options)) {
    object[name] = cb(value);
  }
  return object;
}

function getStructEntries(options) {
  return {
    [Symbol.iterator]: getStructEntriesIterator.bind(this, options),
    length: this[PROPS].length,
  };
}

function getStructIterator(options) { 
  const entries = getStructEntries.call(this, options);
  return entries[Symbol.iterator]();
}

function getStructEntriesIterator(options) {
  const self = this;
  const props = this[PROPS];
  let index = 0;
  return {
    next() {
      let value, done;      
      if (index < props.length) {
        const current = props[index++];
        value = [ current, handleError(() => self[current], options) ];
        done = false;
      } else {
        done = true;
      }
      return { value, done };
    },
  };
}
  
function getChildVivificator$1(structure) {
  const { instance: { members } } = structure;
  const objectMembers = {};
  for (const member of members.filter(m => m.type === MemberType.Object)) {
    objectMembers[member.slot] = member;
  }
  return function vivificateChild(slot, writable = true) {
    const member = objectMembers[slot];
    const { bitOffset, byteSize, structure: { constructor } } = member;
    const dv = this[MEMORY];
    const parentOffset = dv.byteOffset;
    const offset = parentOffset + (bitOffset >> 3);
    let len = byteSize;
    if (len === undefined) {
      if (bitOffset & 7) {
        throwNotOnByteBoundary(member);
      }
      len = member.bitSize >> 3;
    }
    const childDV = new DataView(dv.buffer, offset, len);
    const object = this[SLOTS][slot] = constructor.call(PARENT, childDV, { writable });
    return object;
  }
}

function getPointerVisitor$1(structure, visitorOptions = {}) {
  const {
    isChildActive = always,
    isChildMutable = always,
  } = visitorOptions;
  const { instance: { members } } = structure;
  const pointerMembers = members.filter(m => m.structure.hasPointer);
  return function visitPointers(cb, options = {}) {
    const {
      source,
      vivificate = false,
      isActive = always,
      isMutable = always,
    } = options;
    const childOptions = {
      ...options,
      isActive: (object) => {
        // make sure parent object is active, then check whether the child is active
        return isActive(this) && isChildActive.call(this, object);
      },
      isMutable: (object) => {
        return isMutable(this) && isChildMutable.call(this, object);
      },
    };
    for (const { slot } of pointerMembers) {
      if (source) {
        // when src is a the struct's template, most slots will likely be empty,
        // since pointer fields aren't likely to have default values
        const srcChild = source[SLOTS]?.[slot];
        if (!srcChild) {
          continue;
        }
        childOptions.source = srcChild;
      }
      const child = this[SLOTS][slot] ?? (vivificate ? this[VIVIFICATOR](slot) : null);
      if (child) {
        child[POINTER_VISITOR](cb, childOptions);
      }
    }
  };
}

function defineArgStruct(structure, env) {
  const {
    byteSize,
    align,
    instance: { members },
    hasPointer,
  } = structure;
  const hasObject = !!members.find(m => m.type === MemberType.Object);
  const constructor = structure.constructor = function(args) {
    const dv = env.allocateMemory(byteSize, align);
    this[MEMORY] = dv;
    if (hasObject) {
      this[SLOTS] = {};
    }
    initializer.call(this, args);
  };
  const argNames = members.slice(0, -1).map(m => m.name);
  const argCount = argNames.length;
  const initializer = function(args) {
    if (args.length !== argCount) {
      throwArgumentCountMismatch(structure, args.length);
    }
    for (const [ index, name ] of argNames.entries()) {
      try {
        this[name] = args[index];
      } catch (err) {
        rethrowArgumentError(structure, index, err);
      }
    }
  };
  const memberDescriptors = {};
  for (const member of members) {
    memberDescriptors[member.name] = getDescriptor(member, env);
  }
  const isChildMutable = function(object) {
      return (object === this.retval);
  };
  defineProperties(constructor.prototype, {
    ...memberDescriptors,
    [COPIER]: { value: getMemoryCopier(byteSize) },
    [VIVIFICATOR]: hasObject && { value: getChildVivificator$1(structure) },
    [POINTER_VISITOR]: hasPointer && { value: getPointerVisitor$1(structure, { isChildMutable }) },
  });
  defineProperties(constructor, {
    [ALIGN]: { value: align },
    [SIZE]: { value: byteSize },
  });
  return constructor;
}

function defineArray(structure, env) {
  const {
    length,
    byteSize,
    align,
    instance: { members: [ member ] },
    hasPointer,
  } = structure;
  const { get, set } = getDescriptor(member, env);
  const hasStringProp = canBeString(member);
  const propApplier = createPropertyApplier(structure);
  const initializer = function(arg) {
    if (arg instanceof constructor) {
      this[COPIER](arg);
      if (hasPointer) {
        this[POINTER_VISITOR](copyPointer, { vivificate: true, source: arg });
      }
    } else {
      if (typeof(arg) === 'string' && hasStringProp) {
        arg = { string: arg };
      }
      if (arg?.[Symbol.iterator]) {
        arg = transformIterable(arg);
        if (arg.length !== length) {
          throwArrayLengthMismatch(structure, this, arg);
        }
        let i = 0;
        for (const value of arg) {
          set.call(this, i++, value);
        }
      } else if (arg && typeof(arg) === 'object') {
        if (propApplier.call(this, arg) === 0) {
          throwInvalidArrayInitializer(structure, arg);
        }
      } else if (arg !== undefined) {
        throwInvalidArrayInitializer(structure, arg);
      }
    }
  };
  const finalizer = createArrayProxy;
  const constructor = structure.constructor = createConstructor(structure, { initializer, finalizer }, env);
  const typedArray = structure.typedArray = getTypedArrayClass(member);
  const hasObject = member.type === MemberType.Object;
  const instanceDescriptors = {
    $: { get: getProxy, set: initializer },
    length: { value: length },
    dataView: getDataViewDescriptor(structure),
    base64: getBase64Descriptor(structure),
    string: hasStringProp && getStringDescriptor(structure),
    typedArray: typedArray && getTypedArrayDescriptor(structure),
    get: { value: get },
    set: { value: set },
    entries: { value: getArrayEntries },
    valueOf: { value: getValueOf },
    toJSON: { value: convertToJSON },
    delete: { value: getDestructor(env) },
    [Symbol.iterator]: { value: getArrayIterator },
    [COPIER]: { value: getMemoryCopier(byteSize) },
    [VIVIFICATOR]: hasObject && { value: getChildVivificator(structure) },
    [POINTER_VISITOR]: hasPointer && { value: getPointerVisitor() },
    [NORMALIZER]: { value: normalizeArray },
  };
  const staticDescriptors = {
    child: { get: () => member.structure.constructor },
    [COMPAT]: { value: getCompatibleTags(structure) },
    [ALIGN]: { value: align },
    [SIZE]: { value: byteSize },
  };
  return attachDescriptors(constructor, instanceDescriptors, staticDescriptors);
}

function createArrayProxy() {
  const proxy = new Proxy(this, proxyHandlers);
  // hide the proxy so console wouldn't display a recursive structure
  Object.defineProperty(this, PROXY, { value: proxy }); 
  return proxy;
}

function canBeString(member) {
  return member.type === MemberType.Uint && [ 8, 16 ].includes(member.bitSize);
}

function normalizeArray(cb, options) {
  const array = [];
  for (const [ index, value ] of getArrayEntries.call(this, options)) {
    array.push(cb(value));
  }
  return array;
}

function getArrayIterator() {
  const self = this[ARRAY] ?? this;
  const length = this.length;
  let index = 0;
  return {
    next() {
      let value, done;
      if (index < length) {
        const current = index++;
        value = self.get(current);
        done = false;
      } else {
        done = true;
      }
      return { value, done };
    },
  };
}

function getArrayEntriesIterator(options) {
  const self = this[ARRAY] ?? this;
  const length = this.length;
  let index = 0;
  return {
    next() {
      let value, done;      
      if (index < length) {
        const current = index++;
        value = [ current, handleError(() => self.get(current), options) ];
        done = false;
      } else {
        done = true;
      }
      return { value, done };
    },
  };
}

function getArrayEntries(options) {
  return {
    [Symbol.iterator]: getArrayEntriesIterator.bind(this, options),
    length: this.length,
  };
}

function getChildVivificator(structure) {
  const { instance: { members: [ member ]} } = structure;
  const { byteSize, structure: elementStructure } = member;
  return function getChild(index, writable = true) {
    const { constructor } = elementStructure;
    const dv = this[MEMORY];
    const parentOffset = dv.byteOffset;
    const offset = parentOffset + byteSize * index;
    const childDV = new DataView(dv.buffer, offset, byteSize);
    const object = this[SLOTS][index] = constructor.call(PARENT, childDV, { writable });
    return object;
  };
}

function getPointerVisitor(structure) {
  return function visitPointers(cb, options = {}) {
    const {
      source,
      vivificate = false,
      isActive = always,
      isMutable = always,
    } = options;
    const childOptions = {
      ...options,
      isActive: () => isActive(this),
      isMutable: () => isMutable(this),
    };
    for (let i = 0, len = this.length; i < len; i++) {
      // no need to check for empty slots, since that isn't possible
      if (source) {
        childOptions.source = source?.[SLOTS][i];
      }
      const child = this[SLOTS][i] ?? (vivificate ? this[VIVIFICATOR](i) : null);
      if (child) {
        child[POINTER_VISITOR](cb, childOptions);
      }
    }
  };
}

function transformIterable(arg) {
  if (typeof(arg.length) === 'number') {
    // it's an array of sort
    return arg;
  }
  const iterator = arg[Symbol.iterator]();
  const first = iterator.next();
  const length = first.value?.length;
  if (typeof(length) === 'number' && Object.keys(first.value).join() === 'length') {
    // return generator with length attached
    return Object.assign((function*() {
      let result;
      while (!(result = iterator.next()).done) {
        yield result.value;
      }
    })(), { length });
  } else {
    const array = [];
    let result = first;
    while (!result.done) {
      array.push(result.value);
      result = iterator.next();
    }
    return array;
  }
}

const proxyHandlers = {
  get(array, name) {
    const index = (typeof(name) === 'symbol') ? 0 : name|0;
    if (index !== 0 || index == name) {
      return array.get(index);
    } else {
      switch (name) {
        case 'get':
          if (!array[ELEMENT_GETTER]) {
            array[ELEMENT_GETTER] = array.get.bind(array);
          }
          return array[ELEMENT_GETTER];
        case 'set':
          if (!array[ELEMENT_SETTER]) {
            array[ELEMENT_SETTER] = array.set.bind(array);
          }
          return array[ELEMENT_SETTER];
        case ARRAY:
          return array;
        default:
          return array[name];
      }
    }
  },
  set(array, name, value) {
    const index = (typeof(name) === 'symbol') ? 0 : name|0;
    if (index !== 0 || index == name) {
      array.set(index, value);
    } else {
      switch (name) {
        case 'get':
          array[ELEMENT_GETTER] = value;
          break;
        case 'set':
          array[ELEMENT_SETTER] = value;
          break;
        default:
          array[name] = value;
      }
    }
    return true;
  },
  deleteProperty(array, name) {
    const index = (typeof(name) === 'symbol') ? 0 : name|0;
    if (index !== 0 || index == name) {
      return false;
    } else {
      switch (name) {
        case 'get':
          delete array[ELEMENT_GETTER];
          break;
        case 'set':
          delete array[ELEMENT_SETTER];
          break;
        default:
          delete array[name];
      }
      return true;
    }
  },
  has(array, name) {
    const index = (typeof(name) === 'symbol') ? 0 : name|0;
    if (index !== 0 || index == name) {
      return (index >= 0 && index < array.length);
    } else {
      return array[name];
    }
  },
  ownKeys(array) {
    const keys = [];
    for (let i = 0, len = array.length; i < len; i++) {
      keys.push(`${i}`);
    }
    keys.push('length', PROXY);
    return keys;
  },
  getOwnPropertyDescriptor(array, name) {
    const index = (typeof(name) === 'symbol') ? 0 : name|0;
    if (index !== 0 || index == name) {
      if (index >= 0 && index < array.length) {
        return { value: array.get(index), enumerable: true, writable: true, configurable: true };
      }
    } else {
      return Object.getOwnPropertyDescriptor(array, name);
    }
  },
};

function definePrimitive(structure, env) {
  const {
    byteSize,
    align,
    instance: { members: [ member ] },
  } = structure;
  const { get, set } = getDescriptor(member, env);
  const propApplier = createPropertyApplier(structure);
  const initializer = function(arg) {
    if (arg instanceof constructor) {
      this[COPIER](arg);
    } else {
      if (arg && typeof(arg) === 'object') {
        if (propApplier.call(this, arg) === 0) {
          const type = getPrimitiveType(member);
          throwInvalidInitializer(structure, type, arg);
        }
      } else if (arg !== undefined) {
        set.call(this, arg);
      }
    }
  };
  const constructor = structure.constructor = createConstructor(structure, { initializer }, env);
  const typedArray = structure.typedArray = getTypedArrayClass(member);
  const instanceDescriptors = {
    $: { get, set },
    dataView: getDataViewDescriptor(structure),
    base64: getBase64Descriptor(structure),
    typedArray: typedArray && getTypedArrayDescriptor(structure),
    valueOf: { value: getValueOf },
    toJSON: { value: convertToJSON },
    delete: { value: getDestructor(env) },
    [Symbol.toPrimitive]: { value: get },
    [COPIER]: { value: getMemoryCopier(byteSize) },
    [NORMALIZER]: { value: normalizeValue },
  };
  const staticDescriptors = {
    [COMPAT]: { value: getCompatibleTags(structure) },
    [ALIGN]: { value: align },
    [SIZE]: { value: byteSize },
  };
  return attachDescriptors(constructor, instanceDescriptors, staticDescriptors);
}
function getIntRange(member) {
  const { type, bitSize } = member;
  const signed = (type === MemberType.Int);
  let magBits = (signed) ? bitSize - 1 : bitSize;
  if (bitSize <= 32) {
    const max = 2 ** magBits - 1;
    const min = (signed) ? -(2 ** magBits) : 0;
    return { min, max };
  } else {
    magBits = BigInt(magBits);
    const max = 2n ** magBits - 1n;
    const min = (signed) ? -(2n ** magBits) : 0n;
    return { min, max };
  }
}

function getPrimitiveClass({ type, bitSize }) {
  if (type === MemberType.Int || type === MemberType.Uint) {
    if (bitSize <= 32) {
      return Number;
    } else {
      return BigInt;
    }
  } else if (type === MemberType.Float) {
    return Number;
  } else if (type === MemberType.Bool) {
    return Boolean;
  }
}

function getPrimitiveType(member) {
  const Primitive = getPrimitiveClass(member);
  if (Primitive) {
    return typeof(Primitive(0));
  }
}

function defineSlice(structure, env) {
  const {
    align,
    instance: {
      members: [ member ],
    },
    hasPointer,
  } = structure;
  const { get, set } = getDescriptor(member, env);
  const { byteSize: elementSize, structure: elementStructure } = member;
  const sentinel = getSentinel(structure, env);
  if (sentinel) {
    // zero-terminated strings aren't expected to be commonly used
    // so we're not putting this prop into the standard structure
    structure.sentinel = sentinel;
  }
  const hasStringProp = canBeString(member);
  const shapeDefiner = function(dv, length, fixed = false) {
    if (!dv) {
      dv = env.allocateMemory(length * elementSize, align, fixed);
    }
    this[MEMORY] = dv;
    this[LENGTH] = length;
  };
  const shapeChecker = function(arg, length) {
    if (length !== this[LENGTH]) {
      throwArrayLengthMismatch(structure, this, arg);
    }
  };
  // the initializer behave differently depending on whether it's called by the
  // constructor or by a member setter (i.e. after object's shape has been established)
  const propApplier = createPropertyApplier(structure);
  const initializer = function(arg, fixed = false) {
    if (arg instanceof constructor) {
      if (!this[MEMORY]) {
        shapeDefiner.call(this, null, arg.length, fixed);
      } else {
        shapeChecker.call(this, arg, arg.length);
      }
      this[COPIER](arg);
      if (hasPointer) {
        this[POINTER_VISITOR](copyPointer, { vivificate: true, source: arg });
      }
    } else if (typeof(arg) === 'string' && hasStringProp) {
      initializer.call(this, { string: arg }, fixed);
    } else if (arg?.[Symbol.iterator]) {
      arg = transformIterable(arg);
      if (!this[MEMORY]) {
        shapeDefiner.call(this, null, arg.length, fixed);
      } else {
        shapeChecker.call(this, arg, arg.length);
      }
      let i = 0;
      for (const value of arg) {
        sentinel?.validateValue(value, i, arg.length);
        set.call(this, i++, value);
      }
    } else if (typeof(arg) === 'number') {
      if (!this[MEMORY] && arg >= 0 && isFinite(arg)) {
        shapeDefiner.call(this, null, arg);
      } else {
        throwInvalidArrayInitializer(structure, arg, !this[MEMORY]);
      }
    } else if (arg && typeof(arg) === 'object') {
      if (propApplier.call(this, arg) === 0) {
        throwInvalidArrayInitializer(structure, arg);
      }
    } else if (arg !== undefined) {
      throwInvalidArrayInitializer(structure, arg);
    }
  };
  const finalizer = createArrayProxy;
  const constructor = structure.constructor = createConstructor(structure, { initializer, shapeDefiner, finalizer }, env);
  const typedArray = structure.typedArray = getTypedArrayClass(member);
  const hasObject = member.type === MemberType.Object;
  const shapeHandlers = { shapeDefiner };
  const instanceDescriptors = {
    $: { get: getProxy, set: initializer },
    length: { get: getLength },
    dataView: getDataViewDescriptor(structure, shapeHandlers),
    base64: getBase64Descriptor(structure, shapeHandlers),
    string: hasStringProp && getStringDescriptor(structure, shapeHandlers),
    typedArray: typedArray && getTypedArrayDescriptor(structure, shapeHandlers),
    get: { value: get },
    set: { value: set },
    entries: { value: getArrayEntries },
    valueOf: { value: getValueOf },
    toJSON: { value: convertToJSON },
    delete: { value: getDestructor(env) },
    [Symbol.iterator]: { value: getArrayIterator },
    [COPIER]: { value: getMemoryCopier(elementSize, true) },
    [VIVIFICATOR]: hasObject && { value: getChildVivificator(structure) },
    [POINTER_VISITOR]: hasPointer && { value: getPointerVisitor() },
    [NORMALIZER]: { value: normalizeArray },
  };
  const staticDescriptors = {
    child: { get: () => elementStructure.constructor },
    [COMPAT]: { value: getCompatibleTags(structure) },
    [ALIGN]: { value: align },
    [SIZE]: { value: elementSize },
  };
  return attachDescriptors(constructor, instanceDescriptors, staticDescriptors);
}

function getLength() {
  return this[LENGTH];
}

function getSentinel(structure, env) {
  const {
    runtimeSafety = true,
  } = env;
  const {
    byteSize,
    instance: { members: [ member, sentinel ], template },
  } = structure;
  if (!sentinel) {
    return;
  }
  const { get: getSentinelValue } = getDescriptor(sentinel, env);
  const value = getSentinelValue.call(template, 0);
  const { get } = getDescriptor(member, env);
  const validateValue = (runtimeSafety) ? function(v, i, l) {
    if (v === value && i !== l - 1) {
      throwMisplacedSentinel(structure, v, i, l);
    } else if (v !== value && i === l - 1) {
      throwMissingSentinel(structure, value, i);
    }
  } : function(v, i, l) {
    if (v !== value && i === l - 1) {
      throwMissingSentinel(structure, value, l);
    }
  };
  const validateData = (runtimeSafety) ? function(source, len) {
    for (let i = 0; i < len; i++) {
      const v = get.call(source, i);
      if (v === value && i !== len - 1) {
        throwMisplacedSentinel(structure, value, i, len);
      } else if (v !== value && i === len - 1) {
        throwMissingSentinel(structure, value, len);
      }
    }
  } : function(source, len) {
    if (len * byteSize === source[MEMORY].byteLength) {
      const i = len - 1;
      const v = get.call(source, i);
      if (v !== value) {
        throwMissingSentinel(structure, value, len);
      }
    }
  };
  const bytes = template[MEMORY];
  return { value, bytes, validateValue, validateData };
}

const StructureType = {
  Primitive: 0,
  Array: 1,
  Struct: 2,
  ArgStruct: 3,
  ExternUnion: 4,
  BareUnion: 5,
  TaggedUnion: 6,
  ErrorUnion: 7,
  ErrorSet: 8,
  Enumeration: 9,
  Optional: 10,
  Pointer: 11,
  Slice: 12,
  Vector: 13,
  Opaque: 14,
  Function: 15,
};

const factories$2 = Array(Object.values(StructureType).length);

function usePrimitive() {
  factories$2[StructureType.Primitive] = definePrimitive;
}

function useArray() {
  factories$2[StructureType.Array] = defineArray;
}

function useStruct() {
  factories$2[StructureType.Struct] = defineStructShape;
}

function usePointer() {
  factories$2[StructureType.Pointer] = definePointer;
}

function useSlice() {
  factories$2[StructureType.Slice] = defineSlice;
}

function useArgStruct() {
  factories$2[StructureType.ArgStruct] = defineArgStruct;
}

function getStructureFactory(type) {
  const f = factories$2[type];
  return f;
}

function defineProperties(object, descriptors) {
  for (const [ name, descriptor ] of Object.entries(descriptors)) {
    if (descriptor) {
      const { 
        set,
        get,
        value,
        enumerable,
        configurable = true,
        writable = true,
      } = descriptor;
      Object.defineProperty(object, name, (get) 
        ? { get, set, configurable, enumerable } 
        : { value, configurable, enumerable, writable }
      );
    }
  }
  for (const symbol of Object.getOwnPropertySymbols(descriptors)) {
    const descriptor = descriptors[symbol];
    if (descriptor) {
      Object.defineProperty(object, symbol, descriptor);
    }
  }
}

function attachDescriptors(constructor, instanceDescriptors, staticDescriptors) {
  // create prototype for read-only objects
  const prototypeRO = {};
  Object.setPrototypeOf(prototypeRO, constructor.prototype);
  const instanceDescriptorsRO = {};
  const propSetters = {};
  for (const [ name, descriptor ] of Object.entries(instanceDescriptors)) {
    if (descriptor?.set) {
      instanceDescriptorsRO[name] = { ...descriptor, set: throwReadOnly };
      // save the setters so we can initialize read-only objects
      if (name !== '$') {
        propSetters[name] = descriptor.set;
      }
    } else if (name === 'set') {
      instanceDescriptorsRO[name] = { value: throwReadOnly, configurable: true, writable: true };
    }
  }
  const vivificate = instanceDescriptors[VIVIFICATOR]?.value;
  const vivificateDescriptor = { 
    // vivificate child objects as read-only too
    value: function(slot) { 
      return vivificate.call(this, slot, false);
    }
  };
  const { get, set } = instanceDescriptors.$;
  defineProperties(constructor.prototype, { 
    [CONST]: { value: false },
    [ALL_KEYS]: { value: Object.keys(propSetters) },
    [SETTER]: { value: set },
    [GETTER]: { value: get },
    [PROP_SETTERS]: { value: propSetters },
    ...instanceDescriptors,
  });
  defineProperties(constructor, {
    [CONST_PROTOTYPE]: { value: prototypeRO },
    ...staticDescriptors,
  }); 
  defineProperties(prototypeRO, { 
    constructor: { value: constructor, configurable: true },
    [CONST]: { value: true },
    [SETTER]: { value: throwReadOnly },
    [VIVIFICATOR]: vivificate && vivificateDescriptor,
    ...instanceDescriptorsRO,
  });
  return constructor;
}

function createConstructor(structure, handlers, env) {
  const {
    byteSize,
    align,
    instance: { members, template },
    hasPointer,
  } = structure;
  const {
    modifier,
    initializer,
    finalizer,
    alternateCaster,
    shapeDefiner,
  } = handlers;
  const hasSlots = needSlots(members);
  // comptime fields are stored in the instance template's slots
  let comptimeFieldSlots;
  if (template?.[SLOTS]) {
    const comptimeMembers = members.filter(m => isReadOnly(m.type));
    if (comptimeMembers.length > 0) {
      comptimeFieldSlots = comptimeMembers.map(m => m.slot);
    } 
  }
  const cache = new ObjectCache();
  const constructor = function(arg, options = {}) {
    const {
      writable = true,
      fixed = false,
    } = options;
    const creating = this instanceof constructor;
    let self, dv;
    if (creating) {
      if (arguments.length === 0) {
        throwNoInitializer(structure);
      }
      self = this;
      if (hasSlots) {
        self[SLOTS] = {};
      }
      if (shapeDefiner) {
        // provided by defineSlice(); the slice is different from other structures as it does not have 
        // a fixed size; memory is allocated by the slice initializer based on the argument given
        initializer.call(self, arg, fixed);
        dv = self[MEMORY]; 
      } else {
        self[MEMORY] = dv = env.allocateMemory(byteSize, align, fixed);
      }
    } else {
      if (alternateCaster) {
        // casting from number, string, etc.
        self = alternateCaster.call(this, arg, options);
        if (self !== false) {
          return self;
        }
      }
      // look for buffer
      dv = requireDataView(structure, arg, env);
      if (self = cache.find(dv, writable)) {
        return self;
      }
      self = Object.create(writable ? constructor.prototype : constructor[CONST_PROTOTYPE]);
      if (shapeDefiner) {
        setDataView.call(self, dv, structure, false, { shapeDefiner });
      } else {
        self[MEMORY] = dv;
      }
      if (hasSlots) {
        self[SLOTS] = {};
        if (hasPointer && arg instanceof constructor) {
          // copy pointer from other object
          self[POINTER_VISITOR](copyPointer, { vivificate: true, source: arg });
        } 
      }
    }
    if (comptimeFieldSlots) {
      for (const slot of comptimeFieldSlots) {
        self[SLOTS][slot] = template[SLOTS][slot];
      }
    }
    if (modifier) {
      modifier.call(self);
    }
    if (creating) {
      // initialize object unless it's been done already
      if (!shapeDefiner) {
        initializer.call(self, arg);
      }
      if (!writable) {
        // create object with read-only prototype
        self = Object.assign(Object.create(constructor[CONST_PROTOTYPE]), self);
      } 
    }
    if (finalizer) {
      self = finalizer.call(self);
    }
    return cache.save(dv, writable, self); 
  };
  return constructor;
}

function createPropertyApplier(structure) {
  const { instance: { template } } = structure;  
  return function(arg) {
    const argKeys = Object.keys(arg);
    const propSetters = this[PROP_SETTERS];
    const allKeys = this[ALL_KEYS];
    // don't accept unknown props
    for (const key of argKeys) {
      if (!(key in propSetters)) {
        throwNoProperty(structure, key);
      }
    }
    // checking each name so that we would see inenumerable initializers as well
    let normalCount = 0;
    let normalFound = 0;
    let normalMissing = 0;
    let specialFound = 0;
    for (const key of allKeys) {
      const set = propSetters[key];
      if (set.special) {
        if (key in arg) {
          specialFound++;
        }
      } else {
        normalCount++;
        if (key in arg) {
          normalFound++;
        } else if (set.required) {
          normalMissing++;
        }
      }
    }
    if (normalMissing !== 0 && specialFound === 0) {
      const missing = allKeys.filter(k => propSetters[k].required && !(k in arg));
      throwMissingInitializers(structure, missing);
    }
    if (specialFound + normalFound > argKeys.length) {
      // some props aren't enumerable
      for (const key of allKeys) {
        if (key in arg) {
          if (!argKeys.includes(key)) {
            argKeys.push(key);
          }
        }
      }
    }
    // apply default values unless all properties are initialized
    if (normalFound < normalCount && specialFound === 0) {
      if (template) {
        if (template[MEMORY]) {
          this[COPIER](template);
        }
        this[POINTER_VISITOR]?.(copyPointer, { vivificate: true, source: template });
      }
    }
    for (const key of argKeys) {
      const set = propSetters[key];
      set.call(this, arg[key]);
    }
    return argKeys.length;
  };
}

function needSlots(members) {
  for (const { type } of members) {
    switch (type) {
      case MemberType.Object:
      case MemberType.Comptime:
      case MemberType.Type:
      case MemberType.Literal:
        return true;
    }
  }
  return false;
}

function getSelf() {
  return this;
}

class ObjectCache {
  [0] = null;
  [1] = null;

  find(dv, writable) {
    const key = (writable) ? 0 : 1;
    const map = this[key];
    return map?.get(dv);
  }

  save(dv, writable, object) {
    const key = (writable) ? 0 : 1;
    let map = this[key];    
    if (!map) {
      map = this[key] = new WeakMap();
    }
    map.set(dv, object);
    return object;
  }
}
let globalErrorSet;

function createGlobalErrorSet() {
  globalErrorSet = function() {};
  Object.setPrototypeOf(globalErrorSet.prototype, Error.prototype);
}

function getGlobalErrorSet() {
  return globalErrorSet;
}

const MemberType = {
  Void: 0,
  Bool: 1,
  Int: 2,
  Uint: 3,
  Float: 4,
  EnumerationItem: 5,
  Error: 6,
  Object: 7,
  Type: 8,
  Comptime: 9,
  Static: 10,
  Literal: 11,
  Null: 12,
  Undefined: 13,
};

function isReadOnly(type) {
  switch (type) {
    case MemberType.Type:
    case MemberType.Comptime:
    case MemberType.Literal:
      return true;
    default:
      return false;
  }
}

const factories$1 = {};

function useUint() {
  factories$1[MemberType.Uint] = getUintDescriptor;
}

function useObject() {
  factories$1[MemberType.Object] = getObjectDescriptor;
}

function isByteAligned({ bitOffset, bitSize, byteSize }) {
  return byteSize !== undefined || (!(bitOffset & 0x07) && !(bitSize & 0x07)) || bitSize === 0;
}

function getDescriptor(member, env) {
  const f = factories$1[member.type];
  return f(member, env);
}

function getUintDescriptor(member, env) {
  const getDataViewAccessor = addRuntimeCheck(env, getNumericAccessor);
  return getDescriptorUsing(member, env, getDataViewAccessor)
}

function addRuntimeCheck(env, getDataViewAccessor) {
  return function (access, member) {
    const {
      runtimeSafety = true,
    } = env;
    const accessor = getDataViewAccessor(access, member);
    if (runtimeSafety && access === 'set') {
      const { min, max } = getIntRange(member);
      return function(offset, value, littleEndian) {
        if (value < min || value > max) {
          throwOverflow(member, value);
        }
        accessor.call(this, offset, value, littleEndian);
      };
    }
    return accessor;
  };
}

function isValueExpected(structure) {
  switch (structure.type) {
    case StructureType.Primitive:
    case StructureType.ErrorUnion:
    case StructureType.Optional:
    case StructureType.Enumeration:
    case StructureType.ErrorSet:
      return true;
    default:
      return false;
  }
}

function getValue(slot) {
  const object = this[SLOTS][slot] ?? this[VIVIFICATOR](slot);
  return object[GETTER]();
}

function getObject(slot) {
  const object = this[SLOTS][slot] ?? this[VIVIFICATOR](slot);
  return object;
}

function setValue(slot, value) {
  const object = this[SLOTS][slot] ?? this[VIVIFICATOR](slot);
  object[SETTER](value);
}

function bindSlot(slot, { get, set }) {
  if (slot !== undefined) {
    return { 
      get: function() {
        return get.call(this, slot);
      },
      set: (set) 
      ? function(arg) {
          return set.call(this, slot, arg);
        } 
      : undefined,
    };
  } else {
    // array accessors
    return { get, set };
  }
}

function getObjectDescriptor(member, env) {
  const { structure, slot } = member;
  return bindSlot(slot, {
    get: isValueExpected(structure) ? getValue : getObject,
    set: setValue,
  });
}

function getDescriptorUsing(member, env, getDataViewAccessor) {
  const {
    littleEndian = true,
  } = env;
  const { bitOffset, byteSize } = member;
  const getter = getDataViewAccessor('get', member);
  const setter = getDataViewAccessor('set', member);
  if (bitOffset !== undefined) {
    const offset = bitOffset >> 3;
    return {
      get: function getValue() {
        /* WASM-ONLY */
        try {
        /* WASM-ONLY-END*/
          return getter.call(this[MEMORY], offset, littleEndian);
        /* WASM-ONLY */
        } catch (err) {
          if (err instanceof TypeError && restoreMemory.call(this)) {
            return getter.call(this[MEMORY], offset, littleEndian);
          } else {
            throw err;
          }
        }
        /* WASM-ONLY-END*/
      },
      set: function setValue(value) {
        /* WASM-ONLY */
        try {
        /* WASM-ONLY-END*/
        return setter.call(this[MEMORY], offset, value, littleEndian);
        /* WASM-ONLY */
        } catch (err) {
          if (err instanceof TypeError && restoreMemory.call(this)) {
            return setter.call(this[MEMORY], offset, value, littleEndian);
          } else {
            throw err;
          }
        }
        /* WASM-ONLY-END*/
      }
    }
  } else {
    return {
      get: function getElement(index) {
        try {
          return getter.call(this[MEMORY], index * byteSize, littleEndian);
        } catch (err) {
          /* WASM-ONLY */
          if (err instanceof TypeError && restoreMemory.call(this)) {
            return getter.call(this[MEMORY], index * byteSize, littleEndian);
          } else {
          /* WASM-ONLY-END */
            rethrowRangeError(member, index, err);
          /* WASM-ONLY */
          }
          /* WASM-ONLY-END */
        }
      },
      set: function setElement(index, value) {
        /* WASM-ONLY */
        try {
        /* WASM-ONLY-END */
          return setter.call(this[MEMORY], index * byteSize, value, littleEndian);
        /* WASM-ONLY */
        } catch (err) {
          if (err instanceof TypeError && restoreMemory.call(this)) {
            return setter.call(this[MEMORY], index * byteSize, value, littleEndian);
          } else {
            rethrowRangeError(member, index, err);
          }
        }
        /* WASM-ONLY-END */
      },
    }
  }
}

function throwNoInitializer(structure) {
  const { name } = structure;
  throw new TypeError(`An initializer must be provided to the constructor of ${name}, even when the intended value is undefined`);
}

function throwBufferSizeMismatch(structure, dv, target = null) {
  const { name, type, byteSize } = structure;
  const actual = dv.byteLength;
  const s = (byteSize !== 1) ? 's' : '';
  if (type === StructureType.Slice && !target) {
    throw new TypeError(`${name} has elements that are ${byteSize} byte${s} in length, received ${actual}`);
  } else {
    const total = (type === StructureType.Slice) ? target.length * byteSize : byteSize;
    throw new TypeError(`${name} has ${total} byte${s}, received ${actual}`);
  }
}

function throwBufferExpected(structure) {
  const { type, byteSize, typedArray } = structure;
  const s = (byteSize !== 1) ? 's' : '';
  const acceptable = [ 'ArrayBuffer', 'DataView' ].map(addArticle);
  if (typedArray) {
    acceptable.push(addArticle(typedArray.name));
  }
  if (type === StructureType.Slice) {
    throw new TypeError(`Expecting ${formatList(acceptable)} that can accommodate items ${byteSize} byte${s} in length`);
  } else {
    throw new TypeError(`Expecting ${formatList(acceptable)} that is ${byteSize} byte${s} in length`);
  }
}

function throwInvalidInitializer(structure, expected, arg) {
  const { name } = structure;
  const acceptable = [];
  if (Array.isArray(expected)) {
    for (const type of expected) {
      acceptable.push(addArticle(type));
    }
  } else {
    acceptable.push(addArticle(expected));
  }
  const received = getDescription(arg);
  throw new TypeError(`${name} expects ${formatList(acceptable)} as argument, received ${received}`);
}

function throwInvalidArrayInitializer(structure, arg, shapeless = false) {
  const { instance: { members: [ member ] }, type, typedArray } = structure;
  const acceptable = [];
  const primitive = getPrimitiveType(member);
  if (primitive) {
    acceptable.push(`array of ${primitive}s`);
  } else if (member.type === MemberType.EnumerationItem) {
    acceptable.push(`array of enum items`);
  } else {
    acceptable.push(`array of objects`);
  }
  if (typedArray) {
    acceptable.push(typedArray.name);
  }
  if (type === StructureType.Slice && shapeless) {
    acceptable.push(`length`);
  }
  throwInvalidInitializer(structure, acceptable.join(' or '), arg);
}

function throwArrayLengthMismatch(structure, target, arg) {
  const { name, length, instance: { members: [ member ] } } = structure;
  const { structure: { constructor: elementConstructor} } = member;
  const { length: argLength, constructor: argConstructor } = arg;
  // get length from object whech it's a slice
  const actualLength = target?.length ?? length;
  const s = (actualLength !== 1) ? 's' : '';
  let received;
  if (argConstructor === elementConstructor) {
    received = `only a single one`;
  } else if (argConstructor.child === elementConstructor) {
    received = `a slice/array that has ${argLength}`;
  } else {
    received = `${argLength} initializer${argLength > 1 ? 's' : ''}`;
  }
  throw new TypeError(`${name} has ${actualLength} element${s}, received ${received}`);
}

function throwMissingInitializers(structure, missing) {
  const { name } = structure;
  throw new TypeError(`Missing initializers for ${name}: ${missing.join(', ')}`);
}

function throwNoProperty(structure, propName) {
  const { name, instance: { members } } = structure;
  const member = members.find(m => m.name === propName);
  if (member) {
    throw new TypeError(`Comptime value cannot be changed: ${propName}`);
  } else {
    throw new TypeError(`${name} does not have a property with that name: ${propName}`);
  }
}

function throwArgumentCountMismatch(structure, actual) {
  const { name, instance: { members } } = structure;
  const argCount = members.length - 1;
  const s = (argCount !== 1) ? 's' : '';
  throw new Error(`${name} expects ${argCount} argument${s}, received ${actual}`);
}

function rethrowArgumentError(structure, index, err) {
  const { name, instance: { members } } = structure;
  // Zig currently does not provide the argument name
  const argName = `args[${index}]`;
  const argCount = members.length - 1;
  const prefix = (index !== 0) ? '..., ' : '';
  const suffix = (index !== argCount - 1) ? ', ...' : '';
  const argLabel = prefix + argName + suffix;
  const newError = new err.constructor(`${name}(${argLabel}): ${err.message}`);
  newError.stack = err.stack;
  throw newError;
}

function throwNoCastingToPointer(structure) {
  throw new TypeError(`Non-slice pointers can only be created with the help of the new operator`);
}

function throwConstantConstraint(structure, pointer) {
  const { name: target } = structure;
  const { constructor: { name } } = pointer;
  throw new TypeError(`Conversion of ${name} to ${target} requires an explicit cast`);
}

function throwMisplacedSentinel(structure, value, index, length) {
  const { name } = structure;
  throw new TypeError(`${name} expects the sentinel value ${value} at ${length - 1}, found at ${index}`);
}

function throwMissingSentinel(structure, value, length) {
  const { name } = structure;
  throw new TypeError(`${name} expects the sentinel value ${value} at ${length - 1}`);
}

function throwAlignmentConflict(align1, align2) {
  throw new TypeError(`Unable to simultaneously align memory to ${align2}-byte and ${align1}-byte boundary`);
}

function throwTypeMismatch(expected, arg) {
  const received = getDescription(arg);
  throw new TypeError(`Expected ${addArticle(expected)}, received ${received}`)
}

function throwNullPointer() {
  throw new TypeError(`Null pointer`);
}

function throwInvalidPointerTarget(structure, arg) {
  const { name } = structure;
  let target;
  if (arg != null) {
    const type = typeof(arg);
    const noun = (type === 'object' && arg.constructor !== Object) ? `${arg.constructor.name} object`: type;
    const a = article(noun);
    target = `${a} ${noun}`;
  } else {
    target = arg + '';
  }
  throw new TypeError(`${name} cannot point to ${target}`)
}

function throwFixedMemoryTargetRequired(structure, arg) {
  throw new TypeError(`Pointers in fixed memory cannot point to garbage-collected object`);
}


function throwOverflow(member, value) {
  const typeName = getTypeName(member);
  throw new TypeError(`${typeName} cannot represent the value given: ${value}`);
}

function throwOutOfBound(member, index) {
  const { name } = member;
  throw new RangeError(`Index exceeds the size of ${name ?? 'array'}: ${index}`);
}

function rethrowRangeError(member, index, err) {
  if (err instanceof RangeError) {
    throwOutOfBound(member, index);
  } else {
    throw err;
  }
}

function throwNotOnByteBoundary(member) {
  const { name, structure: { name: { struct }} } = member;
  throw new TypeError(`Unable to create ${struct} as it is not situated on a byte boundary: ${name}`);
}

function throwReadOnly() {
  throw new TypeError(`Unable to modify read-only object`);
}

function throwReadOnlyTarget(structure) {
  const { name } = structure;
  throw new TypeError(`${name} cannot point to a read-only object`);
}

function throwZigError(name) {
  throw new Error(decamelizeErrorName(name));
}

function warnImplicitArrayCreation(structure, arg) {
  const created = addArticle(structure.typedArray.name);
  const source = addArticle(arg.constructor.name);
  console.warn(`Implicitly creating ${created} from ${source}`);
}

function decamelizeErrorName(name) {
  // use a try block in case Unicode regex fails
  try {
    const lc = name.replace(/(\p{Uppercase}+)(\p{Lowercase}*)/gu, (m0, m1, m2) => {
      if (m1.length === 1) {
        return ` ${m1.toLocaleLowerCase()}${m2}`;
      } else {
        if (m2) {
          const acronym = m1.substring(0, m1.length - 1);
          const letter = m1.charAt(m1.length - 1).toLocaleLowerCase();
          return ` ${acronym} ${letter}${m2}`;
        } else {
          return ` ${m1}`;
        }
      }
    }).trimStart();
    return lc.charAt(0).toLocaleUpperCase() + lc.substring(1);
    /* c8 ignore next 3 */
  } catch (err) {
    return name;
  }
}

function getDescription(arg) {
  const type = typeof(arg);
  let s;
  if (type === 'object') {
    s = (arg) ? Object.prototype.toString.call(arg) : 'null';
  } else {
    s = type;
  }
  return addArticle(s);
}

function addArticle(noun) {
  return `${article(noun)} ${noun}`;
}

function article(noun) {
  return /^\W*[aeiou]/i.test(noun) ? 'an' : 'a';
}

function formatList(list, conj = 'or') {
  const sep = ` ${conj} `;
  if (list.length > 2) {
    return list.slice(0, -1).join(', ') + sep + list[list.length - 1];
  } else {
    return list.join(sep);
  }
}

function getNumericAccessor(access, member) {
  return cacheMethod(access, member, (name) => {
    if (DataView.prototype[name]) {
      return DataView.prototype[name];
    } else {
      return getExtendedTypeAccessor(access, member);
    }
  });
}

const factories = {};

function getExtendedTypeAccessor(access, member) {
  const f = factories[member.type];
  return f(access, member);
}

function getDataView(structure, arg, env) {
  const { type, byteSize, typedArray } = structure;
  let dv;
  // not using instanceof just in case we're getting objects created in other contexts
  const tag = arg?.[Symbol.toStringTag];
  if (tag === 'DataView') {
    dv = arg;
  } else if (tag === 'ArrayBuffer' || tag === 'SharedArrayBuffer') {
    dv = env.obtainView(arg, 0, arg.byteLength);
  } else if (typedArray && tag === typedArray.name || (tag === 'Uint8ClampedArray' && typedArray === Uint8Array)) {
    dv = env.obtainView(arg.buffer, arg.byteOffset, arg.byteLength);
  } else if (tag === 'Uint8Array' && typeof(Buffer) === 'function' && arg instanceof Buffer) {
    dv = env.obtainView(arg.buffer, arg.byteOffset, arg.byteLength);
  } else {
    const memory = arg?.[MEMORY];
    if (memory) {
      const { constructor, instance: { members: [ member ] } } = structure;
      if (arg instanceof constructor) {
        return memory;
      } else if (type === StructureType.Array || type === StructureType.Slice || type === StructureType.Vector) {
        const { byteSize: elementSize, structure: { constructor: Child } } = member;
        const number = findElements(arg, Child);
        if (number !== undefined) {
          if (type === StructureType.Slice || number * elementSize === byteSize) {
            return memory;
          } else {
            throwArrayLengthMismatch(structure, null, arg);
          }
        } 
      }
    }
  }
  if (dv && byteSize !== undefined) {
    checkDataViewSize(dv, structure);
  }
  return dv;
}

function checkDataView(dv) {
  if (dv?.[Symbol.toStringTag] !== 'DataView') {
    throwTypeMismatch('a DataView', dv);
  }
  return dv;
}

function checkDataViewSize(dv, structure) {
  const { byteSize, type } = structure;
  const multiple = type === StructureType.Slice;
  if (multiple ? dv.byteLength % byteSize !== 0 : dv.byteLength !== byteSize) {
    throwBufferSizeMismatch(structure, dv);
  }
}

function setDataView(dv, structure, copy, handlers) {
  const { byteSize, type, sentinel } = structure;
  const multiple = type === StructureType.Slice;
  if (!this[MEMORY]) {
    const { shapeDefiner } = handlers;
    checkDataViewSize(dv, structure);
    const len = dv.byteLength / byteSize;
    const source = { [MEMORY]: dv };
    sentinel?.validateData(source, len);
    shapeDefiner.call(this, copy ? null : dv, len);
    if (copy) {
      this[COPIER](source);
    }  
  } else {
    const byteLength = multiple ? byteSize * this.length : byteSize;
    if (dv.byteLength !== byteLength) {
      throwBufferSizeMismatch(structure, dv, this);
    }
    const source = { [MEMORY]: dv };
    sentinel?.validateData(source, this.length);
    this[COPIER](source); 
  }
}

function findElements(arg, Child) {
  // casting to a array/slice
  const { constructor: Arg } = arg;
  if (Arg === Child) {
    // matching object
    return 1;
  } else if (Arg.child === Child) {
    // matching slice/array
    return arg.length;
  }
}

function requireDataView(structure, arg, env) {
  const dv = getDataView(structure, arg, env);
  if (!dv) {
    throwBufferExpected(structure);
  }
  return dv;
}

function getTypedArrayClass(member) {
  const { type: memberType, byteSize } = member;
  if (memberType === MemberType.Int) {
    switch (byteSize) {
      case 1: return Int8Array;
      case 2: return Int16Array;
      case 4: return Int32Array;
      case 8: return BigInt64Array;
    }
  } else if (memberType === MemberType.Uint) {
    switch (byteSize) {
      case 1: return Uint8Array;
      case 2: return Uint16Array;
      case 4: return Uint32Array;
      case 8: return BigUint64Array;
    }
  } else if (memberType === MemberType.Float) {
    switch (byteSize) {
      case 4: return Float32Array;
      case 8: return Float64Array;
    }
  }
  return null;
}

function isTypedArray(arg, TypedArray) {
  const tag = arg?.[Symbol.toStringTag];
  return (!!TypedArray && tag === TypedArray.name);
}

function isCompatible(arg, constructor) {
  const tags = constructor[COMPAT];
  if (tags) {
    const tag = arg?.[Symbol.toStringTag];
    if (tags.includes(tag)) {
      return true;
    }
  }
  if (constructor.child) {
    if (findElements(arg, constructor.child) !== undefined) {
      return true;
    }
  }
  return false;
}

function getCompatibleTags(structure) {
  const { typedArray } = structure;
  const tags = [];
  if (typedArray) {
    tags.push(typedArray.name);
    tags.push('DataView');
    if (typedArray === Uint8Array || typedArray === Int8Array) {
      tags.push('Uint8ClampedArray');
      tags.push('ArrayBuffer');
      tags.push('SharedArrayBuffer');
    }
  }
  return tags;
}

function isBuffer(arg, typedArray) {
  const tag = arg?.[Symbol.toStringTag];
  if (tag === 'DataView' || tag === 'ArrayBuffer' || tag === 'SharedArrayBuffer') {
    return true;
  } else if (typedArray && tag === typedArray.name) {
    return true;
  } else {
    return false;
  }
}

function getTypeName(member) {
  const { type, bitSize, byteSize } = member;
  if (type === MemberType.Int) {
    return `${bitSize <= 32 ? '' : 'Big' }Int${bitSize}`;
  } else if (type === MemberType.Uint) {
    return `${bitSize <= 32 ? '' : 'Big' }Uint${bitSize}`;
  } else if (type === MemberType.Float) {
    return `Float${bitSize}`;
  } else if (type === MemberType.Bool) {
    const boolSize = (byteSize !== undefined) ? byteSize * 8 : 1;
    return `Bool${boolSize}`;
  } else if (type === MemberType.Void) {
    return `Null`;
  }
}

const methodCache = {};

function cacheMethod(access, member, cb) {
  const { type, bitOffset, bitSize, structure } = member;
  const bitPos = bitOffset & 0x07;
  const typeName = getTypeName(member);
  const suffix = isByteAligned(member) ? `` : `Bit${bitPos}`;
  const isInt = type === MemberType.Int || type === MemberType.Uint;
  let name = `${access}${typeName}${suffix}`;
  let isSize = false, originalName = name;
  if (isInt && bitSize === 64) {
    const zigTypeName = structure?.name;
    if (zigTypeName === 'usize' || zigTypeName === 'isize') {
      name += 'Size';
      isSize = true;
    }
  }
  let fn = methodCache[name];
  if (!fn) {
    if (isInt && access === 'set') {
      // add auto-conversion between number and bigint
      const Primitive = getPrimitiveClass(member);
      const set = cb(originalName);
      fn = function(offset, value, littleEndian) {
        set.call(this, offset, Primitive(value), littleEndian);
      };
    } else if (isSize && access === 'get') {
      // use number instead of bigint where possible
      const get = cb(originalName);
      const min = BigInt(Number.MIN_SAFE_INTEGER);
      const max = BigInt(Number.MAX_SAFE_INTEGER);
      fn = function(offset, littleEndian) {
        const value = get.call(this, offset, littleEndian);
        if (min <= value && value <= max) {
          return Number(value);
        } else {
          return value;
        }
      };
    } else {
      fn = cb(name);
    }
    if (fn && fn.name !== name) {
      Object.defineProperty(fn, 'name', { value: name, configurable: true, writable: false });
    }
    methodCache[name] = fn;
  }
  return fn;
}

function addMethods(s, env) {
  const add = (target, { methods }, pushThis) => {
    const descriptors = {};
    const re = /^(get|set)\s+([\s\S]+)/;
    for (const method of methods) {
      const f = env.createCaller(method, pushThis);
      const m = re.exec(f.name);
      if (m) {
        // getter/setter
        const type = m[1], propName = m[2];
        const argRequired = (type === 'get') ? 0 : 1;
        const argCount = getArgumentCount(method, pushThis);
        // need to match arg count, since instance methods also show up as static methods
        if (argCount === argRequired) {
          let descriptor = descriptors[propName];
          if (!descriptor) {
            descriptor = descriptors[propName] = { configurable: true, enumerable: true };
          }
          descriptor[type] = f; 
        }
      } else {
        descriptors[f.name] = { value: f, configurable: true, writable: true };
      }
    }
    defineProperties(target, descriptors);
  };
  add(s.constructor, s.static, false);
  add(s.constructor.prototype, s.instance, true);
}

function getArgumentCount(method, pushThis) {
  const { argStruct: { instance: { members } } } = method;  
  return members.length - (pushThis ? 2 : 1);
}

function addStaticMembers(structure, env) {
  const {
    type,
    constructor,
    static: { members, template },
  } = structure;
  if (members.length === 0) {
    return;
  }
  const descriptors = {};
  for (const member of members) {
    descriptors[member.name] = getDescriptor(member, env);
  }
  defineProperties(constructor, {
    ...descriptors,
    // static variables are objects stored in the static template's slots
    [SLOTS]: { value: template[SLOTS] },
  });
  if (type === StructureType.Enumeration) {
    const enums = constructor[ITEMS];
    for (const { name, slot } of members) {
      if (name !== undefined) {
        // place item in hash to facilitate lookup, 
        const item = constructor[SLOTS][slot];
        if (item instanceof constructor) {
          // attach name to item so tagged union code can quickly find it
          defineProperties(item, { [NAME]: { value: name } });  
          const index = item[Symbol.toPrimitive]();
          enums[index] = enums[name] = item;          
        }      
      } else {
        // non-exhaustive enum
        defineProperties(constructor, { [MORE]: { value: true } });
      }
    }
  } else if (type === StructureType.ErrorSet) {
    const allErrors = getGlobalErrorSet();
    const errors = constructor[ITEMS];
    for (const { name, slot } of members) {
      let error = constructor[SLOTS][slot];
      const index = Number(error);
      const previous = allErrors[index];
      if (previous) {
        if (!(previous instanceof constructor)) {
          // error already exists in a previously defined set
          // see if we should make that set a subclass or superclass of this one
          const otherSet = previous.constructor;
          const otherErrors = Object.values(otherSet[SLOTS]);
          const errorIndices = Object.values(constructor[SLOTS]).map(e => Number(e));
          if (otherErrors.every(e => errorIndices.includes(Number(e)))) {
            // this set contains the all errors of the other one, so it's a superclass
            Object.setPrototypeOf(otherSet.prototype, constructor.prototype);
          } else {
            // make this set a subclass of the other
            Object.setPrototypeOf(constructor.prototype, otherSet.prototype);
            for (const otherError of otherErrors) {
              if (errorIndices.includes(Number(otherError))) {
                // this set should be this error object's class
                Object.setPrototypeOf(otherError, constructor.prototype);
              }
            }
          }
        }
        error = constructor[SLOTS][slot] = previous;       
      } else {
        // set error message (overriding prototype) and add to hash
        defineProperties(error, { message: { value: decamelizeErrorName(name) } });
        allErrors[index] = allErrors[error.message] = allErrors[`${error}`] = error;
      }
      errors[index] = errors[error.message] = errors[`${error}`] = error;
    }
  }
}

class Environment {
  context;
  contextStack = [];
  consolePending = [];
  consoleTimeout = 0;
  viewMap = new WeakMap();
  initPromise;
  abandoned = false;
  released = false;
  littleEndian = true;
  runtimeSafety = true;
  comptime = false;
  /* RUNTIME-ONLY */
  variables = [];
  /* RUNTIME-ONLY-END */
  imports;
  console = globalThis.console;

  /*
  Functions to be defined in subclass:

  getBufferAddress(buffer: ArrayBuffer): bigint|number {
    // return a buffer's address
  }
  allocateHostMemory(len: number, align: number): DataView {
    // allocate memory and remember its address
  }
  allocateShadowMemory(len: number, align: number): DataView {
    // allocate memory for shadowing objects
  }
  freeHostMemory(address: bigint|number, len: number, align: number): void {
    // free previously allocated memory
  }
  freeShadowMemory(address: bigint|number, len: number, align: number): void {
    // free memory allocated for shadow
  }
  allocateFixedMemory(len: number, align: number): DataView {
    // allocate fixed memory and keep a reference to it
  }
  freeFixedMemory(address: bigint|number, len: number, align: number): void {
    // free previously allocated fixed memory return the reference
  }
  obtainFixedView(address: bigint|number, len: number): DataView {
    // obtain a data view of memory at given address
  }
  releaseFixedView(dv: DataView): void {
    // release allocated memory stored in data view, doing nothing if data view 
    // does not contain fixed memory or if memory is static
  }
  inFixedMemory(object: object): boolean {
    // return true/false depending on whether object is in fixed memory
  }
  copyBytes(dst: DataView, address: bigint|number, len: number): void {
    // copy memory at given address into destination view
  }
  findSentinel(address: bigint|number, bytes: DataView): number {
    // return offset where sentinel value is found
  }
  getMemoryOffset(address: bigint|number) number {
    // return offset of address relative to start of module memory
  }
  recreateAddress(reloc: number) number {
    // recreate address of memory belonging to module
  }

  getTargetAddress(target: object, cluster: object|undefined) {
    // return the address of target's buffer if correctly aligned
  }
  */

  startContext() {
    if (this.context) {
      this.contextStack.push(this.context);
    }
    this.context = new CallContext();
  }

  endContext() {
    this.context = this.contextStack.pop();
  }

  allocateMemory(len, align = 0, fixed = false) {
    if (fixed) {
      return this.allocateFixedMemory(len, align);
    } else {
      return this.allocateRelocMemory(len, align);
    }
  }

  allocateRelocMemory(len, align) {
    return this.obtainView(new ArrayBuffer(len), 0, len);
  }

  registerMemory(dv, targetDV = null, targetAlign = undefined) {
    const { memoryList } = this.context;
    const address = this.getViewAddress(dv);
    const index = findMemoryIndex(memoryList, address);
    memoryList.splice(index, 0, { address, dv, len: dv.byteLength, targetDV, targetAlign });
    return address;
  }

  unregisterMemory(address) {
    const { memoryList } = this.context;
    const index = findMemoryIndex(memoryList, address);
    const prev = memoryList[index - 1];
    if (prev?.address === address) {
      memoryList.splice(index - 1, 1);
    }
  }

  findMemory(address, len) {
    // check for null address (=== can't be used since address can be both number and bigint)
    if (this.context) {
      const { memoryList } = this.context;
      const index = findMemoryIndex(memoryList, address);
      const entry = memoryList[index - 1];
      if (entry?.address === address && entry.len === len) {
        return entry.targetDV ?? entry.dv;
      } else if (entry?.address <= address && address < add(entry.address, entry.len)) {
        const offset = Number(address - entry.address);
        const targetDV = entry.targetDV ?? entry.dv;
        const isOpaque = len === undefined;
        if (isOpaque) {
          len = targetDV.byteLength - offset;
        }
        const dv = this.obtainView(targetDV.buffer, targetDV.byteOffset + offset, len);
        if (isOpaque) {
          // opaque structure--need to save the alignment 
          dv[ALIGN] = entry.targetAlign;
        }
        return dv;
      }
    }
    // not found in any of the buffers we've seen--assume it's fixed memory
    return this.obtainFixedView(address, len ?? 0);
  }

  getViewAddress(dv) {
    const address = this.getBufferAddress(dv.buffer);
    return add(address, dv.byteOffset);
  }

  obtainView(buffer, offset, len) {
    let entry = this.viewMap.get(buffer);
    if (!entry) {
      const dv = new DataView(buffer, offset, len);
      this.viewMap.set(buffer, dv);
      return dv;
    } 
    if (entry instanceof DataView) {
      // only one view created thus far--see if that's the matching one 
      if (entry.byteOffset === offset && entry.byteLength === len) {
        return entry;
      } else {
        // no, need to replace the entry with a hash keyed by `offset:len`
        const dv = entry;
        const key = `${dv.byteOffset}:${dv.byteLength}`;
        entry = { [key]: dv };
        this.viewMap.set(buffer, entry);
      }
    }
    const key = `${offset}:${len}`;
    let dv = entry[key];
    if (!dv) {
      dv = entry[key] = new DataView(buffer, offset, len);
    }
    return dv;
  }

  captureView(address, len, copy) {
    if (copy) {
      // copy content into reloctable memory
      const dv = this.allocateRelocMemory(len, 0);
      if (len > 0) {
        this.copyBytes(dv, address, len);
      }
      return dv;
    } else {
      // link into fixed memory
      return this.obtainFixedView(address, len);
    }
  }

  castView(structure, dv, writable) {
    const { constructor, hasPointer } = structure;
    const object = constructor.call(ENVIRONMENT, dv, { writable });
    if (hasPointer) {
      // acquire targets of pointers
      this.acquirePointerTargets(object);
    }
    return object;
  }


  finalizeShape(structure) {
    const f = getStructureFactory(structure.type);
    const constructor = f(structure, this);
    if (typeof(constructor) === 'function') {
      defineProperties(constructor, {
        name: { value: structure.name, configurable: true },
      });
      if (!constructor.prototype.hasOwnProperty(Symbol.toStringTag)) {
        defineProperties(constructor.prototype, {
          [Symbol.toStringTag]: { value: structure.name, configurable: true },
        });
      }
    }
  }

  finalizeStructure(structure) {
    addStaticMembers(structure, this);
    addMethods(structure, this);
  }

  createCaller(method, useThis) {
    const { name, argStruct, thunkId } = method;
    const { constructor } = argStruct;
    const self = this;
    let f;
    if (useThis) {
      f = function(...args) {
        return self.invokeThunk(thunkId, new constructor([ this, ...args ]));
      };
    } else {
      f = function(...args) {
        return self.invokeThunk(thunkId, new constructor(args));
      };
    }
    Object.defineProperty(f, 'name', { value: name });
    return f;
  }

  /* RUNTIME-ONLY */
  recreateStructures(structures, options) {
    Object.assign(this, options);
    const insertObjects = (dest, placeholders) => {
      for (const [ slot, placeholder ] of Object.entries(placeholders)) {
        dest[slot] = createObject(placeholder);
      }
      return dest;
    };
    const createObject = (placeholder) => {
      if (placeholder.memory) {
        const { array, offset, length } = placeholder.memory;
        const dv = this.obtainView(array.buffer, offset, length);
        const { constructor } = placeholder.structure;
        const { reloc, const: isConst } = placeholder;
        const writable = reloc !== undefined && isConst !== true;
        const object = constructor.call(ENVIRONMENT, dv, { writable });
        if (placeholder.slots) {
          insertObjects(object[SLOTS], placeholder.slots);
        }
        if (reloc !== undefined) {
          // need to replace dataview with one pointing to fixed memory later,
          // when the VM is up and running
          this.variables.push({ reloc, object });
        }
        return object;  
      } else {
        return placeholder.structure;
      }
    };
    createGlobalErrorSet();
    const objectPlaceholders = new Map();
    for (const structure of structures) {
      // recreate the actual template using the provided placeholder
      for (const scope of [ structure.instance, structure.static ]) {
        if (scope.template) {
          const placeholder = scope.template;
          const template = scope.template = {};
          if (placeholder.memory) {
            const { array, offset, length } = placeholder.memory;
            template[MEMORY] = this.obtainView(array.buffer, offset, length);
          }
          if (placeholder.slots) {
            // defer creation of objects until shapes of structures are finalized
            const slots = template[SLOTS] = {};
            objectPlaceholders.set(slots, placeholder.slots); 
          }   
        }
      }
      this.finalizeShape(structure);
    }
    // insert objects into template slots
    for (const [ slots, placeholders ] of objectPlaceholders) {
      insertObjects(slots, placeholders);
    }
    // add static members, methods, etc.
    for (const structure of structures) {
      this.finalizeStructure(structure);
    }
  }

  linkVariables(writeBack) {
    const pointers = [];
    for (const { object, reloc } of this.variables) {
      this.linkObject(object, reloc, writeBack);
      const getter = object[TARGET_GETTER];
      if (getter && object[SLOTS][0]) {
        pointers.push(object);
      }
    }
    // save locations of pointer targets
    for (const pointer of pointers) {
      const target = pointer[TARGET_GETTER]();
      const address = this.getViewAddress(target[MEMORY]);
      const { length = 1 } = target;
      pointer[FIXED_LOCATION] = { address, length };
    }
  }

  linkObject(object, reloc, writeBack) {
    if (this.inFixedMemory(object)) {
      return;
    }
    const dv = object[MEMORY];
    const address = this.recreateAddress(reloc);
    const fixedDV = this.obtainFixedView(address, dv.byteLength);
    if (writeBack) {
      const dest = Object.create(object.constructor.prototype);
      dest[MEMORY] = fixedDV;
      dest[COPIER](object);
    }
    object[MEMORY] = fixedDV;
    const linkChildren = (object) => {
      if (object[SLOTS]) {
        for (const child of Object.values(object[SLOTS])) {
          if (child) {
            const childDV = child[MEMORY];
            if (childDV.buffer === dv.buffer) {
              const offset = childDV.byteOffset - dv.byteOffset;
              child[MEMORY] = this.obtainView(fixedDV.buffer, offset, childDV.byteLength);
              linkChildren(child); 
            }
          }
        }
      }
    };
    linkChildren(object);
  }

  unlinkVariables() {
    for (const { object } of this.variables) {
      this.unlinkObject(object);
    }
  }

  unlinkObject(object) {
    if (!this.inFixedMemory(object)) {
      return;
    }
    const dv = object[MEMORY];
    const relocDV = this.allocateMemory(dv.byteLength);
    const dest = Object.create(object.constructor.prototype);
    dest[MEMORY] = relocDV;
    dest[COPIER](object);
    object[MEMORY] = relocDV;
  }

  releaseFunctions() {
    const throwError = function() {
      throw new Error(`Module was abandoned`);
    };
    for (const name of Object.keys(this.imports)) {
      if (this[name]) {
        this[name] = throwError;
      }
    }
  }

  getControlObject() {
    return {
      init: () => this.initPromise ?? Promise.resolve(),
      abandon: () => this.abandon(),
      released: () => this.released,
      connect: (c) => this.console = c,
    };
  }

  abandon() {
    if (!this.abandoned) {
      this.releaseFunctions();
      this.unlinkVariables();
      this.abandoned = true;
    }
  }

  writeToConsole(dv) {
    const { console } = this;
    try {
      // make copy of array, in case incoming buffer is pointing to stack memory
      const array = new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength).slice();
      // send text up to the last newline character
      const index = array.lastIndexOf(0x0a);
      if (index === -1) {
        this.consolePending.push(array);
      } else {
        const beginning = array.subarray(0, index);
        const remaining = array.subarray(index + 1);
        const list = [ ...this.consolePending, beginning ];
        console.log(decodeText(list));
        this.consolePending = (remaining.length > 0) ? [ remaining ] : [];
      }
      clearTimeout(this.consoleTimeout);
      if (this.consolePending.length > 0) {
        this.consoleTimeout = setTimeout(() => {
          console.log(decodeText(this.consolePending));
          this.consolePending = [];
        }, 250);
      }
      /* c8 ignore next 3 */
    } catch (err) {
      console.error(err);
    }
  }

  flushConsole() {
    if (this.consolePending.length > 0) {
      console.log(decodeText(this.consolePending));
      this.consolePending = [];
      clearTimeout(this.consoleTimeout);
    }
  }

  updatePointerAddresses(args) {
    // first, collect all the pointers
    const pointerMap = new Map();
    const bufferMap = new Map();
    const potentialClusters = [];
    const env = this;
    const callback = function({ isActive }) {
      if (!isActive(this)) {
        return;
      }
      // bypass proxy
      const pointer = this[POINTER];
      if (pointerMap.get(pointer)) {
        return;
      }
      const target = pointer[SLOTS][0];
      if (target) {
        pointerMap.set(pointer, target);
        if (!env.inFixedMemory(target)) {
          // see if the buffer is shared with other objects
          const dv = target[MEMORY];
          const other = bufferMap.get(dv.buffer);
          if (other) {
            const array = Array.isArray(other) ? other : [ other ];
            const index = findSortedIndex(array, dv.byteOffset, t => t[MEMORY].byteOffset);
            array.splice(index, 0, target);
            if (!Array.isArray(other)) {
              bufferMap.set(dv.buffer, array);
              potentialClusters.push(array);
            }
          } else {
            bufferMap.set(dv.buffer, target);
          }
          // scan pointers in target
          target[POINTER_VISITOR]?.(callback);
        }
      }
    };
    args[POINTER_VISITOR](callback);
    // find targets that overlap each other
    const clusters = this.findTargetClusters(potentialClusters);
    const clusterMap = new Map();
    for (const cluster of clusters) {
      for (const target of cluster.targets) {
        clusterMap.set(target, cluster);
      }
    }
    // process the pointers
    for (const [ pointer, target ] of pointerMap) {
      const cluster = clusterMap.get(target);
      const { length = 1 } = target;
      let address = this.getTargetAddress(target, cluster);
      if (address === false) {
        // need to shadow the object
        address = this.getShadowAddress(target, cluster);
      }
      // update the pointer
      pointer[LOCATION_SETTER]({ address, length });
    }
  }

  findTargetClusters(potentialClusters) {
    const clusters = [];
    for (const targets of potentialClusters) {
      let prevTarget = null, prevStart = 0, prevEnd = 0;
      let currentCluster = null;
      for (const target of targets) {
        const dv = target[MEMORY];
        const { byteOffset: start, byteLength } = dv;
        const end = start + byteLength;
        let forward = true;
        if (prevTarget) {
          if (prevEnd > start) {
            // the previous target overlaps this one
            if (!currentCluster) {
              currentCluster = {
                targets: [ prevTarget ],
                start: prevStart,
                end: prevEnd,
                address: undefined,
                misaligned: undefined,
              };
              clusters.push(currentCluster);
            }
            currentCluster.targets.push(target);
            if (end > prevEnd) {
              // set cluster end offset to include this one
              currentCluster.end = end;
            } else {
              // the previous target contains this one
              forward = false;
            }
          } else {
            currentCluster = null;
          }
        }
        if (forward) {
          prevTarget = target;
          prevStart = start;
          prevEnd = end;
        }
      }
    }
    return clusters;
  }

  createClusterShadow(cluster) {
    const { start, end, targets } = cluster;
    // look for largest align
    let maxAlign = 0, maxAlignOffset;
    for (const target of targets) {
      const dv = target[MEMORY];
      const offset = dv.byteOffset;
      const align = target.constructor[ALIGN] ?? dv[ALIGN];
      if (maxAlign === undefined || align > maxAlign) {
        maxAlign = align;
        maxAlignOffset = offset;
      }
    }
    // ensure the shadow buffer is large enough to accommodate necessary adjustments
    const len = end - start;
    const unalignedShadowDV = this.allocateShadowMemory(len + maxAlign, 1);
    const unalignedAddress = this.getViewAddress(unalignedShadowDV);
    const maxAlignAddress = getAlignedAddress(add(unalignedAddress, maxAlignOffset), maxAlign);
    const shadowAddress = subtract(maxAlignAddress, maxAlignOffset);
    const shadowOffset = unalignedShadowDV.byteOffset + Number(shadowAddress - unalignedAddress);
    const shadowDV = new DataView(unalignedShadowDV.buffer, shadowOffset, len);
    // make sure that other pointers are correctly aligned also
    for (const target of targets) {
      const dv = target[MEMORY];
      const offset = dv.byteOffset;
      if (offset !== maxAlignOffset) {
        const align = target.constructor[ALIGN] ?? dv[ALIGN];
        if (isMisaligned(add(shadowAddress, offset), align)) {
          throwAlignmentConflict(align, maxAlign);
        }
      }
    }
    // placeholder object type
    const prototype = {
      [COPIER]: getMemoryCopier(len)
    };
    const source = Object.create(prototype);
    const shadow = Object.create(prototype);
    source[MEMORY] = new DataView(targets[0][MEMORY].buffer, Number(start), len);
    shadow[MEMORY] = shadowDV;
    shadow[ATTRIBUTES] = {
      address: unalignedAddress,
      len: unalignedShadowDV.byteLength,
      align: 1,
    };
    return this.addShadow(shadow, source, 1);
  }
  /* RUNTIME-ONLY-END */

  getShadowAddress(target, cluster) {
    if (cluster) {
      const dv = target[MEMORY];
      if (cluster.address === undefined) {
        const shadow = this.createClusterShadow(cluster);
        cluster.address = this.getViewAddress(shadow[MEMORY]);
      }
      return add(cluster.address, dv.byteOffset);
    } else {
      const shadow = this.createShadow(target);
      return this.getViewAddress(shadow[MEMORY]);
    }
  }

  createShadow(object) {
    const dv = object[MEMORY];
    // use the alignment of the structure; in the case of an opaque pointer's target,
    // try to the alignment specified when the memory was allocated
    const align = object.constructor[ALIGN] ?? dv[ALIGN];
    const shadow = Object.create(object.constructor.prototype);
    const shadowDV = shadow[MEMORY] = this.allocateShadowMemory(dv.byteLength, align);
    shadow[ATTRIBUTES] = {
      address: this.getViewAddress(shadowDV),
      len: shadowDV.byteLength,
      align,
    };
    return this.addShadow(shadow, object, align);
  }

  addShadow(shadow, object, align) {
    let { shadowMap } = this.context;
    if (!shadowMap) {
      shadowMap = this.context.shadowMap = new Map();
    }
    shadowMap.set(shadow, object);
    this.registerMemory(shadow[MEMORY], object[MEMORY], align);
    return shadow;
  }

  removeShadow(dv) {
    const { shadowMap } = this.context;
    if (shadowMap) {
      for (const [ shadow ] of shadowMap) {
        if (shadow[MEMORY] === dv) {
          shadowMap.delete(shadow);
          break;
        }
      }
    }
  }

  updateShadows() {
    const { shadowMap } = this.context;
    if (!shadowMap) {
      return;
    }
    for (const [ shadow, object ] of shadowMap) {
      shadow[COPIER](object);
    }
  }

  updateShadowTargets() {
    const { shadowMap } = this.context;
    if (!shadowMap) {
      return;
    }
    for (const [ shadow, object ] of shadowMap) {
      object[COPIER](shadow);
    }
  }

  releaseShadows() {
    const { shadowMap } = this.context;
    if (!shadowMap) {
      return;
    }
    for (const [ shadow ] of shadowMap) {
      const { address, len, align } = shadow[ATTRIBUTES];
      this.freeShadowMemory(address, len, align);
    }
  }

  acquirePointerTargets(args) {
    const env = this;
    const pointerMap = new Map();
    const callback = function({ isActive, isMutable }) {
      const pointer = this[POINTER];
      if (pointerMap.get(pointer)) {
        return;
      } else {
        pointerMap.set(pointer, true);
      }
      const writable = !pointer.constructor.const;
      const currentTarget = pointer[SLOTS][0];
      let newTarget, location;
      if (isActive(this)) {
        const Target = pointer.constructor.child;
        if (!currentTarget || isMutable(this)) {
          // obtain address and length from memory
          location = pointer[LOCATION_GETTER]();
          // get view of memory that pointer points to
          const len = (Target[SIZE] !== undefined) ? location.length * Target[SIZE] : undefined;
          const dv = env.findMemory(location.address, len);
          // create the target
          newTarget = Target.call(ENVIRONMENT, dv, { writable });
        } else {
          newTarget = currentTarget;
        }
      }
      // acquire objects pointed to by pointers in target
      currentTarget?.[POINTER_VISITOR]?.(callback, { vivificate: true, isMutable: () => writable });
      if (newTarget !== currentTarget) {
        newTarget?.[POINTER_VISITOR]?.(callback, { vivificate: true, isMutable: () => writable });
        pointer[SLOTS][0] = newTarget;
        if (env.inFixedMemory(pointer)) {
          pointer[FIXED_LOCATION] = location;
        }
      }
    };
    args[POINTER_VISITOR](callback, { vivificate: true });
  }

}

class CallContext {
  pointerProcessed = new Map();
  memoryList = [];
  shadowMap = null;
  /* WASM-ONLY */
  call = 0;
  /* WASM-ONLY-END */
}

function findSortedIndex(array, value, cb) {
  let low = 0;
  let high = array.length;
  if (high === 0) {
    return 0;
  }
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    const value2 = cb(array[mid]);
    if (value2 <= value) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
  return high;
}

function findMemoryIndex(array, address) {
  return findSortedIndex(array, address, m => m.address);
}

function isMisaligned(address, align) {
  if (align === undefined) {
    return false;
  }
  if (typeof(address) === 'bigint') {
    address = Number(address & 0xFFFFFFFFn);
  }
  const mask = align - 1;
  return (address & mask) !== 0;
}

function getAlignedAddress(address, align) {
  let mask;
  if (typeof(address) === 'bigint') {
    align = BigInt(align);
    mask = ~(align - 1n);
  } else {
    mask = ~(align - 1);
  }
  return (address & mask) + align;
}

function add(address, len) {
  return address + ((typeof(address) === 'bigint') ? BigInt(len) : len);
}

function subtract(address, len) {
  return address - ((typeof(address) === 'bigint') ? BigInt(len) : len);
}

class WebAssemblyEnvironment extends Environment {
  imports = {
    getFactoryThunk: { argType: '', returnType: 'i' },
    allocateExternMemory: { argType: 'ii', returnType: 'i' },
    freeExternMemory: { argType: 'iii' },
    allocateShadowMemory: { argType: 'cii', returnType: 'v' },
    freeShadowMemory: { argType: 'ciii' },
    runThunk: { argType: 'iv', returnType: 'v' },
    isRuntimeSafetyActive: { argType: '', returnType: 'b' },
  };
  exports = {
    allocateHostMemory: { argType: 'ii', returnType: 'v' },
    freeHostMemory: { argType: 'iii' },
    captureString: { argType: 'ii', returnType: 'v' },
    captureView: { argType: 'iib', returnType: 'v' },
    castView: { argType: 'vvb', returnType: 'v' },
    readSlot: { argType: 'vi', returnType: 'v' },
    writeSlot: { argType: 'viv' },
    getViewAddress: { argType: 'v', returnType: 'i' },
    beginDefinition: { returnType: 'v' },
    insertInteger: { argType: 'vsi', alias: 'insertProperty' },
    insertBoolean: { argType: 'vsb', alias: 'insertProperty' },
    insertString: { argType: 'vss', alias: 'insertProperty' },
    insertObject: { argType: 'vsv', alias: 'insertProperty' },
    beginStructure: { argType: 'v', returnType: 'v' },
    attachMember: { argType: 'vvb' },
    attachMethod: { argType: 'vvb' },
    createTemplate: { argType: 'v', returnType: 'v' },
    attachTemplate: { argType: 'vvb' },
    finalizeShape: { argType: 'v' },
    endStructure: { argType: 'v' },
    writeToConsole: { argType: 'v' },
    startCall: { argType: 'iv', returnType: 'i' },
    endCall: { argType: 'iv', returnType: 'i' },
  };
  nextValueIndex = 1;
  valueTable = { 0: null };
  valueIndices = new Map;
  memory = null;
  // WASM is always little endian
  littleEndian = true;

  allocateHostMemory(len, align) {
    // allocate memory in both JavaScript and WASM space
    const constructor = { [ALIGN]: align };
    const copier = getMemoryCopier(len);
    const dv = this.allocateRelocMemory(len, align);
    const shadowDV = this.allocateShadowMemory(len, align);
    // create a shadow for the relocatable memory
    const object = { constructor, [MEMORY]: dv, [COPIER]: copier };
    const shadow = { constructor, [MEMORY]: shadowDV, [COPIER]: copier };
    shadow[ATTRIBUTES] = { address: this.getViewAddress(shadowDV), len, align };
    this.addShadow(shadow, object, align);
    return shadowDV;
  }

  freeHostMemory(address, len, align) {
    const dv = this.findMemory(address, len);
    this.removeShadow(dv);
    this.unregisterMemory(address);
    this.freeShadowMemory(address, len, align);
  }

  getBufferAddress(buffer) {
    return 0;
  }

  allocateFixedMemory(len, align) {
    if (len === 0) {
      return new DataView(this.memory.buffer, 0, 0);
    }
    const address = this.allocateExternMemory(len, align);
    const dv = this.obtainFixedView(address, len);
    dv[ALIGN] = align;
    return dv;
  }

  freeFixedMemory(address, len, align) {
    if (len === 0) {
      return;
    }
    this.freeExternMemory(address, len, align);
  }

  obtainFixedView(address, len) {
    const { memory } = this;
    if (len === 0 && address === -1431655766) { // 0xAAAAAAAA
      address = 0;
    }
    const dv = this.obtainView(memory.buffer, address, len);
    dv[MEMORY] = { memory, address, len };
    return dv;
  }

  releaseFixedView(dv) {
    dv.buffer;
    const address = dv.byteOffset;
    const len = dv.byteLength;
    // only allocated memory would have align attached
    const align = dv[ALIGN];
    if (align !== undefined) {
      this.freeFixedMemory(address, len, align);
    }
  }

  inFixedMemory(object) {
    // reconnect any detached buffer before checking
    if (!this.memory) {
      return false;
    }
    restoreMemory.call(object);
    return object[MEMORY].buffer === this.memory.buffer;
  }

  copyBytes(dst, address, len) {
    const { memory } = this;
    const src = new DataView(memory.buffer, address, len);
    const copy = getCopyFunction(len);
    copy(dst, src);
  }

  findSentinel(address, bytes) {
    const { memory } = this;
    const len = bytes.byteLength;
    const end = memory.buffer.byteLength - len + 1;
    for (let i = address; i < end; i += len) {
      const dv = new DataView(memory.buffer, i, len);
      let match = true;
      for (let j = 0; j < len; j++) {
        const a = dv.getUint8(j);
        const b = bytes.getUint8(j);
        if (a !== b) {
          match = false;
          break;
        }
      }
      if (match) {
        return (i - address) / len;
      }
    }
  }

  captureString(address, len) {
    const { buffer } = this.memory;
    const ta = new Uint8Array(buffer, address, len);
    return decodeText(ta);
  }

  getTargetAddress(target, cluster) {
    if (this.inFixedMemory(target)) {
      return this.getViewAddress(target[MEMORY]);
    }
    if (target[MEMORY].byteLength === 0) {
      // it's a null pointer/empty slice
      return 0;
    }
    // relocatable buffers always need shadowing
    return false;
  }

  clearExchangeTable() {
    if (this.nextValueIndex !== 1) {
      this.nextValueIndex = 1;
      this.valueTable = { 0: null };
      this.valueIndices = new Map();
    }
  }

  getObjectIndex(object) {
    if (object) {
      let index = this.valueIndices.get(object);
      if (index === undefined) {
        index = this.nextValueIndex++;
        this.valueIndices.set(object, index);
        this.valueTable[index] = object;
      }
      return index;
    } else {
      return 0;
    }
  }

  fromWebAssembly(type, arg) {
    switch (type) {
      case 'v':
      case 's': return this.valueTable[arg];
      case 'i': return arg;
      case 'b': return !!arg;
    }
  }

  toWebAssembly(type, arg) {
    switch (type) {
      case 'v':
      case 's': return this.getObjectIndex(arg);
      case 'i': return arg;
      case 'b': return arg ? 1 : 0;
    }
  }

  exportFunction(fn, argType = '', returnType = '') {
    if (!fn) {
      return () => {};
    }
    return (...args) => {
      args = args.map((arg, i) => this.fromWebAssembly(argType.charAt(i), arg));
      const retval = fn.apply(this, args);
      return this.toWebAssembly(returnType, retval);
    };
  }

  importFunction(fn, argType = '', returnType = '') {
    let needCallContext = false;
    if (argType.startsWith('c')) {
      needCallContext = true;
      argType = argType.slice(1);
    }
    return (...args) => {
      args = args.map((arg, i) => this.toWebAssembly(argType.charAt(i), arg));
      if (needCallContext) {
        args = [ this.context.call, ...args ];
      }
      const retval = fn.apply(this, args);
      return this.fromWebAssembly(returnType, retval);
    };
  }

  exportFunctions() {
    const imports = {};
    for (const [ name, { argType, returnType, alias } ] of Object.entries(this.exports)) {
      const fn = this[alias ?? name];
      imports[`_${name}`] = this.exportFunction(fn, argType, returnType);
    }
    return imports;
  }

  importFunctions(exports) {
    for (const [ name, fn ] of Object.entries(exports)) {
      const info = this.imports[name];
      if (info) {
        const { argType, returnType } = info;
        this[name] = this.importFunction(fn, argType, returnType);
      }
    }
  }

  async instantiateWebAssembly(source) {
    const env = this.exportFunctions();
    const res = await source;
    if (res[Symbol.toStringTag] === 'Response') {
      return WebAssembly.instantiateStreaming(res, { env });
    } else {
      return WebAssembly.instantiate(res, { env });
    }
  }

  loadModule(source) {
    return this.initPromise = (async () => {
      const { instance } = await this.instantiateWebAssembly(source);
      this.memory = instance.exports.memory;
      this.importFunctions(instance.exports);
      this.trackInstance(instance);
      this.runtimeSafety = this.isRuntimeSafetyActive();
    })();
  }

  trackInstance(instance) {
    // use WeakRef to detect whether web-assembly instance has been gc'ed
    const ref = new WeakRef(instance);
    Object.defineProperty(this, 'released', { get: () => !ref.deref(), enumerable: true });
  }

  linkVariables(writeBack) {
    // linkage occurs when WASM compilation is complete and functions have been imported
    // nothing needs to happen when WASM is not used
    if (this.initPromise) {
      this.initPromise = this.initPromise.then(() => super.linkVariables(writeBack));
    }
  }


  /* RUNTIME-ONLY */
  getMemoryOffset(address) {
    // WASM address space starts at 0
    return address;
  }

  recreateAddress(reloc) {
    return reloc;
  }

  startCall(call, args) {
    this.startContext();
    // call context, used by allocateShadowMemory and freeShadowMemory
    this.context.call = call;
    if (args[POINTER_VISITOR]) {
      this.updatePointerAddresses(args);
    }
    // return address of shadow for argumnet struct
    const address = this.getShadowAddress(args);
    this.updateShadows();
    return address;
  }

  endCall(call, args) {
    this.updateShadowTargets();
    if (args[POINTER_VISITOR]) {
      this.acquirePointerTargets(args);
    }
    this.releaseShadows();
    // restore the previous context if there's one
    this.endContext();
    if (!this.context && this.flushConsole) {
      this.flushConsole();
    }
  }

  async runThunk(thunkId, args) {
    // wait for compilation
    await this.initPromise;
    // invoke runThunk() from WASM code
    return this.runThunk(thunkId, args);
  }

  invokeThunk(thunkId, args) {
    // wasm-exporter.zig will invoke startCall() with the context address and the args
    // we can't do pointer fix up here since we need the context in order to allocate
    // memory from the WebAssembly allocator; pointer target acquisition will happen in
    // endCall()
    const err = this.runThunk(thunkId, args);
    // errors returned by exported Zig functions are normally written into the
    // argument object and get thrown when we access its retval property (a zig error union)
    // error strings returned by the thunk are due to problems in the thunking process
    // (i.e. bugs in export.zig)
    if (err) {
      if (err[Symbol.toStringTag] === 'Promise') {
        // getting a promise, WASM is not yet ready
        // wait for fulfillment, then either return result or throw
        return err.then((err) => {
          if (err) {
            throwZigError(err);
          }
          return args.retval;
        });
      } else {
        throwZigError(err);
      }
    }
    return args.retval;
  }
  /* RUNTIME-ONLY */
}

function createEnvironment(source) {
  return new WebAssemblyEnvironment();
}

// activate features
usePrimitive();
useUint();
useSlice();
usePointer();
useObject();
useArray();
useArgStruct();
useStruct();

// structure defaults
const s = {
  constructor: null,
  typedArray: null,
  type: 0,
  name: undefined,
  byteSize: 0,
  align: 0,
  isConst: false,
  hasPointer: false,
  instance: {
    members: [],
    methods: [],
    template: null,
  },
  static: {
    members: [],
    methods: [],
    template: null,
  },
};

// member defaults
const m = {
  type: 0,
  isRequired: false,
};

const s0 = {}, s1 = {}, s2 = {}, s3 = {}, s4 = {}, s5 = {};

// define functions
const f0 = {
  argStruct: s4,
  thunkId: 2,
  name: "sha1",
};

// define structures
Object.assign(s0, {
  ...s,
  name: "u8",
  byteSize: 1,
  align: 1,
  instance: {
    members: [
      {
        ...m,
        type: 3,
        bitOffset: 0,
        bitSize: 8,
        byteSize: 1,
        structure: s0,
      },
    ],
    methods: [],
  },
});
Object.assign(s1, {
  ...s,
  type: 12,
  name: "[_]const u8",
  length: 0,
  byteSize: 1,
  align: 1,
  instance: {
    members: [
      {
        ...m,
        type: 3,
        bitSize: 8,
        byteSize: 1,
        structure: s0,
      },
    ],
    methods: [],
  },
});
Object.assign(s2, {
  ...s,
  type: 11,
  name: "[]const u8",
  byteSize: 8,
  align: 4,
  isConst: true,
  hasPointer: true,
  instance: {
    members: [
      {
        ...m,
        type: 7,
        bitSize: 64,
        byteSize: 8,
        slot: 0,
        structure: s1,
      },
    ],
    methods: [],
  },
});
Object.assign(s3, {
  ...s,
  type: 1,
  name: "[40]u8",
  length: 40,
  byteSize: 40,
  align: 1,
  instance: {
    members: [
      {
        ...m,
        type: 3,
        bitSize: 8,
        byteSize: 1,
        structure: s0,
      },
    ],
    methods: [],
  },
});
Object.assign(s4, {
  ...s,
  type: 3,
  name: "sha1",
  byteSize: 48,
  align: 4,
  hasPointer: true,
  instance: {
    members: [
      {
        ...m,
        type: 7,
        isRequired: true,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
        slot: 0,
        name: "0",
        structure: s2,
      },
      {
        ...m,
        type: 7,
        isRequired: true,
        bitOffset: 64,
        bitSize: 320,
        byteSize: 40,
        slot: 1,
        name: "retval",
        structure: s3,
      },
    ],
    methods: [],
  },
});
Object.assign(s5, {
  ...s,
  type: 2,
  name: "sha1",
  static: {
    members: [],
    methods: [
      f0,
    ],
  },
});
const structures = [
  s0, s1, s2, s3, s4, s5,
];
const root = s5;
const options = {
  runtimeSafety: false,
  littleEndian: true,
};

// create runtime environment
const env = createEnvironment();
const __zigar = env.getControlObject();

// recreate structures
env.recreateStructures(structures, options);

// initiate loading and compilation of WASM bytecodes
const source = (async () => {
  // sha1.zig
  const binaryString = atob("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bGVUb0NyZWF0ZU9iamVjdABoYXNQb2ludGVyAFVuYWJsZVRvQWRkU3RydWN0dXJlTWVtYmVyAFVuYWJsZVRvQWRkU3RhdGljTWVtYmVyAFVua25vd24AVW5hYmxlVG9TdGFydFN0cnVjdHVyZURlZmluaXRpb24AVW5hYmxlVG9SZXRyaWV2ZU1lbW9yeUxvY2F0aW9uAGFsaWduAGxlbmd0aABVbmFibGVUb0NyZWF0ZVN0cmluZwBiaXRTaXplAGJ5dGVTaXplAFVuYWJsZVRvQ3JlYXRlU3RydWN0dXJlVGVtcGxhdGUAVW5hYmxlVG9BZGRTdHJ1Y3R1cmVUZW1wbGF0ZQBzdHJ1Y3R1cmUAVW5hYmxlVG9EZWZpbmVTdHJ1Y3R1cmUAdHlwZQBVbmFibGVUb1NldE9iamVjdFR5cGUAVW5hYmxlVG9GaW5kT2JqZWN0VHlwZQBuYW1lAFVuYWJsZVRvV3JpdGVUb0NvbnNvbGUAVW5hYmxlVG9BZGRNZXRob2QAUG9pbnRlcklzSW52YWxpZABpc1JlcXVpcmVkAHRodW5rSWQAMAAAcmV0dmFsAAAAAAAAAAAAAAAAAAAAASNFZ4mrze/+3LqYdlQyEPDh0sMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHNoYTEAAFtdY29uc3QgdTgAAFtfXWNvbnN0IHU4AABbNDBddTgAAHU4AAAAAAAAAAAAAABOABAACAAAABoBEAAHAAAAJAAQABYAAAA7ABAAEgAAAEMBEAAeAAAAVwAQABYAAADHABAAFAAAAA8CEAAWAAAA+QEQABUAAACwABAAFgAAAJsAEAAUAAAAIgEQACAAAADnABAAGgAAAAIBEAAXAAAAQgIQABEAAACVARAAHwAAAG8BEAAUAAAAtQEQABwAAADcARAAFwAAACsCEAAWAAAAVAIQABAAAAB7ABAACwAAAA==");
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
})();
env.loadModule(source);
env.linkVariables(false);

// export root namespace and its methods and constants
const { constructor } = root;
const {
  sha1,
} = constructor;
await __zigar.init();

export { __zigar, constructor as default, sha1 };
