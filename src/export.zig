const std = @import("std");
const builtin = @import("builtin");
const assert = std.debug.assert;

// error type
const Error = error{
    TODO,
    Unknown,
    UnableToRetrieveMemoryLocation,
    UnableToCreateObject,
    UnableToFindObjectType,
    UnableToSetObjectType,
    UnableToRetrieveObject,
    UnableToInsertObject,
    UnableToStartStructureDefinition,
    UnableToAddStructureMember,
    UnableToAddStaticMember,
    UnableToAddMethod,
    UnableToCreateStructureTemplate,
    UnableToAddStructureTemplate,
    UnableToDefineStructure,
    PointerIsInvalid,
};

// slot allocators
const allocator = struct {
    fn get(comptime S1: anytype) type {
        _ = S1;
        // results of comptime functions are memoized
        // that means the same S1 will yield the same counter
        return blk: {
            comptime var next = 0;
            const counter = struct {
                // same principle here; the same S2 will yield the same number
                // established by the very first call
                fn get(comptime S2: anytype) comptime_int {
                    _ = S2;
                    const slot = next;
                    next += 1;
                    return slot;
                }
            };
            break :blk counter;
        };
    }
};

// allocate slots for classe, function, and other language constructs on the host side
const structure_slot = allocator.get(.{});
const test_slot = allocator.get(.{ .Type = u32 });

fn getStructureSlot(comptime T: anytype, comptime size: std.builtin.Type.Pointer.Size) u32 {
    return structure_slot.get(.{ .Type = T, .Size = size });
}

test "getStructureSlot" {
    const A = struct {};
    const slotA = getStructureSlot(A, .One);
    assert(slotA == 0);
    const B = struct {};
    const slotB = getStructureSlot(B, .One);
    assert(slotB == 1);
    assert(getStructureSlot(A, .One) == 0);
    assert(getStructureSlot(B, .One) == 1);
}

fn getObjectSlot(comptime T: anytype, comptime index: comptime_int) u32 {
    // per-struct slot allocator
    const relocatable_slot = allocator.get(.{ .Type = T });
    return relocatable_slot.get(.{ .Index = index });
}

test "getObjectSlot" {
    const A = struct {};
    const slotA1 = getObjectSlot(A, 0);
    const slotA2 = getObjectSlot(A, 1);
    assert(slotA1 == 0);
    assert(slotA2 == 1);
    const B = struct {};
    const slotB1 = getObjectSlot(B, 1);
    const slotB2 = getObjectSlot(B, 0);
    assert(slotB1 == 0);
    assert(slotB2 == 1);
    assert(getObjectSlot(A, 1) == 1);
    assert(getObjectSlot(A, 2) == 2);
}

// enums and external structs
const Result = enum(u32) {
    OK,
    Failure,
};

const StructureType = enum(u32) {
    Primitive = 0,
    Array,
    Struct,
    ExternUnion,
    TaggedUnion,
    ErrorUnion,
    ErrorSet,
    Enumeration,
    Optional,
    Pointer,
    Slice,
    Opaque,
    ArgStruct,
};

const MemberType = enum(u32) {
    Void = 0,
    Bool,
    Int,
    Float,
    EnumerationItem,
    Object,
    Type,
};

const Value = *opaque {};
const Thunk = *const fn (host: Host, args: Value) callconv(.C) void;

const Structure = extern struct {
    name: ?[*:0]const u8 = null,
    structure_type: StructureType,
    total_size: usize = 0,
};

const Member = extern struct {
    name: ?[*:0]const u8 = null,
    member_type: MemberType,
    is_static: bool = false,
    is_required: bool = false,
    is_signed: bool = false,
    is_const: bool = true,
    bit_offset: u32 = 0,
    bit_size: u32 = 0,
    byte_size: u32 = 0,
    slot: u32 = 0,
    structure: ?Value = null,
};

const Memory = extern struct {
    bytes: ?[*]u8 = null,
    len: usize = 0,
};

const Template = extern struct {
    is_static: bool = false,
    object: Value,
};

const Method = extern struct {
    name: ?[*:0]const u8 = null,
    is_static_only: bool,
    thunk: Thunk,
    structure: Value,
};

const ModuleFlags = packed struct(u32) {
    little_endian: bool,
    runtime_safety: bool,
    _: u30 = 0,
};

const Module = extern struct {
    version: u32,
    flags: ModuleFlags,
    callbacks: *Callbacks,
    factory: Thunk,
};

fn NextIntType(comptime T: type) type {
    var info = @typeInfo(T);
    if (info.Int.signedness == .signed) {
        info.Int.signedness = .unsigned;
    } else {
        info.Int.signedness = .signed;
        info.Int.bits += switch (info.Int.bits) {
            8, 16, 32 => info.Int.bits,
            else => 64,
        };
    }
    return @Type(info);
}

test "NextIntType" {
    assert(NextIntType(u16) == i32);
    assert(NextIntType(i32) == u32);
    assert(NextIntType(u32) == i64);
    assert(NextIntType(u64) == i128);
}

fn IntType(comptime n: comptime_int) type {
    var IT = i32;
    while (!isInRangeOf(n, IT)) {
        IT = NextIntType(IT);
    }
    return IT;
}

test "IntType" {
    assert(IntType(0) == i32);
    assert(IntType(0xFFFFFFFF) == u32);
    assert(IntType(-0xFFFFFFFF) == i64);
}

fn EnumType(comptime T: type) type {
    var IT = i32;
    var all_fit = false;
    while (!all_fit) {
        all_fit = true;
        inline for (@typeInfo(T).Enum.fields) |field| {
            if (!isInRangeOf(field.value, IT)) {
                all_fit = false;
                break;
            }
        }
        if (!all_fit) {
            IT = NextIntType(IT);
        }
    }
    return IT;
}

test "EnumType" {
    const Test = enum(u128) {
        Dog = 0xFFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF,
        Cat = 0,
    };
    assert(EnumType(Test) == u128);
}

fn isInRangeOf(comptime n: comptime_int, comptime T: type) bool {
    return std.math.minInt(T) <= n and n <= std.math.maxInt(T);
}

test "isInRangeOf" {
    assert(isInRangeOf(-1, i32) == true);
    assert(isInRangeOf(-1, u32) == false);
}

fn isSigned(comptime T: type) bool {
    return switch (@typeInfo(T)) {
        .Int => |int| int.signedness == .signed,
        else => false,
    };
}

test "isSigned" {
    assert(isSigned(i32) == true);
    assert(isSigned(u77) == false);
}

fn isConst(comptime T: type) bool {
    return switch (@typeInfo(T)) {
        .Pointer => |pt| pt.is_const,
        else => false,
    };
}

test "isConst" {
    assert(isConst(i32) == false);
    assert(isConst(*const i32) == true);
}

fn isPacked(comptime T: type) bool {
    return switch (@typeInfo(T)) {
        .Struct => |st| st.layout == .Packed,
        .Union => |un| un.layout == .Packed,
        else => false,
    };
}

test "isPacked" {
    const A = struct {
        number: u17,
        flag: bool,
    };
    const B = packed union {
        flag1: bool,
        flag2: bool,
    };
    assert(isPacked(A) == false);
    assert(isPacked(B) == true);
}

fn isPointer(comptime T: type) bool {
    return switch (@typeInfo(T)) {
        .Pointer => true,
        else => false,
    };
}

test "isPointer" {
    assert(isPointer(*u8) == true);
    assert(isPointer(u8) == false);
}

fn getMemberType(comptime T: type) MemberType {
    return switch (@typeInfo(T)) {
        .Bool => .Bool,
        .Int => .Int,
        .Float => .Float,
        .Enum => .EnumerationItem,
        .Struct, .Union, .Array, .ErrorUnion, .Optional, .Pointer => .Object,
        .Type => .Type,
        else => .Void,
    };
}

test "getMemberType" {
    assert(getMemberType(u32) == .Int);
    assert(getMemberType(*u32) == .Object);
    assert(getMemberType(type) == .Type);
}

fn getStructureType(comptime T: type) StructureType {
    return switch (@typeInfo(T)) {
        .Bool, .Int, .Float, .Void, .Type => .Primitive,
        .Struct => if (isArgumentStruct(T)) .ArgStruct else .Struct,
        .Union => |un| if (un.layout == .Extern) .ExternUnion else .TaggedUnion,
        .ErrorUnion => .ErrorUnion,
        .ErrorSet => .ErrorSet,
        .Enum => .Enumeration,
        .Array => .Array,
        .Opaque => .Opaque,
        .Pointer => .Pointer,
        else => @compileError("Unsupported type: " ++ @typeName(T)),
    };
}

test "getStructureType" {
    assert(getStructureType(i32) == .Primitive);
    assert(getStructureType(union {}) == .TaggedUnion);
    assert(getStructureType(extern union {}) == .ExternUnion);
}

fn PointerType(comptime CT: type, comptime size: std.builtin.Type.Pointer.Size) type {
    return switch (size) {
        .One => *CT,
        .Slice => []CT,
        .Many => [*]CT,
        .C => [*c]CT,
    };
}

fn fromMemory(memory: Memory, comptime T: type, comptime size: std.builtin.Type.Pointer.Size) PointerType(T, size) {
    const aligned_ptr = @alignCast(@max(@alignOf(T), 1), memory.bytes);
    return switch (size) {
        .One => @ptrCast(*T, aligned_ptr),
        .Slice => slice: {
            const many_ptr = @ptrCast([*]T, aligned_ptr);
            const count = memory.len / @sizeOf(T);
            break :slice many_ptr[0..count];
        },
        .Many => @ptrCast([*]T, aligned_ptr),
        .C => @ptrCast([*c]T, aligned_ptr),
    };
}

test "fromMemory" {
    var array: [5]u8 = .{ 'H', 'e', 'l', 'l', 'o' };
    const memory: Memory = .{
        .bytes = &array,
        .len = array.len,
    };
    const p1 = fromMemory(memory, u8, .One);
    assert(p1.* == 'H');
    assert(@typeInfo(@TypeOf(p1)).Pointer.size == .One);
    const p2 = fromMemory(memory, u8, .Slice);
    assert(p2[0] == 'H');
    assert(p2.len == 5);
    assert(@typeInfo(@TypeOf(p2)).Pointer.size == .Slice);
    const p3 = fromMemory(memory, u8, .Many);
    assert(p3[0] == 'H');
    assert(@typeInfo(@TypeOf(p3)).Pointer.size == .Many);
    const p4 = fromMemory(memory, u8, .C);
    assert(p4[0] == 'H');
    assert(@typeInfo(@TypeOf(p4)).Pointer.size == .C);
}

fn toMemory(pointer: anytype) Memory {
    const T = @TypeOf(pointer);
    const CT = @typeInfo(T).Pointer.child;
    const size = @typeInfo(T).Pointer.size;
    const address = switch (size) {
        .Slice => @ptrToInt(pointer.ptr),
        else => @ptrToInt(pointer),
    };
    const len = switch (size) {
        .One => @sizeOf(CT),
        .Slice => @sizeOf(CT) * pointer.len,
        .Many, .C => 0,
    };
    return .{
        .bytes = @intToPtr([*]u8, address),
        .len = len,
    };
}

test "toMemory" {
    const a: i32 = 1234;
    const memA = toMemory(&a);
    const b: []const u8 = "Hello";
    const memB = toMemory(b);
    const c: [*]const u8 = b.ptr;
    const memC = toMemory(c);
    const d: [*c]const u8 = b.ptr;
    const memD = toMemory(d);
    const e = &b;
    const memE = toMemory(e);
    assert(memA.len == 4);
    assert(memB.len == 5);
    assert(memC.len == 0);
    assert(memD.len == 0);
    assert(memE.len == @sizeOf(@TypeOf(b)));
}

fn comparePointers(p1: anytype, p2: anytype) bool {
    const T = @TypeOf(p1);
    return switch (@typeInfo(T).Pointer.size) {
        .Slice => p1.ptr == p2.ptr and p1.len == p2.len,
        else => p1 == p2,
    };
}

test "comparePointers" {
    const a: []const u8 = "Hello world";
    const b: []const u8 = a[0..a.len];
    const c: []const u8 = a[2..a.len];
    const d: []const u8 = a[0..5];
    assert(comparePointers(a, b) == true);
    assert(comparePointers(a, c) == false);
    assert(comparePointers(a, d) == false);
    var number1: i32 = 1234;
    var number2: i32 = 1234;
    const e = &number1;
    const f = &number1;
    const g = &number2;
    assert(comparePointers(e, f) == true);
    assert(comparePointers(e, g) == false);
    const h: [*]i32 = @ptrCast([*]i32, e);
    const i: [*]i32 = @ptrCast([*]i32, g);
    assert(comparePointers(h, i) == false);
    const j: [*c]i32 = @ptrCast([*c]i32, e);
    const k: [*c]i32 = @ptrCast([*c]i32, g);
    assert(comparePointers(j, k) == false);
}

// pointer table that's filled on the C++ side
const Callbacks = extern struct {
    allocate_memory: *const fn (host: Host, size: usize, dest: *[*]u8) callconv(.C) Result,
    reallocate_memory: *const fn (host: Host, size: usize, dest: *[*]u8) callconv(.C) Result,
    free_memory: *const fn (host: Host, dest: *[*]u8) callconv(.C) Result,
    get_memory: *const fn (host: Host, container: Value, dest: *Memory) callconv(.C) Result,
    wrap_memory: *const fn (host: Host, structure: Value, memory: *const Memory, dest: *Value) callconv(.C) Result,

    get_pointer_status: *const fn (host: Host, pointer: Value, dest: *bool) callconv(.C) Result,
    set_pointer_status: *const fn (host: Host, pointer: Value, sync: bool) callconv(.C) Result,

    read_global_slot: *const fn (host: Host, id: u32, dest: *Value) callconv(.C) Result,
    write_global_slot: *const fn (host: Host, id: u32, value: ?Value) callconv(.C) Result,
    read_object_slot: *const fn (host: Host, container: Value, id: u32, dest: *Value) callconv(.C) Result,
    write_object_slot: *const fn (host: Host, container: Value, id: u32, value: ?Value) callconv(.C) Result,

    begin_structure: *const fn (host: Host, def: *const Structure, dest: *Value) callconv(.C) Result,
    attach_member: *const fn (host: Host, structure: Value, member: *const Member) callconv(.C) Result,
    attach_method: *const fn (host: Host, structure: Value, method: *const Method) callconv(.C) Result,
    attach_template: *const fn (host: Host, structure: Value, template: *const Template) callconv(.C) Result,
    finalize_structure: *const fn (host: Host, structure: Value) callconv(.C) Result,
    create_template: *const fn (host: Host, memory: *const Memory, dest: *Value) callconv(.C) Result,
};
var callbacks: Callbacks = undefined;

// host interface
const Host = *opaque {
    fn getMemory(self: Host, container: Value, comptime T: type, comptime size: std.builtin.Type.Pointer.Size) !PointerType(T, size) {
        var memory: Memory = undefined;
        if (callbacks.get_memory(self, container, &memory) != .OK) {
            return Error.UnableToRetrieveMemoryLocation;
        }
        return fromMemory(memory, T, size);
    }

    fn wrapMemory(self: Host, memory: Memory, comptime T: type, comptime size: std.builtin.Type.Pointer.Size) !Value {
        const slot = getStructureSlot(T, size);
        const structure = try self.readGlobalSlot(slot);
        var value: Value = undefined;
        if (callbacks.wrap_memory(self, structure, &memory, &value) != .OK) {
            return Error.UnableToCreateObject;
        }
        return value;
    }

    fn getPointerStatus(self: Host, pointer: Value) !bool {
        var sync: bool = undefined;
        if (callbacks.get_pointer_status(self, pointer, &sync) != .OK) {
            return Error.PointerIsInvalid;
        }
        return sync;
    }

    fn setPointerStatus(self: Host, pointer: Value, sync: bool) !void {
        if (callbacks.set_pointer_status(self, pointer, sync) != .OK) {
            return Error.PointerIsInvalid;
        }
    }

    fn readGlobalSlot(self: Host, slot: u32) !Value {
        var value: Value = undefined;
        if (callbacks.read_global_slot(self, slot, &value) != .OK) {
            return Error.UnableToFindObjectType;
        }
        return value;
    }

    fn writeGlobalSlot(self: Host, slot: u32, value: Value) !void {
        if (callbacks.write_global_slot(self, slot, value) != .OK) {
            return Error.UnableToSetObjectType;
        }
    }

    fn readObjectSlot(self: Host, container: Value, id: u32) !Value {
        var result: Value = undefined;
        if (callbacks.read_object_slot(self, container, id, &result) != .OK) {
            return Error.UnableToRetrieveObject;
        }
        return result;
    }

    fn writeObjectSlot(self: Host, container: Value, id: u32, value: ?Value) !void {
        if (callbacks.write_object_slot(self, container, id, value) != .OK) {
            return Error.UnableToInsertObject;
        }
    }

    fn beginStructure(self: Host, def: Structure) !Value {
        var structure: Value = undefined;
        if (callbacks.begin_structure(self, &def, &structure) != .OK) {
            return Error.UnableToStartStructureDefinition;
        }
        return structure;
    }

    fn attachMember(self: Host, structure: Value, member: Member) !void {
        if (callbacks.attach_member(self, structure, &member) != .OK) {
            if (member.is_static) {
                return Error.UnableToAddStaticMember;
            } else {
                return Error.UnableToAddStructureMember;
            }
        }
    }

    fn attachMethod(self: Host, structure: Value, method: Method) !void {
        if (callbacks.attach_method(self, structure, &method) != .OK) {
            return Error.UnableToAddMethod;
        }
    }

    fn attachTemplate(self: Host, structure: Value, template: Template) !void {
        if (callbacks.attach_template(self, structure, &template) != .OK) {
            return Error.UnableToAddStructureTemplate;
        }
    }

    fn finalizeStructure(self: Host, structure: Value) !void {
        if (callbacks.finalize_structure(self, structure) != .OK) {
            return Error.UnableToDefineStructure;
        }
    }

    fn createTemplate(self: Host, bytes: []u8) !Value {
        const memory: Memory = .{
            .bytes = if (bytes.len > 0) bytes.ptr else null,
            .len = bytes.len,
        };
        var value: Value = undefined;
        if (callbacks.create_template(self, &memory, &value) != .OK) {
            return Error.UnableToCreateStructureTemplate;
        }
        return value;
    }
};

// export functions
fn getStructure(host: Host, comptime T: type) !Value {
    const s_slot = getStructureSlot(T, .One);
    return host.readGlobalSlot(s_slot) catch undefined: {
        const def: Structure = .{
            .name = getStructureName(T),
            .structure_type = getStructureType(T),
            .total_size = @sizeOf(T),
        };
        // create the structure and place it in the slot immediately
        // so that recursive definition works correctly
        const structure = try host.beginStructure(def);
        try host.writeGlobalSlot(s_slot, structure);
        // define the shape of the structure
        try addMembers(host, structure, T);
        try addStaticMembers(host, structure, T);
        try addMethods(host, structure, T);
        try host.finalizeStructure(structure);
        break :undefined structure;
    };
}

fn getStructureName(comptime T: type) [*:0]const u8 {
    const name = switch (@typeInfo(T)) {
        .Pointer => |pt| switch (pt.size) {
            .One => @typeName(T),
            // since there're no pointers in JavaScript, we need to use a pair
            // of objects to represent a slice, one holding the pointer with
            // the other holding the data it points to
            // we'll give the name "*[]T" to the former and "[]T" to the latter
            else => @typeName(*T),
        },
        else => getFunctionName(T) orelse @typeName(T),
    };
    return @ptrCast([*:0]const u8, name);
}

fn addMembers(host: Host, structure: Value, comptime T: type) !void {
    switch (@typeInfo(T)) {
        .Bool, .Int, .Float, .Void => {
            try host.attachMember(structure, .{
                .member_type = getMemberType(T),
                .is_signed = isSigned(T),
                .bit_size = @bitSizeOf(T),
                .bit_offset = 0,
                .byte_size = @sizeOf(T),
            });
        },
        .Array => |ar| {
            try host.attachMember(structure, .{
                .member_type = getMemberType(ar.child),
                .is_signed = isSigned(ar.child),
                .bit_size = @bitSizeOf(ar.child),
                .bit_offset = 0,
                .byte_size = @sizeOf(ar.child),
                .structure = try getStructure(host, ar.child),
            });
        },
        .Pointer => |pt| {
            const child_structure = try getStructure(host, pt.child);
            const target_structure = switch (pt.size) {
                .One => child_structure,
                else => slice: {
                    const slice_slot = getStructureSlot(pt.child, pt.size);
                    const slice_def: Structure = .{
                        // see comment in getStructureName()
                        .name = @ptrCast([*:0]const u8, @typeName(T)),
                        .structure_type = .Slice,
                        .total_size = @sizeOf(pt.child),
                    };
                    const slice_structure = try host.beginStructure(slice_def);
                    try host.writeGlobalSlot(slice_slot, slice_structure);
                    try host.attachMember(slice_structure, .{
                        .member_type = getMemberType(pt.child),
                        .is_signed = isSigned(pt.child),
                        .is_const = pt.is_const,
                        .bit_size = @bitSizeOf(pt.child),
                        .bit_offset = 0,
                        .byte_size = @sizeOf(pt.child),
                        .structure = child_structure,
                    });
                    try host.finalizeStructure(slice_structure);
                    break :slice slice_structure;
                },
            };
            try host.attachMember(structure, .{
                .member_type = getMemberType(T),
                .is_const = pt.is_const,
                .bit_size = @bitSizeOf(T),
                .byte_size = @sizeOf(T),
                .structure = target_structure,
            });
        },
        .Struct, .Union => {
            // pre-allocate relocatable slots for fields that always need them
            const fields = std.meta.fields(T);
            inline for (fields, 0..) |field, index| {
                switch (getMemberType(field.type)) {
                    .Object => _ = getObjectSlot(T, index),
                    else => {},
                }
            }
            inline for (fields, 0..) |field, index| {
                const member: Member = .{
                    .name = @ptrCast([*:0]const u8, field.name),
                    .member_type = getMemberType(field.type),
                    .is_signed = isSigned(field.type),
                    .is_const = isConst(field.type),
                    .is_required = field.default_value == null,
                    .bit_offset = @bitOffsetOf(T, field.name),
                    .bit_size = @bitSizeOf(field.type),
                    .byte_size = if (isPacked(T)) 0 else @sizeOf(field.type),
                    .slot = getObjectSlot(T, index),
                    .structure = try getStructure(host, field.type),
                };
                try host.attachMember(structure, member);
            }
            if (!isArgumentStruct(T)) {
                // default data
                var data: [@sizeOf(T)]u8 = undefined;
                const ptr = @intToPtr(*T, @ptrToInt(&data));
                for (data, 0..) |_, index| {
                    data[index] = 0xAA;
                }
                inline for (fields) |field| {
                    if (field.default_value) |opaque_ptr| {
                        // set default value
                        const aligned_ptr = @alignCast(@alignOf(field.type), opaque_ptr);
                        const typed_ptr = @ptrCast(*const field.type, aligned_ptr);
                        @field(ptr.*, field.name) = typed_ptr.*;
                    }
                }
                const has_data = check_data: {
                    for (data) |byte| {
                        if (byte != 0) {
                            break :check_data true;
                        }
                    }
                    break :check_data false;
                };
                if (has_data) {
                    const template = try host.createTemplate(&data);
                    try dezigStructure(host, template, ptr);
                    return host.attachTemplate(structure, .{
                        .is_static = false,
                        .object = template,
                    });
                }
            }
        },
        .Enum => |en| {
            // find a type that fit all values
            const IT = EnumType(T);
            inline for (en.fields) |field| {
                try host.attachMember(structure, .{
                    .name = @ptrCast([*:0]const u8, field.name),
                    .member_type = getMemberType(IT),
                    .is_signed = isSigned(IT),
                    .bit_offset = 0,
                    .bit_size = @bitSizeOf(IT),
                    .byte_size = @sizeOf(IT),
                });
            }
        },
        .ErrorUnion => |eu| {
            try host.attachMember(structure, .{
                .name = "error",
                .member_type = .Int,
                .is_signed = false,
                .bit_offset = 0,
                .bit_size = @bitSizeOf(anyerror),
                .byte_size = @sizeOf(anyerror),
                .slot = 0,
                .structure = try getStructure(host, eu.error_set),
            });
            try host.attachMember(structure, .{
                .name = "value",
                .member_type = getMemberType(eu.payload),
                .is_signed = isSigned(eu.payload),
                .bit_offset = @sizeOf(anyerror) * 8,
                .bit_size = @bitSizeOf(eu.payload),
                .byte_size = @sizeOf(eu.payload),
                .slot = 1,
                .structure = try getStructure(host, eu.payload),
            });
        },
        .ErrorSet => |es| {
            if (es) |errors| {
                for (errors) |err| {
                    try host.attachMember(structure, .{
                        .name = @ptrCast([*:0]const u8, err.name),
                        .member_type = .Object,
                    });
                }
            }
        },
        else => {
            std.debug.print("Missing: {s}\n", .{@typeName(T)});
        },
    }
}

fn addStaticMembers(host: Host, structure: Value, comptime T: type) !void {
    const decls = switch (@typeInfo(T)) {
        .Struct => |st| st.decls,
        .Union => |un| un.decls,
        .Enum => |en| en.decls,
        .Opaque => |op| op.decls,
        else => return,
    };
    const S = opaque {};
    var template_maybe: ?Value = null;
    inline for (decls, 0..) |decl, index| {
        if (!decl.is_pub) {
            continue;
        }
        const name = @ptrCast([*:0]const u8, decl.name);
        const decl_info = @typeInfo(@TypeOf(@field(T, decl.name)));
        // get the pointer type (where possible)
        const PT = switch (decl_info) {
            .Fn, .Frame, .AnyFrame, .NoReturn => void,
            .Type => type,
            .ComptimeInt => *const IntType(@field(T, decl.name)),
            .ComptimeFloat => *const f64,
            else => @TypeOf(&@field(T, decl.name)),
        };
        if (PT == void) {
            continue;
        } else if (PT == type) {
            try host.attachMember(structure, .{
                .name = name,
                .member_type = .Type,
                .is_static = true,
                .slot = getObjectSlot(S, index),
                .structure = try getStructure(host, @field(T, decl.name)),
            });
        } else {
            const slot = getObjectSlot(S, index);
            try host.attachMember(structure, .{
                .name = name,
                .member_type = .Object,
                .is_static = true,
                .is_const = isConst(PT),
                .slot = slot,
                .structure = try getStructure(host, PT),
            });
            // get address to variable
            var typed_ptr = switch (decl_info) {
                .ComptimeInt, .ComptimeFloat => ptr: {
                    // need to create variable in memory for comptime value
                    const CT = @typeInfo(PT).Pointer.child;
                    var value: CT = @field(T, decl.name);
                    break :ptr &value;
                },
                else => ptr: {
                    if (@typeInfo(PT).Pointer.is_const) {
                        // put a copy on the stack so the constant doesn't force the
                        // shared library to stay in memory
                        var value = @field(T, decl.name);
                        break :ptr &value;
                    } else {
                        break :ptr &@field(T, decl.name);
                    }
                },
            };
            // create the pointer object
            const memory: Memory = .{
                .bytes = @ptrCast([*]u8, &typed_ptr),
                .len = @sizeOf(PT),
            };
            const ptr_obj = try host.wrapMemory(memory, PT, .One);
            // dezig it, creating SharedArrayBuffer or ArrayBuffer
            try dezigStructure(host, ptr_obj, &typed_ptr);
            const template = template_maybe orelse create: {
                const obj = try host.createTemplate(&.{});
                template_maybe = obj;
                break :create obj;
            };
            try host.writeObjectSlot(template, slot, ptr_obj);
        }
    }
    if (template_maybe) |template| {
        return host.attachTemplate(structure, .{
            .is_static = true,
            .object = template,
        });
    }
}

fn addMethods(host: Host, structure: Value, comptime T: type) !void {
    const decls = switch (@typeInfo(T)) {
        .Struct => |st| st.decls,
        .Union => |un| un.decls,
        .Enum => |en| en.decls,
        .Opaque => |op| op.decls,
        else => return,
    };
    inline for (decls) |decl| {
        if (!decl.is_pub) {
            continue;
        }
        switch (@typeInfo(@TypeOf(@field(T, decl.name)))) {
            .Fn => |f| {
                const function = @field(T, decl.name);
                const ArgT = ArgumentStruct(function);
                const arg_structure = try getStructure(host, ArgT);
                try host.attachMethod(structure, .{
                    .name = @ptrCast([*:0]const u8, decl.name),
                    .is_static_only = static: {
                        if (f.params.len > 0) {
                            if (f.params[0].type) |PT| {
                                if (PT == T) {
                                    break :static false;
                                }
                            }
                        }
                        break :static true;
                    },
                    .thunk = createThunk(function, ArgT),
                    .structure = arg_structure,
                });
            },
            else => {},
        }
    }
}

fn getFieldCount(comptime T: type) comptime_int {
    return switch (@typeInfo(T)) {
        .Struct, .Union => std.meta.fields(T).len,
        else => 0,
    };
}

fn ArgumentStruct(comptime function: anytype) type {
    const info = @typeInfo(@TypeOf(function)).Fn;
    var fields: [info.params.len + 1]std.builtin.Type.StructField = undefined;
    var count = 0;
    for (info.params, 0..) |param, index| {
        if (param.type != std.mem.Allocator) {
            const name = std.fmt.comptimePrint("{d}", .{index});
            fields[count] = .{
                .name = name,
                .type = param.type orelse void,
                .is_comptime = false,
                .alignment = @alignOf(param.type orelse void),
                .default_value = null,
            };
            count += 1;
        }
    }
    fields[count] = .{
        .name = "retval",
        .type = info.return_type orelse void,
        .is_comptime = false,
        .alignment = @alignOf(info.return_type orelse void),
        .default_value = null,
    };
    count += 1;
    return @Type(.{
        .Struct = .{
            .layout = .Auto,
            .decls = &.{},
            .fields = fields[0..count],
            .is_tuple = false,
        },
    });
}

test "ArgumentStruct" {
    const Test = struct {
        fn A(a: i32, b: bool) bool {
            return if (a > 10 and b) true else false;
        }

        fn B(s: []const u8) void {
            _ = s;
        }

        fn C(alloc: std.mem.Allocator, arg1: i32, arg2: i32) bool {
            _ = alloc;
            return arg1 < arg2;
        }
    };
    const ArgA = ArgumentStruct(Test.A);
    const fieldsA = std.meta.fields(ArgA);
    assert(fieldsA.len == 3);
    assert(fieldsA[0].name[0] == '0');
    assert(fieldsA[1].name[0] == '1');
    assert(fieldsA[2].name[0] == 'r');
    const ArgB = ArgumentStruct(Test.B);
    const fieldsB = std.meta.fields(ArgB);
    assert(fieldsB.len == 2);
    assert(fieldsB[0].name[0] == '0');
    assert(fieldsB[1].name[0] == 'r');
    const ArgC = ArgumentStruct(Test.C);
    const fieldsC = std.meta.fields(ArgC);
    assert(fieldsC.len == 3);
}

fn isArgumentStruct(comptime T: type) bool {
    return if (getFunctionName(T)) |_| true else false;
}

test "isArgumentStruct" {
    const Test = struct {
        fn A(a: i32, b: bool) bool {
            return if (a > 10 and b) true else false;
        }
    };
    const ArgA = ArgumentStruct(Test.A);
    assert(isArgumentStruct(ArgA) == true);
}

fn getFunctionName(comptime ArgT: type) ?[]const u8 {
    const name = @typeName(ArgT);
    const prefix = "export.ArgumentStruct((function '";
    if (name.len < prefix.len) {
        return null;
    }
    return name[prefix.len .. name.len - 3];
}

test "getFunctionName" {
    const Test = struct {
        fn A(a: i32, b: bool) bool {
            return if (a > 10 and b) true else false;
        }

        fn @"weird name  "() void {}
    };
    const ArgA = ArgumentStruct(Test.A);
    const name_a = getFunctionName(ArgA) orelse "function";
    assert(name_a[0] == 'A');
    assert(name_a.len == 1);
    const ArgWeird = ArgumentStruct(Test.@"weird name  ");
    const name_weird = getFunctionName(ArgWeird) orelse "function";
    assert(name_weird[0] == 'w');
    assert(name_weird.len == 12);
}

fn hasPointer(comptime T: type) bool {
    return switch (@typeInfo(T)) {
        .Pointer => true,
        .Array => |ar| hasPointer(ar.child),
        .Struct => |st| any: {
            inline for (st.fields) |field| {
                if (hasPointer(field.type)) {
                    break :any true;
                }
            }
            break :any false;
        },
        .Union => |un| any: {
            inline for (un.fields) |field| {
                if (hasPointer(field.type)) {
                    break :any true;
                }
            }
            break :any false;
        },
        else => false,
    };
}

test "hasPointer" {
    const A = struct {
        number: i32,
    };
    const B = struct {
        number: i32,
        a: A,
    };
    const C = struct {
        number: i32,
        a: A,
        pointer: [*]i32,
    };
    const D = union {
        a: A,
        c: C,
    };
    assert(hasPointer(u8) == false);
    assert(hasPointer(*u8) == true);
    assert(hasPointer([]u8) == true);
    assert(hasPointer(A) == false);
    assert(hasPointer(B) == false);
    assert(hasPointer(C) == true);
    assert(hasPointer(D) == true);
    assert(hasPointer([5]*u8) == true);
    assert(hasPointer([][]u8) == true);
}

fn rezigStructure(host: Host, obj: Value, ptr: anytype) !void {
    const T = @TypeOf(ptr.*);
    switch (@typeInfo(T)) {
        .Pointer => |pt| {
            // note: ptr is a pointer to a pointer
            if (try host.getPointerStatus(obj)) {
                return;
            }
            const child_obj = try host.readObjectSlot(obj, 0);
            const current_ptr = try host.getMemory(child_obj, pt.child, pt.size);
            if (!comparePointers(ptr.*, current_ptr)) {
                ptr.* = current_ptr;
            }
            if (hasPointer(pt.child)) {
                // rezig the target(s)
                if (pt.size == .One) {
                    try rezigStructure(host, child_obj, ptr.*);
                } else if (pt.size == .Many) {
                    for (ptr.*, 0..) |_, index| {
                        const element_obj = try host.readObjectSlot(child_obj, index);
                        try rezigStructure(host, element_obj, &(ptr.*[index]));
                    }
                }
            }
            try host.setPointerStatus(obj, true);
        },
        .Array => |ar| {
            if (hasPointer(ar.child)) {
                for (ptr.*, 0..) |_, index| {
                    const element_obj = try host.readObjectSlot(obj, index);
                    try rezigStructure(host, element_obj, &(ptr.*[index]));
                }
            }
        },
        .Struct => |st| {
            inline for (st.fields, 0..) |field, index| {
                if (hasPointer(field.type)) {
                    const slot = getObjectSlot(T, index);
                    const child_obj = try host.readObjectSlot(obj, slot);
                    try rezigStructure(host, child_obj, &@field(ptr.*, field.name));
                }
            }
        },
        else => {
            std.debug.print("Ignoring {s}\n", .{@typeName(T)});
        },
    }
}

fn dezigStructure(host: Host, obj: Value, ptr: anytype) !void {
    const T = @TypeOf(ptr.*);
    switch (@typeInfo(T)) {
        .Pointer => |pt| {
            if (!try host.getPointerStatus(obj)) {
                return;
            }
            // ptr is a pointer to a pointer
            const child_ptr = ptr.*;
            // pointer objects store their target in slot 0
            const child_obj = try obtainChildObject(host, obj, 0, child_ptr, true);
            if (hasPointer(pt.child)) {
                if (pt.size == .One) {
                    try dezigStructure(host, child_obj, child_ptr);
                } else if (pt.size == .Slice) {
                    for (ptr.*, 0..) |_, index| {
                        const element_ptr = &(ptr.*[index]);
                        const element_obj = try obtainChildObject(host, obj, @intCast(u32, index), element_ptr, false);
                        try dezigStructure(host, element_obj, element_ptr);
                    }
                }
            }
            try host.setPointerStatus(obj, false);
        },
        .Array => |ar| {
            if (hasPointer(ar.child)) {
                for (ptr.*, 0..) |_, index| {
                    const element_ptr = &(ptr.*[index]);
                    const element_obj = try obtainChildObject(host, obj, @intCast(u32, index), element_ptr, false);
                    try dezigStructure(host, element_obj, &(ptr.*[index]));
                }
            }
        },
        .Struct => |st| {
            inline for (st.fields, 0..) |field, index| {
                if (hasPointer(field.type)) {
                    const slot = getObjectSlot(T, index);
                    const child_ptr = &@field(ptr.*, field.name);
                    const child_obj = try obtainChildObject(host, obj, slot, child_ptr, false);
                    try dezigStructure(host, child_obj, child_ptr);
                }
            }
        },
        else => {
            std.debug.print("Ignoring {s}\n", .{@typeName(T)});
        },
    }
}

fn obtainChildObject(host: Host, container: Value, slot: u32, ptr: anytype, comptime check: bool) !Value {
    if (host.readObjectSlot(container, slot)) |child_obj| {
        if (check) {
            // see if pointer is still pointing to what it was before
            const pt = @typeInfo(@TypeOf(ptr)).Pointer;
            const current_ptr = try host.getMemory(child_obj, pt.child, pt.size);
            if (!comparePointers(ptr, current_ptr)) {
                // need to create JS wrapper object for new memory
                return createChildObject(host, container, slot, ptr);
            }
        }
        return child_obj;
    } else |_| {
        return createChildObject(host, container, slot, ptr);
    }
}

fn createChildObject(host: Host, container: Value, slot: u32, ptr: anytype) !Value {
    const pt = @typeInfo(@TypeOf(ptr)).Pointer;
    const memory = toMemory(ptr);
    const child_obj = try host.wrapMemory(memory, pt.child, pt.size);
    try host.writeObjectSlot(container, slot, child_obj);
    return child_obj;
}

fn createThunk(comptime function: anytype, comptime ArgT: type) Thunk {
    const Args = std.meta.ArgsTuple(@TypeOf(function));
    const S = struct {
        fn tryFunction(host: Host, arg_obj: Value) !void {
            var arg_ptr = try host.getMemory(arg_obj, ArgT, .One);
            if (hasPointer(ArgT)) {
                // make sure pointers have up-to-date values
                try rezigStructure(host, arg_obj, arg_ptr);
            }
            // extract arguments from argument struct
            var args: Args = undefined;
            const fields = @typeInfo(Args).Struct.fields;
            comptime var index = 0;
            inline for (fields, 0..) |field, i| {
                if (field.type == std.mem.Allocator) {
                    // TODO: add allocator
                } else {
                    const name = std.fmt.comptimePrint("{d}", .{index});
                    args[i] = @field(arg_ptr.*, name);
                    index += 1;
                }
            }
            arg_ptr.*.retval = @call(std.builtin.CallModifier.auto, function, args);
            if (hasPointer(ArgT)) {
                try dezigStructure(host, arg_obj, arg_ptr);
            }
        }

        fn invokeFunction(host: Host, arg_obj: Value) callconv(.C) void {
            tryFunction(host, arg_obj) catch {};
        }
    };
    return S.invokeFunction;
}

test "createThunk" {
    const Test = struct {
        fn A(a: i32, b: bool) bool {
            return if (a > 10 and b) true else false;
        }
    };
    const ArgA = ArgumentStruct(Test.A);
    const thunk = createThunk(Test.A, ArgA);
    switch (@typeInfo(@TypeOf(thunk))) {
        .Pointer => |pt| {
            switch (@typeInfo(pt.child)) {
                .Fn => |f| {
                    assert(f.params.len == 2);
                    assert(f.calling_convention == .C);
                },
                else => {
                    assert(false);
                },
            }
        },
        else => {
            assert(false);
        },
    }
}

fn createRootFactory(comptime S: type) Thunk {
    const RootFactory = struct {
        fn exportStructure(host: Host, args: Value) callconv(.C) void {
            // TODO: use error union to return error to caller once that's implemented
            if (getStructure(host, S)) |result| {
                host.writeObjectSlot(args, 0, result) catch {};
            } else |err| {
                std.debug.print("Error: {s}\n", .{@errorName(err)});
            }
        }
    };
    return RootFactory.exportStructure;
}

pub const api_version = 1;

pub fn createModule(comptime S: type) Module {
    return .{
        .version = api_version,
        .flags = .{
            .little_endian = builtin.target.cpu.arch.endian() == .Little,
            .runtime_safety = switch (builtin.mode) {
                .Debug, .ReleaseSafe => true,
                else => false,
            },
        },
        .callbacks = &callbacks,
        .factory = createRootFactory(S),
    };
}

test "createModule" {
    const Test = struct {
        pub const a: i32 = 1;
        const b: i32 = 2;
        pub var c: bool = true;
        pub const d: f64 = 3.14;
        pub const e: [4]i32 = .{ 3, 4, 5, 6 };
        pub const f = enum { Dog, Cat, Chicken };
        pub const g = enum(c_int) { Dog = -100, Cat, Chicken };
        pub fn h(arg1: i32, arg2: i32) bool {
            return arg1 < arg2;
        }
    };
    const module = createModule(Test);
    assert(module.version == api_version);
    assert(module.flags.little_endian == (builtin.target.cpu.arch.endian() == .Little));
    switch (@typeInfo(@TypeOf(module.factory))) {
        .Pointer => |pt| {
            switch (@typeInfo(pt.child)) {
                .Fn => |f| {
                    assert(f.params.len == 2);
                    assert(f.calling_convention == .C);
                },
                else => {
                    assert(false);
                },
            }
        },
        else => {
            assert(false);
        },
    }
}
