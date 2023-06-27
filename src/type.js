export const MemberType = {
  Void: 0,
  Bool: 1,
  Int: 2,
  Float: 3,
  EnumerationItem: 4,
  Object: 5,
  Type: 6,
};

export const StructureType = {
  Primitive: 0,
  Array: 1,
  Struct: 2,
  ExternUnion: 3,
  TaggedUnion: 4,
  ErrorUnion: 5,
  ErrorSet: 6,
  Enumeration: 7,
  Optional: 8,
  Pointer: 9,
  Slice: 10,
  Opaque: 11,
  ArgStruct: 12,
};

export function getTypeName(type, isSigned, bitSize) {
  if (type === MemberType.Int) {
    return `${bitSize <= 32 ? '' : 'Big' }${isSigned ? 'Int' : 'Uint'}${bitSize}`;
  } else if (type === MemberType.Float) {
    return `Float${bitSize}`;
  } else if (type === MemberType.Bool) {
    return `Bool`;
  } else if (type === MemberType.Void) {
    return `Null`;
  }
}

export function getIntRange(isSigned, bitSize) {
  if (bitSize <= 32) {
    const max = 2 ** (isSigned ? bitSize - 1 : bitSize) - 1;
    const min = (isSigned) ? -(2 ** (bitSize - 1)) : 0;
    return { min, max };
  } else {
    bitSize = BigInt(bitSize);
    const max = 2n ** (isSigned ? bitSize - 1n : bitSize) - 1n;
    const min = (isSigned) ? -(2n ** (bitSize - 1n)) : 0n;
    return { min, max };
  }
}

export function getPrimitive(type, bitSize) {
  if (type === MemberType.Int) {
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
