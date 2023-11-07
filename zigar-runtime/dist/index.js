const MEMORY = Symbol('memory');
const SLOTS = Symbol('slots');
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
const SELF = Symbol('self');
const CHILD_VIVIFICATOR = Symbol('childVivificator');
const POINTER_VISITOR = Symbol('pointerVisitor');
const TARGET_ACQUIRER = Symbol('targetAcquirer');
const ADDRESS_UPDATER = Symbol('addressUpdater');
const FIELD_VALIDATOR = Symbol('fieldValidator');
const ENVIRONMENT = Symbol('environment');

function getPointerAlign(align) {
  return (align) ? Math.log2(align) : 0;
}

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

function getMemoryResetter(size) {
  const resetter = resetters[size];
  if (resetter) {
    return resetter;
  }
  if (!(size & 0x07)) return reset8x;
  if (!(size & 0x03)) return reset4x;
  if (!(size & 0x01)) return reset2x;
  return reset1x;
}

const resetters = {
  1: reset1,
  2: reset2,
  4: reset4,
  8: reset8,
  16: reset16,
  32: reset32,
};

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

function throwNoInitializer(structure) {
  const name = getStructureName(structure);
  throw new TypeError(`An initializer must be provided to the constructor of ${name}, even when it's undefined`);
}

function throwBufferSizeMismatch(structure, dv, target = null) {
  const { type, byteSize } = structure;
  const name = getStructureName(structure);
  const actual = dv.byteLength;
  const s = (byteSize > 1) ? 's' : '';
  if (type === StructureType.Slice && !target) {
    throw new TypeError(`${name} has elements that are ${byteSize} byte${s} in length, received ${actual}`);
  } else {
    const total = (type === StructureType.Slice) ? target.length * byteSize : byteSize;
    throw new TypeError(`${name} has ${total} byte${s}, received ${actual}`);
  }
}

function throwBufferExpected(structure) {
  const { type, byteSize, typedArray } = structure;
  const s = (byteSize > 1) ? 's' : '';
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

function throwInvalidEnum(structure, value) {
  const name = getStructureName(structure);
  throw new TypeError(`Value given does not correspond to an item of enum ${name}: ${value}`);
}

function throwEnumExpected(structure, arg) {
  const name = getStructureName(structure);
  throw new TypeError(`Enum item of the type ${name} expected, received ${arg}`);
}

function throwNoNewEnum(structure) {
  const name = getStructureName(structure);
  throw new TypeError(`Cannot create new enum item\nCall ${name} without the use of "new" to obtain an enum object`);
}

function throwNoNewError(structure) {
  const name = getStructureName(structure);
  throw new TypeError(`Cannot create new error\nCall ${name} without the use of "new" to obtain an error object`);
}

function throwNotInErrorSet(structure) {
  const name = getStructureName(structure);
  throw new TypeError(`Error given is not a part of error set ${name}`);
}

function throwUnknownErrorNumber(structure, number) {
  const name = getStructureName(structure);
  throw new TypeError(`Error number does not corresponds to any error in error set ${name}: #${number}`);
}

function throwMultipleUnionInitializers(structure) {
  const name = getStructureName(structure);
  throw new TypeError(`Only one property of ${name} can be given a value`);
}

function throwInactiveUnionProperty(structure, name, currentName) {
  throw new TypeError(`Accessing property ${name} when ${currentName} is active`);
}

function throwMissingUnionInitializer(structure, arg, exclusion) {
  const { instance: { members } } = structure;
  const name = getStructureName(structure);
  const missing = members.slice(0, exclusion ? -1 : undefined).map(m => m.name);
  throw new TypeError(`${name} needs an initializer for one of its union properties: ${missing.join(', ')}`);
}

function throwInvalidInitializer(structure, expected, arg) {
  const name = getStructureName(structure);
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
  const { length, instance: { members: [ member ] } } = structure;
  const name = getStructureName(structure);
  const { structure: { constructor: elementConstructor} } = member;
  const { length: argLength, constructor: argConstructor } = arg;
  // get length from object whech it's a slice
  const actualLength = target?.length ?? length;
  const s = (actualLength > 1) ? 's' : '';
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

function throwMissingInitializers(structure, arg) {
  const { instance: { members } } = structure;
  const name = getStructureName(structure);
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
  const name = getStructureName(structure);
  throw new TypeError(`${name} does not have a property with that name: ${propName}`);
}

function throwArgumentCountMismatch(structure, actual) {
  const { instance: { members } } = structure;
  const name = getStructureName(structure);
  const argCount = members.length - 1;
  const s = (argCount > 1) ? 's' : '';
  throw new Error(`${name} expects ${argCount} argument${s}, received ${actual}`);
}

function rethrowArgumentError(structure, index, err) {
  const { instance: { members } } = structure;
  const name = getStructureName(structure);
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
  const name1 = getStructureName(structure);
  const { constructor: { name: name2 } } = pointer;
  throw new TypeError(`Conversion of ${name2} to ${name1} requires an explicit cast`);
}

function throwMisplacedSentinel(structure, value, index, length) {
  const name = getStructureName(structure);
  throw new TypeError(`${name} expects the sentinel value ${value} at ${length - 1}, found at ${index}`);
}

function throwMissingSentinel(structure, value, length) {
  const name = getStructureName(structure);
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
  const name = getStructureName(structure);
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
  const { type, byteSize, typedArray } = structure;
  let dv;
  // not using instanceof just in case we're getting objects created in other contexts
  const tag = arg?.[Symbol.toStringTag];
  if (tag === 'DataView') {
    dv = arg;
  } else if (tag === 'ArrayBuffer' || tag === 'SharedArrayBuffer') {
    dv = new DataView(arg);
  } else if (typedArray && tag === typedArray.name || (tag === 'Uint8ClampedArray' && typedArray === Uint8Array)) {
    dv = new DataView(arg.buffer, arg.byteOffset, arg.byteLength);
  } else if (tag === 'Uint8Array' && typeof(Buffer) === 'function' && arg instanceof Buffer) {
    dv = new DataView(arg.buffer, arg.byteOffset, arg.byteLength);
  } else {
    const memory = arg?.[MEMORY];
    if (memory && (type === StructureType.Array || type === StructureType.Slice || type === StructureType.Vector)) {
      const { instance: { members: [ member ] } } = structure;
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
  if (dv) {
    checkDataViewSize(structure, dv);
  }
  return dv;
}

function checkDataViewSize(structure, dv) {
  const { type, byteSize } = structure;
  if (type === StructureType.Slice ? dv.byteLength % byteSize !== 0 : dv.byteLength !== byteSize) {
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

function useUint() {
  factories$1[MemberType.Uint] = getUintAccessor;
}

function useUintEx() {
  factories$1[MemberType.Uint] = getUintAccessorEx;
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

function getUintAccessor(access, member, options) {
  const getDataViewAccessor = addRuntimeCheck(options, getDataViewUintAccessor);
  return getAccessorUsing(access, member, options, getDataViewAccessor)
}

function getUintAccessorEx(access, member, options) {
  const getDataViewAccessor = addRuntimeCheck(options, getDataViewUintAccessorEx);
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
  const getDataViewAccessor = addEnumerationLookup(getDataViewIntAccessor);
  return getAccessorUsing(access, member, options, getDataViewAccessor) ;
}

function getEnumerationItemAccessorEx(access, member, options) {
  const getDataViewAccessor = addEnumerationLookup(getDataViewIntAccessorEx);
  return getAccessorUsing(access, member, options, getDataViewAccessor) ;
}

function addEnumerationLookup(getDataViewIntAccessor) {
  return function(access, member) {
    // no point in using non-standard int accessor to read enum values unless they aren't byte-aligned
    let { bitSize, byteSize } = member;
    if (byteSize) {
      bitSize = byteSize * 8;
    }
    const intMember = { type: MemberType.Int, bitSize, byteSize };
    const accessor = getDataViewIntAccessor(access, intMember);
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
    if (access === 'get') {
      return function() {
        /* WASM-ONLY */
        try {
        /* WASM-ONLY-END*/
          return accessor.call(this[MEMORY], offset, littleEndian);
        /* WASM-ONLY */
        } catch (err) {
          if (err instanceof TypeError && restoreMemory.call(this)) {
            return accessor.call(this[MEMORY], offset, littleEndian);
          } else {
            throw err;
          }
        }
        /* WASM-ONLY-END*/
      };
    } else {
      return function(value) {
        /* WASM-ONLY */
        try {
        /* WASM-ONLY-END*/
        return accessor.call(this[MEMORY], offset, value, littleEndian);
        /* WASM-ONLY */
        } catch (err) {
          if (err instanceof TypeError && restoreMemory.call(this)) {
            return accessor.call(this[MEMORY], offset, value, littleEndian);
          } else {
            throw err;
          }
        }
        /* WASM-ONLY-END*/
      }
    }
  } else {
    if (access === 'get') {
      return function(index) {
        try {
          return accessor.call(this[MEMORY], index * byteSize, littleEndian);
        } catch (err) {
          /* WASM-ONLY */
          if (err instanceof TypeError && restoreMemory.call(this)) {
            return accessor.call(this[MEMORY], index * byteSize, littleEndian);
          } else {
          /* WASM-ONLY-END */
            rethrowRangeError(member, index, err);
          /* WASM-ONLY */
          }
          /* WASM-ONLY-END */
        }
      };
    } else {
      return function(index, value) {
        /* WASM-ONLY */
        try {
        /* WASM-ONLY-END */
          return accessor.call(this[MEMORY], index * byteSize, value, littleEndian);
        /* WASM-ONLY */
        } catch (err) {
          if (err instanceof TypeError && restoreMemory.call(this)) {
            return accessor.call(this[MEMORY], index * byteSize, value, littleEndian);
          } else {
            rethrowRangeError(member, index, err);
          }
        }
        /* WASM-ONLY-END */
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
  } = s;
  Object.defineProperties(constructor.prototype, {
    dataView: { ...getDataViewAccessors(s), configurable: true },
    base64: { ...getBase64Accessors(), configurable: true },
    toJSON: { value: getValueOf, configurable: true, writable: true },
    valueOf: { value: getValueOf, configurable: true, writable: true },
  });
  if (canBeString(s)) {
    Object.defineProperty(constructor.prototype, 'string', {
      ...getStringAccessors(s), configurable: true
    });
  }
  if (canBeTypedArray(s)) {
    Object.defineProperty(constructor.prototype, 'typedArray', {
      ...getTypedArrayAccessors(s), configurable: true
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
  const { type, byteSize, sentinel } = structure;
  const copy = getMemoryCopier(byteSize, type === StructureType.Slice);
  return {
    get() {
      /* WASM-ONLY */
      restoreMemory.call(this);
      /* WASM-ONLY-END */
      return this[MEMORY];
    },
    set(dv) {
      checkDataView(dv);
      /* WASM-ONLY */
      restoreMemory.call(this);
      /* WASM-ONLY-END */
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

function getStringAccessors(structure) {
  const { sentinel, instance: { members: [ member ] } } = structure;
  const { byteSize } = member;
  return {
    get() {
      let decoder = decoders[byteSize];
      if (!decoder) {
        decoder = decoders[byteSize] = new TextDecoder(`utf-${byteSize * 8}`);
      }
      const dv = this.dataView;
      const TypedArray = (byteSize === 1) ? Int8Array : Int16Array;
      const ta = new TypedArray(dv.buffer, dv.byteOffset, this.length);
      const s = decoder.decode(ta);
      return (sentinel?.value === undefined) ? s : s.slice(0, -1);
    },
    set(src) {
      this.dataView = getDataViewFromUTF8(src, byteSize, sentinel?.value);
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

function getTypedArrayAccessors(structure) {
  const { typedArray } = structure;
  return {
    get() {
      const dv = this.dataView;
      const length = dv.byteLength / typedArray.BYTES_PER_ELEMENT;
      return new typedArray(dv.buffer, dv.byteOffset, length);
    },
    set(ta) {
      this.dataView = getDataViewFromTypedArray(ta, typedArray);
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
    } else if (object && (typeof(object) === 'object' || typeof(object) === 'function')) {
      let result = map.get(object);
      if (!result) {
        result = {};
        map.set(object, result);
        for (const [ name, child ] of Object.entries(object)) {
          const childResult = extract(child);
          if (childResult !== undefined) {
            result[name] = childResult;
          }
        }
        return result;
      }
      return result;
    } else {
      return object;
    }
  }  return extract(this.$);
}

function finalizePrimitive(s, env) {
  const {
    byteSize,
    align,
    instance: {
      members: [ member ],
    },
    options,
  } = s;
  addTypedArray(s);
  const ptrAlign = getPointerAlign(align);
  const constructor = s.constructor = function(arg) {
    const creating = this instanceof constructor;
    let self, dv;
    if (creating) {
      if (arguments.length === 0) {
        throwNoInitializer(s);
      }
      self = this;
      dv = env.createBuffer(byteSize, ptrAlign);
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
  const copy = getMemoryCopier(byteSize);
  const specialKeys = getSpecialKeys(s);
  const initializer = function(arg) {
    if (arg instanceof constructor) {
      /* WASM-ONLY */
      restoreMemory.call(this);
      restoreMemory.call(arg);
      /* WASM-ONLY-END */
      copy(this[MEMORY], arg[MEMORY]);
    } else {
      if (arg && typeof(arg) === 'object') {
        for (const key of Object.keys(arg)) {
          if (!(key in this)) {
            throwNoProperty$1(s, key);
          }
        }
        let specialFound = 0;
        for (const key of specialKeys) {
          if (key in arg) {
            specialFound++;
          }
        }
        if (specialFound === 0) {
          const type = getPrimitiveType(member);
          throwInvalidInitializer(s, type, arg);
        }
        for (const key of specialKeys) {
          if (key in arg) {
            this[key] = arg[key];
          }
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

function finalizePointer(s, env) {
  const {
    byteSize,
    align,
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
  const hasLength = isTargetSlice && !targetStructure.sentinel;
  const addressSize = (hasLength) ? byteSize / 2 : byteSize;
  const { get: getAddress, set: setAddress } = getAccessors({
    type: MemberType.Uint,
    bitOffset: 0,
    bitSize: addressSize * 8,
    byteSize: addressSize,
    structure: { byteSize: addressSize },
  }, options);
  const { get: getLength, set: setLength } = (hasLength) ? getAccessors({
    type: MemberType.Uint,
    bitOffset: addressSize * 8,
    bitSize: addressSize * 8,
    byteSize: addressSize,
    structure: { name: 'usize', byteSize: addressSize },
  }, options) : {};
  const ptrAlign = getPointerAlign(align);
  const constructor = s.constructor = function(arg) {
    const calledFromEnviroment = this === ENVIRONMENT;
    const calledFromParent = this === PARENT;
    let creating = this instanceof constructor;
    let self, dv;
    if (creating) {
      if (arguments.length === 0) {
        throwNoInitializer(s);
      }
      self = this;
      dv = env.createBuffer(byteSize, ptrAlign);
    } else {
      self = Object.create(constructor.prototype);
      if (calledFromEnviroment || calledFromParent) {
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
        dv = env.createBuffer(byteSize, ptrAlign);
      }
    }
    self[MEMORY] = dv;
    self[SLOTS] = { 0: null };
    if (creating) {
      initializer.call(self, arg);
    }
    return createProxy$1.call(self, isConst, isTargetPointer);
  };
  const initializer = function(arg) {
    if (arg instanceof constructor) {
      if (env.isShared(this[MEMORY])) {
        // initialize with the other pointer's target
        initializer.call(this, arg[SLOTS][0]);
      } else {
        // copy the object stored in slots 0, not copying memory of the other object
        // since the value stored there likely isn't valid
        copyPointer.call(this, arg);
      }
    } else {
      const Target = targetStructure.constructor;
      if (isPointerOf(arg, Target)) {
        if (!isConst && arg.constructor.const) {
          throwConstantConstraint(s, arg);
        }
        copyPointer.call(this, arg);
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
        if (env.isShared(this[MEMORY])) {
          // the pointer sits in shared memory--apply the change immediately
          if (env.isShared(arg[MEMORY])) {
            const address = env.getViewAddress(arg[MEMORY]);
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
  const targetAcquirer = function() {
    // obtain address (and possibly length) from memory
    const address = getAddress.call(this);
    const currentTarget = this[SLOTS][0];
    if (currentTarget) {
      const currentAddress = env.getViewAddress(currentTarget[MEMORY]);
      if (address === currentAddress) {
        // don't need to do anything
        return;
      }
    }
    let len = 1;
    if (isTargetSlice) {
      if (hasLength) {
        len = getLength.call(this);
      } else if (targetStructure.sentinel) {
        len = env.findSentinel(address, targetStructure.sentinel.bytes) + 1;
      } else {
        len = 0;
      }
    }
    // get view of memory that pointer points to
    const dv = env.findMemory(address, len * targetStructure.byteSize);
    // create the target
    const Target = targetStructure.constructor;
    const target = Target.call(this, dv);
    this[SLOTS][0] = target;
    if (target[POINTER_VISITOR]) {
      // acquire objects pointed to by pointers in target
      target[POINTER_VISITOR](acquireTarget, { vivificate: true });
    }
  };
  const addressUpdater = function() {
    if (env.rememberPointer(this)) {
      // already processed
      return;
    }
    const target = this[SLOTS][0];
    if (target) {
      const address = env.importMemory(target[MEMORY]);
      setAddress.call(this, address);
      if (hasLength) {
        setLength.call(this, target.length);
      }
      if (target[POINTER_VISITOR]) {
        // update pointers in the target
        target[POINTER_VISITOR](updateAddress, {});
      }
    }
  };
  // return the proxy object if one is used
  Object.defineProperties(constructor.prototype, {
    '*': { get: getTarget, set: (isConst) ? undefined : setTarget, configurable: true },
    '$': { get: getProxy, set: initializer, configurable: true, },
    'valueOf': { value: getTargetValue, configurable: true, writable: true },
    [TARGET_ACQUIRER]: { value: targetAcquirer },
    [ADDRESS_UPDATER]: { value: addressUpdater },
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

function copyPointer(src) {
  this[SLOTS][0] = src[SLOTS][0];
}

function resetPointer() {
  this[SLOTS][0] = null;
}

function acquireTarget() {
  this[TARGET_ACQUIRER]();
}

function updateAddress() {
  this[ADDRESS_UPDATER]();
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

function visitPointer(fn, options = {}) {
  const { source } = options;
  fn.call(this, source);
}

function isPointerOf(arg, Target) {
  return (arg?.constructor?.child === Target && arg['*']);
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
  [SLOTS]: true,
  [MEMORY]: true,
  [PROXY]: true,
  [TARGET_ACQUIRER]: true,
  [ADDRESS_UPDATER]: true,
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

function finalizeArray(s, env) {
  const {
    length,
    byteSize,
    align,
    instance: {
      members: [ member ],
    },
    hasPointer,
    options,
  } = s;
  addTypedArray(s);
  const hasObject = (member.type === MemberType.Object);
  const ptrAlign = getPointerAlign(align);
  const constructor = s.constructor = function(arg) {
    const creating = this instanceof constructor;
    let self, dv;
    if (creating) {
      if (arguments.length === 0) {
        throwNoInitializer(s);
      }
      self = this;
      dv = env.createBuffer(byteSize, ptrAlign);
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
  const { structure: elementStructure } = member;
  const copy = getMemoryCopier(byteSize);
  const specialKeys = getSpecialKeys(s);
  const initializer = function(arg) {
    if (arg instanceof constructor) {
      /* WASM-ONLY */
      restoreMemory.call(this);
      restoreMemory.call(arg);
      /* WASM-ONLY-END */
      copy(this[MEMORY], arg[MEMORY]);
      if (hasPointer) {
        this[POINTER_VISITOR](copyPointer, { vivificate: true });
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
        for (const key of Object.keys(arg)) {
          if (!(key in this)) {
            throwNoProperty(s, key);
          }
        }
        let specialFound = 0;
        for (const key of specialKeys) {
          if (key in arg) {
            specialFound++;
          }
        }
        if (specialFound === 0) {
          throwInvalidArrayInitializer(s, arg);
        }
        for (const key of specialKeys) {
          if (key in arg) {
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
  const visitor = function visitPointers(cb, options = {}) {
    const {
      source,
      vivificate = false,
    } = options;
    const childOptions = { ...options };
    for (let i = 0, len = this.length; i < len; i++) {
      // no need to check for empty slots, since that isn't possible
      if (source) {
        childOptions.source = source?.[SLOTS][i];
      }
      const child = (vivificate) ? this[CHILD_VIVIFICATOR](i) : this[SLOTS][i];
      if (child) {
        child[POINTER_VISITOR](cb, childOptions);
      }
    }
  };
  Object.defineProperty(prototype, POINTER_VISITOR, { value: visitor });
}

function getArrayIterator() {
  const self = this[SELF] ?? this;
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
  const self = this[SELF] ?? this;
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
        case SELF:
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

function addStaticMembers(s, env) {
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

function addMethods(s, env) {
  const {
    constructor,
    instance: { methods: instanceMembers },
    static: { methods: staticMethods },
  } = s;
  for (const method of staticMethods) {
    const f = env.createCaller(method, false);
    Object.defineProperty(constructor, f.name, { value: f, configurable: true, writable: true });
  }
  for (const method of instanceMembers) {
    const f = env.createCaller(method, true);
    Object.defineProperty(Object.prototype, f.name, { value: f, configurable: true, writable: true });
  }
}

function finalizeStruct(s, env) {
  const {
    byteSize,
    align,
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
  const keys = Object.keys(descriptors);
  const hasObject = !!members.find(m => m.type === MemberType.Object);
  const ptrAlign = getPointerAlign(align);
  const constructor = s.constructor = function(arg) {
    const creating = this instanceof constructor;
    let self, dv;
    if (creating) {
      if (arguments.length === 0) {
        throwNoInitializer(s);
      }
      self = this;
      dv = env.createBuffer(byteSize, ptrAlign);
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
    } else {
      return self;
    }
  };
  const copy = getMemoryCopier(byteSize);
  const specialKeys = getSpecialKeys(s);
  const requiredKeys = members.filter(m => m.isRequired).map(m => m.name);
  const initializer = function(arg) {
    if (arg instanceof constructor) {
      /* WASM-ONLY */
      restoreMemory.call(this);
      restoreMemory.call(arg);
      /* WASM-ONLY-END */
      copy(this[MEMORY], arg[MEMORY]);
      if (hasPointer) {
        this[POINTER_VISITOR](copyPointer, { vivificate: true, source: arg });
      }
    } else {
      if (arg && typeof(arg) === 'object') {
        // checking each name so that we would see inenumerable initializers as well
        let found = 0;
        for (const key of keys) {
          if (key in arg) {
            found++;
          }
        }
        let requiredFound = 0;
        for (const key of requiredKeys) {
          if (key in arg) {
            requiredFound++;
          }
        }
        let specialFound = 0;
        if (!arg[MEMORY]) {
          // only look for special keys in non-zigar objects
          for (const key of specialKeys) {
            if (key in arg) {
              specialFound++;
            }
          }
        }
        // don't accept unknown enumerable props
        for (const key of Object.keys(arg)) {
          if (!(key in this)) {
            throwNoProperty$1(s, key);
          }
        }
        if (specialFound === 0 && requiredFound < requiredKeys.length) {
          throwMissingInitializers(s, arg);
        }
        // apply default values unless all properties are initialized
        if (template && specialFound === 0 && found < keys.length) {
          copy(this[MEMORY], template[MEMORY]);
          if (hasPointer) {
            this[POINTER_VISITOR](copyPointer, { vivificate: true, source: template });
          }
        }
        if (specialFound > 0) {
          for (const key of specialKeys) {
            if (key in arg) {
              this[key] = arg[key];
            }
          }
        } else if (found > 0) {
          for (const key of keys) {
            if (key in arg) {
              this[key] = arg[key];
            }
          }
        }
      } else if (arg !== undefined) {
        throwInvalidInitializer(s, 'object', arg);
      }
    }
  };
  Object.defineProperty(constructor.prototype, '$', { get: getSelf, set: initializer, configurable: true });
  addSpecialAccessors(s);
  if (hasObject) {
    addChildVivificators(s);
    if (hasPointer) {
      addPointerVisitor(s);
    }
  }
  addStaticMembers(s);
  addMethods(s, env);
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
  const visitor = function visitPointers(cb, options = {}) {
    const {
      source,
      vivificate = false,
      ignoreInactive = true,
    } = options;
    const childOptions = { ...options };
    for (const { name, slot } of pointerMembers) {
      if (ignoreInactive) {
        const active = this[FIELD_VALIDATOR]?.(name) ?? true;
        if (!active) {
          continue;
        }
      }
      if (source) {
        // when src is a the struct's template, most slots will likely be empty,
        // since point fields aren't likely to have default values
        const srcChild = source[SLOTS]?.[slot];
        if (!srcChild) {
          continue;
        }
        childOptions.source = srcChild;
      }
      const child = (vivificate) ? this[CHILD_VIVIFICATOR][slot].call(this) : this[SLOTS][slot];
      if (child) {
        child[POINTER_VISITOR](cb, childOptions);
      }
    }
  };
  Object.defineProperty(prototype, POINTER_VISITOR, { value: visitor });
}

function finalizeUnion(s, env) {
  const {
    type,
    byteSize,
    align,
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
  let getName, setName;
  if (exclusion) {
    valueMembers = members.slice(0, -1);
    const selectorMember = members[members.length - 1];
    const { get: getSelector, set: setSelector } = getAccessors(selectorMember, options);
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
      const { name, slot, structure: { hasPointer } } = member;
      const { get: getValue, set: setValue } = getAccessors(member, options);
      const update = (isTagged) ? function(name) {
        if (this[TAG]?.name !== name) {
          this[TAG]?.clear?.();
          this[TAG] = { name };
          if (hasPointer) {
            this[TAG].clear = () => {
              const object = this[SLOTS][slot];
              object[POINTER_VISITOR](resetPointer);
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
  const keys = Object.keys(descriptors);
  const hasObject = !!members.find(m => m.type === MemberType.Object);
  const pointerMembers = members.filter(m => m.structure.hasPointer);
  // non-tagged union as marked as not having pointers--if there're actually
  // members with pointers, we need to disable them
  const hasInaccessiblePointer = !hasPointer && (pointerMembers.length > 0);
  const ptrAlign = getPointerAlign(align);
  const constructor = s.constructor = function(arg) {
    const creating = this instanceof constructor;
    let self, dv;
    if (creating) {
      if (arguments.length === 0) {
        throwNoInitializer(s);
      }
      self = this;
      dv = env.createBuffer(byteSize, ptrAlign);
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
        self[POINTER_VISITOR](disablePointer, { vivificate: true, ignoreInactive: false });
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
  const copy = getMemoryCopier(byteSize);
  const specialKeys = getSpecialKeys(s);
  const initializer = function(arg) {
    if (arg instanceof constructor) {
      /* WASM-ONLY */
      restoreMemory.call(this);
      restoreMemory.call(arg);
      /* WASM-ONLY-END */
      copy(this[MEMORY], arg[MEMORY]);
      if (hasPointer) {
        this[POINTER_VISITOR](copyPointer, { vivificate: true, source: arg });
      }
    } else {
      if (arg && typeof(arg) === 'object') {
        // checking each name so that we would see inenumerable initializers as well
        let found = 0;
        for (const key of keys) {
          if (key in arg) {
            found++;
          }
        }
        let specialFound = 0;
        if (!arg[MEMORY]) {
          for (const key of specialKeys) {
            if (key in arg) {
              specialFound++;
            }
          }
        }
        // don't accept unknown enumerable props
        for (const key of Object.keys(arg)) {
          if (!(key in this)) {
            throwNoProperty$1(s, key);
          }
        }
        if (found !== 1) {
          if (found === 0) {
            if (specialFound === 0 && !hasDefaultMember) {
              throwMissingUnionInitializer(s, arg, exclusion);
            }
          } else {
            throwMultipleUnionInitializers(s);
          }
        }
        if (specialFound > 0) {
          for (const key of specialKeys) {
            if (key in arg) {
              this[key] = arg[key];
            }
          }
        } else if (found === 0) {
          if (template) {
            /* WASM-ONLY */
            restoreMemory.call(this);
            /* WASM-ONLY-END */
            copy(this[MEMORY], template[MEMORY]);
            if (hasPointer) {
              this[POINTER_VISITOR](copyPointer, { vivificate: true, source: template });
            }
          }
        } else {
          for (const key of keys) {
            if (key in arg) {
              // can't just set the property, since it would throw when a field other than the
              // active one is being set
              const { init } = descriptors[key];
              init.call(this, arg[key]);
            }
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
      // add a mean to check whether pointer is actually active
      const validator = (isTagged) ? function(name) { return getName.call(this) === name } : function() { return false };
      Object.defineProperty(constructor.prototype, FIELD_VALIDATOR, { value: validator });
      addPointerVisitor(s);
    }
  }
  addSpecialAccessors(s);
  addStaticMembers(s);
  addMethods(s, env);
  return constructor;
}
const taggedProxyHandlers = {
  ownKeys(union) {
    const item = union[ENUM_ITEM];
    const name = item[ENUM_NAME];
    return [ name, MEMORY ];
  },
};

function finalizeErrorUnion(s, env) {
  const {
    byteSize,
    align,
    instance: { members },
    options,
    hasPointer,
  } = s;

  const { get: getValue, set: setValue } = getAccessors(members[0], options);
  const { get: getError, set: setError } = getAccessors(members[1], options);
  const { structure: errorStructure } = members[1];
  const { constructor: ErrorSet } = errorStructure;
  const reset = getMemoryResetter(byteSize);
  const set = function(value) {
    if (value instanceof Error) {
      if (!(value instanceof ErrorSet)) {
        throwNotInErrorSet(errorStructure);
      }
      reset(this[MEMORY]);
      setError.call(this, value.index);
      this[POINTER_VISITOR]?.(resetPointer);
    } else {
      setValue.call(this, value);
      setError.call(this, 0);
    }
  };
  const get = function() {
    const errorNumber = getError.call(this);
    if (errorNumber !== 0) {
      const err = ErrorSet(errorNumber);
      if (!err) {
        throwUnknownErrorNumber(errorStructure, errorNumber);
      }
      this[POINTER_VISITOR]?.(resetPointer);
      throw err;
    } else {
      return getValue.call(this);
    }
  };
  const check = function() {
    const errorNumber = getError.call(this);
    return (errorNumber === 0);
  };
  const hasObject = !!members.find(m => m.type === MemberType.Object);
  const ptrAlign = getPointerAlign(align);
  const constructor = s.constructor = function(arg) {
    const creating = this instanceof constructor;
    let self, dv;
    if (creating) {
      if (arguments.length === 0) {
        throwNoInitializer(s);
      }
      self = this;
      dv = env.createBuffer(byteSize, ptrAlign);
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
  const copy = getMemoryCopier(byteSize);
  const initializer = function(arg) {
    if (arg instanceof constructor) {
      copy(this[MEMORY], arg[MEMORY]);
      if (hasPointer) {
        if (check.call(this)) {
          this[POINTER_VISITOR](copyPointer, { vivificate: true, source: arg });
        }
      }
    } else {
      this.$ = arg;
    }
  };
  Object.defineProperty(constructor.prototype, '$', { get, set, configurable: true });
  if (hasObject) {
    addChildVivificators(s);
    if (hasPointer) {
      // function used by pointer visitor to see whether pointer field is active
      Object.defineProperty(constructor.prototype, FIELD_VALIDATOR, { value: check });
      addPointerVisitor(s);
    }
  }
  addSpecialAccessors(s);
  return constructor;
}

let currentErrorSets;

function finalizeErrorSet(s, env) {
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

function finalizeEnumeration(s, env) {
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
  addMethods(s, env);
  return constructor;
}

function finalizeOptional(s, env) {
  const {
    byteSize,
    align,
    instance: { members },
    options,
    hasPointer,
  } = s;
  const { get: getValue, set: setValue } = getAccessors(members[0], options);
  const { get: getPresent, set: setPresent } = getAccessors(members[1], options);
  const reset = getMemoryResetter(byteSize);
  const get = function() {
    const present = getPresent.call(this);
    if (present) {
      return getValue.call(this);
    } else {
      this[POINTER_VISITOR]?.(resetPointer);
      return null;
    }
  };
  const set = function(value) {
    if (value != null) {
      setPresent.call(this, true);
      setValue.call(this, value);
    } else {
      reset(this[MEMORY]);
      this[POINTER_VISITOR]?.(resetPointer);
    }
  };
  const check = getPresent;
  const hasObject = !!members.find(m => m.type === MemberType.Object);
  const ptrAlign = getPointerAlign(align);
  const constructor = s.constructor = function(arg) {
    const creating = this instanceof constructor;
    let self, dv;
    if (creating) {
      if (arguments.length === 0) {
        throwNoInitializer(s);
      }
      self = this;
      dv = env.createBuffer(byteSize, ptrAlign);
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
  const copy = getMemoryCopier(byteSize);
  const initializer = function(arg) {
    if (arg instanceof constructor) {
      /* WASM-ONLY */
      restoreMemory.call(this);
      restoreMemory.call(arg);
      /* WASM-ONLY-END */
      copy(this[MEMORY], arg[MEMORY]);
      if (hasPointer) {
        // don't bother copying pointers when it's empty
        if (check.call(this)) {
          this[POINTER_VISITOR](copyPointer, { vivificate: true, source: arg});
        }
      }
    } else {
      this.$ = arg;
    }
  };
  Object.defineProperty(constructor.prototype, '$', { get, set, configurable: true });
  if (hasObject) {
    addChildVivificators(s);
    if (hasPointer) {
      // function used by pointer visitor to see whether pointer field is active
      Object.defineProperty(constructor.prototype, FIELD_VALIDATOR, { value: check });
      addPointerVisitor(s);
    }
  }
  addSpecialAccessors(s);
  return constructor;
}

function finalizeSlice(s, env) {
  const {
    align,
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
  const ptrAlign = getPointerAlign(align);
  // the slices are different from other structures due to variability of their sizes
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
  const shapeDefiner = function(dv, length) {
    if (!dv) {
      dv = env.createBuffer(length * elementSize, ptrAlign);
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
      /* WASM-ONLY */
      restoreMemory.call(this);
      restoreMemory.call(arg);
      /* WASM-ONLY-END */
      copy(this[MEMORY], arg[MEMORY]);
      if (hasPointer) {
        this[POINTER_VISITOR](copyPointer, { source: arg });
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
        for (const key of Object.keys(arg)) {
          if (!(key in this)) {
            throwNoProperty$1(s, key);
          }
        }
        let specialFound = 0;
        for (const key of specialKeys) {
          if (key in arg) {
            specialFound++;
          }
        }
        if (specialFound === 0) {
          throwInvalidArrayInitializer(s, arg);
        }
        for (const key of specialKeys) {
          if (key in arg) {
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
  /* DEV-TEST */
  /* c8 ignore next 3 */
  if (sentinel.bitOffset === undefined) {
    throw new Error(`bitOffset must be 0 for sentinel member`);
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
  const bytes = template[MEMORY];
  return { value, bytes, validateValue, validateData };
}

function finalizeVector(s, env) {
  const {
    length,
    byteSize,
    align,
    instance: {
      members: [ member ],
    },
    options,
  } = s;
  addTypedArray(s);
  const ptrAlign = getPointerAlign(align);
  const constructor = s.constructor = function(arg) {
    const creating = this instanceof constructor;
    let self, dv;
    if (creating) {
      if (arguments.length === 0) {
        throwNoInitializer(s);
      }
      self = this;
      dv = env.createBuffer(byteSize, ptrAlign);
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
  const { bitSize: elementBitSize, structure: elementStructure } = member;
  const copy = getMemoryCopier(byteSize);
  const initializer = function(arg) {
    if (arg instanceof constructor) {
      /* WASM-ONLY */
      restoreMemory.call(this);
      restoreMemory.call(arg);
      /* WASM-ONLY-END */
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
      } else if (arg !== undefined) {
        throwInvalidArrayInitializer(s, arg);
      }
    }
  };
  for (let i = 0, bitOffset = 0; i < length; i++, bitOffset += elementBitSize) {
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

function finalizeArgStruct(s, env) {
  const {
    byteSize,
    align,
    instance: {
      members,
    },
    hasPointer,
    options,
  } = s;
  const hasObject = !!members.find(m => m.type === MemberType.Object);
  const ptrAlign = getPointerAlign(align);
  const constructor = s.constructor = function(args) {
    const dv = env.createBuffer(byteSize, ptrAlign);
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
    if (hasPointer) {
      addPointerVisitor(s);
    }
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

function getStructureName(s, full = false) {
  let r = s.name;
  if (!full) {
    r = r.replace(/{.*}/, '');
    r = r.replace(/[^. ]*?\./g, '');
  }
  return r;
}

function getStructureFactory(type) {
  const f = factories[type];
  return f;
}

let decoder;

function decodeText(arrays, encoding = 'utf-8') {
  if (!decoder) {
    decoder = new TextDecoder;
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
      array = new Uint8Array(len);
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

const default_alignment = 16;

class Environment {
  /*
  Functions to be defined in subclass:

  getAddress(buffer: ArrayBuffer): bigInt|number {
    // return a buffer's address
  }
  obtainView(address: bigInt|number, len: number): DataView {
    // obtain a data view of memory at given address
  }
  copyBytes(dst: DataView, address: bigInt|number, len: number): void {
    // copy memory at given address into destination view
  }
  findSentinel(address, bytes: DataView): number {
    // return offset where sentinel value is found
  }
  isShared(dv: DataView): boolean {
    // return true/false depending on whether view is point to shared memory
  }
  */
  context;
  contextStack = [];
  consolePending = [];
  consoleTimeout = 0;
  slots = {}

  startContext() {
    if (this.context) {
      this.contextStack.push(this.context);
    }
    this.context = new CallContext();
  }

  endContext() {
    this.context = this.contextStack.pop();
  }

  rememberPointer(pointer) {
    const { pointerProcessed } = this.context;
    if (pointerProcessed.get(pointer)) {
      return true;
    } else {
      pointerProcessed.set(pointer, true);
      this.importMemory(pointer[MEMORY]);
      return false;
    }
  }

  importMemory(dv) {
    const { memoryList } = this.context;
    const { buffer } = dv;
    const address = this.getAddress(buffer);
    const index = findSortedIndex(memoryList, address);
    const prev = memoryList[index - 1];
    if (!(prev?.address <= address && address < addLength(prev.address, prev.len))) {
      memoryList.splice(index, 0, { address, buffer, len: buffer.byteLength });
    }
    return addLength(address, dv.byteOffset);
  }

  findMemory(address, len) {
    if (this.context) {
      const { memoryList } = this.context;
      const index = findSortedIndex(memoryList, address);
      const prev = memoryList[index - 1];
      if (prev?.address <= address && address < addLength(prev.address, prev.len)) {
        const offset = Number(address - prev.address);
        return new DataView(prev.buffer, offset, len);
      }
    }
    // not found in any of the buffers we've seen--assume it's shared memory
    return this.obtainView(address, len);
  }

  getViewAddress(dv) {
    const address = this.getAddress(dv.buffer);
    const offset = (typeof(address) === 'bigint') ? BigInt(dv.byteOffset) : dv.byteOffset;
    return address + offset;
  }

  createBuffer(len, ptrAlign) {
    const extra = getExtraCount(ptrAlign);
    const buffer = new ArrayBuffer(len + extra);
    let offset = 0;
    if (extra !== 0) {
      const address = this.getAddress(buffer);
      const mask = ~(extra - 1);
      const aligned = (address & mask) + extra;
      offset = aligned - address;
    }
    return new DataView(buffer, offset, len);
  }

  allocMemory(len, ptrAlign) {
    const dv = this.createBuffer(len, ptrAlign);
    this.importMemory(dv);
    return dv;
  }

  freeMemory(address, len, ptrAlign) {
    const { memoryList } = this.context;
    const index = findSortedIndex(memoryList, address);
    const prev = memoryList[index - 1];
    if (prev?.address <= address && address < addLength(prev.address, prev.len)) {
      let prevAddress = prev.address;
      const extra = getExtraCount(ptrAlign);
      if (extra) {
        const mask = ~(extra - 1);
        prevAddress = (prevAddress & mask) + extra;
      }
      if (prevAddress === address) {
        memoryList.splice(index - 1, 1);
      }
    }
  }

  createView(address, len, ptrAlign, copy) {
    if (copy) {
      const dv = this.createBuffer(len, ptrAlign);
      this.copyBytes(dv, address, len);
      return dv;
    } else {
      return this.obtainView(address, len);
    }
  }

  castView(structure, dv) {
    const { constructor, hasPointer } = structure;
    const object = constructor.call(ENVIRONMENT, dv);
    if (hasPointer) {
      // vivificate pointers and acquire their targets
      object[POINTER_VISITOR](acquireTarget, { vivificate: true });
    }
    return object;
  }

  createObject(structure, arg) {
    const { constructor } = structure;
    return new constructor(arg);
  }

  readSlot(target, slot) {
    const slots = target ? target[SLOTS] : this.slots;
    return slots?.[slot];
  }

  writeSlot(target, slot, value) {
    const slots = target ? target[SLOTS] : this.slots;
    if (slots) {
      slots[slot] = value;
    }
  }


  /* RUNTIME-ONLY */
  finalizeStructure(s) {
    try {
      const f = getStructureFactory(s.type);
      const constructor = f(s, this);
      if (typeof(constructor) === 'function') {
        Object.defineProperties(constructor, {
          name: { value: getStructureName(s), writable: false }
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

  createCaller(method, useThis) {
    let { name,  argStruct, thunk } = method;
    const { constructor, hasPointer } = argStruct;
    const self = this;
    let f;
    if (useThis) {
      f = function(...args) {
        return self.invokeThunk(thunk, new constructor([ this, ...args ]), hasPointer);
      };
    } else {
      f = function(...args) {
        return self.invokeThunk(thunk, new constructor(args), hasPointer);
      };
    }
    Object.defineProperty(f, 'name', { value: name });
    return f;
  }
  /* RUNTIME-ONLY-END */

  writeToConsole(dv) {
    try {
      const array = new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength);
      // send text up to the last newline character
      const index = array.lastIndexOf(0x0a);
      if (index === -1) {
        this.consolePending.push(array);
      } else {
        const beginning = array.subarray(0, index);
        const remaining = array.slice(index + 1);   // copying, in case incoming buffer is pointing to stack memory
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
}


/* WASM-ONLY */
class WebAssemblyEnvironment extends Environment {
  nextValueIndex = 1;
  valueTable = { 0: null };
  valueIndices = new Map;
  memory = null;
  expectedMethods = {
    alloc: { name: 'allocSharedMemory', argType: 'iii', returnType: 'i' },
    free: { name: 'freeSharedMemory', argType: 'iiii', returnType: '' },
    run: { name: 'runThunk', argType: 'iv', returnType: 'v' },
    safe: { name: 'isRuntimeSafetyActive', argType: '', returnType: 'b' },
  };

  constructor() {
    super();
  }

  releaseObjects() {
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
    return (...args) => {
      args = args.map((arg, i) => this.toWebAssembly(argType.charAt(i), arg));
      const retval = fn.apply(this, args);
      return this.fromWebAssembly(returnType, retval);
    };
  }

  exportFunctions() {
    return {
      _allocMemory: this.exportFunction(this.allocMemory, 'ii', 'v'),
      _freeMemory: this.exportFunction(this.freeMemory, 'iii', ''),
      _createString: this.exportFunction(this.createString, 'ii', 'v'),
      _createObject: this.exportFunction(this.createObject, 'vv', 's'),
      _createView: this.exportFunction(this.createView, 'ii', 'v'),
      _castView: this.exportFunction(this.castView, 'vv', 'v'),
      _readSlot: this.exportFunction(this.readSlot, 'vi', 'v'),
      _writeSlot: this.exportFunction(this.writeSlot, 'viv'),
      _beginDefinition: this.exportFunction(this.beginDefinition, '', 'v'),
      _insertInteger: this.exportFunction(this.insertProperty, 'vsi'),
      _insertBoolean: this.exportFunction(this.insertProperty, 'vsb'),
      _insertString: this.exportFunction(this.insertProperty, 'vss'),
      _insertObject: this.exportFunction(this.insertProperty, 'vsv'),
      _beginStructure: this.exportFunction(this.beginStructure, 'v', 'v'),
      _attachMember: this.exportFunction(this.attachMember, 'vvb'),
      _attachMethod: this.exportFunction(this.attachMethod, 'vvb'),
      _createTemplate: this.exportFunction(this.attachMethod, 'v'),
      _attachTemplate: this.exportFunction(this.attachTemplate, 'vvb'),
      _finalizeStructure: this.exportFunction(this.finalizeStructure, 'v'),
      _writeToConsole: this.exportFunction(this.writeToConsole, 'v', ''),
      _startCall: this.exportFunction(this.startCall, 'iv', 'i'),
      _endCall: this.exportFunction(this.endCall, 'v', 'i'),
    }
  }

  importFunctions(exports) {
    for (const [ name, fn ] of Object.entries(exports)) {
      const info = this.expectedMethods[name];
      if (info) {
        const { name, argType, returnType } = info;
        this[name] = this.importFunction(fn, argType, returnType);
      }
    }
  }

  releaseFunctions() {
    const throwError = function() {
      throw new Error('WebAssembly instance was abandoned');
    };
    for (const { name } of Object.values(this.expectedMethods)) {
      if (this[name]) {
        this[name] = throwError;
      }
    }
  }

  async instantiateWebAssembly(source) {
    const env = this.exportFunctions();
    if (source[Symbol.toStringTag] === 'Response') {
      return WebAssembly.instantiateStreaming(source, { env });
    } else {
      const buffer = await source;
      return WebAssembly.instantiate(buffer, { env });
    }
  }

  async loadWebAssembly(source) {
    const { instance } = await this.instantiateWebAssembly(source);
    this.memory = instance.exports.memory;
    this.importFunctions(instance.exports);
    // create a WeakRef so that we know whether the instance is gc'ed or not
    const weakRef = new WeakRef(instance);
    return {
      abandon: () => {
        this.memory = null;
        this.releaseFunctions();
        this.unlinkVariables();
      },
      released: () => {
        return !weakRef.deref();
      }
    }
  }

  isShared(dv) {
    return dv.buffer === this.memory.buffer;
  }

  getAddress(buffer) {
    if (buffer === this.memory.buffer) {
      return 0;
    } else {
      throw new Error('Unable to obtain address of ArrayBuffer');
    }
  }

  obtainView(address, len) {
    const { buffer } = this.memory;
    return new DataView(buffer, address, len);
  }

  createString(address, len) {
    const { buffer } = this.memory;
    const ta = new Uint8Array(buffer, address, len);
    return decodeText(ta);
  }

  startCall(call, args) {
    this.startContext();
    // call context, use by allocSharedMemory and freeSharedMemory
    this.context.call = call;
    if (!args) {
      // can't be 0 since that sets off Zig's runtime safety check
      return 0xaaaaaaaa;
    }
    console.log({ args });
  }

  endCall(call, args) {
    this.endContext();
  }


  /* RUNTIME-ONLY */
  finalizeStructures(structures) {
    initializeErrorSets();
    for (const structure of structures) {
      for (const target of [ structure.static, structure.instance ]) {
        // first create the actual template using the provided placeholder
        if (target.template) {
          target.template = createTemplate(target.template);
        }
      }
      super.finalizeStructure(structure);
      // place structure into its assigned slot
      this.slots[structure.slot] = structure;
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
        const { byteSize } = placeholder.structure;
        dv = new DataView(new ArrayBuffer(byteSize));
      }
      const object = this.castObject(placeholder.structure, dv);
      if (placeholder.slots) {
        insertObjects(object[SLOTS], placeholder.slots);
      }
      if (placeholder.address !== undefined) {
        // need to replace dataview with one pointing to WASM memory later,
        // when the VM is up and running
        this.variables.push({ address: placeholder.address, object });
      }
      return object;
    }

    let resolve, reject;
    const promise = new Promise((r1, r2) => {
      resolve = r1;
      reject = r2;
    });
    this.runThunk = function(index, argStruct) {
      // wait for linking to occur, then call function again
      // this.runThunk should have been replaced
      return promise.then(() => this.runThunk(index, argStruct));
    };
    return { resolve, reject };
  }

  async linkWebAssembly(source, params) {
    const zigar = await this.loadWebAssembly(source);
    return zigar;
  }

  invokeThunk(thunk, args) {
    // WASM thunks aren't functions--they're indices into the function table 0
    // wasm-exporter.zig will invoke startCall() with the context address and the args
    // we can't do pointer fix up here since we need the context in order to allocate
    // memory from the WebAssembly allocator; point target acquisition will happen in
    // endCall()
    const err = this.runThunk(thunk, args);

    // errors returned by exported Zig functions are normally written into the
    // argument object and get thrown when we access its retval property (a zig error union)
    // error strings returned by the thunk are due to problems in the thunking process
    // (i.e. bugs in export.zig)
    if (err) {
      throwZigError(err);
    }
    return args.retval;
  }
  /* RUNTIME-ONLY */
}
/* WASM-ONLY-END */

class CallContext {
  pointerProcessed = new Map();
  memoryList = [];
}

function getExtraCount(ptrAlign) {
  const alignment = (1 << ptrAlign);
  return (alignment <= default_alignment) ? 0 : alignment;
}

function findSortedIndex(array, address) {
  let low = 0;
  let high = array.length;
  if (high === 0) {
    return 0;
  }
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    const address2 = array[mid].address;
    if (address2 <= address) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
  return high;
}

function addLength(address, len) {
  return address + ((typeof(address) === 'bigint') ? BigInt(len) : len);
}

export { WebAssemblyEnvironment, useArgStruct, useArray, useBareUnion, useBool, useBoolEx, useEnumeration, useEnumerationItem, useEnumerationItemEx, useErrorSet, useErrorUnion, useExternUnion, useFloat, useFloatEx, useInt, useIntEx, useObject, useOpaque, useOptional, usePointer, usePrimitive, useSlice, useStruct, useTaggedUnion, useType, useUint, useUintEx, useVector, useVoid };
