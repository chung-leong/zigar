export const MemberType = {
  Void: 0,
  Bool: 1,
  Int: 2,
  Float: 3,
  Enum: 4,
  Compound: 5,
  Pointer: 6,
};

export const StructureType = {
  Primitive: 0,
  Array: 1,
  Struct: 2,
  ExternUnion: 3,
  TaggedUnion: 4,
  Enumeration: 5,
};

export function getTypeName(type, bits, signed) {
  if (type === MemberType.Int) {
    return `${bits <= 32 ? '' : 'Big' }${signed ? 'Int' : 'Uint'}${bits}`;
  } else if (type === MemberType.Float) {
    return `Float${bits}`;
  } else if (type === MemberType.Bool) {
    return `Bool`;
  } else if (type === MemberType.Void) {
    return `Null`;
  }
}
  
export function getIntRange(bits, signed) {
  if (bits <= 32) {
    const max = 2 ** (signed ? bits - 1 : bits) - 1;
    const min = (signed) ? -(2 ** (bits - 1)) : 0;
    return { min, max };
  } else {
    bits = BigInt(bits);
    const max = 2n ** (signed ? bits - 1n : bits) - 1n;
    const min = (signed) ? -(2n ** (bits - 1n)) : 0n;
    return { min, max };
  }
}

export function getPrimitive(type, bits) {
  if (type === MemberType.Int) {
    if (bits <= 32) {
      return Number;
    } else {
      return BigInt;
    }
  } else if (type === MemberType.Float) {
    return Number;
  } else if (type === MemberType.Bool) {
    return Boolean;
  } else {
    return Object;
  }
}
