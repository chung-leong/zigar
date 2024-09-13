
export const StructureType = {
  Primitive: 0,
  Array: 1,
  Struct: 2,
  Union: 3,
  ErrorUnion: 4,
  ErrorSet: 5,
  Enum: 6,
  Optional: 7,
  Pointer: 8,
  Slice: 9,
  Vector: 10,
  Opaque: 11,
  ArgStruct: 12,
  VariadicStruct: 13,
  Function: 14,
};
export const StructureFlag = {
  HasValue:         0x0000_0001,
  HasObject:        0x0000_0002,
  HasPointer:       0x0000_0004,
  HasSlot:          0x0000_0008,
  HasLength:        0x0000_0010,
  HasSelector:      0x0000_0020,
  HasTag:           0x0000_0040,
  HasSentinel:      0x0000_0080,

  IsConst:          0x0000_0100,
  IsMultiple:       0x0000_0200,
  IsSingle:         0x0000_0400,
  IsExtern:         0x0000_0800,
  IsString:         0x0000_1000,
  IsPacked:         0x0000_2000,
  IsIterator:       0x0000_4000,
  IsThrowing:       0x0000_8000,

  HasInaccessible:  0x0001_0000,

  IsTuple:          0x0100_0000,
  IsNullable:       0x0200_0000,
  IsOpenEnded:      0x0400_0000,
  IsVariandic:      0x0800_0000,
};
export const structureNames = Object.keys(StructureType);

export const MemberType = {
  Void: 0,
  Bool: 1,
  Int: 2,
  Uint: 3,
  Float: 4,
  Object: 5,
  Type: 6,
  Literal: 7,
  Null: 8,
  Undefined: 9,
  Unsupported: 10,
};
export const memberNames = Object.keys(MemberType);
export const MemberFlag = {
  IsRequired:       0x0000_0001,
  IsReadOnly:       0x0000_0002,
  IsSize:           0x0000_0004,
  IsPartOfSet:      0x0000_0008,
  IsSelector:       0x0000_0010,
  IsMethod:         0x0000_0020,
  IsSentinel:       0x0000_0040,
  IsBackingInt:     0x0000_0080,
};
