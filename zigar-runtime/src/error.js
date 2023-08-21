import { MemberType } from './member.js';
import { StructureType } from './structure.js';
import { getTypeName } from './data-view.js';
import { getPrimitiveType } from './primitive.js';

export function throwBufferSizeMismatch(structure, dv) {
  const { type, name, size } = structure;
  const actual = dv.byteLength;
  const s = (size > 1) ? 's' : '';
  if (type === StructureType.Slice) {
    throw new TypeError(`${name} has elements that are ${size} byte${s} in length, received ${actual}`);
  } else {
    throw new TypeError(`${name} has ${size} byte${s}, received ${actual}`);
  }
}

export function throwBufferExpected(structure) {
  const { size, typedArray } = structure;
  const s = (size > 1) ? 's' : '';
  const acceptable = [ 'ArrayBuffer', 'DataView' ].map(addArticle);
  if (typedArray) {
    acceptable.push(addArticle(typedArray.name));
  }
  throw new TypeError(`Expecting ${formatList(acceptable)} ${size} byte${s} in length`);
}

export function throwInvalidEnum(structure, value) {
  const { name } = structure;
  throw new TypeError(`Value given does not correspond to an item of enum ${name}: ${value}`);
}

export function throwEnumExpected(structure, arg) {
  const { name } = structure;
  throw new TypeError(`Enum item of the type ${name} expected, received ${arg}`);
}

export function throwNoNewEnum(structure) {
  const { name } = structure;
  throw new TypeError(`Cannot create new enum item\nCall ${name} without the use of "new" to obtain an enum object`);
}

export function throwNoNewError(structure) {
  const { name } = structure;
  throw new TypeError(`Cannot create new error\nCall ${name} without the use of "new" to obtain an error object`);
}

export function throwNotInErrorSet(structure) {
  const { name } = structure;
  throw new TypeError(`Error given is not a part of error set ${name}`);
}

export function throwUnknownErrorNumber(structure, number) {
  const { name } = structure;
  throw new TypeError(`Error number does not corresponds to any error in error set ${name}: #${number}`);
}

export function throwInvalidType(structure) {
  const { name } = structure;
  throw new TypeError(`Object of specific type expected: ${name}`);
}

export function throwMultipleUnionInitializers(structure) {
  const { name } = structure;
  throw new TypeError(`Only one property of ${name} can be given a value`);
}

export function throwInactiveUnionProperty(structure, index, currentIndex) {
  const { instance: { members } } = structure;
  const { name: newName } = members[index];
  const { name: oldName } = members[currentIndex];
  throw new TypeError(`Accessing property ${newName} when ${oldName} is active`);
}

export function throwMissingUnionInitializer(structure, arg, exclusion) {
  const { name, instance: { members } } = structure;
  const missing = members.slice(0, exclusion ? -1 : undefined).map(m => m.name);
  throw new TypeError(`${name} needs an initializer for one of its union properties: ${missing.join(', ')}`);
}

export function throwInvalidInitializer(structure, expected, arg) {
  const { name } = structure;
  const acceptable = [];
  if (Array.isArray(expected)) {
    for (const type of expected) {
      acceptable.push(addArticle(type));
    }
  } else {
    acceptable.push(addArticle(expected));
  }
  const received = addArticle(getDescription(arg));
  throw new TypeError(`${name} expects ${formatList(acceptable)} as an argument, received ${received}`);
}

export function throwInvalidArrayInitializer(structure, arg, shapeless = false) {
  const { instance: { members: [ member ] }, type, typedArray } = structure;
  const acceptable = [];
  const primitive = getPrimitiveType(member);
  if (primitive) {
    acceptable.push(`an array of ${primitive}s`);
  } else if (member.type === MemberType.EnumerationItem) {
    acceptable.push(`an array of enum items`);
  } else {
    acceptable.push(`an array of objects`);
  }
  if (typedArray) {
    acceptable.push(`${article(typedArray.name)} ${typedArray.name}`);
  }
  if (type === StructureType.Slice && shapeless) {
    acceptable.push(`a length`);
  }
  throwInvalidInitializer(structure, acceptable.join(' or '), arg);
}

export function throwArrayLengthMismatch(structure, target, arg) {
  const { name, size, instance: { members: [ member ] } } = structure;
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

export function throwMissingInitializers(structure, arg) {
  const { name, instance: { members } } = structure;
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
  const { name } = structure;
  throw new TypeError(`${name} does not have a property with that name: ${propName}`);
}

export function throwArgumentCountMismatch(structure, actual) {
  const { name, instance: { members } } = structure;
  const argCount = members.length - 1;
  const s = (argCount > 1) ? 's' : '';
  throw new Error(`${name} expects ${argCount} argument${s}, received ${actual}`);
}

export function rethrowArgumentError(structure, index, err) {
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

export function throwNoCastingToPointer(structure) {
  throw new TypeError(`Non-slice pointers can only be created with the help of the new operator`);
}

export function throwConstantConstraint(structure, pointer) {
  const { name: name1 } = structure;
  const { constructor: { name: name2 } } = pointer;
  throw new TypeError(`Conversion of ${name2} to ${name1} requires an explicit cast`);
}

export function throwAssigningToConstant(pointer) {
  const { constructor: { name } } = pointer;
  throw new TypeError(`${name} cannot be modified`);
}

export function throwTypeMismatch(expected, arg) {
  const received = addArticle(getDescription(arg));
  throw new TypeError(`Expected ${addArticle(expected)}, received ${received}`)
}

export function throwNotEnoughBytes(structure, dest, src) {
  const { name } = structure;
  throw new TypeError(`${name} has ${dest.byteLength} bytes, received ${src.byteLength}`);
}

export function throwInaccessiblePointer() {
  throw new TypeError(`Pointers within an untagged union are not accessible`);
}

export function throwInvalidPointerTarget(structure, arg) {
  // NOTE: not being used currently
  const { name } = structure;
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
  throw new RangeError(`Property ${name} can only be null`);
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

function addArticle(noun) {
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