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
    accessor = this[`getAccessor${typeName}`]?.(access, member)
            ?? this[`getAccessor${typeName.replace(/\d+/, '')}`](access, member);
    cache.set(accessorName)
    return accessor;
  }
})

export function getTypeName(member) {
  const { type, bitSize, bitOffset } = member;
  const suffix = (type === MemberType.Bool && byteSize) ? byteSize * 8 : 1;
  let name = memberNames[type] + suffix;
  if (bitSize > 32 && (type === MemberType.Int || type === MemberType.Uint)) {
    name = `Big${name}`;
  }
  if (byteSize === undefined && ((bitOffset & 0x07) !== 0 || (bitSize & 0x07) === 0)) {
    name += 'Unaligned';
  }
  return name;
}
