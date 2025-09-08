import { PosixError, StructureType, PosixDescriptorRight, memberNames } from './constants.js';
import { TYPED_ARRAY, UPDATE } from './symbols.js';
import { getPrimitiveName, defineProperty, isPromise, hasMethod } from './utils.js';

class MustBeOverridden extends Error {
  constructor() {
    super(`Method must be overridden`);
  }
}

class InvalidIntConversion extends SyntaxError {
  constructor(arg) {
    super(`Cannot convert ${arg} to an Int`);
  }
}

class Unsupported extends TypeError {
  code = PosixError.ENOTSUP;

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

class InvalidType extends TypeError {
  constructor(structure) {
    const { name } = structure;
    super(`Object of specific type expected: ${name}`);
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
    const { instance: { members: [ member ] }, type, constructor } = structure;
    const acceptable = [];
    const primitive = getPrimitiveName(member);
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
    if (constructor[TYPED_ARRAY]) {
      acceptable.push(constructor[TYPED_ARRAY].name);
    }
    if (type === StructureType.Slice && shapeless) {
      acceptable.push(`length`);
    }
    super(structure, acceptable.join(' or '), arg);
  }
}

class InvalidEnumValue extends TypeError {
  code = PosixError.EINVAL;

  constructor(set, arg) {
    const keys = Object.keys(set);
    const list = keys.map(k => `${k}\n`).join('');
    super(`Received '${arg}', which is not among the following possible values:\n\n${list}`);
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
      super(`Length of slice can be ${max} or less, received ${length}`);
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
  constructor(expected, received, variadic = false) {
    super();
    const updateText = (argOffset) => {
      expected -= argOffset;
      received -= argOffset;
      const s = (expected !== 1) ? 's' : '';
      const p = (variadic) ? 'at least ' : '';
      this.message = `Expecting ${p}${expected} argument${s}, received ${received}`;
      this.stack = adjustStack(this.stack, 'new Arg(');
    };
    updateText(0);
    defineProperty(this, UPDATE, { value: updateText, enumerable: false });
  }
}

class UndefinedArgument extends Error {
  constructor() {
    super(`Undefined argument`);
  }
}

class NoCastingToPointer extends TypeError {
  constructor() {
    super(`Non-slice pointers can only be created with the help of the new operator`);
  }
}

class NoCastingToFunction extends TypeError {
  constructor() {
    super(`Casting to function is not allowed`);
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

class AssigningToConstant extends TypeError {
  constructor(pointer) {
    const { constructor: { name } } = pointer;
    super(`${name} cannot be modified`);
  }
}

class TypeMismatch extends TypeError {
  constructor(expected, arg) {
    const received = getDescription(arg);
    super(`Expected ${addArticle(expected)}, received ${received}`);
  }
}

class InvalidStream extends TypeError {
  constructor(rights, arg) {
    const types = [];
    if (rights & PosixDescriptorRight.fd_read) {
      types.push('ReadableStreamDefaultReader', 'ReadableStreamBYOBReader', 'Blob', 'Uint8Array');
    }
    if (rights & PosixDescriptorRight.fd_write) {
      types.push('WritableStreamDefaultWriter', 'array', 'null');
    }
    if (rights & PosixDescriptorRight.fd_readdir) {
      types.push('Map');
    }
    const list = types.join(', ');
    super(`Expected ${list}, or an object with the appropriate stream interface, received ${arg}`);
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

class PreviouslyFreed extends TypeError {
  constructor(arg) {
    super(`Object has been freed already: ${arg.constructor.name}`);
  }
}

class InvalidPointerTarget extends TypeError {
  constructor(structure, arg) {
    const { name } = structure;
    let target;
    if (arg != null) {
      const noun = (arg instanceof Object && arg.constructor !== Object) ? `${arg.constructor.name} object`: typeof(arg);
      const a = article(noun);
      target = `${a} ${noun}`;
    } else {
      target = arg + '';
    }
    super(`${name} cannot point to ${target}`);
  }
}

class ZigMemoryTargetRequired extends TypeError {
  constructor() {
    super(`Pointers in Zig memory cannot point to garbage-collected object`);
  }
}

class Overflow extends TypeError {
  constructor(member, value) {
    const { type, bitSize } = member;
    const name = (bitSize > 32 ? 'Big' : '') + memberNames[type] + bitSize;
    super(`${name} cannot represent the value given: ${value}`);
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
    const { name, structure: { name: struct } } = member;
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

class UnexpectedGenerator extends TypeError {
  constructor() {
    super(`Unexpected async generator`);
  }
}

class InvalidFileDescriptor extends Error {
  code = PosixError.EBADF;

  constructor() {
    super(`Invalid file descriptor`);
  }
}

class InvalidPath extends Error {
  code = PosixError.ENOENT;

  constructor(path) {
    super(`Invalid relative path '${path}'`);
  }
}

class MissingStreamMethod extends Error {
  code = PosixError.EBADF;

  constructor(name) {
    super(`Missing stream method '${name}'`);
  }
}

class InvalidArgument extends Error {
  code = PosixError.EINVAL;

  constructor() {
    super(`Invalid argument`);
  }
}

class IllegalSeek extends Error {
  code = PosixError.ESPIPE;

  constructor() {
    super(`Illegal seek`);
  }
}

class WouldBlock extends Error {
  code = PosixError.EAGAIN;

  constructor() {
    super(`Would block`);
  }
}

class Deadlock extends Error {
  code = PosixError.EDEADLK;

  constructor() {
    super(`Unable to await promise`);
  }
}

class MissingEventListener extends Error {
  constructor(name, code) {
    super(`Missing event listener: ${name}`);
    this.code = code;
  }
}

class ZigError extends Error {
  constructor(error, remove = 0) {
    if (error instanceof Error) {
      super(error.message);
      error.stack = adjustStack(this.stack, remove);
      return error;
    } else {
      super(error ?? 'Error encountered in Zig code');
    }
  }
}

class Exit extends ZigError {
  constructor(code) {
    super('Program exited');
    this.code = code;
  }
}

function adjustArgumentError(err, argIndex) {
  const updateText = (argOffset) => {
    argIndex -= argOffset;
    err.message = `args[${argIndex}]: ${err.message}`;
    err.stack = adjustStack(err.stack, 'new Arg(');
  };
  updateText(0);
  defineProperty(err, UPDATE, { value: updateText, enumerable: false });
  return err;
}

function adjustStack(stack, search) {
  if (typeof(stack) === 'string') {
    const lines = stack.split('\n');
    const index = lines.findIndex(s => s.includes(search));
    if (index !== -1) {
      lines.splice(1, index);
      stack = lines.join('\n');
    }
  }
  return stack;
}

function replaceRangeError(member, index, err) {
  if (err instanceof RangeError && !(err instanceof OutOfBound)) {
    err = new OutOfBound(member, index);
  }
  return err;
}

function throwReadOnly() {
  throw new ReadOnly();
}

function checkInefficientAccess(progress, access, len) {
  progress.bytes += len;
  progress.calls++;
  if (progress.calls === 100) {
    const bytesPerCall = progress.bytes / progress.calls;
    if (bytesPerCall < 8) {
      const s = bytesPerCall !== 1 ? 's' : '';
      const action = (access === 'read') ? 'reading' : 'writing';
      const name = (access === 'read') ? 'Reader' : 'Writer';
      throw new Error(`Inefficient ${access} access. Each call is only ${action} ${bytesPerCall} byte${s}. Please use std.io.Buffered${name}.`);
    }
  }
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
  } catch (err) {
  }
  return s.charAt(0).toLocaleUpperCase() + s.substring(1);
}

function catchPosixError(canWait = false, defErrorCode, run, resolve, reject) {
  const fail = (err) => {
    let result;
    if (reject) {
      result = reject(err);
    } else {
      if (err.code !== PosixError.EAGAIN && err.code !== PosixError.ENOTSUP) {
        console.error(err);
      }
    }
    return result ?? err.code ?? defErrorCode;
  };
  const done = (value) => {
    const result = resolve?.(value);
    return result ?? PosixError.NONE;
  };
  try {
    const result = run();
    if (isPromise(result)) {
      if (!canWait) {
        throw new Deadlock();
      }
      return result.then(done).catch(fail);
    } else {
      return done(result);
    }
  } catch (err) {
    return fail(err);
  }
}

function checkAccessRight(rights, required) {
  if (!(rights[0] & required)) {
    throw new InvalidFileDescriptor();
  }
}

function checkStreamMethod(stream, name) {
  if (!hasMethod(stream, name)) {
    throw new MissingStreamMethod(name);
  }
}

function expectBoolean(result, errorCode) {
  if (result === true) return PosixError.NONE; 
  if (result === false) return errorCode;
  throw new TypeMismatch('boolean', result);
}

function isErrorJSON(arg) {
  return typeof(arg) === 'object' && typeof(arg.error) === 'string' && Object.keys(arg).length === 1  ;
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

export { AccessingOpaque, AlignmentConflict, ArgumentCountMismatch, ArrayLengthMismatch, AssigningToConstant, BufferExpected, BufferSizeMismatch, ConstantConstraint, CreatingOpaque, Deadlock, EnumExpected, ErrorExpected, Exit, IllegalSeek, InaccessiblePointer, InactiveUnionProperty, InvalidArgument, InvalidArrayInitializer, InvalidEnumValue, InvalidFileDescriptor, InvalidInitializer, InvalidIntConversion, InvalidPath, InvalidPointerTarget, InvalidSliceLength, InvalidStream, InvalidType, InvalidVariadicArgument, MisplacedSentinel, MissingEventListener, MissingInitializers, MissingSentinel, MissingStreamMethod, MissingUnionInitializer, MultipleUnionInitializers, MustBeOverridden, NoCastingToFunction, NoCastingToPointer, NoInitializer, NoProperty, NotInErrorSet, NotOnByteBoundary, NotUndefined, NullPointer, OutOfBound, Overflow, PreviouslyFreed, ReadOnly, ReadOnlyTarget, TypeMismatch, UndefinedArgument, UnexpectedGenerator, Unsupported, WouldBlock, ZigError, ZigMemoryTargetRequired, addArticle, adjustArgumentError, article, catchPosixError, checkAccessRight, checkInefficientAccess, checkStreamMethod, deanimalizeErrorName, expectBoolean, formatList, getDescription, isErrorJSON, replaceRangeError, throwReadOnly };
