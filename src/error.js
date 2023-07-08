import { MemberType } from './member.js';
import { StructureType } from './structure.js';
import { getTypeName } from './data-view.js';

export function throwSizeMismatch(structure, dv) {
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
  const { size } = structure;
  const s = (size > 1) ? 's' : '';
  throw new TypeError(`Expecting an ArrayBuffer or DataView ${size} byte(s) in length`);
}

export function throwInvalidEnum(structure, value) {
  const { name } = structure;
  throw new TypeError(`Value given does not correspond to an item of enum ${name}: ${value}`);
}

export function throwEnumExpected(structure) {
  const { name } = structure;
  throw new TypeError(`Enum item expected: ${name}`);
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
  throw new TypeError(`Modifying property ${newName} when ${oldName} is active`);
}

export function throwMissingUnionInitializer(structure, arg) {
  const { name, instance: { members } } = structure;
  const missing = members.slice(0, -1).map(m => m.name);
  throw new TypeError(`${name} needs an initializer for one of its union properties: ${missing.join(', ')}`);
}

export function throwInvalidInitializer(structure, expected, arg) {
  const { name } = structure;
  throw new TypeError(`The constructor of ${name} expects ${expected} as an argument, received ${arg}`);
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

export function throwOverflow(member, value) {
  const typeName = getTypeName(member);
  throw new TypeError(`${typeName} cannot represent the value given: ${value}`);
}

export function throwOutOfBound(member, index) {
  const { name } = member;
  throw new RangeError(`Index exceeds the size of ${name}: ${index}`);
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