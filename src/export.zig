const std = @import("std");
const builtin = @import("builtin");

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
            comptime var next = 1;
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

fn getStructureSlot(comptime S: anytype) u32 {
    return structure_slot.get(S);
}

fn getRelocatableSlot(comptime T: anytype, field_name: []const u8) u32 {
    // per-struct slot allocator
    const relocatable_slot = allocator.get(.{ .Type = T });
    return relocatable_slot.get(.{ .Field = field_name });
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
    slot: u32,
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
    if (info.signedness == .signed) {
        info.signedness = .unsigned;
    } else {
        info.signedness = .signed;
        info.bits += if (info.bits == 32) 32 else 64;
    }
    return @Type(info);
}

fn IntType(n: comptime_int) type {
    var IT = i32;
    while (!isInRangeOf(n, IT)) {
        IT = NextIntType(IT);
    }
    return IT;
}

fn EnumType(comptime T: type) type {
    var IT = i32;
    var all_fit = false;
    while (!all_fit) : (IT = NextIntType(IT)) {
        all_fit = true;
        inline for (@typeInfo(T).Enum.fields) |field| {
            if (!isInRangeOf(field.value, IT)) {
                all_fit = false;
                break;
            }
        }
    }
    return IT;
}

fn isInRangeOf(n: comptime_int, comptime T: type) bool {
    return std.math.minInt(T) <= n and n <= std.math.maxInt(T);
}

fn isSigned(comptime T: type) bool {
    return switch (@typeInfo(T)) {
        .Int => |int| int.signedness == .signed,
        else => false,
    };
}

fn isPacked(comptime T: type) bool {
    return switch (@typeInfo(T)) {
        .Struct => |st| st.layout == .Packed,
        .Union => |un| un.layout == .Packed,
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
        else => .Primitive,
    };
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
    fn getPointer(self: Host, value: Value, comptime PT: type) !PT {
        var memory: Memory = undefined;
        if (callbacks.get_memory(self, value, &memory) != .OK) {
            return Error.Unknown;
        }
        return @ptrCast(PT, memory.bytes);
    }

    fn getRelocatable(self: Host, value: Value, id: u32) !Value {
        var result: Value = undefined;
        if (callbacks.get_relocatable(self, value, id, &result) != .OK) {
            return Error.Unknown;
        }
        return result;
    }

    fn readSlot(self: Host, slot: u32) !Value {
        var value: Value = undefined;
        if (callbacks.read_slot(self, slot, &value) != .OK) {
            return Error.Unknown;
        }
        return value;
    }

    fn writeSlot(self: Host, slot: u32, value: Value) !void {
        if (callbacks.write_slot(self, slot, value) != .OK) {
            return Error.Unknown;
        }
    }

    fn createStructure(self: Host, s_type: StructureType, name: []const u8) !Value {
        var def: Value = undefined;
        if (callbacks.create_structure(self, s_type, @ptrCast([*:0]const u8, name), &def) != .OK) {
            return Error.Unknown;
        }
        return def;
    }

    fn shapeStructure(self: Host, structure: Value, def: MemberSet) !void {
        if (callbacks.shape_structure(self, structure, &def) != .OK) {
            return Error.Unknown;
        }
    }

    fn attachVariables(self: Host, structure: Value, def: MemberSet) !void {
        if (callbacks.attach_variables(self, structure, &def) != .OK) {
            return Error.Unknown;
        }
    }

    fn attachMethods(self: Host, structure: Value, def: MethodSet) !void {
        if (callbacks.attach_methods(self, structure, &def) != .OK) {
            return Error.Unknown;
        }
    }
};

// export functions
fn getStructure(host: Host, comptime T: type) !Value {
    const s_slot = getStructureSlot(.{ .Type = T });
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

fn getMemberSet(host: Host, comptime T: type) !MemberSet {
    const members = try getMembers(host, T);
    const default_data = getDefaultData(T);
    const pointers = getDefaultPointers(T);
    return .{
        .members = @ptrCast([*]const Member, members),
        .member_count = members.len,
        .total_size = @sizeOf(T),
        .default_data = default_data,
        .default_pointers = if (pointers.len > 0) @ptrCast([*]const Memory, pointers) else null,
        .default_pointer_count = pointers.len,
    };
}

fn getVariableSet(host: Host, comptime T: type) !?MemberSet {
    if (StaticStruct(T)) |SS| {
        const members = getMembers(host, SS);
        const pointers = getDefaultPointers(SS);
        return .{
            .members = @ptrCast([*]const Member, members),
            .member_count = members.len,
            .default_pointers = pointers orelse null,
            .default_pointer_count = pointers.len orelse 0,
        };
    } else {
        return null;
    }
}

fn getMethodSet(host: Host, comptime T: type) !?MethodSet {
    const methods = try getMethods(host, T);
    if (methods.len == 0) {
        return null;
    }
    return .{
        .methods = @ptrCast([*]const Method, methods),
        .method_count = methods.len,
    };
}

fn getMembers(host: Host, comptime T: type) ![]const Member {
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
                .signed = isSigned(T),
                .bit_size = @bitSizeOf(T),
                .bit_offset = 0,
                .byte_size = @sizeOf(T),
            };
        },
        .Array => |ar| {
            members[0] = .{
                .member_type = getMemberType(ar.child),
                .signed = isSigned(ar.child),
                .bit_size = @bitSizeOf(ar.child),
                .bit_offset = 0,
                .byte_size = @sizeOf(ar.child),
            };
        },
        .Struct, .Union => {
            // pre-allocate relocatable slots for fields that always need them
            const fields = std.meta.fields(T);
            inline for (fields) |field| {
                switch (getMemberType(field.type)) {
                    .Pointer, .Compound, .Enum => {
                        _ = getRelocatableSlot(T, field.name);
                    },
                    else => {},
                }
            }
            inline for (fields, 0..) |field, index| {
                members[index] = .{
                    .name = field.name,
                    .member_type = getMemberType(field.type),
                    .signed = isSigned(field.type),
                    .bit_offset = @bitOffsetOf(T, field.name),
                    .bit_size = @bitSizeOf(field.type),
                    .byte_size = if (isPacked(T)) @sizeOf(field.type) else 0,
                    .structure = try getStructure(host, field.type),
                    .slot = getRelocatableSlot(T, field.name),
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
                    .signed = isSigned(IT),
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

fn getMethods(host: Host, comptime T: type) ![]const Method {
    const decls = switch (@typeInfo(T)) {
        .Struct => |st| st.decls,
        .Union => |st| st.decls,
        .Enum => |st| st.decls,
        .Opaque => |st| st.decls,
        else => return null,
    };
    var methods: [decls.len]Method = undefined;
    comptime var count = 0;
    inline for (decls) |decl| {
        if (!decl.is_pub) {
            continue;
        }
        switch (@typeInfo(@field(T, decl.name))) {
            .Fn => {
                const function = @field(T, decl.name);
                const ArgT = ArgumentStruct(function);
                const arg_structure = try getStructure(host, ArgT);
                methods[count] = .{
                    .name = decl.name,
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
    const fields = std.meta.fields(T);
    var pointers: [fields.len]Memory = undefined;
    comptime var count = 0;
    inline for (fields) |field| {
        switch (@typeInfo(field.type)) {
            .Pointer => {
                if (field.default_value) |default| {
                    const r_slot = getRelocatableSlot(T, field.name);
                    pointers[r_slot] = .{
                        .bytes = @ptrCast([*]u8, default),
                        .len = @sizeOf(@TypeOf(default.*)),
                    };
                    count += 1;
                }
            },
            else => {},
        }
    }
    return if (count > 0) pointers else pointers[0..0];
}

fn getDefaultData(comptime T: type) Memory {
    const fields = std.meta.fields(T);
    var structure: T = undefined;
    var bytes: []u8 = @intToPtr([*]u8, @ptrToInt(&structure))[0..@sizeOf(T)];
    @memset(bytes, 0xAA);
    inline for (fields) |field| {
        if (field.default_value) |default| {
            @field(structure, field.name) = default;
        }
    }
    return .{};
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
                fields[count] = .{
                    .name = decl.name,
                    .type = PT,
                    .default_value = &@field(T, decl.name),
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
    var noDecls: []const std.builtin.Type.Declaration = &.{};
    return @Type(.{
        .Struct = .{
            .layout = .Auto,
            .decls = noDecls,
            .fields = fields[0..count],
            .is_tuple = false,
        },
    });
}

fn ArgumentStruct(comptime function: anytype) type {
    const info = @typeInfo(@TypeOf(function)).Fn;
    const len = info.params.len + 1;
    const fields: std.builtin.Type.StructField[len] = undefined;
    for (info.params, 0..) |param, index| {
        const name = std.fmt.comptimePrint("{d}", index);
        fields[index] = .{
            .name = name,
            .type = param.type orelse void,
            .is_comptime = false,
            .alignment = @alignOf(param.type),
        };
    }
    fields[len - 1] = .{
        .name = "retval",
        .type = info.return_type,
        .is_comptime = false,
        .alignment = @alignOf(info.return_type),
    };
    var noDecls: []const std.builtin.Type.Declaration = &.{};
    return @Type(.{
        .Struct = .{
            .layout = .Auto,
            .decls = noDecls,
            .fields = fields[0..len],
            .is_tuple = false,
        },
    });
}

const invalid_address = if (@bitSizeOf(*u8) == 64) 0xaaaa_aaaa_aaaa_aaaa else 0xaaaa_aaaa;

fn invalidPointer(PT: type) PT {
    return @intToPtr(PT, invalid_address);
}

fn repointStructure(host: Host, obj: Value, T: type) !*T {
    _ = obj;
    _ = host;
}

fn depointStructure(host: Host, obj: Value, T: type) void {
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
            inline for (fields, 0..) |_, i| {
                const name = std.fmt.comptimePrint("{d}", i);
                args[i] = @field(arg_struct, name);
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

fn createRootFactory(comptime S: type) Factory {
    const RootFactory = struct {
        fn exportNamespace(host: Host, dest: *Value) callconv(.C) Result {
            if (getStructure(host, S)) |s| {
                dest.* = s;
                return .OK;
            } else |_| {
                return .Failure;
            }
        }
    };
    return RootFactory.exportNamespace;
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
    const Test = struct {};
    const module = createModule(Test);
    std.debug.assert(module.version == api_version);
}
