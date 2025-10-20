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
  HasValue: 1 << 0,
  HasObject: 1 << 1,
  HasPointer: 1 << 2,
  HasSlot: 1 << 3,
  HasProxy: 1 << 4,
};
const PrimitiveFlag = {
  IsSize: 1 << 5,
};
const ArrayFlag = {
  HasSentinel: 1 << 5,
  IsString: 1 << 6,
  IsTypedArray: 1 << 7,
  IsClampedArray: 1 << 8,
};
const StructFlag = {
  IsExtern: 1 << 5,
  IsPacked: 1 << 6,
  IsTuple: 1 << 7,
  IsOptional: 1 << 8,
};
const UnionFlag = {
  HasSelector: 1 << 5,
  HasTag: 1 << 6,
  HasInaccessible: 1 << 7,
  IsExtern: 1 << 8,
  IsPacked: 1 << 9,
};
const EnumFlag = {
  IsOpenEnded: 1 << 5,
};
const OptionalFlag = {
  HasSelector: 1 << 5,
};
const PointerFlag = {
  HasLength: 1 << 5,
  IsMultiple: 1 << 6,
  IsSingle: 1 << 7,
  IsConst: 1 << 8,
  IsNullable: 1 << 9,
};
const SliceFlag = {
  HasSentinel: 1 << 5,
  IsString: 1 << 6,
  IsTypedArray: 1 << 7,
  IsClampedArray: 1 << 8,
  IsOpaque: 1 << 9,
};
const ErrorSetFlag = {
  IsGlobal: 1 << 5,
};
const VectorFlag = {
  IsTypedArray: 1 << 5,
  IsClampedArray: 1 << 6,
};
const ArgStructFlag = {
  HasOptions: 1 << 5,
  IsThrowing: 1 << 6,
  IsAsync: 1 << 7,
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
  IsRequired: 1 << 0,
  IsReadOnly: 1 << 1,
  IsPartOfSet: 1 << 2,
  IsSelector: 1 << 3,
  IsMethod: 1 << 4,
  IsExpectingInstance: 1 << 5,
  IsSentinel: 1 << 6,
  IsBackingInt: 1 << 7,
  IsString: 1 << 8,
  IsPlain: 1 << 9,
  IsTypedArray: 1 << 10,
  IsClampedArray: 1 << 11,
};
const ProxyType = {
  Pointer: 1 << 0,
  Slice: 1 << 1,
  Const: 1 << 2,  
  ReadOnly: 1 << 3,
};
const ModuleAttribute = {
  LittleEndian: 1 << 0,
  RuntimeSafety: 1 << 1,
  LibC: 1 << 2,
  IoRedirection: 1 << 3,
};
const VisitorFlag = {
  IsInactive: 1 << 0,
  IsImmutable: 1 << 1,
  IgnoreUncreated: 1 << 2,
  IgnoreInactive: 1 << 3,
  IgnoreArguments: 1 << 4,
  IgnoreRetval: 1 << 5,
};
const PosixError = { // values mirror std.os.wasi.errno_t
  NONE: 0,  
  EACCES: 2,
  EAGAIN: 6,
  EBADF: 8,
  EDEADLK: 16,
  EEXIST: 20,
  EFAULT: 21,
  EINVAL: 28,
  EIO: 29,
  EMFILE: 34,
  ENOENT: 44,
  ENOTSUP: 58,
  EPERM: 63,
  ESPIPE: 70,
  ENOTCAPABLE: 76,
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
const PosixOpenFlag = {
  create: 1 << 0,
  directory: 1 << 1,
  exclusive: 1 << 2,
  truncate: 1 << 3,
};
const PosixLookupFlag = {
  symlinkFollow: 1 << 0,
};
const PosixLockType = {
  read: 0,
  write: 1,
  unlock: 2,
};
const PosixDescriptorRight = {
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
const PosixDescriptorFlag = {
  append: 1 << 0,
  dsync: 1 << 1,
  nonblock: 1 << 2,
  rsync: 1 << 3,
  sync: 1 << 4,
};
const PosixDescriptor = {
  stdin: 0,
  stdout: 1,
  stderr: 2,
  root: -1,

  min: 0x00f0_0000,
  max: 0x00ff_ffff, 
};
const PosixPollEventType = {
  CLOCK: 0,
  FD_READ: 1,
  FD_WRITE: 2,
};

export { ArgStructFlag, ArrayFlag, EnumFlag, ErrorSetFlag, MemberFlag, MemberType, ModuleAttribute, OptionalFlag, PointerFlag, PosixDescriptor, PosixDescriptorFlag, PosixDescriptorRight, PosixError, PosixFileType, PosixLockType, PosixLookupFlag, PosixOpenFlag, PosixPollEventType, PrimitiveFlag, ProxyType, SliceFlag, StructFlag, StructureFlag, StructurePurpose, StructureType, UnionFlag, VectorFlag, VisitorFlag, memberNames, structureNames };
