import { execFileSync, execSync, exec } from 'child_process';
import { statSync, lstatSync, openSync, writeSync, closeSync, readFileSync, writeFileSync, chmodSync, unlinkSync, mkdirSync, readdirSync, rmdirSync } from 'fs';
import { stat, lstat, open, readFile, writeFile, chmod, unlink, mkdir, readdir, rmdir } from 'fs/promises';
import os from 'os';
import { sep, dirname, parse, join, basename, resolve } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

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
};

const StructureType = {
  Primitive: 0,
  Array: 1,
  Struct: 2,
  ExternStruct: 3,
  PackedStruct: 4,
  ArgStruct: 5,
  ExternUnion: 6,
  BareUnion: 7,
  TaggedUnion: 8,
  ErrorUnion: 9,
  ErrorSet: 10,
  Enumeration: 11,
  Optional: 12,
  Pointer: 13,
  Slice: 14,
  Vector: 15,
  Opaque: 16,
  Function: 17,
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

function isByteAligned({ bitOffset, bitSize, byteSize }) {
  return byteSize !== undefined || (!(bitOffset & 0x07) && !(bitSize & 0x07)) || bitSize === 0;
}

function hasStandardIntSize({ bitSize }) {
  return bitSize === 8 || bitSize === 16 || bitSize === 32 || bitSize === 64;
}

function hasStandardFloatSize({ bitSize }) {
  return bitSize === 32 || bitSize === 64;
}

function isErrorJSON(arg) {
  return typeof(arg) === 'object' && typeof(arg.error) === 'string' && Object.keys(arg).length === 1  ;
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
        case StructureType.Enumeration: object = 'enum item'; break;
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
  constructor(structure, actual) {
    const { name, instance: { members } } = structure;
    const argCount = members.length - 1;
    const s = (argCount !== 1) ? 's' : '';
    super(`${name} expects ${argCount} argument${s}, received ${actual}`);
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

class ZigError extends Error {
  constructor(name) {
    super(deanimalizeErrorName(name));
  }
}

function adjustArgumentError(structure, index, err) {
  const { name, instance: { members } } = structure;
  // Zig currently does not provide the argument name
  const argName = `args[${index}]`;
  const argCount = members.length - 1;
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
          const acronym = m1.substring(0, m1.length - 1);
          const letter = m1.charAt(m1.length - 1).toLocaleLowerCase();
          return ` ${acronym} ${letter}${m2}`;
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
const LOCATION_GETTER = Symbol('addressGetter');
const LOCATION_SETTER = Symbol('addressSetter');
const TARGET_GETTER = Symbol('targetGetter');
const TARGET_SETTER = Symbol('targetSetter');
const ENTRIES_GETTER = Symbol('entriesGetter');
const FIXED_LOCATION = Symbol('fixedLocation');
const PROP_GETTERS = Symbol('propGetters');
const PROP_SETTERS = Symbol('propSetters');
const WRITE_DISABLER = Symbol('writeDisabler');
const ALL_KEYS = Symbol('allKeys');
const LENGTH = Symbol('length');
const PROXY = Symbol('proxy');
const COMPAT = Symbol('compat');
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

function getMemoryResetter(offset, size) {
  const reset = getResetFunction(size);
  return function() {
    /* WASM-ONLY */
    restoreMemory.call(this);
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
            throw new ArrayLengthMismatch(structure, null, arg);
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
  const multiple = type === StructureType.Slice;
  if (multiple ? dv.byteLength % byteSize !== 0 : dv.byteLength !== byteSize) {
    throw new BufferSizeMismatch(structure, dv);
  }
}

function setDataView(dv, structure, copy, fixed, handlers) {
  const { byteSize, type, sentinel } = structure;
  const multiple = type === StructureType.Slice;
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
    const byteLength = multiple ? byteSize * this.length : byteSize;
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

function useAllExtendedTypes() {
  useExtendedBool();
  useExtendedInt();
  useExtendedUint();
  useExtendedFloat();
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

const transformers = {};

function useEnumerationTransform() {
  transformers[StructureType.Enumeration] = transformEnumerationDescriptor;
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
          if (err instanceof TypeError && restoreMemory.call(this)) {
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

function useAllMemberTypes() {
  useVoid();
  useNull();
  useUndefined();
  useBool();
  useInt();
  useUint();
  useFloat();
  useObject();
  useType();
  useComptime();
  useStatic();
  useLiteral();
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
  return constructor;
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
        case StructureType.Pointer:
          try {
            result = value['*'];
          } catch (err) {
            result = Symbol.for('inaccessible');
          }
          break;
        case StructureType.Enumeration:
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
    debugger;
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
      const s = decodeText(ta, `utf-${charSize * 8}`);
      return (sentinel?.value === undefined) ? s : s.slice(0, -1);
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
  const { type, sentinel, length } = targetStructure;
  // length for slice can be zero or undefined
  const hasLength = (type === StructureType.Slice) && targetStructure.length === undefined && !sentinel;  
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
        const dv = env.findMemory(location.address, location.length, Target[SIZE]);
        const target = Target.call(ENVIRONMENT, dv);
        this[SLOTS][0] = target;
        this[FIXED_LOCATION] = location;
      }
    }    
  };
  const getTargetObject = function() {
    updateTarget.call(this);
    const target = this[SLOTS][0];
    if (!target) {
      throw new NullPointer();
    }
    return (isConst) ? getConstProxy(target) : target;
  };
  const setTargetObject = function(arg) {
    if (env.inFixedMemory(this)) {
      // the pointer sits in fixed memory--apply the change immediately
      if (env.inFixedMemory(arg)) {
        const loc = {
          address: env.getViewAddress(arg[MEMORY]),
          length: (hasLength) ? arg.length : fixedLength
        };
        addressSetter.call(this, loc);
        this[FIXED_LOCATION] = loc;
      } else {
        throw new FixedMemoryTargetRequired(structure, arg);
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
  const setTarget = !isConst
  ? function(value) {
      updateTarget.call(this);
      const object = this[SLOTS][0];
      if (!object) {
        throw new NullPointer();
      }
      return object[SETTER](value);
    } 
  : throwReadOnly;
  const alternateCaster = function(arg, options) {
    const Target = targetStructure.constructor;
    if ((this === ENVIRONMENT || this === PARENT) || arg instanceof constructor) {
      // casting from buffer to pointer is allowed only if request comes from the runtime
      // casting from writable to read-only is also allowed
      return false;
    } else if (isPointerOf(arg, Target)) {
      // const/non-const casting
      return new constructor(Target(arg['*']), options);
    } else if (type === StructureType.Slice) {
      // allow casting to slice through constructor of its pointer
      return new constructor(Target(arg), options);
    } else {
      throw new NoCastingToPointer(structure);
    }
  };
  const finalizer = function() {
    const handlers = (type === StructureType.Pointer) ? {} : proxyHandlers$1;
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
      /* wasm-only */
      restoreMemory.call(arg);
      /* wasm-only-end */
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
      const fixed = env.inFixedMemory(this);
      const autoObj = new Target(arg, { fixed });
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
  const addressSetter = function({ address, length }) {
    setAddress.call(this, address);
    setLength?.call(this, length);
  };
  const fixedLength = (type != StructureType.Slice) ? 1 : length;
  const addressGetter = function() {
    const address = getAddress.call(this);
    const length = (getLength) 
    ? getLength.call(this)
    : (sentinel)
      ? (address) ? env.findSentinel(address, sentinel.bytes) + 1 : 0
      : fixedLength;
    return { address, length };
  };
  const instanceDescriptors = {
    '*': { get: getTarget, set: setTarget },
    '$': { get: getProxy, set: initializer },
    valueOf: { value: getValueOf },
    toJSON: { value: convertToJSON },
    delete: { value: deleteTarget },
    [Symbol.toPrimitive]: (type === StructureType.Primitive) && { value: getPointerPrimitve },
    [TARGET_GETTER]: { value: getTargetObject },
    [TARGET_SETTER]: { value: setTargetObject },
    [LOCATION_GETTER]: { value: addressGetter },
    [LOCATION_SETTER]: { value: addressSetter },
    [POINTER_VISITOR]: { value: visitPointer },
    [COPIER]: { value: getMemoryCopier(byteSize) },
    [FIXED_LOCATION]: { value: undefined, writable: true },
    [WRITE_DISABLER]: { value: makePointerReadOnly },
  };
  const staticDescriptors = {
    child: { get: () => targetStructure.constructor },
    const: { value: isConst },
    [ALIGN]: { value: align },
    [SIZE]: { value: byteSize },
    [TYPE]: { value: structure.type },
  };
  return attachDescriptors(constructor, instanceDescriptors, staticDescriptors);
}

function makePointerReadOnly() {  
  const pointer = this[POINTER];
  const descriptor = Object.getOwnPropertyDescriptor(pointer.constructor.prototype, '$');
  descriptor.set = throwReadOnly;
  Object.defineProperty(pointer, '$', descriptor);
  Object.defineProperty(pointer, CONST_TARGET, { value: pointer });
}

function deleteTarget() {
  const target = this[SLOTS][0];
  target?.delete();
}

function getPointerPrimitve(hint) {
  const target = this[SLOTS][0];
  return target[Symbol.toPrimitive](hint);
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
      return true;
    }
    throwReadOnly();
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
  return attachDescriptors(constructor, instanceDescriptors, staticDescriptors);
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
      throw new InvalidInitializer(structure, 'object', arg);
    }
  };
  const constructor = structure.constructor = createConstructor(structure, { initializer }, env);
  const instanceDescriptors = {
    $: { get: getSelf, set: initializer },
    dataView: getDataViewDescriptor(structure),
    base64: getBase64Descriptor(structure),
    length: isTuple && { value: (members.length > 0) ? parseInt(members[members.length - 1].name) + 1 : 0 },
    valueOf: { value: getValueOf },
    toJSON: { value: convertToJSON },
    delete: { value: getDestructor(env) },
    entries: isTuple && { value: getVectorEntries },
    ...memberDescriptors,
    [Symbol.iterator]: { value: (isTuple) ? getVectorIterator : getStructIterator },
    [ENTRIES_GETTER]: { value: isTuple ? getVectorEntries : getStructEntries },
    [COPIER]: { value: getMemoryCopier(byteSize) },
    [VIVIFICATOR]: hasObject && { value: getChildVivificator$1(structure) },
    [POINTER_VISITOR]: hasPointer && { value: getPointerVisitor$1(structure, always) },
    [WRITE_DISABLER]: { value: makeReadOnly },    
    [PROPS]: { value: members.map(m => m.name) },
  };
  const staticDescriptors = {
    [ALIGN]: { value: align },
    [SIZE]: { value: byteSize },
    [TYPE]: { value: structure.type },
    [TUPLE]: { value: isTuple },
  };
  return attachDescriptors(constructor, instanceDescriptors, staticDescriptors);
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
    const childDV = new DataView(dv.buffer, offset, len);
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
      throw new ArgumentCountMismatch(structure, args.length);
    }
    for (const [ index, name ] of argNames.entries()) {
      try {
        this[name] = args[index];
      } catch (err) {
        throw adjustArgumentError(structure, index, err);
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
    [VIVIFICATOR]: hasObject && { value: getChildVivificator(structure) },
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
  return attachDescriptors(constructor, instanceDescriptors, staticDescriptors);
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

function getChildVivificator(structure) {
  const { instance: { members: [ member ]} } = structure;
  const { byteSize, structure: elementStructure } = member;
  return function getChild(index) {
    const { constructor } = elementStructure;
    const dv = this[MEMORY];
    const parentOffset = dv.byteOffset;
    const offset = parentOffset + byteSize * index;
    const childDV = new DataView(dv.buffer, offset, byteSize);
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
          debugger;        
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
  return attachDescriptors(constructor, instanceDescriptors, staticDescriptors);
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
  return attachDescriptors(constructor, instanceDescriptors, staticDescriptors);
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
    [VIVIFICATOR]: hasObject && { value: getChildVivificator$1(structure) },
    [POINTER_VISITOR]: hasPointer && { value: getPointerVisitor$1(structure, { isChildActive }) },
    [WRITE_DISABLER]: { value: makeReadOnly },
  };
  const staticDescriptors = {
    [ALIGN]: { value: align },
    [SIZE]: { value: byteSize },
    [TYPE]: { value: structure.type },
  };
  return attachDescriptors(constructor, instanceDescriptors, staticDescriptors);
}

function defineOpaque(structure, env) {
  const {
    byteSize,
    align,
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
  const instanceDescriptors = {
    $: { get: valueAccessor, set: valueAccessor },
    dataView: getDataViewDescriptor(structure),
    valueOf: { value: getValueOf },
    toJSON: { value: convertToJSON },
    delete: { value: getDestructor(env) },
    [Symbol.toPrimitive]: { value: toPrimitive },
    [COPIER]: { value: getMemoryCopier(byteSize) },
  };
  const staticDescriptors = {
    [COMPAT]: { value: getCompatibleTags(structure) },
    [ALIGN]: { value: align },
    [SIZE]: { value: byteSize },
    [TYPE]: { value: structure.type },
  };
  return attachDescriptors(constructor, instanceDescriptors, staticDescriptors);
}

function defineOptional(structure, env) {
  const {
    byteSize,
    align,
    instance: { members },
    hasPointer,
  } = structure;
  const { get: getValue, set: setValue } = getDescriptor(members[0], env);
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
  const isChildActive = getPresent;
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
      setPresent.call(this, false);
      this[RESETTER]?.();
      // clear references so objects can be garbage-collected
      this[POINTER_VISITOR]?.(resetPointer);
    } else if (arg !== undefined || isValueVoid) {      
      // call setValue() first, in case it throws
      setValue.call(this, arg);
      if (hasPresentFlag || !env.inFixedMemory(this)) {
        // since setValue() wouldn't write address into memory when the pointer is in 
        // relocatable memory, we need to use setPresent() in order to write something 
        // non-zero there so that we know the field is populated
        setPresent.call(this, true);
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
    [VIVIFICATOR]: hasObject && { value: getChildVivificator$1(structure) },
    [POINTER_VISITOR]: hasPointer && { value: getPointerVisitor$1(structure, { isChildActive }) },
    [WRITE_DISABLER]: { value: makeReadOnly },
  };
  const staticDescriptors = {
    [ALIGN]: { value: align },
    [SIZE]: { value: byteSize },
    [TYPE]: { value: structure.type },
  };
  return attachDescriptors(constructor, instanceDescriptors, staticDescriptors);
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
  };
  return attachDescriptors(constructor, instanceDescriptors, staticDescriptors);
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
    [ENTRIES_GETTER]: { value: getArrayEntries },
    [COPIER]: { value: getMemoryCopier(elementSize, true) },
    [VIVIFICATOR]: hasObject && { value: getChildVivificator(structure) },
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
      throw new MisplacedSentinel(structure, v, i, l);
    } else if (v !== value && i === l - 1) {
      throw new MissingSentinel(structure, value, i, l);
    }
  } : function(v, i, l) {
    if (v !== value && i === l - 1) {
      throw new MissingSentinel(structure, value, l);
    }
  };
  const validateData = (runtimeSafety) ? function(source, len) {
    for (let i = 0; i < len; i++) {
      const v = get.call(source, i);
      if (v === value && i !== len - 1) {
        throw new MisplacedSentinel(structure, value, i, len);
      } else if (v !== value && i === len - 1) {
        throw new MissingSentinel(structure, value, len);
      }
    }
  } : function(source, len) {
    if (len * byteSize === source[MEMORY].byteLength) {
      const i = len - 1;
      const v = get.call(source, i);
      if (v !== value) {
        throw new MissingSentinel(structure, value, len);
      }
    }
  };
  const bytes = template[MEMORY];
  return { value, bytes, validateValue, validateData };
}

function defineUnionShape(structure, env) {
  const {
    type,
    byteSize,
    align,
    instance: { members, template },
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
  const pointerMembers = members.filter(m => m.structure.hasPointer);
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
  const getTagClass = function() { return selectorMember.structure.constructor };
  const hasAnyPointer = hasPointer || hasInaccessiblePointer;
  const hasObject = !!members.find(m => m.type === MemberType.Object);
  const instanceDescriptors = {
    $: { get: getSelf, set: initializer, configurable: true },
    dataView: getDataViewDescriptor(structure),
    base64: getBase64Descriptor(structure),
    valueOf: { value: getValueOf },
    toJSON: { value: convertToJSON },
    delete: { value: getDestructor(env) },
    ...memberDescriptors,
    [Symbol.iterator]: { value: getUnionIterator },
    [ENTRIES_GETTER]: { value: getUnionEntries },
    [COPIER]: { value: getMemoryCopier(byteSize) },
    [TAG]: isTagged && { get: getSelector, configurable: true },
    [VIVIFICATOR]: hasObject && { value: getChildVivificator$1(structure) },
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
  attachDescriptors(constructor, instanceDescriptors, staticDescriptors);
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

function useEnumeration() {
  factories[StructureType.Enumeration] = defineEnumerationShape;
  useEnumerationTransform();
}

function useOptional() {
  factories[StructureType.Optional] = defineOptional;
}

function usePointer() {
  factories[StructureType.Pointer] = definePointer;
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

function flagMemberUsage(member, features) {
  const { type } = member;
  switch (type) {
    case MemberType.Bool:
      features.useBool = true;
      if (!isByteAligned(member)) {
        features.useExtendedBool = true;
      }
      break;
    case MemberType.Int:
      features.useInt = true;
      if(!isByteAligned(member) || !hasStandardIntSize(member)) {
        features.useExtendedInt = true;
      }
      break;
    case MemberType.Uint:
      features.useUint = true;
      if(!isByteAligned(member) || !hasStandardIntSize(member)) {
        features.useExtendedUint = true;
      }
      break;
    case MemberType.Float:
      features.useFloat = true;
      if (!isByteAligned(member) || !hasStandardFloatSize(member)) {
        features.useExtendedFloat = true;
      }
      break;
    case MemberType.Object:
      features.useObject = true;
      break;
    case MemberType.Void:
      features.useVoid = true;
      break;
    case MemberType.Null:
      features.useNull = true;
      break;
    case MemberType.Undefined:
      features.useUndefined = true;
      break;
    case MemberType.Type:
      features.useType = true;
      break;
    case MemberType.Comptime:
      features.useComptime = true;
      break;
    case MemberType.Static:
      features.useStatic = true;
      break;
    case MemberType.Literal:
      features.useLiteral = true;
      break;
  }
}

function flagStructureUsage(structure, features) {
  const { type } = structure;
  const [ name ] = Object.entries(StructureType).find(a => a[1] === type);
  features[`use${name}`] = true;
  for (const members of [ structure.instance.members, structure.static.members ]) {
    for (const member of members) {
      flagMemberUsage(member, features);
    }
  }
}

function getFeaturesUsed(structures) {
  const features = {};
  for (const structure of structures) {
    flagStructureUsage(structure, features);
  }
  return Object.keys(features);
}

function findAllObjects(structures, SLOTS) {
  const list = [];
  const found = new Map();
  const find = (object) => {
    if (!object || found.get(object)) {
      return;
    }
    found.set(object, true);
    list.push(object);
    if (object[SLOTS]) {
      for (const child of Object.values(object[SLOTS])) {
        find(child);         
      }
    }
  };
  for (const structure of structures) {
    find(structure.instance.template);
    find(structure.static.template);
  }
  return list;
}

function useAllStructureTypes() {
  usePrimitive();
  useArray();
  useStruct();
  useExternStruct();
  usePackedStruct();
  useArgStruct();
  useExternUnion();
  useBareUnion();
  useTaggedUnion();
  useErrorUnion();
  useErrorSet();
  useEnumeration();
  useOptional();
  usePointer();
  useSlice();
  useVector();
  useOpaque();
}

function generateCode(definition, params) {
  const { structures, options, keys } = definition;
  const {
    runtimeURL,
    binarySource = null,
    topLevelAwait = true,
    omitExports = false,
    declareFeatures = false,
    addonDir = null,
  } = params;
  const features = (declareFeatures) ? getFeaturesUsed(structures) : [];
  const exports = getExports(structures);
  const lines = [];
  const add = manageIndentation(lines);
  add(`import {`);
  for (const name of [ 'createEnvironment', ...features ]) {
    add(`${name},`);
  }
  add(`} from ${JSON.stringify(runtimeURL)};`);
  // reduce file size by only including code of features actually used
  // dead-code remover will take out code not referenced here
  add(`\n// activate features`);
  for (const feature of features) {
    add(`${feature}();`);
  }
  // write out the structures as object literals 
  addStructureDefinitions(lines, definition);
  add(`\n// create runtime environment`);
  add(`const env = createEnvironment(${JSON.stringify({ addonDir }, undefined, 2)});`);
  add(`const __zigar = env.getSpecialExports();`);
  add(`\n// recreate structures`);
  add(`env.recreateStructures(structures, options);`);
  if (binarySource) {
    add(`\n// initiate loading and compilation of WASM bytecodes`);
    add(`const source = ${binarySource};`);
    add(`env.loadModule(source)`);
    // if top level await is used, we don't need to write changes into fixed memory buffers
    add(`env.linkVariables(${!topLevelAwait});`);
  }
  add(`\n// export root namespace and its methods and constants`);
  add(`const { constructor } = root;`);
  if (!omitExports) {
    add(`export { constructor as default, __zigar }`);
    // the first two exports are default and __zigar
    const exportables = exports.slice(2);
    if (exportables.length > 0) {
      add(`export const {`);
      for (const name of exportables) {
        add(`${name},`);
      }
      add(`} = constructor;`);
    }
  }
  if (topLevelAwait && binarySource) {
    add(`await __zigar.init();`);
  }
  const code = lines.join('\n');
  return { code, exports, structures };
}

function addStructureDefinitions(lines, definition) {
  const { structures, options, keys } = definition;
  const { MEMORY, SLOTS, CONST_TARGET } = keys;
  const add = manageIndentation(lines);
  const defaultStructure = {
    constructor: null,
    typedArray: null,
    type: StructureType.Primitive,
    name: undefined,
    byteSize: 0,
    align: 0,
    isConst: false,
    isTuple: false,
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
  add(`\n// structure defaults`);
  add(`const s = {`);
  for (const [ name, value ] of Object.entries(defaultStructure)) {
    switch (name) {
      case 'instance':
      case 'static':
        add(`${name}: {`);
        for (const [ name2, value2 ] of Object.entries(value)) {
          add(`${name2}: ${JSON.stringify(value2)},`);
        }
        add(`},`);
        break;
      default:
        add(`${name}: ${JSON.stringify(value)},`);
    }
  }
  add(`};`);
  const defaultMember = {
    type: MemberType.Void,
    isRequired: false,
  };
  add(`\n// member defaults`);
  add(`const m = {`);
  for (const [ name, value ] of Object.entries(defaultMember)) {
    add(`${name}: ${JSON.stringify(value)},`);
  }
  add(`};`);
  // create empty objects first, to allow objects to reference each other
  add(``);
  const structureNames = new Map();
  const structureMap = new Map();
  for (const [ index, structure ] of structures.entries()) {
    const varname = `s${index}`;
    structureNames.set(structure, varname);
    structureMap.set(structure.constructor, structure);
  }
  for (const slice of chunk(structureNames.values(), 10)) {
    add(`const ${slice.map(n => `${n} = {}`).join(', ')};`);
  }
  const objects = findAllObjects(structures, SLOTS);
  const objectNames = new Map();
  const views = [];
  for (const [ index, object ] of objects.entries()) {
    const varname = `o${index}`;
    objectNames.set(object, varname);
    if (object[MEMORY]) {
      views.push(object[MEMORY]);
    }
  }
  for (const slice of chunk(objectNames.values(), 10)) {
    add(`const ${slice.map(n => `${n} = {}`).join(', ')};`);
  }
  // define buffers
  const arrayBufferNames = new Map();
  for (const [ index, dv ] of views.entries()) {
    if (!arrayBufferNames.get(dv.buffer)) {
      const varname = `a${index}`;
      arrayBufferNames.set(dv.buffer, varname);
      if (dv.buffer.byteLength > 0) {
        const ta = new Uint8Array(dv.buffer);
        add(`const ${varname} = new Uint8Array([ ${ta.join(', ')} ]);`);
      } else {
        add(`const ${varname} = new Uint8Array();`);
      }
    }
  }
  // add properties to objects
  if (objects.length > 0) {
    add('\n// define objects');    
    for (const object of objects) {
      const varname = objectNames.get(object);
      const structure = structureMap.get(object.constructor);
      const { [MEMORY]: dv, [SLOTS]: slots } = object;
      add(`Object.assign(${varname}, {`);
      if (structure) {
        add(`structure: ${structureNames.get(structure)},`);
      }
      if (dv) {
        const buffer = arrayBufferNames.get(dv.buffer);
        const pairs = [ `array: ${buffer}` ];
        if (dv.byteLength < dv.buffer.byteLength) {
          pairs.push(`offset: ${dv.byteOffset}`);
          pairs.push(`length: ${dv.byteLength}`);
        }
        add(`memory: { ${pairs.join(', ')} },`);
        if (dv.hasOwnProperty('reloc')) {
          add(`reloc: ${dv.reloc},`);
        }
        if (object[CONST_TARGET]) {
          add(`const: true,`);
        }
      }
      const entries = (slots) ? Object.entries(slots).filter(a => a[1]) : [];
      if (entries.length > 0) {
        add(`slots: {`);
        const pairs = entries.map(([slot, child]) => `${slot}: ${objectNames.get(child)}`);
        for (const slice of chunk(pairs, 10)) {
          add(slice.join(', ') + ',');
        }
        add(`},`);
      }
      add(`});`);
    }
  }
  const methods = [];
  for (const structure of structures) {
    // add static members; instance methods are also static methods, so
    // we don't need to add them separately
    methods.push(...structure.static.methods);
  }
  const methodNames = new Map();
  if (methods.length > 0) {
    add(`\n// define functions`);
    for (const [ index, method ] of methods.entries()) {
      const varname = `f${index}`;
      methodNames.set(method, varname);
      add(`const ${varname} = {`);
      for (const [ name, value ] of Object.entries(method)) {
        switch (name) {
          case 'argStruct':
            add(`${name}: ${structureNames.get(value)},`);
            break;
          default:
            add(`${name}: ${JSON.stringify(value)},`);
        }
      }
      add(`};`);
    }
  }
  add('\n// define structures');
  for (const structure of structures) {
    const varname = structureNames.get(structure);
    add(`Object.assign(${varname}, {`);
    add(`...s,`);
    for (const [ name, value ] of Object.entries(structure)) {
      if (isDifferent(value, defaultStructure[name])) {
        switch (name) {
          case 'constructor':
          case 'typedArray':
          case 'sentinel':
            break;
          case 'instance':
          case 'static': {
            const { methods, members, template } = value;
            add(`${name}: {`);
            add(`members: [`);
            for (const member of members) {
              add(`{`);
              add(`...m,`);
              for (const [ name, value ] of Object.entries(member)) {
                if (isDifferent(value, defaultMember[name])) {
                  switch (name) {
                    case 'structure':
                      add(`${name}: ${structureNames.get(value)},`);
                      break;
                    default:
                      add(`${name}: ${JSON.stringify(value)},`);
                  }
                }
              }
              add(`},`);
            }
            add(`],`);
            add(`methods: [`);
            for (const slice of chunk(methods, 10)) {
              add(slice.map(m => methodNames.get(m)).join(', ') + ',');
            }
            add(`],`);
            if (template) {
              add(`template: ${objectNames.get(template)}`);
            }
            add(`},`);
          } break;
          default:
            add(`${name}: ${JSON.stringify(value)},`);
        }
      }
    }
    add(`});`);
  }
  add(`const structures = [`);
  for (const slice of chunk([ ...structureNames.values() ], 10)) {
    add(slice.join(', ') + ',');
  }
  add(`];`);
  const root = structures[structures.length - 1];
  add(`const root = ${structureNames.get(root)};`);
  add(`const options = {`);
  for (const [ name, value ] of Object.entries(options)) {
    add(`${name}: ${value},`);
  }
  add(`};`);
  return lines;
}

function getExports(structures) {
  const root = structures[structures.length - 1];
  const { constructor } = root;
  const exportables = [];
  // export only members whose names are legal JS identifiers
  const legal = /^[$\w]+$/;
  for (const method of root.static.methods) {
    if (legal.test(method.name)) {
      exportables.push(method.name);
    }
  }
  for (const member of root.static.members) {
    // only read-only properties are exportable
    if (isReadOnly(member) && legal.test(member.name)) {
      try {
        // make sure that getter wouldn't throw (possible with error union)
        constructor[member.name];
        exportables.push(member.name);
      } catch (err) {
      }
    }
  }
  return [ 'default', '__zigar', ...exportables ];
}

function manageIndentation(lines) {
  let indent = 0;
  return (s) => {
    if (/^\s*[\]\}]/.test(s)) {
      indent--;
    }
    const lastLine = lines[lines.length - 1];
    if ((lastLine?.endsWith('[') && s.startsWith(']')) 
     || (lastLine?.endsWith('{') && s.startsWith('}'))) {
      lines[lines.length - 1] += s;
    } else {
      lines.push(' '.repeat(indent * 2) + s);
    }
    if (/[\[\{]\s*$/.test(s)) {
      indent++;
    }
  };
}

function isDifferent(value, def) {
  if (value === def) {
    return false;
  }
  if (def == null) {
    return value != null;
  }
  if (typeof(def) === 'object' && typeof(value) === 'object') {
    const valueKeys = Object.keys(value);
    const defKeys = Object.keys(def);
    if (valueKeys.length !== defKeys.length) {
      return true;
    }
    for (const key of defKeys) {
      if (isDifferent(value[key], def[key])) {
        return true;
      }
    }
    return false;
  }
  return true;
}

function* chunk(arr, n) {
  if (!Array.isArray(arr)) {
    arr = [ ...arr ];
  }
  for (let i = 0; i < arr.length; i += n) {
    yield arr.slice(i, i + n);
  }
}

async function findFile(path, follow = true) {
  try {
    return await (follow ? stat(path) : lstat(path));
  } catch (err) {
  }
}

function findFileSync(path, follow = true) {
  try {
    return follow ? statSync(path) : lstatSync(path);
  } catch (err) {
  }
}

async function findMatchingFiles(dir, re) {
  const map = new Map();
  const scanned = new Map();
  const scan = async (dir) => {
    /* c8 ignore next 3 */
    if (scanned.get(dir)) {
      return;
    } 
    scanned.set(dir, true);
    try {
      const list = await readdir(dir);
      for (const name of list) {
        if (name.startsWith('.') || name === 'node_modules' || name === 'zig-cache') {
          continue;
        }
        const path = join(dir, name);
        const info = await findFile(path);
        if (info?.isDirectory()) {
          await scan(path);
        } else if (info?.isFile() && re.test(name)) {
          map.set(path, info);
        }
      }
      /* c8 ignore next 2 */
    } catch (err) {
    }
  };
  await scan(dir);
  return map;
}

function findMatchingFilesSync(dir, re) {
  const map = new Map();
  const scanned = new Map();
  const scan = (dir) => {
    /* c8 ignore next 3 */
    if (scanned.get(dir)) {
      return;
    } 
    scanned.set(dir, true);
    try {
      const list = readdirSync(dir);
      for (const name of list) {
        if (name.startsWith('.') || name === 'node_modules' || name === 'zig-cache') {
          continue;
        }
        const path = join(dir, name);
        const info = findFileSync(path);
        if (info?.isDirectory()) {
          scan(path);
        } else if (info?.isFile() && re.test(name)) {
          map.set(path, info);
        }
      }
      /* c8 ignore next 2 */
    } catch (err) {
    }
  };
  scan(dir);
  return map;
}

async function acquireLock(pidPath, staleTime) {
  while (true)   {
    try {
      await createDirectory(dirname(pidPath));
      const handle = await open(pidPath, 'wx');
      handle.write(`${process.pid}`);
      handle.close();
      break;
    } catch (err) {
      if (err.code === 'EEXIST') {
        if (checkPidFile(pidPath, staleTime)) {
          await delay(250);
          continue;
        }
        /* c8 ignore next 3 */
      } else {
        throw err;
      }
    }
  }
}

function acquireLockSync(pidPath, staleTime) {
  while (true)   {
    try {
      createDirectorySync(dirname(pidPath));
      const handle = openSync(pidPath, 'wx');
      writeSync(handle, `${process.pid}`);
      closeSync(handle);
      break;
    } catch (err) {
      if (err.code === 'EEXIST') {
        if (checkPidFile(pidPath, staleTime)) {
          delaySync(250);
        }
        /* c8 ignore next 3 */
      } else {
        throw err;
      }
    }
  }
}

async function releaseLock(pidPath) {
  await deleteFile(pidPath);
}

function releaseLockSync(pidPath) {
  deleteFileSync(pidPath);
}

function checkPidFile(pidPath, staleTime = 60000 * 5) {
  let stale = false;
  try {
    const pid = loadFileSync(pidPath);
    if (pid) {
      /* c8 ignore next 5 */
      if (os.platform() === 'win32') {
        execSync(`tasklist /nh /fi "pid eq ${pid}" | findstr .exe`, { stdio: 'pipe' }).toString();
      } else {
        execSync(`ps -p ${pid}`).toString();
      }
    }
    const last = findFileSync(pidPath)?.mtime /* c8 ignore next */ || 0;
    const diff = new Date() - last;
    if (diff > staleTime) {
      stale = true;
    }
  } catch (err) {
    stale = true;
  }
  if (stale) {
    deleteFileSync(pidPath);
  }
  return !stale;
}

async function copyFile(srcPath, dstPath) {
  const info = await stat(srcPath);
  const data = await readFile(srcPath);
  await writeFile(dstPath, data);
  await chmod(dstPath, info.mode);
}

function copyFileSync(srcPath, dstPath) {
  const info = statSync(srcPath);
  const data = readFileSync(srcPath);
  writeFileSync(dstPath, data);
  chmodSync(dstPath, info.mode);
}

async function loadFile(path, def) {
  try {
    return await readFile(path, 'utf8');
  } catch (err) {
    return def;
  }
}

function loadFileSync(path, def) {
  try {
    return readFileSync(path, 'utf8');
  } catch (err) {
    return def;
  }
}

async function deleteFile(path) {
  try {
    await unlink(path);
  } catch (err) {
    if (err.code !== 'ENOENT' && err.code !== 'ENOTDIR') {
      throw err;
    }
  }
}

function deleteFileSync(path) {
  try {
    unlinkSync(path);
  } catch (err) {
    if (err.code !== 'ENOENT' && err.code !== 'ENOTDIR') {
      throw err;
    }
  }
}

async function createDirectory(path) {
  const exists = await findDirectory(path);
  if (!exists) {
    const { root, dir } = parse(path);
    await createDirectory(dir);
    try {
      await mkdir(path);
      /* c8 ignore next 5 */
    } catch (err) {
      if (err.code != 'EEXIST') {
        throw err;
      }
    }
  }
}

function createDirectorySync(path) {
  const exists = findDirectorySync(path);
  if (!exists) {
    const { root, dir } = parse(path);
    createDirectorySync(dir);
    try {
      mkdirSync(path);
      /* c8 ignore next 5 */
    } catch (err) {
      if (err.code != 'EEXIST') {
        throw err;
      }
    }
  }
}

async function findDirectory(path) {
  return findFile(path);
}

function findDirectorySync(path) {
  return findFileSync(path);
}

async function deleteDirectory(dir) {
  try {
    const list = await readdir(dir);
    for (const name of list) {
      const path = join(dir, name);
      const info = await findFile(path, false);
      if (info?.isDirectory()) {
        await deleteDirectory(path);
      } else if (info) {
        await deleteFile(path);
      }
    }
    await rmdir(dir);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      throw err;
    }
  }
}

function deleteDirectorySync(dir) {
  try {
    const list = readdirSync(dir);
    for (const name of list) {
      const path = join(dir, name);
      const info = findFileSync(path, false);
      if (info?.isDirectory()) {
        deleteDirectorySync(path);
      } else if (info) {
        deleteFileSync(path);
      }
    }
    rmdirSync(dir);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      throw err;
    }
  }
}

async function delay(ms) {
  await new Promise(r => setTimeout(r, ms));
}

function delaySync(ms) {   
  const buffer = new SharedArrayBuffer(8);
  const ta = new BigInt64Array(buffer);
  Atomics.wait(ta, 0, 0n, ms);
}

function md5(text) {
  const hash = createHash('md5');
  hash.update(text);
  return hash.digest('hex');
}

let isGNU;

function getPlatform() {
  let platform = os.platform();
  if (platform === 'linux') {
    // differentiate glibc from musl
    if (isGNU === undefined) {
      /* c8 ignore next 3 */
      if (process.versions?.electron || process.__nwjs) {
        isGNU = true;
      } else {
        try {
          execFileSync('getconf', [ 'GNU_LIBC_VERSION' ], { stdio: 'pipe' });
          isGNU = true;
          /* c8 ignore next 3 */
        } catch (err) {
          isGNU = false;
        }  
      }
    }
    /* c8 ignore next 3 */
    if (!isGNU) {
      platform += '-musl';
    }
  }
  return platform;
}

function getArch() {
  return os.arch();
}

function normalizePath(url) {
  let archive;
  const parts = fileURLToPath(url).split(sep).map((part) => {
    if (part === 'app.asar') {
      archive = 'asar';
      return part + '.unpacked';
    }
    return part;
  });
  const path = parts.join(sep);
  return { path, archive }
}

async function compile(srcPath, modPath, options) {
  const srcInfo = (srcPath) ? await findFile(srcPath) : null;
  if (srcInfo === undefined) {
    throw new Error(`Source file not found: ${srcPath}`);
  }
  if (srcInfo?.isDirectory()) {
    srcPath = join(srcPath, '?');
  }
  const config = createConfig(srcPath, modPath, options);
  const { moduleDir, outputPath } = config;
  let changed = false;
  if (srcPath) {
    const srcFileMap = await findMatchingFiles(moduleDir, /.\..*$/);
    // see if the (re-)compilation is necessary
    const soInfo = await findFile(outputPath);
    if (soInfo) {
      for (const [ name, info ] of srcFileMap) {
        if (info.mtime > soInfo.mtime) {
          changed = true;
          break;
        }
      }
    } else {
      changed = true;
    }
    if (!changed) {
      // rebuild when exporter or build files have changed
      const zigFolder = absolute('../zig');
      const zigFileMap = await findMatchingFiles(zigFolder, /\.zig$/);
      for (const [ path, info ] of zigFileMap) {
        if (info.mtime > soInfo.mtime) {
          changed = true;
          break;
        }
      }
    }
    if (changed) {
      // add custom build file
      for (const [ path, info ] of srcFileMap) {
        switch (basename(path)) {
          case 'build.zig':
            config.buildFilePath = path;
            break;
          case 'build.zig.zon':
            config.packageConfigPath = path;
            break;
        }
      }
      const { zigCmd, moduleBuildDir } = config;
      // only one process can compile a given file at a time
      const pidPath = `${moduleBuildDir}.pid`;
      await acquireLock(pidPath);
      try {
        // create config file
        await createProject(config, moduleBuildDir);
        // then run the compiler
        await runCompiler(zigCmd, moduleBuildDir);
      } finally {
        if (config.clean) {
          await deleteDirectory(moduleBuildDir);
        }
        await releaseLock(pidPath);
      }
    }   
  }
  return { outputPath, changed }
}

function compileSync(srcPath, modPath, options) {
  const srcInfo = (srcPath) ? findFileSync(srcPath) : null;
  if (srcInfo === undefined) {
    throw new Error(`Source file not found: ${srcPath}`);
  }
  if (srcInfo?.isDirectory()) {
    srcPath = join(srcPath, '?');
  }
  const config = createConfig(srcPath, modPath, options);
  const { moduleDir, outputPath } = config;
  let changed = false;
  if (srcPath) {
    const srcFileMap = findMatchingFilesSync(moduleDir, /.\..*$/);
    // see if the (re-)compilation is necessary
    const soInfo = findFileSync(outputPath);
    if (soInfo) {
      for (const [ path, info ] of srcFileMap) {
        if (info.mtime > soInfo.mtime) {
          changed = true;
          break;
        }
      }
    } else {
      changed = true;
    }
    if (!changed) {
      // rebuild when exporter or build files have changed
      const zigFolder = absolute('../zig');
      const zigFileMap = findMatchingFilesSync(zigFolder, /\.zig$/);
      for (const [ path, info ] of zigFileMap) {
        if (info.mtime > soInfo.mtime) {
          changed = true;
          break;
        }
      }
    }
    if (changed) {
      // add custom build file
      for (const [ path, info ] of srcFileMap) {
        switch (basename(path)) {
          case 'build.zig':
            config.buildFilePath = path;
            break;
          case 'build.zig.zon':
            config.packageConfigPath = path;
            break;
        }
      }
      const { zigCmd, moduleBuildDir } = config;
      // only one process can compile a given file at a time
      const pidPath = `${moduleBuildDir}.pid`;
      acquireLockSync(pidPath);
      try {
        // create config file
        createProjectSync(config, moduleBuildDir);
        // then run the compiler   
        runCompilerSync(zigCmd, moduleBuildDir);
      } finally {
        if (config.clean) {
          deleteDirectorySync(moduleBuildDir);
        }
        releaseLockSync(pidPath);
      }
    } 
  }
  return { outputPath, changed }
}

async function runCompiler(zigCmd, soBuildDir) {
  const options = {
    cwd: soBuildDir,
    windowsHide: true,
  };
  return new Promise((resolve, reject) => {
    exec(zigCmd, options, (err, stdout, stderr) => {
      if (err) {
        const log = stderr;
        if (log) {
          const logPath = join(soBuildDir, 'log');
          writeFile(logPath, log);
          err = new Error(`Zig compilation failed\n\n${log}`);
        }
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

function runCompilerSync(zigCmd, soBuildDir) {
  const options = {
    cwd: soBuildDir,
    windowsHide: true,
    stdio: 'pipe',
  };
  try {
    execSync(zigCmd, options);
  } catch (err) {
    const log = err.stderr;
    if (log) {
      const logPath = join(soBuildDir, 'log');
      writeFileSync(logPath, log);
    }
    throw new Error(`Zig compilation failed\n\n${log}`);
  }
}

function formatProjectConfig(config) {
  const lines = [];
  const fields = [ 
    'moduleName', 'modulePath', 'moduleDir', 'exporterPath', 'stubPath', 'outputPath', 
    'useLibc', 'isWASM',
  ];  
  for (const [ name, value ] of Object.entries(config)) {
    if (fields.includes(name)) {
      const snakeCase = name.replace(/[A-Z]+/g, m => '_' + m.toLowerCase());
      lines.push(`pub const ${snakeCase} = ${JSON.stringify(value)};`);
    }
  }
  return lines.join('\n');
}

async function createProject(config, dir) {
  await createDirectory(dir);
  const content = formatProjectConfig(config);
  const cfgFilePath = join(dir, 'build-cfg.zig');
  await writeFile(cfgFilePath, content);
  const buildFilePath = join(dir, 'build.zig');
  await copyFile(config.buildFilePath, buildFilePath);
  if (config.packageConfigPath) {
    const packageConfigPath = join(dir, 'build.zig.zon');
    await copyFile(config.packageConfigPath, packageConfigPath);
  }
}

function createProjectSync(config, dir) {
  createDirectorySync(dir);
  const content = formatProjectConfig(config);
  const cfgFilePath = join(dir, 'build-cfg.zig');
  writeFileSync(cfgFilePath, content);
  const buildFilePath = join(dir, 'build.zig');
  copyFileSync(config.buildFilePath, buildFilePath);
  if (config.packageConfigPath) {
    const packageConfigPath = join(dir, 'build.zig.zon');
    copyFileSync(config.packageConfigPath, packageConfigPath);
  }
}

const cwd = process.cwd();

function getCachePath(options) {
  const {
    cacheDir = join(cwd, 'zigar-cache'),
  } = options;
  return cacheDir;
}

function getModuleCachePath(srcPath, options) {
  const {
    optimize,
  } = options;
  const src = parse(srcPath);
  const folder = basename(src.dir).slice(0, 16).trim() + '-' + md5(src.dir).slice(0, 8);
  const cacheDir = getCachePath(options);
  return join(cacheDir, folder, optimize, `${src.name}.zigar`);
}

function createConfig(srcPath, modPath, options = {}) {
  const {
    platform = getPlatform(),
    arch = getArch(),
    optimize = 'Debug',
    isWASM = false,
    useLibc = isWASM ? false : true,
    clean = false,
    buildDir = join(os.tmpdir(), 'zigar-build'),
    zigCmd = (() => {
      // translate from names used by Node to those used by Zig
      const cpuArchs = {
        arm: 'arm',
        arm64: 'aarch64',
        ia32: 'x86',
        loong64: 'loong64',
        mips: 'mips',
        mipsel: 'mipsel',
        ppc: 'powerpc',
        ppc64: 'powerpc64',
        s390: undefined,
        s390x: 's390x',
        x64: 'x86_64',
      };
      const osTags = {
        aix: 'aix',
        darwin: 'macos',
        freebsd: 'freebsd',
        linux: 'linux-gnu',
        openbsd: 'openbsd',
        sunos: 'solaris',
        win32: 'windows',
      };
      const cpuArch = cpuArchs[arch] ?? arch;
      const osTag = osTags[platform] ?? platform;
      const args = [
        `build`,
        `-Doptimize=${optimize}`,
        `-Dtarget=${cpuArch}-${osTag}`,        
      ];
      return `zig ${args.join(' ')}`;
    })(),
  } = options;
  const suffix = isWASM ? 'wasm' : 'c';
  const src = parse(srcPath ?? '');
  const mod = parse(modPath ?? '');
  const moduleName = mod.name || src.name;
  const modulePath = (src.name !== '?') ? srcPath : undefined;
  const moduleDir = src.dir;
  const modulePrefix = basename(moduleName).slice(0, 16);
  const moduleHash = md5(`${moduleDir}/${moduleName}`).slice(0, 8);
  const moduleBuildDir = join(buildDir, modulePrefix + '-' + moduleHash);   
  const outputPath = (() => {
    if (!modPath && isWASM) {
      // save output in build folder
      return join(moduleBuildDir, optimize, `${src.name}.wasm`);
    } else {
      const extensions = {
        darwin: 'dylib',
        win32: 'dll',
      };
      const ext = extensions[platform] || 'so';
      return join(modPath, `${platform}.${arch}.${ext}`);
    }  
  })();
  const exporterPath = absolute(`../zig/exporter-${suffix}.zig`);
  const stubPath = absolute(`../zig/stub-${suffix}.zig`);
  const buildFilePath = absolute(`../zig/build.zig`);
  return {
    platform,
    arch,
    optimize,
    moduleName,
    modulePath,
    moduleDir,
    moduleBuildDir,
    exporterPath,
    stubPath,
    buildFilePath,
    packageConfigPath: undefined,
    outputPath,
    clean,
    zigCmd,
    useLibc,
    isWASM,
  };
}

function absolute(relpath) {
  // import.meta.url don't always yield the right URL when transpiled to CommonJS
  // just use __dirname as it's going to be there
  /* c8 ignore next 2 */
  if (typeof(__dirname) === 'string') {
    return resolve(__dirname, relpath);
  } else {
    return fileURLToPath(new URL(relpath, import.meta.url));
  }
}

const optionsForCompile = {
  optimize: {
    type: 'string',
    enum: [ 'Debug', 'ReleaseSmall', 'ReleaseFast', 'ReleaseSafe' ],
    title: 'Zig optimization mode',
  },
  omitFunctions: {
    type: 'boolean',
    title: 'Omit all Zig functions',
  },
  omitVariables: {
    type: 'boolean',
    title: 'Omit all variables',
  },
  omitExports: {
    type: 'boolean',
    title: 'Omit export statements',
  },
  useLibc: {
    type: 'boolean',
    title: 'Link in C standard library',
  },
  topLevelAwait: {
    type: 'boolean',
    title: 'Use top-level await to load WASM file',
  },
  buildDir: {
    type: 'string',
    title: 'Root directory where temporary build directories are placed',
  },
  cacheDir: {
    type: 'string',
    title: 'Directory where compiled library files are placed',
  },
  zigCmd: {
    type: 'string',
    title: 'Zig command used to build libraries',
  },
  sourceFiles: {
    type: 'object',
    title: 'Map of modules to source files/directories',
  },
  clean: {
    type: 'boolean',
    title: 'Remove temporary build directory after compilation finishes',
  },
  targets: {
    type: 'object',
    title: 'List of cross-compilation targets',
  },
};

const optionsForTranspile = {
  useReadFile: {
    type: 'boolean',
    title: 'Enable the use of readFile() to Load WASM file when library is used in Node.js',
  },
  embedWASM: {
    type: 'boolean',
    title: 'Embed WASM file in JavaScript source code',
  },
  stripWASM: {
    type: 'boolean',
    title: 'Remove unnecessary code from WASM file',
  },
  keepNames: {
    type: 'boolean',
    title: 'Keep names of function in WASM binary when stripping',
  },
};

const allOptions = {
  ...optionsForCompile,
  ...optionsForTranspile,
};

function extractOptions(searchParams, availableOptions) {
  const options = {};
  const names = Object.keys(availableOptions);
  for (const [ name, string ] of searchParams) {
    const key = getCamelCase(name, names);
    const option = availableOptions[key];
    if (!option) {
      throw new UnknownOption(name);
    }
    if (key === 'optimize') {
      options[key] = getCamelCase(string, [ 'Debug', 'ReleaseSafe', 'ReleaseFast', 'ReleaseSmall' ]);
    } else {
      switch (option.type) {
        case 'boolean': 
          options[key] = !!parseInt(string);
          break;
        case 'number': 
          options[key] = parseInt(string);
          break;
        default: 
          options[key] = string;
      }
    }
  }
  return options;
}

function getCamelCase(name, names) {
  for (const nameCC of names) {
    const nameSC = nameCC.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
    const nameKC = nameSC.replace(/_/g, '-');
    if (name === nameKC || name === nameSC || name === nameCC) {
      return nameCC;
    }
  }
  return name;
}

class UnknownOption extends Error {
  constructor(key) {
    const adjective = (allOptions[key]) ? 'Unavailable' : 'Unrecognized';
    super(`${adjective} option: ${key}`);
  }
}

async function findConfigFile(name, dir) {
  const path = join(dir, name);
  const info = await findFile(path);
  if (info?.isFile()) {
    return path;
  } else {
    const parent = dirname(dir);
    if (parent !== dir) {
      return findConfigFile(name, parent);
    }
  }
}

function findConfigFileSync(name, dir) {
  const path = join(dir, name);
  const info = findFileSync(path);
  if (info?.isFile()) {
    return path;
  } else {
    const parent = dirname(dir);
    if (parent !== dir) {
      return findConfigFileSync(name, parent);
    }
  }
}

async function loadConfigFile(cfgPath, availableOptions) {
  const text = await loadFile(cfgPath);
  return processConfigFile(text, cfgPath, availableOptions);
}

function loadConfigFileSync(cfgPath, availableOptions) {
  const text = loadFileSync(cfgPath);
  return processConfigFile(text, cfgPath, availableOptions);
}

function processConfigFile(text, cfgPath, availableOptions) {
  const options = JSON.parse(text);
  for (const [ key, value ] of Object.entries(options)) {
    const option = availableOptions[key];
    if (!option) {
      throw new UnknownOption(key);
    }
    if (typeof(value) !== option.type) {
      throw new Error(`${key} is expected to be a ${option.type}, received: ${value}`);
    }
  }
  options.sourceFiles = getAbsoluteMapping(options.sourceFiles, dirname(cfgPath));
  return options;
}

function getAbsoluteMapping(sourceFiles, cfgDir) {
  const map = {};
  if (sourceFiles) {
    for (const [ module, source ] of Object.entries(sourceFiles)) {
      const modulePath = resolve(cfgDir, module);
      const sourcePath = resolve(cfgDir, source);
      map[modulePath] = sourcePath;
    }
  }
  return map;
}

function findSourceFile(modulePath, options) {
  const { sourceFiles } = options;
  return sourceFiles?.[modulePath];
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
  if (type === StructureType.Enumeration) {
    for (const { name, slot } of members) {
      appendEnumeration(constructor, name, constructor[SLOTS][slot]);
    }
  } else if (type === StructureType.ErrorSet) {
    for (const { name, slot } of members) {
      appendErrorSet(constructor, name, constructor[SLOTS][slot]);
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
  /* COMPTIME-ONLY */
  slotNumbers = {};
  slots = {};
  structures = [];
  /* COMPTIME-ONLY-END */
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

  castView(address, len, copy, structure) {
    const { constructor, hasPointer } = structure;
    const dv = this.captureView(address, len, copy);
    const object = constructor.call(ENVIRONMENT, dv);
    if (hasPointer) {
      // acquire targets of pointers
      this.acquirePointerTargets(object);
    }
    if (copy) {
      object[WRITE_DISABLER]();
    }
    return object;
  }

  /* COMPTIME-ONLY */
  getSlotNumber(scope, key) {
    let slotNumber = this.slotNumbers[scope];
    if (!slotNumber) {
      slotNumber = this.slotNumbers[scope] = { next: 0, map: {} };
    }
    let slot = slotNumber.map[key];
    if (slot === undefined) {
      slot = slotNumber.map[key] = slotNumber.next++;
    }
    return slot;
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

  createTemplate(dv) {
    return {
      [MEMORY]: dv,
      [SLOTS]: {}
    };
  }

  beginStructure(def) {
    const {
      type,
      name,
      length,
      byteSize,
      align,
      isConst,
      isTuple,
      hasPointer,
    } = def;
    return {
      constructor: null,
      typedArray: null,
      type,
      name,
      length,
      byteSize,
      align,
      isConst,
      isTuple,
      hasPointer,
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
  }

  attachMember(structure, member, isStatic = false) {
    const target = (isStatic) ? structure.static : structure.instance;
    target.members.push(member);
  }

  attachMethod(structure, method, isStaticOnly = false) {
    structure.static.methods.push(method);
    if (!isStaticOnly) {
      structure.instance.methods.push(method);
    }
  }

  attachTemplate(structure, template, isStatic = false) {
    const target = (isStatic) ? structure.static : structure.instance;
    target.template = template;
  }

  endStructure(structure) {
    this.structures.push(structure);
    this.finalizeStructure(structure);
    for (const structure of this.structures) {
      this.acquireDefaultPointers(structure);
    }
  }

  defineFactoryArgStruct() {
    useBool();
    useObject();
    useArgStruct();
    const options = this.beginStructure({
      type: StructureType.Struct,
      name: 'Options',
      byteSize: 2,
      hasPointer: false,
    });
    this.attachMember(options, {
      type: MemberType.Bool,
      name: 'omitFunctions',
      bitOffset: 0,
      bitSize: 1,
      byteSize: 1,      
    });
    this.attachMember(options, {
      type: MemberType.Bool,
      name: 'omitVariables',
      bitOffset: 8,
      bitSize: 1,
      byteSize: 1,      
    });
    this.finalizeShape(options);
    const structure = this.beginStructure({
      type: StructureType.ArgStruct,
      name: 'factory',
      byteSize: 2,
      hasPointer: false,
    });
    this.attachMember(structure, {
      type: MemberType.Object,
      name: '0',
      bitOffset: 0,
      bitSize: 16,
      byteSize: 2,
      slot: 0,
      structure: options,
    });
    this.attachMember(structure, {
      type: MemberType.Void,
      name: 'retval',
      bitOffset: 16,
      bitSize: 0,
      byteSize: 0
    });
    this.finalizeShape(structure);
    return structure.constructor;
  }

  acquireStructures(options) {
    const {
      omitFunctions = false,
      omitVariables = isElectron(),
    } = options;
    resetGlobalErrorSet();
    const thunkId = this.getFactoryThunk();
    const ArgStruct = this.defineFactoryArgStruct();
    const args = new ArgStruct([ { omitFunctions, omitVariables } ]);
    this.comptime = true;
    this.invokeThunk(thunkId, args);
    this.comptime = false;
  }

  getRootModule() {
    const root = this.structures[this.structures.length - 1];
    return root.constructor;
  }

  hasMethods() {
    // all methods are static, so there's no need to check instance methods
    return !!this.structures.find(s => s.static.methods.length > 0);
  }

  exportStructures() {
    this.prepareObjectsForExport();
    const { structures, runtimeSafety, littleEndian } = this;
    return { 
      structures, 
      options: { runtimeSafety, littleEndian }, 
      keys: { MEMORY, SLOTS, CONST_TARGET },
    };
  }

  prepareObjectsForExport() {
    const objects = findAllObjects(this.structures, SLOTS);    
    const list = [];
    for (const object of objects) {
      if (object[MEMORY]) {
        if (this.inFixedMemory(object)) {
          // replace fixed memory
          const dv = object[MEMORY];
          const address = this.getViewAddress(dv);
          const offset = this.getMemoryOffset(address);
          const len = dv.byteLength;
          const relocDV = this.captureView(address, len, true);
          relocDV.reloc = offset;
          object[MEMORY] = relocDV;
          list.push({ offset, len, owner: object, replaced: false });
        }
      }
    }
    // larger memory blocks come first
    list.sort((a, b) => b.len - a.len);
    for (const a of list) {
      if (!a.replaced) {
        for (const b of list) {
          if (a !== b && !b.replaced) {
            if (a.offset <= b.offset && b.offset < a.offset + a.len) {
              // B is inside A--replace it with a view of A's buffer
              const dv = a.owner[MEMORY];
              const pos = b.offset - a.offset + dv.byteOffset;
              const newDV = this.obtainView(dv.buffer, pos, b.len);
              newDV.reloc = b.offset;
              b.owner[MEMORY] = newDV;
              b.replaced = true;
            }
          }
        }  
      }
    }
  }  

  useStructures() {
    const module = this.getRootModule();
    // add fixed memory object to list so they can be unlinked
    const objects = findAllObjects(this.structures, SLOTS);    
    for (const object of objects) {
      if (object[MEMORY] && this.inFixedMemory(object)) {
        this.variables.push({ object });
      }
    }
    // clear comptime-only variables
    this.slots = {};
    this.structures = [];
    module.__zigar = this.getSpecialExports();
    return module;
  }
  /* COMPTIME-ONLY-END */

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
          const dv = env.findMemory(location.address, location.length, Target[SIZE]);
          newTarget = (dv) ? Target.call(ENVIRONMENT, dv) : null;
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

  /* COMPTIME-ONLY */
  acquireDefaultPointers(structure) {
    const { constructor, hasPointer, instance: { template } } = structure;
    if (hasPointer && template && template[MEMORY]) {
      // create a placeholder for retrieving default pointers
      const placeholder = Object.create(constructor.prototype);
      placeholder[MEMORY] = template[MEMORY];
      placeholder[SLOTS] = template[SLOTS];
      this.acquirePointerTargets(placeholder);
    }
  }
  /* COMPTIME-ONLY-END */
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

function isElectron() {
  return typeof(process) === 'object'
      && typeof(process?.versions) === 'object' 
      && !!process.versions?.electron;
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
    castView: { argType: 'iibv', returnType: 'v' },
    getSlotNumber: { argType: 'ii', returnType: 'i' },
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
    const dv = this.findMemory(address, len, 1);
    this.removeShadow(dv);
    this.unregisterMemory(address);
    this.freeShadowMemory(address, len, align);
  }

  getBufferAddress(buffer) {
    return 0;
  }

  allocateFixedMemory(len, align) {
    const address = (len) ? this.allocateExternMemory(len, align) : 0;
    const dv = this.obtainFixedView(address, len);
    dv[ALIGN] = align;
    return dv;
  }

  freeFixedMemory(address, len, align) {
    if (len) {
      this.freeExternMemory(address, len, align);
    }
  }

  obtainFixedView(address, len) {
    const { memory } = this;
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
    const res = await source;
    const env = this.exportFunctions();
    const wasi = this.getWASI();
    const imports = { env, wasi_snapshot_preview1: wasi };
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
      this.runtimeSafety = this.isRuntimeSafetyActive();
      this.memory = memory;
      // run the init function if there one
      /* c8 ignore next */
      _initialize?.();
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

  /* COMPTIME-ONLY */
  beginDefinition() {
    return {};
  }

  insertProperty(def, name, value) {
    def[name] = value;
  }
  /* COMPTIME-ONLY-END */

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
            throw new ZigError(err);
          }
          return args.retval;
        });
      } else {
        throw new ZigError(err);
      }
    }
    return args.retval;
  }

  getWASI() {
    return { 
      fd_write: (fd, iovs_ptr, iovs_count, written_ptr) => {
        if (fd === 1 || fd === 2) {
          const dv = new DataView(this.memory.buffer);
          let written = 0;
          for (let i = 0, p = iovs_ptr; i < iovs_count; i++, p += 8) {
            const buf_ptr = dv.getUint32(p, true);
            const buf_len = dv.getUint32(p + 4, true);
            const buf = new DataView(this.memory.buffer, buf_ptr, buf_len);
            this.writeToConsole(buf);
            written += buf_len;
          }
          dv.setUint32(written_ptr, written, true);
          return 0;            
        } else {
          return 1;
        }
      },
      random_get: (buf, buf_len) => {
        const dv = new DataView(this.memory.buffer, buf, buf_len);
        for (let i = 0; i < buf_len; i++) {
          dv.setUint8(i, Math.floor(256 * Math.random()));
        }
        return 0;
      },
      proc_exit: () => {},
      path_open: () => 1,
      fd_read: () => 1,
      fd_close: () => 1,
    };
  }
}

useAllMemberTypes();
useAllStructureTypes();
useAllExtendedTypes();
/* COMPTIME-ONLY-END */

function createEnvironment(source) {
  return new WebAssemblyEnvironment();
}

const MagicNumber = 0x6d736100;
const Version = 1;
const SectionType = {
  Custom: 0,
  Type: 1,
  Import: 2,
  Function: 3,
  Table: 4,
  Memory: 5,
  Global: 6,
  Export: 7,
  Start: 8,
  Element: 9,
  Code: 10,
  Data: 11,
  DataCount: 12
};
const ObjectType = {
  Function: 0,
  Table: 1,
  Memory: 2,
  Global: 3,
};

function stripUnused(binary, options = {}) {
  const {
    keepNames = false,
  } = options;
  const { sections, size } = parseBinary(binary);
  const blacklist = [
    /^getFactoryThunk$/,
    /^exporter.createRootFactory/,
  ];

  function getSection(type) {
    return sections.find(s => s.type === type);
  }

  const nameSection = sections.find(s => s.type === SectionType.Custom && s.name === 'name');
  const { moduleName, functionNames, localNames } = parseNames(nameSection);
  const functions = [];
  // allocate indices for imported functions first
  const importSection = sections.find(s => s.type === SectionType.Import);
  if (importSection) {
    for (const object of importSection.imports) {
      if (object.type === ObjectType.Function) {
        const index = functions.length;
        functions[index] = {
          type: 'imported',
          name: functionNames[index],
          descriptor: object,
          typeIndex: object.type,
          using: undefined,
          index,
          newIndex: -1,
        };
      }
    }
  }
  // allocate indices for internal functions
  const funcSection = getSection(SectionType.Function);
  const codeSection = getSection(SectionType.Code);
  if (funcSection && codeSection) {
    for (const [ i, typeIndex ] of funcSection.types.entries()) {
      const code = codeSection.functions[i];
      const index = functions.length;
      let parsed = null;
      const fn = {
        type: 'internal',
        name: functionNames[index],
        typeIndex,
        code,
        using: undefined,
        index,
        newIndex: -1,

        get instructions() {
          if (!parsed) {
            parsed = parseFunction(this.code);
          }
          return parsed.instructions;
        },
        get size() {
          return parsed.size;
        },
        get locals() {
          return parsed.locals;
        },
      };
      functions.push(fn);
    }
  }

  if (functionNames.length === 0) {
    // get the names from the export and import section if they're missing
    const exportSection = getSection(SectionType.Export);
    if (exportSection) {
      for (const object of exportSection.exports) {
        if (object.type === ObjectType.Function) {
          const fn = functions[object.index];
          fn.name = object.name;
        }
      }
    }
    const importSection = getSection(SectionType.Import);
    if (importSection) {
      for (const object of importSection.imports) {
        if (object.type === ObjectType.Function) {
          const fn = functions[object.index];
          fn.name = object.name;
        }
      }
    }
  }

  // mark blacklisted functions as unused
  for (const fn of functions) {
    if (fn.name && blacklist.some(re => re.test(fn.name))) {
      fn.using = false;
      if (fn.name === 'getFactoryThunk' && functionNames.length === 0) {
        // when compiled for ReleaseSmall, we don't get the name section
        // therefore unable to remove the factory function by name
        // we know that getFactoryThunk loads its address, however
        // and that a function pointer is just an index into table 0
        const ops = fn.instructions;
        if (ops.length === 2 && ops[0].opcode === 0x41 && ops[1].opcode === 0x0B) {
          // 0x41 is i32.const
          // 0x0B is end
          const elemIndex = ops[0].operand;
          const elemSection = getSection(SectionType.Element);
          for (const segment of elemSection.segments) {
            if (segment.indices) {
              const funcIndex = segment.indices[elemIndex - 1];
              const fn = functions[funcIndex];
              fn.using = false;
            }
          }
        }
      }
    }
  }

  function useFunction(index) {
    const fn = functions[index];
    /* c8 ignore next 3 */
    if (!fn) {
      throw new Error(`Function #${index} does not exist`);
    }
    if (fn.using === undefined) {
      fn.using = true;
      if (fn.type === 'internal') {
        // mark all functions called by this one as being in-use as well
        for (const { opcode, operand } of fn.instructions) {
          switch (opcode) {
            case 0x10:    // function call
            case 0xD2: {  // function reference
              useFunction(operand);
            } break;
          }
        }
      }
    }
  }

  // mark functions in table elements as used
  const elemSection = getSection(SectionType.Element);
  if (elemSection) {
    for (const segment of elemSection.segments) {
      if (segment.indices) {
        for (const index of segment.indices) {
          useFunction(index);
        }
      }
    }
  }

  // mark exported functions as being in-use
  const exportSection = getSection(SectionType.Export);
  if (exportSection) {
    for (const object of exportSection.exports) {
      if (object.type === ObjectType.Function) {
        useFunction(object.index);
      }
    }
  }

  // assign new indices to functions
  const newFunctions = [];
  for (const fn of functions) {
    if (fn.using) {
      fn.newIndex = newFunctions.length;
      newFunctions.push(fn);
    }
  }

  // update call instructions with new indices
  for (const fn of newFunctions) {
    if (fn.type === 'internal') {
      for (const op of fn.instructions) {
        switch (op.opcode) {
          case 0x10:    // function call
          case 0xD2: {  // function reference
            const target = functions[op.operand];
            op.operand = target.newIndex;
          } break;
        }
      }
      fn.code = repackFunction(fn);
    }
  }

  // create new code and function section
  const newCodeSection = { type: SectionType.Code, functions: [] };
  const newFuncSection = { type: SectionType.Function, types: [] };
  for (const fn of newFunctions) {
    if (fn.type === 'internal') {
      newCodeSection.functions.push(fn.code);
      newFuncSection.types.push(fn.typeIndex);
    }
  }

  // create new element section
  const newElementSection = { type: SectionType.Element, segments: [] };
  if (elemSection) {
    for (const segment of elemSection.segments) {
      if (segment.indices) {
        const indices = segment.indices.map((index) => {
          const fn = functions[index];
          return (fn.using) ? fn.newIndex : 0;
        });
        newElementSection.segments.push({ ...segment, indices });
        /* c8 ignore next 3 */
      } else {
        newElementSection.segments.push(segment);
      }
    }
  }
  // create new export section
  const newExportSection = { type: SectionType.Export, exports: [] };
  if (exportSection) {
    for (const object of exportSection.exports) {
      if (object.type === ObjectType.Function) {
        const fn = functions[object.index];
        if (fn.using) {
          const { name, type } = object;
          const index = fn.newIndex;
          newExportSection.exports.push({ name, type, index });
        }
      } else {
        newExportSection.exports.push(object);
      }
    }
  }
  // create new import section
  const newImportSection = { type: SectionType.Import, imports: [] };
  if (importSection) {
    for (const [ index, object ] of importSection.imports.entries()) {
      if (object.type === ObjectType.Function) {
        const fn = functions[index];
        if (fn.using) {
          newImportSection.imports.push(object);
        }
        /* c8 ignore next 3 */
      } else {
        newImportSection.imports.push(object);
      }
    }
  }
  // create new name section
  let newNameSection = null;
  if (nameSection && keepNames) {
    const newFunctionNames = [];
    const newLocalNames = [];
    for (const fn of newFunctions) {
      newFunctionNames.push(fn.name);
      /* c8 ignore next 3 -- can't find a file with local names */
      if (localNames.length > 0) {
        newLocalNames.push(localNames[fn.index]);
      }
    }
    const data = repackNames({
      moduleName,
      functionNames: newFunctionNames,
      localNames: newLocalNames,
      size: nameSection.data.byteLength,
    });
    newNameSection = { type: SectionType.Custom, name: 'name', data };
  }

  // create new module sections
  const newSections = [];
  for (const section of sections) {
    switch (section.type) {
      case SectionType.Code:
        newSections.push(newCodeSection);
        break;
      case SectionType.Function:
        newSections.push(newFuncSection);
        break;
      case SectionType.Element:
        newSections.push(newElementSection);
        break;
      case SectionType.Export:
        newSections.push(newExportSection);
        break;
      case SectionType.Import:
        newSections.push(newImportSection);
        break;
      case SectionType.Custom:
        if (section.name === 'name' && newNameSection) {
          newSections.push(newNameSection);
        }
        break;
      default:
        newSections.push(section);
        break;
    }
  }
  return repackBinary({ sections: newSections, size });
}

function parseBinary(binary) {
  const {
    eof,
    readBytes,
    readU8,
    readU32,
    readString,
    readArray,
    readU32Leb128,
    readExpression,
    readCustom,
  } = createReader(binary);
  const magic = readU32();
  if (magic !== MagicNumber) {
    throw new Error(`Incorrect magic number: ${magic.toString(16)}`);
  }
  const version = readU32();
  if (version !== Version) {
    throw new Error(`Incorrect version: ${version}`);
  }
  const sections = [];
  while(!eof()) {
    sections.push(readSection());
  }
  const size = binary.byteLength;
  return { sections, size };

  function readSection() {
    const type = readU8();
    const len = readU32Leb128();
    switch(type) {
      case SectionType.Custom:
        const { name, data } = readCustom(len);
        return { type, name, data };
      case SectionType.Import: {
        const imports = readArray(() => {
          const module = readString();
          const name = readString();
          const type = readU8();
          switch (type) {
            case ObjectType.Function: {
              const index = readU32Leb128();
              return { module, name, type, index };
            }
            case ObjectType.Table: {
              const reftype = readU8();
              const limits = readLimits();
              return { module, name, type, reftype, limits };
            }
            case ObjectType.Memory: {
              const limits = readLimits();
              return { module, name, type, limits };
            }
            case ObjectType.Global: {
              const valtype = readU8();
              const mut = readU8();
              return { module, name, type, valtype, mut };
            }
            /* c8 ignore next 2 */
            default:
              throw new Error(`Unknown object type: ${type}`);
          }
        });
        return { type, imports };
      }
      case SectionType.Export: {
        const exports = readArray(() => {
          const name = readString();
          const type = readU8();
          const index = readU32Leb128();
          return { name, type, index };
        });
        return { type, exports };
      }
      case SectionType.Function: {
        const types = readArray(readU32Leb128);
        return { type, types };
      }
      case SectionType.Code: {
        const functions = readArray(() => {
          const len = readU32Leb128();
          return readBytes(len);
        });
        return { type, functions };
      }
      case SectionType.Element: {
        const segments = readArray(() => {
          const type = readU32Leb128();
          switch (type) {
            case 0: {
              const expr = readExpression();
              const indices = readArray(readU32Leb128);
              return { type, expr, indices };
            }
            case 1: {
              const kind = readU8();
              const indices = readArray(readU32Leb128);
              return { type, kind, indices };
            }
            case 2: {
              const tableidx = readU32Leb128();
              const expr = readExpression();
              const kind = readU8();
              const indices = readArray(readU32Leb128);
              return { type, tableidx, expr, kind, indices };
            }
            case 3: {
              const kind = readU8();
              const indices = readArray(readU32Leb128);
              return { type, kind, indices };
            }
            case 4: {
              const expr = readExpression();
              const entries = readArray(readExpression);
              return { type, expr, entries };
            }
            case 5: {
              const reftype = readU8();
              const entries = readArray(readExpression);
              return { type, reftype, entries };
            }
            case 6: {
              const tableidx = readU32Leb128();
              const expr = readExpression();
              const reftype = readU8();
              const entries = readArray(readExpression);
              return { type, tableidx, expr, reftype, entries };
            }
            case 7: {
              const reftype = readU8();
              const entries = readArray(readExpression);
              return { type, reftype, entries };
            }
          }
        });
        return { type, segments };
      }
      default: {
        const data = readBytes(len);
        return { type, data };
      }
    }
    /* c8 ignore next -- unreachable */
  }

  function readLimits() {
    const flag = readU8();
    const min = readU32Leb128();
    switch (flag) {
      case 0:
        return { flag, min };
      case 1:
        const max = readU32Leb128();
        return { flag, min, max };
      /* c8 ignore next 4 */
      default:
        throw new Error(`Unknown limit flag: ${flag}`);
    }
  }
}

function repackBinary(module) {
  const {
    finalize,
    writeBytes,
    writeU8,
    writeU32,
    writeLength,
    writeString,
    writeArray,
    writeU32Leb128,
    writeExpression,
    writeCustom,
  } = createWriter(module.size);
  writeU32(MagicNumber);
  writeU32(Version);
  for (const section of module.sections) {
    writeSection(section);
  }
  return finalize();

  function writeSection(section) {
    writeU8(section.type);
    writeLength(() => {
      switch(section.type) {
        case SectionType.Custom: {
          writeCustom(section);
        } break;
        case SectionType.Import: {
          writeArray(section.imports, (object) => {
            writeString(object.module);
            writeString(object.name);
            writeU8(object.type);
            switch (object.type) {
              case ObjectType.Function: {
                writeU32Leb128(object.index);
              } break;
              case ObjectType.Table: {
                writeU8(object.reftype);
                writeLimits(object.limits);
              } break;
              case ObjectType.Memory: {
                writeLimits(object.limits);
              } break;
              case ObjectType.Global: {
                writeU8(object.valtype);
                writeU8(object.mut);
              } break;
            }
          });
        } break;
        case SectionType.Export: {
          writeArray(section.exports, (object) => {
            writeString(object.name);
            writeU8(object.type);
            writeU32Leb128(object.index);
          });
        } break;
        case SectionType.Function: {
          writeArray(section.types, writeU32Leb128);
        } break;
        case SectionType.Code: {
          writeArray(section.functions, (code) => {
            writeU32Leb128(code.byteLength);
            writeBytes(code);
          });
        } break;
        case SectionType.Element: {
          writeArray(section.segments, (segment) => {
            writeU32Leb128(segment.type);
            switch (segment.type) {
              case 0: {
                writeExpression(segment.expr);
                writeArray(segment.indices, writeU32Leb128);
              } break;
              case 1: {
                writeU8(segment.kind);
                writeArray(segment.indices, writeU32Leb128);
              } break;
              case 2: {
                writeU32Leb128(segment.tableidx);
                writeExpression(segment.expr);
                writeU8(segment.kind);
                writeArray(segment.indices, writeU32Leb128);
              } break;
              case 3: {
                writeU8(segment.kind);
                writeArray(segment.indices, writeU32Leb128);
              } break;
              case 4: {
                writeExpression(segment.expr);
                writeArray(segment.entries, writeExpression);
              } break;
              case 5: {
                writeU8(segment.reftype);
                writeArray(segment.entries, writeExpression);
              } break;
              case 6: {
                writeU32Leb128(segment.tableidx);
                writeExpression(segment.expr);
                writeU8(segment.reftype);
                writeArray(segment.entries, writeExpression);
              } break;
              case 7: {
                writeU8(segment.reftype);
                writeArray(segment.entries, writeExpression);
              } break;
            }
          });
        } break;
        default: {
          writeBytes(section.data);
        }
      }
    });
  }

  function writeLimits(limits) {
    writeU8(limits.flag);
    writeU32Leb128(limits.min);
    switch (limits.flag) {
      case 1: {
        writeU32Leb128(limits.max);
      } break;
    }
  }
}

function createReader(dv) {
  const decoder = new TextDecoder('utf-8', { ignoreBOM: true });
  let offset = 0;

  function eof() {
    return (offset >= dv.byteLength);
  }

  function readBytes(len) {
    const bytes = new DataView(dv.buffer, dv.byteOffset + offset, len);
    offset += len;
    return bytes;
  }

  function readU8() {
    return dv.getUint8(offset++);
  }

  function readU32() {
    const value = dv.getUint32(offset, true);
    offset += 4;
    return value;
  }

  function readF64() {
    const value = dv.getFloat64(offset, true);
    offset += 8;
    return value;
  }

  function readString() {
    const len = readU32Leb128();
    const bytes = new Uint8Array(dv.buffer, dv.byteOffset + offset, len);
    offset += len;
    return decoder.decode(bytes);
  }

  function readArray(cb) {
    const len = readU32Leb128();
    const array = [];
    for (let i = 0; i < len; i++) {
      array.push(cb());
    }
    return array;
  }

  function readU32Leb128() {
    let value = 0;
    let shift = 0;
    while (true) {
      const byte = readU8();
      value |= (byte & 0x7f) << shift;
      shift += 7;
      if ((0x80 & byte) === 0) {
        if (value < 0) {
          value += 2 ** 32;
        }
        return value;
      }
    }
  }

  function readI32Leb128() {
    let value = 0;
    let shift = 0;
    while (true) {
      const byte = dv.getUint8(offset++);
      value |= (byte & 0x7f) << shift;
      shift += 7;
      if ((0x80 & byte) === 0) {
        if (shift < 32 && (byte & 0x40) !== 0) {
          return value | (~0 << shift);
        }
        return value;
      }
    }
  }

  function readI64Leb128() {
    let value = 0n;
    let shift = 0n;
    while (true) {
      const byte = dv.getUint8(offset++);
      value |= BigInt(byte & 0x7f) << shift;
      shift += 7n;
      if ((0x80 & byte) === 0) {
        if ((byte & 0x40) !== 0) {
          return value | (~0n << shift);
        }
        return value;
      }
    }
  }

  function readExpression() {
    const start = offset;
    const { decodeNext } = createDecoder(self);
    let op;
    while (op = decodeNext()) {
      if (op.opcode === 0x0B) {
        break;
      }
    }
    const len = offset - start;
    return new DataView(dv.buffer, dv.byteOffset + start, len);
  }

  function readCustom(len) {
    const offsetBefore = offset;
    const name = readString();
    const nameLen = offset - offsetBefore;
    const data = readBytes(len - nameLen);
    return { name, data };
  }

  const self = {
    eof,
    readBytes,
    readU8,
    readU32,
    readF64,
    readString,
    readArray,
    readU32Leb128,
    readI32Leb128,
    readI64Leb128,
    readExpression,
    readCustom,
  };
  return self;
}

function createWriter(maxSize) {
  const dv = new DataView(new ArrayBuffer(maxSize));
  const encoder = new TextEncoder();
  let offset = 0, lengthChecking = false;

  function finalize() {
    return new DataView(dv.buffer, 0, offset);
  }

  function writeBytes(bytes) {
    for (let i = 0; i < bytes.byteLength; i++) {
      writeU8(bytes.getUint8(i));
    }
  }

  function writeU8(value) {
    if (!lengthChecking) {
      dv.setUint8(offset, value);
    }
    offset++;
  }

  function writeU32(value) {
    if (!lengthChecking) {
      dv.setUint32(offset, value, true);
    }
    offset += 4;
  }

  function writeF64(value) {
    if (!lengthChecking) {
      dv.setFloat64(offset, value, true);
    }
    offset += 8;
  }

  function writeString(string) {
    const bytes = encoder.encode(string);
    writeU32Leb128(bytes.length);
    for (const byte of bytes) {
      writeU8(byte);
    }
  }

  function writeArray(values, cb) {
    writeU32Leb128(values.length);
    for (const value of values) {
      cb(value);
    }
  }

  function writeU32Leb128(value) {
    while (true) {
      const byte = value & 0x7f;
      value >>>= 7;
      if (value === 0) {
        writeU8(byte);
        return;
      }
      writeU8(byte | 0x80);
    }
  }

  function writeI32Leb128(value) {
    while (true) {
      const byte = value & 0x7f;
      value >>= 7;
      if ((value === 0 && (byte & 0x40) === 0) || (value === -1 && (byte & 0x40) !== 0)) {
        writeU8(byte);
        return;
      }
      writeU8(byte | 0x80);
    }
  }

  function writeI64Leb128(value) {
    while (true) {
      const byte = Number(value & 0x7fn);
      value >>= 7n;
      if ((value === 0n && (byte & 0x40) === 0) || (value === -1n && (byte & 0x40) !== 0)) {
        writeU8(byte);
        return;
      }
      writeU8(byte | 0x80);
    }
  }

  function writeLength(cb) {
    const saved = offset;
    lengthChecking = true;
    cb();
    const length = offset - saved;
    offset = saved;
    lengthChecking = false;
    writeU32Leb128(length);
    cb();
  }

  function writeExpression(code) {
    writeBytes(code);
  }

  function writeCustom({ name, data }) {
    writeString(name);
    writeBytes(data);
  }

  return {
    finalize,
    writeBytes,
    writeU8,
    writeU32,
    writeF64,
    writeString,
    writeArray,
    writeU32Leb128,
    writeI32Leb128,
    writeI64Leb128,
    writeExpression,
    writeCustom,
    writeLength,
  };
}

function parseFunction(dv) {
  const reader = createReader(dv);
  const {
    readU8,
    readArray,
    readU32Leb128,
  } = reader;
  // read locals first
  const locals = readArray(() => {
    const number = readU32Leb128();
    const type = readU8();
    return { number, type };
  });
  // decode the expression
  const { decodeNext } = createDecoder(reader);
  const instructions = [];
  let op;
  while (op = decodeNext()) {
    instructions.push(op);
  }
  const size = dv.byteLength;
  return { locals, instructions, size };
}

function createDecoder(reader) {
  const {
    eof,
    readBytes,
    readU8,
    readArray,
    readU32Leb128,
    readI32Leb128,
    readI64Leb128,
    readU32,
    readF64,
  } = reader;
  const readOne = readU32Leb128;
  const readTwo = () => [ readOne(), readOne() ];
  const readMultiple = (count) => {
    const indices = [];
    for (let i = 0; i < count; i++) {
      indices.push(readOne());
    }
    return indices;
  };
  const operandReaders = {
    0x02: readI32Leb128,
    0x03: readI32Leb128,
    0x04: readI32Leb128,
    0x05: readI32Leb128,
    0x0C: readOne,
    0x0D: readOne,
    0x0E: () => [ readArray(readOne), readU32Leb128() ],

    0x10: readU32Leb128,
    0x11: readTwo,
    0x1C: () => readArray(readU8),

    0x20: readOne,
    0x21: readOne,
    0x22: readOne,
    0x23: readOne,
    0x24: readOne,
    0x25: readOne,
    0x26: readOne,
    0x28: readTwo,
    0x29: readTwo,
    0x2A: readTwo,
    0x2B: readTwo,
    0x2C: readTwo,
    0x2D: readTwo,
    0x2E: readTwo,
    0x2F: readTwo,

    0x30: readTwo,
    0x31: readTwo,
    0x32: readTwo,
    0x33: readTwo,
    0x34: readTwo,
    0x35: readTwo,
    0x36: readTwo,
    0x37: readTwo,
    0x38: readTwo,
    0x39: readTwo,
    0x3A: readTwo,
    0x3B: readTwo,
    0x3C: readTwo,
    0x3D: readTwo,
    0x3E: readTwo,
    0x3F: readOne,

    0x40: readOne,
    0x41: readI32Leb128,
    0x42: readI64Leb128,
    0x43: readU32,  // avoid precision loss due to float-to-double conversion
    0x44: readF64,

    0xD0: readU8,
    0xD2: readOne,

    0xFC: () => {
      const op1 = readOne();
      switch (op1) {
        case 9:
        case 11:
        case 13:
        case 15:
        case 16:
        case 17:
          return [ op1, readOne() ];
        case 8:
        case 10:
        case 12:
        case 14:
          return [ op1, readOne(), readOne() ];
        default:
          return op1;
      }
    },
    0xFD: () => {
      const op1 = readOne();
      switch (op1) {
        case 21:
        case 22:
        case 23:
        case 24:
        case 25:
        case 26:
        case 27:
        case 28:
        case 29:
        case 30:
        case 31:
        case 32:
        case 33:
        case 34:
          return [ op1, readOne() ];
        case 0:
        case 1:
        case 2:
        case 3:
        case 5:
        case 6:
        case 7:
        case 8:
        case 9:
        case 10:
        case 11:
        case 92:
        case 93:
          return [ op1, readOne(), readOne() ];
        case 84:
        case 85:
        case 86:
        case 87:
        case 88:
        case 89:
        case 90:
        case 91:
          return [ op1, readOne(), readOne(), readOne() ];
        case 12:
          return [ op1, readBytes(16) ];
        case 13:
          return [ op1, ...readMultiple(16) ];
        default:
          return op1;
      }
    },
  };

  function decodeNext() {
    if (eof()) {
      return null;
    }
    const opcode = readU8();
    const f = operandReaders[opcode];
    const operand = f?.();
    return { opcode, operand };
  }

  return { decodeNext };
}

function repackFunction({ locals, instructions, size }) {
  const writer = createWriter(size);
  const {
    finalize,
    writeU8,
    writeArray,
    writeU32Leb128,
  } = writer;
  writeArray(locals, ({ number, type }) => {
    writeU32Leb128(number);
    writeU8(type);
  });
  const { encodeNext } = createEncoder(writer);
  for (const op of instructions) {
    encodeNext(op);
  }
  return finalize();
}

function createEncoder(writer) {
  const {
    writeBytes,
    writeU8,
    writeArray,
    writeU32Leb128,
    writeI32Leb128,
    writeI64Leb128,
    writeU32,
    writeF64,
  } = writer;
  const writeOne = writeU32Leb128;
  const writeTwo = (op) => {
    writeOne(op[0]);
    writeOne(op[1]);
  };
  const writeMultiple = (indices) => {
    for (const index of indices) {
      writeOne(index);
    }
  };
  const operandWriters = {
    0x02: writeI32Leb128,
    0x03: writeI32Leb128,
    0x04: writeI32Leb128,
    0x05: writeI32Leb128,
    0x0C: writeOne,
    0x0D: writeOne,
    0x0E: (op) => [ writeArray(op[0], writeOne), writeU32Leb128(op[1]) ],

    0x10: writeU32Leb128,
    0x11: writeTwo,
    0x1C: (op) => writeArray(op, writeU8),

    0x20: writeOne,
    0x21: writeOne,
    0x22: writeOne,
    0x23: writeOne,
    0x24: writeOne,
    0x25: writeOne,
    0x26: writeOne,
    0x28: writeTwo,
    0x29: writeTwo,
    0x2A: writeTwo,
    0x2B: writeTwo,
    0x2C: writeTwo,
    0x2D: writeTwo,
    0x2E: writeTwo,
    0x2F: writeTwo,

    0x30: writeTwo,
    0x31: writeTwo,
    0x32: writeTwo,
    0x33: writeTwo,
    0x34: writeTwo,
    0x35: writeTwo,
    0x36: writeTwo,
    0x37: writeTwo,
    0x38: writeTwo,
    0x39: writeTwo,
    0x3A: writeTwo,
    0x3B: writeTwo,
    0x3C: writeTwo,
    0x3D: writeTwo,
    0x3E: writeTwo,
    0x3F: writeOne,

    0x40: writeOne,
    0x41: writeI32Leb128,
    0x42: writeI64Leb128,
    0x43: writeU32,   // avoid precision loss due to float-to-double conversion
    0x44: writeF64,

    0xD0: writeU8,
    0xD2: writeOne,

    0xFC: (op) => {
      if (op instanceof Array) {
        writeMultiple(op);
      } else {
        writeOne(op);
      }
    },
    0xFD: (op) => {
      if (op instanceof Array) {
        if (op[0] === 12) {
          writeOne(op[0]);
          writeBytes(op[1]);
        } else {
          writeMultiple(op);
        }
      } else {
        return writeOne(op);
      }
    },
  };

  function encodeNext({ opcode, operand }) {
    writeU8(opcode);
    const f = operandWriters[opcode];
    f?.(operand);
  }

  return { encodeNext };
}

function parseNames(section) {
  let moduleName = '';
  const functionNames = [];
  const localNames = [];
  if (section) {
    const {
      eof,
      readString,
      readU8,
      readU32Leb128,
      readArray,
      readBytes,
    } = createReader(section.data);
    const readMap = () => readArray(() => {
      const index = readU32Leb128();
      const name = readString();
      return { index, name };
    });
    while(!eof()) {
      const id = readU8();
      const size = readU32Leb128();
      switch (id) {
        case 0: {
          moduleName = readString();
        } break;
        case 1: {
          const map = readMap();
          for (const { index, name } of map) {
            functionNames[index] = name;
          }
        } break;
        case 2:
          const map = readArray(() => {
            const index = readU8();
            const locals = readMap();
            return { index, locals };
          });
          for (const { index, locals } of map) {
            localNames[index] = locals;
          }
          break;
        default: {
          readBytes(size);
        }
      }
    }
  }
  return { moduleName, functionNames, localNames };
}

function repackNames({ moduleName, functionNames, localNames, size }) {
  const {
    finalize,
    writeString,
    writeU8,
    writeU32Leb128,
    writeArray,
    writeLength,
  } = createWriter(size);
  const writeMap = (entries) => writeArray(entries, ({ index, name }) => {
    writeU32Leb128(index);
    writeString(name);
  });
  if (moduleName) {
    writeU8(0);
    writeLength(() => {
      writeString(moduleName);
    });
  }
  if (functionNames.length > 0) {
    writeU8(1);
    writeLength(() => {
      const map = [];
      for (const [ index, name ] of functionNames.entries()) {
        map.push({ index, name });
      }
      writeMap(map);
    });
  }
  if (localNames.length > 0) {
    writeU8(2);
    writeLength(() => {
      const imap = [];
      for (const [ index, locals ] of localNames.entries()) {
        imap.push({ index, locals });
      }
      writeArray(imap, ({ index, locals }) => {
        writeU32Leb128(index);
        writeMap(locals);
      });
    });
  }
  return finalize();
}

async function transpile(path, options) {
  const {
    embedWASM = true,
    topLevelAwait = true,
    omitExports = false,
    stripWASM = (options.optimize && options.optimize !== 'Debug'),
    keepNames = false,
    moduleResolver = (name) => name,
    wasmLoader,
    sourceFiles,
    ...compileOptions
  } = options;
  if (typeof(wasmLoader) !== 'function') {
    if (embedWASM !== true) {
      throw new Error(`wasmLoader is a required option when embedWASM is false`);
    }
  }
  Object.assign(compileOptions, { arch: 'wasm32', platform: 'wasi', isWASM: true });
  const srcPath = path.endsWith('.zig') ? path : findSourceFile(path, { 
    sourceFiles: getAbsoluteMapping(sourceFiles, process.cwd()),
  });
  const { outputPath } = await compile(srcPath, null, compileOptions);
  const content = await readFile(outputPath);
  const env = createEnvironment();
  env.loadModule(content);
  await env.initPromise;
  env.acquireStructures(compileOptions);
  const definition = env.exportStructures();
  const runtimeURL = moduleResolver('zigar-runtime');
  let binarySource;
  if (env.hasMethods()) {
    let dv = new DataView(content.buffer);
    if (stripWASM) {
      dv = stripUnused(dv, { keepNames });
    }
    if (embedWASM) {
      binarySource = embed(srcPath, dv);
    } else {
      binarySource = await wasmLoader(srcPath, dv);
    }
  }
  return generateCode(definition, {
    declareFeatures: true,
    runtimeURL,
    binarySource,
    topLevelAwait,
    omitExports,
  });
}

function embed(path, dv) {
  const base64 = Buffer.from(dv.buffer, dv.byteOffset, dv.byteLength).toString('base64');
  return `(async () => {
  // ${basename(path)}
  const binaryString = atob(${JSON.stringify(base64)});
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
})()`;
}

export { compile, compileSync, extractOptions, findConfigFile, findConfigFileSync, findSourceFile, generateCode, getArch, getCachePath, getModuleCachePath, getPlatform, loadConfigFile, loadConfigFileSync, normalizePath, optionsForCompile, optionsForTranspile, transpile };
