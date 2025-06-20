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
export const StructurePurpose = {
  Unknown: 0,
  Promise: 1,
  Generator: 2,
  AbortSignal: 3,
  Allocator: 4,
  Iterator: 5,
  Reader: 6,
  Writer: 7,
  File: 8,
};
export const structureNames = Object.keys(StructureType);
export const StructureFlag = {
  HasValue:         0x0001,
  HasObject:        0x0002,
  HasPointer:       0x0004,
  HasSlot:          0x0008,
};
export const PrimitiveFlag = {
  IsSize:           0x0010,
};
export const ArrayFlag = {
  HasSentinel:      0x0010,
  IsString:         0x0020,
  IsTypedArray:     0x0040,
  IsClampedArray:   0x0080,
};
export const StructFlag = {
  IsExtern:         0x0010,
  IsPacked:         0x0020,
  IsTuple:          0x0040,
  IsOptional:       0x0080,
};
export const UnionFlag = {
  HasSelector:      0x0010,
  HasTag:           0x0020,
  HasInaccessible:  0x0040,
  IsExtern:         0x0080,

  IsPacked:         0x0100,
};
export const EnumFlag = {
  IsOpenEnded:      0x0010,
};
export const OptionalFlag = {
  HasSelector:      0x0010,
};
export const PointerFlag = {
  HasLength:        0x0010,
  IsMultiple:       0x0020,
  IsSingle:         0x0040,
  IsConst:          0x0080,

  IsNullable:       0x0100,
};
export const SliceFlag = {
  HasSentinel:      0x0010,
  IsString:         0x0020,
  IsTypedArray:     0x0040,
  IsClampedArray:   0x0080,

  IsOpaque:         0x0100,
};
export const ErrorSetFlag = {
  IsGlobal:         0x0010,
};
export const OpaqueFlag = {
};
export const VectorFlag = {
  IsTypedArray:     0x0010,
  IsClampedArray:   0x0020,
};
export const ArgStructFlag = {
  HasOptions:       0x0010,
  IsThrowing:       0x0020,
  IsAsync:          0x0040,
};

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
  IsRequired:       0x0001,
  IsReadOnly:       0x0002,
  IsPartOfSet:      0x0004,
  IsSelector:       0x0008,
  IsMethod:         0x0010,
  IsSentinel:       0x0020,
  IsBackingInt:     0x0040,
  IsString:         0x0080,
};

export const CallResult = {
  OK: 0,
  Failure: 1,
  Deadlock: 2,
  Disabled: 3,
};

export const ModuleAttribute = {
  LittleEndian:     0x0001,
  RuntimeSafety:    0x0002,
  LibC:             0x0004,
};

export const VisitorFlag = {
  IsInactive:       0x0001,
  IsImmutable:      0x0002,

  IgnoreUncreated:  0x0004,
  IgnoreInactive:   0x0008,
  IgnoreArguments:  0x0010,
  IgnoreRetval:     0x0020,
};

export const PosixError = {
  NONE: 0,
  EPERM: 1,
  ENOENT: 2,
  EBADF: 8,
  EINVAL: 22,
  ESPIPE: 29,
  EDEADLK: 35,
  ENOSYS: 38,
};
