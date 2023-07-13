const std = @import("std");
const builtin = @import("builtin");
const assert = std.debug.assert;

const isFreeStanding = builtin.target.os.tag == .freestanding;

// error type
const Error = error{
    TODO,
    Unknown,
    UnableToAllocateMemory,
    UnableToFreeMemory,
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
    UnableToCreateString,
    UnableToAddStructureTemplate,
    UnableToDefineStructure,
    PointerIsInvalid,
};

// slot allocators
const slot_allocator = struct {
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
const structure_slot = slot_allocator.get(.{});

fn getStructureSlot(comptime T: anytype, comptime size: std.builtin.Type.Pointer.Size) usize {
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

fn getObjectSlot(comptime T: anytype, comptime index: comptime_int) usize {
    // per-struct slot allocator
    const relocatable_slot = slot_allocator.get(.{ .Type = T });
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

fn getCString(comptime s: []const u8) [*:0]const u8 {
    comptime var cs: [s.len + 1]u8 = undefined;
    inline for (s, 0..) |c, index| {
        cs[index] = c;
    }
    cs[s.len] = 0;
    return @ptrCast(&cs);
}

test "getCString" {
    const cs = getCString("hello");
    assert(cs[0] == 'h');
    assert(cs[5] == 0);
}

// enums and external structs
pub const Result = enum(u32) {
    OK,
    Failure,
};

pub const StructureType = enum(u32) {
    Primitive = 0,
    Array,
    Struct,
    ExternUnion,
    BareUnion,
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

pub const MemberType = enum(u32) {
    Void = 0,
    Bool,
    Int,
    Float,
    EnumerationItem,
    Object,
    Type,
};

pub const Value = *opaque {};
pub const Thunk = *const fn (host: Host, args: Value) callconv(.C) ?[*:0]const u8;

pub const Structure = extern struct {
    name: ?[*:0]const u8 = null,
    structure_type: StructureType,
    total_size: usize = 0,
    has_pointer: bool,
};

pub const missing = std.math.maxInt(usize);

pub const Member = extern struct {
    name: ?[*:0]const u8 = null,
    member_type: MemberType,
    is_static: bool = false,
    is_required: bool = false,
    is_signed: bool = false,
    is_const: bool = true,
    bit_offset: usize = missing,
    bit_size: usize = missing,
    byte_size: usize = missing,
    slot: usize = missing,
    structure: ?Value = null,
};

pub const Memory = extern struct {
    bytes: ?[*]u8 = null,
    len: usize = 0,
};

pub const Template = extern struct {
    is_static: bool = false,
    object: Value,
};

pub const Method = extern struct {
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

pub const Module = extern struct {
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

fn IntType(comptime StartT: type, comptime n: comptime_int) type {
    var IT = StartT;
    while (!isInRangeOf(n, IT)) {
        IT = NextIntType(IT);
    }
    return IT;
}

test "IntType" {
    assert(IntType(i32, 0) == i32);
    assert(IntType(i32, 0xFFFFFFFF) == u32);
    assert(IntType(i32, -0xFFFFFFFF) == i64);
    assert(IntType(u8, 123) == u8);
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
    assert(hasPointer([5]*u8) == true);
    assert(hasPointer([][]u8) == true);
    assert(hasPointer(A) == false);
    assert(hasPointer(B) == false);
    assert(hasPointer(C) == true);
    assert(hasPointer(D) == true);
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
        .Union => |un| switch (un.layout) {
            .Extern => .ExternUnion,
            else => if (un.tag_type) |_| .TaggedUnion else .BareUnion,
        },
        .ErrorUnion => .ErrorUnion,
        .ErrorSet => .ErrorSet,
        .Optional => .Optional,
        .Enum => .Enumeration,
        .Array => .Array,
        .Opaque => .Opaque,
        .Pointer => .Pointer,
        else => @compileError("Unsupported type: " ++ @typeName(T)),
    };
}

test "getStructureType" {
    const Enum = enum { apple, banana };
    const TaggedUnion = union(Enum) {
        apple: i32,
        banana: i32,
    };
    assert(getStructureType(i32) == .Primitive);
    assert(getStructureType(Enum) == .Enumeration);
    assert(getStructureType(union {}) == .BareUnion);
    assert(getStructureType(TaggedUnion) == .TaggedUnion);
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
    return switch (size) {
        .One => @ptrCast(@alignCast(memory.bytes)),
        .Slice => slice: {
            const many_ptr: [*]T = @ptrCast(@alignCast(memory.bytes));
            const count = memory.len / @sizeOf(T);
            break :slice many_ptr[0..count];
        },
        .Many => @ptrCast(@alignCast(memory.bytes)),
        .C => @ptrCast(@alignCast(memory.bytes)),
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
        .Slice => @intFromPtr(pointer.ptr),
        else => @intFromPtr(pointer),
    };
    const len = switch (size) {
        .One => @sizeOf(CT),
        .Slice => @sizeOf(CT) * pointer.len,
        .Many, .C => 0,
    };
    return .{
        .bytes = @ptrFromInt(address),
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
    const h: [*]i32 = @ptrCast(e);
    const i: [*]i32 = @ptrCast(g);
    assert(comparePointers(h, i) == false);
    const j: [*c]i32 = @ptrCast(e);
    const k: [*c]i32 = @ptrCast(g);
    assert(comparePointers(j, k) == false);
}

// pointer table that's filled on the C++ side
const Callbacks = extern struct {
    allocate_memory: *const fn (Host, usize, *Memory) callconv(.C) Result,
    free_memory: *const fn (Host, *const Memory) callconv(.C) Result,
    get_memory: *const fn (Host, Value, *Memory) callconv(.C) Result,
    wrap_memory: *const fn (Host, Value, *const Memory, *Value) callconv(.C) Result,

    get_pointer_status: *const fn (Host, Value, *bool) callconv(.C) Result,
    set_pointer_status: *const fn (Host, Value, bool) callconv(.C) Result,

    read_global_slot: *const fn (Host, usize, *Value) callconv(.C) Result,
    write_global_slot: *const fn (Host, usize, ?Value) callconv(.C) Result,
    read_object_slot: *const fn (Host, Value, usize, *Value) callconv(.C) Result,
    write_object_slot: *const fn (Host, Value, usize, ?Value) callconv(.C) Result,

    begin_structure: *const fn (Host, *const Structure, *Value) callconv(.C) Result,
    attach_member: *const fn (Host, Value, *const Member) callconv(.C) Result,
    attach_method: *const fn (Host, Value, *const Method) callconv(.C) Result,
    attach_template: *const fn (Host, Value, *const Template) callconv(.C) Result,
    finalize_structure: *const fn (Host, Value) callconv(.C) Result,
    create_template: *const fn (Host, *const Memory, *Value) callconv(.C) Result,

    create_string: *const fn (Host, *const Memory, *Value) callconv(.C) Result,
    log_values: *const fn (Host, usize, [*]Value) callconv(.C) Result,
};
var callbacks: Callbacks = undefined;

// host interface
pub const Host = *opaque {
    fn allocateMemory(self: Host, size: usize) !Memory {
        var memory: Memory = undefined;
        if (callbacks.allocate_memory(self, size, &memory) != .OK) {
            return Error.UnableToAllocateMemory;
        }
        return memory;
    }

    fn freeMemory(self: Host, memory: Memory) !void {
        if (callbacks.free_memory(self, &memory) != .OK) {
            return Error.UnableToFreeMemory;
        }
    }

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

    fn readGlobalSlot(self: Host, slot: usize) !Value {
        var value: Value = undefined;
        if (callbacks.read_global_slot(self, slot, &value) != .OK) {
            return Error.UnableToFindObjectType;
        }
        return value;
    }

    fn writeGlobalSlot(self: Host, slot: usize, value: Value) !void {
        if (callbacks.write_global_slot(self, slot, value) != .OK) {
            return Error.UnableToSetObjectType;
        }
    }

    fn readObjectSlot(self: Host, container: Value, id: usize) !Value {
        var result: Value = undefined;
        if (callbacks.read_object_slot(self, container, id, &result) != .OK) {
            return Error.UnableToRetrieveObject;
        }
        return result;
    }

    fn writeObjectSlot(self: Host, container: Value, id: usize, value: ?Value) !void {
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

    fn createString(self: Host, message: []const u8) !Value {
        const memory: Memory = .{
            .bytes = @constCast(@ptrCast(message)),
            .len = message.len,
        };
        var value: Value = undefined;
        if (callbacks.create_string(self, &memory, &value) != .OK) {
            return Error.UnableToCreateString;
        }
        return value;
    }

    fn logValues(self: Host, args: anytype) !void {
        const fields = std.meta.fields(@TypeOf(args));
        var values: [fields.len]Value = undefined;
        inline for (fields, 0..) |field, index| {
            const v = @field(args, field.name);
            values[index] = switch (field.type) {
                Value => v,
                else => try self.createString(v),
            };
        }
        if (callbacks.log_values(self, values.len, @ptrCast(&values)) != .OK) {
            return Error.Unknown;
        }
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
            .has_pointer = hasPointer(T),
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
    return @ptrCast(name);
}

test "getStructureName" {
    const name = getStructureName([]u8);
    assert(name[0] == '*');
}

fn getUnionSelectorOffset(comptime TT: type, comptime fields: []const std.builtin.Type.UnionField) comptime_int {
    // selector comes first unless content needs larger align
    comptime var offset = 0;
    inline for (fields) |field| {
        if (@alignOf(field.type) > @alignOf(TT)) {
            const new_offset = @sizeOf(field.type) * 8;
            if (new_offset > offset) {
                offset = new_offset;
            }
        }
    }
    return offset;
}

test "getUnionSelectorOffset" {
    const Union = union {
        cat: i32,
        dog: i32,
    };
    assert(getUnionSelectorOffset(i16, @typeInfo(Union).Union.fields) == 32);
    assert(getUnionSelectorOffset(i64, @typeInfo(Union).Union.fields) == 0);
}

fn getUnionCurrentIndex(ptr: anytype) usize {
    const T = @TypeOf(ptr.*);
    const un = @typeInfo(T).Union;
    if (un.tag_type) |TT| {
        const value = @intFromEnum(ptr.*);
        inline for (@typeInfo(TT).Enum.fields, 0..) |field, index| {
            if (value == field.value) {
                return index;
            }
        }
    } else {
        const TT = IntType(u8, un.fields.len);
        const offset = getUnionSelectorOffset(TT, un.fields);
        const address = @intFromPtr(ptr) + offset / 8;
        const offset_ptr: *TT = @ptrFromInt(address);
        return offset_ptr.*;
    }
    return missing;
}

test "getUnionCurrentIndex" {
    const Union1 = union {
        cat: i32,
        dog: i32,
    };
    var union1: Union1 = .{ .dog = 1234 };
    assert(getUnionCurrentIndex(&union1) == 1);
    union1 = .{ .cat = 4567 };
    assert(getUnionCurrentIndex(&union1) == 0);
    const Enum = enum { cat, dog };
    const Union2 = union(Enum) {
        cat: i32,
        dog: i32,
    };
    var union2: Union2 = .{ .dog = 1234 };
    assert(getUnionCurrentIndex(&union2) == 1);
    union2 = .{ .cat = 4567 };
    assert(getUnionCurrentIndex(&union2) == 0);
    const Union3 = union {
        cat: bool,
        dog: bool,
    };
    var union3: Union3 = .{ .dog = true };
    assert(getUnionCurrentIndex(&union3) == 1);
    union3 = .{ .cat = true };
    assert(getUnionCurrentIndex(&union3) == 0);
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
                        .name = @ptrCast(@typeName(T)),
                        .structure_type = .Slice,
                        .total_size = @sizeOf(pt.child),
                        .has_pointer = hasPointer(pt.child),
                    };
                    const slice_structure = try host.beginStructure(slice_def);
                    try host.writeGlobalSlot(slice_slot, slice_structure);
                    try host.attachMember(slice_structure, .{
                        .member_type = getMemberType(pt.child),
                        .is_signed = isSigned(pt.child),
                        .is_const = pt.is_const,
                        .bit_size = @bitSizeOf(pt.child),
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
                .slot = 0,
            });
        },
        .Struct => |st| {
            // pre-allocate relocatable slots for fields that always need them
            inline for (st.fields, 0..) |field, index| {
                if (!field.is_comptime) {
                    switch (getMemberType(field.type)) {
                        .Object => _ = getObjectSlot(T, index),
                        else => {},
                    }
                }
            }
            inline for (st.fields, 0..) |field, index| {
                if (!field.is_comptime) {
                    try host.attachMember(structure, .{
                        .name = getCString(field.name),
                        .member_type = getMemberType(field.type),
                        .is_signed = isSigned(field.type),
                        .is_const = isConst(field.type),
                        .is_required = field.default_value == null,
                        .bit_offset = @bitOffsetOf(T, field.name),
                        .bit_size = @bitSizeOf(field.type),
                        .byte_size = if (isPacked(T)) missing else @sizeOf(field.type),
                        .slot = getObjectSlot(T, index),
                        .structure = try getStructure(host, field.type),
                    });
                }
            }
            if (!isArgumentStruct(T)) {
                try addDefaultValues(host, structure, T);
            }
        },
        .Union => |un| {
            inline for (un.fields, 0..) |field, index| {
                switch (getMemberType(field.type)) {
                    .Object => _ = getObjectSlot(T, index),
                    else => {},
                }
            }
            const TT = un.tag_type orelse IntType(u8, un.fields.len);
            const tag_offset = if (un.layout != .Extern) getUnionSelectorOffset(TT, un.fields) else missing;
            const value_offset = if (tag_offset == 0) @sizeOf(TT) * 8 else 0;
            inline for (un.fields, 0..) |field, index| {
                try host.attachMember(structure, .{
                    .name = getCString(field.name),
                    .member_type = getMemberType(field.type),
                    .is_signed = isSigned(field.type),
                    .is_const = isConst(field.type),
                    .bit_offset = value_offset,
                    .bit_size = @bitSizeOf(field.type),
                    .byte_size = if (isPacked(T)) missing else @sizeOf(field.type),
                    .slot = getObjectSlot(T, index),
                    .structure = try getStructure(host, field.type),
                });
            }
            if (tag_offset != missing) {
                try host.attachMember(structure, .{
                    .name = "selector",
                    .member_type = getMemberType(TT),
                    .is_signed = isSigned(TT),
                    .bit_offset = tag_offset,
                    .bit_size = @bitSizeOf(TT),
                    .byte_size = if (isPacked(T)) missing else @sizeOf(TT),
                    .structure = if (un.tag_type) |_| try getStructure(host, TT) else null,
                });
            }
        },
        .Enum => |en| {
            // find a type that fit all values
            const IT = EnumType(T);
            inline for (en.fields) |field| {
                try host.attachMember(structure, .{
                    .name = getCString(field.name),
                    .member_type = getMemberType(IT),
                    .is_signed = isSigned(IT),
                    .bit_size = @bitSizeOf(IT),
                    .byte_size = @sizeOf(IT),
                });
            }
        },
        .Optional => |op| {
            // value always comes first
            try host.attachMember(structure, .{
                .name = "value",
                .member_type = getMemberType(op.child),
                .is_signed = isSigned(op.child),
                .bit_offset = 0,
                .bit_size = @bitSizeOf(op.child),
                .byte_size = @sizeOf(op.child),
                .slot = 0,
                .structure = try getStructure(host, op.child),
            });
            const present_offset = switch (@typeInfo(op.child)) {
                // present overlaps value (i.e. null pointer means false)
                .Pointer => 0,
                else => @sizeOf(op.child) * 8,
            };
            const present_byte_size = switch (@typeInfo(op.child)) {
                // use pointer value as boolean
                .Pointer => @sizeOf(op.child),
                else => @sizeOf(bool),
            };
            try host.attachMember(structure, .{
                .name = "present",
                .member_type = .Bool,
                .bit_offset = present_offset,
                .bit_size = @bitSizeOf(bool),
                .byte_size = present_byte_size,
            });
        },
        .ErrorUnion => |eu| {
            // value is placed after the error number if its alignment is smaller than that of anyerror
            const error_offset = if (@alignOf(anyerror) > @alignOf(eu.payload)) 0 else @sizeOf(eu.payload) * 8;
            const value_offset = if (error_offset == 0) @sizeOf(anyerror) * 8 else 0;
            try host.attachMember(structure, .{
                .name = "value",
                .member_type = getMemberType(eu.payload),
                .is_signed = isSigned(eu.payload),
                .bit_offset = value_offset,
                .bit_size = @bitSizeOf(eu.payload),
                .byte_size = @sizeOf(eu.payload),
                .slot = 0,
                .structure = try getStructure(host, eu.payload),
            });
            try host.attachMember(structure, .{
                .name = "error",
                .member_type = .Int,
                .is_signed = false,
                .bit_offset = error_offset,
                .bit_size = @bitSizeOf(anyerror),
                .byte_size = @sizeOf(anyerror),
                .structure = try getStructure(host, eu.error_set),
            });
        },
        .ErrorSet => |es| {
            if (es) |errors| {
                inline for (errors) |err_rec| {
                    // get error from global set
                    const err = @field(anyerror, err_rec.name);
                    try host.attachMember(structure, .{
                        .name = getCString(err_rec.name),
                        .member_type = .Object,
                        .slot = @intFromError(err),
                    });
                }
            }
        },
        else => {
            if (!isFreeStanding) {
                std.debug.print("Missing: {s}\n", .{@typeName(T)});
            }
        },
    }
}

fn addDefaultValues(host: Host, structure: Value, comptime T: type) !void {
    // default data
    const fields = std.meta.fields(T);
    var values: T = undefined;
    var bytes: []u8 = @as([*]u8, @alignCast(@ptrCast(&values)))[0..@sizeOf(T)];
    for (bytes) |*byte_ptr| {
        byte_ptr.* = 0;
    }
    inline for (fields) |field| {
        if (field.default_value) |opaque_ptr| {
            // set default value
            const typed_ptr: *const field.type = @ptrCast(@alignCast(opaque_ptr));
            @field(values, field.name) = typed_ptr.*;
        }
    }
    const has_data = check_data: {
        for (bytes) |byte| {
            if (byte != 0) {
                break :check_data true;
            }
        }
        break :check_data false;
    };
    if (has_data) {
        const template = try host.createTemplate(bytes);
        try dezigStructure(host, template, &values);
        return host.attachTemplate(structure, .{
            .is_static = false,
            .object = template,
        });
    }
}

fn getPointerType(comptime T: type, comptime name: []const u8) type {
    // get the pointer type (where possible)
    return switch (@typeInfo(@TypeOf(@field(T, name)))) {
        .Fn, .Frame, .AnyFrame, .NoReturn => void,
        .Type => type,
        .ComptimeInt => *const IntType(i32, @field(T, name)),
        .ComptimeFloat => *const f64,
        else => @TypeOf(&@field(T, name)),
    };
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
        // get the pointer type (where possible)
        const PT = getPointerType(T, decl.name);
        if (PT == void) {
            continue;
        } else if (PT == type) {
            try host.attachMember(structure, .{
                .name = getCString(decl.name),
                .member_type = .Type,
                .is_static = true,
                .slot = getObjectSlot(S, index),
                .structure = try getStructure(host, @field(T, decl.name)),
            });
        } else {
            const slot = getObjectSlot(S, index);
            try host.attachMember(structure, .{
                .name = getCString(decl.name),
                .member_type = .Object,
                .is_static = true,
                .is_const = isConst(PT),
                .slot = slot,
                .structure = try getStructure(host, PT),
            });
            // get address to variable
            var typed_ptr = switch (@typeInfo(@TypeOf(@field(T, decl.name)))) {
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
                .bytes = @ptrCast(&typed_ptr),
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
                    .name = getCString(decl.name),
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
    for (info.params) |param| {
        if (param.type != std.mem.Allocator) {
            const name = std.fmt.comptimePrint("{d}", .{count});
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
    const prefix = "exporter.ArgumentStruct((function '";
    if (name.len < prefix.len) {
        return null;
    }
    inline for (prefix, 0..) |c, index| {
        if (name[index] != c) {
            return null;
        }
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
                    for (ptr.*, 0..) |*element_ptr, index| {
                        const element_obj = try host.readObjectSlot(child_obj, index);
                        try rezigStructure(host, element_obj, element_ptr);
                    }
                }
            }
            try host.setPointerStatus(obj, true);
        },
        .Array => |ar| {
            if (hasPointer(ar.child)) {
                for (ptr, 0..) |*element_ptr, index| {
                    const element_obj = try host.readObjectSlot(obj, index);
                    try rezigStructure(host, element_obj, element_ptr);
                }
            }
        },
        .Struct => |st| {
            inline for (st.fields, 0..) |field, index| {
                if (hasPointer(field.type)) {
                    const slot = getObjectSlot(T, index);
                    const child_obj = try host.readObjectSlot(obj, slot);
                    // FIXME: this is broken, since there can be pointers inside the structure
                    // should initialize the pointer as being owned by Zig already on JS side
                    if (isArgumentStruct(T) and index == st.fields.len - 1) {
                        // retval is not going to be pointing to anything--just set ownership
                        try host.setPointerStatus(child_obj, true);
                    } else {
                        try rezigStructure(host, child_obj, &@field(ptr.*, field.name));
                    }
                }
            }
        },
        .Union => |un| {
            if (un.layout == .Extern) {
                return;
            }
            inline for (un.fields, 0..) |field, index| {
                if (hasPointer(field.type)) {
                    const current_index = getUnionCurrentIndex(ptr);
                    if (index == current_index) {
                        const slot = getObjectSlot(T, index);
                        const child_obj = try host.readObjectSlot(obj, slot);
                        try rezigStructure(host, child_obj, &@field(ptr.*, field.name));
                    }
                }
            }
        },
        .Optional => {
            if (ptr.*) |*child_ptr| {
                const child_obj = try host.readObjectSlot(obj, 0);
                try rezigStructure(host, child_obj, child_ptr);
            }
        },
        .ErrorUnion => {
            if (ptr.*) |*child_ptr| {
                const child_obj = try host.readObjectSlot(obj, 0);
                try rezigStructure(host, child_obj, child_ptr);
            } else |_| {}
        },
        else => {
            if (!isFreeStanding) {
                std.debug.print("Ignoring {s}\n", .{@typeName(T)});
            }
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
            // pointer objects store their target in slot 0
            const child_obj = try obtainChildObject(host, obj, 0, ptr.*, true);
            if (hasPointer(pt.child)) {
                if (pt.size == .One) {
                    try dezigStructure(host, child_obj, ptr.*);
                } else if (pt.size == .Slice) {
                    for (ptr.*, 0..) |*element_ptr, index| {
                        const element_obj = try obtainChildObject(host, obj, index, element_ptr, false);
                        try dezigStructure(host, element_obj, element_ptr);
                    }
                }
            }
            try host.setPointerStatus(obj, false);
        },
        .Array => |ar| {
            if (hasPointer(ar.child)) {
                for (ptr, 0..) |*element_ptr, index| {
                    const element_obj = try obtainChildObject(host, obj, index, element_ptr, false);
                    try dezigStructure(host, element_obj, element_ptr);
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
        .Union => |un| {
            if (un.layout == .Extern) {
                return;
            }
            inline for (un.fields, 0..) |field, index| {
                if (hasPointer(field.type)) {
                    const current_index = getUnionCurrentIndex(ptr);
                    if (index == current_index) {
                        const slot = getObjectSlot(T, index);
                        const child_ptr = &@field(ptr.*, field.name);
                        const child_obj = try obtainChildObject(host, obj, slot, child_ptr, false);
                        try dezigStructure(host, child_obj, child_ptr);
                    }
                }
            }
        },
        .Optional => {
            if (ptr.*) |*child_ptr| {
                const child_obj = try host.readObjectSlot(obj, 0);
                try dezigStructure(host, child_obj, child_ptr);
            }
        },
        .ErrorUnion => {
            if (ptr.*) |*child_ptr| {
                const child_obj = try host.readObjectSlot(obj, 0);
                try dezigStructure(host, child_obj, child_ptr);
            } else |_| {}
        },
        else => {
            if (!isFreeStanding) {
                std.debug.print("Ignoring {s}\n", .{@typeName(T)});
            }
        },
    }
}

fn obtainChildObject(host: Host, container: Value, slot: usize, ptr: anytype, comptime check: bool) !Value {
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

fn createChildObject(host: Host, container: Value, slot: usize, ptr: anytype) !Value {
    const pt = @typeInfo(@TypeOf(ptr)).Pointer;
    const memory = toMemory(ptr);
    const child_obj = try host.wrapMemory(memory, pt.child, pt.size);
    try host.writeObjectSlot(container, slot, child_obj);
    return child_obj;
}

fn createAllocator(host: Host) std.mem.Allocator {
    const VTable = struct {
        fn alloc(p: *anyopaque, size: usize, _: u8, _: usize) ?[*]u8 {
            const h: Host = @ptrCast(p);
            return if (h.allocateMemory(size)) |m| m.bytes else |_| null;
        }

        fn resize(_: *anyopaque, _: []u8, _: u8, _: usize, _: usize) bool {
            return false;
        }

        fn free(p: *anyopaque, bytes: []u8, _: u8, _: usize) void {
            const h: Host = @ptrCast(p);
            h.freeMemory(.{
                .bytes = @ptrCast(bytes.ptr),
                .len = bytes.len,
            }) catch {};
        }

        const instance: std.mem.Allocator.VTable = .{
            .alloc = alloc,
            .resize = resize,
            .free = free,
        };
    };
    return .{
        .ptr = @ptrCast(host),
        .vtable = &VTable.instance,
    };
}

fn getErrorMessage(err: anyerror) [*:0]const u8 {
    return @ptrCast(@errorName(err));
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
                    args[i] = createAllocator(host);
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

        fn invokeFunction(host: Host, arg_obj: Value) callconv(.C) ?[*:0]const u8 {
            tryFunction(host, arg_obj) catch |err| {
                return getErrorMessage(err);
            };
            return null;
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
        fn exportStructure(host: Host, args: Value) callconv(.C) ?[*:0]const u8 {
            var result = getStructure(host, S) catch |err| {
                return getErrorMessage(err);
            };
            host.writeObjectSlot(args, 0, result) catch |err| {
                return getErrorMessage(err);
            };
            return null;
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

fn getFunctionCount(comptime S: type) comptime_int {
    const decls = switch (@typeInfo(S)) {
        .Struct => |st| st.decls,
        .Union => |un| un.decls,
        .Enum => |en| en.decls,
        .Opaque => |op| op.decls,
        else => return 0,
    };
    comptime var count = 0;
    inline for (decls) |decl| {
        if (decl.is_pub) {
            switch (@typeInfo(@TypeOf(@field(S, decl.name)))) {
                .Type => count += getFunctionCount(@field(S, decl.name)),
                .Fn => count += 1,
                else => {},
            }
        }
    }
    return count;
}

test "getFunctionCount" {
    const Test = struct {
        pub fn functionA() void {}
        pub fn functionB() void {}
        fn functionC() void {}

        pub const Test2 = struct {
            pub fn functionD() void {}
            pub fn functionE() void {}
        };
    };
    const count = getFunctionCount(Test);
    assert(count == 4);
}

fn getFunctionThunks(comptime S: type) [getFunctionCount(S)]Thunk {
    const decls = switch (@typeInfo(S)) {
        .Struct => |st| st.decls,
        .Union => |un| un.decls,
        .Enum => |en| en.decls,
        .Opaque => |op| op.decls,
        else => return .{},
    };
    comptime var thunks: [getFunctionCount(S)]Thunk = undefined;
    comptime var index = 0;
    inline for (decls) |decl| {
        if (decl.is_pub) {
            switch (@typeInfo(@TypeOf(@field(S, decl.name)))) {
                .Type => {
                    for (getFunctionThunks(@field(S, decl.name))) |thunk| {
                        thunks[index] = thunk;
                        index += 1;
                    }
                },
                .Fn => {
                    const function = @field(S, decl.name);
                    const ArgT = ArgumentStruct(function);
                    thunks[index] = createThunk(function, ArgT);
                    index += 1;
                },
                else => {},
            }
        }
    }
    return thunks;
}

test "getFunctionThunks" {
    const Test = struct {
        pub fn functionA() void {}
        pub fn functionB() void {}
        fn functionC() void {}

        pub const Test2 = struct {
            pub fn functionD() void {}
            pub fn functionE() void {}
        };
    };
    const thunks = comptime getFunctionThunks(Test);
    assert(thunks.len == 4);
}

fn getVariableCount(comptime S: type) comptime_int {
    const decls = switch (@typeInfo(S)) {
        .Struct => |st| st.decls,
        .Union => |un| un.decls,
        .Enum => |en| en.decls,
        .Opaque => |op| op.decls,
        else => return 0,
    };
    comptime var count = 0;
    inline for (decls) |decl| {
        if (decl.is_pub) {
            const PT = getPointerType(S, decl.name);
            if (PT == type) {
                count += getVariableCount(@field(S, decl.name));
            } else if (PT != void) {
                if (!@typeInfo(PT).Pointer.is_const) {
                    count += 1;
                }
            }
        }
    }
    return count;
}

test "getVariableCount" {
    const Test = struct {
        pub var varA: i32 = 0;
        pub var varB: i32 = 0;
        var varC: i32 = 0;
        pub const varD: i32 = 0;

        pub const Test2 = struct {
            pub var varE: i32 = 0;
            pub const varF: i32 = 0;
        };
    };
    const count = comptime getVariableCount(Test);
    std.debug.print("\nCount: {d}\n", .{count});
    assert(count == 3);
}
