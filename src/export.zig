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
    Singleton = 0,
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

const DefaultValues = extern struct {
    is_static: bool = false,
    data: Memory,
    pointers: ?[*]const Memory = null,
    pointer_count: usize = 0,
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
        .Bool, .Int, .Float, .Void, .Type => .Singleton,
        .Struct => .Struct,
        .Union => |un| if (un.layout == .Extern) .ExternUnion else .TaggedUnion,
        .Enum => .Enumeration,
        .Array => .Array,
        .Opaque => .Opaque,
        else => .Singleton,
    };
}

test "getStructureType" {
    assert(getStructureType(i32) == .Singleton);
    assert(getStructureType(union {}) == .TaggedUnion);
    assert(getStructureType(extern union {}) == .ExternUnion);
}

// pointer table that's filled on the C++ side
const Callbacks = extern struct {
    allocate_memory: *const fn (host: Host, size: usize, dest: *[*]u8) callconv(.C) Result,
    reallocate_memory: *const fn (host: Host, size: usize, dest: *[*]u8) callconv(.C) Result,
    free_memory: *const fn (host: Host, dest: *[*]u8) callconv(.C) Result,
    get_memory: *const fn (host: Host, container: Value, dest: *Memory) callconv(.C) Result,

    read_global_slot: *const fn (host: Host, id: u32, dest: *Value) callconv(.C) Result,
    write_global_slot: *const fn (host: Host, id: u32, value: Value) callconv(.C) Result,
    read_object_slot: *const fn (host: Host, container: Value, id: u32, dest: *Value) callconv(.C) Result,
    write_object_slot: *const fn (host: Host, container: Value, id: u32, value: Value) callconv(.C) Result,

    begin_structure: *const fn (host: Host, def: *const Structure, dest: *Value) callconv(.C) Result,
    attach_member: *const fn (host: Host, structure: Value, member: *const Member) callconv(.C) Result,
    attach_method: *const fn (host: Host, structure: Value, method: *const Method) callconv(.C) Result,
    attach_default_values: *const fn (host: Host, structure: Value, values: *const DefaultValues) callconv(.C) Result,
    finalize_structure: *const fn (host: Host, structure: Value) callconv(.C) Result,
};
var callbacks: Callbacks = undefined;

// host interface
const Host = *opaque {
    fn getMemory(self: Host, container: Value, comptime T: type) Error!*T {
        var memory: Memory = undefined;
        if (callbacks.get_memory(self, container, &memory) != .OK) {
            return Error.Unknown;
        }
        const aligned_ptr = @alignCast(@max(@alignOf(T), 1), memory.bytes);
        return @ptrCast(*T, aligned_ptr);
    }

    fn readGlobalSlot(self: Host, slot: u32) Error!Value {
        var value: Value = undefined;
        if (callbacks.read_global_slot(self, slot, &value) != .OK) {
            return Error.Unknown;
        }
        return value;
    }

    fn writeGlobalSlot(self: Host, slot: u32, value: Value) Error!void {
        if (callbacks.write_global_slot(self, slot, value) != .OK) {
            return Error.Unknown;
        }
    }

    fn readObjectSlot(self: Host, container: Value, id: u32) Error!Value {
        var result: Value = undefined;
        if (callbacks.read_object_slot(self, container, id, &result) != .OK) {
            return Error.Unknown;
        }
        return result;
    }

    fn writeObjectSlot(self: Host, container: Value, id: u32, value: Value) Error!void {
        if (callbacks.write_object_slot(self, container, id, value) != .OK) {
            return Error.Unknown;
        }
    }

    fn beginStructure(self: Host, def: Structure) Error!Value {
        var structure: Value = undefined;
        if (callbacks.begin_structure(self, &def, &structure) != .OK) {
            return Error.Unknown;
        }
        return structure;
    }

    fn attachMember(self: Host, structure: Value, member: Member) Error!void {
        if (callbacks.attach_member(self, structure, &member) != .OK) {
            return Error.Unknown;
        }
    }

    fn attachMethod(self: Host, structure: Value, method: Method) Error!void {
        if (callbacks.attach_method(self, structure, &method) != .OK) {
            return Error.Unknown;
        }
    }

    fn attachDefaultValues(self: Host, structure: Value, values: DefaultValues) Error!void {
        if (callbacks.attach_default_values(self, structure, &values) != .OK) {
            return Error.Unknown;
        }
    }

    fn finalizeStructure(self: Host, structure: Value) Error!void {
        if (callbacks.finalize_structure(self, structure) != .OK) {
            return Error.Unknown;
        }
    }
};

// export functions
fn getStructure(host: Host, comptime T: type) Error!Value {
    const s_slot = getStructureSlot(T);
    return host.readGlobalSlot(s_slot) catch undefined: {
        const def: Structure = .{
            .name = @ptrCast([*:0]const u8, @typeName(T)),
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

fn getMemberStructure(host: Host, comptime T: type) Error!Value {
    const MT = switch (@typeInfo(T)) {
        .Pointer => |pt| pt.child,
        else => T,
    };
    return getStructure(host, MT);
}

fn addMembers(host: Host, structure: Value, comptime T: type) Error!void {
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
            try host.attachMember(structure, .{
                .member_type = getMemberType(T),
                .is_const = pt.is_const,
                .bit_size = @bitSizeOf(T),
                .bit_offset = 0,
                .byte_size = @sizeOf(T),
                .structure = try getStructure(host, pt.child),
            });
        },
        .Struct, .Union => {
            // pre-allocate relocatable slots for fields that always need them
            const fields = std.meta.fields(T);
            inline for (fields, 0..) |field, index| {
                switch (getMemberType(field.type)) {
                    .Pointer, .Compound, .Enum => {
                        _ = getObjectSlot(T, index);
                    },
                    else => {},
                }
            }
            // default data
            var data: [@sizeOf(T)]u8 = undefined;
            const ptr = @intToPtr(*T, @ptrToInt(&data));
            for (data, 0..) |_, index| {
                data[index] = 0xAA;
            }
            // default pointers
            var pointers: [fields.len]Memory = undefined;
            for (pointers, 0..) |_, index| {
                pointers[index] = .{};
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
                    .byte_size = if (isPacked(T)) @sizeOf(field.type) else 0,
                    .slot = getObjectSlot(T, index),
                    .structure = try getMemberStructure(host, field.type),
                };
                try host.attachMember(structure, member);
                if (field.default_value) |opaque_ptr| {
                    // set default value
                    const aligned_ptr = @alignCast(@alignOf(field.type), opaque_ptr);
                    const typed_ptr = @ptrCast(*const field.type, aligned_ptr);
                    switch (@typeInfo(field.type)) {
                        .Pointer => |pt| {
                            pointers[member.slot] = .{
                                .bytes = @ptrCast([*]u8, @alignCast(1, @constCast(typed_ptr.*))),
                                .len = switch (pt.size) {
                                    .Slice => @sizeOf(pt.child) * typed_ptr.*.len,
                                    .One => @sizeOf(pt.child),
                                    else => 0,
                                },
                            };
                        },
                        else => {
                            @field(ptr.*, field.name) = typed_ptr.*;
                        },
                    }
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
            const has_pointers = check_pointers: {
                for (pointers) |pointer| {
                    if (pointer.bytes != null) {
                        break :check_pointers true;
                    }
                }
                break :check_pointers false;
            };
            if (has_data or has_pointers) {
                return host.attachDefaultValues(structure, .{
                    .data = .{
                        .bytes = if (has_data) &data else null,
                        .len = if (has_data) data.len else 0,
                    },
                    .pointers = if (has_pointers) &pointers else null,
                    .pointer_count = if (has_pointers) pointers.len else 0,
                });
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
        else => {
            std.debug.print("Missing: {s}\n", .{@typeName(T)});
        },
    }
}

fn addStaticMembers(host: Host, structure: Value, comptime T: type) Error!void {
    const decls = switch (@typeInfo(T)) {
        .Struct => |st| st.decls,
        .Union => |un| un.decls,
        .Enum => |en| en.decls,
        .Opaque => |op| op.decls,
        else => return,
    };
    const S = opaque {};
    // default pointers
    var pointers: [decls.len]Memory = undefined;
    for (pointers, 0..) |_, index| {
        pointers[index] = .{};
    }
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
                .structure = try getMemberStructure(host, @field(T, decl.name)),
            });
        } else {
            const slot = getObjectSlot(S, index);
            try host.attachMember(structure, .{
                .name = name,
                .member_type = .Pointer,
                .is_static = true,
                .is_const = isConst(PT),
                .slot = slot,
                .structure = try getMemberStructure(host, PT),
            });
            // get address to variable
            const typed_ptr = switch (decl_info) {
                .ComptimeInt, .ComptimeFloat => ptr: {
                    // need to create variable in memory for comptime value
                    const VT = @typeInfo(PT).Pointer.child;
                    const value: VT = @field(T, decl.name);
                    break :ptr &value;
                },
                else => &@field(T, decl.name),
            };
            const aligned_ptr = @constCast(@alignCast(1, typed_ptr));
            pointers[slot] = .{
                .bytes = @ptrCast([*]u8, aligned_ptr),
                .len = @sizeOf(@TypeOf(typed_ptr.*)),
            };
        }
    }
    const has_pointers = check_pointers: {
        for (pointers) |pointer| {
            if (pointer.bytes != null) {
                break :check_pointers true;
            }
        }
        break :check_pointers false;
    };
    if (has_pointers) {
        return host.attachDefaultValues(structure, .{
            .is_static = true,
            .data = .{},
            .pointers = &pointers,
            .pointer_count = pointers.len,
        });
    }
}

fn addMethods(host: Host, structure: Value, comptime T: type) Error!void {
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

const invalid_address = if (@bitSizeOf(*u8) == 64) 0xaaaa_aaaa_aaaa_aaaa else 0xaaaa_aaaa;

fn invalidPointer(PT: type) PT {
    return @intToPtr(PT, invalid_address);
}

fn repointStructure(host: Host, obj: Value, comptime T: type) Error!*T {
    // TODO
    return host.getMemory(obj, T);
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

fn createRootFactory(comptime S: type) Thunk {
    const RootFactory = struct {
        fn exportStructure(host: Host, args: Value) callconv(.C) void {
            if (getStructure(host, S)) |result| {
                host.writeObjectSlot(args, 0, result) catch {};
            } else |_| {
                if (@errorReturnTrace()) |trace| {
                    std.debug.dumpStackTrace(trace.*);
                }
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
