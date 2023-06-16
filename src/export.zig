const std = @import("std");
const builtin = @import("builtin");
const assert = std.debug.assert;

// error type
const Error = error{
    TODO,
    Unknown,
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

fn getStructureSlot(comptime T: anytype) u32 {
    return structure_slot.get(.{ .Type = T });
}

test "getStructureSlot" {
    const A = struct {};
    const slotA = getStructureSlot(A);
    assert(slotA == 0);
    const B = struct {};
    const slotB = getStructureSlot(B);
    assert(slotB == 1);
    assert(getStructureSlot(A) == 0);
    assert(getStructureSlot(B) == 1);
}

fn getRelocatableSlot(comptime T: anytype, comptime index: comptime_int) u32 {
    // per-struct slot allocator
    const relocatable_slot = allocator.get(.{ .Type = T });
    return relocatable_slot.get(.{ .Index = index });
}

test "getRelocatableSlot" {
    const A = struct {};
    const slotA1 = getRelocatableSlot(A, 0);
    const slotA2 = getRelocatableSlot(A, 1);
    assert(slotA1 == 0);
    assert(slotA2 == 1);
    const B = struct {};
    const slotB1 = getRelocatableSlot(B, 1);
    const slotB2 = getRelocatableSlot(B, 0);
    assert(slotB1 == 0);
    assert(slotB2 == 1);
    assert(getRelocatableSlot(A, 1) == 1);
    assert(getRelocatableSlot(A, 2) == 2);
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
    Enumeration,
    Optional,
    Opaque,
};

const MemberType = enum(u32) {
    Void = 0,
    Bool,
    Int,
    Float,
    Enum,
    Compound,
    Pointer,
    Type,
};

const Value = *opaque {};
const Thunk = *const fn (host: Host, args: Value) callconv(.C) void;
const Factory = *const fn (host: Host, dest: *Value) callconv(.C) Result;

const Memory = extern struct {
    bytes: ?[*]u8 = null,
    len: usize = 0,
};

const Member = extern struct {
    name: ?[*:0]const u8 = null,
    member_type: MemberType,
    is_signed: bool = false,
    bit_offset: u32,
    bit_size: u32,
    byte_size: u32,
    slot: u32 = 0,
    structure: ?Value = null,
};

const MemberSet = extern struct {
    members: [*]const Member,
    member_count: usize,
    total_size: usize = 0,
    default_data: Memory,
    default_pointers: ?[*]const Memory = null,
    default_pointer_count: usize = 0,
};

const Method = extern struct {
    name: ?[*:0]const u8 = null,
    is_static_only: bool,
    thunk: Thunk,
    structure: Value,
};

const MethodSet = extern struct {
    methods: [*]const Method,
    method_count: usize,
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
    factory: Factory,
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

fn getMemberType(comptime T: type) MemberType {
    return switch (@typeInfo(T)) {
        .Bool => .Bool,
        .Int => .Int,
        .Float => .Float,
        .Enum => .Enum,
        .Struct, .Union, .Array, .ErrorUnion, .Optional => .Compound,
        .Pointer => .Pointer,
        .Type => .Type,
        else => .Void,
    };
}

test "getMemberType" {
    assert(getMemberType(u32) == .Int);
    assert(getMemberType(*u32) == .Pointer);
    assert(getMemberType(type) == .Type);
}

fn getStructureType(comptime T: type) StructureType {
    return switch (@typeInfo(T)) {
        .Bool, .Int, .Float, .Void => .Primitive,
        .Struct => .Struct,
        .Union => |un| if (un.layout == .Extern) .ExternUnion else .TaggedUnion,
        .Enum => .Enumeration,
        .Array => .Array,
        .Opaque => .Opaque,
        else => .Primitive,
    };
}

test "getStructureType" {
    assert(getStructureType(i32) == .Primitive);
    assert(getStructureType(union {}) == .TaggedUnion);
    assert(getStructureType(extern union {}) == .ExternUnion);
}

// pointer table that's filled on the C++ side
const Callbacks = extern struct {
    allocate_memory: *const fn (host: Host, size: usize, dest: *[*]u8) callconv(.C) Result,
    reallocate_memory: *const fn (host: Host, size: usize, dest: *[*]u8) callconv(.C) Result,
    free_memory: *const fn (host: Host, dest: *[*]u8) callconv(.C) Result,
    get_memory: *const fn (host: Host, value: Value, dest: *Memory) callconv(.C) Result,
    get_relocatable: *const fn (host: Host, value: Value, id: u32, dest: *Value) callconv(.C) Result,

    read_slot: *const fn (host: Host, id: u32, dest: *Value) callconv(.C) Result,
    write_slot: *const fn (host: Host, id: u32, value: Value) callconv(.C) Result,

    create_structure: *const fn (host: Host, s_type: StructureType, name: [*:0]const u8, dest: *Value) callconv(.C) Result,
    shape_structure: *const fn (host: Host, structure: Value, def: *const MemberSet) callconv(.C) Result,
    attach_variables: *const fn (host: Host, structure: Value, def: *const MemberSet) callconv(.C) Result,
    attach_methods: *const fn (host: Host, structure: Value, def: *const MethodSet) callconv(.C) Result,
};
var callbacks: Callbacks = undefined;

// host interface
const Host = *opaque {
    fn getPointer(self: Host, value: Value, comptime T: type) Error!*T {
        var memory: Memory = undefined;
        if (callbacks.get_memory(self, value, &memory) != .OK) {
            return Error.Unknown;
        }
        const aligned_ptr = @alignCast(@alignOf(T), memory.bytes);
        return @ptrCast(*T, aligned_ptr);
    }

    fn getRelocatable(self: Host, value: Value, id: u32) Error!Value {
        var result: Value = undefined;
        if (callbacks.get_relocatable(self, value, id, &result) != .OK) {
            return Error.Unknown;
        }
        return result;
    }

    fn readSlot(self: Host, slot: u32) Error!Value {
        var value: Value = undefined;
        if (callbacks.read_slot(self, slot, &value) != .OK) {
            return Error.Unknown;
        }
        return value;
    }

    fn writeSlot(self: Host, slot: u32, value: Value) Error!void {
        if (callbacks.write_slot(self, slot, value) != .OK) {
            return Error.Unknown;
        }
    }

    fn createStructure(self: Host, s_type: StructureType, name: []const u8) Error!Value {
        var def: Value = undefined;
        if (callbacks.create_structure(self, s_type, @ptrCast([*:0]const u8, name), &def) != .OK) {
            return Error.Unknown;
        }
        return def;
    }

    fn shapeStructure(self: Host, structure: Value, def: MemberSet) Error!void {
        if (callbacks.shape_structure(self, structure, &def) != .OK) {
            return Error.Unknown;
        }
    }

    fn attachVariables(self: Host, structure: Value, def: MemberSet) Error!void {
        if (callbacks.attach_variables(self, structure, &def) != .OK) {
            return Error.Unknown;
        }
    }

    fn attachMethods(self: Host, structure: Value, def: MethodSet) Error!void {
        if (callbacks.attach_methods(self, structure, &def) != .OK) {
            return Error.Unknown;
        }
    }
};

// export functions
fn getStructure(host: Host, comptime T: type) Error!Value {
    const s_slot = getStructureSlot(T);
    return host.readSlot(s_slot) catch undefined: {
        const s_type = getStructureType(T);
        const name = @typeName(T);
        // create the structure and place it in the slot immediately
        // so that recursive definition works correctly
        const structure = try host.createStructure(s_type, name);
        try host.writeSlot(s_slot, structure);
        // define the shape of the structure
        const def = try getMemberSet(host, T);
        try host.shapeStructure(structure, def);
        if (try getVariableSet(host, T)) |set| {
            // attach static variables
            try host.attachVariables(structure, set);
        }
        if (try getMethodSet(host, T)) |set| {
            try host.attachMethods(structure, set);
        }
        break :undefined structure;
    };
}

fn getMemberSet(host: Host, comptime T: type) Error!MemberSet {
    const members = try getMembers(host, T);
    const default_data = getDefaultData(T);
    const pointers = getDefaultPointers(T);
    return .{
        .members = members.ptr,
        .member_count = members.len,
        .total_size = @sizeOf(T),
        .default_data = default_data,
        .default_pointers = if (pointers.len > 0) pointers.ptr else null,
        .default_pointer_count = pointers.len,
    };
}

fn getVariableSet(host: Host, comptime T: type) Error!?MemberSet {
    if (StaticStruct(T)) |SS| {
        const members = try getMembers(host, SS);
        const pointers = getDefaultPointers(SS);
        return .{
            .members = members.ptr,
            .member_count = members.len,
            .default_pointers = pointers.ptr,
            .default_pointer_count = pointers.len,
            .default_data = .{},
        };
    } else {
        return null;
    }
}

fn getMethodSet(host: Host, comptime T: type) Error!?MethodSet {
    const methods = try getMethods(host, T);
    if (methods.len == 0) {
        return null;
    }
    return .{
        .methods = methods.ptr,
        .method_count = methods.len,
    };
}

fn getMembers(host: Host, comptime T: type) Error![]const Member {
    const count = switch (@typeInfo(T)) {
        .Struct => |st| st.fields.len,
        .Union => |un| un.fields.len,
        .Enum => |en| en.field.len,
        .Opaque => 0,
        else => 1,
    };
    var members: [count]Member = undefined;
    switch (@typeInfo(T)) {
        .Bool, .Int, .Float, .Void => {
            members[0] = .{
                .member_type = getMemberType(T),
                .is_signed = isSigned(T),
                .bit_size = @bitSizeOf(T),
                .bit_offset = 0,
                .byte_size = @sizeOf(T),
            };
        },
        .Array => |ar| {
            members[0] = .{
                .member_type = getMemberType(ar.child),
                .is_signed = isSigned(ar.child),
                .bit_size = @bitSizeOf(ar.child),
                .bit_offset = 0,
                .byte_size = @sizeOf(ar.child),
            };
        },
        .Struct, .Union => {
            // pre-allocate relocatable slots for fields that always need them
            const fields = std.meta.fields(T);
            inline for (fields, 0..) |field, index| {
                switch (getMemberType(field.type)) {
                    .Pointer, .Compound, .Enum => {
                        _ = getRelocatableSlot(T, index);
                    },
                    else => {},
                }
            }
            inline for (fields, 0..) |field, index| {
                members[index] = .{
                    .name = @ptrCast([*:0]const u8, field.name),
                    .member_type = getMemberType(field.type),
                    .is_signed = isSigned(field.type),
                    .bit_offset = @bitOffsetOf(T, field.name),
                    .bit_size = @bitSizeOf(field.type),
                    .byte_size = if (isPacked(T)) @sizeOf(field.type) else 0,
                    .structure = try getStructure(host, field.type),
                    .slot = getRelocatableSlot(T, index),
                };
            }
        },
        .Enum => |en| {
            // find a type that fit all values
            const IT = EnumType(T);
            inline for (en.fields, 0..) |field, index| {
                members[index] = .{
                    .name = field.name,
                    .member_type = getMemberType(IT),
                    .is_signed = isSigned(IT),
                    .bit_offset = 0,
                    .bit_size = @bitSizeOf(IT),
                    .byte_size = @sizeOf(IT),
                };
            }
        },
        else => {},
    }
    return members[0..count];
}

fn getMethods(host: Host, comptime T: type) Error![]const Method {
    const decls = switch (@typeInfo(T)) {
        .Struct => |st| st.decls,
        .Union => |un| un.decls,
        .Enum => |en| en.decls,
        .Opaque => |op| op.decls,
        else => return &.{},
    };
    var methods: [decls.len]Method = undefined;
    comptime var count = 0;
    inline for (decls) |decl| {
        if (!decl.is_pub) {
            continue;
        }
        switch (@typeInfo(@TypeOf(@field(T, decl.name)))) {
            .Fn => {
                const function = @field(T, decl.name);
                const ArgT = ArgumentStruct(function);
                const arg_structure = try getStructure(host, ArgT);
                methods[count] = .{
                    .name = @ptrCast([*:0]const u8, decl.name),
                    .is_static_only = true,
                    .thunk = createThunk(function, ArgT),
                    .structure = arg_structure,
                };
                count += 1;
            },
            else => {},
        }
    }
    return methods[0..count];
}

fn getDefaultPointers(comptime T: type) []const Memory {
    const fields = switch (@typeInfo(T)) {
        .Struct, .Union => std.meta.fields(T),
        else => {
            return &.{};
        },
    };
    var pointers: [fields.len]Memory = .{};
    comptime var count = 0;
    inline for (fields, 0..) |field, index| {
        switch (@typeInfo(field.type)) {
            .Pointer => |pt| {
                if (field.default_value) |opaque_ptr| {
                    const r_slot = getRelocatableSlot(T, index);
                    const aligned_ptr = @alignCast(@alignOf(field.type), opaque_ptr);
                    const typed_ptr = @ptrCast(*const field.type, aligned_ptr);
                    pointers[r_slot] = .{
                        .bytes = @ptrCast([*]u8, @alignCast(1, @constCast(typed_ptr.*))),
                        .len = switch (pt.size) {
                            .Slice => @sizeOf(pt.child) * typed_ptr.*.len,
                            .One => @sizeOf(pt.child),
                            else => 0,
                        },
                    };
                    count += 1;
                }
            },
            else => {},
        }
    }
    return if (count > 0) &pointers else &.{};
}

test "getDefaultPointers" {
    const A = struct {
        text: []const u8 = "Hello world",
        number: i32,
    };
    const pointersA = getDefaultPointers(A);
    assert(pointersA.len == 2);
    assert(pointersA[0].len == 11);
    assert(pointersA[0].bytes != null);
    if (pointersA[0].bytes) |bytes| {
        assert(bytes[0] == 'H');
        assert(bytes[6] == 'w');
    }
    const B = struct {
        text: []const u8,
        number: i32,
    };
    const pointersB = getDefaultPointers(B);
    assert(pointersB.len == 0);
}

fn getDefaultData(comptime T: type) Memory {
    const fields = switch (@typeInfo(T)) {
        .Struct, .Union => std.meta.fields(T),
        else => {
            return .{};
        },
    };
    var structure: T = undefined;
    var bytes = @intToPtr([*]u8, @ptrToInt(&structure));
    var slice = bytes[0..@sizeOf(T)];
    @memset(slice, 0xAA);
    inline for (fields) |field| {
        switch (@typeInfo(field.type)) {
            .Pointer => {
                // pointers are always initialized to an invalid address
                // with the real addresses provided through getDefaultPointers()
            },
            else => {
                if (field.default_value) |opaque_ptr| {
                    const aligned_ptr = @alignCast(@alignOf(field.type), opaque_ptr);
                    const typed_ptr = @ptrCast(*const field.type, aligned_ptr);
                    @field(structure, field.name) = typed_ptr.*;
                }
            },
        }
    }
    const all_zeros = check: {
        comptime var i = 0;
        inline while (i < slice.len) : (i += 1) {
            if (slice[i] != 0) {
                break :check false;
            }
        }
        break :check true;
    };
    return .{
        .bytes = if (all_zeros) null else bytes,
        .len = if (all_zeros) 0 else slice.len,
    };
}

test "getDefaultData" {
    const A = struct {
        number1: u32 = 0x11223344,
        number2: u32,
        number3: u16 = 0,
    };
    const memA = getDefaultData(A);
    assert(memA.len == @sizeOf(A));
    assert(memA.bytes != null);
    if (memA.bytes) |bytes| {
        if (builtin.target.cpu.arch.endian() == .Little) {
            assert(bytes[0] == 0x44);
            assert(bytes[1] == 0x33);
            assert(bytes[2] == 0x22);
            assert(bytes[3] == 0x11);
            assert(bytes[4] == 0xAA);
            assert(bytes[5] == 0xAA);
            assert(bytes[6] == 0xAA);
            assert(bytes[7] == 0xAA);
            assert(bytes[8] == 0x00);
            assert(bytes[9] == 0x00);
        }
    }
    const B = struct {
        number1: i32,
        number2: i32,
    };
    const memB = getDefaultData(B);
    assert(memB.len == @sizeOf(B));
    assert(memB.bytes != null);
    if (memB.bytes) |bytes| {
        if (builtin.target.cpu.arch.endian() == .Little) {
            assert(bytes[0] == 0xAA);
            assert(bytes[1] == 0xAA);
            assert(bytes[2] == 0xAA);
            assert(bytes[3] == 0xAA);
            assert(bytes[4] == 0xAA);
            assert(bytes[5] == 0xAA);
            assert(bytes[6] == 0xAA);
            assert(bytes[7] == 0xAA);
        }
    }
    const C = struct {
        number1: i32 = 0,
        number2: i32 = 0,
    };
    const memC = getDefaultData(C);
    assert(memC.len == 0);
    assert(memC.bytes == null);
    const D = struct {
        a: A = .{ .number2 = 0xFFFFFFFF },
    };
    const memD = getDefaultData(D);
    assert(memD.len == @sizeOf(D));
    assert(memD.bytes != null);
    if (memD.bytes) |bytes| {
        if (builtin.target.cpu.arch.endian() == .Little) {
            assert(bytes[0] == 0x44);
            assert(bytes[1] == 0x33);
            assert(bytes[2] == 0x22);
            assert(bytes[3] == 0x11);
            assert(bytes[4] == 0xFF);
            assert(bytes[5] == 0xFF);
            assert(bytes[6] == 0xFF);
            assert(bytes[7] == 0xFF);
        }
    }
}

fn StaticStruct(comptime T: type) ?type {
    const decls = switch (@typeInfo(T)) {
        .Struct => |st| st.decls,
        .Union => |un| un.decls,
        .Enum => |en| en.decls,
        .Opaque => |op| op.decls,
        else => return null,
    };
    // create static struct
    var fields: [decls.len]std.builtin.Type.StructField = undefined;
    var count = 0;
    inline for (decls) |decl| {
        if (!decl.is_pub) {
            continue;
        }
        switch (@typeInfo(@TypeOf(@field(T, decl.name)))) {
            .Fn, .Frame, .AnyFrame, .NoReturn => {},
            else => {
                const PT = @TypeOf(&@field(T, decl.name));
                const pointer = &@field(T, decl.name);
                fields[count] = .{
                    .name = decl.name,
                    .type = PT,
                    .default_value = @ptrCast(*const anyopaque, &pointer),
                    .is_comptime = false,
                    .alignment = @alignOf(PT),
                };
                count += 1;
            },
        }
    }
    if (count == 0) {
        return null;
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

test "StaticStruct" {
    const A = struct {
        pub const number: u32 = 1234;
        pub const array: [4]u32 = .{ 1, 2, 3, 4 };
        const private: i32 = -1;
        pub const name: []const u8 = "Hello world";
    };
    const result = StaticStruct(A);
    assert(result != null);
    if (result) |SS| {
        const fields = @typeInfo(SS).Struct.fields;
        assert(fields.len == 3);
        assert(fields[0].name[0] == 'n');
        assert(fields[1].name[0] == 'a');
        assert(fields[2].name[0] == 'n');
        assert(fields[0].default_value != null);
        assert(fields[1].default_value != null);
        assert(fields[2].default_value != null);

        const pointers = getDefaultPointers(SS);
        assert(pointers.len == 3);
        assert(pointers[0].bytes != null);
        assert(pointers[0].len == 4);
        if (pointers[0].bytes) |bytes| {
            if (builtin.target.cpu.arch.endian() == .Little) {
                assert(bytes[0] == 1234 & 0xFF);
                assert(bytes[1] == 1234 >> 8);
            }
        }
        assert(pointers[1].bytes != null);
        assert(pointers[1].len == 16);
        if (pointers[1].bytes) |bytes| {
            if (builtin.target.cpu.arch.endian() == .Little) {
                assert(bytes[0] == 1);
                assert(bytes[4] == 2);
            }
        }
        assert(pointers[2].bytes != null);
        assert(pointers[2].len == @sizeOf([]u8));
    }
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

const invalid_address = if (@bitSizeOf(*u8) == 64) 0xaaaa_aaaa_aaaa_aaaa else 0xaaaa_aaaa;

fn invalidPointer(PT: type) PT {
    return @intToPtr(PT, invalid_address);
}

fn repointStructure(host: Host, obj: Value, comptime T: type) Error!*T {
    // TODO
    return host.getPointer(obj, T);
}

fn depointStructure(host: Host, obj: Value, comptime T: type) Error!void {
    // TODO
    _ = T;
    _ = obj;
    _ = host;
}

fn createThunk(comptime function: anytype, comptime ArgT: type) Thunk {
    const Args = std.meta.ArgsTuple(@TypeOf(function));
    const S = struct {
        fn tryFunction(host: Host, arg_obj: Value) !void {
            var arg_struct = try repointStructure(host, arg_obj, ArgT);
            // extract arguments from argument struct
            var args: Args = undefined;
            const fields = @typeInfo(Args).Struct.fields;
            comptime var index = 0;
            inline for (fields, 0..) |field, i| {
                if (field.type == std.mem.Allocator) {
                    // TODO: add allocator
                } else {
                    const name = std.fmt.comptimePrint("{d}", .{index});
                    args[i] = @field(arg_struct, name);
                    index += 1;
                }
            }
            arg_struct.retval = @call(std.builtin.CallModifier.auto, function, args);
            try depointStructure(host, arg_obj, ArgT);
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

fn createRootFactory(comptime S: type) Factory {
    const RootFactory = struct {
        fn exportStructure(host: Host, dest: *Value) callconv(.C) Result {
            if (getStructure(host, S)) |s| {
                dest.* = s;
                return .OK;
            } else |_| {
                return .Failure;
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
