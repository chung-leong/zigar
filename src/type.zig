const std = @import("std");
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

pub const Memory = extern struct {
    bytes: [*]u8,
    len: usize,
};

pub const Member = extern struct {
    name: ?[*:0]const u8 = null,
    member_type: MemberType,
    is_signed: bool = false,
    bit_offset: u32,
    bit_size: u32,
    byte_size: u32,
    slot: u32,
    structure: ?Value = null,
};

pub const MemberSet = extern struct {
    members: [*]Member,
    member_count: usize,
    total_size: usize,
    default_data: Memory,
    default_pointers: []Memory,
    default_pointer_count: usize,
};

pub const Method = extern struct {
    name: ?[*:0]const u8 = null,
    is_static_only: bool,
    thunk: Thunk,
    structure: Value,
};

pub const MethodSet = extern struct {
    methods: [*]Method,
    method_size: usize,
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

pub fn NextIntType(comptime T: type) type {
    var info = @typeInfo(T);
    if (info.signedness == .signed) {
        info.signedness = .unsigned;
    } else {
        info.signedness = .signed;
        info.bits += if (info.bits == 32) 32 else 64;
    }
    return @Type(info);
}

pub fn EnumType(comptime T: type) type {
    var IT = i32;
    var all_fit = false;
    while (!all_fit) : (IT = NextIntType(IT)) {
        all_fit = true;
        inline for (@typeInfo(T).Enum.fields) |field| {
            if (field.value > std.math.maxInt(IT)) {
                all_fit = false;
            } else if (field.value < std.math.minInt(IT)) {
                all_fit = false;
            }
        }
    }
    return IT;
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
