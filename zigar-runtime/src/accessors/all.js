import { memberNames, MemberType } from '../constants.js';
import { mixin } from '../environment.js';
import { defineProperty, defineValue } from '../utils.js';

// handle retrieval of accessors

export default mixin({
  getAccessor(access, member) {
    const typeName = getTypeName(member)
    const accessorName = access + typeName;
    // see if it's a built-in method of DataView
    let accessor = DataView.prototype[accessorName];
    if (accessor) {
      return accessor;
    }
    // check cache
    accessor = cache.get(accessorName);
    if (accessor) {
      return accessor;
    }
    accessor = this[`getAccessor${typeName}`]?.(access, member)
            ?? this[`getAccessor${typeName.replace(/\d+/, '')}`]?.(access, member)
            ?? this[`getAccessor${typeName.replace(/^\D+\d+/, '')}`]?.(access, member);
    /* c8 ignore start */
    if (!accessor) {
      throw new Error(`No accessor available: ${typeName}`);
    }
    /* c8 ignore end */
    defineProperty(accessor, 'name', defineValue(accessorName));
    cache.set(accessorName, accessor);
    return accessor;
  },
  getTypedArrayClass(member) {
    const typeName = getTypeName(member)
    const arrayName = typeName + 'Array';
    return globalThis[arrayName];
  },
});

const cache = new Map();

export function isNeededByMember(member) {
  switch (member.type) {
    case MemberType.Bool:
    case MemberType.Int:
    case MemberType.Uint:
    case MemberType.Float:
      return true;
    default:
      return false;
  }
}

export function getTypeName(member) {
  const { type, bitSize, byteSize } = member;
  const suffix = (type === MemberType.Bool && byteSize) ? byteSize * 8 : bitSize;
  let name = memberNames[type] + suffix;
  if (bitSize > 32 && (type === MemberType.Int || type === MemberType.Uint)) {
    if (bitSize <= 64) {
      name = `Big${name}`;
    } else {
      name = `Jumbo${name}`;
    }
  }
  if (byteSize === undefined) {
    name += 'Unaligned';
  }
  return name;
}

