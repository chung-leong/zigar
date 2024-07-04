export const MemberType = {
  Void: 0,
  Bool: 1,
  Int: 2,
  Uint: 3,
  Float: 4,
  Object: 5,
  Type: 6,
  Comptime: 7,
  Static: 8,
  Literal: 9,
  Null: 10,
  Undefined: 11,
  Unsupported: 12,
};

export const StructureType = {
  Primitive: 0,
  Array: 1,
  Struct: 2,
  ExternStruct: 3,
  PackedStruct: 4,
  ArgStruct: 5,
  VariadicStruct: 6,
  ExternUnion: 7,
  BareUnion: 8,
  TaggedUnion: 9,
  ErrorUnion: 10,
  ErrorSet: 11,
  Enum: 12,
  Optional: 13,
  SinglePointer: 14,
  SlicePointer: 15,
  MultiPointer: 16,
  CPointer: 17,
  Slice: 18,
  Vector: 19,
  Opaque: 20,
  Function: 21,
};

export const MemoryType = {
  Normal: 0,
  Scratch: 1,
};

export function getTypeName(member) {
  const { type, bitSize, byteSize } = member;
  if (type === MemberType.Int) {
    return `${bitSize <= 32 ? '' : 'Big' }Int${bitSize}`;
  } else if (type === MemberType.Uint) {
    return `${bitSize <= 32 ? '' : 'Big' }Uint${bitSize}`;
  } else if (type === MemberType.Float) {
    return `Float${bitSize}`;
  } else if (type === MemberType.Bool) {
    const boolSize = (byteSize !== undefined) ? byteSize * 8 : 1;
    return `Bool${boolSize}`;
  } else if (type === MemberType.Void) {
    return `Null`;
  }
}

export function getStructureName(n) {
  for (const [ name, value ] of Object.entries(StructureType)) {
    if (value === n) {
      return name.replace(/\B[A-Z]/g, m => ` ${m}`).toLowerCase();
    }
  }
}

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
