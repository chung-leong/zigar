const StructureType = {
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
const StructurePurpose = {
  Unknown: 0,
  Promise: 1,
  Generator: 2,
  AbortSignal: 3,
  Allocator: 4,
  Iterator: 5,
  Reader: 6,
  Writer: 7,
  File: 8,
  Directory: 9,
};
const structureNames = Object.keys(StructureType);
const StructureFlag = {
  HasValue:         0x0001,
  HasObject:        0x0002,
  HasPointer:       0x0004,
  HasSlot:          0x0008,
};
const PrimitiveFlag = {
  IsSize:           0x0010,
};
const ArrayFlag = {
  HasSentinel:      0x0010,
  IsString:         0x0020,
  IsTypedArray:     0x0040,
  IsClampedArray:   0x0080,
};
const StructFlag = {
  IsExtern:         0x0010,
  IsPacked:         0x0020,
  IsTuple:          0x0040,
  IsOptional:       0x0080,
};
const UnionFlag = {
  HasSelector:      0x0010,
  HasTag:           0x0020,
  HasInaccessible:  0x0040,
  IsExtern:         0x0080,

  IsPacked:         0x0100,
};
const EnumFlag = {
  IsOpenEnded:      0x0010,
};
const OptionalFlag = {
  HasSelector:      0x0010,
};
const PointerFlag = {
  HasLength:        0x0010,
  IsMultiple:       0x0020,
  IsSingle:         0x0040,
  IsConst:          0x0080,

  IsNullable:       0x0100,
};
const SliceFlag = {
  HasSentinel:      0x0010,
  IsString:         0x0020,
  IsTypedArray:     0x0040,
  IsClampedArray:   0x0080,

  IsOpaque:         0x0100,
};
const ErrorSetFlag = {
  IsGlobal:         0x0010,
};
const OpaqueFlag = {
};
const VectorFlag = {
  IsTypedArray:     0x0010,
  IsClampedArray:   0x0020,
};
const ArgStructFlag = {
  HasOptions:       0x0010,
  IsThrowing:       0x0020,
  IsAsync:          0x0040,
};

const MemberType = {
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
const memberNames = Object.keys(MemberType);
const MemberFlag = {
  IsRequired:       0x0001,
  IsReadOnly:       0x0002,
  IsPartOfSet:      0x0004,
  IsSelector:       0x0008,
  IsMethod:         0x0010,
  IsSentinel:       0x0020,
  IsBackingInt:     0x0040,
  IsString:         0x0080,
};

const CallResult = {
  OK: 0,
  Failure: 1,
  Deadlock: 2,
  Disabled: 3,
};

const ModuleAttribute = {
  LittleEndian:     0x0001,
  RuntimeSafety:    0x0002,
  LibC:             0x0004,
};

const VisitorFlag = {
  IsInactive:       0x0001,
  IsImmutable:      0x0002,

  IgnoreUncreated:  0x0004,
  IgnoreInactive:   0x0008,
  IgnoreArguments:  0x0010,
  IgnoreRetval:     0x0020,
};

const PosixError = {
  NONE: 0,
  EPERM: 1,
  ENOENT: 2,
  EIO: 5,
  EACCES: 13,
  EEXIST: 17,
  EBADF: 8,
  EINVAL: 22,
  ESPIPE: 29,
  EOPNOTSUPP: 95,
};

const PosixFileType = {
  unknown: 0,
  blockDevice: 1,
  characterDevice: 2,
  directory: 3,
  file: 4,
  socketDgram: 5,
  socketStream: 6,
  symbolicLink: 7,
};

const RootDescriptor = 3;

export { ArgStructFlag, ArrayFlag, CallResult, EnumFlag, ErrorSetFlag, MemberFlag, MemberType, ModuleAttribute, OpaqueFlag, OptionalFlag, PointerFlag, PosixError, PosixFileType, PrimitiveFlag, RootDescriptor, SliceFlag, StructFlag, StructureFlag, StructurePurpose, StructureType, UnionFlag, VectorFlag, VisitorFlag, memberNames, structureNames };
