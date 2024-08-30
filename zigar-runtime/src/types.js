export const MemoryType = {
  Normal: 0,
  Scratch: 1,
};

export const CallResult = {
  OK: 0,
  Failure: 1,
  Deadlock: 2,
  Disabled: 3,
};

export function getIntRange(member) {
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

export function getPrimitiveClass({ type, bitSize }) {
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

export function getPrimitiveType(member) {
  const Primitive = getPrimitiveClass(member);
  if (Primitive) {
    return typeof(Primitive(0));
  }
}

export function isExtendedType(member) {
  if (!isByteAligned(member)) {
    return true;
  }
  const { type, bitSize } = member;
  if (type === MemberType.Int) {
    return !(bitSize === 8 || bitSize === 16 || bitSize === 32 || bitSize === 64);
  } else if (type === MemberType.Float) {
    return !(bitSize === 32 || bitSize === 64);
  } else {
    return false;
  }
}

export function isPointer(type) {
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

export function isArrayLike(type) {
  return type === StructureType.Array || type === StructureType.Vector || type === StructureType.Slice;
}

export function isByteAligned({ bitOffset, bitSize, byteSize }) {
  return byteSize !== undefined || (!(bitOffset & 0x07) && !(bitSize & 0x07)) || bitSize === 0;
}

export function hasStandardIntSize({ bitSize }) {
  return bitSize === 8 || bitSize === 16 || bitSize === 32 || bitSize === 64;
}

export function hasStandardFloatSize({ bitSize }) {
  return bitSize === 32 || bitSize === 64;
}

export function isErrorJSON(arg) {
  return typeof(arg) === 'object' && typeof(arg.error) === 'string' && Object.keys(arg).length === 1  ;
}
