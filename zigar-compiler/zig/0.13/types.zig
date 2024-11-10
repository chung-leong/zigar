const std = @import("std");
const builtin = @import("builtin");
const expect = std.testing.expect;

pub const Error = error{
    Unknown,
    UnableToAllocateMemory,
    UnableToFreeMemory,
    UnableToRetrieveMemoryLocation,
    UnableToCreateDataView,
    UnableToCreateObject,
    UnableToObtainSlot,
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
    UnableToWriteToConsole,
    UnableToCreateFunction,
    UnableToUseThread,
    NotInMainThread,
    MultithreadingNotEnabled,
    TooManyArguments,
};

pub const ExportOptions = packed struct(u32) {
    omit_methods: bool = false,
    omit_variables: bool = false,
    _: u30 = 0,
};

pub const StructureType = enum(u32) {
    primitive = 0,
    array,
    @"struct",
    @"union",
    error_union,
    error_set,
    @"enum",
    optional,
    pointer,
    slice,
    vector,
    @"opaque",
    arg_struct,
    variadic_struct,
    function,
};

pub const StructureFlags = extern union {
    primitive: packed struct(u32) {
        has_value: bool = true,
        has_object: bool = false,
        has_pointer: bool = false,
        has_slot: bool = false,

        is_size: bool = false,
        _: u27 = 0,
    },
    array: packed struct(u32) {
        has_value: bool = false,
        has_object: bool = false,
        has_pointer: bool = false,
        has_slot: bool = false,

        has_sentinel: bool = false,
        is_string: bool = false,
        is_typed_array: bool = false,
        is_clamped_array: bool = false,

        _: u24 = 0,
    },
    @"struct": packed struct(u32) {
        has_value: bool = false,
        has_object: bool = false,
        has_pointer: bool = false,
        has_slot: bool = false,

        is_extern: bool = false,
        is_packed: bool = false,
        is_iterator: bool = false,
        is_tuple: bool = false,

        is_allocator: bool = false,
        is_promise: bool = false,
        is_abort_signal: bool = false,
        _: u21 = 0,
    },
    @"union": packed struct(u32) {
        has_value: bool = false,
        has_object: bool = false,
        has_pointer: bool = false,
        has_slot: bool = false,

        has_selector: bool = false,
        has_tag: bool = false,
        has_inaccessible: bool = false,
        is_extern: bool = false,

        is_packed: bool = false,
        is_iterator: bool = false,
        _: u22 = 0,
    },
    error_union: packed struct(u32) {
        has_value: bool = true,
        has_object: bool = false,
        has_pointer: bool = false,
        has_slot: bool = false,

        _: u28 = 0,
    },
    error_set: packed struct(u32) {
        has_value: bool = true,
        has_object: bool = false,
        has_pointer: bool = false,
        has_slot: bool = false,

        is_global: bool = false,
        _: u27 = 0,
    },
    @"enum": packed struct(u32) {
        has_value: bool = true,
        has_object: bool = false,
        has_pointer: bool = false,
        has_slot: bool = false,

        is_open_ended: bool = false,
        is_iterator: bool = false,
        _: u26 = 0,
    },
    optional: packed struct(u32) {
        has_value: bool = true,
        has_object: bool = false,
        has_pointer: bool = false,
        has_slot: bool = false,

        has_selector: bool = false,
        _: u27 = 0,
    },
    pointer: packed struct(u32) {
        has_value: bool = false,
        has_object: bool = false,
        has_pointer: bool = true,
        has_slot: bool = true,

        has_length: bool = false,
        is_multiple: bool = false,
        is_single: bool = false,
        is_const: bool = false,

        is_nullable: bool = false,
        _: u23 = 0,
    },
    slice: packed struct(u32) {
        has_value: bool = false,
        has_object: bool = false,
        has_pointer: bool = false,
        has_slot: bool = false,

        has_sentinel: bool = false,
        is_string: bool = false,
        is_typed_array: bool = false,
        is_clamped_array: bool = false,

        is_opaque: bool = false,
        _: u23 = 0,
    },
    vector: packed struct(u32) {
        has_value: bool = false,
        has_object: bool = false,
        has_pointer: bool = false,
        has_slot: bool = false,

        is_typed_array: bool = false,
        is_clamped_array: bool = false,
        _: u26 = 0,
    },
    @"opaque": packed struct(u32) {
        has_value: bool = false,
        has_object: bool = false,
        has_pointer: bool = false,
        has_slot: bool = false,

        is_iterator: bool = false,
        _: u27 = 0,
    },
    arg_struct: packed struct(u32) {
        has_value: bool = false,
        has_object: bool = false,
        has_pointer: bool = true,
        has_slot: bool = true,

        has_options: bool = false,
        is_throwing: bool = false,
        is_async: bool = false,
        _: u25 = 0,
    },
    variadic_struct: packed struct(u32) {
        has_value: bool = false,
        has_object: bool = false,
        has_pointer: bool = true,
        has_slot: bool = true,

        has_options: bool = false,
        is_throwing: bool = false,
        is_async: bool = false,
        _: u25 = 0,
    },
    function: packed struct(u32) {
        has_value: bool = false,
        has_object: bool = false,
        has_pointer: bool = false,
        has_slot: bool = false,

        _: u28 = 0,
    },
};

pub const MemberType = enum(u32) {
    void = 0,
    bool,
    int,
    uint,
    float,
    object,
    type,
    literal,
    null,
    undefined,
    unsupported,
};

pub const MemberFlags = packed struct(u32) {
    is_required: bool = false,
    is_read_only: bool = false,
    is_part_of_set: bool = false,
    is_selector: bool = false,

    is_method: bool = false,
    is_sentinel: bool = false,
    is_backing_int: bool = false,

    _: u25 = 0,
};

pub const Value = *opaque {};

pub const Structure = struct {
    name: ?[]const u8 = null,
    type: StructureType,
    flags: StructureFlags,
    length: ?usize,
    byte_size: ?usize,
    alignment: ?u16,
};

pub const ModuleAttributes = packed struct(u32) {
    little_endian: bool,
    runtime_safety: bool,
    libc: bool,
    _: u29 = 0,
};

pub const Member = struct {
    name: ?[]const u8 = null,
    type: MemberType,
    flags: MemberFlags,
    bit_offset: ?usize = null,
    bit_size: ?usize = null,
    byte_size: ?usize = null,
    slot: ?usize = null,
    structure: ?Value,
};

pub const MemoryAttributes = packed struct {
    alignment: u16 = 0,
    is_const: bool = false,
    is_comptime: bool = false,
    _: u14 = 0,
};

pub const MemoryType = enum(u32) {
    normal,
    scratch,
};

pub const Memory = struct {
    bytes: ?[*]u8 = null,
    len: usize = 0,
    attributes: MemoryAttributes = .{},

    pub fn from(ptr: anytype, is_comptime: bool) Memory {
        const PtrT = @TypeOf(ptr);
        const pt = @typeInfo(PtrT).Pointer;
        const address = switch (pt.size) {
            .Slice => @intFromPtr(ptr.ptr),
            else => @intFromPtr(ptr),
        };
        const invalid_address = create: {
            var invalid_ptr: *u8 = undefined;
            _ = &invalid_ptr;
            break :create @intFromPtr(invalid_ptr);
        };
        if (address == invalid_address) {
            return .{
                .attributes = .{
                    .is_const = pt.is_const,
                    .is_comptime = is_comptime,
                },
            };
        }
        const child_size = switch (@typeInfo(pt.child)) {
            .Fn => 0,
            else => @sizeOf(pt.child),
        };
        const len: usize = switch (pt.size) {
            .One => child_size,
            .Slice => child_size * ptr.len,
            .Many, .C => get: {
                if (address != 0) {
                    if (pt.sentinel) |opaque_ptr| {
                        const sentinel_ptr: *const pt.child = @ptrCast(@alignCast(opaque_ptr));
                        var len: usize = 0;
                        while (ptr[len] != sentinel_ptr.*) {
                            len += 1;
                        }
                        break :get (len + 1) * child_size;
                    } else {
                        break :get 1;
                    }
                } else {
                    break :get 0;
                }
            },
        };
        return .{
            .bytes = @ptrFromInt(address),
            .len = len,
            .attributes = .{
                .is_const = pt.is_const,
                .is_comptime = is_comptime,
            },
        };
    }

    test "from" {
        var a: i32 = 1234;
        const memA = from(&a, false);
        const b: []const u8 = "Hello";
        const memB = from(b, false);
        const c: [*]const u8 = b.ptr;
        const memC = from(c, true);
        const d: [*c]const u8 = b.ptr;
        const memD = from(d, false);
        const e = &b;
        const memE = from(e, false);
        const f: [*:0]const u8 = "Hello";
        const memF = from(f, false);
        try expect(memA.len == 4);
        try expect(memA.attributes.is_const == false);
        try expect(memB.len == 5);
        try expect(memB.attributes.is_const == true);
        try expect(memC.len == 1);
        try expect(memC.attributes.is_comptime == true);
        try expect(memD.len == 1);
        try expect(memD.attributes.is_const == true);
        try expect(memE.len == @sizeOf(@TypeOf(b)));
        try expect(memF.len == 6);
    }

    pub fn to(self: Memory, comptime PtrT: type) PtrT {
        const pt = @typeInfo(PtrT).Pointer;
        return switch (pt.size) {
            .One => @ptrCast(@alignCast(self.bytes)),
            .Slice => slice: {
                if (self.bytes == null) {
                    break :slice &.{};
                }
                const count = self.len / @sizeOf(pt.child);
                const many_ptr: [*]pt.child = @ptrCast(@alignCast(self.bytes));
                break :slice many_ptr[0..count];
            },
            .Many => @ptrCast(@alignCast(self.bytes)),
            .C => @ptrCast(@alignCast(self.bytes)),
        };
    }

    test "to" {
        var array: [5]u8 = .{ 'H', 'e', 'l', 'l', 'o' };
        const memory: @This() = .{
            .bytes = &array,
            .len = array.len,
        };
        const p1 = memory.to(*u8);
        try expect(p1.* == 'H');
        try expect(@typeInfo(@TypeOf(p1)).Pointer.size == .One);
        const p2 = memory.to([]u8);
        try expect(p2[0] == 'H');
        try expect(p2.len == 5);
        try expect(@typeInfo(@TypeOf(p2)).Pointer.size == .Slice);
        const p3 = memory.to([*]u8);
        try expect(p3[0] == 'H');
        try expect(@typeInfo(@TypeOf(p3)).Pointer.size == .Many);
        const p4 = memory.to([*c]u8);
        try expect(p4[0] == 'H');
        try expect(@typeInfo(@TypeOf(p4)).Pointer.size == .C);
    }
};

pub fn IntType(comptime n: comptime_int) type {
    comptime var bits = 8;
    const signedness = if (n < 0) .signed else .unsigned;
    return inline while (true) : (bits *= 2) {
        const T = @Type(.{ .Int = .{ .signedness = signedness, .bits = bits } });
        if (std.math.minInt(T) <= n and n <= std.math.maxInt(T)) {
            break T;
        }
    };
}

test "IntType" {
    try expectCT(IntType(0) == u8);
    try expectCT(IntType(0xFFFFFFFF) == u32);
    try expectCT(IntType(-0xFFFFFFFF) == i64);
    try expectCT(IntType(123) == u8);
    try expectCT(IntType(-123) == i8);
}

pub const ErrorIntType = @Type(.{
    .Int = .{
        .signedness = .unsigned,
        .bits = @bitSizeOf(anyerror),
    },
});

pub fn Uninlined(comptime FT: type) type {
    return switch (@typeInfo(FT)) {
        .Fn => |f| @Type(.{
            .Fn = .{
                .calling_convention = switch (f.calling_convention) {
                    .Inline => .Unspecified,
                    else => |cc| cc,
                },
                .is_generic = f.is_generic,
                .is_var_args = f.is_var_args,
                .return_type = f.return_type,
                .params = f.params,
            },
        }),
        else => @compileError("Not a function"),
    };
}

test "Uninlined" {
    try expect(Uninlined(fn () callconv(.Inline) void) == fn () void);
    try expect(Uninlined(fn () void) == fn () void);
}

fn ComptimeList(comptime T: type) type {
    return struct {
        entries: []T,
        len: comptime_int,

        fn init(comptime capacity: comptime_int) @This() {
            comptime var entries: [capacity]T = undefined;
            return .{ .entries = &entries, .len = 0 };
        }

        fn concat(comptime self: @This(), comptime value: T) @This() {
            if (self.len < self.entries.len) {
                self.entries[self.len] = value;
                return .{ .entries = self.entries, .len = self.len + 1 };
            } else {
                // need new array
                const capacity = if (self.entries.len > 0) 2 * self.entries.len else 1;
                comptime var entries: [capacity]T = undefined;
                inline for (self.entries, 0..) |entry, index| {
                    entries[index] = entry;
                }
                entries[self.len] = value;
                return .{ .entries = &entries, .len = self.len + 1 };
            }
        }

        fn slice(comptime self: @This()) []T {
            return self.entries[0..self.len];
        }
    };
}

test "ComptimeList.concat" {
    const List = ComptimeList(comptime_int);
    comptime var list = List.init(0);
    inline for (0..17) |index| {
        list = list.concat(index + 1000);
    }
    try expectCT(list.entries[4] == 1004);
    inline for (0..17) |index| {
        list = list.concat(index + 2000);
    }
    try expectCT(list.entries[0] == 1000);
    try expectCT(list.entries[16] == 1016);
    try expectCT(list.entries[17] == 2000);
    try expectCT(list.entries[33] == 2016);
}

pub const TypeAttributes = packed struct {
    is_supported: bool = false,
    is_comptime_only: bool = false,
    is_arguments: bool = false,
    is_variadic: bool = false,
    is_slice: bool = false,
    is_in_use: bool = true,
    has_pointer: bool = false,
    has_unsupported: bool = false,
    known: bool = false,
};

pub const TypeData = struct {
    type: type,
    slot: ?usize = null,
    attrs: TypeAttributes = .{},

    pub fn getSlot(comptime self: @This()) usize {
        return self.slot orelse @compileError("No assigned slot: " ++ @typeName(self.type));
    }

    pub fn getElementType(comptime self: @This()) type {
        return if (self.attrs.is_slice)
            self.type.ElementType
        else switch (@typeInfo(self.type)) {
            inline .Array, .Vector => |ar| ar.child,
            else => @compileError("Not an array, vector, or slice"),
        };
    }

    test "getElementType" {
        try expectCT(getElementType(.{ .type = Slice(u8, null), .attrs = .{ .is_slice = true } }) == u8);
    }

    pub fn getTargetType(comptime self: @This()) type {
        return switch (@typeInfo(self.type)) {
            .Pointer => |pt| switch (pt.size) {
                .One => if (pt.child == anyopaque) Slice(anyopaque, null) else pt.child,
                else => define: {
                    if (pt.sentinel) |ptr| {
                        const sentinel_ptr: *const pt.child = @alignCast(@ptrCast(ptr));
                        break :define Slice(pt.child, .{ .value = sentinel_ptr.* });
                    } else if (pt.size == .C and (pt.child == u8 or pt.child == u16)) {
                        break :define Slice(pt.child, .{ .value = 0, .is_required = false });
                    } else {
                        break :define Slice(pt.child, null);
                    }
                },
            },
            else => @compileError("Not a pointer"),
        };
    }

    test "getTargetType" {
        try expectCT(getTargetType(.{ .type = []i32 }) == Slice(i32, null));
        try expectCT(getTargetType(.{ .type = *const anyopaque }) == Slice(anyopaque, null));
        try expectCT(getTargetType(.{ .type = *i32 }) == i32);
    }

    pub fn getByteSize(comptime self: @This()) ?usize {
        if (self.attrs.is_slice and self.type.is_opaque) {
            // opaque types have unknown size
            return null;
        }
        return switch (@typeInfo(self.type)) {
            .Null, .Undefined, .Fn => 0,
            .Opaque => null,
            .ErrorSet => @sizeOf(anyerror),
            else => return @sizeOf(self.type),
        };
    }

    test "getByteSize" {
        try expectCT(getByteSize(.{ .type = void }) == 0);
        try expectCT(getByteSize(.{ .type = @TypeOf(null) }) == 0);
        try expectCT(getByteSize(.{ .type = u8 }) == 1);
    }

    pub fn getBitSize(comptime self: @This()) ?usize {
        return switch (@typeInfo(self.type)) {
            .Null, .Undefined, .Fn => 0,
            .Opaque => null,
            .ErrorSet => @bitSizeOf(anyerror),
            else => return @bitSizeOf(self.type),
        };
    }

    test "getBitSize" {
        try expectCT(getBitSize(.{ .type = void }) == 0);
        try expectCT(getBitSize(.{ .type = @TypeOf(null) }) == 0);
        try expectCT(getBitSize(.{ .type = u8 }) == 8);
    }

    pub fn getAlignment(comptime self: @This()) ?u16 {
        if (self.attrs.is_slice and self.type.is_opaque) {
            // opaque types have unknown alignment
            return null;
        }
        return switch (@typeInfo(self.type)) {
            .Null, .Undefined, .Fn => 0,
            .Opaque => null,
            .ErrorSet => @alignOf(anyerror),
            else => return @alignOf(self.type),
        };
    }

    test "getAlignment" {
        try expectCT(getAlignment(.{ .type = void }) == 1);
        try expectCT(getAlignment(.{ .type = u8 }) == 1);
        try expectCT(getAlignment(.{ .type = u32 }) == 4);
    }

    pub fn getSentinel(comptime self: @This()) ?Sentinel(self.getElementType()) {
        return if (self.attrs.is_slice)
            self.type.sentinel
        else switch (@typeInfo(self.type)) {
            inline .Array => |ar| if (ar.sentinel) |opaque_ptr| sentinel: {
                const ptr: *const self.getElementType() = @ptrCast(opaque_ptr);
                break :sentinel .{ .value = ptr.*, .is_required = true };
            } else null,
            else => @compileError("Not an array or slice"),
        };
    }

    test "getSentinel" {
        try expectCT(getSentinel(.{ .type = Slice(u8, .{ .value = 0 }), .attrs = .{ .is_slice = true } }).?.value == 0);
        try expectCT(getSentinel(.{ .type = Slice(i32, .{ .value = 7 }), .attrs = .{ .is_slice = true } }).?.value == 7);
        try expectCT(getSentinel(.{ .type = Slice(i32, .{ .value = -2 }), .attrs = .{ .is_slice = true } }).?.value == -2);
        try expectCT(getSentinel(.{ .type = Slice(i32, null), .attrs = .{ .is_slice = true } }) == null);
    }

    pub fn hasSelector(comptime self: @This()) bool {
        return switch (@typeInfo(self.type)) {
            .Union => self.getSelectorType() != null,
            .Optional => |op| switch (@typeInfo(op.child)) {
                .Pointer, .ErrorSet => false,
                else => true,
            },
            else => @compileError("Not a union or optional"),
        };
    }

    pub fn getSelectorType(comptime self: @This()) ?type {
        return switch (@typeInfo(self.type)) {
            .Union => |un| un.tag_type orelse switch (runtime_safety and un.layout != .@"extern") {
                true => IntType(un.fields.len),
                false => null,
            },
            .Optional => |op| switch (@typeInfo(op.child)) {
                .Pointer => usize, // size of the pointer itself
                .ErrorSet => ErrorIntType,
                else => u8,
            },
            else => @compileError("Not a union or optional"),
        };
    }

    test "getSelectorType" {
        const Tag = enum { cat, dog };
        const Union = union(Tag) {
            cat: u32,
            dog: u32,
        };
        try expectCT(getSelectorType(.{ .type = Union }) == Tag);
        if (runtime_safety) {
            const BareUnion = union {
                cat: u32,
                dog: u32,
            };
            try expectCT(getSelectorType(.{ .type = BareUnion }) == u8);
        }
    }

    pub fn getSelectorBitOffset(comptime self: @This()) comptime_int {
        return switch (@typeInfo(self.type)) {
            .Union => get: {
                const TT = self.getSelectorType().?;
                const fields = @typeInfo(self.type).Union.fields;
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
                break :get offset;
            },
            .Optional => |op| switch (@typeInfo(op.child)) {
                .Pointer, .ErrorSet => 0, // offset of the pointer/error itself
                else => @sizeOf(op.child) * 8,
            },
            else => @compileError("Not a union or optional"),
        };
    }

    test "getSelectorBitOffset" {
        const Union = union(enum) {
            cat: i32,
            dog: i32,
        };
        try expectCT(getSelectorBitOffset(.{ .type = Union }) == 32);
    }

    pub fn getErrorBitOffset(comptime self: @This()) comptime_int {
        return switch (@typeInfo(self.type)) {
            // value is placed after the error number if its alignment is smaller than that of anyerror
            .ErrorUnion => |eu| if (@alignOf(anyerror) > @alignOf(eu.payload)) 0 else @sizeOf(eu.payload) * 8,
            else => @compileError("Not an error union"),
        };
    }

    pub fn getContentBitOffset(comptime self: @This()) comptime_int {
        return switch (@typeInfo(self.type)) {
            .Union => if (self.getSelectorType()) |TT| switch (self.getSelectorBitOffset()) {
                0 => @sizeOf(TT) * 8,
                else => 0,
            } else 0,
            .Optional => 0,
            .ErrorUnion => switch (self.getErrorBitOffset()) {
                0 => @sizeOf(anyerror) * 8,
                else => 0,
            },
            else => @compileError("Not a union, error union, or optional"),
        };
    }

    test "getContentBitOffset" {
        const Union = union(enum) {
            cat: i32,
            dog: i32,
        };
        try expectCT(getContentBitOffset(.{ .type = Union }) == 0);
    }

    pub fn isConst(comptime self: @This()) bool {
        return switch (@typeInfo(self.type)) {
            .Pointer => |pt| pt.is_const,
            else => false,
        };
    }

    test "isConst" {
        try expectCT(isConst(.{ .type = i32 }) == false);
        try expectCT(isConst(.{ .type = *i32 }) == false);
        try expectCT(isConst(.{ .type = *const i32 }) == true);
    }

    pub fn isPacked(comptime self: @This()) bool {
        return switch (@typeInfo(self.type)) {
            .Struct => |st| st.layout == .@"packed",
            .Union => |un| un.layout == .@"packed",
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
        try expectCT(isPacked(.{ .type = A }) == false);
        try expectCT(isPacked(.{ .type = B }) == true);
    }

    pub fn isBitVector(comptime self: @This()) bool {
        return switch (@typeInfo(self.type)) {
            .Vector => |ve| @sizeOf(ve.child) * ve.len > @sizeOf(self.type),
            else => false,
        };
    }

    test "isBitVector" {
        const A = @Vector(8, bool);
        const B = @Vector(4, f32);
        try expectCT(isBitVector(.{ .type = A }) == true);
        try expectCT(isBitVector(.{ .type = B }) == false);
    }

    fn PayloadType(comptime T: type) ?type {
        return switch (@typeInfo(T)) {
            .Optional => |op| op.child,
            .ErrorUnion => |eu| PayloadType(eu.payload),
            else => null,
        };
    }

    test "PayloadType" {
        const T1 = PayloadType(?i32) orelse unreachable;
        try expect(T1 == i32);
        const T2 = PayloadType(anyerror!?i32) orelse unreachable;
        try expect(T2 == i32);
        const T3 = PayloadType(i32);
        try expect(T3 == null);
    }

    fn NextMethodReturnType(comptime FT: type, comptime T: type) ?type {
        const f = @typeInfo(FT).Fn;
        if (f.return_type) |RT| {
            const param_match = switch (f.params.len) {
                1 => f.params[0].type == *T,
                2 => f.params[0].type == *T and f.params[1].type == std.mem.Allocator,
                else => false,
            };
            if (param_match) {
                if (PayloadType(RT)) |PT| {
                    return PT;
                }
            }
        }
        return null;
    }

    test "NextMethodReturnType" {
        const S = struct {
            pub fn next1(_: *@This()) ?i32 {
                return null;
            }

            pub fn next2(_: *@This()) !?i32 {
                return null;
            }

            pub fn next3(_: *@This(), _: i32) !?i32 {
                return null;
            }

            pub fn next4(_: i32) !?i32 {
                return null;
            }

            pub fn next5(_: *@This()) i32 {
                return 0;
            }
        };
        const T1 = NextMethodReturnType(@TypeOf(S.next1), S) orelse unreachable;
        try expect(T1 == i32);
        const T2 = NextMethodReturnType(@TypeOf(S.next2), S) orelse unreachable;
        try expect(T2 == i32);
        const T3 = NextMethodReturnType(@TypeOf(S.next3), S);
        try expect(T3 == null);
        const T4 = NextMethodReturnType(@TypeOf(S.next4), S);
        try expect(T4 == null);
        const T5 = NextMethodReturnType(@TypeOf(S.next5), S);
        try expect(T5 == null);
    }

    pub fn isIterator(comptime self: @This()) bool {
        switch (@typeInfo(self.type)) {
            .Struct, .Union, .Opaque => if (@hasDecl(self.type, "next")) {
                const next = @field(self.type, "next");
                if (NextMethodReturnType(@TypeOf(next), self.type)) |_| {
                    return true;
                }
            },
            else => {},
        }
        return false;
    }

    test "isIterator" {
        try expect(isIterator(.{ .type = std.mem.SplitIterator(u8, .sequence) }));
        try expect(isIterator(.{ .type = std.fs.path.ComponentIterator(.posix, u8) }));
        try expect(isIterator(.{ .type = std.fs.path }) == false);
    }

    pub fn isMethodOf(comptime self: @This(), comptime T: type) bool {
        switch (@typeInfo(self.type)) {
            .Fn => |f| {
                if (f.params.len > 0) {
                    if (f.params[0].type) |PT| {
                        return (PT == T) or switch (@typeInfo(PT)) {
                            .Pointer => |pt| pt.child == T,
                            else => false,
                        };
                    }
                }
            },
            else => {},
        }
        return false;
    }

    test "isMethodOf" {
        const A = struct {
            number: i32 = 0,

            fn a() void {}
            fn b(_: i32) void {}
            fn c(_: @This()) void {}
            fn d(_: *@This()) void {}
            fn e(_: *const @This()) void {}
        };
        const B = struct {};
        try expect(isMethodOf(.{ .type = @TypeOf(A.a) }, A) == false);
        try expect(isMethodOf(.{ .type = @TypeOf(A.b) }, A) == false);
        try expect(isMethodOf(.{ .type = @TypeOf(A.c) }, A) == true);
        try expect(isMethodOf(.{ .type = @TypeOf(A.d) }, A) == true);
        try expect(isMethodOf(.{ .type = @TypeOf(A.e) }, A) == true);
        try expect(isMethodOf(.{ .type = @TypeOf(A.e) }, B) == false);
        try expect(isMethodOf(.{ .type = u32 }, B) == false);
    }

    pub fn hasPointer(comptime self: @This()) bool {
        return self.attrs.has_pointer;
    }

    pub fn isPointer(comptime self: @This()) bool {
        return switch (@typeInfo(self.type)) {
            .Pointer => true,
            else => false,
        };
    }

    pub fn isObject(comptime self: @This()) bool {
        return switch (@typeInfo(self.type)) {
            .Struct, .Union, .Array, .ErrorUnion, .Optional, .Pointer, .Vector, .Fn => true,
            else => false,
        };
    }

    pub fn isArguments(comptime self: @This()) bool {
        return self.attrs.is_arguments;
    }

    pub fn isSlice(comptime self: @This()) bool {
        return self.attrs.is_slice;
    }

    pub fn isOptional(comptime self: @This()) bool {
        return self.isAllocator() or self.isPromise() or self.isAbortSignal();
    }

    pub fn isAllocator(comptime self: @This()) bool {
        return self.type == std.mem.Allocator;
    }

    pub fn isPromise(comptime self: @This()) bool {
        return comptime isInternal(self.type) and @hasDecl(self.type, "Payload");
    }

    pub fn isAbortSignal(comptime self: @This()) bool {
        return self.type == AbortSignal;
    }

    pub fn isSupported(comptime self: @This()) bool {
        return self.attrs.is_supported;
    }

    pub fn isComptimeOnly(comptime self: @This()) bool {
        return self.attrs.is_comptime_only;
    }

    pub fn isInUse(comptime self: @This()) bool {
        return self.attrs.is_in_use;
    }
};

pub const TypeDataCollector = struct {
    types: ComptimeList(TypeData),
    functions: ComptimeList(type),
    next_slot: usize = 0,

    pub fn init(comptime capacity: comptime_int) @This() {
        return .{
            .types = ComptimeList(TypeData).init(capacity),
            .functions = ComptimeList(type).init(capacity / 8),
        };
    }

    pub fn scan(comptime self: *@This(), comptime T: type) void {
        // add all types first
        self.add(T);
        inline for (self.types.slice()) |*td| {
            // set attributes like is_supported and has_pointer
            self.setAttributes(td);
            if (td.isSupported()) {
                // assign slots to supported types
                self.setSlot(td);
            }
        }
    }

    pub fn createDatabase(comptime self: *const @This()) TypeDatabase(self.types.len) {
        comptime var tdb: TypeDatabase(self.types.len) = undefined;
        inline for (self.types.slice(), 0..) |td, index| {
            tdb.entries[index] = td;
        }
        return tdb;
    }

    test "createDatabase" {
        @setEvalBranchQuota(10000);
        const ns = struct {
            pub const StructA = struct {
                number: i32,
                string: []const u8,
            };
            pub const StructB = struct {
                function: *const fn () void,
            };
            pub const StructC = struct {
                number: i32 = 0,
                ptr: *@This(),
            };
            pub const StructD = struct {
                function: fn () void,
                ptr: *@This(),
            };
            pub const UnionA = union(enum) {
                cat: u32,
                dog: u32,
            };

            pub const a1: StructA = .{ .number = 123, .string = "Hello" };
            pub var a2: StructA = .{ .number = 123, .string = "Hello" };

            pub fn normal() void {}

            pub fn generic1(comptime T: type) void {
                _ = T;
            }

            pub fn generic2(arg: anytype) @TypeOf(arg) {}
        };
        comptime var tdc = init(0);
        comptime tdc.scan(ns);
        const tdb = comptime tdc.createDatabase();
        try expectCT(tdb.get(ns.StructA).attrs.is_supported == true);
        try expectCT(tdb.get(ns.StructB).attrs.is_supported == true);
        try expectCT(tdb.get(@TypeOf(ns.normal)).attrs.is_supported == true);
        try expectCT(tdb.get(@TypeOf(ns.generic1)).attrs.is_supported == false);
        try expectCT(tdb.get(@TypeOf(ns.generic2)).attrs.is_supported == false);
        try expectCT(tdb.get(*ns.StructA).attrs.is_supported == true);
        try expectCT(tdb.get(*const ns.StructA).attrs.is_supported == true);
        try expectCT(tdb.get(ns.StructC).attrs.is_supported == true);
        try expectCT(tdb.get(ns.StructD).attrs.is_supported == true);
        try expectCT(tdb.get(ns.UnionA).attrs.is_supported == true);
    }

    fn append(comptime self: *@This(), comptime td: TypeData) void {
        const T = td.type;
        if (self.indexOf(T)) |index| {
            if (td.attrs.is_in_use) {
                const existing_td = self.at(index);
                if (!existing_td.attrs.is_in_use) {
                    existing_td.attrs.is_in_use = true;
                }
            }
            return;
        }
        const index = self.types.len;
        self.types = self.types.concat(td);
        // add fields and function args/retval
        switch (@typeInfo(T)) {
            .ErrorUnion => |eu| {
                self.add(eu.payload);
                self.add(eu.error_set);
            },
            .Fn => |f| {
                if (!f.is_generic) {
                    inline for (f.params) |param| {
                        if (param.type) |PT| {
                            if (PT != std.mem.Allocator) {
                                self.add(PT);
                            }
                        }
                    }
                    if (f.return_type) |RT| self.add(RT);
                }
            },
            inline .Array, .Vector, .Optional, .Pointer => |ar| {
                self.add(ar.child);
            },
            inline .Struct, .Union => |st, Tag| {
                inline for (st.fields) |field| {
                    self.add(field.type);
                    if (Tag == .Struct and field.is_comptime) {
                        // deal with comptime fields
                        const def_value_ptr: *const field.type = @ptrCast(@alignCast(field.default_value.?));
                        self.addTypeOf(def_value_ptr.*);
                    }
                }
            },
            else => {},
        }
        // add decls
        switch (@typeInfo(T)) {
            inline .Struct, .Union, .Enum, .Opaque => |st| {
                inline for (st.decls) |decl| {
                    // decls are accessed through pointers
                    const PT = @TypeOf(&@field(T, decl.name));
                    _ = self.append(.{ .type = PT, .attrs = .{ .is_in_use = false } });
                    if (@typeInfo(PT).Pointer.is_const) {
                        self.addTypeOf(@field(T, decl.name));
                    }
                }
            },
            else => {},
        }
        // add other implicit types
        switch (@typeInfo(T)) {
            .NoReturn => self.add(void),
            .Pointer => |pt| {
                const TT = TypeData.getTargetType(.{ .type = T });
                if (TT != pt.child) {
                    self.append(.{
                        .type = TT,
                        .attrs = .{ .is_slice = true },
                    });
                }
                self.add(usize);
            },
            .ErrorSet => self.add(ErrorIntType),
            .Struct => |st| if (st.backing_integer) |IT| self.add(IT),
            .Fn => |f| if (!f.is_generic) {
                const ArgT = ArgumentStruct(T);
                self.append(.{
                    .type = ArgT,
                    .attrs = .{
                        .is_arguments = true,
                        .is_variadic = f.is_var_args,
                    },
                });
                if (f.calling_convention == .Inline) {
                    self.add(Uninlined(T));
                }
            },
            inline .Union, .Optional => if (self.at(index).getSelectorType()) |ST| {
                self.add(ST);
            },
            else => {},
        }
    }

    fn add(comptime self: *@This(), comptime T: type) void {
        self.append(.{ .type = T });
    }

    fn addTypeOf(comptime self: *@This(), comptime value: anytype) void {
        const T = @TypeOf(value);
        switch (@typeInfo(T)) {
            .Type => self.add(value),
            .ComptimeFloat => self.add(*const f64),
            .ComptimeInt => self.add(*const IntType(value)),
            .EnumLiteral => self.add(@TypeOf(removeSentinel(@tagName(value)))),
            .Optional => if (value) |v| self.addTypeOf(v),
            .ErrorUnion => if (value) |v| self.addTypeOf(v) else |_| {},
            .Union => |un| {
                if (un.tag_type) |TT| {
                    const active_tag: TT = value;
                    inline for (un.fields) |field| {
                        if (active_tag == @field(TT, field.name)) {
                            self.addTypeOf(@field(value, field.name));
                            break;
                        }
                    }
                }
            },
            .Struct => |st| inline for (st.fields) |field| self.addTypeOf(@field(value, field.name)),
            .Array => inline for (value) |element| self.addTypeOf(element),
            // add function to the list so we can create its arg struct later
            .Fn => self.functions = self.functions.concat(T),
            else => {},
        }
    }

    fn get(comptime self: *@This(), comptime T: type) *TypeData {
        const index = self.indexOf(T) orelse @compileError("No type data: " ++ @typeName(T));
        return self.at(index);
    }

    fn at(comptime self: *@This(), comptime index: usize) *TypeData {
        return &self.types.entries[index];
    }

    fn indexOf(comptime self: *@This(), comptime T: type) ?usize {
        return inline for (self.types.slice(), 0..) |td, index| {
            if (td.type == T) {
                break index;
            }
        } else null;
    }

    fn getSlot(comptime self: *@This(), comptime td: *TypeData) usize {
        self.setSlot(td);
        return td.slot.?;
    }

    fn setSlot(comptime self: *@This(), comptime td: *TypeData) void {
        if (td.slot != null) {
            return;
        }
        td.slot = self.next_slot;
        self.next_slot += 1;
    }

    fn getAttributes(comptime self: *@This(), comptime T: type) TypeAttributes {
        const td = self.get(T);
        self.setAttributes(td);
        return td.attrs;
    }

    fn setAttributes(comptime self: *@This(), comptime td: *TypeData) void {
        if (td.attrs.known) {
            return;
        }
        // prevent endless recursion
        td.attrs.known = true;
        switch (@typeInfo(td.type)) {
            .Bool,
            .Int,
            .Float,
            .Void,
            .ErrorSet,
            .Enum,
            .Opaque,
            .Vector,
            .NoReturn,
            => td.attrs.is_supported = true,
            .Type,
            .ComptimeFloat,
            .ComptimeInt,
            .EnumLiteral,
            .Null,
            .Undefined,
            => {
                td.attrs.is_supported = true;
                td.attrs.is_comptime_only = true;
            },
            .ErrorUnion => |eu| {
                const payload_attrs = self.getAttributes(eu.payload);
                td.attrs.is_supported = payload_attrs.is_supported;
                td.attrs.is_comptime_only = payload_attrs.is_comptime_only;
                td.attrs.has_pointer = payload_attrs.has_pointer;
            },
            .Pointer => |pt| {
                const child_attrs = self.getAttributes(pt.child);
                td.attrs.is_supported = child_attrs.is_supported;
                td.attrs.is_comptime_only = child_attrs.is_comptime_only;
                td.attrs.has_pointer = true;
            },
            inline .Array, .Optional => |ar| {
                const child_attrs = self.getAttributes(ar.child);
                td.attrs.is_supported = child_attrs.is_supported;
                td.attrs.is_comptime_only = child_attrs.is_comptime_only;
                td.attrs.has_pointer = child_attrs.has_pointer;
            },
            .Struct => |st| {
                td.attrs.is_supported = true;
                inline for (st.fields) |field| {
                    if (!field.is_comptime) {
                        const field_attrs = self.getAttributes(field.type);
                        if (!field_attrs.is_supported or field_attrs.has_unsupported) {
                            td.attrs.has_unsupported = true;
                        }
                        if (field_attrs.is_comptime_only) {
                            td.attrs.is_comptime_only = true;
                        }
                        if (field_attrs.has_pointer) {
                            td.attrs.has_pointer = true;
                        }
                    }
                }
            },
            .Union => |un| {
                td.attrs.is_supported = true;
                inline for (un.fields) |field| {
                    const field_attrs = self.getAttributes(field.type);
                    if (field_attrs.is_comptime_only) {
                        td.attrs.is_comptime_only = true;
                    }
                    if (field_attrs.has_pointer) {
                        td.attrs.has_pointer = true;
                    }
                }
            },
            .Fn => |f| {
                if (!f.is_generic) {
                    td.attrs.is_supported = comptime for (f.params) |param| {
                        if (param.is_generic) break false;
                        const PT = param.type orelse break false;
                        const param_attrs = self.getAttributes(PT);
                        if (param_attrs.is_comptime_only) {
                            @compileLog(param);
                        }
                    } else for (.{1}) |_| {
                        const RT = f.return_type orelse break false;
                        const retval_attrs = self.getAttributes(RT);
                        if (retval_attrs.is_comptime_only) break false;
                    } else true;
                }
            },
            else => {},
        }
    }

    test "scan" {
        @setEvalBranchQuota(10000);
        const ns = struct {
            pub const StructA = struct {
                number: i32,
                string: []const u8,
            };
        };
        comptime var tdc = init(0);
        comptime tdc.scan(ns);
        try expectCT(tdc.indexOf(ns.StructA) != null);
    }

    test "setAttributes" {
        @setEvalBranchQuota(10000);
        const ns = struct {
            pub const StructA = struct {
                number: i32,
                string: []const u8,
            };
            pub const StructB = struct {
                comptime Type: type = *const fn () void,
                function: *const fn () void,
            };
            pub const StructC = struct {
                number: i32 = 0,
                ptr: ?*@This(),
            };
            pub const StructD = struct {
                function: fn () void,
                ptr: *@This(),
            };
            pub const UnionA = union(enum) {
                cat: u32,
                dog: u32,

                pub const weird = noreturn;
            };
            pub const EnumA = enum {
                apple,
                orange,

                pub fn hello(_: u17) i18 {
                    return 0;
                }
            };

            pub var a: StructA = undefined;
            pub var b: StructB = undefined;
            pub const c: StructC = .{ .number = 1, .ptr = null };

            pub const optional_type: ?type = null;
            pub const Null = null;
            pub const Undefined = undefined;

            pub const A = struct {
                number: i32,
            };
            pub const B = struct {
                number: i32,
                a: A,
            };
            pub const C = struct {
                number: i32,
                a: A,
                pointer: [*]i32,
            };
            pub const D = union {
                a: A,
                c: C,
            };
            pub const E = struct {
                number: i32,
                comptime pointer: ?*u32 = null,
            };

            pub var slice_of_slices: [][]u8 = undefined;
            pub var array_of_pointers: [5]*u8 = undefined;

            pub fn normal() void {}

            pub fn generic1(comptime T: type) void {
                _ = T;
            }

            pub fn generic2(arg: anytype) @TypeOf(arg) {}
        };
        comptime var tdc = init(0);
        comptime tdc.scan(ns);
        // is_supported
        try expectCT(tdc.get(ns.StructA).attrs.is_supported == true);
        try expectCT(tdc.get(ns.StructB).attrs.is_supported == true);
        try expectCT(tdc.get(@TypeOf(ns.normal)).attrs.is_supported == true);
        try expectCT(tdc.get(@TypeOf(ns.generic1)).attrs.is_supported == false);
        try expectCT(tdc.get(@TypeOf(ns.generic2)).attrs.is_supported == false);
        try expectCT(tdc.get(*ns.StructA).attrs.is_supported == true);
        try expectCT(tdc.get(*ns.StructB).attrs.is_supported == true);
        try expectCT(tdc.get(ns.StructC).attrs.is_supported == true);
        try expectCT(tdc.get(ns.StructD).attrs.is_supported == true);
        try expectCT(tdc.get(ns.UnionA).attrs.is_supported == true);
        try expectCT(tdc.get(@TypeOf(null)).attrs.is_supported == true);
        try expectCT(tdc.get(@TypeOf(undefined)).attrs.is_supported == true);
        try expectCT(tdc.get(noreturn).attrs.is_supported == true);
        try expectCT(tdc.get(u17).attrs.is_supported == true);
        try expectCT(tdc.get(i18).attrs.is_supported == true);
        // pointer should include this
        try expectCT(tdc.get(usize).attrs.is_supported == true);

        // is_comptime_only
        try expectCT(tdc.get(type).attrs.is_comptime_only == true);
        try expectCT(tdc.get(*const type).attrs.is_comptime_only == true);
        try expectCT(tdc.get(?type).attrs.is_comptime_only == true);
        // has_pointer
        try expectCT(tdc.get(i32).attrs.has_pointer == false);
        try expectCT(tdc.get([*]i32).attrs.has_pointer == true);
        try expectCT(tdc.get([]const u8).attrs.has_pointer == true);
        try expectCT(tdc.get([5]*u8).attrs.has_pointer == true);
        try expectCT(tdc.get([][]u8).attrs.has_pointer == true);
        try expectCT(tdc.get(ns.A).attrs.has_pointer == false);
        try expectCT(tdc.get(ns.B).attrs.has_pointer == false);
        try expectCT(tdc.get(ns.C).attrs.has_pointer == true);
        try expectCT(tdc.get(ns.D).attrs.has_pointer == true);
        // comptime fields should be ignored
        try expectCT(tdc.get(ns.E).attrs.has_pointer == false);
    }
};

fn TypeDatabase(comptime len: comptime_int) type {
    return struct {
        entries: [len]TypeData,

        pub fn get(comptime self: @This(), comptime T: type) TypeData {
            return inline for (self.entries) |entry| {
                if (entry.type == T) {
                    break entry;
                }
            } else @compileError("No type data for " ++ @typeName(T));
        }

        pub fn has(comptime self: @This(), comptime T: type) bool {
            return inline for (self.entries) |entry| {
                if (entry.type == T) {
                    break true;
                }
            } else false;
        }
    };
}

fn Sentinel(comptime T: type) type {
    const ET = switch (@typeInfo(T)) {
        .Opaque => u8,
        else => T,
    };
    return struct {
        value: ET,
        is_required: bool = true,
    };
}

pub fn Slice(comptime T: type, comptime s: ?Sentinel(T)) type {
    const ET = switch (@typeInfo(T)) {
        .Opaque => u8,
        else => T,
    };
    return struct {
        pub const ElementType = ET;
        pub const sentinel = s;
        pub const is_opaque = ET != T;

        element: ET,
    };
}

test "Slice" {
    const A = Slice(u8, null);
    const B = Slice(u8, null);
    const C = Slice(u8, .{ .value = 0 });
    try expect(A == B);
    try expect(C != B);
}

pub fn ArgumentStruct(comptime T: type) type {
    const f = @typeInfo(T).Fn;
    const count = get: {
        var count = 1;
        for (f.params) |param| {
            if (param.type != null) {
                count += 1;
            }
        }
        break :get count;
    };
    const RT = if (f.return_type) |RT| switch (RT) {
        noreturn => void,
        else => RT,
    } else void;
    var fields: [count]std.builtin.Type.StructField = undefined;
    fields[0] = .{
        .name = "retval",
        .type = RT,
        .is_comptime = false,
        .alignment = @alignOf(RT),
        .default_value = null,
    };
    var arg_index = 0;
    for (f.params) |param| {
        if (param.type != null) {
            const name = std.fmt.comptimePrint("{d}", .{arg_index});
            fields[arg_index + 1] = .{
                .name = name,
                .type = param.type.?,
                .is_comptime = false,
                .alignment = @alignOf(param.type.?),
                .default_value = null,
            };
            arg_index += 1;
        }
    }
    return @Type(.{
        .Struct = .{
            .layout = .auto,
            .decls = &.{},
            .fields = &fields,
            .is_tuple = false,
        },
    });
}

test "ArgumentStruct" {
    const ns = struct {
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
    const ArgA = ArgumentStruct(@TypeOf(ns.A));
    const fieldsA = std.meta.fields(ArgA);
    try expect(fieldsA.len == 3);
    try expect(fieldsA[0].name[0] == 'r');
    try expect(fieldsA[1].name[0] == '0');
    try expect(fieldsA[2].name[0] == '1');
    const ArgB = ArgumentStruct(@TypeOf(ns.B));
    const fieldsB = std.meta.fields(ArgB);
    try expect(fieldsB.len == 2);
    try expect(fieldsB[0].name[0] == 'r');
    try expect(fieldsB[1].name[0] == '0');
    const ArgC = ArgumentStruct(@TypeOf(ns.C));
    const fieldsC = std.meta.fields(ArgC);
    try expect(fieldsC.len == 4);
}

pub fn FnPointerTarget(comptime T: type) type {
    return switch (@typeInfo(T)) {
        .Pointer => |pt| switch (@typeInfo(pt.child)) {
            .Fn => pt.child,
            else => @compileError("Not a function pointer"),
        },
        else => @compileError("Not a function pointer"),
    };
}

test "FnPointerTarget" {
    const FT = FnPointerTarget(*const fn () void);
    try expect(FT == fn () void);
}

pub fn removeSentinel(comptime ptr: anytype) retval_type: {
    const PT = @TypeOf(ptr);
    var pt = @typeInfo(PT).Pointer;
    var ar = @typeInfo(pt.child).Array;
    ar.sentinel = null;
    pt.child = @Type(.{ .Array = ar });
    break :retval_type @Type(.{ .Pointer = pt });
} {
    return @ptrCast(ptr);
}

const Internal = opaque {};

pub fn Promise(comptime T: type, release: anytype) type {
    return struct {
        callback: *const fn (T) void,

        const Payload = T;
        const Opaque = Internal;

        pub inline fn resolve(self: @This(), value: T) void {
            self.callback(value);
            release(self.callback) catch {};
        }
    };
}

pub const AbortSignal = struct {
    ptr: *const volatile i32,

    const Opaque = Internal;

    pub inline fn on(self: @This()) bool {
        return self.ptr.* != 0;
    }

    pub inline fn off(self: @This()) bool {
        return self.ptr.* == 0;
    }
};

pub fn isInternal(comptime T: type) bool {
    return switch (@typeInfo(T)) {
        .Struct => @hasDecl(T, "Opaque") and @field(T, "Opaque") == Internal,
        else => false,
    };
}

test "isInternal" {
    try expectCT(isInternal(AbortSignal) == true);
    try expectCT(isInternal(struct {}) == false);
    try expectCT(isInternal(Promise(f64, undefined)) == true);
    try expectCT(isInternal(Promise(anyerror!u32, undefined)) == true);
}

fn expectCT(comptime value: bool) !void {
    try expect(value);
}

test {
    _ = Memory;
    _ = TypeData;
    _ = TypeDataCollector;
}

const runtime_safety = (builtin.mode == .ReleaseSafe or builtin.mode == .Debug);
