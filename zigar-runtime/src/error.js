import { MemberType } from './member.js';
import { StructureType, getStructureName } from './structure.js';
import { getTypeName } from './data-view.js';
import { getPrimitiveType } from './primitive.js';

export function throwNoInitializer(structure) {
  const name = getStructureName(structure);
  throw new TypeError(`An initializer must be provided to the constructor of ${name}, even when it's undefined`);
}

export function throwBufferSizeMismatch(structure, dv, target = null) {
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

export function throwBufferExpected(structure) {
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

export function throwInvalidEnum(structure, value) {
  const name = getStructureName(structure);
  throw new TypeError(`Value given does not correspond to an item of enum ${name}: ${value}`);
}

export function throwEnumExpected(structure, arg) {
  const name = getStructureName(structure);
  throw new TypeError(`Enum item of the type ${name} expected, received ${arg}`);
}

export function throwErrorExpected(structure, arg) {
  const name = getStructureName(structure);
  throw new TypeError(`Error of the type ${name} expected, received ${arg}`);
}

export function throwNotInErrorSet(structure) {
  const name = getStructureName(structure);
  throw new TypeError(`Error given is not a part of error set ${name}`);
}

export function throwUnknownErrorNumber(structure, number) {
  const name = getStructureName(structure);
  throw new TypeError(`Error number does not corresponds to any error in error set ${name}: #${number}`);
}

export function throwInvalidType(structure) {
  const name = getStructureName(structure);
  throw new TypeError(`Object of specific type expected: ${name}`);
}

export function throwMultipleUnionInitializers(structure) {
  const name = getStructureName(structure);
  throw new TypeError(`Only one property of ${name} can be given a value`);
}

export function throwInactiveUnionProperty(structure, name, currentName) {
  throw new TypeError(`Accessing property ${name} when ${currentName} is active`);
}

export function throwMissingUnionInitializer(structure, arg, exclusion) {
  const { instance: { members } } = structure;
  const name = getStructureName(structure);
  const missing = members.slice(0, exclusion ? -1 : undefined).map(m => m.name);
  throw new TypeError(`${name} needs an initializer for one of its union properties: ${missing.join(', ')}`);
}

export function throwInvalidInitializer(structure, expected, arg) {
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

export function throwInvalidArrayInitializer(structure, arg, shapeless = false) {
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

export function throwArrayLengthMismatch(structure, target, arg) {
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

export function throwMissingInitializers(structure, arg) {
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

export function throwNoProperty(structure, propName) {
  const name = getStructureName(structure);
  throw new TypeError(`${name} does not have a property with that name: ${propName}`);
}

export function throwArgumentCountMismatch(structure, actual) {
  const { instance: { members } } = structure;
  const name = getStructureName(structure);
  const argCount = members.length - 1;
  const s = (argCount > 1) ? 's' : '';
  throw new Error(`${name} expects ${argCount} argument${s}, received ${actual}`);
}

export function rethrowArgumentError(structure, index, err) {
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

export function throwNoCastingToPointer(structure) {
  throw new TypeError(`Non-slice pointers can only be created with the help of the new operator`);
}

export function throwConstantConstraint(structure, pointer) {
  const name1 = getStructureName(structure);
  const { constructor: { name: name2 } } = pointer;
  throw new TypeError(`Conversion of ${name2} to ${name1} requires an explicit cast`);
}

export function throwMisplacedSentinel(structure, value, index, length) {
  const name = getStructureName(structure);
  throw new TypeError(`${name} expects the sentinel value ${value} at ${length - 1}, found at ${index}`);
}

export function throwMissingSentinel(structure, value, length) {
  const name = getStructureName(structure);
  throw new TypeError(`${name} expects the sentinel value ${value} at ${length - 1}`);
}

export function throwAlignmentConflict(align1, align2) {
  throw new TypeError(`Cannot simultaneously align memory to ${align2}-byte and ${align1}-byte boundary`);
}

export function throwAssigningToConstant(pointer) {
  const { constructor: { name } } = pointer;
  throw new TypeError(`${name} cannot be modified`);
}

export function throwTypeMismatch(expected, arg) {
  const received = getDescription(arg);
  throw new TypeError(`Expected ${addArticle(expected)}, received ${received}`)
}

export function throwInaccessiblePointer() {
  throw new TypeError(`Pointers within an untagged union are not accessible`);
}

export function throwNullPointer() {
  throw new TypeError(`Null pointer`);
}

export function throwInvalidPointerTarget(structure, arg) {
  const name = getStructureName(structure);
  let target;
  if (arg != null) {
    const type = typeof(arg)
    const noun = (type === 'object' && arg.constructor !== Object) ? `${arg.constructor.name} object`: type;
    const a = article(noun);
    target = `${a} ${noun}`;
  } else {
    target = arg + '';
  }
  throw new TypeError(`${name} cannot point to ${target}`)
}

export function throwFixedMemoryTargetRequired(structure, arg) {
  throw new TypeError(`Pointers in fixed memory cannot point to garbage-collected object`);
}


export function throwOverflow(member, value) {
  const typeName = getTypeName(member);
  throw new TypeError(`${typeName} cannot represent the value given: ${value}`);
}

export function throwOutOfBound(member, index) {
  const { name } = member;
  throw new RangeError(`Index exceeds the size of ${name ?? 'array'}: ${index}`);
}

export function rethrowRangeError(member, index, err) {
  if (err instanceof RangeError) {
    throwOutOfBound(member, index);
  } else {
    throw err;
  }
}

export function throwNotNull(member) {
  const { name } = member;
  throw new TypeError(`Property ${name} can only be null`);
}

export function throwNotUndefined(member) {
  const { name } = member;
  throw new RangeError(`Property ${name} can only be undefined`);
}

export function throwReadOnly() {
  throw new TypeError(`Unable to modify read-only object`);
}

export function throwReadOnlyTarget(structure) {
  const name = getStructureName(structure);
  throw new TypeError(`${name} cannot point to a read-only object`);
}

export function throwZigError(name) {
  throw new Error(decamelizeErrorName(name));
}

export function decamelizeErrorName(name) {
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

export function addArticle(noun) {
  return `${article(noun)} ${noun}`;
}

export function article(noun) {
  return /^\W*[aeiou]/i.test(noun) ? 'an' : 'a';
}

export function formatList(list, conj = 'or') {
  const sep = ` ${conj} `;
  if (list.length > 2) {
    return list.slice(0, -1).join(', ') + sep + list[list.length - 1];
  } else {
    return list.join(sep);
  }
}