const MEMORY = Symbol('memory');
const SLOTS = Symbol('slots');
const ZIG = Symbol('zig');
const PARENT = Symbol('parent');
const ENUM_NAME = Symbol('enumName');
const ENUM_INDEX = Symbol('enumIndex');
const ENUM_ITEMS = Symbol('enumItems');
const ERROR_INDEX = Symbol('errorIndex');
const ENUM_ITEM = Symbol('enumItem');
const TAG = Symbol('TAG');
const GETTER = Symbol('getter');
const SETTER = Symbol('setter');
const LENGTH = Symbol('length');
const PROXY = Symbol('proxy');
const COMPAT = Symbol('compat');

const CHILD_VIVIFICATOR = Symbol('childVivificator');
const POINTER_VISITOR = Symbol('pointerVisitor');

function getBitAlignFunction(bitPos, bitSize, toAligned) {
  if (bitPos + bitSize <= 8) {
    const mask = (2 ** bitSize) - 1;
    if (toAligned) {
      // from single byte
      return function(dest, src, offset) {
        const n = src.getUint8(offset);
        const b = (n >> bitPos) & mask;
        dest.setUint8(0, b);
      };
    } else {
      // to single byte
      const destMask = 0xFF ^ (mask << bitPos);
      return function(dest, src, offset) {
        const n = src.getUint8(0);
        const d = dest.getUint8(offset);
        const b = (d & destMask) | ((n & mask) << bitPos);
        dest.setUint8(offset, b);
      };
    }
  } else {
    const leadBits = 8 - bitPos;
    const leadMask = (2 ** leadBits) - 1;
    if (toAligned) {
      const trailBits = bitSize % 8;
      const trailMask = (2 ** trailBits) - 1;
      return function(dest, src, offset) {
        let i = offset, j = 0;
        let n = src.getUint8(i++), b;
        let bitBuf = (n >> bitPos) & leadMask;
        let bitCount = leadBits;
        let remaining = bitSize;
        do {
          if (remaining > bitCount) {
            n = src.getUint8(i++);
            bitBuf = bitBuf | (n << bitCount);
            //bitCount += 8;
          }
          b = (remaining >= 8) ? bitBuf & 0xFF : bitBuf & trailMask;
          dest.setUint8(j++, b);
          bitBuf >>= 8;
          //bitCount -= 8;
          remaining -= 8;
        } while (remaining > 0);
      }
    } else {
      const trailBits = (bitSize - leadBits) % 8;
      const trailMask = (2 ** trailBits) - 1;
      const destMask1 = 0xFF ^ (leadMask << bitPos);
      const destMask2 = 0xFF ^ trailMask;
      return function(dest, src, offset) {
        let i = 0, j = offset;
        // preserve bits ahead of bitPos
        let d = dest.getUint8(j), n, b;
        let bitBuf = d & destMask1;
        let bitCount = bitPos;
        let remaining = bitSize + bitCount;
        do {
          if (remaining > bitCount) {
            n = src.getUint8(i++);
            bitBuf = bitBuf | (n << bitCount);
            bitCount += 8;
          }
          if (remaining >= 8) {
            b = bitBuf & 0xFF;
          } else {
            // preserve bits at the destination sitting behind the trailing bits
            d = dest.getUint8(j);
            b = (d & destMask2) | (bitBuf & trailMask);
          }
          dest.setUint8(j++, b);
          bitBuf >>= 8;
          bitCount -= 8;
          remaining -= 8;
        } while (remaining > 0);
      }
    }
  }
}

function getMemoryCopier(size, multiple = false) {
  if (!multiple) {
    switch (size) {
      case 1: return copy1;
      case 2: return copy2;
      case 4: return copy4;
      case 8: return copy8;
      case 16: return copy16;
      case 32: return copy32;
    }
  }
  if (!(size & 0x07)) return copy8x;
  if (!(size & 0x03)) return copy4x;
  if (!(size & 0x01)) return copy2x;
  return copy1x;
}

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

function getMemoryResetter(size) {
  switch (size) {
    case 1: return reset1;
    case 2: return reset2;
    case 4: return reset4;
    case 8: return reset8;
    case 16: return reset16;
    case 32: return reset32;
    default:
      if (!(size & 0x07)) return reset8x;
      if (!(size & 0x03)) return reset4x;
      if (!(size & 0x01)) return reset2x;
      return reset1x;
  }
}

function reset1x(dest) {
  for (let i = 0, len = dest.byteLength; i < len; i++) {
    dest.setInt8(i, 0);
  }
}

function reset2x(dest) {
  for (let i = 0, len = dest.byteLength; i < len; i += 2) {
    dest.setInt16(i, 0, true);
  }
}

function reset4x(dest) {
  for (let i = 0, len = dest.byteLength; i < len; i += 4) {
    dest.setInt32(i, 0, true);
  }
}

function reset8x(dest) {
  for (let i = 0, len = dest.byteLength; i < len; i += 8) {
    dest.setInt32(i, 0, true);
    dest.setInt32(i + 4, 0, true);
  }
}

function reset1(dest) {
  dest.setInt8(0, 0);
}

function reset2(dest) {
  dest.setInt16(0, 0, true);
}

function reset4(dest) {
  dest.setInt32(0, 0, true);
}

function reset8(dest) {
  dest.setInt32(0, 0, true);
  dest.setInt32(4, 0, true);
}

function reset16(dest) {
  dest.setInt32(0, 0, true);
  dest.setInt32(4, 0, true);
  dest.setInt32(8, 0, true);
  dest.setInt32(12, 0, true);
}

function reset32(dest) {
  dest.setInt32(0, 0, true);
  dest.setInt32(4, 0, true);
  dest.setInt32(8, 0, true);
  dest.setInt32(12, 0, true);
  dest.setInt32(16, 0, true);
  dest.setInt32(20, 0, true);
  dest.setInt32(24, 0, true);
  dest.setInt32(28, 0, true);
}
/* c8 ignore end */

function restoreMemory() {
  {
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
}

function throwNoInitializer(structure) {
  const name = getShortName(structure);
  throw new TypeError(`An initializer must be provided to the constructor of ${name}, even when it's undefined`);
}

function throwBufferSizeMismatch(structure, dv, target = null) {
  const { type, size } = structure;
  const name = getShortName(structure);
  const actual = dv.byteLength;
  const s = (size > 1) ? 's' : '';
  if (type === StructureType.Slice && !target) {
    throw new TypeError(`${name} has elements that are ${size} byte${s} in length, received ${actual}`);
  } else {
    const length = (type === StructureType.Slice) ? target.length : size;
    throw new TypeError(`${name} has ${length} byte${s}, received ${actual}`);
  }
}

function throwBufferExpected(structure) {
  const { size, typedArray } = structure;
  const s = (size > 1) ? 's' : '';
  const acceptable = [ 'ArrayBuffer', 'DataView' ].map(addArticle);
  if (typedArray) {
    acceptable.push(addArticle(typedArray.name));
  }
  throw new TypeError(`Expecting ${formatList(acceptable)} ${size} byte${s} in length`);
}

function throwInvalidEnum(structure, value) {
  const name = getShortName(structure);
  throw new TypeError(`Value given does not correspond to an item of enum ${name}: ${value}`);
}

function throwEnumExpected(structure, arg) {
  const name = getShortName(structure);
  throw new TypeError(`Enum item of the type ${name} expected, received ${arg}`);
}

function throwNoNewEnum(structure) {
  const name = getShortName(structure);
  throw new TypeError(`Cannot create new enum item\nCall ${name} without the use of "new" to obtain an enum object`);
}

function throwNoNewError(structure) {
  const name = getShortName(structure);
  throw new TypeError(`Cannot create new error\nCall ${name} without the use of "new" to obtain an error object`);
}

function throwNotInErrorSet(structure) {
  const name = getShortName(structure);
  throw new TypeError(`Error given is not a part of error set ${name}`);
}

function throwUnknownErrorNumber(structure, number) {
  const name = getShortName(structure);
  throw new TypeError(`Error number does not corresponds to any error in error set ${name}: #${number}`);
}

function throwMultipleUnionInitializers(structure) {
  const name = getShortName(structure);
  throw new TypeError(`Only one property of ${name} can be given a value`);
}

function throwInactiveUnionProperty(structure, name, currentName) {
  throw new TypeError(`Accessing property ${name} when ${currentName} is active`);
}

function throwMissingUnionInitializer(structure, arg, exclusion) {
  const { instance: { members } } = structure;
  const name = getShortName(structure);
  const missing = members.slice(0, exclusion ? -1 : undefined).map(m => m.name);
  throw new TypeError(`${name} needs an initializer for one of its union properties: ${missing.join(', ')}`);
}

function throwInvalidInitializer(structure, expected, arg) {
  const name = getShortName(structure);
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
  const { size, instance: { members: [ member ] } } = structure;
  const name = getShortName(structure);
  const { byteSize, structure: { constructor: elementConstructor} } = member;
  const length = target?.length ?? size / byteSize;
  const { length: argLength, constructor: argConstructor } = arg;
  const s = (length > 1) ? 's' : '';
  let received;
  if (argConstructor === elementConstructor) {
    received = `only a single one`;
  } else if (argConstructor.child === elementConstructor) {
    received = `a slice/array that has ${argLength}`;
  } else {
    received = `${argLength} initializer${argLength > 1 ? 's' : ''}`;
  }
  throw new TypeError(`${name} has ${length} element${s}, received ${received}`);
}

function throwMissingInitializers(structure, arg) {
  const { instance: { members } } = structure;
  const name = getShortName(structure);
  const missing = [];
  for (const { name, isRequired } of members) {
    if (isRequired) {
      if (arg?.[name] === undefined) {
        missing.push(name);
      }
    }
  }
  throw new TypeError(`Missing initializers for ${name}: ${missing.join(', ')}`);
}

function throwNoProperty$1(structure, propName) {
  const name = getShortName(structure);
  throw new TypeError(`${name} does not have a property with that name: ${propName}`);
}

function throwArgumentCountMismatch(structure, actual) {
  const { instance: { members } } = structure;
  const name = getShortName(structure);
  const argCount = members.length - 1;
  const s = (argCount > 1) ? 's' : '';
  throw new Error(`${name} expects ${argCount} argument${s}, received ${actual}`);
}

function rethrowArgumentError(structure, index, err) {
  const { instance: { members } } = structure;
  const name = getShortName(structure);
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
  const name1 = getShortName(structure);
  const { constructor: { name: name2 } } = pointer;
  throw new TypeError(`Conversion of ${name2} to ${name1} requires an explicit cast`);
}

function throwMisplacedSentinel(structure, value, index, length) {
  const name = getShortName(structure);
  throw new TypeError(`${name} expects the sentinel value ${value} at ${length - 1}, found at ${index}`);
}

function throwMissingSentinel(structure, value, length) {
  const name = getShortName(structure);
  throw new TypeError(`${name} expects the sentinel value ${value} at ${length - 1}`);
}

function throwAssigningToConstant(pointer) {
  const { constructor: { name } } = pointer;
  throw new TypeError(`${name} cannot be modified`);
}

function throwTypeMismatch(expected, arg) {
  const received = getDescription(arg);
  throw new TypeError(`Expected ${addArticle(expected)}, received ${received}`)
}

function throwInaccessiblePointer() {
  throw new TypeError(`Pointers within an untagged union are not accessible`);
}

function throwInvalidPointerTarget(structure, arg) {
  const name = getShortName(structure);
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

function throwNotNull(member) {
  const { name } = member;
  throw new RangeError(`Property ${name} can only be null`);
}

function throwZigError(name) {
  throw new Error(decamelizeErrorName(name));
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

function getDataViewBoolAccessor(access, member) {
  return cacheMethod(access, member, () => {
    const { byteSize } = member;
    if (byteSize === undefined) {
      return undefined;
    }
    const typeName = getTypeName({ type: MemberType.Int, bitSize: byteSize * 8 });
    if (access === 'get') {
      const get = DataView.prototype[`get${typeName}`];
      return function(offset, littleEndian) {
        return !!get.call(this, offset, littleEndian);
      };
    } else {
      const set = DataView.prototype[`set${typeName}`];
      const T = (byteSize > 4) ? 1n : 1;
      const F = (byteSize > 4) ? 0n : 0;
      return function(offset, value, littleEndian) {
        set.call(this, offset, value ? T : F, littleEndian);
      };
    }
  });
}

function getDataViewBoolAccessorEx(access, member) {
  return cacheMethod(access, member, () => {
    if (isByteAligned(member)) {
      return getDataViewBoolAccessor(access, member);
    }
    const { bitOffset } = member;
    const bitPos = bitOffset & 0x07;
    const mask = 1 << bitPos;
    const get = DataView.prototype.getInt8;
    if (access === 'get') {
      return function(offset) {
        const n = get.call(this, offset);
        return !!(n & mask);
      };
    } else {
      const set = DataView.prototype.setInt8;
      return function(offset, value) {
        const n = get.call(this, offset);
        const b = (value) ? n | mask : n & ~mask;
        set.call(this, offset, b);
      };
    }
  });
}

function getDataViewBuiltInAccessor(access, member) {
  return cacheMethod(access, member, (name) => {
    return DataView.prototype[name];
  });
}


function getDataViewIntAccessor(access, member) {
  return getDataViewBuiltInAccessor(access, member);
}

function getDataViewIntAccessorEx(access, member) {
  return cacheMethod(access, member, (name) => {
    if (DataView.prototype[name]) {
      return DataView.prototype[name];
    }
    if (isByteAligned(member)) {
      return defineAlignedIntAccessor(access, member)
    } else {
      return defineUnalignedIntAccessor(access, member);
    }
  });
}

function getDataViewUintAccessor(access, member) {
  return getDataViewBuiltInAccessor(access, member);
}

function getDataViewUintAccessorEx(access, member) {
  return cacheMethod(access, member, (name) => {
    if (DataView.prototype[name]) {
      return DataView.prototype[name];
    }
    if (isByteAligned(member)) {
      return defineAlignedUintAccessor(access, member)
    } else {
      return defineUnalignedUintAccessor(access, member);
    }
  });
}

function getDataViewFloatAccessor(access, member) {
  return getDataViewBuiltInAccessor(access, member);
}

function getDataViewFloatAccessorEx(access, member) {
  return cacheMethod(access, member, (name) => {
    if (DataView.prototype[name]) {
      return DataView.prototype[name];
    }
    if (isByteAligned(member)) {
      return defineAlignedFloatAccessor(access, member)
    } else {
      return defineUnalignedFloatAccessor(access, member);
    }
  });
}

function getDataView(structure, arg) {
  const { type, size, typedArray } = structure;
  let dv;
  // not using instanceof just in case we're getting objects created in other contexts
  const tag = arg?.[Symbol.toStringTag];
  if (tag === 'DataView') {
    dv = arg;
  } else if (tag === 'ArrayBuffer' || tag === 'SharedArrayBuffer') {
    dv = new DataView(arg);
  } else if (tag === 'Uint8Array' || (typedArray && tag === typedArray.name)) {
    dv = new DataView(arg.buffer, arg.byteOffset, arg.byteLength);
  } else {
    const memory = arg?.[MEMORY];
    if (memory && (type === StructureType.Array || type === StructureType.Slice || type === StructureType.Vector)) {
      const { instance: { members: [ member ] } } = structure;
      const { byteSize: elementSize, structure: { constructor: Child } } = member;
      const number = findElements(arg, Child);
      if (number !== undefined) {
        if (type === StructureType.Slice || number * elementSize === size) {
          return memory;
        } else {
          throwArrayLengthMismatch(structure, null, arg);
        }
      }
    }
  }
  if (dv) {
    checkDataViewSize(structure, dv);
  }
  return dv;
}

function checkDataViewSize(structure, dv) {
  const { type, size } = structure;
  if (type === StructureType.Slice ? dv.byteLength % size !== 0 : dv.byteLength !== size) {
    throwBufferSizeMismatch(structure, dv);
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

function requireDataView(structure, arg) {
  const dv = getDataView(structure, arg);
  if (!dv) {
    throwBufferExpected(structure);
  }
  return dv;
}

function getTypedArrayClass(structure) {
  const { type, instance: { members } } = structure;
  if (type === StructureType.Primitive) {
    const { type: memberType, byteSize } = members[0];
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
  } else if (type === StructureType.Array || type === StructureType.Slice || type === StructureType.Vector) {
    const { structure: { typedArray } } = members[0];
    return typedArray;
  }
  return null;
}

function addTypedArray(structure) {
  return structure.typedArray = getTypedArrayClass(structure);
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
    if (typedArray === Uint8Array) {
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
  const { type, bitSize, byteSize, structure } = member;
  if (structure?.name === 'usize') {
    return 'USize';
  } else if (structure?.name === 'isize') {
    return 'ISize';
  } else if (type === MemberType.Int) {
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

function getBigIntAccessors(bitSize) {
  const getWord = DataView.prototype.getBigUint64;
  const setWord = DataView.prototype.setBigUint64;
  const wordCount = Math.ceil(bitSize / 64);
  return {
    get: function(offset, littleEndian) {
      let n = 0n;
      if (littleEndian) {
        for (let i = 0, j = offset + (wordCount - 1) * 8; i < wordCount; i++, j -= 8) {
          const w = getWord.call(this, j, littleEndian);
          n = (n << 64n) | w;
        }
      } else {
        for (let i = 0, j = offset; i < wordCount; i++, j += 8) {
          const w = getWord.call(this, j, littleEndian);
          n = (n << 64n) | w;
        }
      }
      return n;
    },
    set: function(offset, value, littleEndian) {
      let n = value;
      const mask = 0xFFFFFFFFFFFFFFFFn;
      if (littleEndian) {
        for (let i = 0, j = offset; i < wordCount; i++, j += 8) {
          const w = n & mask;
          setWord.call(this, j, w, littleEndian);
          n >>= 64n;
        }
      } else {
        n <<= BigInt(wordCount * 64 - bitSize);
        for (let i = 0, j = offset + (wordCount - 1) * 8; i < wordCount; i++, j -= 8) {
          const w = n & mask;
          setWord.call(this, j, w, littleEndian);
          n >>= 64n;
        }
      }
      return n;
    },
  };
}

function defineAlignedIntAccessor(access, member) {
  const { bitSize, byteSize } = member;
  if (bitSize < 64) {
    // actual number of bits needed when stored aligned
    const typeName = getTypeName({ ...member, bitSize: byteSize * 8 });
    const get = DataView.prototype[`get${typeName}`];
    const set = DataView.prototype[`set${typeName}`];
    const signMask = (bitSize <= 32) ? 2 ** (bitSize - 1) : 2n ** BigInt(bitSize - 1);
    const valueMask = (bitSize <= 32) ? signMask - 1 : signMask - 1n;
    if (access === 'get') {
      return function(offset, littleEndian) {
        const n = get.call(this, offset, littleEndian);
        return (n & valueMask) - (n & signMask);
      };
    } else {
      return function(offset, value, littleEndian) {
        const n = (value < 0) ? signMask | (value & valueMask) : value & valueMask;
        set.call(this, offset, n, littleEndian);
      };
    }
  } else {
    // larger than 64 bits
    const { get, set } = getBigIntAccessors(bitSize);
    const signMask = 2n ** BigInt(bitSize - 1);
    const valueMask = signMask - 1n;
    if (access === 'get') {
      return function(offset, littleEndian) {
        const n = get.call(this, offset, littleEndian);
        return (n & valueMask) - (n & signMask);
      };
    } else {
      return function(offset, value, littleEndian) {
        const n = (value < 0) ? signMask | (value & valueMask) : value & valueMask;
        set.call(this, offset, n, littleEndian);
      };
    }
  }
}

function defineAlignedUintAccessor(access, member) {
  const { bitSize, byteSize } = member;
  if (bitSize < 64) {
    // actual number of bits needed when stored aligned
    const typeName = getTypeName({ ...member, bitSize: byteSize * 8 });
    const get = DataView.prototype[`get${typeName}`];
    const set = DataView.prototype[`set${typeName}`];
    const valueMask = (bitSize <= 32) ? (2 ** bitSize) - 1 : (2n ** BigInt(bitSize)) - 1n;
    if (access === 'get') {
      return function(offset, littleEndian) {
        const n = get.call(this, offset, littleEndian);
        return n & valueMask;
      };
    } else {
      return function(offset, value, littleEndian) {
        const n = value & valueMask;
        set.call(this, offset, n, littleEndian);
      };
    }
  } else {
    // larger than 64 bits
    const { get, set } = getBigIntAccessors(bitSize);
    const valueMask = (2n ** BigInt(bitSize)) - 1n;
    if (access === 'get') {
      return function(offset, littleEndian) {
        const n = get.call(this, offset, littleEndian);
        return n & valueMask;
      };
    } else {
      return function(offset, value, littleEndian) {
        const n = value & valueMask;
        set.call(this, offset, n, littleEndian);
      };
    }
  }
}

function defineUnalignedIntAccessor(access, member) {
  const { bitSize, bitOffset } = member;
  const bitPos = bitOffset & 0x07;
  if (bitPos + bitSize <= 8) {
    const set = DataView.prototype.setUint8;
    const get = DataView.prototype.getUint8;
    // sub-8-bit numbers have real use cases
    const signMask = 2 ** (bitSize - 1);
    const valueMask = signMask - 1;
    if (access === 'get') {
      return function(offset) {
        const n = get.call(this, offset);
        const s = n >>> bitPos;
        return (s & valueMask) - (s & signMask);
      };
    } else {
      const outsideMask = 0xFF ^ ((valueMask | signMask) << bitPos);
      return function(offset, value) {
        let b = get.call(this, offset);
        const n = (value < 0) ? signMask | (value & valueMask) : value & valueMask;
        b = (b & outsideMask) | (n << bitPos);
        set.call(this, offset, b);
      };
    }
  }
  return defineUnalignedAccessorUsing(access, member, getDataViewIntAccessorEx);
}

function defineUnalignedUintAccessor(access, member) {
  const { bitSize, bitOffset } = member;
  const bitPos = bitOffset & 0x07;
  if (bitPos + bitSize <= 8) {
    const set = DataView.prototype.setUint8;
    const get = DataView.prototype.getUint8;
    const valueMask = (2 ** bitSize - 1);
    if (access === 'get') {
      return function(offset) {
        const n = get.call(this, offset);
        const s = n >>> bitPos;
        return s & valueMask;
      };
    } else {
      const outsideMask = 0xFF ^ (valueMask << bitPos);
      return function(offset, value) {
        const n = get.call(this, offset);
        const b = (n & outsideMask) | ((value & valueMask) << bitPos);
        set.call(this, offset, b);
      };
    }
  }
  return defineUnalignedAccessorUsing(access, member, getDataViewUintAccessorEx);
}

function defineAlignedFloatAccessor(access, member) {
  const { bitSize } = member;
  if (bitSize === 16) {
    const buf = new DataView(new ArrayBuffer(4));
    const set = DataView.prototype.setUint16;
    const get = DataView.prototype.getUint16;
    if (access === 'get') {
      return function(offset, littleEndian) {
        const n = get.call(this, offset, littleEndian);
        const sign = n >>> 15;
        const exp = (n & 0x7C00) >> 10;
        const frac = n & 0x03FF;
        if (exp === 0) {
          return (sign) ? -0 : 0;
        } else if (exp === 0x1F) {
          if (!frac) {
            return (sign) ? -Infinity : Infinity;
          } else {
            return NaN;
          }
        }
        const n32 = (sign << 31) | ((exp - 15 + 127) << 23) | (frac << 13);
        buf.setUint32(0, n32, littleEndian);
        return buf.getFloat32(0, littleEndian);
      }
    } else {
      return function(offset, value, littleEndian) {
        buf.setFloat32(0, value, littleEndian);
        const n = buf.getUint32(0, littleEndian);
        const sign = n >>> 31;
        const exp = (n & 0x7F800000) >> 23;
        const frac = n & 0x007FFFFF;
        const exp16 = (exp - 127 + 15);
        let n16;
        if (exp === 0) {
          n16 = sign << 15;
        } else if (exp === 0xFF) {
          n16 = sign << 15 | 0x1F << 10 | (frac ? 1 : 0);
        } else if (exp16 >= 31) {
          n16 = sign << 15 | 0x1F << 10;
        } else {
          n16 = sign << 15 | exp16 << 10 | (frac >> 13);
        }
        set.call(this, offset, n16, littleEndian);
      }
    }
  } else if (bitSize === 80) {
    const buf = new DataView(new ArrayBuffer(8));
    const setWord = DataView.prototype.setBigUint64;
    const getWord = DataView.prototype.getBigUint64;
    const get = function(offset, littleEndian) {
      const w1 = getWord.call(this, offset, littleEndian);
      const w2 = getWord.call(this, offset + 8, littleEndian);
      return (littleEndian) ? w1 | w2 << 64n : w1 << 64n | w2;
    };
    const set = function(offset, value, littleEndian) {
      const w1 = value & 0xFFFFFFFFFFFFFFFFn;
      const w2 = value >> 64n;
      setWord.call(this, offset + (littleEndian ? 0 : 8), w1, littleEndian);
      setWord.call(this, offset + (littleEndian ? 8 : 0), w2, littleEndian);
    };
    if (access === 'get') {
      return function(offset, littleEndian) {
        const n = get.call(this, offset, littleEndian);
        const sign = n >> 79n;
        const exp = (n & 0x7FFF0000000000000000n) >> 64n;
        const frac = n & 0x00007FFFFFFFFFFFFFFFn;
        if (exp === 0n) {
          return (sign) ? -0 : 0;
        } else if (exp === 0x7FFFn) {
          if (!frac) {
            return (sign) ? -Infinity : Infinity;
          } else {
            return NaN;
          }
        }
        const exp64 = exp - 16383n + 1023n;
        if (exp64 >= 2047n) {
          return (sign) ? -Infinity : Infinity;
        }
        const n64 = (sign << 63n) | (exp64 << 52n) | (frac >> 11n);
        buf.setBigUint64(0, n64, littleEndian);
        return buf.getFloat64(0, littleEndian);
      }
    } else {
      return function(offset, value, littleEndian) {
        buf.setFloat64(0, value, littleEndian);
        const n = buf.getBigUint64(0, littleEndian);
        const sign = n >> 63n;
        const exp = (n & 0x7FF0000000000000n) >> 52n;
        const frac = n & 0x000FFFFFFFFFFFFFn;
        let n80;
        if (exp === 0n) {
          n80 = sign << 79n | (frac << 11n);
        } else if (exp === 0x07FFn) {
          n80 = sign << 79n | 0x7FFFn << 64n | (frac ? 0x00002000000000000000n : 0n) | 0x00008000000000000000n;
          //                                                 ^ bit 61                       ^ bit 63
        } else {
          n80 = sign << 79n | (exp - 1023n + 16383n) << 64n | (frac << 11n) | 0x00008000000000000000n;
        }
        set.call(this, offset, n80, littleEndian);
      }
    }
  } else if (bitSize === 128) {
    const buf = new DataView(new ArrayBuffer(8));
    const getWord = DataView.prototype.getBigUint64;
    const setWord = DataView.prototype.setBigUint64;
    const get = function(offset, littleEndian) {
      const w1 = getWord.call(this, offset, littleEndian);
      const w2 = getWord.call(this, offset + 8, littleEndian);
      return (littleEndian) ? w1 | w2 << 64n : w1 << 64n | w2;
    };
    const set = function(offset, value, littleEndian) {
      const w1 = value & 0xFFFFFFFFFFFFFFFFn;
      const w2 = value >> 64n;
      setWord.call(this, offset + (littleEndian ? 0 : 8), w1, littleEndian);
      setWord.call(this, offset + (littleEndian ? 8 : 0), w2, littleEndian);
    };
    if (access === 'get') {
      return function(offset, littleEndian) {
        const n = get.call(this, offset, littleEndian);
        const sign = n >> 127n;
        const exp = (n & 0x7FFF0000000000000000000000000000n) >> 112n;
        const frac = n & 0x0000FFFFFFFFFFFFFFFFFFFFFFFFFFFFn;
        if (exp === 0n) {
          return (sign) ? -0 : 0;
        } else if (exp === 0x7FFFn) {
          if (!frac) {
            return (sign) ? -Infinity : Infinity;
          } else {
            return NaN;
          }
        }
        const exp64 = exp - 16383n + 1023n;
        if (exp64 >= 2047n) {
          return (sign) ? -Infinity : Infinity;
        }
        const n64 = (sign << 63n) | (exp64 << 52n) | (frac >> 60n);
        buf.setBigUint64(0, n64, littleEndian);
        return buf.getFloat64(0, littleEndian);
      }
    } else {
      return function(offset, value, littleEndian) {
        buf.setFloat64(0, value, littleEndian);
        const n = buf.getBigUint64(0, littleEndian);
        const sign = n >> 63n;
        const exp = (n & 0x7FF0000000000000n) >> 52n;
        const frac = n & 0x000FFFFFFFFFFFFFn;
        let n128;
        if (exp === 0n) {
          n128 = sign << 127n | (frac << 60n);
        } else if (exp === 0x07FFn) {
          n128 = sign << 127n | 0x7FFFn << 112n | (frac ? 1n : 0n);
        } else {
          n128 = sign << 127n | (exp - 1023n + 16383n) << 112n | (frac << 60n);
        }
        set.call(this, offset, n128, littleEndian);
      }
    }
  }
}

function defineUnalignedFloatAccessor(access, member) {
  return defineUnalignedAccessorUsing(access, member, getDataViewFloatAccessorEx);
}

function defineUnalignedAccessorUsing(access, member, getDataViewAccessor) {
  // pathological usage scenario--handle it anyway by copying the bitSize into a
  // temporary buffer, bit-aligning the data
  const { bitSize, bitOffset } = member;
  const bitPos = bitOffset & 0x07;
  const byteSize = [ 1, 2, 4, 8 ].find(b => b * 8 >= bitSize) ?? Math.ceil(bitSize / 64) * 64;
  const buf = new DataView(new ArrayBuffer(byteSize));
  if (access === 'get') {
    const getAligned = getDataViewAccessor('get', { ...member, byteSize });
    const copyBits = getBitAlignFunction(bitPos, bitSize, true);
    return function(offset, littleEndian) {
      copyBits(buf, this, offset);
      return getAligned.call(buf, 0, littleEndian);
    };
  } else {
    const setAligned = getDataViewAccessor('set', { ...member, byteSize });
    const applyBits = getBitAlignFunction(bitPos, bitSize, false);
    return function(offset, value, littleEndian) {
      setAligned.call(buf, 0, value, littleEndian);
      applyBits(this, buf, offset);
    };
  }
}

function cacheMethod(access, member, cb) {
  const { type, bitOffset, bitSize } = member;
  const bitPos = bitOffset & 0x07;
  const typeName = getTypeName(member);
  const suffix = isByteAligned(member) ? `` : `Bit${bitPos}`;
  const name = `${access}${typeName}${suffix}`;
  let fn = methodCache[name];
  if (!fn) {
    // usize and isize can return/accept number or bigint
    if ((type === MemberType.Int && typeName === 'ISize')
     || (type === MemberType.Uint && typeName === 'USize')) {
      if (bitSize === 64) {
        const realTypeName = (type === MemberType.Int) ? 'BigInt64' : 'BigUint64';
        const realName = `${access}${realTypeName}`;
        if (access === 'get') {
          const get = cb(realName);
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
          const set = cb(realName);
          fn = function(offset, value, littleEndian) {
            // automatically convert number to bigint
            if (typeof(value) === 'number') {
              value = BigInt(value);
            }
            set.call(this, offset, value, littleEndian);
          };
        }
      } else if (bitSize === 32) {
        const realTypeName = (type === MemberType.Int) ? 'Int32' : 'Uint32';
        const realName = `${access}${realTypeName}`;
        if (access === 'get') {
          fn = cb(realName);
        } else {
          const set = cb(realName);
          fn = function(offset, value, littleEndian) {
            if (typeof(value) === 'bigint') {
              value = Number(value);
            }
            set.call(this, offset, value, littleEndian);
          };
        }
      }
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

const methodCache = {};

const MemberType = {
  Void: 0,
  Bool: 1,
  Int: 2,
  Uint: 3,
  Float: 4,
  EnumerationItem: 5,
  Object: 6,
  Type: 7,
  Comptime: 8,
};

const factories$1 = Array(Object.values(MemberType).length);

function useVoid() {
  factories$1[MemberType.Void] = getVoidAccessor;
}

function useBool() {
  factories$1[MemberType.Bool] = getBoolAccessor;
}

function useBoolEx() {
  factories$1[MemberType.Bool] = getBoolAccessorEx;
}

function useInt() {
  factories$1[MemberType.Int] = getIntAccessor;
}

function useIntEx() {
  factories$1[MemberType.Int] = getIntAccessorEx;
}

function useFloat() {
  factories$1[MemberType.Float] = getFloatAccessor;
}

function useFloatEx() {
  factories$1[MemberType.Float] = getFloatAccessorEx;
}

function useEnumerationItem() {
  factories$1[MemberType.EnumerationItem] = getEnumerationItemAccessor;
}

function useEnumerationItemEx() {
  factories$1[MemberType.EnumerationItem] = getEnumerationItemAccessorEx;
}

function useObject() {
  factories$1[MemberType.Object] = getObjectAccessor;
}

function useType() {
  factories$1[MemberType.Type] = getTypeAccessor;
}

function isByteAligned({ bitOffset, bitSize, byteSize }) {
  return byteSize !== undefined || (!(bitOffset & 0x07) && !(bitSize & 0x07)) || bitSize === 0;
}

function getAccessors(member, options = {}) {
  const f = factories$1[member.type];
  return {
    get: f('get', member, options),
    set: f('set', member, options)
  };
}

function getVoidAccessor(type, member, options) {
  const { runtimeSafety } = options;
  if (type === 'get') {
    return function() {
      return null;
    };
  } else {
    if (runtimeSafety) {
      return function(value) {
        if (value != null) {
          throwNotNull(member);
        }
      };
      } else {
      return function() {};
    }
  }
}

function getBoolAccessor(access, member, options) {
  return getAccessorUsing(access, member, options, getDataViewBoolAccessor)
}

function getBoolAccessorEx(access, member, options) {
  return getAccessorUsing(access, member, options, getDataViewBoolAccessorEx)
}

function getIntAccessor(access, member, options) {
  const getDataViewAccessor = addRuntimeCheck(options, getDataViewIntAccessor);
  return getAccessorUsing(access, member, options, getDataViewAccessor)
}

function getIntAccessorEx(access, member, options) {
  const getDataViewAccessor = addRuntimeCheck(options, getDataViewIntAccessorEx);
  return getAccessorUsing(access, member, options, getDataViewAccessor)
}

function addRuntimeCheck(options, getDataViewAccessor) {
  return function (access, member) {
    const {
      runtimeSafety = true,
    } = options;
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

function getFloatAccessor(access, member, options) {
  return getAccessorUsing(access, member, options, getDataViewFloatAccessor)
}

function getFloatAccessorEx(access, member, options) {
  return getAccessorUsing(access, member, options, getDataViewFloatAccessorEx)
}

function getEnumerationItemAccessor(access, member, options) {
  const getDataViewAccessor = addEnumerationLookup(getDataViewUintAccessor);
  return getAccessorUsing(access, member, options, getDataViewAccessor) ;
}

function getEnumerationItemAccessorEx(access, member, options) {
  const getDataViewAccessor = addEnumerationLookup(getDataViewUintAccessorEx);
  return getAccessorUsing(access, member, options, getDataViewAccessor) ;
}

function addEnumerationLookup(getDataViewIntAccessor) {
  return function(access, member) {
    const accessor = getDataViewIntAccessor(access, { ...member, type: MemberType.Int });
    const { structure } = member;
    if (access === 'get') {
      return function(offset, littleEndian) {
        const { constructor } = structure;
        const value = accessor.call(this, offset, littleEndian);
        // the enumeration constructor returns the object for the int value
        const object = constructor(value);
        if (!object) {
          throwInvalidEnum(structure, value);
        }
        return object;
      };
    } else {
      return function(offset, value, littleEndian) {
        const { constructor } = structure;
        let item;
        if (value instanceof constructor) {
          item = value;
        } else {
          item = constructor(value);
        }
        if (!item) {
          throwEnumExpected(structure, value);
        }
        accessor.call(this, offset, item.valueOf(), littleEndian);
      };
    }
  };
}

function getObjectAccessor(access, member, options) {
  const { structure, slot } = member;
  let returnValue = false;
  switch (structure.type) {
    case StructureType.ErrorUnion:
    case StructureType.Optional:
      returnValue = true;
      break;
  }
  if (slot !== undefined) {
    if (access === 'get') {
      if (returnValue) {
        return function getValue() {
          const object = this[CHILD_VIVIFICATOR][slot].call(this);
          return object.$;
        };
      } else {
        return function getObject() {
          const object = this[CHILD_VIVIFICATOR][slot].call(this);
          return object;
        };
      }
    } else {
      return function setValue(value) {
        const object = this[CHILD_VIVIFICATOR][slot].call(this);
        object.$ = value;
      };
    }
  } else {
    // array accessors
    if (access === 'get') {
      if (returnValue) {
        return function getValue(index) {
          const object = this[CHILD_VIVIFICATOR](index);
          return object.$;
        };
      } else {
        return function getObject(index) {
          const object = this[CHILD_VIVIFICATOR](index);
          return object;
        };
      }
    } else {
      return function setValue(index, value) {
        const object = this[CHILD_VIVIFICATOR](index);
        object.$ = value;
      };
    }
  }
}

function getTypeAccessor(type, member, options) {
  const { structure } = member;
  if (type === 'get') {
    return function() {
      const { constructor } = structure;
      return constructor;
    };
  }
}

function getAccessorUsing(access, member, options, getDataViewAccessor) {
  const {
    littleEndian = true,
  } = options;
  const { bitOffset, byteSize } = member;
  const accessor = getDataViewAccessor(access, member);
  if (bitOffset !== undefined) {
    const offset = bitOffset >> 3;
    {
      if (access === 'get') {
        return function() {
          try {
            return accessor.call(this[MEMORY], offset, littleEndian);
          } catch (err) {
            if (err instanceof TypeError && restoreMemory.call(this)) {
              return accessor.call(this[MEMORY], offset, littleEndian);
            } else {
              throw err;
            }
          }
        };
      } else {
        return function(value) {
          try {
            return accessor.call(this[MEMORY], offset, value, littleEndian);
          } catch (err) {
            if (err instanceof TypeError && restoreMemory.call(this)) {
              return accessor.call(this[MEMORY], offset, value, littleEndian);
            } else {
              throw err;
            }
          }
        }
      }
    }
  } else {
    {
      if (access === 'get') {
        return function(index) {
          try {
            return accessor.call(this[MEMORY], index * byteSize, littleEndian);
          } catch (err) {
            if (err instanceof TypeError && restoreMemory.call(this)) {
              return accessor.call(this[MEMORY], index * byteSize, littleEndian);
            } else {
              rethrowRangeError(member, index, err);
            }
          }
        };
      } else {
        return function(index, value) {
          try {
            return accessor.call(this[MEMORY], index * byteSize, value, littleEndian);
          } catch (err) {
            if (err instanceof TypeError && restoreMemory.call(this)) {
              return accessor.call(this[MEMORY], index * byteSize, value, littleEndian);
            } else {
              rethrowRangeError(member, index, err);
            }
          }
        }
      }
    }
  }
}

function addSpecialAccessors(s) {
  const {
    constructor,
    instance: {
      members,
    },
    sentinel,
  } = s;
  Object.defineProperties(constructor.prototype, {
    dataView: { ...getDataViewAccessors(s), configurable: true },
    base64: { ...getBase64Accessors(), configurable: true },
    toJSON: { value: getValueOf, configurable: true, writable: true },
    valueOf: { value: getValueOf, configurable: true, writable: true },
  });
  if (canBeString(s)) {
    const { byteSize } = s.instance.members[0];
    Object.defineProperty(constructor.prototype, 'string', {
      ...getStringAccessors(byteSize, sentinel?.value), configurable: true
    });
  }
  if (canBeTypedArray(s)) {
    const { byteSize } = s.instance.members[0];
    Object.defineProperty(constructor.prototype, 'typedArray', {
      ...getTypedArrayAccessors(s.typedArray, byteSize), configurable: true
    });
  }
}

function canBeString(s) {
  if (s.type === StructureType.Array || s.type === StructureType.Slice) {
    const { type, bitSize } = s.instance.members[0];
    if (type === MemberType.Uint && (bitSize === 8 || bitSize === 16)) {
      return true;
    }
  }
  return false;
}

function canBeTypedArray(s) {
  return !!s.typedArray;
}

function getSpecialKeys(s) {
  const keys = [ 'dataView', 'base64' ];
  if (canBeString(s)) {
    keys.push('string');
  }
  if (canBeTypedArray(s)) {
    keys.push('typedArray');
  }
  return keys;
}

function getDataViewAccessors(structure) {
  const { type, size, sentinel } = structure;
  const copy = getMemoryCopier(size, type === StructureType.Slice);
  return {
    get() {
      restoreMemory.call(this);
      return this[MEMORY];
    },
    set(dv) {
      checkDataView(dv);
      restoreMemory.call(this);
      const dest = this[MEMORY];
      if (dest.byteLength !== dv.byteLength) {
        throwBufferSizeMismatch(structure, dv, this);
      }
      sentinel?.validateData(dv, this.length);
      copy(dest, dv);
    },
  };
}

function checkDataView(dv) {
  if (dv?.[Symbol.toStringTag] !== 'DataView') {
    throwTypeMismatch('a DataView', dv);
  }
  return dv;
}

function getBase64Accessors() {
  return {
    get() {
      const dv = this.dataView;
      const ta = new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength);
      const bstr = String.fromCharCode.apply(null, ta);
      return btoa(bstr);
    },
    set(str) {
      this.dataView = getDataViewFromBase64(str);
    }
  }
}

function getDataViewFromBase64(str) {
  if (typeof(str) !== 'string') {
    throwTypeMismatch('a string', str);
  }
  const bstr = atob(str);
  const ta = new Uint8Array(bstr.length);
  for (let i = 0; i < ta.byteLength; i++) {
    ta[i] = bstr.charCodeAt(i);
  }
  return new DataView(ta.buffer);
}

const decoders = {};

function getStringAccessors(byteSize, sentinelValue) {
  return {
    get() {
      let decoder = decoders[byteSize];
      if (!decoder) {
        decoder = decoders[byteSize] = new TextDecoder(`utf-${byteSize * 8}`);
      }
      const dv = this.dataView;
      const TypedArray = (byteSize === 1) ? Int8Array : Int16Array;
      const ta = new TypedArray(dv.buffer, dv.byteOffset, dv.byteLength / byteSize);
      const s = decoder.decode(ta);
      return (sentinelValue === undefined) ? s : s.slice(0, -1);
    },
    set(src) {
      this.dataView = getDataViewFromUTF8(src, byteSize, sentinelValue);
    },
  };
}

let encoder;

function getDataViewFromUTF8(str, byteSize, sentinelValue) {
  if (typeof(str) !== 'string') {
    throwTypeMismatch('a string', str);
  }
  if (sentinelValue !== undefined) {
    if (str.charCodeAt(str.length - 1) !== sentinelValue) {
      str = str + String.fromCharCode(sentinelValue);
    }
  }
  let ta;
  if (byteSize === 1) {
    if (!encoder) {
      encoder = new TextEncoder(`utf-${byteSize * 8}`);
    }
    ta = encoder.encode(str);
  } else if (byteSize === 2) {
    const { length } = str;
    ta = new Uint16Array(length);
    for (let i = 0; i < length; i++) {
      ta[i] = str.charCodeAt(i);
    }
  }
  return new DataView(ta.buffer);
}

function getTypedArrayAccessors(TypedArray, byteSize) {
  return {
    get() {
      const dv = this.dataView;
      return new TypedArray(dv.buffer, dv.byteOffset, dv.byteLength / byteSize);
    },
    set(ta) {
      this.dataView = getDataViewFromTypedArray(ta, TypedArray);
    },
  };
}

function getDataViewFromTypedArray(ta, TypedArray) {
  if (!isTypedArray(ta, TypedArray)) {
    throwTypeMismatch(TypedArray.name, ta);
  }
  return new DataView(ta.buffer, ta.byteOffset, ta.byteLength);}

function getValueOf() {
  const map = new WeakMap();
  function extract(object) {
    if (object[Symbol.iterator]) {
      const array = [];
      for (const element of object) {
        array.push(extract(element));
      }
      return array;
    } else if (object && typeof(object) === 'object') {
      let result = map.get(object);
      if (!result) {
        result = {};
        map.set(object, result);
        for (const [ name, child ] of Object.entries(object)) {
          result[name] = extract(child);
        }
        return result;
      }
      return result;
    } else {
      return object;
    }
  }  return extract(this.$);
}

function finalizePrimitive(s) {
  const {
    size,
    instance: {
      members: [ member ],
    },
    options,
  } = s;
  addTypedArray(s);
  const constructor = s.constructor = function(arg) {
    const creating = this instanceof constructor;
    let self, dv;
    if (creating) {
      if (arguments.length === 0) {
        throwNoInitializer(s);
      }
      self = this;
      dv = new DataView(new ArrayBuffer(size));
    } else {
      self = Object.create(constructor.prototype);
      dv = requireDataView(s, arg);
    }
    self[MEMORY] = dv;
    if (creating) {
      initializer.call(self, arg);
    } else {
      return self;
    }
  };
  const copy = getMemoryCopier(size);
  const specialKeys = getSpecialKeys(s);
  const initializer = function(arg) {
    if (arg instanceof constructor) {
      restoreMemory.call(this);
      restoreMemory.call(arg);
      copy(this[MEMORY], arg[MEMORY]);
    } else {
      if (arg && typeof(arg) === 'object') {
        const keys = Object.keys(arg);
        for (const key of keys) {
          if (!specialKeys.includes(key)) {
            throwNoProperty$1(s, key);
          }
        }
        if (!keys.some(k => specialKeys.includes(k))) {
          const type = getPrimitiveType(member);
          throwInvalidInitializer(s, type, arg);
        }
        for (const key of keys) {
          this[key] = arg[key];
        }
      } else if (arg !== undefined) {
        this.$ = arg;
      }
    }
  };
  const { get, set } = getAccessors(member, options);
  Object.defineProperties(constructor.prototype, {
    $: { get, set, configurable: true },
    [Symbol.toPrimitive]: { value: get, configurable: true, writable: true },
  });
  Object.defineProperty(constructor, COMPAT, { value: getCompatibleTags(s) });
  addSpecialAccessors(s);
  return constructor;
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

function finalizePointer(s) {
  const {
    size,
    instance: {
      members: [ member ],
    },
    isConst,
    options,
  } = s;
  const {
    runtimeSafety = true,
  } = options;
  const { structure: targetStructure } = member;
  const isTargetSlice = (targetStructure.type === StructureType.Slice);
  const isTargetPointer = (targetStructure.type === StructureType.Pointer);
  const addressSize = (isTargetSlice) ? size / 2 : size;
  const usizeStructure = { name: 'usize', size: addressSize };
  const setAddress = getAccessors({
    type: MemberType.Uint,
    bitOffset: 0,
    bitSize: addressSize * 8,
    byteSize: addressSize,
    structure: usizeStructure,
  }, options).set;
  const setLength = (isTargetSlice) ? getAccessors({
    type: MemberType.Uint,
    bitOffset: addressSize * 8,
    bitSize: addressSize * 8,
    byteSize: addressSize,
    structure: usizeStructure,
  }, options).set : null;
  const constructor = s.constructor = function(arg) {
    const calledFromZig = (this === ZIG);
    const calledFromParent = (this === PARENT);
    let creating = this instanceof constructor;
    let self, dv;
    if (creating) {
      if (arguments.length === 0) {
        throwNoInitializer(s);
      }
      self = this;
      dv = new DataView(new ArrayBuffer(size));
    } else {
      self = Object.create(constructor.prototype);
      if (calledFromZig || calledFromParent) {
        dv = requireDataView(s, arg);
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
          throwNoCastingToPointer();
        }
      }
    }
    self[MEMORY] = dv;
    self[SLOTS] = { 0: null };
    self[ZIG] = calledFromZig;
    if (creating) {
      initializer.call(self, arg);
    }
    return createProxy$1.call(self, isConst, isTargetPointer);
  };
  const initializer = function(arg) {
    if (arg instanceof constructor) {
      if (inFixedMemory(this)) {
        initializer.call(this, arg[SLOTS][0]);
      } else {
        // not doing memory copying since the value stored there likely isn't valid
        copyPointer$1.call(this, arg);
      }
    } else {
      const Target = targetStructure.constructor;
      if (isPointerOf(arg, Target)) {
        if (!isConst && arg.constructor.const) {
          throwConstantConstraint(s, arg);
        }
        copyPointer$1.call(this, arg);
      } else {
        if (!(arg instanceof Target)) {
          if (isCompatible(arg, Target)) {
            // autocast to target type
            const dv = getDataView(targetStructure, arg);
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
        if (inFixedMemory(this)) {
          if (inFixedMemory(arg)) {
            const { address } = inFixedMemory(arg);
            setAddress.call(this, address);
            if (setLength) {
              setLength.call(this, arg.length);
            }
          } else {
            throwFixedMemoryTargetRequired();
          }
        }
        this[SLOTS][0] = arg;
      }
    }
  };
  // return the proxy object if one is used
  Object.defineProperties(constructor.prototype, {
    '*': { get: getTarget, set: (isConst) ? undefined : setTarget, configurable: true },
    '$': { get: getProxy, set: initializer, configurable: true, },
    'valueOf': { value: getTargetValue, configurable: true, writable: true },
    [POINTER_VISITOR]: { value: visitPointer },
  });
  Object.defineProperties(constructor, {
    child: { get: () => targetStructure.constructor },
    const: { value: isConst },
  });
  return constructor;
}

function getProxy() {
  return this[PROXY];
}

function copyPointer$1(src) {
  this[SLOTS][0] = src[SLOTS][0];
}

function resetPointer() {
  this[SLOTS][0] = null;
}

function disablePointer() {
  Object.defineProperty(this[SLOTS], 0, {
    get: throwInaccessiblePointer,
    set: throwInaccessiblePointer,
    configurable: true
  });
}

function getTarget() {
  const object = this[SLOTS][0];
  return object.$;
}

function setTarget(value) {
  const object = this[SLOTS][0];
  object.$ = value;
}

function getTargetValue() {
  const object = this[SLOTS][0];
  return object.$.valueOf();
}

function visitPointer(_, src, fn) {
  fn.call(this, src);
}

function isPointerOf(arg, Target) {
  return (arg?.constructor?.child === Target && arg['*']);
}

function inFixedMemory(arg) {
  {
    return arg?.[MEMORY]?.[MEMORY];
  }
}

function createProxy$1(isConst, isTargetPointer) {
  const handlers = (!isTargetPointer) ? (isConst) ? constProxyHandlers : proxyHandlers$1 : {};
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
  [ZIG]: true,
  [SLOTS]: true,
  [MEMORY]: true,
  [PROXY]: true,
  [POINTER_VISITOR]: true,
  [Symbol.toStringTag]: true,
  [Symbol.toPrimitive]: true,
};

const proxyHandlers$1 = {
  get(pointer, name) {
    if (isPointerKeys[name]) {
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
    return isPointerKeys[name] || name in pointer[SLOTS][0];
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
  ...proxyHandlers$1,
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

function finalizeArray(s) {
  const {
    size,
    instance: {
      members: [ member ],
    },
    hasPointer,
    options,
  } = s;
  addTypedArray(s);
  const hasObject = (member.type === MemberType.Object);
  const constructor = s.constructor = function(arg) {
    const creating = this instanceof constructor;
    let self, dv;
    if (creating) {
      if (arguments.length === 0) {
        throwNoInitializer(s);
      }
      self = this;
      dv = new DataView(new ArrayBuffer(size));
    } else {
      self = Object.create(constructor.prototype);
      dv = requireDataView(s, arg);
    }
    self[MEMORY] = dv;
    self[GETTER] = null;
    self[SETTER] = null;
    if (hasObject) {
      self[SLOTS] = {};
    }
    if (creating) {
      initializer.call(self, arg);
    }
    return createProxy.call(self);
  };
  const { byteSize: elementSize, structure: elementStructure } = member;
  const length = size / elementSize;
  const copy = getMemoryCopier(size);
  const specialKeys = getSpecialKeys(s);
  const initializer = function(arg) {
    if (arg instanceof constructor) {
      restoreMemory.call(this);
      restoreMemory.call(arg);
      copy(this[MEMORY], arg[MEMORY]);
      if (hasPointer) {
        this[POINTER_VISITOR](true, arg, copyPointer$1);
      }
    } else {
      if (typeof(arg) === 'string' && specialKeys.includes('string')) {
        arg = { string: arg };
      }
      if (arg?.[Symbol.iterator]) {
        let argLen = arg.length;
        if (typeof(argLen) !== 'number') {
          arg = [ ...arg ];
          argLen = arg.length;
        }
        if (argLen !== length) {
          throwArrayLengthMismatch(s, this, arg);
        }
        let i = 0;
        for (const value of arg) {
          set.call(this, i++, value);
        }
      } else if (arg && typeof(arg) === 'object') {
        const keys = Object.keys(arg);
        for (const key of keys) {
          if (!specialKeys.includes(key)) {
            throwNoProperty(s, key);
          }
        }
        if (!keys.some(k => specialKeys.includes(k))) {
          throwInvalidArrayInitializer(s, arg);
        }
        for (const key of keys) {
          this[key] = arg[key];
        }
      } else if (arg !== undefined) {
        throwInvalidArrayInitializer(s, arg);
      }
    }
  };
  const { get, set } = getAccessors(member, options);
  Object.defineProperties(constructor.prototype, {
    get: { value: get, configurable: true, writable: true },
    set: { value: set, configurable: true, writable: true },
    length: { value: length, configurable: true },
    $: { get: getProxy, set: initializer, configurable: true },
    [Symbol.iterator]: { value: getArrayIterator, configurable: true, writable: true },
    entries: { value: createArrayEntries, configurable: true, writable: true }
  });
  Object.defineProperties(constructor, {
    child: { get: () => elementStructure.constructor },
    [COMPAT]: { value: getCompatibleTags(s) },
  });
  if (hasObject) {
    addChildVivificator(s);
    if (hasPointer) {
      addPointerVisitor$1(s);
    }
  }
  addSpecialAccessors(s);
  return constructor;
}

function addChildVivificator(s) {
  const { constructor: { prototype }, instance: { members: [ member ]} } = s;
  const { byteSize, structure } = member;
  const vivificator = function getChild(index) {
    let object = this[SLOTS][index];
    if (!object) {
      const { constructor } = structure;
      const dv = this[MEMORY];
      const parentOffset = dv.byteOffset;
      const offset = parentOffset + byteSize * index;
      const childDV = new DataView(dv.buffer, offset, byteSize);
      object = this[SLOTS][index] = constructor.call(PARENT, childDV);
    }
    return object;
  };
  Object.defineProperty(prototype, CHILD_VIVIFICATOR, { value: vivificator });
}

function addPointerVisitor$1(s) {
  const { constructor: { prototype } } = s;
  const visitor = function visitPointers(vivificating, src, fn) {
    for (let i = 0, len = this.length; i < len; i++) {
      let srcChild;
      if (src) {
        srcChild = src[SLOTS][i];
        if (!srcChild) {
          continue;
        }
      }
      const child = (vivificating) ? this[CHILD_VIVIFICATOR](i) : this[SLOTS][i];
      if (child) {
        child[POINTER_VISITOR](vivificating, srcChild, fn);
      }
    }
  };
  Object.defineProperty(prototype, POINTER_VISITOR, { value: visitor });
}

function getArrayIterator() {
  const self = this;
  const length = this.length;
  let index = 0;
  return {
    next() {
      let value, done;
      if (index < length) {
        value = self.get(index);
        done = false;
        index++;
      } else {
        done = true;
      }
      return { value, done };
    },
  };
}

function getArrayEntriesIterator() {
  const self = this;
  const length = this.length;
  let index = 0;
  return {
    next() {
      let value, done;
      if (index < length) {
        value = [ index, self.get(index) ];
        done = false;
        index++;
      } else {
        done = true;
      }
      return { value, done };
    },
  };
}

function createArrayEntries() {
  return {
    [Symbol.iterator]: getArrayEntriesIterator.bind(this),
    length: this.length,
  };
}

function createProxy() {
  const proxy = new Proxy(this, proxyHandlers);
  // hide the proxy so console wouldn't display a recursive structure
  Object.defineProperty(this, PROXY, { value: proxy });
  return proxy;
}

const proxyHandlers = {
  get(array, name) {
    const index = (typeof(name) === 'symbol') ? 0 : name|0;
    if (index !== 0 || index == name) {
      return array.get(index);
    } else {
      switch (name) {
        case 'get':
          if (!array[GETTER]) {
            array[GETTER] = array.get.bind(array);
          }
          return array[GETTER];
        case 'set':
          if (!array[SETTER]) {
            array[SETTER] = array.set.bind(array);
          }
          return array[SETTER];
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
          array[GETTER] = value;
          break;
        case 'set':
          array[SETTER] = value;
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
          delete array[GETTER];
          break;
        case 'set':
          delete array[SETTER];
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

function addStaticMembers(s) {
  const {
    constructor,
    static: {
      members,
      template,
    },
    options,
  } = s;
  const vivificators = {};
  for (const member of members) {
    // static members are either Pointer or Type
    let { get, set } = getAccessors(member, options);
    const { type, slot, structure: { isConst } } = member;
    if (type === MemberType.Object) {
      const getPtr = get;
      get = function() {
        // dereference pointer
        const ptr = getPtr.call(this);
        return ptr['*'];
      };
      set = (isConst) ? undefined : function(value) {
        const ptr = getPtr.call(this);
        ptr['*'] = value;
      };
      vivificators[slot] = () => template[SLOTS][slot];
    }
    Object.defineProperty(constructor, member.name, { get, set, configurable: true, enumerable: true });
  }
  Object.defineProperty(constructor, CHILD_VIVIFICATOR, { value: vivificators });
}

function addMethods(s) {
  const {
    constructor,
    instance: { methods: instanceMembers },
    static: { methods: staticMethods },
  } = s;
  for (const method of staticMethods) {
    const {
      name,
      argStruct,
      thunk,
    } = method;
    const f = function(...args) {
      const { constructor } = argStruct;
      const a = new constructor(args);
      return invokeThunk(thunk, a);
    };
    Object.defineProperty(f, 'name', { value: name, writable: false });
    Object.defineProperty(constructor, name, { value: f, configurable: true, writable: true });
  }
  for (const method of instanceMembers) {
    const {
      name,
      argStruct,
      thunk,
    } = method;
    const f = function(...args) {
      const { constructor } = argStruct;
      const a = new constructor([ this, ...args ]);
      return invokeThunk(thunk, a);
    };
    Object.defineProperty(f, 'name', { value: name, writable: false });
    Object.defineProperty(Object.prototype, name, { value: f, configurable: true, writable: true });
  }
}

function invokeThunk(thunk, args) {
  {
    const res = thunk(args);
    if (res !== undefined) {
      if (res instanceof Promise) {
        // a promise of the function having been linked and called
        return res.then(() => args.retval);
      } else {
        throwZigError(res);
      }
    }
    /* c8 ignore next 3 */
  }
  return args.retval;
}

function finalizeStruct(s) {
  const {
    size,
    instance: {
      members,
      template,
    },
    hasPointer,
    options,
  } = s;
  const descriptors = {};
  for (const member of members) {
    if (member.type === MemberType.Comptime) {
      // extract value of comptime field from template
      const { slot } = member;
      const pointer = template[SLOTS][slot];
      const value = pointer['*'];
      descriptors[member.name] = { value, configurable: true, enumerable: true };
      delete template[SLOTS][slot];
    } else {
      const { get, set } = getAccessors(member, options);
      descriptors[member.name] = { get, set, configurable: true, enumerable: true };
    }
  }
  const constructible = (members.length > 0);
  const hasObject = !!members.find(m => m.type === MemberType.Object);
  const constructor = s.constructor = (constructible) ? function(arg) {
    const creating = this instanceof constructor;
    let self, dv;
    if (creating) {
      if (arguments.length === 0) {
        throwNoInitializer(s);
      }
      self = this;
      dv = new DataView(new ArrayBuffer(size));
    } else {
      self = Object.create(constructor.prototype);
      dv = getDataView(s, arg);
    }
    self[MEMORY] = dv;
    Object.defineProperties(self, descriptors);
    if (hasObject) {
      self[SLOTS] = {};
    }
    if (creating) {
      initializer.call(self, arg);
      if (arg) {
        for (const [ key, value ] of Object.entries(arg)) {
          this[key] = value;
        }
      }
    } else {
      return self;
    }
  } : Object.create(null);
  const copy = getMemoryCopier(size);
  const specialKeys = getSpecialKeys(s);
  const requiredKeys = members.filter(m => m.isRequired).map(m => m.name);
  const initializer = (constructible) ? function(arg) {
    if (arg instanceof constructor) {
      restoreMemory.call(this);
      restoreMemory.call(arg);
      copy(this[MEMORY], arg[MEMORY]);
      if (hasPointer) {
        this[POINTER_VISITOR](true, template, copyPointer$1);
      }
    } else {
      if (arg && typeof(arg) === 'object') {
        const keys = Object.keys(arg);
        let found = 0;
        let requiredFound = 0;
        let specialInit = false;
        for (const key of keys) {
          if (descriptors.hasOwnProperty(key)) {
            found++;
            if (requiredKeys.includes(key)) {
              requiredFound++;
            }
          } else if (specialKeys.includes(key)) {
            specialInit = true;
          } else {
            throwNoProperty$1(s, key);
          }
        }
        if (!specialInit && requiredFound < requiredKeys.length) {
          throwMissingInitializers(s, arg);
        }
        // apply default values unless all properties are initialized
        if (template && !specialInit && found < members.length) {
          copy(this[MEMORY], template[MEMORY]);
          if (hasPointer) {
            this[POINTER_VISITOR](true, template, copyPointer$1);
          }
        }
        for (const key of keys) {
          this[key] = arg[key];
        }
      } else if (arg !== undefined) {
        throwInvalidInitializer(s, 'object', arg);
      }
    }
  } : null;
  if (constructible) {
    Object.defineProperty(constructor.prototype, '$', { get: getSelf, set: initializer, configurable: true });
    addSpecialAccessors(s);
    if (hasObject) {
      addChildVivificators(s);
      if (hasPointer) {
        addPointerVisitor(s);
      }
    }
  }
  addStaticMembers(s);
  addMethods(s);
  return constructor;
}

function getSelf() {
  return this;
}

function addChildVivificators(s) {
  const { constructor: { prototype }, instance: { members } } = s;
  const objectMembers = members.filter(m => m.type === MemberType.Object);
  const vivificators = {};
  for (const { slot, bitOffset, byteSize, structure } of objectMembers) {
    vivificators[slot] = function getChild() {
      let object = this[SLOTS][slot];
      if (!object) {
        const { constructor } = structure;
        const dv = this[MEMORY];
        const parentOffset = dv.byteOffset;
        const offset = parentOffset + (bitOffset >> 3);
        const childDV = new DataView(dv.buffer, offset, byteSize);
        object = this[SLOTS][slot] = constructor.call(PARENT, childDV);
      }
      return object;
    };
  }
  Object.defineProperty(prototype, CHILD_VIVIFICATOR, { value: vivificators });
}

function addPointerVisitor(s) {
  const { constructor: { prototype }, instance: { members } } = s;
  const pointerMembers = members.filter(m => m.structure.hasPointer);
  const visitor = function visitPointers(vivificating, src, fn) {
    for (const { slot } of pointerMembers) {
      let srcChild;
      if (src) {
        srcChild = src[SLOTS][slot];
        if (!srcChild) {
          continue;
        }
      }
      const child = (vivificating) ? this[CHILD_VIVIFICATOR][slot].call(this) : this[SLOTS][slot];
      if (child) {
        child[POINTER_VISITOR](vivificating, srcChild, fn);
      }
    }
  };
  Object.defineProperty(prototype, POINTER_VISITOR, { value: visitor });
}

function finalizeUnion(s) {
  const {
    type,
    size,
    instance: {
      members,
      template,
    },
    options,
    hasPointer,
  } = s;
  const {
    runtimeSafety = true,
  } = options;
  const descriptors = {};
  let getEnumItem;
  let valueMembers;
  const isTagged = (type === StructureType.TaggedUnion);
  const exclusion = (isTagged || (type === StructureType.BareUnion && runtimeSafety));
  if (exclusion) {
    valueMembers = members.slice(0, -1);
    const selectorMember = members[members.length - 1];
    const { get: getSelector, set: setSelector } = getAccessors(selectorMember, options);
    let getName, setName;
    if (type === StructureType.TaggedUnion) {
      const { structure: { constructor } } = selectorMember;
      getEnumItem = getSelector;
      getName = function() {
        const item = getSelector.call(this);
        return item[ENUM_NAME];
      };
      setName = function(name) {
        setSelector.call(this, constructor[name]);
      };
    } else {
      const names = valueMembers.map(m => m.name);
      getName = function() {
        const index = getSelector.call(this);
        return names[index];
      };
      setName = function(name) {
        const index = names.indexOf(name);
        setSelector.call(this, index);
      };
    }
    for (const member of valueMembers) {
      const { name, slot } = member;
      const { get: getValue, set: setValue } = getAccessors(member, options);
      const update = (isTagged) ? function(name) {
        if (this[TAG]?.name !== name) {
          this[TAG]?.clear?.();
          this[TAG] = { name };
          if (hasPointer) {
            this[TAG].clear = () => {
              const object = this[SLOTS][slot];
              object[POINTER_VISITOR](false, null, resetPointer);
            };
          }
        }
      } : null;
      const get = function() {
        const currentName = getName.call(this);
        update?.call(this, currentName);
        if (name !== currentName) {
          if (isTagged) {
            return null;
          } else {
            throwInactiveUnionProperty(s, name, currentName);
          }
        }
        return getValue.call(this);
      };
      const set = function(value) {
        const currentName = getName.call(this);
        update?.call(this, currentName);
        if (name !== currentName) {
          throwInactiveUnionProperty(s, name, currentName);
        }
        setValue.call(this, value);
      };
      const init = function(value) {
        setName.call(this, name);
        setValue.call(this, value);
        update?.call(this, name);
      };
      descriptors[member.name] = { get, set, init, update, configurable: true, enumerable: true };
    }
  } else {
    // extern union
    valueMembers = members;
    for (const member of members) {
      const { get, set } = getAccessors(member, options);
      descriptors[member.name] = { get, set, init: set, configurable: true, enumerable: true };
    }
  }
  const hasObject = !!members.find(m => m.type === MemberType.Object);
  const pointerMembers = members.filter(m => m.structure.hasPointer);
  // non-tagged union as marked as not having pointers--if there're actually
  // members with pointers, we need to disable them
  const hasInaccessiblePointer = !hasPointer && (pointerMembers.length > 0);
  const constructor = s.constructor = function(arg) {
    const creating = this instanceof constructor;
    let self, dv;
    if (creating) {
      if (arguments.length === 0) {
        throwNoInitializer(s);
      }
      self = this;
      dv = new DataView(new ArrayBuffer(size));
    } else {
      self = Object.create(constructor.prototype);
      dv = getDataView(s, arg);
    }
    self[MEMORY] = dv;
    if (isTagged) {
      // don't know the TAG property in the console, since it's not always up-to-date
      Object.defineProperties(self, TAG, { value: null, writable: true });
    }
    Object.defineProperties(self, descriptors);
    if (hasObject) {
      self[SLOTS] = {};
      if (hasInaccessiblePointer) {
        // make pointer access throw
        self[POINTER_VISITOR](true, null, disablePointer);
      }
    }
    if (creating) {
      initializer.call(self, arg);
    }
    if (isTagged) {
      return new Proxy(self, taggedProxyHandlers);
    } else {
      return (creating) ? undefined : self;
    }
  };
  const hasDefaultMember = !!valueMembers.find(m => !m.isRequired);
  const copy = getMemoryCopier(size);
  const specialKeys = getSpecialKeys(s);
  const initializer = function(arg) {
    if (arg instanceof constructor) {
      restoreMemory.call(this);
      restoreMemory.call(arg);
      copy(this[MEMORY], arg[MEMORY]);
      if (hasPointer) {
        this[POINTER_VISITOR](true, arg, copyPointer$1);
      }
    } else {
      if (arg && typeof(arg) === 'object') {
        const keys = Object.keys(arg);
        let found = 0;
        let specialInit = false;
        for (const key of keys) {
          if (descriptors.hasOwnProperty(key)) {
            found++;
          } else if (specialKeys.includes(key)) {
            specialInit = true;
          } else {
            throwNoProperty$1(s, key);
          }
        }
        if (found !== 1) {
          if (found === 0) {
            if (!specialInit && !hasDefaultMember) {
              throwMissingUnionInitializer(s, arg, exclusion);
            }
          } else {
            throwMultipleUnionInitializers(s);
          }
        }
        if (specialInit) {
          for (const key of keys) {
            this[key] = arg[keys];
          }
        } else if (found === 0) {
          if (template) {
            restoreMemory.call(this);
            copy(this[MEMORY], template[MEMORY]);
            if (hasPointer) {
              this[POINTER_VISITOR](true, template, copyPointer$1);
            }
          }
        } else {
          for (const key of keys) {
            const { init } = descriptors[key];
            init.call(this, arg[key]);
          }
        }
      } else if (arg !== undefined) {
        throwInvalidInitializer(s, 'object with a single property', arg);
      }
    }
  };
  if (isTagged) {
    // enable casting to enum
    Object.defineProperty(constructor.prototype, ENUM_ITEM, { get: getEnumItem, configurable: true });
  }
  Object.defineProperty(constructor.prototype, '$', { get: getSelf, set: initializer, configurable: true });
  if (hasObject) {
    addChildVivificators(s);
    if (hasPointer || hasInaccessiblePointer) {
      addPointerVisitor(s);
    }
  }
  addSpecialAccessors(s);
  addStaticMembers(s);
  addMethods(s);
  return constructor;
}
const taggedProxyHandlers = {
  ownKeys(union) {
    const item = union[ENUM_ITEM];
    const name = item[ENUM_NAME];
    return [ name, MEMORY ];
  },
};

function finalizeErrorUnion(s) {
  const {
    size,
    instance: { members },
    options,
    hasPointer,
  } = s;
  const hasObject = !!members.find(m => m.type === MemberType.Object);
  const constructor = s.constructor = function(arg) {
    const creating = this instanceof constructor;
    let self, dv;
    if (creating) {
      if (arguments.length === 0) {
        throwNoInitializer(s);
      }
      self = this;
      dv = new DataView(new ArrayBuffer(size));
    } else {
      self = Object.create(constructor.prototype);
      dv = requireDataView(s, arg);
    }
    self[MEMORY] = dv;
    if (hasObject) {
      self[SLOTS] = {};
    }
    if (creating) {
      initializer.call(this, arg);
    } else {
      return self;
    }
  };
  const copy = getMemoryCopier(size);
  const initializer = function(arg) {
    if (arg instanceof constructor) {
      copy(this[MEMORY], arg[MEMORY]);
      if (hasPointer) {
        if (check.call(this)) {
          this[POINTER_VISITOR](true, arg, copyPointer$1);
        }
      }
    } else {
      this.$ = arg;
    }
  };
  const { get, set, check } = getErrorUnionAccessors(members, size, options);
  Object.defineProperty(constructor.prototype, '$', { get, set, configurable: true });
  if (hasObject) {
    addChildVivificators(s);
    if (hasPointer) {
      debugger;
      addPointerVisitor(s);
    }
  }
  addSpecialAccessors(s);
  return constructor;
}

function getErrorUnionAccessors(members, size, options) {
  const { get: getValue, set: setValue } = getAccessors(members[0], options);
  const { get: getError, set: setError } = getAccessors(members[1], options);
  const { structure: errorStructure } = members[1];
  const { constructor: ErrorSet } = errorStructure;
  const reset = getMemoryResetter(size);
  return {
    get: function() {
      const errorNumber = getError.call(this);
      if (errorNumber !== 0) {
        const err = ErrorSet(errorNumber);
        if (!err) {
          throwUnknownErrorNumber(errorStructure, errorNumber);
        }
        debugger;
        this[POINTER_VISITOR]?.(false, null, resetPointer);
        throw err;
      } else {
        return getValue.call(this);
      }
    },
    set: function(value) {
      if (value instanceof Error) {
        if (!(value instanceof ErrorSet)) {
          throwNotInErrorSet(errorStructure);
        }
        reset(this[MEMORY]);
        setError.call(this, value.index);
        this[POINTER_VISITOR]?.(false, null, resetPointer);
      } else {
        setValue.call(this, value);
        setError.call(this, 0);
      }
    },
    check: function() {
      const errorNumber = getError.call(this);
      return (errorNumber === 0);
    },
  };
}

let currentErrorSets;

function finalizeErrorSet(s) {
  const {
    name,
    instance: {
      members,
    },
  } = s;
  const errors = currentErrorSets;
  const constructor = s.constructor = function(arg) {
    const creating = this instanceof constructor;
    if (creating) {
      throwNoNewError(s);
    }
    const index = Number(arg);
    return errors[index];
  };
  Object.setPrototypeOf(constructor.prototype, Error.prototype);
  const getIndex = function() { return this[ERROR_INDEX] };
  const toStringTag = function() { return 'Error' };
  Object.defineProperties(constructor.prototype, {
    // provide a way to retrieve the error index
    index: { get: getIndex, configurable: true },
    // ensure that libraries that rely on the string tag for type detection will
    // correctly identify the object as an error
    [Symbol.toStringTag]: { get: toStringTag, configurable: true },
  });
  // attach the errors to the constructor and the
  let errorIndices;
  for (const [ index, { name, slot } ] of members.entries()) {
    let error = errors[slot];
    if (error) {
      // error already exists in a previously defined set
      // see if we should make that set a subclass or superclass of this one
      if (!(error instanceof constructor)) {
        if (!errorIndices) {
          errorIndices = members.map(m => m.slot);
        }
        const otherSet = error.constructor;
        const otherErrors = Object.values(otherSet);
        if (otherErrors.every(e => errorIndices.includes(e[ERROR_INDEX]))) {
          // this set contains the all errors of the other one, so it's a superclass
          Object.setPrototypeOf(otherSet.prototype, constructor.prototype);
        } else {
          // make this set a subclass of the other
          Object.setPrototypeOf(constructor.prototype, otherSet.prototype);
          for (const otherError of otherErrors) {
            if (errorIndices.includes(otherError[ERROR_INDEX])) {
              // this set should be this error object's class
              Object.setPrototypeOf(otherError, constructor.prototype);
            }
          }
        }
      }
    } else {
      // need to create the error object--can't use the constructor since it would throw
      error = Object.create(constructor.prototype);
      const message = decamelizeErrorName(name);
      Object.defineProperties(error, {
        message: { value: message, configurable: true, enumerable: true, writable: false },
        [ERROR_INDEX]: { value: slot },
      });
      errors[slot] = error;
    }
    Object.defineProperties(constructor, {
      [name]: { value: error, configurable: true, enumerable: true, writable: true },
    });
  }
  return constructor;
}
function initializeErrorSets() {
  currentErrorSets = {};
}

function finalizeEnumeration(s) {
  const {
    instance: {
      members,
      template,
    },
    options,
  } = s;
  const Primitive = getPrimitiveClass(members[0]);
  const { get: getValue } = getAccessors(members[0], options);
  const count = members.length;
  const items = {};
  const constructor = s.constructor = function(arg) {
    const creating = this instanceof constructor;
    if (creating) {
      // the "constructor" is only used to convert a number into an enum object
      // new enum items cannot be created
      throwNoNewEnum(s);
    }
    if (typeof(arg) === 'number' || typeof(arg) === 'bigint') {
      let index = -1;
      if (isSequential) {
        // normal enums start at 0 and go up, so the value is the index
        index = Number(arg);
      } else {
        // values aren't sequential, so we need to compare values
        const given = Primitive(arg);
        for (let i = 0; i < count; i++) {
          const value = getValue.call(constructor, i);
          if (value === given) {
            index = i;
            break;
          }
        }
      }
      // return the enum object (created down below)
      return items[index];
    } else if (arg && typeof(arg) === 'object' && arg[ENUM_ITEM]) {
      // a tagged union, return the active tag
      return arg[ENUM_ITEM];
    } else if (typeof(arg)  === 'string') {
      return constructor[arg];
    } else {
      throwInvalidInitializer(s, [ 'number', 'string', 'tagged union' ], arg);
    }
  };
  // attach the numeric values to the class as its binary data
  // this allows us to reuse the array getter
  Object.defineProperties(constructor, {
    [MEMORY]: { value: template[MEMORY] },
    [ENUM_ITEMS]: { value: items },
  });
  const valueOf = function() {
    const index = this[ENUM_INDEX] ;
    return getValue.call(constructor, index);
  };
  Object.defineProperties(constructor.prototype, {
    [Symbol.toPrimitive]: { value: valueOf, configurable: true, writable: true },
    $: { get: valueOf, configurable: true },
  });
  // now that the class has the right hidden properties, getValue() will work
  // scan the array to see if the enum's numeric representation is sequential
  const isSequential = (() => {
    // try-block in the event that the enum has bigInt items
    try {
      for (let i = 0; i < count; i++) {
        if (getValue.call(constructor, i) !== i) {
          return false;
        }
      }
      return true;
      /* c8 ignore next 3 */
    } catch (err) {
      return false;
    }
  })();
  // attach the enum items to the constructor
  for (const [ index, { name } ] of members.entries()) {
    // can't use the constructor since it would throw
    const item = Object.create(constructor.prototype);
    Object.defineProperties(item, {
      [ENUM_INDEX]: { value: index },
      [ENUM_NAME]: { value: name },
    });
    Object.defineProperties(constructor, {
      [name]: { value: item, configurable: true, enumerable: true, writable: true },
    });
    items[index] = item;
  }
  addSpecialAccessors(s);
  addStaticMembers(s);
  addMethods(s);
  return constructor;
}

function finalizeOptional(s) {
  const {
    size,
    instance: { members },
    options,
    hasPointer,
  } = s;
  const hasObject = !!members.find(m => m.type === MemberType.Object);
  const constructor = s.constructor = function(arg) {
    const creating = this instanceof constructor;
    let self, dv;
    if (creating) {
      if (arguments.length === 0) {
        throwNoInitializer(s);
      }
      self = this;
      dv = new DataView(new ArrayBuffer(size));
    } else {
      self = Object.create(constructor.prototype);
      dv = requireDataView(s, arg);
    }
    self[MEMORY] = dv;
    if (hasObject) {
      self[SLOTS] = {};
    }
    if (creating) {
      initializer.call(self, arg);
    } else {
      return self;
    }
  };
  const copy = getMemoryCopier(size);
  const initializer = function(arg) {
    if (arg instanceof constructor) {
      restoreMemory.call(this);
      restoreMemory.call(arg);
      copy(this[MEMORY], arg[MEMORY]);
      if (hasPointer) {
        // don't bother copying pointers when it's empty
        if (check.call(this)) {
          this[POINTER_VISITOR](true, arg, copyPointer);
        }
      }
    } else {
      this.$ = arg;
    }
  };
  const { get, set, check } = getOptionalAccessors(members, size, options);
  Object.defineProperty(constructor.prototype, '$', { get, set, configurable: true });
  if (hasObject) {
    addChildVivificators(s);
    if (hasPointer) {
      addPointerVisitor(s);
    }
  }
  addSpecialAccessors(s);
  return constructor;
}

function getOptionalAccessors(members, size, options) {
  const { get: getValue, set: setValue } = getAccessors(members[0], options);
  const { get: getPresent, set: setPresent } = getAccessors(members[1], options);
  const reset = getMemoryResetter(size);
  return {
    get: function() {
      const present = getPresent.call(this);
      if (present) {
        return getValue.call(this);
      } else {
        debugger;
        this[POINTER_VISITOR]?.(false, null, resetPointer);
        return null;
      }
    },
    set: function(value) {
      if (value != null) {
        setPresent.call(this, true);
        setValue.call(this, value);
      } else {
        reset(this[MEMORY]);
        debugger;
        this[POINTER_VISITOR]?.(false, null, resetPointer);
      }
    },
    check: getPresent
  };
}

function finalizeSlice(s) {
  const {
    instance: {
      members: [ member ],
    },
    hasPointer,
    options,
  } = s;
  const typedArray = addTypedArray(s);
  const hasObject = (member.type === MemberType.Object);
  const { byteSize: elementSize, structure: elementStructure } = member;
  const sentinel = getSentinel(s, options);
  if (sentinel) {
    // zero-terminated strings aren't expected to be commonly used
    // so we're not putting this prop into the standard structure
    s.sentinel = sentinel;
  }
  // the slices are different from other structures due to their variable sizes
  // we only know the "shape" of an object after we've processed the initializers
  const constructor = s.constructor = function(arg) {
    const creating = this instanceof constructor;
    let self;
    if (creating) {
      if (arguments.length === 0) {
        throwNoInitializer(s);
      }
      self = this;
      initializer.call(self, arg);
    } else {
      self = Object.create(constructor.prototype);
      const dv = requireDataView(s, arg);
      shapeDefiner.call(self, dv, dv.byteLength / elementSize, this);
    }
    return createProxy.call(self);
  };
  const copy = getMemoryCopier(elementSize, true);
  const specialKeys = getSpecialKeys(s);
  const shapeDefiner = function(dv, length, recv = null) {
    if (!dv) {
      dv = new DataView(new ArrayBuffer(length * elementSize));
    }
    this[MEMORY] = dv;
    this[GETTER] = null;
    this[SETTER] = null;
    this[LENGTH] = length;
    if (hasObject) {
      this[SLOTS] = {};
    }
  };
  const shapeChecker = function(arg, length) {
    if (length !== this[LENGTH]) {
      throwArrayLengthMismatch(s, this, arg);
    }
  };
  // the initializer behave differently depending on whether it's called  by the
  // constructor or by a member setter (i.e. after object's shape has been established)
  const initializer = function(arg) {
    let shapeless = !this.hasOwnProperty(MEMORY);
    if (arg instanceof constructor) {
      if (shapeless) {
        shapeDefiner.call(this, null, arg.length);
      } else {
        shapeChecker.call(this, arg, arg.length);
      }
      restoreMemory.call(this);
      restoreMemory.call(arg);
      copy(this[MEMORY], arg[MEMORY]);
      if (hasPointer) {
        this[POINTER_VISITOR](true, arg, copyPointer$1);
      }
    } else {
      if (typeof(arg) === 'string' && specialKeys.includes('string')) {
        arg = { string: arg };
      }
      if (arg?.[Symbol.iterator]) {
        let argLen = arg.length;
        if (typeof(argLen) !== 'number') {
          arg = [ ...arg ];
          argLen = arg.length;
        }
        if (!this[MEMORY]) {
          shapeDefiner.call(this, null, argLen);
        } else {
          shapeChecker.call(this, arg, argLen);
        }
        let i = 0;
        for (const value of arg) {
          sentinel?.validateValue(value, i, argLen);
          set.call(this, i++, value);
        }
      } else if (typeof(arg) === 'number') {
        if (shapeless && arg >= 0 && isFinite(arg)) {
          shapeDefiner.call(this, null, arg);
        } else {
          throwInvalidArrayInitializer(s, arg, shapeless);
        }
      } else if (arg && typeof(arg) === 'object') {
        const keys = Object.keys(arg);
        for (const key of keys) {
          if (!specialKeys.includes(key)) {
            throwNoProperty$1(s, key);
          }
        }
        if (!keys.some(k => specialKeys.includes(k))) {
          throwInvalidArrayInitializer(s, arg);
        }
        for (const key of keys) {
          if (shapeless) {
            // can't use accessors since the object has no memory yet
            let dv, dup = true;
            switch (key) {
              case 'dataView':
                dv = arg[key];
                checkDataView(dv);
                break;
              case 'typedArray':
                dv = getDataViewFromTypedArray(arg[key], typedArray);
                break;
              case 'string':
                dv = getDataViewFromUTF8(arg[key], elementSize, sentinel?.value);
                dup = false;
                break;
              case 'base64':
                dv = getDataViewFromBase64(arg[key]);
                dup = false;
                break;
            }
            checkDataViewSize(s, dv);
            const length = dv.byteLength / elementSize;
            sentinel?.validateData(dv, length);
            if (dup) {
              shapeDefiner.call(this, null, length);
              copy(this[MEMORY], dv);
            } else {
              // reuse memory from string decoding
              shapeDefiner.call(this, dv, length);
            }
            shapeless = false;
          } else {
            this[key] = arg[key];
          }
        }
      } else if (arg !== undefined) {
        throwInvalidArrayInitializer(s, arg);
      }
    }
  };
  const { get, set } = getAccessors(member, options);
  Object.defineProperties(constructor.prototype, {
    get: { value: get, configurable: true, writable: true },
    set: { value: set, configurable: true, writable: true },
    length: { get: getLength, configurable: true },
    $: { get: getSelf, set: initializer, configurable: true },
    [Symbol.iterator]: { value: getArrayIterator, configurable: true, writable: true },
    entries: { value: createArrayEntries, configurable: true, writable: true },
  });
  Object.defineProperties(constructor, {
    child: { get: () => elementStructure.constructor },
    [COMPAT]: { value: getCompatibleTags(s) },
  });
  if (hasObject) {
    addChildVivificator(s);
    if (hasPointer) {
      addPointerVisitor$1(s);
    }
  }
  addSpecialAccessors(s);
  return constructor;
}

function getLength() {
  return this[LENGTH];
}

function getSentinel(structure, options) {
  const {
    runtimeSafety = true,
  } = options;
  const {
    instance: { members: [ member, sentinel ], template },
  } = structure;
  if (!sentinel) {
    return;
  }
  const { get: getSentinelValue } = getAccessors(sentinel, options);
  const value = getSentinelValue.call(template, 0);
  const { get } = getAccessors(member, options);
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
  const validateData = (runtimeSafety) ? function(dv, l) {
    const object = { [MEMORY]: dv };
    for (let i = 0; i < l; i++) {
      const v = get.call(object, i);
      if (v === value && i !== l - 1) {
        throwMisplacedSentinel(structure, value, i, l);
      } else if (v !== value && i === l - 1) {
        throwMissingSentinel(structure, value, l);
      }
    }
  } : function(dv, l) {
    const object = { [MEMORY]: dv };
    if (l > 0) {
      const i = l - 1;
      const v = get.call(object, i);
      if (v !== value) {
        throwMissingSentinel(structure, value, l);
      }
    }
  };
  return { value, validateValue, validateData };
}

function finalizeVector(s) {
  const {
    size,
    instance: {
      members: [ member ],
    },
    options,
  } = s;
  addTypedArray(s);
  const constructor = s.constructor = function(arg) {
    const creating = this instanceof constructor;
    let self, dv;
    if (creating) {
      if (arguments.length === 0) {
        throwNoInitializer(s);
      }
      self = this;
      dv = new DataView(new ArrayBuffer(size));
    } else {
      self = Object.create(constructor.prototype);
      dv = requireDataView(s, arg);
    }
    self[MEMORY] = dv;
    if (creating) {
      initializer.call(self, arg);
    } else {
      return self;
    }
  };
  const { byteSize: elementSize, structure: elementStructure } = member;
  const length = size / elementSize;
  const copy = getMemoryCopier(size);
  const initializer = function(arg) {
    if (arg instanceof constructor) {
      restoreMemory.call(this);
      restoreMemory.call(arg);
      copy(this[MEMORY], arg[MEMORY]);
    } else {
      if (arg?.[Symbol.iterator]) {
        let argLen = arg.length;
        if (typeof(argLen) !== 'number') {
          arg = [ ...arg ];
          argLen = arg.length;
        }
        if (argLen !== length) {
          throwArrayLengthMismatch(s, this, arg);
        }
        let i = 0;
        for (const value of arg) {
          this[i++] = value;
        }
      } else {
        throwInvalidArrayInitializer(s, arg);
      }
    }
  };
  for (let i = 0, bitOffset = 0; i < length; i++, bitOffset += elementSize * 8) {
    const { get, set } = getAccessors({ ...member, bitOffset }, options);
    Object.defineProperty(constructor.prototype, i, { get, set, configurable: true });
  }
  Object.defineProperties(constructor.prototype, {
    length: { value: length, configurable: true },
    $: { get: getSelf, set: initializer, configurable: true },
    [Symbol.iterator]: { value: getVectorIterator, configurable: true, writable: true },
    entries: { value: createVectorEntries, configurable: true, writable: true },
  });
  Object.defineProperties(constructor, {
    child: { get: () => elementStructure.constructor },
    [COMPAT]: { value: getCompatibleTags(s) },
  });
  addSpecialAccessors(s);
  return constructor;
}

function getVectorIterator() {
  const self = this;
  const length = this.length;
  let index = 0;
  return {
    next() {
      let value, done;
      if (index < length) {
        value = self[index];
        done = false;
        index++;
      } else {
        done = true;
      }
      return { value, done };
    },
  };
}

function getVectorEntriesIterator() {
  const self = this;
  const length = this.length;
  let index = 0;
  return {
    next() {
      let value, done;
      if (index < length) {
        value = [ index, self[index] ];
        done = false;
        index++;
      } else {
        done = true;
      }
      return { value, done };
    },
  };
}

function createVectorEntries() {
  return {
    [Symbol.iterator]: getVectorEntriesIterator.bind(this),
    length: this.length,
  };
}

function finalizeArgStruct(s) {
  const {
    size,
    instance: {
      members,
    },
    options,
  } = s;
  const hasObject = !!members.find(m => m.type === MemberType.Object);
  const constructor = s.constructor = function(args) {
    const dv = new DataView(new ArrayBuffer(size));
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
      throwArgumentCountMismatch(s, args.length);
    }
    for (const [ index, name ] of argNames.entries()) {
      try {
        this[name] = args[index];
      } catch (err) {
        rethrowArgumentError(s, index, err);
      }
    }
  };
  for (const member of members) {
    const accessors = getAccessors(member, options);
    Object.defineProperty(constructor.prototype, member.name, accessors);
  }
  if (hasObject) {
    addChildVivificators(s);
  }
  return constructor;
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

const factories = Array(Object.values(StructureType).length);

function usePrimitive() {
  factories[StructureType.Primitive] = finalizePrimitive;
}

function useArray() {
  factories[StructureType.Array] = finalizeArray;
}

function useStruct() {
  factories[StructureType.Struct] = finalizeStruct;
}

function useExternUnion() {
  factories[StructureType.ExternUnion] = finalizeUnion;
}

function useBareUnion() {
  factories[StructureType.BareUnion] = finalizeUnion;
}

function useTaggedUnion() {
  factories[StructureType.TaggedUnion] = finalizeUnion;
}

function useErrorUnion() {
  factories[StructureType.ErrorUnion] = finalizeErrorUnion;
}

function useErrorSet() {
  factories[StructureType.ErrorSet] = finalizeErrorSet;
}

function useEnumeration() {
  factories[StructureType.Enumeration] = finalizeEnumeration;
}

function useOptional() {
  factories[StructureType.Optional] = finalizeOptional;
}

function usePointer() {
  factories[StructureType.Pointer] = finalizePointer;
}

function useSlice() {
  factories[StructureType.Slice] = finalizeSlice;
}

function useVector() {
  factories[StructureType.Vector] = finalizeVector;
}

function useOpaque() {
  factories[StructureType.Opaque] = finalizeStruct;
}

function useArgStruct() {
  factories[StructureType.ArgStruct] = finalizeArgStruct;
}

function getShortName(s) {
  let r = s.name;
  r = r.replace(/\(.*\)/, '');
  r = r.replace(/{.*}/, '');
  r = r.replace(/[^. ]*?\./g, '');
  return r;
}

function finalizeStructure(s) {
  try {
    const f = factories[s.type];
    if (false) ;
    const constructor = f(s);
    if (typeof(constructor) === 'function') {
      Object.defineProperties(constructor, {
        name: { value: getShortName(s), writable: false }
      });
      if (!constructor.prototype.hasOwnProperty(Symbol.toStringTag)) {
        Object.defineProperties(constructor.prototype, {
          [Symbol.toStringTag]: { value: s.name, configurable: true, writable: false }
        });
      }
    }
    return constructor;
    /* c8 ignore next 4 */
  } catch (err) {
    console.error(err);
    throw err;
  }
}

const MemoryDisposition = {
  Auto: 0,
  Copy: 1,
  Link: 2,
};

async function linkModule(sourcePromise, params = {}) {
  const {
    resolve,
    reject,
    promise,
    ...linkParams
  } = params;
  try {
    const source = await sourcePromise;
    const result = await runModule(source, linkParams);
    resolve(result);
  } catch (err) {
    reject(err);
  }
  return promise;
}

async function runModule(source, options = {}) {
  const {
    omitFunctions = false,
    slots = {},
    variables,
    methodRunner,
    writeBack = true,
  } = options;
  let nextValueIndex = 0;
  let valueTable = null;
  let valueIndices = null;
  let nextStringIndex = 0;
  let stringTable = null;
  let stringIndices = null;
  const decoder = new TextDecoder();
  const callContexts = {};
  let callContextCount = 0;
  const globalSlots = slots;
  const empty = () => {};
  const imports = {
    _startCall,
    _endCall,
    _allocMemory,
    _freeMemory,
    _getMemory,
    _getMemoryOffset,
    _getMemoryLength,
    _wrapMemory,
    _createString,
    _getPointerStatus,
    _setPointerStatus,
    _readGlobalSlot,
    _readObjectSlot,
    _writeObjectSlot,
    _createDataView,
    _writeToConsole,

    // these functions will only be called at comptime
    _writeGlobalSlot: empty,
    _setObjectPropertyString: empty,
    _setObjectPropertyInteger: empty,
    _setObjectPropertyBoolean: empty,
    _setObjectPropertyObject: empty,
    _beginStructure: empty,
    _attachMember: empty,
    _attachMethod: empty,
    _attachTemplate: empty,
    _finalizeStructure: empty,
    _createObject: empty,
    _createTemplate: empty,
  };
  const importObject = { env: imports };
  const promise = (source[Symbol.toStringTag] === 'Response')
    ? WebAssembly.instantiateStreaming(source, importObject)
    : WebAssembly.instantiate(source, importObject);
  const { instance } = await promise;
  const { memory: wasmMemory, define, run, alloc, free, safe } = instance.exports;
  let consolePending = '', consoleTimeout = 0;
  resetTables();

  {
    // link variables
    for (const [ address, object ] of Object.entries(variables)) {
      linkObject(object, Number(address));
    }
    // link methods
    methodRunner[0] = function(thunkIndex, argStruct) {
      const argIndex = addObject(argStruct);
      const errorIndex = run(argIndex, thunkIndex);
      if (errorIndex !== 0) {
        throwError(errorIndex);
      }
    };
  }

  function resetTables() {
    if (nextValueIndex !== 1) {
      nextValueIndex = 1;
      valueTable = { 0: null };
      valueIndices = new WeakMap();
    }
    if (nextStringIndex !== 1) {
      nextStringIndex = 1;
      stringTable = { 0: null };
      stringIndices = {};
    }
  }

  function getString(address, len) {
    const ta = new Uint8Array(wasmMemory.buffer, address, len);
    return decoder.decode(ta);
  }

  function addString(address, len) {
    const s = getString(address, len);
    let index = stringIndices[s];
    if (index === undefined) {
      index = stringIndices[s] = nextStringIndex++;
      stringTable[index] = s;
    }
    return index;
  }

  function addObject(object) {
    const index = nextValueIndex++;
    valueTable[index] = object;
    valueIndices.set(object, index);
    return index;
  }

  function getObjectIndex(object) {
    const index = valueIndices.get(object);
    return (index !== undefined) ? index : addObject(object);
  }

  function linkObject(object, address) {
    const dv1 = object[MEMORY];
    const len = dv1.byteLength;
    const dv2 = new DataView(wasmMemory.buffer, address, len);
    /*
    console.log({ address });
    for (const [ index, dv ] of [ dv1, dv2 ].entries()) {
      const array = [];
      for (let i = 0; i < dv.byteLength; i++) {
        array.push(dv.getUint8(i));
      }
      console.log(`${index + 1}: ${array.join(' ')}`)
    }
    */
    if (writeBack) {
      const copy = getMemoryCopier(dv1.byteLength);
      copy(dv2, dv1);
    }
    dv2[MEMORY] = { memory: wasmMemory, address, len };
    Object.defineProperty(object, MEMORY, { value: dv2, configurable: true });
    if (object.hasOwnProperty(ZIG)) {
      // a pointer--link the target too
      const targetObject = object[SLOTS][0];
      const targetAddress = dv2.getUint32(0, true);
      linkObject(targetObject, targetAddress);
    }
  }

  function throwError(errorIndex) {
    const errorName = stringTable[errorIndex];
    const errorMsg = decamelizeErrorName(errorName);
    throw new Error(errorMsg);
  }

  function _startCall(ctxAddr) {
    callContexts[ctxAddr] = { bufferMap: new Map() };
    callContextCount++;
  }

  function _endCall(ctxAddr) {
    // move data from WASM memory into buffers
    const ctx = callContexts[ctxAddr];
    for (const [ dest, { address, len, ptrAlign, copy, shadow } ] of ctx.bufferMap) {
      if (copy) {
        const src = new DataView(wasmMemory.buffer, address, len);
        copy(dest, src);
      }
      if (shadow) {
        free(ctxAddr, address, len, ptrAlign);
      }
    }
    delete callContexts[ctxAddr];
    callContextCount--;
    if (callContextCount === 0) {
      // clear the value tables
      resetTables();
      // output pending text to console
      if (consolePending) {
        console.log(consolePending);
        consolePending = '';
        clearTimeout(consoleTimeout);
      }
    }
  }

  function _allocMemory(ctxAddr, len, ptrAlign) {
    if (len === 0) {
      return null;
    }
    const address = alloc(ctxAddr, len, ptrAlign);
    const { bufferMap } = callContexts[ctxAddr];
    const buffer = new ArrayBuffer(len);
    const dv = new DataView(buffer);
    const copy = getMemoryCopier(len);
    new DataView(wasmMemory.buffer, address, len);
    bufferMap.set(dv, { address, len, ptrAlign, copy, shadow: true });
    return address;
  }

  function _freeMemory(ctxAddr, address, len, ptrAlign) {
    const { bufferMap } = callContexts[ctxAddr];
    for (const [ dv, { address: matching } ] of bufferMap) {
      if (address === matching) {
        bufferMap.delete(dv);
        free(ctxAddr, address, len, ptrAlign);
      }
    }
  }

  function isMisaligned({ address }, ptrAlign) {
    const mask = (1 << ptrAlign) - 1;
    return (address & mask) !== 0;
  }

  function _getMemory(ctxAddr, objectIndex, ptrAlign, isConst) {
    const object = valueTable[objectIndex];
    let dv = object[MEMORY];
    if (!dv) {
      return 0;
    }
    const source = dv[MEMORY];
    if (source) {
      return addObject(source);
    } else {
      const ctx = callContexts[ctxAddr];
      let memory = ctx.bufferMap.get(dv);
      if (!memory) {
        // see if memory overlaps another data view seen earlier
        const len = dv.byteLength;
        if (len === 0) {
          return addObject({ address: 0, len: 0 });
        }
        for (const [ prevDV, prevMemory ] of ctx.bufferMap) {
          if (dv.buffer === prevDV.buffer) {
            if (prevDV.byteOffset <= dv.byteOffset && dv.byteOffset + len <= prevDV.byteOffset + prevDV.byteLength) {
              const address = prevMemory.address + (dv.byteOffset - prevDV.byteOffset);
              memory = { address, len, copy: null, ptrAlign, shadow: false };
              break;
            } else if (prevDV.byteOffset >= dv.byteOffset + len || dv.byteOffset >= prevDV.byteOffset + prevDV.byteLength) ; else {
              // overlapping
              return 0;
            }
          }
        }
        if (memory) {
          if (isMisaligned(memory, ptrAlign)) {
            return 0;
          }
        } else {
          const address = alloc(ctxAddr, len, ptrAlign);
          const dest = new DataView(wasmMemory.buffer, address, len);
          // create new dataview if the one given only covers a portion of it
          const src = (dv.byteLength === len) ? dv : new DataView(dv.buffer);
          const copy = getMemoryCopier(len);
          copy(dest, src);
          memory = { address, len, copy: (isConst) ? null : copy, ptrAlign, shadow: true };
        }
        ctx.bufferMap.set(dv, memory);
      }
      return addObject(memory);
    }
  }

  function _getMemoryOffset(objectIndex) {
    const object = valueTable[objectIndex];
    return object.address;
  }

  function _getMemoryLength(objectIndex) {
    const object = valueTable[objectIndex];
    return object.len;
  }

  function _wrapMemory(structureIndex, viewIndex) {
    const structure = valueTable[structureIndex];
    let dv = valueTable[viewIndex];
    let object;
    {
      const { constructor } = structure;
      object = constructor.call(ZIG, dv);
    }
    return addObject(object);
  }

  function _createString(address, len) {
    return addString(address, len);
  }

  function _getPointerStatus(objectIndex) {
    const pointer = valueTable[objectIndex];
    const status = pointer[ZIG];
    if (typeof(status) !== 'boolean') {
      return -1;
    }
    return status ? 1 : 0;
  }

  function _setPointerStatus(objectIndex, status) {
    const pointer = valueTable[objectIndex];
    pointer[ZIG] = !!status;
  }

  function _readGlobalSlot(slot) {
    const object = globalSlots[slot];
    return object ? getObjectIndex(object) : 0;
  }

  function _readObjectSlot(objectIndex, slot) {
    const object = valueTable[objectIndex];
    const value = object[SLOTS][slot];
    return value ? getObjectIndex(value) : 0;
  }

  function _writeObjectSlot(objectIndex, slot, valueIndex) {
    const object = valueTable[objectIndex];
    object[SLOTS][slot] = valueTable[valueIndex];
  }

  function createCopy(ctx, address, len) {
    const buffer = new ArrayBuffer(len);
    const copy = getMemoryCopier(len);
    const dv = new DataView(buffer);
    // copy content immediately, since address is likely pointing to a stack location
    const src = new DataView(wasmMemory.buffer, address, len);
    copy(dv, src);
    ctx.bufferMap.set(dv, { address, len, copy: null, ptrAlign: 0, shadow: false });
    return dv;
  }

  function obtainDataView(ctx, address, len, disposition) {
    if (disposition === MemoryDisposition.Copy) {
      return createCopy(ctx, address, len);
    } else if (disposition === MemoryDisposition.Auto) {
      // look for address among existing buffers
      for (const [ dv, { address: start, len: len2 } ] of ctx.bufferMap) {
        if (start <= address && address + len <= start + len2) {
          if (len === len2) {
            return dv;
          } else {
            const offset = address - start;
            return new DataView(dv.buffer, offset, len);
          }
        }
      }
    }
    {
      // mystery memory--link directly to it, attaching the memory object
      // so we can recreate the view in the event of buffer deattachment
      // due to address space enlargement
      const dv = new DataView(wasmMemory.buffer, address, len);
      dv[MEMORY] = { memory: wasmMemory, address, len };
      return dv;
    }
  }

  function _createDataView(ctxAddr, address, len, disposition) {
    const ctx = callContexts[ctxAddr];
    return addObject(obtainDataView(ctx, address, len, disposition));
  }

  function _writeToConsole(address, len) {
    // send text up to the last newline character
    const s = getString(address, len);
    const index = s.lastIndexOf('\n');
    if (index === -1) {
      consolePending += s;
    } else {
      console.log(consolePending + s.substring(0, index));
      consolePending = s.substring(index + 1);
    }
    clearTimeout(consoleTimeout);
    if (consolePending) {
      consoleTimeout = setTimeout(() => {
        console.log(consolePending);
        consolePending = '';
      }, 250);
    }
  }
}

function finalizeStructures(structures) {
  const slots = {};
  const variables = {};
  initializeErrorSets();
  for (const structure of structures) {
    for (const target of [ structure.static, structure.instance ]) {
      // first create the actual template using the provided placeholder
      if (target.template) {
        target.template = createTemplate(target.template);
      }
    }
    for (const method of structure.static.methods) {
      // create thunk function
      method.thunk = createThunk(method.thunk);
    }
    finalizeStructure(structure);
    // place structure into its assigned slot
    slots[structure.slot] = structure;
  }

  function createTemplate(placeholder) {
    const template = {};
    if (placeholder.memory) {
      const { array, offset, length } = placeholder.memory;
      template[MEMORY] = new DataView(array.buffer, offset, length);
    }
    if (placeholder.slots) {
      template[SLOTS] = insertObjects({}, placeholder.slots);
    }
    return template;
  }

  function insertObjects(dest, placeholders) {
    for (const [ slot, placeholder ] of Object.entries(placeholders)) {
      dest[slot] = createObject(placeholder);
    }
    return dest;
  }

  function createObject(placeholder) {
    let dv;
    if (placeholder.memory) {
      const { array, offset, length } = placeholder.memory;
      dv = new DataView(array.buffer, offset, length);
    } else {
      const { size } = placeholder.structure;
      dv = new DataView(new ArrayBuffer(size));
    }
    const { constructor } = placeholder.structure;
    const object = constructor.call(ZIG, dv);
    if (placeholder.slots) {
      insertObjects(object[SLOTS], placeholder.slots);
    }
    if (placeholder.address !== undefined) {
      // need to replace dataview with one pointing to WASM memory later,
      // when the VM is up and running
      variables[placeholder.address] = object;
    }
    return object;
  }

  let resolve, reject;
  const promise = new Promise((r1, r2) => {
    resolve = r1;
    reject = r2;
  });
  const methodRunner = {
    0: function(index, argStruct) {
      // wait for linking to occur, then activate the runner again
      return promise.then(() => methodRunner[0].call(this, index, argStruct));
    },
  };

  function createThunk(index) {
    return function(argStruct) {
      return methodRunner[0](index, argStruct);
    };
  }

  return { promise, resolve, reject, slots, variables, methodRunner };
}

export { finalizeStructures, linkModule, runModule, useArgStruct, useArray, useBareUnion, useBool, useBoolEx, useEnumeration, useEnumerationItem, useEnumerationItemEx, useErrorSet, useErrorUnion, useExternUnion, useFloat, useFloatEx, useInt, useIntEx, useObject, useOpaque, useOptional, usePointer, usePrimitive, useSlice, useStruct, useTaggedUnion, useType, useVector, useVoid };
