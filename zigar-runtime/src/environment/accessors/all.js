import { mixin } from '../class.js';
import { memberNames, MemberType } from '../members/all.js';

const cache = new Map();

mixin({
  getAccessor(access, member) {
    const typeName = getTypeName(member)
    const accessorName = access + typeName;
    let accessor = DataView.prototype[accessorName];
    if (accessor) {
      return accessor;
    }
    accessor = cache.get(accessorName);
    if (accessor) {
      return accessor;
    }
    console.log({ member, typeName });
    accessor = this[`getAccessor${typeName}`]?.(access, member)
            ?? this[`getAccessor${typeName.replace(/\d+/, '')}`](access, member);
    cache.set(accessorName)
    return accessor;
  }
});

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
    name = `Big${name}`;
  }
  if (!isByteAligned(member)) {
    name += 'Unaligned';
  }
  return name;
}

export function isByteAligned(member) {
  const { bitSize, bitOffset, byteSize } = member;
  if (byteSize !== undefined) {
    return true;
  } else {
    return (!(bitOffset & 0x07) && !(bitSize & 0x07)) || bitSize === 0;
  }
}