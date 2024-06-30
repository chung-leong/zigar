const MemberType = {
  Void: 0,
  Bool: 1,
  Int: 2,
  Uint: 3,
  Float: 4,
  Object: 5,
  Type: 6,
  Comptime: 7,
  Static: 8,
  Literal: 9,
  Null: 10,
  Undefined: 11,
  Unsupported: 12,
};

const StructureType = {
  Primitive: 0,
  Array: 1,
  Struct: 2,
  ExternStruct: 3,
  PackedStruct: 4,
  ArgStruct: 5,
  VariadicStruct: 6,
  ExternUnion: 7,
  BareUnion: 8,
  TaggedUnion: 9,
  ErrorUnion: 10,
  ErrorSet: 11,
  Enum: 12,
  Optional: 13,
  SinglePointer: 14,
  SlicePointer: 15,
  MultiPointer: 16,
  CPointer: 17,
  Slice: 18,
  Vector: 19,
  Opaque: 20,
  Function: 21,
};

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

function getStructureName(n) {
  for (const [ name, value ] of Object.entries(StructureType)) {
    if (value === n) {
      return name.replace(/\B[A-Z]/g, m => ` ${m}`).toLowerCase();
    }
  }
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

function isPointer(type) {
  switch (type) {
    case StructureType.SinglePointer:
    case StructureType.SlicePointer:
    case StructureType.MultiPointer:
    case StructureType.CPointer:
      return true;
    default:
      return false;
  }
}

function isArrayLike(type) {
  return type === StructureType.Array || type === StructureType.Vector || type === StructureType.Slice;
}

function isByteAligned({ bitOffset, bitSize, byteSize }) {
  return byteSize !== undefined || (!(bitOffset & 0x07) && !(bitSize & 0x07)) || bitSize === 0;
}

function isErrorJSON(arg) {
  return typeof(arg) === 'object' && typeof(arg.error) === 'string' && Object.keys(arg).length === 1  ;
}

class Unsupported extends TypeError {
  constructor() {
    super(`Unsupported`);
  }
}

class NoInitializer extends TypeError {
  constructor(structure) {
    const { name } = structure;
    super(`An initializer must be provided to the constructor of ${name}, even when the intended value is undefined`);
  }
}

class BufferSizeMismatch extends TypeError {
  constructor(structure, dv, target = null) {
    const { name, type, byteSize } = structure;
    const actual = dv.byteLength;
    const s = (byteSize !== 1) ? 's' : '';
    let msg;
    if (type === StructureType.Slice && !target) {
      msg = `${name} has elements that are ${byteSize} byte${s} in length, received ${actual}`;
    } else {
      const total = (type === StructureType.Slice) ? target.length * byteSize : byteSize;
      msg = `${name} has ${total} byte${s}, received ${actual}`;
    }
    super(msg);
  }
}

class BufferExpected extends TypeError {
  constructor(structure) {
    const { type, byteSize, typedArray } = structure;
    const s = (byteSize !== 1) ? 's' : '';
    const acceptable = [ 'ArrayBuffer', 'DataView' ].map(addArticle);
    if (typedArray) {
      acceptable.push(addArticle(typedArray.name));
    }
    let msg;
    if (type === StructureType.Slice) {
      msg = `Expecting ${formatList(acceptable)} that can accommodate items ${byteSize} byte${s} in length`;
    } else {
      msg = `Expecting ${formatList(acceptable)} that is ${byteSize} byte${s} in length`;
    }
    super(msg);
  }
}

class EnumExpected extends TypeError {
  constructor(structure, arg) {
    const { name } = structure;
    let msg;
    if (typeof(arg) === 'number' || typeof(arg) === 'bigint') {
      msg = `Value given does not correspond to an item of enum ${name}: ${arg}`;
    } else {
      msg = `Enum item of the type ${name} expected, received ${arg}`;
    }
    super(msg);
  }
}

class ErrorExpected extends TypeError {
  constructor(structure, arg) {
    const { name } = structure;
    const type = typeof(arg);
    let msg;
    if (type === 'string' || type === 'number' || isErrorJSON(arg)) {
      if (isErrorJSON(arg)) {
        arg = `{ error: ${JSON.stringify(arg.error)} }`;
      }
      msg = `Error ${type} does not corresponds to any error in error set ${name}: ${arg}`;
    } else {
      msg = `Error of the type ${name} expected, received ${arg}`;
    }
    super(msg);
  }
}

class NotInErrorSet extends TypeError {
  constructor(structure) {
    const { name } = structure;
    super(`Error given is not a part of error set ${name}`);
  }
}

class MultipleUnionInitializers extends TypeError {
  constructor(structure) {
    const { name } = structure;
    super(`Only one property of ${name} can be given a value`);
  }
}

class InactiveUnionProperty extends TypeError {
  constructor(structure, name, currentName) {
    super(`Accessing property ${name} when ${currentName} is active`);
  }
}

class MissingUnionInitializer extends TypeError {
  constructor(structure, arg, exclusion) {
    const { name, instance: { members } } = structure;
    const missing = members.slice(0, exclusion ? -1 : undefined).map(m => m.name);
    super(`${name} needs an initializer for one of its union properties: ${missing.join(', ')}`);
  }
}

class InvalidInitializer extends TypeError {
  constructor(structure, expected, arg) {
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
    super(`${name} expects ${formatList(acceptable)} as argument, received ${received}`);
  }
}

class InvalidArrayInitializer extends InvalidInitializer {
  constructor(structure, arg, shapeless = false) {
    const { instance: { members: [ member ] }, type, typedArray } = structure;
    const acceptable = [];
    const primitive = getPrimitiveType(member);
    if (primitive) {
      let object;
      switch (member.structure?.type) {
        case StructureType.Enum: object = 'enum item'; break;
        case StructureType.ErrorSet: object = 'error'; break;
        default: object = primitive;
      }
      acceptable.push(`array of ${object}s`);
    } else {
      acceptable.push(`array of objects`);
    }
    if (typedArray) {
      acceptable.push(typedArray.name);
    }
    if (type === StructureType.Slice && shapeless) {
      acceptable.push(`length`);
    }
    super(structure, acceptable.join(' or '), arg);
  }
}

class ArrayLengthMismatch extends TypeError {
  constructor(structure, target, arg) {
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
    super(`${name} has ${actualLength} element${s}, received ${received}`);
  }
}

class InvalidSliceLength extends TypeError {
  constructor(length, max) {
    if (length < 0) {
      super(`Length of slice cannot be negative`);
    } else {
      super(`Length of slice must be less than ${max}, received ${length}`);
    }
  }
}

class MissingInitializers extends TypeError {
  constructor(structure, missing) {
    const { name } = structure;
    super(`Missing initializers for ${name}: ${missing.join(', ')}`);
  }
}

class NoProperty extends TypeError {
  constructor(structure, propName) {
    const { name, instance: { members } } = structure;
    const member = members.find(m => m.name === propName);
    let msg;
    if (member) {
      msg = `Comptime value cannot be changed: ${propName}`;
    } else {
      msg = `${name} does not have a property with that name: ${propName}`;
    }
    super(msg);
  }
}

class ArgumentCountMismatch extends Error {
  constructor(name, expected, actual) {
    const s = (expected !== 1) ? 's' : '';
    super(`${name}() expects ${expected} argument${s}, received ${actual}`);
  }
}

class NoCastingToPointer extends TypeError {
  constructor(structure) {
    super(`Non-slice pointers can only be created with the help of the new operator`);
  }
}

class ConstantConstraint extends TypeError {
  constructor(structure, pointer) {
    const { name: target } = structure;
    const { constructor: { name } } = pointer;
    super(`Conversion of ${name} to ${target} requires an explicit cast`);
  }
}

class MisplacedSentinel extends TypeError {
  constructor(structure, value, index, length) {
    const { name } = structure;
    super(`${name} expects the sentinel value ${value} at ${length - 1}, found at ${index}`);
  }
}

class MissingSentinel extends TypeError {
  constructor(structure, value, length) {
    const { name } = structure;
    super(`${name} expects the sentinel value ${value} at ${length - 1}`);
  }
}

class AlignmentConflict extends TypeError {
  constructor(align1, align2) {
    super(`Unable to simultaneously align memory to ${align2}-byte and ${align1}-byte boundary`);
  }
}

class TypeMismatch extends TypeError {
  constructor(expected, arg) {
    const received = getDescription(arg);
    super(`Expected ${addArticle(expected)}, received ${received}`);
  }
}

class InaccessiblePointer extends TypeError {
  constructor() {
    super(`Pointers within an untagged union are not accessible`);
  }
}

class NullPointer extends TypeError {
  constructor() {
    super(`Null pointer`);
  }
}

class InvalidPointerTarget extends TypeError {
  constructor(structure, arg) {
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
    super(`${name} cannot point to ${target}`);
  }
}

class FixedMemoryTargetRequired extends TypeError {
  constructor(structure, arg) {
    super(`Pointers in fixed memory cannot point to garbage-collected object`);
  }
}

class Overflow extends TypeError {
  constructor(member, value) {
    const typeName = getTypeName(member);
    super(`${typeName} cannot represent the value given: ${value}`);
  }
}

class OutOfBound extends RangeError {
  constructor(member, index) {
    const { name } = member;
    super(`Index exceeds the size of ${name ?? 'array'}: ${index}`);
  }
}

class NotUndefined extends TypeError {
  constructor(member) {
    const { name } = member;
    const rvalue = (name !== undefined) ? `Property ${name}` : `Element`;
    super(`${rvalue} can only be undefined`);
  }
}

class NotOnByteBoundary extends TypeError {
  constructor(member) {
    const { name, structure: { name: { struct }} } = member;
    super(`Unable to create ${struct} as it is not situated on a byte boundary: ${name}`);
  }
}

class ReadOnly extends TypeError {
  constructor() {
    super(`Unable to modify read-only object`);
  }
}

class ReadOnlyTarget extends TypeError {
  constructor(structure) {
    const { name } = structure;
    super(`${name} cannot point to a read-only object`);
  }
}

class AccessingOpaque extends TypeError {
  constructor(structure) {
    const { name } = structure;
    super(`Unable to access opaque structure ${name}`);
  }
}

class CreatingOpaque extends TypeError {
  constructor(structure) {
    const { name } = structure;
    super(`Unable to create instance of ${name}, as it is opaque`);
  }
}

class InvalidVariadicArgument extends TypeError {
  constructor() {
    super(`Arguments passed to variadic function must be casted to a Zig type`);
  }
}

class ZigError extends Error {
  constructor(name) {
    super(deanimalizeErrorName(name));
  }
}

class Exit extends ZigError {
  constructor(code) {
    super('Program exited');
    this.code = code;
  }
}

function adjustArgumentError(name, index, argCount, err) {
  // Zig currently does not provide the argument name
  const argName = `args[${index}]`;
  const prefix = (index !== 0) ? '..., ' : '';
  const suffix = (index !== argCount - 1) ? ', ...' : '';
  const argLabel = prefix + argName + suffix;
  const newError = Object.create(err.constructor.prototype);
  newError.message = `${name}(${argLabel}): ${err.message}`;
  newError.stack = err.stack;
  return newError;
}

function adjustRangeError(member, index, err) {
  if (err instanceof RangeError && !(err instanceof OutOfBound)) {
    err = new OutOfBound(member, index);
  }
  return err;
}

function throwReadOnly() {
  throw new ReadOnly();
}

function warnImplicitArrayCreation(structure, arg) {
  const created = addArticle(structure.typedArray.name);
  const source = addArticle(arg.constructor.name);
  console.warn(`Implicitly creating ${created} from ${source}`);
}

function deanimalizeErrorName(name) {
  // deal with snake_case first
  let s = name.replace(/_/g, ' ');
  // then camelCase, using a try block in case Unicode regex fails
  try {
    s = s.replace(/(\p{Uppercase}+)(\p{Lowercase}*)/gu, (m0, m1, m2) => {
      if (m1.length === 1) {
        return ` ${m1.toLocaleLowerCase()}${m2}`;
      } else {
        if (m2) {
          return m0;
        } else {
          return ` ${m1}`;
        }
      }
    }).trimStart();
    /* c8 ignore next 2 */
  } catch (err) {
  }
  return s.charAt(0).toLocaleUpperCase() + s.substring(1);
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

const MEMORY = Symbol('memory');
const SLOTS = Symbol('slots');
const PARENT = Symbol('parent');
const FIXED = Symbol('fixed');
const NAME = Symbol('name');
const TYPE = Symbol('type');
const TUPLE = Symbol('tuple');
const CLASS = Symbol('class');
const TAG = Symbol('tag');
const PROPS = Symbol('props');
const GETTER = Symbol('getter');
const SETTER = Symbol('setter');
const ELEMENT_GETTER = Symbol('elementGetter');
const ELEMENT_SETTER = Symbol('elementSetter');
const TARGET_GETTER = Symbol('targetGetter');
const TARGET_SETTER = Symbol('targetSetter');
const ENTRIES_GETTER = Symbol('entriesGetter');
const ADDRESS_SETTER = Symbol('addressSetter');
const LENGTH_SETTER = Symbol('lengthSetter');
const TARGET_UPDATER = Symbol('targetUpdater');
const MAX_LENGTH = Symbol('maxLength');
const PROP_GETTERS = Symbol('propGetters');
const PROP_SETTERS = Symbol('propSetters');
const MEMORY_RESTORER = Symbol('memoryRestorer');
const WRITE_DISABLER = Symbol('writeDisabler');
const ALL_KEYS = Symbol('allKeys');
const ADDRESS = Symbol('address');
const LENGTH = Symbol('length');
const PROXY = Symbol('proxy');
const COMPAT = Symbol('compat');
const CACHE = Symbol('cache');
const SIZE = Symbol('size');
const ALIGN = Symbol('align');
const ARRAY = Symbol('array');
const POINTER = Symbol('pointer');
const CONST_TARGET = Symbol('constTarget');
const CONST_PROXY = Symbol('constProxy');
const COPIER = Symbol('copier');
const RESETTER = Symbol('resetter');
const VIVIFICATOR = Symbol('vivificator');
const POINTER_VISITOR = Symbol('pointerVisitor');
const ENVIRONMENT = Symbol('environment');
const ATTRIBUTES = Symbol('attributes');
const MORE = Symbol('more');
const PRIMITIVE = Symbol('primitive');

function getDestructor(env) {
  return function() {
    const dv = this[MEMORY];
    this[MEMORY] = null;
    if (this[SLOTS]) {
      this[SLOTS] = {};
    }
    if (dv[FIXED]) {
      env.releaseFixedView(dv);
    }
  };
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
  const copy = getCopyFunction(size, multiple);
  return function(target) {
    /* WASM-ONLY */
    this[MEMORY_RESTORER]?.();
    target[MEMORY_RESTORER]?.();
    /* WASM-ONLY-END */
    const src = target[MEMORY];
    const dest = this[MEMORY];
    copy(dest, src);
  };
}

function getCopyFunction(size, multiple = false) {
  if (size !== undefined) {
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
  } else {
    return copyAny;
  }
}

function copyAny(dest, src) {
  const copy = getCopyFunction(dest.byteLength);
  copy(dest, src);
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

function getMemoryResetter(offset, size) {
  const reset = getResetFunction(size);
  return function() {
    /* WASM-ONLY */
    this[MEMORY_RESTORER]?.();
    /* WASM-ONLY-END */
    const dest = this[MEMORY];
    reset(dest, offset, size);
  };
}

function getResetFunction(size) {
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

function reset1x(dest, offset, size) {
  for (let i = offset, limit = offset + size; i < limit; i++) {
    dest.setInt8(i, 0);
  }
}

function reset2x(dest, offset, size) {
  for (let i = offset, limit = offset + size; i < limit; i += 2) {
    dest.setInt16(i, 0, true);
  }
}

function reset4x(dest, offset, size) {
  for (let i = offset, limit = offset + size; i < limit; i += 4) {
    dest.setInt32(i, 0, true);
  }
}

function reset8x(dest, offset, size) {
  for (let i = offset, limit = offset + size; i < limit; i += 8) {
    dest.setInt32(i, 0, true);
    dest.setInt32(i + 4, 0, true);
  }
}

function reset1(dest, offset) {
  dest.setInt8(offset, 0);
}

function reset2(dest, offset) {
  dest.setInt16(offset, 0, true);
}

function reset4(dest, offset) {
  dest.setInt32(offset, 0, true);
}

function reset8(dest, offset) {
  dest.setInt32(offset + 0, 0, true);
  dest.setInt32(offset + 4, 0, true);
}

function reset16(dest, offset) {
  dest.setInt32(offset + 0, 0, true);
  dest.setInt32(offset + 4, 0, true);
  dest.setInt32(offset + 8, 0, true);
  dest.setInt32(offset + 12, 0, true);
}

function reset32(dest, offset) {
  dest.setInt32(offset + 0, 0, true);
  dest.setInt32(offset + 4, 0, true);
  dest.setInt32(offset + 8, 0, true);
  dest.setInt32(offset + 12, 0, true);
  dest.setInt32(offset + 16, 0, true);
  dest.setInt32(offset + 20, 0, true);
  dest.setInt32(offset + 24, 0, true);
  dest.setInt32(offset + 28, 0, true);
}

function getBoolAccessor(access, member) {
  return cacheMethod(access, member, () => {
    if (isByteAligned(member)) {
      const { byteSize } = member;
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
    } else {
      return getExtendedTypeAccessor(access, member);
    }
  });
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

const factories$2 = {};

function useExtendedBool() {
  factories$2[MemberType.Bool] = getExtendedBoolAccessor;
}

function useExtendedInt() {
  factories$2[MemberType.Int] = getExtendedIntAccessor;
}

function useExtendedUint() {
  factories$2[MemberType.Uint] = getExtendedUintAccessor;
}

function useExtendedFloat() {
  factories$2[MemberType.Float] = getExtendedFloatAccessor;
}

function getExtendedTypeAccessor(access, member) {
  const f = factories$2[member.type];
  return f(access, member);
}

function getExtendedBoolAccessor(access, member) {
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
}

function getExtendedIntAccessor(access, member) {
  if (isByteAligned(member)) {
    return getAlignedIntAccessor(access, member)
  } else {
    return getUnalignedIntAccessor(access, member);
  }
}

function getExtendedUintAccessor(access, member) {
  if (isByteAligned(member)) {
    return getAlignedUintAccessor(access, member)
  } else {
    return getUnalignedUintAccessor(access, member);
  }
}

function getExtendedFloatAccessor(access, member) {
  if (isByteAligned(member)) {
    return getAlignedFloatAccessor(access, member)
  } else {
    return getUnalignedFloatAccessor(access, member);
  }
}

function getDataView(structure, arg, env) {
  const { type, byteSize, typedArray } = structure;
  let dv;
  // not using instanceof just in case we're getting objects created in other contexts
  const tag = arg?.[Symbol.toStringTag];
  if (tag === 'DataView') {
    // capture relationship between the view and its buffer
    dv = env.registerView(arg);
  } else if (tag === 'ArrayBuffer' || tag === 'SharedArrayBuffer') {
    dv = env.obtainView(arg, 0, arg.byteLength);
  } else if (typedArray && tag === typedArray.name || (tag === 'Uint8ClampedArray' && typedArray === Uint8Array)) {
    dv = env.obtainView(arg.buffer, arg.byteOffset, arg.byteLength);
  } else if (tag === 'Uint8Array' && typeof(Buffer) === 'function' && arg instanceof Buffer) {
    dv = env.obtainView(arg.buffer, arg.byteOffset, arg.byteLength);
  } else {
    const memory = arg?.[MEMORY];
    if (memory) {
      // arg a Zig data object
      const { constructor, instance: { members: [ member ] } } = structure;
      if (arg instanceof constructor) {
        // same type, no problem
        return memory;
      } else {
        if (isArrayLike(type)) {
          // make sure the arg has the same type of elements
          const { byteSize: elementSize, structure: { constructor: Child } } = member;
          const number = findElements(arg, Child);
          if (number !== undefined) {
            if (type === StructureType.Slice || number * elementSize === byteSize) {
              return memory;
            } else {
              throw new ArrayLengthMismatch(structure, null, arg);
            }
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
    throw new TypeMismatch('a DataView', dv);
  }
  return dv;
}

function checkDataViewSize(dv, structure) {
  const { byteSize, type } = structure;
  const isSizeMatching = type === StructureType.Slice
  ? dv.byteLength % byteSize === 0
  : dv.byteLength === byteSize;
  if (!isSizeMatching) {
    throw new BufferSizeMismatch(structure, dv);
  }
}

function setDataView(dv, structure, copy, fixed, handlers) {
  const { byteSize, type, sentinel } = structure;
  if (!this[MEMORY]) {
    const { shapeDefiner } = handlers;
    checkDataViewSize(dv, structure);
    const len = dv.byteLength / byteSize;
    const source = { [MEMORY]: dv };
    sentinel?.validateData(source, len);
    if (fixed) {
      // need to copy when target object is in fixed memory
      copy = true;
    }
    shapeDefiner.call(this, copy ? null : dv, len, fixed);
    if (copy) {
      this[COPIER](source);
    }
  } else {
    const byteLength = (type === StructureType.Slice) ? byteSize * this.length : byteSize;
    if (dv.byteLength !== byteLength) {
      throw new BufferSizeMismatch(structure, dv, this);
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
    throw new BufferExpected(structure);
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
  } else if (memberType === MemberType.Object) {
    return member.structure.typedArray;
  }
  return null;
}

function isTypedArray(arg, TypedArray) {
  const tag = arg?.[Symbol.toStringTag];
  return (!!TypedArray && tag === TypedArray.name);
}

function isCompatibleBuffer(arg, constructor) {
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
      tags.push('ArrayBuffer');
      tags.push('SharedArrayBuffer');
      if (typedArray === Uint8Array) {
        tags.push('Uint8ClampedArray');
      }
    }
  }
  return tags;
}

function getBigIntDescriptor(bitSize) {
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

function getAlignedIntAccessor(access, member) {
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
    const { get, set } = getBigIntDescriptor(bitSize);
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

function getAlignedUintAccessor(access, member) {
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
    const { get, set } = getBigIntDescriptor(bitSize);
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

function getUnalignedIntAccessor(access, member) {
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
  return getUnalignedNumericAccessor(access, member);
}

function getUnalignedUintAccessor(access, member) {
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
  return getUnalignedNumericAccessor(access, member);
}

function getAlignedFloatAccessor(access, member) {
  const { bitSize, byteSize } = member;
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
    const get = function(offset, littleEndian) {
      const w1 = BigInt(this.getUint32(offset + (littleEndian ? 0 : byteSize - 4), littleEndian));
      const w2 = BigInt(this.getUint32(offset + (littleEndian ? 4 : byteSize - 8), littleEndian));
      const w3 = BigInt(this.getUint32(offset + (littleEndian ? 8 : byteSize - 12), littleEndian));
      return w1 | w2 << 32n | w3 << 64n;
    };
    const set = function(offset, value, littleEndian) {
      const w1 = value & 0xFFFFFFFFn;
      const w2 = (value >> 32n) & 0xFFFFFFFFn;
      const w3 = (value >> 64n) & 0xFFFFFFFFn;
      this.setUint32(offset + (littleEndian ? 0 : byteSize - 4), Number(w1), littleEndian);
      this.setUint32(offset + (littleEndian ? 4 : byteSize - 8), Number(w2), littleEndian);
      this.setUint32(offset + (littleEndian ? 8 : byteSize - 12), Number(w3), littleEndian);
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
        const n64 = (sign << 63n) | (exp64 << 52n) | (frac >> 11n) + BigInt((frac & (2n**11n - 1n)) >= 2n**10n);
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
    const get = function(offset, littleEndian) {
      const w1 = BigInt(this.getUint32(offset + (littleEndian ? 0 : byteSize - 4), littleEndian));
      const w2 = BigInt(this.getUint32(offset + (littleEndian ? 4 : byteSize - 8), littleEndian));
      const w3 = BigInt(this.getUint32(offset + (littleEndian ? 8 : byteSize - 12), littleEndian));
      const w4 = BigInt(this.getUint32(offset + (littleEndian ? 12 : byteSize - 16), littleEndian));
      return w1 | w2 << 32n | w3 << 64n | w4 << 96n;
    };
    const set = function(offset, value, littleEndian) {
      const w1 = value & 0xFFFFFFFFn;
      const w2 = (value >> 32n) & 0xFFFFFFFFn;
      const w3 = (value >> 64n) & 0xFFFFFFFFn;
      const w4 = (value >> 96n) & 0xFFFFFFFFn;
      this.setUint32(offset + (littleEndian ? 0 : byteSize - 4), Number(w1), littleEndian);
      this.setUint32(offset + (littleEndian ? 4 : byteSize - 8), Number(w2), littleEndian);
      this.setUint32(offset + (littleEndian ? 8 : byteSize - 12), Number(w3), littleEndian);
      this.setUint32(offset + (littleEndian ? 12 : byteSize - 16), Number(w4), littleEndian);
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
        const n64 = (sign << 63n) | (exp64 << 52n) | (frac >> 60n) + BigInt((frac & (2n**60n - 1n)) >= 2n**59n);
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

function getUnalignedFloatAccessor(access, member) {
  return getUnalignedNumericAccessor(access, member);
}

function getUnalignedNumericAccessor(access, member) {
  // pathological usage scenario--handle it anyway by copying the bitSize into a
  // temporary buffer, bit-aligning the data
  const { bitSize, bitOffset } = member;
  const bitPos = bitOffset & 0x07;
  const byteSize = [ 1, 2, 4, 8 ].find(b => b * 8 >= bitSize) ?? Math.ceil(bitSize / 64) * 64;
  const buf = new DataView(new ArrayBuffer(byteSize));
  if (access === 'get') {
    const getAligned = getNumericAccessor('get', { ...member, byteSize });
    const copyBits = getBitAlignFunction(bitPos, bitSize, true);
    return function(offset, littleEndian) {
      copyBits(buf, this, offset);
      return getAligned.call(buf, 0, littleEndian);
    };
  } else {
    const setAligned = getNumericAccessor('set', { ...member, byteSize });
    const applyBits = getBitAlignFunction(bitPos, bitSize, false);
    return function(offset, value, littleEndian) {
      setAligned.call(buf, 0, value, littleEndian);
      applyBits(this, buf, offset);
    };
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

function isReadOnly({ type }) {
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

function useVoid() {
  factories$1[MemberType.Void] = getVoidDescriptor;
}

function useBool() {
  factories$1[MemberType.Bool] = getBoolDescriptor;
}

function useInt() {
  factories$1[MemberType.Int] = getIntDescriptor;
}

function useUint() {
  factories$1[MemberType.Uint] = getUintDescriptor;
}

function useFloat() {
  factories$1[MemberType.Float] = getFloatDescriptor;
}

function useObject() {
  factories$1[MemberType.Object] = getObjectDescriptor;
}

function useType() {
  factories$1[MemberType.Type] = getTypeDescriptor;
}

function useComptime() {
  factories$1[MemberType.Comptime] = getComptimeDescriptor;
}

function useStatic() {
  factories$1[MemberType.Static] = getStaticDescriptor;
}

function useLiteral() {
  factories$1[MemberType.Literal] = getLiteralDescriptor;
}

function useNull() {
  factories$1[MemberType.Null] = getNullDescriptor;
}

function useUndefined() {
  factories$1[MemberType.Undefined] = getUndefinedDescriptor;
}

function useUnsupported() {
  factories$1[MemberType.Unsupported] = getUnsupportedDescriptor;
}

const transformers = {};

function useEnumerationTransform() {
  transformers[StructureType.Enum] = transformEnumerationDescriptor;
}

function useErrorSetTransform() {
  transformers[StructureType.ErrorSet] = transformErrorSetDescriptor;
}

function getDescriptor(member, env) {
  const f = factories$1[member.type];
  return f(member, env);
}

function transformDescriptor(descriptor, member) {
  const { structure } = member;
  const t = transformers[structure?.type];
  return (t) ? t(descriptor, structure) : descriptor;
}

function getVoidDescriptor(member, env) {
  const { bitOffset } = member;
  return {
    get: function() {
      return undefined;
    },
    set: (bitOffset !== undefined)
    ? function(value) {
      if (value !== undefined) {
        throw new NotUndefined(member);
      }
    }
    : function(index, value) {
      if (value !== undefined) {
        throw new NotUndefined(member);
      }
      if (index < 0 || index >= this.length) {
        throw new OutOfBound(member, index);
      }
    },
  };
}

function getNullDescriptor(member, env) {
  return {
    get: function() {
      return null;
    },
  };
}

function getUndefinedDescriptor(member, env) {
  return {
    get: function() {
      return undefined;
    },
  };
}

function getUnsupportedDescriptor(member, env) {
  const throwUnsupported = function() {
    throw new Unsupported();
  };
  return { get: throwUnsupported, set: throwUnsupported };
}


function getBoolDescriptor(member, env) {
  return getDescriptorUsing(member, env, getBoolAccessor)
}

function getIntDescriptor(member, env) {
  const getDataViewAccessor = addRuntimeCheck(env, getNumericAccessor);
  const descriptor = getDescriptorUsing(member, env, getDataViewAccessor);
  return transformDescriptor(descriptor, member);
}

function getUintDescriptor(member, env) {
  const getDataViewAccessor = addRuntimeCheck(env, getNumericAccessor);
  const descriptor = getDescriptorUsing(member, env, getDataViewAccessor);
  return transformDescriptor(descriptor, member);
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
          throw new Overflow(member, value);
        }
        accessor.call(this, offset, value, littleEndian);
      };
    }
    return accessor;
  };
}

function getFloatDescriptor(member, env) {
  return getDescriptorUsing(member, env, getNumericAccessor)
}

function transformEnumerationDescriptor(int, structure) {
  const findEnum = function(value) {
    const { constructor } = structure;
    // the enumeration constructor returns the object for the int value
    const item = constructor(value);
    if (!item) {
      throw new EnumExpected(structure, value);
    }
    return item
  };
  return {
    get: (int.get.length === 0)
    ? function getEnum(hint) {
        const value = int.get.call(this);
        if (hint === 'number') {
          return value;
        }
        return findEnum(value);
      }
    : function getEnumElement(index) {
        const value = int.get.call(this, index);
        return findEnum(value);
      },
    set: (int.set.length === 1)
    ? function setEnum(value, hint) {
        if (hint !== 'number') {
          const item = findEnum(value);
          // call Symbol.toPrimitive directly as enum can be bigint or number
          value = item[Symbol.toPrimitive]();
        }
        int.set.call(this, value);
      }
    : function setEnumElement(index, value) {
        const item = findEnum(value);
        int.set.call(this, index, item[Symbol.toPrimitive]());
      },
  };
}

function transformErrorSetDescriptor(int, structure) {
  const findError = function(value) {
    const { constructor } = structure;
    const item = constructor(value);
    if (!item) {
      if (value instanceof Error) {
        throw new NotInErrorSet(structure);
      } else {
        throw new ErrorExpected(structure, value);
      }
    }
    return item
  };
  return {
    get: (int.get.length === 0)
    ? function getError(hint) {
        const value = int.get.call(this);
        if (hint === 'number') {
          return value;
        }
        return findError(value);
      }
    : function getErrorElement(index) {
        const value = int.get.call(this, index);
        return findError(value);
      },
    set: (int.set.length === 1)
    ? function setError(value, hint) {
        if (hint !== 'number') {
          const item = findError(value);
          value = Number(item);
        }
        int.set.call(this, value);
      }
    : function setError(index, value) {
        const item = findError(value);
        value = Number(item);
        int.set.call(this, index, value);
      },
  };
}

function isValueExpected(structure) {
  switch (structure?.type) {
    case StructureType.Primitive:
    case StructureType.ErrorUnion:
    case StructureType.Optional:
    case StructureType.Enum:
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

function getType(slot) {
  // unsupported types will have undefined structure
  const structure = this[SLOTS][slot];
  return structure?.constructor;
}

function getTypeDescriptor(member, env) {
  const { slot } = member;
  return bindSlot(slot, { get: getType });
}

function getComptimeDescriptor(member, env) {
  const { slot, structure } = member;
  return bindSlot(slot, {
    get: isValueExpected(structure) ? getValue : getObject,
  });
}

function getStaticDescriptor(member, env) {
  const { slot, structure } = member;
  return bindSlot(slot, {
    get: isValueExpected(structure) ? getValue : getObject,
    set: setValue,
  });
}

function getLiteral(slot) {
  const object = this[SLOTS][slot];
  return object.string;
}

function getLiteralDescriptor(member, env) {
  const { slot } = member;
  return bindSlot(slot, { get: getLiteral });
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
          if (err instanceof TypeError && this[MEMORY_RESTORER]()) {
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
          if (err instanceof TypeError && this[MEMORY_RESTORER]()) {
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
          if (err instanceof TypeError && this[MEMORY_RESTORER]()) {
            return getter.call(this[MEMORY], index * byteSize, littleEndian);
          } else {
          /* WASM-ONLY-END */
            throw adjustRangeError(member, index, err);
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
          if (err instanceof TypeError && this[MEMORY_RESTORER]()) {
            return setter.call(this[MEMORY], index * byteSize, value, littleEndian);
          } else {
            throw adjustRangeError(member, index, err);
          }
        }
        /* WASM-ONLY-END */
      },
    }
  }
}

function defineProperty(object, name, descriptor) {
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

function defineProperties(object, descriptors) {
  for (const [ name, descriptor ] of Object.entries(descriptors)) {
    defineProperty(object, name, descriptor);
  }
  for (const symbol of Object.getOwnPropertySymbols(descriptors)) {
    const descriptor = descriptors[symbol];
    defineProperty(object, symbol, descriptor);
  }
}

function attachDescriptors(constructor, instanceDescriptors, staticDescriptors, env) {
  // create prototype for read-only objects
  const propSetters = {};
  for (const [ name, descriptor ] of Object.entries(instanceDescriptors)) {
    if (descriptor?.set) {
      // save the setters so we can initialize read-only objects
      if (name !== '$') {
        propSetters[name] = descriptor.set;
      }
    }
  }
  const { get, set } = instanceDescriptors.$;
  defineProperties(constructor.prototype, {
    [ALL_KEYS]: { value: Object.keys(propSetters) },
    [SETTER]: { value: set },
    [GETTER]: { value: get },
    [PROP_SETTERS]: { value: propSetters },
    [CONST_TARGET]: { value: null },
    /* WASM-ONLY */
    [MEMORY_RESTORER]: { value: getMemoryRestorer(constructor[CACHE], env) },
    /* WASM-ONLY-END */
    ...instanceDescriptors,
  });
  defineProperties(constructor, staticDescriptors);
  return constructor;
}

function makeReadOnly() {
  const descriptors = Object.getOwnPropertyDescriptors(this.constructor.prototype);
  for (const [ name, descriptor ] of Object.entries(descriptors)) {
    if (descriptor.set) {
      descriptor.set = throwReadOnly;
      Object.defineProperty(this, name, descriptor);
    }
  }
  Object.defineProperty(this, SETTER, { value: throwReadOnly });
  Object.defineProperty(this, CONST_TARGET, { value: this });
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
    const comptimeMembers = members.filter(m => isReadOnly(m));
    if (comptimeMembers.length > 0) {
      comptimeFieldSlots = comptimeMembers.map(m => m.slot);
    }
  }
  const cache = new ObjectCache();
  const constructor = function(arg, options = {}) {
    const {
      fixed = false,
    } = options;
    const creating = this instanceof constructor;
    let self, dv;
    if (creating) {
      if (arguments.length === 0) {
        throw new NoInitializer(structure);
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
      if (self = cache.find(dv)) {
        return self;
      }
      self = Object.create(constructor.prototype);
      if (shapeDefiner) {
        setDataView.call(self, dv, structure, false, false, { shapeDefiner });
      } else {
        self[MEMORY] = dv;
      }
      if (hasSlots) {
        self[SLOTS] = {};
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
    }
    if (finalizer) {
      self = finalizer.call(self);
    }
    return cache.save(dv, self);
  };
  defineProperty(constructor, CACHE, { value: cache });
  return constructor;
}

function getMemoryRestorer(cache, env) {
  return function() {
    const dv = this[MEMORY];
    const fixed = dv[FIXED];
    if (fixed && dv.buffer.byteLength === 0) {
      const newDV = env.obtainFixedView(fixed.address, fixed.len);
      if (fixed.align) {
        newDV[FIXED].align = fixed.align;
      }
      this[MEMORY] = newDV;
      cache?.save(newDV, this);
      return true;
    } else {
      return false;
    }
  };
}

function copyPointer({ source }) {
  const target = source[SLOTS][0];
  if (target) {
    this[TARGET_SETTER](target);
  }
}

function createPropertyApplier(structure) {
  const { instance: { template } } = structure;
  return function(arg, fixed) {
    const argKeys = Object.keys(arg);
    const propSetters = this[PROP_SETTERS];
    const allKeys = this[ALL_KEYS];
    // don't accept unknown props
    for (const key of argKeys) {
      if (!(key in propSetters)) {
        throw new NoProperty(structure, key);
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
      throw new MissingInitializers(structure, missing);
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
      set.call(this, arg[key], fixed);
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
  map = new WeakMap();

  find(dv) {
    return this.map.get(dv);
  }

  save(dv, object) {
    this.map.set(dv, object);
    return object;
  }
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
  return normalizeObject(this, false);
}

function convertToJSON() {
  return normalizeObject(this, true);
}

const INT_MAX = BigInt(Number.MAX_SAFE_INTEGER);
const INT_MIN = BigInt(Number.MIN_SAFE_INTEGER);

function normalizeObject(object, forJSON) {
  const error = (forJSON) ? 'return' : 'throw';
  const resultMap = new Map();
  const process = function(value) {
    // handle type (i.e. constructor) like a struct
    const type = (typeof(value) === 'function') ? StructureType.Struct : value?.constructor?.[TYPE];
    if (type === undefined) {
      if (forJSON) {
        if (typeof(value) === 'bigint' && INT_MIN <= value && value <= INT_MAX) {
          return Number(value);
        } else if (value instanceof Error) {
          return { error: value.message };
        }
      }
      return value;
    }
    let result = resultMap.get(value);
    if (result === undefined) {
      let entries;
      switch (type) {
        case StructureType.Struct:
        case StructureType.PackedStruct:
        case StructureType.ExternStruct:
        case StructureType.TaggedUnion:
        case StructureType.BareUnion:
        case StructureType.ExternUnion:
          entries = value[ENTRIES_GETTER]?.({ error });
          result = value.constructor[TUPLE] ? [] : {};
          break;
        case StructureType.Array:
        case StructureType.Vector:
        case StructureType.Slice:
          entries = value[ENTRIES_GETTER]?.({ error });
          result = [];
          break;
        case StructureType.SinglePointer:
        case StructureType.SlicePointer:
        case StructureType.MultiPointer:
        case StructureType.CPointer:
          try {
            result = value['*'];
          } catch (err) {
            result = Symbol.for('inaccessible');
          }
          break;
        case StructureType.Enum:
          result = handleError(() => String(value), { error });
          break;
        case StructureType.Opaque:
          result = {};
          break;
        default:
          result = handleError(() => value.$, { error });
      }
      result = process(result);
      resultMap.set(value, result);
      if (entries) {
        for (const [ key, child ] of entries) {
          result[key] = process(child);
        }
      }
    }
    return result;
  };
  return process(object);
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
      this[MEMORY_RESTORER]();
      /* WASM-ONLY-END */
      return this[MEMORY];
    },
    set(dv, fixed) {
      checkDataView(dv);
      setDataView.call(this, dv, structure, true, fixed, handlers);
    },
  });
}

function getBase64Descriptor(structure, handlers = {}) {
  return markAsSpecial({
    get() {
      return encodeBase64(this.dataView);
    },
    set(str, fixed) {
      if (typeof(str) !== 'string') {
        throw new TypeMismatch('string', str);
      }
      const dv = decodeBase64(str);
      setDataView.call(this, dv, structure, false, fixed, handlers);
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
      let str = decodeText(ta, `utf-${charSize * 8}`);
      if (sentinel?.value !== undefined) {
        if (str.charCodeAt(str.length - 1) === sentinel.value) {
          str = str.slice(0, -1);
        }
      }
      return str;
    },
    set(str, fixed) {
      if (typeof(str) !== 'string') {
        throw new TypeMismatch('a string', str);
      }
      if (sentinel?.value !== undefined) {
        if (str.charCodeAt(str.length - 1) !== sentinel.value) {
          str = str + String.fromCharCode(sentinel.value);
        }
      }
      const ta = encodeText(str, `utf-${charSize * 8}`);
      const dv = new DataView(ta.buffer);
      setDataView.call(this, dv, structure, false, fixed, handlers);
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
    set(ta, fixed) {
      if (!isTypedArray(ta, typedArray)) {
        throw new TypeMismatch(typedArray.name, ta);
      }
      const dv = new DataView(ta.buffer, ta.byteOffset, ta.byteLength);
      setDataView.call(this, dv, structure, true, fixed, handlers);
    },
  });
}

function markAsSpecial({ get, set }) {
  get.special = set.special = true;
  return { get, set };
}

let currentGlobalSet;
let currentErrorClass;

function defineErrorSet(structure, env) {
  const {
    name,
    byteSize,
    align,
    instance: { members: [ member ] },
  } = structure;
  if (!currentErrorClass) {
    currentErrorClass = class ZigError extends ZigErrorBase {};
    currentGlobalSet = defineErrorSet({ ...structure, name: 'anyerror' }, env);
  }
  if (currentGlobalSet && name === 'anyerror') {
    structure.constructor = currentGlobalSet;
    structure.typedArray = getTypedArrayClass(member);
    return currentGlobalSet;
  }
  const errorClass = currentErrorClass;
  const { get, set } = getDescriptor(member, env);
  const expected = [ 'string', 'number' ];
  const propApplier = createPropertyApplier(structure);
  const initializer = function(arg) {
    if (arg instanceof constructor[CLASS]) {
      set.call(this, arg);
    } else if (arg && typeof(arg) === 'object' && !isErrorJSON(arg)) {
      if (propApplier.call(this, arg) === 0) {
        throw new InvalidInitializer(structure, expected, arg);
      }
    } else if (arg !== undefined) {
      set.call(this, arg);
    }
  };
  const alternateCaster = function(arg) {
    if (typeof(arg) === 'number' || typeof(arg) === 'string') {
      return constructor[arg];
    } else if (arg instanceof constructor[CLASS]) {
      return constructor[Number(arg)];
    } else if (isErrorJSON(arg)) {
      return constructor[`Error: ${arg.error}`];
    } else if (!getDataView(structure, arg, env)) {
      throw new InvalidInitializer(structure, expected, arg);
    } else {
      return false;
    }
  };
  // items are inserted when static members get attached in static.js
  const constructor = structure.constructor = createConstructor(structure, { initializer, alternateCaster }, env);
  const typedArray = structure.typedArray = getTypedArrayClass(member);
  const instanceDescriptors = {
    $: { get, set },
    dataView: getDataViewDescriptor(structure),
    base64: getBase64Descriptor(structure),
    typedArray: typedArray && getTypedArrayDescriptor(structure),
    valueOf: { value: getValueOf },
    toJSON: { value: convertToJSON },
    delete: { value: getDestructor(env) },
    [COPIER]: { value: getMemoryCopier(byteSize) },
    [WRITE_DISABLER]: { value: makeReadOnly },
  };
  const staticDescriptors = {
    [ALIGN]: { value: align },
    [SIZE]: { value: byteSize },
    [CLASS]: { value: errorClass },
    // the PROPS array is normally set in static.js; it needs to be set here for anyerror
    // so we can add names to it as error sets are defined
    [PROPS]: (name === 'anyerror') ? { value: [] } : undefined,
    [TYPE]: { value: structure.type },
  };
  return attachDescriptors(constructor, instanceDescriptors, staticDescriptors, env);
}
function appendErrorSet(errorSet, name, es) {
  // our Zig export code places error set instance into the static template, which we can't
  // use since all errors need to have the same parent class; here we get the error number
  // and create the actual error object if hasn't been created already for an earlier set
  const number = es[GETTER]('number');
  let error = currentGlobalSet[number];
  if (!error) {
    const errorClass = errorSet[CLASS];
    error = new errorClass(name, number);
  }
  const string = String(error);
  const descriptors = {
    [number]: { value: error },
    [string]: { value: error },
    [name]: { value: error },
  };
  defineProperties(errorSet, descriptors);
  defineProperties(currentGlobalSet, descriptors);
  // add name to prop list
  currentGlobalSet[PROPS].push(name);
}

function resetGlobalErrorSet() {
  currentErrorClass = currentGlobalSet = undefined;
}

class ZigErrorBase extends Error {
  constructor(name, number) {
    super(deanimalizeErrorName(name));
    this.number = number;
    this.stack = undefined;
  }

  [Symbol.toPrimitive](hint) {
    switch (hint) {
      case 'string':
      case 'default':
        return Error.prototype.toString.call(this, hint);
      default:
        return this.number;
    }
  }

  toJSON() {
    return { error: this.message };
  }
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

function defineEnumerationShape(structure, env) {
  const {
    byteSize,
    align,
    instance: {
      members: [ member ],
    },
  } = structure;
  const { get, set } = getDescriptor(member, env);
  const expected = [ 'string', 'number', 'tagged union' ];
  const propApplier = createPropertyApplier(structure);
  const initializer = function(arg) {
    if (arg && typeof(arg) === 'object') {
      if (propApplier.call(this, arg) === 0) {
        throw new InvalidInitializer(structure, expected, arg);
      }
    } else if (arg !== undefined) {
      set.call(this, arg);
    }
  };
  const alternateCaster = function(arg) {
    if (typeof(arg)  === 'string' || typeof(arg) === 'number' || typeof(arg) === 'bigint') {
      let item = constructor[arg];
      if (!item) {
        if (constructor[MORE] && typeof(arg) !== 'string') {
          // create the item on-the-fly when enum is non-exhaustive
          item = new constructor(undefined);
          set.call(item, arg, 'number');
          appendEnumeration(constructor, `${arg}`, item);
        }
      }
      return item;
    } else if (arg instanceof constructor) {
      return arg;
    } else if (arg?.[TAG] instanceof constructor) {
      // a tagged union, return the active tag
      return arg[TAG];
    } else if (!getDataView(structure, arg, env)) {
      throw new InvalidInitializer(structure, expected, arg);
    } else {
      return false;
    }
  };
  const constructor = structure.constructor = createConstructor(structure, { initializer, alternateCaster }, env);
  const typedArray = structure.typedArray = getTypedArrayClass(member);
  const toPrimitive = function(hint) {
    switch (hint) {
      case 'string':
      case 'default':
        return this.$[NAME];
      default:
        return get.call(this, 'number');
    }
  };
  const instanceDescriptors = {
    $: { get, set },
    dataView: getDataViewDescriptor(structure),
    base64: getBase64Descriptor(structure),
    typedArray: typedArray && getTypedArrayDescriptor(structure),
    valueOf: { value: getValueOf },
    toString: { value: getValueOf },
    toJSON: { value: convertToJSON },
    delete: { value: getDestructor(env) },
    [Symbol.toPrimitive]: { value: toPrimitive },
    [COPIER]: { value: getMemoryCopier(byteSize) },
    [WRITE_DISABLER]: { value: makeReadOnly },
  };
  const staticDescriptors = {
    [ALIGN]: { value: align },
    [SIZE]: { value: byteSize },
    [TYPE]: { value: structure.type },
  };
  return attachDescriptors(constructor, instanceDescriptors, staticDescriptors, env);
}
function appendEnumeration(enumeration, name, item) {
  if (name !== undefined) {
    // enum can have static variables
    if (item instanceof enumeration) {
      // attach name to item so tagged union code can quickly find it
      defineProperties(item, { [NAME]: { value: name } });
      // call toPrimitive directly since enum can be bigint or number
      const index = item[Symbol.toPrimitive]();
      defineProperties(enumeration, {
        [index]: { value: item },
        [name]: { value: item },
      });
    }
  } else {
    // non-exhaustive enum
    defineProperties(enumeration, { [MORE]: { value: true } });
  }
}

function definePointer(structure, env) {
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
  const updateTarget = function(all = true, active = true) {
    if (all || this[MEMORY][FIXED]) {
      if (active) {
        const address = getAddressInMemory.call(this);
        const length = (hasLengthInMemory)
        ? getLengthInMemory.call(this)
        : (sentinel?.isRequired)
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
    // the target sits in fixed memory--apply the change immediately
    if (arg[MEMORY][FIXED]) {
      const address = env.getViewAddress(arg[MEMORY]);
      setAddress.call(this, address);
      if (hasLengthInMemory) {
        setLength.call(this, arg.length);
      }
    } else {
      if (pointer[MEMORY][FIXED]) {
        throw new FixedMemoryTargetRequired(structure, arg);
      }
    }
    pointer[SLOTS][0] = arg;
    if (hasLengthInMemory) {
      pointer[MAX_LENGTH] = arg.length;
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
  };
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
    const handlers = isPointer(targetType) ? {} : proxyHandlers$1;
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
    } else if (type != StructureType.SinglePointer) {
      if (isCompatiblePointer(arg, Target, type)) {
        arg = Target(arg[SLOTS][0][MEMORY]);
      }
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
    } else if (type === StructureType.CPointer && arg instanceof Target.child) {
      arg = Target(arg[MEMORY]);
    } else if (isCompatibleBuffer(arg, Target)) {
      // autocast to target type
      const dv = getDataView(targetStructure, arg, env);
      arg = Target(dv);
    } else if (arg !== undefined && !arg[MEMORY]) {
      if (type === StructureType.CPointer) {
        if (typeof(arg) === 'object' && !arg[Symbol.iterator]) {
          let single = true;
          // make sure the object doesn't contain special props for the slice
          const propSetters = Target.prototype[PROP_SETTERS];
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
        if (targetStructure.typedArray) {
          const tag = arg?.buffer?.[Symbol.toStringTag];
          if (tag === 'ArrayBuffer' || tag === 'SharedArrayBuffer') {
            warnImplicitArrayCreation(targetStructure, arg);
          }
        }
      }
      arg = autoObj;
    } else if (arg !== undefined) {
      console.log({ isCompatiblePointer: isCompatiblePointer(arg, Target, type) });
      throw new InvalidPointerTarget(structure, arg);
    }
    this[TARGET_SETTER](arg);
  };
  const getTargetPrimitive = (targetType === StructureType.Primitive)
  ? function(hint) {
      const target = this[TARGET_GETTER]();
      return target[Symbol.toPrimitive](hint);
    }
  : null;
  const getSliceOf = (targetType === StructureType.Slice)
  ? function(begin, end) {
      const target = this[TARGET_GETTER]();
      const newTarget = target.slice(begin, end);
      return new constructor(newTarget);
    }
  : null;
  const getSubarrayOf = (targetType === StructureType.Slice)
  ? function(begin, end, options) {
      const target = this[TARGET_GETTER]();
      const newTarget = target.subarray(begin, end, options);
      return new constructor(newTarget);
    }
  : null;
  const constructor = structure.constructor = createConstructor(structure, { initializer, alternateCaster, finalizer }, env);
  const instanceDescriptors = {
    '*': { get: getTarget, set: setTarget },
    '$': { get: getProxy, set: initializer },
    length: { get: getTargetLength, set: setTargetLength },
    valueOf: { value: getValueOf },
    toJSON: { value: convertToJSON },
    delete: { value: deleteTarget },
    slice: getSliceOf && { value: getSliceOf },
    subarray: getSubarrayOf && { value: getSubarrayOf },
    [Symbol.toPrimitive]: getTargetPrimitive && { value: getTargetPrimitive },
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

function getProxy() {
  return this[PROXY];
}

function resetPointer({ isActive }) {
  if (this[SLOTS][0] && !isActive(this)) {
    this[SLOTS][0] = undefined;
  }
}

function disablePointer() {
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

function isCompatiblePointer(arg, Target, type) {
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
    Object.defineProperty(target, CONST_PROXY, { value: undefined, configurable: true });
    proxy = new Proxy(target, constTargetHandlers);
    Object.defineProperty(target, CONST_PROXY, { value: proxy });
  }
  return proxy;
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

function always() {
  return true;
}

function never() {
  return false;
}

function defineVector(structure, env) {
  const {
    length,
    byteSize,
    align,
    instance: { members: [ member ] },
  } = structure;
  const { bitSize: elementBitSize, structure: elementStructure } = member;
  const elementDescriptors = {};
  for (let i = 0, bitOffset = 0; i < length; i++, bitOffset += elementBitSize) {
    const { get, set } = getDescriptor({ ...member, bitOffset }, env);
    elementDescriptors[i] = { get, set, configurable: true };
  }
  const propApplier = createPropertyApplier(structure);
  const initializer = function(arg) {
    if (arg instanceof constructor) {
      this[COPIER](arg);
    } else if (arg?.[Symbol.iterator]) {
      let argLen = arg.length;
      if (typeof(argLen) !== 'number') {
        arg = [ ...arg ];
        argLen = arg.length;
      }
      if (argLen !== length) {
        throw new ArrayLengthMismatch(structure, this, arg);
      }
      let i = 0;
      for (const value of arg) {
        this[PROP_SETTERS][i++].call(this, value);
      }
    } else if (arg && typeof(arg) === 'object') {
      if (propApplier.call(this, arg) === 0) {
        throw new InvalidArrayInitializer(structure, arg);
      }
    } else if (arg !== undefined) {
      throw new InvalidArrayInitializer(structure, arg);
    }
  };
  const constructor = structure.constructor = createConstructor(structure, { initializer }, env);
  const typedArray = structure.typedArray = getTypedArrayClass(member);
  const instanceDescriptors = {
    ...elementDescriptors,
    $: { get: getSelf, set: initializer },
    length: { value: length },
    dataView: getDataViewDescriptor(structure),
    base64: getBase64Descriptor(structure),
    typedArray: typedArray && getTypedArrayDescriptor(structure),
    valueOf: { value: getValueOf },
    toJSON: { value: convertToJSON },
    entries: { value: getVectorEntries },
    delete: { value: getDestructor(structure) },
    [Symbol.iterator]: { value: getVectorIterator },
    [ENTRIES_GETTER]: { value: getVectorEntries },
    [COPIER]: { value: getMemoryCopier(byteSize) },
    [WRITE_DISABLER]: { value: makeReadOnly },
  };
  const staticDescriptors = {
    child: { get: () => elementStructure.constructor },
    [COMPAT]: { value: getCompatibleTags(structure) },
    [ALIGN]: { value: align },
    [SIZE]: { value: byteSize },
    [TYPE]: { value: structure.type },
  };
  return attachDescriptors(constructor, instanceDescriptors, staticDescriptors, env);
}

function getVectorIterator() {
  const self = this;
  const length = this.length;
  let index = 0;
  return {
    next() {
      let value, done;
      if (index < length) {
        const current = index++;
        value = self[current];
        done = false;
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
        const current = index++;
        value = [ current, self[current] ];
        done = false;
      } else {
        done = true;
      }
      return { value, done };
    },
  };
}

function getVectorEntries() {
  return {
    [Symbol.iterator]: getVectorEntriesIterator.bind(this),
    length: this.length,
  };
}

function defineStructShape(structure, env) {
  const {
    byteSize,
    align,
    instance: { members },
    isTuple,
    isIterator,
    hasPointer,
  } = structure;
  const memberDescriptors = {};
  const fieldMembers = members.filter(m => !!m.name);
  const backingIntMember = members.find(m => !m.name);
  for (const member of fieldMembers) {
    const { get, set } = getDescriptor(member, env);
    memberDescriptors[member.name] = { get, set, configurable: true, enumerable: true };
    if (member.isRequired && set) {
      set.required = true;
    }
  }
  const backingInt = (backingIntMember) ? getDescriptor(backingIntMember, env) : null;
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
    } else if ((typeof(arg) === 'number' || typeof(arg) === 'bigint') && backingInt) {
      backingInt.set.call(this, arg);
    } else if (arg !== undefined) {
      throw new InvalidInitializer(structure, 'object', arg);
    }
  };
  const constructor = structure.constructor = createConstructor(structure, { initializer }, env);
  const toPrimitive = (backingInt)
  ? function(hint) {
    switch (hint) {
      case 'string':
        return Object.prototype.toString.call(this);
      default:
        return backingInt.get.call(this);
    }
  }
  : null;
  const length = (isTuple && members.length > 0)
  ? parseInt(members[members.length - 1].name) + 1
  : 0;
  const getIterator = (isIterator)
  ? getIteratorIterator
  : (isTuple)
    ? getVectorIterator
    : getStructIterator;
  const instanceDescriptors = {
    $: { get: getSelf, set: initializer },
    dataView: getDataViewDescriptor(structure),
    base64: getBase64Descriptor(structure),
    length: isTuple && { value: length },
    valueOf: { value: getValueOf },
    toJSON: { value: convertToJSON },
    delete: { value: getDestructor(env) },
    entries: isTuple && { value: getVectorEntries },
    ...memberDescriptors,
    [Symbol.iterator]: { value: getIterator },
    [Symbol.toPrimitive]: backingInt && { value: toPrimitive },
    [ENTRIES_GETTER]: { value: isTuple ? getVectorEntries : getStructEntries },
    [COPIER]: { value: getMemoryCopier(byteSize) },
    [VIVIFICATOR]: hasObject && { value: getChildVivificator$1(structure, env) },
    [POINTER_VISITOR]: hasPointer && { value: getPointerVisitor$1(structure, always) },
    [WRITE_DISABLER]: { value: makeReadOnly },
    [PROPS]: { value: fieldMembers.map(m => m.name) },
  };
  const staticDescriptors = {
    [ALIGN]: { value: align },
    [SIZE]: { value: byteSize },
    [TYPE]: { value: structure.type },
    [TUPLE]: { value: isTuple },
  };
  return attachDescriptors(constructor, instanceDescriptors, staticDescriptors, env);
}

function getStructEntries(options) {
  return {
    [Symbol.iterator]: getStructEntriesIterator.bind(this, options),
    length: this[PROPS].length,
  };
}

function getIteratorIterator() {
  const self = this;
  return {
    next() {
      const value = self.next();
      const done = value === null;
      return { value, done };
    },
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

function getChildVivificator$1(structure, env) {
  const { instance: { members } } = structure;
  const objectMembers = {};
  for (const member of members.filter(m => m.type === MemberType.Object)) {
    objectMembers[member.slot] = member;
  }
  return function vivificateChild(slot) {
    const member = objectMembers[slot];
    const { bitOffset, byteSize, structure: { constructor } } = member;
    const dv = this[MEMORY];
    const parentOffset = dv.byteOffset;
    const offset = parentOffset + (bitOffset >> 3);
    let len = byteSize;
    if (len === undefined) {
      if (bitOffset & 7) {
        throw new NotOnByteBoundary(member);
      }
      len = member.bitSize >> 3;
    }
    const childDV = env.obtainView(dv.buffer, offset, len);
    const object = this[SLOTS][slot] = constructor.call(PARENT, childDV);
    return object;
  }
}

function getPointerVisitor$1(structure, visitorOptions = {}) {
  const {
    isChildActive = always,
    isChildMutable = always,
  } = visitorOptions;
  const { instance: { members } } = structure;
  const pointerMembers = members.filter(m => m.structure?.hasPointer);
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

function addStaticMembers(structure, env) {
  const {
    type,
    constructor,
    static: { members, template },
  } = structure;
  const descriptors = {};
  for (const member of members) {
    descriptors[member.name] = getDescriptor(member, env);
  }
  defineProperties(constructor, {
    valueOf: { value: getValueOf },
    toJSON: { value: convertToJSON },
    ...descriptors,
    [Symbol.iterator]: { value: getStructIterator },
    [ENTRIES_GETTER]: { value: getStructEntries },
    // static variables are objects stored in the static template's slots
    [SLOTS]: template && { value: template[SLOTS] },
    // anyerror would have props already
    [PROPS]: !constructor[PROPS] && { value: members.map(m => m.name) },
  });
  if (type === StructureType.Enum) {
    for (const { name, slot } of members) {
      appendEnumeration(constructor, name, constructor[SLOTS][slot]);
    }
  } else if (type === StructureType.ErrorSet) {
    for (const { name, slot } of members) {
      appendErrorSet(constructor, name, constructor[SLOTS][slot]);
    }
  }
}

function defineArgStruct(structure, env) {
  const {
    byteSize,
    align,
    instance: { members },
    hasPointer,
  } = structure;
  const hasObject = !!members.find(m => m.type === MemberType.Object);
  const argKeys = members.slice(1).map(m => m.name);
  const argCount = argKeys.length;
  const constructor = structure.constructor = function(args, name, offset) {
    const dv = env.allocateMemory(byteSize, align);
    this[MEMORY] = dv;
    if (hasObject) {
      this[SLOTS] = {};
    }
    if (args.length !== argCount) {
      throw new ArgumentCountMismatch(name, argCount - offset, args.length - offset);
    }
    for (const [ index, key ] of argKeys.entries()) {
      try {
        this[key] = args[index];
      } catch (err) {
        throw adjustArgumentError(name, index - offset, argCount - offset, err);
      }
    }
  };
  const memberDescriptors = {};
  for (const member of members) {
    memberDescriptors[member.name] = getDescriptor(member, env);
  }
  const { slot: retvalSlot, type: retvalType } = members[0];
  const isChildMutable = (retvalType === MemberType.Object)
  ? function(object) {
      const child = this[VIVIFICATOR](retvalSlot);
      return object === child;
    }
  : function() { return false };
  defineProperties(constructor.prototype, {
    ...memberDescriptors,
    [COPIER]: { value: getMemoryCopier(byteSize) },
    [VIVIFICATOR]: hasObject && { value: getChildVivificator$1(structure, env) },
    [POINTER_VISITOR]: hasPointer && { value: getPointerVisitor$1(structure, { isChildMutable }) },
    /* WASM-ONLY */
    [MEMORY_RESTORER]: { value: getMemoryRestorer(null, env) },
    /* WASM-ONLY-END */
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
          throw new ArrayLengthMismatch(structure, this, arg);
        }
        let i = 0;
        for (const value of arg) {
          set.call(this, i++, value);
        }
      } else if (arg && typeof(arg) === 'object') {
        if (propApplier.call(this, arg) === 0) {
          throw new InvalidArrayInitializer(structure, arg);
        }
      } else if (arg !== undefined) {
        throw new InvalidArrayInitializer(structure, arg);
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
    [ENTRIES_GETTER]: { value: getArrayEntries },
    [COPIER]: { value: getMemoryCopier(byteSize) },
    [VIVIFICATOR]: hasObject && { value: getChildVivificator(structure, env) },
    [POINTER_VISITOR]: hasPointer && { value: getPointerVisitor() },
    [WRITE_DISABLER]: { value: makeArrayReadOnly },
  };
  const staticDescriptors = {
    child: { get: () => member.structure.constructor },
    [COMPAT]: { value: getCompatibleTags(structure) },
    [ALIGN]: { value: align },
    [SIZE]: { value: byteSize },
    [TYPE]: { value: structure.type },
  };
  return attachDescriptors(constructor, instanceDescriptors, staticDescriptors, env);
}

function createArrayProxy() {
  const proxy = new Proxy(this, proxyHandlers);
  // hide the proxy so console wouldn't display a recursive structure
  Object.defineProperty(this, PROXY, { value: proxy });
  return proxy;
}

function makeArrayReadOnly() {
  makeReadOnly.call(this);
  Object.defineProperty(this, 'set', { value: throwReadOnly });
  const get = this.get;
  const getReadOnly = function(index) {
    const element = get.call(this, index);
    if (element?.[CONST_TARGET] === null) {
      element[WRITE_DISABLER]?.();
    }
    return element;
  };
  Object.defineProperty(this, 'get', { value: getReadOnly });
}

function canBeString(member) {
  return member.type === MemberType.Uint && [ 8, 16 ].includes(member.bitSize);
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

function getChildVivificator(structure, env) {
  const { instance: { members: [ member ]} } = structure;
  const { byteSize, structure: elementStructure } = member;
  return function getChild(index) {
    const { constructor } = elementStructure;
    const dv = this[MEMORY];
    const parentOffset = dv.byteOffset;
    const offset = parentOffset + byteSize * index;
    const childDV = env.obtainView(dv.buffer, offset, byteSize);
    const object = this[SLOTS][index] = constructor.call(PARENT, childDV);
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

function defineErrorUnion(structure, env) {
  const {
    byteSize,
    align,
    instance: { members },
    hasPointer,
  } = structure;
  const { get: getValue, set: setValue } = getDescriptor(members[0], env);
  const { get: getError, set: setError } = getDescriptor(members[1], env);
  const get = function() {
    const errNum = getError.call(this, 'number');
    if (errNum) {
      throw getError.call(this);
    } else {
      return getValue.call(this);
    }
  };
  const isValueVoid = members[0].type === MemberType.Void;
  const errorSet = members[1].structure.constructor;
  const isChildActive = function() {
    return !getError.call(this, 'number');
  };
  const clearValue = function() {
    this[RESETTER]();
    this[POINTER_VISITOR]?.(resetPointer);
  };
  const hasObject = !!members.find(m => m.type === MemberType.Object);
  const propApplier = createPropertyApplier(structure);
  const initializer = function(arg) {
    if (arg instanceof constructor) {
      this[COPIER](arg);
      if (hasPointer) {
        if (isChildActive.call(this)) {
          this[POINTER_VISITOR](copyPointer, { vivificate: true, source: arg });
        }
      }
    } else if (arg instanceof errorSet[CLASS] && errorSet(arg)) {
      setError.call(this, arg);
      clearValue.call(this);
    } else if (arg !== undefined || isValueVoid) {
      try {
        // call setValue() first, in case it throws
        setValue.call(this, arg);
        setError.call(this, 0, 'number');
      } catch (err) {
        if (arg instanceof Error) {
          // we give setValue a chance to see if the error is actually an acceptable value
          // now is time to throw an error
          throw new NotInErrorSet(structure);
        } else if (isErrorJSON(arg)) {
          setError.call(this, arg);
          clearValue.call(this);
        } else if (arg && typeof(arg) === 'object') {
          if (propApplier.call(this, arg) === 0) {
            throw err;
          }
        } else {
          throw err;
        }
      }
    }
  };
  const constructor = structure.constructor = createConstructor(structure, { initializer }, env);
  const { bitOffset: valueBitOffset, byteSize: valueByteSize } = members[0];
  const instanceDescriptors = {
    '$': { get, set: initializer },
    dataView: getDataViewDescriptor(structure),
    base64: getBase64Descriptor(structure),
    valueOf: { value: getValueOf },
    toJSON: { value: convertToJSON },
    delete: { value: getDestructor(env) },
    [COPIER]: { value: getMemoryCopier(byteSize) },
    [RESETTER]: { value: getMemoryResetter(valueBitOffset / 8, valueByteSize) },
    [VIVIFICATOR]: hasObject && { value: getChildVivificator$1(structure, env) },
    [POINTER_VISITOR]: hasPointer && { value: getPointerVisitor$1(structure, { isChildActive }) },
    [WRITE_DISABLER]: { value: makeReadOnly },
  };
  const staticDescriptors = {
    [ALIGN]: { value: align },
    [SIZE]: { value: byteSize },
    [TYPE]: { value: structure.type },
  };
  return attachDescriptors(constructor, instanceDescriptors, staticDescriptors, env);
}

function defineOpaque(structure, env) {
  const {
    byteSize,
    align,
    isIterator,
  } = structure;
  const initializer = function() {
    throw new CreatingOpaque(structure);
  };
  const valueAccessor = function() {
    throw new AccessingOpaque(structure);
  };
  const toPrimitive = function(hint) {
    const { name } = structure;
    return `[opaque ${name}]`;
  };
  const constructor = structure.constructor = createConstructor(structure, { initializer }, env);
  const getIterator = (isIterator) ? getIteratorIterator : null;
  const instanceDescriptors = {
    $: { get: valueAccessor, set: valueAccessor },
    dataView: getDataViewDescriptor(structure),
    valueOf: { value: getValueOf },
    toJSON: { value: convertToJSON },
    delete: { value: getDestructor(env) },
    [Symbol.iterator]: getIterator && { value: getIterator },
    [Symbol.toPrimitive]: { value: toPrimitive },
    [COPIER]: { value: getMemoryCopier(byteSize) },
  };
  const staticDescriptors = {
    [COMPAT]: { value: getCompatibleTags(structure) },
    [ALIGN]: { value: align },
    [SIZE]: { value: byteSize },
    [TYPE]: { value: structure.type },
  };
  return attachDescriptors(constructor, instanceDescriptors, staticDescriptors, env);
}

function defineOptional(structure, env) {
  const {
    byteSize,
    align,
    instance: { members },
    hasPointer,
  } = structure;
  const { get: getValue, set: setValue } = getDescriptor(members[0], env);
  // NOTE: getPresent returns a uint now
  const { get: getPresent, set: setPresent } = getDescriptor(members[1], env);
  const hasPresentFlag = !(members[0].bitSize > 0 && members[0].bitOffset === members[1].bitOffset);
  const get = function() {
    const present = getPresent.call(this);
    if (present) {
      return getValue.call(this);
    } else {
      this[POINTER_VISITOR]?.(resetPointer);
      return null;
    }
  };
  const isValueVoid = members[0].type === MemberType.Void;
  const isChildActive = function () {
    return !!getPresent.call(this);
  };
  const initializer = function(arg) {
    if (arg instanceof constructor) {
      this[COPIER](arg);
      if (hasPointer) {
        // don't bother copying pointers when it's empty
        if (isChildActive.call(arg)) {
          this[POINTER_VISITOR](copyPointer, { vivificate: true, source: arg });
        }
      }
    } else if (arg === null) {
      setPresent.call(this, 0);
      this[RESETTER]?.();
      // clear references so objects can be garbage-collected
      this[POINTER_VISITOR]?.(resetPointer);
    } else if (arg !== undefined || isValueVoid) {
      // call setValue() first, in case it throws
      setValue.call(this, arg);
      if (hasPresentFlag || !this[MEMORY][FIXED]) {
        // since setValue() wouldn't write address into memory when the pointer is in
        // relocatable memory, we need to use setPresent() in order to write something
        // non-zero there so that we know the field is populated
        setPresent.call(this, 1);
      }
    }
  };
  const constructor = structure.constructor = createConstructor(structure, { initializer }, env);
  const { bitOffset: valueBitOffset, byteSize: valueByteSize } = members[0];
  const hasObject = !!members.find(m => m.type === MemberType.Object);
  const instanceDescriptors = {
    $: { get, set: initializer },
    dataView: getDataViewDescriptor(structure),
    base64: getBase64Descriptor(structure),
    valueOf: { value: getValueOf },
    toJSON: { value: convertToJSON },
    delete: { value: getDestructor(env) },
    [COPIER]: { value: getMemoryCopier(byteSize) },
    // no need to reset the value when it's a pointer, since setPresent() would null out memory used by the pointer
    [RESETTER]: !hasPointer && { value: getMemoryResetter(valueBitOffset / 8, valueByteSize) },
    [VIVIFICATOR]: hasObject && { value: getChildVivificator$1(structure, env) },
    [POINTER_VISITOR]: hasPointer && { value: getPointerVisitor$1(structure, { isChildActive }) },
    [WRITE_DISABLER]: { value: makeReadOnly },
  };
  const staticDescriptors = {
    [ALIGN]: { value: align },
    [SIZE]: { value: byteSize },
    [TYPE]: { value: structure.type },
  };
  return attachDescriptors(constructor, instanceDescriptors, staticDescriptors, env);
}

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
          throw new InvalidInitializer(structure, type, arg);
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
    [WRITE_DISABLER]: { value: makeReadOnly },
  };
  const staticDescriptors = {
    [COMPAT]: { value: getCompatibleTags(structure) },
    [ALIGN]: { value: align },
    [SIZE]: { value: byteSize },
    [TYPE]: { value: structure.type },
    [PRIMITIVE]: { value: member.type },
  };
  return attachDescriptors(constructor, instanceDescriptors, staticDescriptors, env);
}

function defineSlice(structure, env) {
  const {
    type,
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
    if (type === StructureType.Slice) {
      this[MAX_LENGTH] = length;
    }
  };
  const shapeChecker = function(arg, length) {
    if (length !== this[LENGTH]) {
      throw new ArrayLengthMismatch(structure, this, arg);
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
        throw new InvalidArrayInitializer(structure, arg, !this[MEMORY]);
      }
    } else if (arg && typeof(arg) === 'object') {
      if (propApplier.call(this, arg, fixed) === 0) {
        throw new InvalidArrayInitializer(structure, arg);
      }
    } else if (arg !== undefined) {
      throw new InvalidArrayInitializer(structure, arg);
    }
  };
  const getLength = function() {
    return this[LENGTH];
  };
  const adjustIndex = function(index, len) {
    index = index | 0;
    if (index < 0) {
      index = len + index;
      if (index < 0) {
        index = 0;
      }
    } else {
      if (index > len) {
        index = len;
      }
    }
    return index;
  };
  function getSubArrayView(begin, end) {
    begin = (begin === undefined) ? 0 : adjustIndex(begin, this.length);
    end = (end === undefined) ? this.length : adjustIndex(end, this.length);
    const dv = this[MEMORY];
    const offset = begin * elementSize;
    const len = (end * elementSize) - offset;
    return env.obtainView(dv.buffer, dv.byteOffset + offset, len);
  }
  function getSubarrayOf(begin, end) {
    const dv = getSubArrayView.call(this, begin, end);
    return constructor(dv);
  }  const getSliceOf = function(begin, end, options = {}) {
    const {
      fixed = false
    } = options;
    const dv1 = getSubArrayView.call(this, begin, end);
    const dv2 = env.allocateMemory(dv1.byteLength, align, fixed);
    const slice = constructor(dv2);
    copier.call(slice, { [MEMORY]: dv1 });
    return slice;
  };
  const finalizer = createArrayProxy;
  const copier = getMemoryCopier(elementSize, true);
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
    slice: { value: getSliceOf },
    subarray: { value: getSubarrayOf },
    valueOf: { value: getValueOf },
    toJSON: { value: convertToJSON },
    delete: { value: getDestructor(env) },
    [Symbol.iterator]: { value: getArrayIterator },
    [ENTRIES_GETTER]: { value: getArrayEntries },
    [COPIER]: { value: copier },
    [VIVIFICATOR]: hasObject && { value: getChildVivificator(structure, env) },
    [POINTER_VISITOR]: hasPointer && { value: getPointerVisitor() },
    [WRITE_DISABLER]: { value: makeArrayReadOnly },
  };
  const staticDescriptors = {
    child: { get: () => elementStructure.constructor },
    [COMPAT]: { value: getCompatibleTags(structure) },
    [ALIGN]: { value: align },
    [SIZE]: { value: elementSize },
    [TYPE]: { value: structure.type },
  };
  return attachDescriptors(constructor, instanceDescriptors, staticDescriptors, env);
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
  const { isRequired } = sentinel;
  const validateValue = (isRequired)
  ? (runtimeSafety)
    ? function(v, i, l) {
      if (v === value && i !== l - 1) {
        throw new MisplacedSentinel(structure, v, i, l);
      } else if (v !== value && i === l - 1) {
        throw new MissingSentinel(structure, value, i, l);
      }
    } : function(v, i, l) {
      if (v !== value && i === l - 1) {
        throw new MissingSentinel(structure, value, l);
      }
    }
  : function() {};
  const validateData = (isRequired)
  ? (runtimeSafety)
    ? function(source, len) {
        for (let i = 0; i < len; i++) {
          const v = get.call(source, i);
          if (v === value && i !== len - 1) {
            throw new MisplacedSentinel(structure, value, i, len);
          } else if (v !== value && i === len - 1) {
            throw new MissingSentinel(structure, value, len);
          }
        }
      }
    : function(source, len) {
        if (len * byteSize === source[MEMORY].byteLength) {
          const i = len - 1;
          const v = get.call(source, i);
          if (v !== value) {
            throw new MissingSentinel(structure, value, len);
          }
        }
    }
  : function () {};
  const bytes = template[MEMORY];
  return { value, bytes, validateValue, validateData, isRequired };
}

function defineUnionShape(structure, env) {
  const {
    type,
    byteSize,
    align,
    instance: { members, template },
    isIterator,
    hasPointer,
  } = structure;
  const { runtimeSafety } = env;
  const isTagged = (type === StructureType.TaggedUnion);
  const exclusion = (isTagged || (type === StructureType.BareUnion && runtimeSafety));
  const memberDescriptors = {};
  const memberInitializers = {};
  const memberValueGetters = {};
  const valueMembers = (exclusion) ? members.slice(0, -1) : members;
  const selectorMember = (exclusion) ? members[members.length - 1] : null;
  const { get: getSelector, set: setSelector } = (exclusion) ? getDescriptor(selectorMember, env) : {};
  const getActiveField = (isTagged)
  ? function() {
      const item = getSelector.call(this);
      return item[NAME];
    }
  : function() {
      const index = getSelector.call(this);
      return valueMembers[index].name;
    };
  const setActiveField = (isTagged)
  ? function(name) {
      const { constructor } = selectorMember.structure;
      setSelector.call(this, constructor[name]);
    }
  : function(name) {
      const index = valueMembers.findIndex(m => m.name === name);
      setSelector.call(this, index);
    };
  for (const member of valueMembers) {
    const { name } = member;
    const { get: getValue, set: setValue } = getDescriptor(member, env);
    const get = (exclusion)
    ? function() {
        const currentName = getActiveField.call(this);
        if (name !== currentName) {
          if (isTagged) {
            // tagged union allows inactive member to be queried
            return null;
          } else {
            // whereas bare union does not, since the condition is not detectable
            // when runtime safety is off
            throw new InactiveUnionProperty(structure, name, currentName);
          }
        }
        this[POINTER_VISITOR]?.(resetPointer);
        return getValue.call(this);
      }
    : getValue;
    const set = (exclusion && setValue)
    ? function(value) {
        const currentName = getActiveField.call(this);
        if (name !== currentName) {
          throw new InactiveUnionProperty(structure, name, currentName);
        }
        setValue.call(this, value);
      }
    : setValue;
    const init = (exclusion && setValue)
    ? function(value) {
        setActiveField.call(this, name);
        setValue.call(this, value);
        this[POINTER_VISITOR]?.(resetPointer);
      }
    : setValue;
    memberDescriptors[name] = { get, set, configurable: true, enumerable: true };
    memberInitializers[name] = init;
    memberValueGetters[name] = getValue;
  }
  const hasDefaultMember = !!valueMembers.find(m => !m.isRequired);
  const memberKeys = Object.keys(memberDescriptors);
  const propApplier = createPropertyApplier(structure);
  const initializer = function(arg) {
    if (arg instanceof constructor) {
      /* WASM-ONLY-END */
      this[COPIER](arg);
      if (hasPointer) {
        this[POINTER_VISITOR](copyPointer, { vivificate: true, source: arg });
      }
    } else if (arg && typeof(arg) === 'object') {
      let found = 0;
      for (const key of memberKeys) {
        if (key in arg) {
          found++;
        }
      }
      if (found > 1) {
        throw new MultipleUnionInitializers(structure);
      }
      if (propApplier.call(this, arg) === 0 && !hasDefaultMember) {
        throw new MissingUnionInitializer(structure, arg, exclusion);
      }
    } else if (arg !== undefined) {
      throw new InvalidInitializer(structure, 'object with a single property', arg);
    }
  };
  // non-tagged union as marked as not having pointers--if there're actually
  // members with pointers, we need to disable them
  const pointerMembers = members.filter(m => m.structure?.hasPointer);
  const hasInaccessiblePointer = !hasPointer && (pointerMembers.length > 0);
  const modifier = (hasInaccessiblePointer && !env.comptime)
  ? function() {
      // make pointer access throw
      this[POINTER_VISITOR](disablePointer, { vivificate: true });
    }
  : undefined;
  const constructor = structure.constructor = createConstructor(structure, { modifier, initializer }, env);
  const fieldDescriptor = (isTagged)
  ? {
      // for tagged union,  only the active field
      get() { return [ getActiveField.call(this) ] }
    }
  : {
      // for bare and extern union, all members are included
      value: valueMembers.map(m => m.name)
    };
  const isChildActive = (isTagged)
  ? function(child) {
      const name = getActiveField.call(this);
      const active = memberValueGetters[name].call(this);
      return child === active;
    }
  : never;
  const toPrimitive = (isTagged)
  ? function(hint) {
    switch (hint) {
      case 'string':
      case 'default':
        return getActiveField.call(this);
      default:
        return getSelector.call(this, 'number');
    }
  }
  : null;
  const getTagClass = function() { return selectorMember.structure.constructor };
  const getIterator = (isIterator) ? getIteratorIterator : getUnionIterator;
  const hasAnyPointer = hasPointer || hasInaccessiblePointer;
  const hasObject = !!members.find(m => m?.type === MemberType.Object);
  const instanceDescriptors = {
    $: { get: getSelf, set: initializer, configurable: true },
    dataView: getDataViewDescriptor(structure),
    base64: getBase64Descriptor(structure),
    valueOf: { value: getValueOf },
    toJSON: { value: convertToJSON },
    delete: { value: getDestructor(env) },
    ...memberDescriptors,
    [Symbol.iterator]: { value: getIterator },
    [Symbol.toPrimitive]: isTagged && { value: toPrimitive },
    [ENTRIES_GETTER]: { value: getUnionEntries },
    [COPIER]: { value: getMemoryCopier(byteSize) },
    [TAG]: isTagged && { get: getSelector, configurable: true },
    [VIVIFICATOR]: hasObject && { value: getChildVivificator$1(structure, env) },
    [POINTER_VISITOR]: hasAnyPointer && { value: getPointerVisitor$1(structure, { isChildActive }) },
    [PROP_GETTERS]: { value: memberValueGetters },
    [WRITE_DISABLER]: { value: makeReadOnly },
    [PROPS]: fieldDescriptor,
  };
  const staticDescriptors = {
    tag: isTagged && { get: getTagClass },
    [ALIGN]: { value: align },
    [SIZE]: { value: byteSize },
    [TYPE]: { value: structure.type },
  };
  attachDescriptors(constructor, instanceDescriptors, staticDescriptors, env);
  // replace regular setters with ones that change the active field
  const setters = constructor.prototype[PROP_SETTERS];
  for (const [ name, init ] of Object.entries(memberInitializers)) {
    if (init) {
      setters[name] = init;
    }
  }
}
function getUnionEntries(options) {
  return {
    [Symbol.iterator]: getUnionEntriesIterator.bind(this, options),
    length: this[PROPS].length,
  };
}

function getUnionIterator(options) {
  const entries = getUnionEntries.call(this, options);
  return entries[Symbol.iterator]();
}

function getUnionEntriesIterator(options) {
  const self = this;
  const props = this[PROPS];
  const getters = this[PROP_GETTERS];
  let index = 0;
  return {
    next() {
      let value, done;
      if (index < props.length) {
        const current = props[index++];
        // get value of prop with no check
        value = [ current, handleError(() => getters[current].call(self), options) ];
        done = false;
      } else {
        done = true;
      }
      return { value, done };
    },
  };
}

function defineVariadicStruct(structure, env) {
  const {
    byteSize,
    align,
    instance: { members },
  } = structure;
  const hasObject = !!members.find(m => m.type === MemberType.Object);
  const argMembers = members.slice(1);
  const argCount = argMembers.length;
  const argKeys = argMembers.map(m => m.name);
  const maxSlot = members.map(m => m.slot).sort().pop();
  const constructor = structure.constructor = function(args, name, offset) {
    if (args.length < argCount) {
      throw new ArgumentCountMismatch(name, `at least ${argCount - offset}`, args.length - offset);
    }
    // calculate the actual size of the struct based on arguments given
    let totalByteSize = byteSize;
    const varArgs = args.slice(argCount);
    const offsets = {};
    for (const [ index, arg ] of varArgs.entries()) {
      const dv = arg[MEMORY];
      let argAlign = arg.constructor[ALIGN];
      if (!dv || !argAlign) {
        const err = new InvalidVariadicArgument();
        throw adjustArgumentError(name, index - offset, argCount - offset, err);
      }
      /* WASM-ONLY */
      // the arg struct is passed to the function in WebAssembly and fields are
      // expected to aligned to at least 4
      argAlign = Math.max(env.wordSize, argAlign);
      /* WASM-ONLY-END */
      const offset = offsets[index] = (totalByteSize + argAlign - 1) & ~(argAlign - 1);
      totalByteSize = offset + dv.byteLength;
    }
    const attrs = new ArgAttributes(args.length);
    const dv = env.allocateMemory(totalByteSize);
    this[MEMORY] = dv;
    this[SLOTS] = {};
    for (const [ index, key ] of argKeys.entries()) {
      try {
        this[key] = args[index];
      } catch (err) {
        throw adjustArgumentError(name, index - offset, argCount - offset, err);
      }
    }
    // set attributes of retval and fixed args
    for (const [ index, { bitOffset, byteSize, type, structure: { align } } ] of argMembers.entries()) {
      attrs.set(index, bitOffset / 8, byteSize, align, type);
    }
    // create additional child objects and copy arguments into them
    for (const [ index, arg ] of varArgs.entries()) {
      const slot = maxSlot + index + 1;
      const { byteLength } = arg[MEMORY];
      const offset = offsets[index];
      const childDV = env.obtainView(dv.buffer, offset, byteLength);
      const child = this[SLOTS][slot] = arg.constructor.call(PARENT, childDV);
      child.$ = arg;
      // set attributes
      attrs.set(argCount + index, offset, byteLength, arg.constructor[ALIGN], arg.constructor[PRIMITIVE]);
    }
    this[ATTRIBUTES] = attrs;
  };
  const memberDescriptors = {};
  for (const member of members) {
    memberDescriptors[member.name] = getDescriptor(member, env);
  }
  const { slot: retvalSlot, type: retvalType } = members[0];
  const isChildMutable = (retvalType === MemberType.Object)
  ? function(object) {
      const child = this[VIVIFICATOR](retvalSlot);
      return object === child;
    }
  : function() { return false };
  const visitPointers = function(cb, options = {}) {
    const {
      vivificate = false,
      isActive = always,
      isMutable = always,
    } = options;
    const childOptions = {
      ...options,
      isActive,
      isMutable: (object) => isMutable(this) && isChildMutable.call(this, object),
    };
    if (vivificate && retvalType === MemberType.Object) {
      this[VIVIFICATOR](retvalSlot);
    }
    for (const child of Object.values(this[SLOTS])) {
      child?.[POINTER_VISITOR]?.(cb, childOptions);
    }
  };
  const ArgAttributes = function(length) {
    this[MEMORY] = env.allocateMemory(length * 8, 4);
    this.length = length;
    this.littleEndian = env.littleEndian;
  };
  const setAttributes = function(index, offset, size, align, type) {
    const dv = this[MEMORY];
    const le = env.littleEndian;
    dv.setUint16(index * 8, offset, le);
    dv.setUint16(index * 8 + 2, size, le);
    dv.setUint16(index * 8 + 4, align, le);
    dv.setUint8(index * 8 + 6, type == MemberType.Float);
    dv.setUint8(index * 8 + 7, type == MemberType.Int);
  };
  defineProperties(ArgAttributes.prototype, {
    set: { value: setAttributes },
    [COPIER]: { value: getMemoryCopier(4, true) },
    [ALIGN]: { value: 4 },
    /* WASM-ONLY */
    [MEMORY_RESTORER]: { value: getMemoryRestorer(null, env) },
    /* WASM-ONLY-END */
  });
  defineProperties(constructor.prototype, {
    ...memberDescriptors,
    [COPIER]: { value: getMemoryCopier(undefined, true) },
    [VIVIFICATOR]: hasObject && { value: getChildVivificator$1(structure, env) },
    [POINTER_VISITOR]: { value: visitPointers },
    /* WASM-ONLY */
    [MEMORY_RESTORER]: { value: getMemoryRestorer(null, env) },
    /* WASM-ONLY-END */
  });
  defineProperties(constructor, {
    [SIZE]: { value: byteSize },
  });
  return constructor;
}

const factories = Array(Object.values(StructureType).length);

function usePrimitive() {
  factories[StructureType.Primitive] = definePrimitive;
}

function useArray() {
  factories[StructureType.Array] = defineArray;
}

function useStruct() {
  factories[StructureType.Struct] = defineStructShape;
}

function usePackedStruct() {
  factories[StructureType.PackedStruct] = defineStructShape;
}

function useExternStruct() {
  factories[StructureType.ExternStruct] = defineStructShape;
}

function useArgStruct() {
  factories[StructureType.ArgStruct] = defineArgStruct;
}

function useVariadicStruct() {
  factories[StructureType.VariadicStruct] = defineVariadicStruct;
}

function useExternUnion() {
  factories[StructureType.ExternUnion] = defineUnionShape;
}

function useBareUnion() {
  factories[StructureType.BareUnion] = defineUnionShape;
}

function useTaggedUnion() {
  factories[StructureType.TaggedUnion] = defineUnionShape;
}

function useErrorUnion() {
  factories[StructureType.ErrorUnion] = defineErrorUnion;
}

function useErrorSet() {
  factories[StructureType.ErrorSet] = defineErrorSet;
  useErrorSetTransform();
}

function useEnum() {
  factories[StructureType.Enum] = defineEnumerationShape;
  useEnumerationTransform();
}

function useOptional() {
  factories[StructureType.Optional] = defineOptional;
}

function useSinglePointer() {
  factories[StructureType.SinglePointer] = definePointer;
  useUint();
}

function useSlicePointer() {
  factories[StructureType.SlicePointer] = definePointer;
  useUint();
}

function useMultiPointer() {
  factories[StructureType.MultiPointer] = definePointer;
  useUint();
}

function useCPointer() {
  factories[StructureType.CPointer] = definePointer;
  useUint();
}

function useSlice() {
  factories[StructureType.Slice] = defineSlice;
}

function useVector() {
  factories[StructureType.Vector] = defineVector;
}

function useOpaque() {
  factories[StructureType.Opaque] = defineOpaque;
}

function getStructureFactory(type) {
  const f = factories[type];
  return f;
}

class Environment {
  context;
  contextStack = [];
  consolePending = [];
  consoleTimeout = 0;
  viewMap = new WeakMap();
  emptyBuffer = new ArrayBuffer(0);
  abandoned = false;
  released = false;
  littleEndian = true;
  wordSize = 4;
  runtimeSafety = true;
  comptime = false;
  /* RUNTIME-ONLY */
  variables = [];
  /* RUNTIME-ONLY-END */
  imports;
  console = globalThis.console;


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

  allocateFixedMemory(len, align) {
    const address = (len) ? this.allocateExternMemory(len, align) : 0;
    const dv = this.obtainFixedView(address, len);
    dv[FIXED].align = align;
    return dv;
  }

  freeFixedMemory(address, len, align) {
    if (len) {
      this.freeExternMemory(address, len, align);
    }
  }

  obtainFixedView(address, len) {
    let dv;
    if (address && len) {
      dv = this.obtainExternView(address, len);
    } else {
      // pointer to nothing
      let entry = this.viewMap.get(this.emptyBuffer);
      if (!entry) {
        this.viewMap.set(this.emptyBuffer, entry = {});
      }
      const key = `${address}:0`;
      dv = entry[key];
      if (!dv) {
        dv = entry[key] = new DataView(this.emptyBuffer);
        dv[FIXED] = { address, len: 0 };
      }
    }
    return dv;
  }

  releaseFixedView(dv) {
    const { address, len, align } = dv[FIXED];
    // only allocated memory would have align attached
    if (align !== undefined) {
      this.freeFixedMemory(address, len, align);
      dv[FIXED] = null;
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

  findMemory(address, count, size) {
    if (isInvalidAddress(address)) {
      if (!count) {
        address = 0;
      } else {
        return null;
      }
    } else if (!address && count) {
      return null;
    }
    let len = count * (size ?? 0);
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
        const isOpaque = size === undefined;
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
    return this.obtainFixedView(address, len);
  }

  getViewAddress(dv) {
    const fixed = dv[FIXED];
    if (fixed) {
      return fixed.address;
    } else {
      const address = this.getBufferAddress(dv.buffer);
      return add(address, dv.byteOffset);
    }
  }

  findViewAt(buffer, offset, len) {
    let entry = this.viewMap.get(buffer);
    let existing;
    if (entry) {
      if (entry instanceof DataView) {
        // only one view created thus far--see if that's the matching one
        if (entry.byteOffset === offset && entry.byteLength === len) {
          existing = entry;
        } else {
          // no, need to replace the entry with a hash keyed by `offset:len`
          const prev = entry;
          const prevKey = `${prev.byteOffset}:${prev.byteLength}`;
          entry = { [prevKey]: prev };
          this.viewMap.set(buffer, entry);
        }
      } else {
        existing = entry[`${offset}:${len}`];
      }
    }
    return { existing, entry };
  }

  obtainView(buffer, offset, len) {
    const { existing, entry } = this.findViewAt(buffer, offset, len);
    let dv;
    if (existing) {
      return existing;
    } else if (entry) {
      dv = entry[`${offset}:${len}`] = new DataView(buffer, offset, len);
    } else {
      // just one view of this buffer for now
      this.viewMap.set(buffer, dv = new DataView(buffer, offset, len));
    }
    const fixed = buffer[FIXED];
    if (fixed) {
      // attach address to view of fixed buffer
      dv[FIXED] = { address: add(fixed.address, offset), len };
    }
    return dv;
  }

  registerView(dv) {
    if (!dv[FIXED]) {
      const { buffer, byteOffset, byteLength } = dv;
      const { existing, entry } = this.findViewAt(buffer, byteOffset, byteLength);
      if (existing) {
        // return existing view instead of this one
        return existing;
      } else if (entry) {
        entry[`${byteOffset}:${byteLength}`] = dv;
      } else {
        this.viewMap.set(buffer, dv);
      }
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

  castView(address, len, copy, structure) {
    const { constructor, hasPointer } = structure;
    const dv = this.captureView(address, len, copy);
    const object = constructor.call(ENVIRONMENT, dv);
    if (hasPointer) {
      // acquire targets of pointers
      this.updatePointerTargets(object);
    }
    if (copy) {
      object[WRITE_DISABLER]();
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
        return self.invokeThunk(thunkId, new constructor([ this, ...args ], name, 1));
      };
    } else {
      f = function(...args) {
        return self.invokeThunk(thunkId, new constructor(args, name, 0));
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
      const { memory, structure, actual } = placeholder;
      if (memory) {
        if (actual) {
          return actual;
        } else {
          const { array, offset, length } = memory;
          const dv = this.obtainView(array.buffer, offset, length);
          const { constructor } = structure;
          const { reloc, const: isConst } = placeholder;
          const object = placeholder.actual = constructor.call(ENVIRONMENT, dv);
          if (isConst) {
            object[WRITE_DISABLER]?.();
          }
          if (placeholder.slots) {
            insertObjects(object[SLOTS], placeholder.slots);
          }
          if (reloc !== undefined) {
            // need to replace dataview with one pointing to fixed memory later,
            // when the VM is up and running
            this.variables.push({ reloc, object });
          }
          return object;
        }
      } else {
        return structure;
      }
    };
    resetGlobalErrorSet();
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
      pointer[ADDRESS_SETTER](address);
      pointer[LENGTH_SETTER]?.(target.length);
    }
  }

  linkObject(object, reloc, writeBack) {
    if (object[MEMORY][FIXED]) {
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
    if (!object[MEMORY][FIXED]) {
      return;
    }
    /* WASM-ONLY */
    object[MEMORY_RESTORER]();
    /* WASM-ONLY-END */
    const dv = object[MEMORY];
    const relocDV = this.allocateMemory(dv.byteLength);
    const dest = Object.create(object.constructor.prototype);
    dest[MEMORY] = relocDV;
    dest[COPIER](object);
    object[MEMORY] = relocDV;
  }

  releaseFunctions() {
    const throwError = () => { throw new Error(`Module was abandoned`) };
    for (const name of Object.keys(this.imports)) {
      if (this[name]) {
        this[name] = throwError;
      }
    }
  }

  getSpecialExports() {
    const check = (v) => {
      if (v === undefined) throw new Error('Not a Zig type');
      return v;
    };
    return {
      init: (...args) => this.init(...args),
      abandon: () => this.abandon(),
      released: () => this.released,
      connect: (c) => this.console = c,
      sizeOf: (T) => check(T[SIZE]),
      alignOf: (T) => check(T[ALIGN]),
      typeOf: (T) => getStructureName(check(T[TYPE])),
    };
  }

  abandon() {
    if (!this.abandoned) {
      this.releaseFunctions();
      this.unlinkVariables();
      this.abandoned = true;
    }
  }

  updatePointerAddresses(args) {
    // first, collect all the pointers
    const pointerMap = new Map();
    const bufferMap = new Map();
    const potentialClusters = [];
    const callback = function({ isActive }) {
      if (isActive(this)) {
        // bypass proxy
        const pointer = this[POINTER];
        if (!pointerMap.get(pointer)) {
          const target = pointer[SLOTS][0];
          if (target) {
            pointerMap.set(pointer, target);
            // only relocatable targets need updating
            const dv = target[MEMORY];
            if (!dv[FIXED]) {
              // see if the buffer is shared with other objects
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
      const address = this.getTargetAddress(target, cluster) ?? this.getShadowAddress(target, cluster);
      // update the pointer
      pointer[ADDRESS_SETTER](address);
      pointer[LENGTH_SETTER]?.(target.length);
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
    const maxAlignAddress = getAlignedAddress(add(unalignedAddress, maxAlignOffset - start), maxAlign);
    const shadowAddress = add(maxAlignAddress, start - maxAlignOffset);
    const shadowOffset = unalignedShadowDV.byteOffset + Number(shadowAddress - unalignedAddress);
    const shadowDV = new DataView(unalignedShadowDV.buffer, shadowOffset, len);
    // make sure that other pointers are correctly aligned also
    for (const target of targets) {
      const dv = target[MEMORY];
      const offset = dv.byteOffset;
      if (offset !== maxAlignOffset) {
        const align = target.constructor[ALIGN] ?? dv[ALIGN];
        if (isMisaligned(add(shadowAddress, offset - start), align)) {
          throw new AlignmentConflict(align, maxAlign);
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
      return add(cluster.address, dv.byteOffset - cluster.start);
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
    /* WASM-ONLY */
    shadow[MEMORY_RESTORER] = getMemoryRestorer(null, this);
    /* WASM-ONLY-END */
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

  updatePointerTargets(args) {
    const pointerMap = new Map();
    const callback = function({ isActive, isMutable }) {
      // bypass proxy
      const pointer = this[POINTER];
      if (!pointerMap.get(pointer)) {
        pointerMap.set(pointer, true);
        const writable = !pointer.constructor.const;
        const currentTarget = pointer[SLOTS][0];
        const newTarget = (!currentTarget || isMutable(this))
        ? pointer[TARGET_UPDATER](true, isActive(this))
        : currentTarget;
        // update targets of pointers in original target (which could have been altered)
        currentTarget?.[POINTER_VISITOR]?.(callback, { vivificate: true, isMutable: () => writable });
        if (newTarget !== currentTarget) {
          // acquire targets of pointers in new target
          newTarget?.[POINTER_VISITOR]?.(callback, { vivificate: true, isMutable: () => writable });
        }
      }
    };
    args[POINTER_VISITOR](callback, { vivificate: true });
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

function isInvalidAddress(address) {
  if (typeof(address) === 'bigint') {
    return address === 0xaaaaaaaaaaaaaaaan;
  } else {
    return address === 0xaaaaaaaa;
  }
}

class WebAssemblyEnvironment extends Environment {
  imports = {
    getFactoryThunk: { argType: '', returnType: 'i' },
    allocateExternMemory: { argType: 'ii', returnType: 'i' },
    freeExternMemory: { argType: 'iii' },
    allocateShadowMemory: { argType: 'cii', returnType: 'v' },
    freeShadowMemory: { argType: 'ciii' },
    runThunk: { argType: 'iv', returnType: 'v' },
    runVariadicThunk: { argType: 'ivi', returnType: 'v' },
    isRuntimeSafetyActive: { argType: '', returnType: 'b' },
    flushStdout: { argType: '', returnType: '' },
  };
  exports = {
    allocateHostMemory: { argType: 'ii', returnType: 'v' },
    freeHostMemory: { argType: 'iii' },
    captureString: { argType: 'ii', returnType: 'v' },
    captureView: { argType: 'iib', returnType: 'v' },
    castView: { argType: 'iibv', returnType: 'v' },
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
    startCall: { argType: 'iv', returnType: 'i' },
    endCall: { argType: 'iv', returnType: 'i' },
    getArgAttributes: { argType: '', returnType: 'i' },
  };
  nextValueIndex = 1;
  valueTable = { 0: null };
  valueIndices = new Map;
  memory = null;
  initPromise = null;
  customWASI = null;
  hasCodeSource = false;
  // WASM is always little endian
  littleEndian = true;

  async init(wasi) {
    if (wasi && this.hasCodeSource) {
      throw new Error('Cannot set WASI interface after compilation has already begun (consider disabling topLevelAwait)');
    }
    this.customWASI = wasi;
    await this.initPromise;
  }

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
    const dv = this.findMemory(address, len, 1);
    this.removeShadow(dv);
    this.unregisterMemory(address);
    this.freeShadowMemory(address, len, align);
  }

  getBufferAddress(buffer) {
    return 0;
  }

  obtainExternView(address, len) {
    const { buffer } = this.memory;
    if (!buffer[FIXED]) {
      buffer[FIXED] = { address: 0, len: buffer.byteLength };
    }
    return this.obtainView(buffer, address, len);
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
    const dv = target[MEMORY];
    if (dv[FIXED]) {
      return this.getViewAddress(dv);
    } else if (dv.byteLength === 0) {
      // it's a null pointer/empty slice
      return 0;
    }
    // relocatable buffers always need shadowing
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
    for (const [ name, { argType, returnType } ] of Object.entries(this.imports)) {
      const fn = exports[name];
      if (!fn) {
        throw new Error(`Unable to import function: ${name}`);
      }
      this[name] = this.importFunction(fn, argType, returnType);
    }
  }

  async instantiateWebAssembly(source) {
    const res = await source;
    this.hasCodeSource = true;
    const imports = {
      env: this.exportFunctions(),
      wasi_snapshot_preview1: this.getWASIImport(),
    };
    if (res[Symbol.toStringTag] === 'Response') {
      return WebAssembly.instantiateStreaming(res, imports);
    } else {
      return WebAssembly.instantiate(res, imports);
    }
  }

  loadModule(source) {
    return this.initPromise = (async () => {
      const { instance } = await this.instantiateWebAssembly(source);
      const { memory, _initialize } = instance.exports;
      this.importFunctions(instance.exports);
      this.trackInstance(instance);
      this.customWASI?.initialize?.(instance);
      this.runtimeSafety = this.isRuntimeSafetyActive();
      this.memory = memory;
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
    const attrs = args[ATTRIBUTES];
    if (attrs) {
      this.context.argAttributes = this.getShadowAddress(attrs);
    }
    this.updateShadows();
    return address;
  }

  endCall(call, args) {
    this.updateShadowTargets();
    if (args[POINTER_VISITOR]) {
      this.updatePointerTargets(args);
    }
    this.releaseShadows();
    // restore the previous context if there's one
    this.endContext();
    if (!this.context && this.flushConsole) {
      this.flushStdout();
      this.flushConsole();
    }
  }

  getArgAttributes() {
    return this.context.argAttributes;
  }

  async runThunk(thunkId, args) {
    // this method will be overridden by the WASM version once compilation completes
    await this.initPromise;
    return this.runThunk(thunkId, args);
  }

  async runVariadicThunk(thunkId, args, argCount) {
    // ditto
    await this.initPromise;
    return this.runVariadicThunk(thunkId, args, argCount);
  }

  invokeThunk(thunkId, args) {
    try {
      // wasm-exporter.zig will invoke startCall() with the context address and the args
      // we can't do pointer fix up here since we need the context in order to allocate
      // memory from the WebAssembly allocator; pointer target acquisition will happen in
      // endCall()
      const attrs = args[ATTRIBUTES];
      const unexpected = (attrs)
      ? this.runVariadicThunk(thunkId, args, attrs.length)
      : this.runThunk(thunkId, args);
      // errors returned by exported Zig functions are normally written into the
      // argument object and get thrown when we access its retval property (a zig error union)
      // error strings returned by the thunk are due to problems in the thunking process
      // (i.e. bugs in export.zig)
      if (unexpected) {
        if (unexpected[Symbol.toStringTag] === 'Promise') {
          // getting a promise, WASM is not yet ready
          // wait for fulfillment, then either return result or throw
          return unexpected.then((unexpected) => {
            if (unexpected) {
              this.handleError(unexpected);
            }
            return args.retval;
          }, (err) => {
            this.handleError(err);
          })
        } else {
          throw unexpected;
        }
      }
      return args.retval;
    } catch (err) {
      this.handleError(err);
    }
  }

  handleError(unexpected) {
    if (typeof(unexpected) === 'string') {
      // an error string
      throw new ZigError(unexpected);
    } else if (unexpected instanceof Exit && unexpected.code === 0) {
      // do nothing when exit code is 0
      return;
    } else {
      throw unexpected;
    }
  }

  getWASIImport() {
    if (this.customWASI) {
      return this.customWASI.wasiImport;
    } else {
      const ENOSYS = 38;
      const ENOBADF = 8;
      const noImpl = () => ENOSYS;
      return {
        args_get: noImpl,
        args_sizes_get: noImpl,
        clock_res_get: noImpl,
        clock_time_get: noImpl,
        environ_get: noImpl,
        environ_sizes_get: noImpl,
        fd_advise: noImpl,
        fd_allocate: noImpl,
        fd_close: noImpl,
        fd_datasync: noImpl,
        fd_pread: noImpl,
        fd_pwrite: noImpl,
        fd_read: noImpl,
        fd_readdir: noImpl,
        fd_renumber: noImpl,
        fd_seek: noImpl,
        fd_sync: noImpl,
        fd_tell: noImpl,
        fd_write: (fd, iovs_ptr, iovs_count, written_ptr) => {
          if (fd === 1 || fd === 2) {
            const dv = new DataView(this.memory.buffer);
            let written = 0;
            for (let i = 0, p = iovs_ptr; i < iovs_count; i++, p += 8) {
              const buf_ptr = dv.getUint32(p, true);
              const buf_len = dv.getUint32(p + 4, true);
              if (buf_len > 0) {
                const buf = new DataView(this.memory.buffer, buf_ptr, buf_len);
                this.writeToConsole(buf);
                written += buf_len;
              }
            }
            dv.setUint32(written_ptr, written, true);
            return 0;
          } else {
            return ENOSYS;
          }
        },
        fd_fdstat_get: noImpl,
        fd_fdstat_set_flags: noImpl,
        fd_fdstat_set_rights: noImpl,
        fd_filestat_get: noImpl,
        fd_filestat_set_size: noImpl,
        fd_filestat_set_times: noImpl,
        fd_prestat_get: () => ENOBADF,
        fd_prestat_dir_name: noImpl,
        path_create_directory: noImpl,
        path_filestat_get: noImpl,
        path_filestat_set_times: noImpl,
        path_link: noImpl,
        path_open: noImpl,
        path_readlink: noImpl,
        path_remove_directory: noImpl,
        path_rename: noImpl,
        path_symlink: noImpl,
        path_unlink_file: noImpl,
        poll_oneoff: noImpl,
        proc_exit: (code) => {
          throw new Exit(code);
        },
        random_get: (buf, buf_len) => {
          const dv = new DataView(this.memory.buffer, buf, buf_len);
          for (let i = 0; i < buf_len; i++) {
            dv.setUint8(i, Math.floor(256 * Math.random()));
          }
          return 0;
        },
        sched_yield: noImpl,
        sock_accept: noImpl,
        sock_recv: noImpl,
        sock_send: noImpl,
        sock_shutdown: noImpl,
      };
    }
  }
}

function createEnvironment(source) {
  return new WebAssemblyEnvironment();
}
/* RUNTIME-ONLY-END */

export { createEnvironment, useArgStruct, useArray, useBareUnion, useBool, useCPointer, useComptime, useEnum, useErrorSet, useErrorUnion, useExtendedBool, useExtendedFloat, useExtendedInt, useExtendedUint, useExternStruct, useExternUnion, useFloat, useInt, useLiteral, useMultiPointer, useNull, useObject, useOpaque, useOptional, usePackedStruct, usePrimitive, useSinglePointer, useSlice, useSlicePointer, useStatic, useStruct, useTaggedUnion, useType, useUint, useUndefined, useUnsupported, useVariadicStruct, useVector, useVoid };
