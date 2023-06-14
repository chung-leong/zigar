const Host = @import("host").Host;
const Callbacks = @import("host").Host;

pub const Result = enum(u32) {
    OK,
    Failure,
};

pub const StructureType = enum(u32) {
    Primitive = 0,
    Array,
    Struct,
    ExternUnion,
    TaggedUnion,
    ErrorUnion,
    Enumeration,
    Optional,
    Opaque,
};

pub const MemberType = enum(u32) {
    Void = 0,
    Bool,
    Int,
    Float,
    Enum,
    Compound,
    Pointer,
};

pub const Value = *opaque {};
pub const Thunk = *const fn (host: Host, args: Value) callconv(.C) void;
pub const Factory = *const fn (host: Host, dest: *Value) callconv(.C) Result;

pub const Member = extern struct {
    name: ?[*:0]const u8 = null,
    member_type: MemberType,
    is_signed: bool = false,
    bit_offset: u32,
    bits: u32,
    align_to: u32,
    structure: ?Value = null,
};

pub const Method = extern struct {
    name: ?[*:0]const u8 = null,
    is_static_only: bool,
    thunk: Thunk,
    structure: Value,
};

pub const Memory = extern struct {
    bytes: [*]u8,
    len: usize,
};

pub const ModuleFlags = packed struct(u32) {
    little_endian: bool,
    runtime_safety: bool,
    _: u30,
};

pub const Module = extern struct {
    version: u32,
    flags: ModuleFlags,
    callbacks: *Callbacks,
    factory: Factory,
};

pub fn BaseType(comptime T: type) type {
    return switch (@typeInfo(T)) {
        .ErrorUnion => |eu| BaseType(eu.payload),
        .Optional => |op| BaseType(op.child),
        else => T,
    };
}

pub fn isSigned(comptime T: type) bool {
    return switch (@typeInfo(T)) {
        .Int => |int| int.signedness == .signed,
        else => false,
    };
}

fn getMemberType(comptime T: type) MemberType {
    return switch (@typeInfo(T)) {
        .Bool => .Bool,
        .Int => .Int,
        .Float => .Float,
        .Enum => .Enum,
        .Struct, .Union, .Array, .ErrorUnion, .Optional => .Compound,
        .Pointer => .Pointer,
        else => .Void,
    };
}

fn getStructureType(comptime T: type) StructureType {
    return switch (@typeInfo(T)) {
        .Bool, .Int, .Float, .Void => .Primitive,
        .Struct => .Struct,
        .Union => |un| if (un.layout == .Extern) .ExternUnion else .TaggedUnion,
        .Enum => .Enumeration,
        .Array => .Array,
        .Opaque => .Opaque,
    };
}
