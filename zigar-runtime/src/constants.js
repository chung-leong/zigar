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
  Directory: 9,
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

export const ModuleAttribute = {
  LittleEndian:     0x0001,
  RuntimeSafety:    0x0002,
  LibC:             0x0004,
  IoRedirection:    0x0008,
};

export const VisitorFlag = {
  IsInactive:       0x0001,
  IsImmutable:      0x0002,

  IgnoreUncreated:  0x0004,
  IgnoreInactive:   0x0008,
  IgnoreArguments:  0x0010,
  IgnoreRetval:     0x0020,
};

// values here mirror std.os.wasi.errno_t
export const PosixError = {
  NONE: 0,  
  EACCES: 2,
  EAGAIN: 6,
  EBADF: 8,
  EDEADLK: 16,
  EEXIST: 20,
  EFAULT: 21,
  EINVAL: 28,
  EIO: 29,
  ENOENT: 44,
  ENOTSUP: 58,
  EPERM: 63,
  ESPIPE: 70,
  ENOTCAPABLE: 76,
};
export const PosixFileType = {
  unknown: 0,
  blockDevice: 1,
  characterDevice: 2,
  directory: 3,
  file: 4,
  socketDgram: 5,
  socketStream: 6,
  symbolicLink: 7,
};
export const PosixOpenFlag = {
  create: 1 << 0,
  directory: 1 << 1,
  exclusive: 1 << 2,
  truncate: 1 << 3,
};
export const PosixLookupFlag = {
  symlinkFollow: 1 << 0,
};
export const PosixLockType = {
  read: 0,
  write: 1,
  unlock: 2,
};
export const PosixDescriptorRight = {
  fd_datasync: 1 << 0,
  fd_read: 1 << 1,
  fd_seek: 1 << 2,
  fd_fdstat_set_flags: 1 << 3,
  fd_sync: 1 << 4,
  fd_tell: 1 << 5,
  fd_write: 1 << 6,
  fd_advise: 1 << 7,
  fd_allocate: 1 << 8,
  path_create_directory: 1 << 9,
  path_create_file: 1 << 10,
  path_link_source: 1 << 11,
  path_link_target: 1 << 12,
  path_open: 1 << 13,
  fd_readdir: 1 << 14,
  path_readlink: 1 << 15,
  path_rename_source: 1 << 16,
  path_rename_target: 1 << 17,
  path_filestat_get: 1 << 18,
  path_filestat_set_size: 1 << 19,
  path_filestat_set_times: 1 << 20,
  fd_filestat_get: 1 << 21,
  fd_filestat_set_size: 1 << 22,
  fd_filestat_set_times: 1 << 23,
  path_symlink: 1 << 24,
  path_remove_directory: 1 << 25,
  path_unlink_file: 1 << 26,
  poll_fd_readwrite: 1 << 27,
  sock_shutdown: 1 << 28,
  sock_accept: 1 << 29,
};
export const PosixDescriptorFlag = {
  append: 1 << 0,
  dsync: 1 << 1,
  nonblock: 1 << 2,
  rsync: 1 << 3,
  sync: 1 << 4,
};
export const PosixDescriptor = {
  stdin: 0,
  stdout: 1,
  stderr: 2,
  root: -1,

  min: 0x000f_ffff,
  max: 0x07ff_ffff, 
};
export const PosixPollEventType = {
  CLOCK: 0,
  FD_READ: 1,
  FD_WRITE: 2,
};
