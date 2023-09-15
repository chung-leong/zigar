const std = @import("std");
const builtin = @import("builtin");
const assert = std.debug.assert;

const runtime_safety = (builtin.mode == .ReleaseSafe or builtin.mode == .Debug);

// error type
pub const Error = error{
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

pub fn getStructureSlot(comptime T: anytype, comptime size: std.builtin.Type.Pointer.Size) usize {
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
pub const StructureType = enum(u32) {
    Primitive = 0,
    Array,
    Struct,
    ArgStruct,
    ExternUnion,
    BareUnion,
    TaggedUnion,
    ErrorUnion,
    ErrorSet,
    Enumeration,
    Optional,
    Pointer,
    Slice,
    Vector,
    Opaque,
    Function,
};

pub const MemberType = enum(u32) {
    Void = 0,
    Bool,
    Int,
    Uint,
    Float,
    EnumerationItem,
    Object,
    Type,
    Comptime,
};

pub const Value = *opaque {};
pub const Thunk = *const fn (ptr: *anyopaque, args: Value) callconv(.C) ?[*:0]const u8;

pub const Structure = extern struct {
    name: ?[*:0]const u8 = null,
    structure_type: StructureType,
    total_size: usize,
    ptr_align: u8,
    is_const: bool = false,
    has_pointer: bool,
};

pub const missing = std.math.maxInt(usize);

pub const Member = extern struct {
    name: ?[*:0]const u8 = null,
    member_type: MemberType,
    is_required: bool = false,
    bit_offset: usize = missing,
    bit_size: usize = missing,
    byte_size: usize = missing,
    slot: usize = missing,
    structure: ?Value,
};

pub const Memory = extern struct {
    bytes: ?[*]u8 = null,
    len: usize = 0,
};

pub const MemoryDisposition = enum(u32) {
    Auto,
    Copy,
    Link,
};

pub const MemoryAttributes = packed struct {
    ptr_align: u8,
    is_const: bool,
    _: u23 = 0,
};

pub const MethodAttributes = packed struct {
    has_pointer: bool,
    _: u31 = 0,
};

pub const Method = extern struct {
    name: ?[*:0]const u8 = null,
    thunk: Thunk,
    structure: Value,
    attributes: MethodAttributes,
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
                if (!field.is_comptime and hasPointer(field.type)) {
                    break :any true;
                }
            }
            break :any false;
        },
        .Union => |un| any: {
            // pointer in untagged union are not exportable
            if (un.tag_type) |_| {
                inline for (un.fields) |field| {
                    if (hasPointer(field.type)) {
                        break :any true;
                    }
                }
            }
            break :any false;
        },
        .Optional => |op| hasPointer(op.child),
        .ErrorUnion => |eu| hasPointer(eu.payload),
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
    const E = struct {
        number: i32,
        comptime pointer: ?*u32 = null,
    };
    assert(hasPointer(u8) == false);
    assert(hasPointer(*u8) == true);
    assert(hasPointer([]u8) == true);
    assert(hasPointer([5]*u8) == true);
    assert(hasPointer([][]u8) == true);
    assert(hasPointer(A) == false);
    assert(hasPointer(B) == false);
    assert(hasPointer(C) == true);
    // pointers in union are inaccessible
    assert(hasPointer(D) == false);
    // comptime fields should be ignored
    assert(hasPointer(E) == false);
}

fn hasPointerArguments(comptime ArgT: type) bool {
    const st = @typeInfo(ArgT).Struct;
    inline for (st.fields, 0..) |field, index| {
        if (index != st.fields.len - 1 and hasPointer(field.type)) {
            return true;
        }
    }
    return false;
}

test "hasPointerArguments" {
    const ArgA = struct {
        @"0": u32,
        @"1": u32,
        retval: u32,
    };
    const ArgB = struct {
        @"0": *u32,
        @"1": u32,
        retval: u32,
    };
    const ArgC = struct {
        @"0": u32,
        @"1": u32,
        retval: []u32,
    };
    assert(hasPointerArguments(ArgA) == false);
    assert(hasPointerArguments(ArgB) == true);
    assert(hasPointerArguments(ArgC) == false);
}

fn getMemberType(comptime T: type) MemberType {
    return switch (@typeInfo(T)) {
        .Bool => .Bool,
        .Int => |int| if (int.signedness == .signed) .Int else .Uint,
        .Float => .Float,
        .Enum => .EnumerationItem,
        .Struct, .Union, .Array, .ErrorUnion, .Optional, .Pointer, .Vector => .Object,
        .Type => .Type,
        else => .Void,
    };
}

test "getMemberType" {
    assert(getMemberType(u32) == .Int);
    assert(getMemberType(*u32) == .Object);
    assert(getMemberType(type) == .Type);
}

fn isSupported(comptime T: type) bool {
    return switch (@typeInfo(T)) {
        .Type, .Bool, .Int, .ComptimeInt, .Float, .ComptimeFloat, .Void, .ErrorSet, .Enum, .Opaque, .Vector => true,
        .Struct => |st| check_fields: {
            inline for (st.fields) |field| {
                if (!isSupported(field.type)) {
                    break :check_fields false;
                }
            }
            break :check_fields true;
        },
        .Union => |un| check_fields: {
            inline for (un.fields) |field| {
                if (!isSupported(field.type)) {
                    break :check_fields false;
                }
            }
            break :check_fields true;
        },
        .ErrorUnion => |eu| isSupported(eu.payload),
        .Optional => |op| isSupported(op.child),
        .Array => |ar| isSupported(ar.child),
        .Pointer => |pt| isSupported(pt.child),
        else => false,
    };
}

test "isSupported" {
    const StructA = struct {
        number: i32,
        string: []const u8,
    };
    const StructB = struct {
        thunk: Thunk,
    };
    assert(isSupported(StructA) == true);
    assert(isSupported(StructB) == false);
    assert(isSupported(Thunk) == false);
    assert(isSupported(*StructA) == true);
    assert(isSupported(*StructB) == false);
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
        .Vector => .Vector,
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

pub fn fromMemory(memory: Memory, comptime PtrT: type) PtrT {
    const pt = @typeInfo(PtrT).Pointer;
    return switch (pt.size) {
        .One => @ptrCast(@alignCast(memory.bytes)),
        .Slice => slice: {
            if (memory.bytes == null) {
                break :slice &.{};
            }
            const count = memory.len / @sizeOf(pt.child);
            const many_ptr: [*]pt.child = @ptrCast(@alignCast(memory.bytes));
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
    const p1 = fromMemory(memory, *u8);
    assert(p1.* == 'H');
    assert(@typeInfo(@TypeOf(p1)).Pointer.size == .One);
    const p2 = fromMemory(memory, []u8);
    assert(p2[0] == 'H');
    assert(p2.len == 5);
    assert(@typeInfo(@TypeOf(p2)).Pointer.size == .Slice);
    const p3 = fromMemory(memory, [*]u8);
    assert(p3[0] == 'H');
    assert(@typeInfo(@TypeOf(p3)).Pointer.size == .Many);
    const p4 = fromMemory(memory, [*c]u8);
    assert(p4[0] == 'H');
    assert(@typeInfo(@TypeOf(p4)).Pointer.size == .C);
}

pub fn toMemory(pointer: anytype) Memory {
    const PtrT = @TypeOf(pointer);
    const pt = @typeInfo(PtrT).Pointer;
    const address = switch (pt.size) {
        .Slice => @intFromPtr(pointer.ptr),
        else => @intFromPtr(pointer),
    };
    const len = switch (pt.size) {
        .One => @sizeOf(pt.child),
        .Slice => @sizeOf(pt.child) * pointer.len,
        .Many => if (getSentinel(PtrT)) |sentinel| find: {
            var len: usize = 0;
            while (pointer[len] != sentinel) {
                len += 1;
            }
            break :find (len + 1) * @sizeOf(pt.child);
        } else 0,
        .C => 0,
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
    const f: [*:0]const u8 = "Hello";
    const memF = toMemory(f);
    assert(memA.len == 4);
    assert(memB.len == 5);
    assert(memC.len == 0);
    assert(memD.len == 0);
    assert(memE.len == @sizeOf(@TypeOf(b)));
    assert(memF.len == 6);
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

fn getPtrAlign(comptime T: type) u8 {
    const alignment = @alignOf(T);
    return if (alignment != 0) std.math.log2_int(u8, @alignOf(T)) else 0;
}

test "getPtrAlign" {
    assert(getPtrAlign(u8) == 0);
    assert(getPtrAlign(i32) == 2);
    assert(getPtrAlign(i64) == 3);
    assert(getPtrAlign(f128) == 4);
}

// NOTE: error type has to be specified here since the function is called recursively
// and https://github.com/ziglang/zig/issues/2971 has not been fully resolved yet
fn getStructure(host: anytype, comptime T: type) Error!Value {
    const s_slot = getStructureSlot(T, .One);
    return host.readGlobalSlot(s_slot) catch undefined: {
        const def: Structure = .{
            .name = getStructureName(T),
            .structure_type = getStructureType(T),
            .total_size = @sizeOf(T),
            .ptr_align = getPtrAlign(T),
            .is_const = isConst(T),
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
    // name a structure after the function if it's an ArgStruct
    const name = comptime getFunctionName(T) orelse @typeName(T);
    return getCString(name);
}

test "getStructureName" {
    const S = struct {
        fn hello(number: i32) i32 {
            return number + 2;
        }
    };
    const name1 = getStructureName([]u8);
    assert(name1[0] == '[');
    assert(name1[1] == ']');
    assert(name1[4] == 0);
    const ArgT = ArgumentStruct(S.hello);
    const name2 = getStructureName(ArgT);
    assert(name2[0] == 'h');
    assert(name2[1] == 'e');
    assert(name2[5] == 0);
}

fn getSliceName(comptime T: type) [*:0]const u8 {
    const ptr_name = @typeName(T);
    switch (@typeInfo(T).Pointer.size) {
        .Slice => {
            comptime var array: [ptr_name.len + 2]u8 = undefined;
            comptime var index = 0;
            comptime var underscore_inserted = false;
            inline for (ptr_name) |c| {
                array[index] = c;
                index += 1;
                if (c == '[' and !underscore_inserted) {
                    array[index] = '_';
                    index += 1;
                    underscore_inserted = true;
                }
            }
            array[index] = 0;
            return getCString(array[0..index]);
        },
        .Many => {
            comptime var array: [ptr_name.len + 1]u8 = undefined;
            comptime var asterisk_replaced = false;
            const replacement = if (@typeInfo(T).Pointer.sentinel) |_| '_' else '0';
            inline for (ptr_name, 0..) |c, index| {
                if (c == '*' and !asterisk_replaced) {
                    array[index] = replacement;
                    asterisk_replaced = true;
                } else {
                    array[index] = c;
                }
            }
            array[ptr_name.len] = 0;
            return getCString(array[0..ptr_name.len]);
        },
        else => @compileError("Unexpected pointer type: " ++ @typeName(T)),
    }
}

test "getSliceName" {
    const name1 = getSliceName([]const u8);
    assert(name1[0] == '[');
    assert(name1[1] == '_');
    assert(name1[2] == ']');
    assert(name1[11] == 0);
    const name2 = getSliceName([:0]const u8);
    assert(name2[0] == '[');
    assert(name2[1] == '_');
    assert(name2[2] == ':');
    assert(name2[3] == '0');
    assert(name2[4] == ']');
    assert(name2[13] == 0);
    const name3 = getSliceName([][4]u8);
    assert(name3[0] == '[');
    assert(name3[1] == '_');
    assert(name3[2] == ']');
    assert(name3[3] == '[');
    assert(name3[4] == '4');
    assert(name3[5] == ']');
    assert(name3[8] == 0);
    const name4 = getSliceName([*:0]const u8);
    assert(name4[0] == '[');
    assert(name4[1] == '_');
    assert(name4[2] == ':');
    assert(name4[3] == '0');
    assert(name4[4] == ']');
    assert(name4[13] == 0);
    const name5 = getSliceName([*]const u8);
    assert(name5[0] == '[');
    assert(name5[1] == '0');
    assert(name5[2] == ']');
    assert(name5[11] == 0);
}

fn getSentinel(comptime T: type) ?@typeInfo(T).Pointer.child {
    if (@typeInfo(T).Pointer.sentinel) |ptr| {
        const sentinel_ptr: *const @typeInfo(T).Pointer.child = @alignCast(@ptrCast(ptr));
        return sentinel_ptr.*;
    } else {
        return null;
    }
}

test "getSentinel" {
    const sentinel1 = getSentinel([*:0]const u8);
    assert(sentinel1 == 0);
    const sentinel2 = getSentinel([*:7]const i32);
    assert(sentinel2 == 7);
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

fn addMembers(host: anytype, structure: Value, comptime T: type) !void {
    return switch (@typeInfo(T)) {
        .Bool, .Int, .Float, .Void => addPrimitiveMember(host, structure, T),
        .Array => addArrayMember(host, structure, T),
        .Pointer => addPointerMember(host, structure, T),
        .Struct => addStructMember(host, structure, T),
        .Union => addUnionMember(host, structure, T),
        .Enum => addEnumMember(host, structure, T),
        .Optional => addOptionalMember(host, structure, T),
        .ErrorUnion => addErrorUnionMember(host, structure, T),
        .ErrorSet => addErrorSetMember(host, structure, T),
        .Vector => addVectorMember(host, structure, T),
        else => void{},
    };
}

fn addPrimitiveMember(host: anytype, structure: Value, comptime T: type) !void {
    try host.attachMember(structure, .{
        .member_type = getMemberType(T),
        .bit_size = @bitSizeOf(T),
        .bit_offset = 0,
        .byte_size = @sizeOf(T),
        .structure = try getStructure(host, T),
    }, false);
}

fn addArrayMember(host: anytype, structure: Value, comptime T: type) !void {
    const ar = @typeInfo(T).Array;
    try host.attachMember(structure, .{
        .member_type = getMemberType(ar.child),
        .bit_size = @bitSizeOf(ar.child),
        .byte_size = @sizeOf(ar.child),
        .structure = try getStructure(host, ar.child),
    }, false);
}

fn addVectorMember(host: anytype, structure: Value, comptime T: type) !void {
    const ve = @typeInfo(T).Vector;
    try host.attachMember(structure, .{
        .member_type = getMemberType(ve.child),
        .bit_size = @bitSizeOf(ve.child),
        .byte_size = @sizeOf(ve.child),
        .structure = try getStructure(host, ve.child),
    }, false);
}

fn addPointerMember(host: anytype, structure: Value, comptime T: type) !void {
    const pt = @typeInfo(T).Pointer;
    const child_structure = try getStructure(host, pt.child);
    const target_structure = switch (pt.size) {
        .One => child_structure,
        else => slice: {
            const slice_slot = getStructureSlot(pt.child, pt.size);
            const slice_def: Structure = .{
                .name = getSliceName(T),
                .structure_type = .Slice,
                .total_size = @sizeOf(pt.child),
                .ptr_align = getPtrAlign(pt.child),
                .has_pointer = hasPointer(pt.child),
            };
            const slice_structure = try host.beginStructure(slice_def);
            try host.writeGlobalSlot(slice_slot, slice_structure);
            try host.attachMember(slice_structure, .{
                .member_type = getMemberType(pt.child),
                .bit_size = @bitSizeOf(pt.child),
                .byte_size = @sizeOf(pt.child),
                .structure = child_structure,
            }, false);
            if (getSentinel(T)) |sentinel| {
                try host.attachMember(slice_structure, .{
                    .name = "sentinel",
                    .member_type = getMemberType(pt.child),
                    .bit_offset = 0,
                    .bit_size = @bitSizeOf(pt.child),
                    .byte_size = @sizeOf(pt.child),
                    .structure = child_structure,
                }, false);
                var bytes: []u8 = @constCast(std.mem.asBytes(&sentinel));
                const template = try host.createTemplate(bytes);
                try host.attachTemplate(slice_structure, template, false);
            }
            try host.finalizeStructure(slice_structure);
            break :slice slice_structure;
        },
    };
    try host.attachMember(structure, .{
        .member_type = getMemberType(T),
        .bit_size = @bitSizeOf(T),
        .byte_size = @sizeOf(T),
        .slot = 0,
        .structure = target_structure,
    }, false);
}

fn addStructMember(host: anytype, structure: Value, comptime T: type) !void {
    const st = @typeInfo(T).Struct;
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
                .is_required = field.default_value == null,
                .bit_offset = @bitOffsetOf(T, field.name),
                .bit_size = @bitSizeOf(field.type),
                .byte_size = if (isPacked(T)) missing else @sizeOf(field.type),
                .slot = getObjectSlot(T, index),
                .structure = try getStructure(host, field.type),
            }, false);
        } else if (field.default_value) |opaque_ptr| {
            if (field.type == type) {
                // place the type directly into the member
                const MT = @as(*const type, @ptrCast(@alignCast(opaque_ptr))).*;
                try host.attachMember(structure, .{
                    .name = getCString(field.name),
                    .member_type = MemberType.Type,
                    .structure = try getStructure(host, MT),
                }, false);
            } else {
                // retrieve values from pointer objects in the template's slots
                const default_value_ptr: *const field.type = @ptrCast(@alignCast(opaque_ptr));
                const VT = RuntimeType(default_value_ptr.*);
                try host.attachMember(structure, .{
                    .name = getCString(field.name),
                    .member_type = MemberType.Comptime,
                    .slot = getObjectSlot(T, index),
                    .structure = try getStructure(host, *const VT),
                }, false);
            }
        }
    }
    if (!isArgumentStruct(T)) {
        // obtain byte array containing data of default values
        // for some reason Zig sometimes would refuse to allow a var with
        // comptime fields--strip them out just so we can compile
        var values: WithoutComptimeFields(T) = undefined;
        var bytes: []u8 = @constCast(std.mem.asBytes(&values));
        for (bytes) |*byte_ptr| {
            byte_ptr.* = 0;
        }
        inline for (st.fields) |field| {
            if (field.default_value) |opaque_ptr| {
                const typed_ptr: *const field.type = @ptrCast(@alignCast(opaque_ptr));
                if (!field.is_comptime) {
                    // set default value
                    @field(values, field.name) = typed_ptr.*;
                }
            }
        }
        const template = try host.createTemplate(bytes);
        // dezig members that has (or are) pointers
        inline for (st.fields, 0..) |field, index| {
            if (field.default_value) |opaque_ptr| {
                if (!field.is_comptime) {
                    if (hasPointer(field.type)) {
                        const slot = getObjectSlot(T, index);
                        const child_ptr = &@field(values, field.name);
                        const child_obj = try obtainChildObject(host, template, slot, child_ptr, false);
                        try dezigStructure(host, child_obj, child_ptr);
                    }
                } else if (field.type != type) {
                    // comptime members are pointer objects
                    const default_value_ptr: *const field.type = @ptrCast(@alignCast(opaque_ptr));
                    // copy the value
                    const VT = RuntimeType(default_value_ptr.*);
                    const value: VT = default_value_ptr.*;
                    const value_ptr = &value;
                    const ptr_memory: Memory = .{
                        .bytes = @ptrCast(@constCast(&value_ptr)),
                        .len = @sizeOf(@TypeOf(value_ptr)),
                    };
                    const ptr_obj = try host.wrapMemory(ptr_memory, .Copy, @TypeOf(value_ptr), .One);
                    // dezig it, creating SharedArrayBuffer or ArrayBuffer
                    try dezigStructure(host, ptr_obj, &value_ptr);
                    // place the pointer into the member's slot in the template
                    const slot = getObjectSlot(T, index);
                    try host.writeObjectSlot(template, slot, ptr_obj);
                }
            }
        }
        try host.attachTemplate(structure, template, false);
    }
}

fn addUnionMember(host: anytype, structure: Value, comptime T: type) !void {
    const un = @typeInfo(T).Union;
    inline for (un.fields, 0..) |field, index| {
        switch (getMemberType(field.type)) {
            .Object => _ = getObjectSlot(T, index),
            else => {},
        }
    }
    const TT = un.tag_type orelse IntType(u8, un.fields.len);
    const has_selector = if (un.tag_type) |_|
        true
    else if (runtime_safety and un.layout != .Extern)
        true
    else
        false;
    const tag_offset = if (has_selector) getUnionSelectorOffset(TT, un.fields) else missing;
    const value_offset = if (tag_offset == 0) @sizeOf(TT) * 8 else 0;
    inline for (un.fields, 0..) |field, index| {
        try host.attachMember(structure, .{
            .name = getCString(field.name),
            .member_type = getMemberType(field.type),
            .bit_offset = value_offset,
            .bit_size = @bitSizeOf(field.type),
            .byte_size = if (isPacked(T)) missing else @sizeOf(field.type),
            .slot = getObjectSlot(T, index),
            .structure = try getStructure(host, field.type),
        }, false);
    }
    if (has_selector) {
        try host.attachMember(structure, .{
            .name = "selector",
            .member_type = getMemberType(TT),
            .bit_offset = tag_offset,
            .bit_size = @bitSizeOf(TT),
            .byte_size = if (isPacked(T)) missing else @sizeOf(TT),
            .structure = try getStructure(host, TT),
        }, false);
    }
}

fn addEnumMember(host: anytype, structure: Value, comptime T: type) !void {
    const en = @typeInfo(T).Enum;
    // find a type that fit all values
    const IT = EnumType(T);
    var values: [en.fields.len]IT = undefined;
    inline for (en.fields, 0..) |field, index| {
        values[index] = field.value;
        try host.attachMember(structure, .{
            .name = getCString(field.name),
            .member_type = getMemberType(IT),
            .bit_size = @bitSizeOf(IT),
            .byte_size = @sizeOf(IT),
            .structure = try getStructure(host, IT),
        }, false);
    }
    var bytes: []u8 = @constCast(std.mem.asBytes(&values));
    const template = try host.createTemplate(bytes);
    try host.attachTemplate(structure, template, false);
}

fn addOptionalMember(host: anytype, structure: Value, comptime T: type) !void {
    const op = @typeInfo(T).Optional;
    // value always comes first
    try host.attachMember(structure, .{
        .name = "value",
        .member_type = getMemberType(op.child),
        .bit_offset = 0,
        .bit_size = @bitSizeOf(op.child),
        .byte_size = @sizeOf(op.child),
        .slot = 0,
        .structure = try getStructure(host, op.child),
    }, false);
    const present_offset = switch (@typeInfo(op.child)) {
        // present overlaps value (i.e. null pointer means false)
        .Pointer => 0,
        else => @sizeOf(op.child) * 8,
    };
    const present_byte_size = switch (@typeInfo(op.child)) {
        // use pointer itself as boolean (null => false), returning the size of a
        // generic pointer here since op.child could be a slice (pointer + length)
        .Pointer => @sizeOf(*anyopaque),
        else => @sizeOf(bool),
    };
    try host.attachMember(structure, .{
        .name = "present",
        .member_type = .Bool,
        .bit_offset = present_offset,
        .bit_size = @bitSizeOf(bool),
        .byte_size = present_byte_size,
        .structure = try getStructure(host, bool),
    }, false);
}

fn addErrorUnionMember(host: anytype, structure: Value, comptime T: type) !void {
    const eu = @typeInfo(T).ErrorUnion;
    // value is placed after the error number if its alignment is smaller than that of anyerror
    const error_offset = if (@alignOf(anyerror) > @alignOf(eu.payload)) 0 else @sizeOf(eu.payload) * 8;
    const value_offset = if (error_offset == 0) @sizeOf(anyerror) * 8 else 0;
    try host.attachMember(structure, .{
        .name = "value",
        .member_type = getMemberType(eu.payload),
        .bit_offset = value_offset,
        .bit_size = @bitSizeOf(eu.payload),
        .byte_size = @sizeOf(eu.payload),
        .slot = 0,
        .structure = try getStructure(host, eu.payload),
    }, false);
    try host.attachMember(structure, .{
        .name = "error",
        .member_type = .Uint,
        .bit_offset = error_offset,
        .bit_size = @bitSizeOf(anyerror),
        .byte_size = @sizeOf(anyerror),
        .structure = try getStructure(host, eu.error_set),
    }, false);
}

fn addErrorSetMember(host: anytype, structure: Value, comptime T: type) !void {
    const es = @typeInfo(T).ErrorSet;
    if (es) |errors| {
        inline for (errors) |err_rec| {
            // get error from global set
            const err = @field(anyerror, err_rec.name);
            try host.attachMember(structure, .{
                .name = getCString(err_rec.name),
                .member_type = .Object,
                .slot = @intFromError(err),
                .structure = null,
            }, false);
        }
    }
}

fn getPointerType(comptime T: type, comptime name: []const u8) type {
    // get the pointer type (where possible)
    const FT = @TypeOf(@field(T, name));
    if (!isSupported(FT)) {
        return void;
    }
    return switch (@typeInfo(FT)) {
        .Type => switch (@field(T, name)) {
            noreturn, void => void,
            else => type,
        },
        .ComptimeInt => *const IntType(i32, @field(T, name)),
        .ComptimeFloat => *const f64,
        else => @TypeOf(&@field(T, name)),
    };
}

fn addStaticMembers(host: anytype, structure: Value, comptime T: type) !void {
    const decls = switch (@typeInfo(T)) {
        .Struct => |st| st.decls,
        .Union => |un| un.decls,
        .Enum => |en| en.decls,
        .Opaque => |op| op.decls,
        else => return,
    };
    if (decls.len == 0) {
        return;
    }
    var template_maybe: ?Value = null;
    // a bookmark type for getObjectSlot
    const Static = opaque {};
    inline for (decls, 0..) |decl, index| {
        const decl_value = @field(T, decl.name);
        const DT = @TypeOf(decl_value);
        if (comptime !isSupported(DT)) {
            continue;
        }
        switch (@typeInfo(DT)) {
            .Type => {
                // export type if it's supported
                if (comptime !isSupported(decl_value)) {
                    continue;
                }
                try host.attachMember(structure, .{
                    .name = getCString(decl.name),
                    .member_type = .Type,
                    .structure = try getStructure(host, decl_value),
                }, true);
            },
            else => {
                // get address to variable
                const decl_ptr = &@field(T, decl.name);
                var value_ptr = get_ptr: {
                    if (comptime isConst(@TypeOf(decl_ptr))) {
                        const VT = RuntimeType(decl_value);
                        const const_value: VT = decl_value;
                        break :get_ptr &const_value;
                    } else {
                        break :get_ptr decl_ptr;
                    }
                };
                // export variable as pointer
                const slot = getObjectSlot(Static, index);
                try host.attachMember(structure, .{
                    .name = getCString(decl.name),
                    .member_type = .Object,
                    .slot = slot,
                    .structure = try getStructure(host, @TypeOf(value_ptr)),
                }, true);
                // create the pointer object
                const ptr_memory: Memory = .{
                    .bytes = @ptrCast(&value_ptr),
                    .len = @sizeOf(@TypeOf(value_ptr)),
                };
                const ptr_obj = try host.wrapMemory(ptr_memory, .Copy, @TypeOf(value_ptr), .One);
                // dezig it, creating SharedArrayBuffer or ArrayBuffer
                try dezigStructure(host, ptr_obj, &value_ptr);
                const template = template_maybe orelse create: {
                    const obj = try host.createTemplate(&.{});
                    template_maybe = obj;
                    break :create obj;
                };
                try host.writeObjectSlot(template, slot, ptr_obj);
            },
        }
    }
    if (template_maybe) |template| {
        try host.attachTemplate(structure, template, true);
    }
}

fn hasUnsupported(comptime params: []const std.builtin.Type.Fn.Param) bool {
    inline for (params) |param| {
        if (param.type) |T| {
            if (T != std.mem.Allocator and !isSupported(T)) {
                return true;
            }
        } else {
            return true;
        }
    }
    return false;
}

test "hasUnsupported" {
    const Test = struct {
        pub fn needFn(cb: *const fn () void) void {
            cb();
        }

        pub fn needOptionalFn(cb: ?*const fn () void) void {
            if (cb) |f| {
                f();
            }
        }

        pub fn nothing() void {}

        pub fn allocate(allocator: std.mem.Allocator) void {
            _ = allocator;
        }
    };
    assert(hasUnsupported(@typeInfo(@TypeOf(Test.needFn)).Fn.params) == true);
    assert(hasUnsupported(@typeInfo(@TypeOf(Test.needOptionalFn)).Fn.params) == true);
    assert(hasUnsupported(@typeInfo(@TypeOf(Test.nothing)).Fn.params) == false);
    assert(hasUnsupported(@typeInfo(@TypeOf(Test.allocate)).Fn.params) == false);
    assert(hasUnsupported(@typeInfo(@TypeOf(std.debug.print)).Fn.params) == true);
}

fn addMethods(host: anytype, structure: Value, comptime T: type) !void {
    const decls = switch (@typeInfo(T)) {
        .Struct => |st| st.decls,
        .Union => |un| un.decls,
        .Enum => |en| en.decls,
        .Opaque => |op| op.decls,
        else => return,
    };
    inline for (decls) |decl| {
        switch (@typeInfo(@TypeOf(@field(T, decl.name)))) {
            .Fn => |f| {
                if (comptime f.is_generic or f.is_var_args) {
                    continue;
                }
                if (comptime hasUnsupported(f.params)) {
                    continue;
                }
                const function = @field(T, decl.name);
                const ArgT = ArgumentStruct(function);
                const arg_structure = try getStructure(host, ArgT);
                const is_static_only = static: {
                    if (f.params.len > 0) {
                        if (f.params[0].type) |ParamT| {
                            if (ParamT == T) {
                                break :static false;
                            }
                        }
                    }
                    break :static true;
                };
                try host.attachMethod(structure, .{
                    .name = getCString(decl.name),
                    .thunk = @ptrCast(createThunk(@TypeOf(host), function, ArgT)),
                    .structure = arg_structure,
                    .attributes = .{ .has_pointer = hasPointerArguments(ArgT) },
                }, is_static_only);
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

fn hasComptimeFields(comptime T: type) bool {
    return switch (@typeInfo(T)) {
        .Struct => |st| find_comptime: {
            inline for (st.fields) |field| {
                if (field.is_comptime) {
                    return true;
                }
            }
            break :find_comptime false;
        },
        else => false,
    };
}

fn WithoutComptimeFields(comptime T: type) type {
    if (!hasComptimeFields(T)) return T;
    const fields = @typeInfo(T).Struct.fields;
    var new_fields: [fields.len]std.builtin.Type.StructField = undefined;
    var count = 0;
    for (fields) |field| {
        if (!field.is_comptime) {
            new_fields[count] = field;
            count += 1;
        }
    }
    return @Type(.{
        .Struct = .{
            .layout = .Auto,
            .decls = &.{},
            .fields = fields[0..count],
            .is_tuple = false,
        },
    });
}

test "WithoutComptimeFields" {
    const S1 = struct {
        number1: i32,
        number2: i32,
    };
    const WC1 = WithoutComptimeFields(S1);
    const S2 = struct {
        comptime number1: i32 = 0,
        number2: i32,
    };
    const WC2 = WithoutComptimeFields(S2);
    const S3 = struct {
        comptime number1: i32 = 0,
        number2: i32,
        comptime number_type: type = i32,
    };
    const WC3 = WithoutComptimeFields(S3);
    const S4 = comptime_int;
    const WC4 = WithoutComptimeFields(S4);
    assert(WC1 == S1);
    assert(WC2 != S2);
    assert(@typeInfo(WC2).Struct.fields.len == 1);
    assert(WC3 != S3);
    assert(@typeInfo(WC3).Struct.fields.len == 1);
    assert(WC4 == S4);
}

fn RuntimeType(comptime value: anytype) type {
    const T = @TypeOf(value);
    return switch (@typeInfo(T)) {
        .ComptimeInt => IntType(i32, value),
        .ComptimeFloat => f64,
        else => T,
    };
}

test "RuntimeType" {
    const a = 1234;
    const b = 0x10_0000_0000;
    const c = 3.14;
    const d: f32 = 3.14;
    assert(RuntimeType(a) == i32);
    assert(RuntimeType(b) == i64);
    assert(RuntimeType(c) == f64);
    assert(RuntimeType(d) == f32);
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

fn rezigStructure(host: anytype, obj: Value, ptr: anytype) !void {
    const T = @TypeOf(ptr.*);
    switch (@typeInfo(T)) {
        .Pointer => |pt| {
            // note: ptr is a pointer to a pointer
            if (try host.getPointerStatus(obj)) {
                return;
            }
            try host.setPointerStatus(obj, true);
            const child_obj = try host.readObjectSlot(obj, 0);
            const current_ptr = try host.getMemory(child_obj, T, true);
            if (!comparePointers(ptr.*, current_ptr)) {
                const writable_ptr = @constCast(ptr);
                writable_ptr.* = current_ptr;
            }
            if (hasPointer(pt.child)) {
                // rezig the target(s)
                if (pt.size == .One) {
                    try rezigStructure(host, child_obj, ptr.*);
                } else if (pt.size == .Slice) {
                    for (ptr.*, 0..) |*element_ptr, index| {
                        const element_obj = try host.readObjectSlot(child_obj, index);
                        try rezigStructure(host, element_obj, element_ptr);
                    }
                }
            }
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
                if (!field.is_comptime) {
                    if (hasPointer(field.type)) {
                        const is_output = comptime isArgumentStruct(T) and index == st.fields.len - 1;
                        // retval should already be initialized as being owned by Zig on JS side
                        if (!is_output) {
                            const slot = getObjectSlot(T, index);
                            const child_obj = try host.readObjectSlot(obj, slot);
                            try rezigStructure(host, child_obj, &@field(ptr.*, field.name));
                        }
                    }
                }
            }
        },
        .Union => |un| {
            if (un.tag_type) |TT| {
                const selected: TT = ptr.*;
                const selected_index = @intFromEnum(selected);
                inline for (un.fields, 0..) |field, index| {
                    if (hasPointer(field.type)) {
                        if (index == selected_index) {
                            const slot = getObjectSlot(T, index);
                            const child_obj = try host.readObjectSlot(obj, slot);
                            try rezigStructure(host, child_obj, &@field(ptr.*, field.name));
                        }
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
        else => {},
    }
}

fn dezigStructure(host: anytype, obj: Value, ptr: anytype) !void {
    const T = @TypeOf(ptr.*);
    switch (@typeInfo(T)) {
        .Pointer => |pt| {
            if (!try host.getPointerStatus(obj)) {
                return;
            }
            try host.setPointerStatus(obj, false);
            // pointer objects store their target in slot 0
            const child_obj = try obtainChildObject(host, obj, 0, ptr.*, true);
            if (hasPointer(pt.child)) {
                if (pt.size == .One) {
                    try dezigStructure(host, child_obj, ptr.*);
                } else if (pt.size == .Slice) {
                    for (ptr.*, 0..) |*element_ptr, index| {
                        const element_obj = try obtainChildObject(host, child_obj, index, element_ptr, false);
                        try dezigStructure(host, element_obj, element_ptr);
                    }
                }
            }
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
                if (!field.is_comptime) {
                    if (hasPointer(field.type)) {
                        const slot = getObjectSlot(T, index);
                        const child_ptr = &@field(ptr.*, field.name);
                        const is_output = comptime isArgumentStruct(T) and index == st.fields.len - 1;
                        const child_obj = try obtainChildObject(host, obj, slot, child_ptr, is_output);
                        try dezigStructure(host, child_obj, child_ptr);
                    }
                }
            }
        },
        .Union => |un| {
            if (un.tag_type) |TT| {
                const selected: TT = ptr.*;
                const selected_index = @intFromEnum(selected);
                inline for (un.fields, 0..) |field, index| {
                    if (hasPointer(field.type)) {
                        if (index == selected_index) {
                            const slot = getObjectSlot(T, index);
                            const child_ptr = &@field(ptr.*, field.name);
                            const child_obj = try obtainChildObject(host, obj, slot, child_ptr, false);
                            try dezigStructure(host, child_obj, child_ptr);
                        }
                    }
                }
            }
        },
        .Optional => {
            if (ptr.*) |*child_ptr| {
                const child_obj = try obtainChildObject(host, obj, 0, child_ptr, false);
                try dezigStructure(host, child_obj, child_ptr);
            }
        },
        .ErrorUnion => {
            if (ptr.*) |*child_ptr| {
                const child_obj = try obtainChildObject(host, obj, 0, child_ptr, true);
                try dezigStructure(host, child_obj, child_ptr);
            } else |_| {}
        },
        else => {},
    }
}

fn obtainChildObject(host: anytype, container: Value, slot: usize, ptr: anytype, comptime check: bool) !Value {
    if (host.readObjectSlot(container, slot)) |child_obj| {
        if (check) {
            // see if pointer is still pointing to what it was before
            const current_ptr = try host.getMemory(child_obj, @TypeOf(ptr), true);
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

fn createChildObject(host: anytype, container: Value, slot: usize, ptr: anytype) !Value {
    const pt = @typeInfo(@TypeOf(ptr)).Pointer;
    const memory = toMemory(ptr);
    const disposition: MemoryDisposition = if (host.onStack(memory)) .Copy else .Auto;
    const child_obj = try host.wrapMemory(memory, disposition, pt.child, pt.size);
    try host.writeObjectSlot(container, slot, child_obj);
    return child_obj;
}

fn createAllocator(host_ptr: anytype) std.mem.Allocator {
    const HostPtrT = @TypeOf(host_ptr);
    const VTable = struct {
        fn alloc(p: *anyopaque, size: usize, ptr_align: u8, _: usize) ?[*]u8 {
            const h: HostPtrT = @alignCast(@ptrCast(p));
            return if (h.allocateMemory(size, ptr_align)) |m| m.bytes else |_| null;
        }

        fn resize(_: *anyopaque, _: []u8, _: u8, _: usize, _: usize) bool {
            return false;
        }

        fn free(p: *anyopaque, bytes: []u8, ptr_align: u8, _: usize) void {
            const h: HostPtrT = @alignCast(@ptrCast(p));
            h.freeMemory(.{
                .bytes = @ptrCast(bytes.ptr),
                .len = bytes.len,
            }, ptr_align) catch {};
        }

        const instance: std.mem.Allocator.VTable = .{
            .alloc = alloc,
            .resize = resize,
            .free = free,
        };
    };
    return .{
        .ptr = @ptrCast(@constCast(host_ptr)),
        .vtable = &VTable.instance,
    };
}

fn getErrorMessage(err: anyerror) [*:0]const u8 {
    return @ptrCast(@errorName(err));
}

fn createThunk(comptime HostT: type, comptime function: anytype, comptime ArgT: type) Thunk {
    const Args = std.meta.ArgsTuple(@TypeOf(function));
    const S = struct {
        fn tryFunction(host: HostT, arg_obj: Value) !void {
            // extract arguments from argument struct
            var args: Args = undefined;
            if (@sizeOf(ArgT) != 0) {
                const fields = @typeInfo(Args).Struct.fields;
                var arg_ptr = try host.getMemory(arg_obj, *ArgT, false);
                if (hasPointer(ArgT)) {
                    // make sure pointers have up-to-date values
                    try rezigStructure(host, arg_obj, arg_ptr);
                }
                comptime var index = 0;
                inline for (fields, 0..) |field, i| {
                    if (field.type == std.mem.Allocator) {
                        args[i] = createAllocator(&host);
                    } else {
                        const name = std.fmt.comptimePrint("{d}", .{index});
                        args[i] = @field(arg_ptr.*, name);
                        index += 1;
                    }
                }
                // never inline the function so its name would show up in the trace
                arg_ptr.*.retval = @call(.never_inline, function, args);
                if (hasPointer(ArgT)) {
                    try dezigStructure(host, arg_obj, arg_ptr);
                }
            } else {
                @call(.never_inline, function, args);
            }
        }

        fn invokeFunction(ptr: *anyopaque, arg_obj: Value) callconv(.C) ?[*:0]const u8 {
            const host = HostT.init(ptr);
            defer host.done();
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
    const Host = @import("./cpp-exporter.zig").Host;
    const thunk = createThunk(Host, Test.A, ArgA);
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

pub fn createRootFactory(comptime HostT: type, comptime T: type) Thunk {
    const RootFactory = struct {
        fn exportStructure(ptr: *anyopaque, args: Value) callconv(.C) ?[*:0]const u8 {
            const host = HostT.init(ptr);
            defer host.done();
            var result = getStructure(host, T) catch |err| {
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
