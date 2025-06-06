const std = @import("std");
const expect = std.testing.expect;
const expectEqualSlices = std.testing.expectEqualSlices;
const expectEqual = std.testing.expectEqual;
const expectError = std.testing.expectError;
const builtin = @import("builtin");

pub const Result = enum(u32) {
    ok,
    failure,
    failure_deadlock,
    failure_disabled,
};

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
    MainThreadNotFound,
    MultithreadingNotEnabled,
    TooManyArguments,
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

pub const StructurePurpose = enum(u32) {
    unknown,
    promise,
    generator,
    abort_signal,
    allocator,
    iterator,
    reader,
    writer,

    pub fn isOptional(self: @This()) bool {
        return switch (self) {
            .promise, .generator, .abort_signal, .allocator => true,
            else => false,
        };
    }
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
        is_tuple: bool = false,
        is_optional: bool = false,

        _: u24 = 0,
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
        _: u23 = 0,
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
        _: u27 = 0,
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

        _: u28 = 0,
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
    is_string: bool = false,

    _: u24 = 0,
};

pub const Value = *opaque {};

pub const Structure = struct {
    name: ?[]const u8 = null,
    type: StructureType,
    purpose: StructurePurpose,
    flags: StructureFlags,
    signature: u64,
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

pub const Memory = struct {
    bytes: ?[*]u8 = null,
    len: usize = 0,
    attributes: MemoryAttributes = .{},

    pub fn from(ptr: anytype, is_comptime: bool) Memory {
        const PtrT = @TypeOf(ptr);
        const pt = @typeInfo(PtrT).pointer;
        const address = switch (pt.size) {
            .slice => @intFromPtr(ptr.ptr),
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
            .@"fn" => 0,
            else => @sizeOf(pt.child),
        };
        const len: usize = switch (pt.size) {
            .one => child_size,
            .slice => child_size * ptr.len,
            .many, .c => get: {
                if (address != 0) {
                    if (pt.sentinel_ptr) |opaque_ptr| {
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
        try expectEqual(4, memA.len);
        try expectEqual(false, memA.attributes.is_const);
        try expectEqual(5, memB.len);
        try expectEqual(true, memB.attributes.is_const);
        try expectEqual(1, memC.len);
        try expectEqual(true, memC.attributes.is_comptime);
        try expectEqual(1, memD.len);
        try expectEqual(true, memD.attributes.is_const);
        try expectEqual(@sizeOf(@TypeOf(b)), memE.len);
        try expectEqual(6, memF.len);
    }

    pub fn to(self: Memory, comptime PtrT: type) PtrT {
        const pt = @typeInfo(PtrT).pointer;
        return switch (pt.size) {
            .one => @ptrCast(@alignCast(self.bytes)),
            .slice => slice: {
                if (self.bytes == null) {
                    break :slice &.{};
                }
                const count = self.len / @sizeOf(pt.child);
                const many_ptr: [*]pt.child = @ptrCast(@alignCast(self.bytes));
                break :slice many_ptr[0..count];
            },
            .many => @ptrCast(@alignCast(self.bytes)),
            .c => @ptrCast(@alignCast(self.bytes)),
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
        try expect(@typeInfo(@TypeOf(p1)).pointer.size == .one);
        const p2 = memory.to([]u8);
        try expect(p2[0] == 'H');
        try expect(p2.len == 5);
        try expect(@typeInfo(@TypeOf(p2)).pointer.size == .slice);
        const p3 = memory.to([*]u8);
        try expect(p3[0] == 'H');
        try expect(@typeInfo(@TypeOf(p3)).pointer.size == .many);
        const p4 = memory.to([*c]u8);
        try expect(p4[0] == 'H');
        try expect(@typeInfo(@TypeOf(p4)).pointer.size == .c);
    }
};

pub fn IntFor(comptime n: comptime_int) type {
    comptime var bits = 8;
    const signedness = if (n < 0) .signed else .unsigned;
    return inline while (true) : (bits *= 2) {
        const T = @Type(.{ .int = .{ .signedness = signedness, .bits = bits } });
        if (std.math.minInt(T) <= n and n <= std.math.maxInt(T)) {
            break T;
        }
    };
}

test "IntFor" {
    try expectEqual(u8, IntFor(0));
    try expectEqual(u32, IntFor(0xFFFFFFFF));
    try expectEqual(i64, IntFor(-0xFFFFFFFF));
    try expectEqual(u8, IntFor(123));
    try expectEqual(i8, IntFor(-123));
}

pub const ErrorInt = @Type(.{
    .int = .{
        .signedness = .unsigned,
        .bits = @bitSizeOf(anyerror),
    },
});

pub fn Uninlined(comptime FT: type) type {
    return switch (@typeInfo(FT)) {
        .@"fn" => |f| @Type(.{
            .@"fn" = .{
                .calling_convention = switch (f.calling_convention) {
                    .@"inline" => .auto,
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
    try expectEqual(fn () void, Uninlined(fn () callconv(.@"inline") void));
    try expectEqual(fn () void, Uninlined(fn () void));
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
    try expectEqual(1004, list.entries[4]);
    inline for (0..17) |index| {
        list = list.concat(index + 2000);
    }
    try expectEqual(1000, list.entries[0]);
    try expectEqual(1016, list.entries[16]);
    try expectEqual(2000, list.entries[17]);
    try expectEqual(2016, list.entries[33]);
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
    signature_known: bool = false,
};

pub const TypeData = struct {
    type: type,
    parent_type: ?type = null,
    slot: ?usize = null,
    attrs: TypeAttributes = .{},
    signature: u64 = 0,

    pub fn getSlot(comptime self: @This()) usize {
        return self.slot orelse @compileError("No assigned slot: " ++ @typeName(self.type));
    }

    pub fn getElementType(comptime self: @This()) type {
        return if (self.attrs.is_slice)
            self.type.ElementType
        else switch (@typeInfo(self.type)) {
            inline .array, .vector => |ar| ar.child,
            else => @compileError("Not an array, vector, or slice"),
        };
    }

    test "getElementType" {
        const ET = getElementType(.{ .type = Slice(u8, null), .attrs = .{ .is_slice = true } });
        try expectEqual(u8, ET);
    }

    pub fn getTargetType(comptime self: @This()) type {
        return switch (@typeInfo(self.type)) {
            .pointer => |pt| switch (pt.size) {
                .one => if (pt.child == anyopaque) Slice(anyopaque, null) else pt.child,
                else => define: {
                    if (pt.sentinel_ptr) |ptr| {
                        const sentinel_ptr: *const pt.child = @alignCast(@ptrCast(ptr));
                        break :define Slice(pt.child, .{ .value = sentinel_ptr.* });
                    } else if (pt.size == .c and (pt.child == u8 or pt.child == u16)) {
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
        try expectEqual(Slice(i32, null), getTargetType(.{ .type = []i32 }));
        try expectEqual(Slice(anyopaque, null), getTargetType(.{ .type = *const anyopaque }));
        try expectEqual(i32, getTargetType(.{ .type = *i32 }));
    }

    pub fn getByteSize(comptime self: @This()) ?usize {
        if (self.attrs.is_slice and self.type.is_opaque) {
            // opaque types have unknown size
            return null;
        }
        return switch (@typeInfo(self.type)) {
            .null, .undefined, .@"fn" => 0,
            .@"opaque" => null,
            .error_set => @sizeOf(anyerror),
            else => return @sizeOf(self.type),
        };
    }

    test "getByteSize" {
        try expectEqual(0, getByteSize(.{ .type = void }));
        try expectEqual(0, getByteSize(.{ .type = @TypeOf(null) }));
        try expectEqual(1, getByteSize(.{ .type = u8 }));
    }

    pub fn getBitSize(comptime self: @This()) ?usize {
        return switch (@typeInfo(self.type)) {
            .null, .undefined, .@"fn" => 0,
            .@"opaque" => null,
            .error_set => @bitSizeOf(anyerror),
            else => return @bitSizeOf(self.type),
        };
    }

    test "getBitSize" {
        try expectEqual(0, getBitSize(.{ .type = void }));
        try expectEqual(0, getBitSize(.{ .type = @TypeOf(null) }));
        try expectEqual(8, getBitSize(.{ .type = u8 }));
    }

    pub fn getAlignment(comptime self: @This()) ?u16 {
        if (self.attrs.is_slice and self.type.is_opaque) {
            // opaque types have unknown alignment
            return null;
        }
        return switch (@typeInfo(self.type)) {
            .null, .undefined, .@"fn" => 0,
            .@"opaque" => null,
            .error_set => @alignOf(anyerror),
            else => return @alignOf(self.type),
        };
    }

    test "getAlignment" {
        try expectEqual(1, getAlignment(.{ .type = void }));
        try expectEqual(1, getAlignment(.{ .type = u8 }));
        try expectEqual(4, getAlignment(.{ .type = u32 }));
    }

    pub fn getSentinel(comptime self: @This()) ?Sentinel(self.getElementType()) {
        return if (self.attrs.is_slice)
            self.type.sentinel
        else switch (@typeInfo(self.type)) {
            inline .array => |ar| if (ar.sentinel_ptr) |opaque_ptr| sentinel: {
                const ptr: *const self.getElementType() = @ptrCast(opaque_ptr);
                break :sentinel .{ .value = ptr.*, .is_required = true };
            } else null,
            else => @compileError("Not an array or slice"),
        };
    }

    test "getSentinel" {
        try expectEqual(0, getSentinel(.{ .type = Slice(u8, .{ .value = 0 }), .attrs = .{ .is_slice = true } }).?.value);
        try expectEqual(7, getSentinel(.{ .type = Slice(i32, .{ .value = 7 }), .attrs = .{ .is_slice = true } }).?.value);
        try expectEqual(-2, getSentinel(.{ .type = Slice(i32, .{ .value = -2 }), .attrs = .{ .is_slice = true } }).?.value);
        try expectEqual(null, getSentinel(.{ .type = Slice(i32, null), .attrs = .{ .is_slice = true } }));
    }

    pub fn hasSelector(comptime self: @This()) bool {
        return switch (@typeInfo(self.type)) {
            .@"union" => self.getSelectorType() != null,
            .optional => |op| switch (@typeInfo(op.child)) {
                .pointer, .error_set => false,
                else => true,
            },
            else => @compileError("Not a union or optional"),
        };
    }

    pub fn getSelectorType(comptime self: @This()) ?type {
        return switch (@typeInfo(self.type)) {
            .@"union" => |un| un.tag_type orelse debug_tag: {
                if (runtime_safety) {
                    if (un.layout != .@"extern" and un.layout != .@"packed") {
                        break :debug_tag IntFor(un.fields.len);
                    }
                }
                break :debug_tag null;
            },
            .optional => |op| switch (@typeInfo(op.child)) {
                .pointer => usize, // size of the pointer itself
                .error_set => ErrorInt,
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
        try expectEqual(Tag, getSelectorType(.{ .type = Union }));
        if (runtime_safety) {
            const BareUnion = union {
                cat: u32,
                dog: u32,
            };
            try expectEqual(u8, getSelectorType(.{ .type = BareUnion }));
        }
    }

    pub fn getSelectorBitOffset(comptime self: @This()) comptime_int {
        return switch (@typeInfo(self.type)) {
            .@"union" => get: {
                const TT = self.getSelectorType().?;
                const fields = @typeInfo(self.type).@"union".fields;
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
            .optional => |op| switch (@typeInfo(op.child)) {
                .pointer, .error_set => 0, // offset of the pointer/error itself
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
        try expectEqual(32, getSelectorBitOffset(.{ .type = Union }));
    }

    pub fn getErrorBitOffset(comptime self: @This()) comptime_int {
        return switch (@typeInfo(self.type)) {
            // value is placed after the error number if its alignment is smaller than that of anyerror
            .error_union => |eu| if (@alignOf(anyerror) > @alignOf(eu.payload)) 0 else @sizeOf(eu.payload) * 8,
            else => @compileError("Not an error union"),
        };
    }

    pub fn getContentBitOffset(comptime self: @This()) comptime_int {
        return switch (@typeInfo(self.type)) {
            .@"union" => if (self.getSelectorType()) |TT| switch (self.getSelectorBitOffset()) {
                0 => @sizeOf(TT) * 8,
                else => 0,
            } else 0,
            .optional => 0,
            .error_union => switch (self.getErrorBitOffset()) {
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
        try expectEqual(0, getContentBitOffset(.{ .type = Union }));
    }

    pub fn getSignature(comptime self: @This()) u64 {
        return self.signature;
    }

    pub fn isConst(comptime self: @This()) bool {
        return switch (@typeInfo(self.type)) {
            .pointer => |pt| pt.is_const,
            else => false,
        };
    }

    test "isConst" {
        try expectEqual(false, isConst(.{ .type = i32 }));
        try expectEqual(false, isConst(.{ .type = *i32 }));
        try expectEqual(true, isConst(.{ .type = *const i32 }));
    }

    pub fn isPacked(comptime self: @This()) bool {
        return switch (@typeInfo(self.type)) {
            .@"struct" => |st| st.layout == .@"packed",
            .@"union" => |un| un.layout == .@"packed",
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
        try expectEqual(false, isPacked(.{ .type = A }));
        try expectEqual(true, isPacked(.{ .type = B }));
    }

    pub fn isBitVector(comptime self: @This()) bool {
        return switch (@typeInfo(self.type)) {
            .vector => |ve| @sizeOf(ve.child) * ve.len > @sizeOf(self.type),
            else => false,
        };
    }

    test "isBitVector" {
        const A = @Vector(8, bool);
        const B = @Vector(4, f32);
        try expectEqual(true, isBitVector(.{ .type = A }));
        try expectEqual(false, isBitVector(.{ .type = B }));
    }

    pub fn isIterator(comptime self: @This()) bool {
        return IteratorReturnValue(self.type) != null;
    }

    test "isIterator" {
        try expectEqual(true, isIterator(.{ .type = std.mem.SplitIterator(u8, .sequence) }));
        try expectEqual(true, isIterator(.{ .type = std.fs.path.ComponentIterator(.posix, u8) }));
        try expectEqual(false, isIterator(.{ .type = std.fs.path }));
    }

    pub fn isMethodOf(comptime self: @This(), comptime T: type) bool {
        switch (@typeInfo(self.type)) {
            .@"fn" => |f| {
                if (f.params.len > 0) {
                    if (f.params[0].type) |PT| {
                        return (PT == T) or switch (@typeInfo(PT)) {
                            .pointer => |pt| pt.child == T,
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
        try expectEqual(false, isMethodOf(.{ .type = @TypeOf(A.a) }, A));
        try expectEqual(false, isMethodOf(.{ .type = @TypeOf(A.b) }, A));
        try expectEqual(true, isMethodOf(.{ .type = @TypeOf(A.c) }, A));
        try expectEqual(true, isMethodOf(.{ .type = @TypeOf(A.d) }, A));
        try expectEqual(true, isMethodOf(.{ .type = @TypeOf(A.e) }, A));
        try expectEqual(false, isMethodOf(.{ .type = @TypeOf(A.e) }, B));
        try expectEqual(false, isMethodOf(.{ .type = u32 }, B));
    }

    pub fn hasPointer(comptime self: @This()) bool {
        return self.attrs.has_pointer;
    }

    pub fn isPointer(comptime self: @This()) bool {
        return switch (@typeInfo(self.type)) {
            .pointer => true,
            else => false,
        };
    }

    pub fn isObject(comptime self: @This()) bool {
        return switch (@typeInfo(self.type)) {
            .@"struct", .@"union", .array, .error_union, .optional, .pointer, .vector, .@"fn" => true,
            else => false,
        };
    }

    pub fn isFunction(comptime self: @This()) bool {
        return switch (@typeInfo(self.type)) {
            .@"fn" => true,
            else => false,
        };
    }

    pub fn isVariadic(comptime self: @This()) bool {
        return switch (@typeInfo(self.type)) {
            .@"fn" => |f| f.is_var_args,
            else => false,
        };
    }

    pub fn isArguments(comptime self: @This()) bool {
        return self.attrs.is_arguments;
    }

    pub fn isThrowing(comptime self: @This()) bool {
        return inline for (@typeInfo(self.type).@"struct".fields, 0..) |field, i| {
            if (i == 0) {
                // retval
                if (@typeInfo(field.type) == .error_union) break true;
            } else {
                const internal_type = comptime getInternalType(field.type);
                if (internal_type == .promise or internal_type == .generator) {
                    switch (@typeInfo(field.type.payload)) {
                        .error_union => break true,
                        .optional => |op| switch (@typeInfo(op.child)) {
                            .error_union => break true,
                            else => {},
                        },
                        else => {},
                    }
                }
            }
        } else false;
    }

    pub fn isSlice(comptime self: @This()) bool {
        return self.attrs.is_slice;
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

    pub fn shouldIgnoreDecls(comptime self: @This()) bool {
        return switch (self.type) {
            std.io.AnyReader, std.io.AnyWriter => true,
            else => getInternalType(self.type) != null,
        };
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
                // set signature of supported types
                self.setSignature(td);
                // assign slots to supported types
                self.setSlot(td);
            }
        }
    }

    pub fn add(comptime self: *@This(), comptime T: type) void {
        self.append(.{ .type = T });
    }

    pub fn createDatabase(comptime self: *const @This()) TypeDatabase(self.types.len) {
        comptime var tdb: TypeDatabase(self.types.len) = undefined;
        inline for (self.types.slice(), 0..) |td, index| {
            tdb.entries[index] = td;
        }
        return tdb;
    }

    test "createDatabase" {
        @setEvalBranchQuota(200000);
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
        try expectEqual(true, tdb.get(ns.StructA).attrs.is_supported);
        try expectEqual(true, tdb.get(ns.StructB).attrs.is_supported);
        try expectEqual(true, tdb.get(@TypeOf(ns.normal)).attrs.is_supported);
        try expectEqual(false, tdb.get(@TypeOf(ns.generic1)).attrs.is_supported);
        try expectEqual(false, tdb.get(@TypeOf(ns.generic2)).attrs.is_supported);
        try expectEqual(true, tdb.get(*ns.StructA).attrs.is_supported);
        try expectEqual(true, tdb.get(*const ns.StructA).attrs.is_supported);
        try expectEqual(true, tdb.get(ns.StructC).attrs.is_supported);
        try expectEqual(true, tdb.get(ns.StructD).attrs.is_supported);
        try expectEqual(true, tdb.get(ns.UnionA).attrs.is_supported);
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
            .error_union => |eu| {
                self.add(eu.error_set);
                self.add(eu.payload);
            },
            .@"fn" => |f| {
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
            .pointer => |pt| {
                self.add(pt.child);
            },
            inline .array, .vector, .optional => |ar| {
                self.add(ar.child);
            },
            inline .@"struct", .@"union" => |st, Tag| {
                inline for (st.fields) |field| {
                    self.add(field.type);
                    if (Tag == .@"struct" and field.is_comptime) {
                        // deal with comptime fields
                        const def_value_ptr: *const field.type = @ptrCast(@alignCast(field.default_value_ptr.?));
                        self.addTypeOf(def_value_ptr.*);
                    }
                }
            },
            else => {},
        }
        if (comptime !td.shouldIgnoreDecls()) {
            // add decls
            switch (@typeInfo(T)) {
                inline .@"struct", .@"union", .@"enum", .@"opaque" => |st| {
                    inline for (st.decls) |decl| {
                        // decls are accessed through pointers
                        const PT = @TypeOf(&@field(T, decl.name));
                        if (@typeInfo(PT).pointer.is_const) {
                            const decl_value = @field(T, decl.name);
                            self.addTypeOf(decl_value);
                        }
                        self.append(.{
                            .type = PT,
                            .attrs = .{ .is_in_use = false },
                        });
                    }
                },
                else => {},
            }
        }
        // add other implicit types
        switch (@typeInfo(T)) {
            .noreturn => self.add(void),
            .pointer => |pt| {
                const TT = TypeData.getTargetType(.{ .type = T });
                if (TT != pt.child) {
                    self.append(.{
                        .type = TT,
                        .attrs = .{ .is_slice = true },
                    });
                }
                self.add(usize);
            },
            .error_set => self.add(ErrorInt),
            .@"struct" => |st| if (st.backing_integer) |IT| self.add(IT),
            .@"fn" => |f| if (!f.is_generic) {
                const ArgT = ArgumentStruct(T);
                self.append(.{
                    .type = ArgT,
                    .parent_type = T,
                    .attrs = .{
                        .is_arguments = true,
                        .is_variadic = f.is_var_args,
                    },
                });
                if (f.calling_convention == .@"inline") {
                    self.add(Uninlined(T));
                }
            },
            inline .@"union", .optional => if (self.at(index).getSelectorType()) |ST| {
                self.add(ST);
            },
            else => {},
        }
    }

    fn addTypeOf(comptime self: *@This(), comptime value: anytype) void {
        const T = @TypeOf(value);
        switch (@typeInfo(T)) {
            .type => self.add(value),
            .comptime_float => self.add(*const f64),
            .comptime_int => self.add(*const IntFor(value)),
            .enum_literal => self.add(@TypeOf(removeSentinel(@tagName(value)))),
            .optional => if (value) |v| self.addTypeOf(v),
            .error_union => if (value) |v| self.addTypeOf(v) else |_| {},
            .@"union" => |un| {
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
            .@"struct" => |st| inline for (st.fields) |field| self.addTypeOf(@field(value, field.name)),
            .array => inline for (value) |element| self.addTypeOf(element),
            // add function to the list so we can create its arg struct later
            .@"fn" => self.functions = self.functions.concat(T),
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
            .bool,
            .int,
            .float,
            .void,
            .error_set,
            .@"enum",
            .@"opaque",
            .noreturn,
            => td.attrs.is_supported = true,
            .type,
            .comptime_float,
            .comptime_int,
            .enum_literal,
            .null,
            .undefined,
            => {
                td.attrs.is_supported = true;
                td.attrs.is_comptime_only = true;
            },
            .error_union => |eu| {
                const payload_attrs = self.getAttributes(eu.payload);
                td.attrs.is_supported = payload_attrs.is_supported;
                td.attrs.is_comptime_only = payload_attrs.is_comptime_only;
                td.attrs.has_pointer = payload_attrs.has_pointer;
            },
            .pointer => |pt| {
                const child_attrs = self.getAttributes(pt.child);
                td.attrs.is_supported = child_attrs.is_supported;
                td.attrs.is_comptime_only = child_attrs.is_comptime_only;
                td.attrs.has_pointer = true;
            },
            inline .array, .vector, .optional => |ar| {
                const child_attrs = self.getAttributes(ar.child);
                td.attrs.is_supported = child_attrs.is_supported;
                td.attrs.is_comptime_only = child_attrs.is_comptime_only;
                td.attrs.has_pointer = child_attrs.has_pointer;
            },
            .@"struct" => |st| {
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
            .@"union" => |un| {
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
            .@"fn" => |f| {
                td.attrs.is_supported = inline for (f.params) |param| {
                    if (param.is_generic) break false;
                    if (param.type == null) break false;
                } else inline for (.{1}) |_| {
                    if (f.is_generic) break false;
                    const RT = f.return_type orelse break false;
                    const retval_attrs = self.getAttributes(RT);
                    if (retval_attrs.is_comptime_only) break false;
                } else true;
            },
            else => {},
        }
    }

    fn getSignature(comptime self: *@This(), comptime T: type) u64 {
        const td = self.get(T);
        self.setSignature(td);
        return td.signature;
    }

    fn setSignature(comptime self: *@This(), comptime td: *TypeData) void {
        if (td.attrs.signature_known) {
            return;
        }
        td.attrs.signature_known = true;
        var md5 = std.crypto.hash.Md5.init(.{});
        switch (@typeInfo(td.type)) {
            .@"struct" => |st| {
                md5.update(switch (st.layout) {
                    .@"extern" => "extern struct",
                    .@"packed" => "packed struct",
                    else => "struct",
                });
                if (st.backing_integer) |BIT| {
                    md5.update("(");
                    md5.update(std.mem.asBytes(&self.getSignature(BIT)));
                    md5.update(")");
                }
                md5.update(" {");
                for (st.fields) |field| {
                    if (!field.is_comptime) {
                        md5.update(field.name);
                        md5.update(": ");
                        md5.update(std.mem.asBytes(&self.getSignature(field.type)));
                        if (field.alignment != @alignOf(field.type)) {
                            md5.update(std.fmt.comptimePrint(" align({d})\n", .{field.alignment}));
                        }
                        md5.update(", ");
                    }
                }
                md5.update("}");
            },
            .@"union" => |un| {
                md5.update(switch (un.layout) {
                    .@"extern" => "extern union",
                    else => "union",
                });
                if (un.tag_type) |TT| {
                    md5.update("(");
                    md5.update(std.mem.asBytes(&self.getSignature(TT)));
                    md5.update(")");
                }
                md5.update(" {");
                for (un.fields) |field| {
                    md5.update(field.name);
                    md5.update(": ");
                    md5.update(std.mem.asBytes(&self.getSignature(field.type)));
                    if (field.alignment != @alignOf(field.type)) {
                        md5.update(std.fmt.comptimePrint(" align({d})", .{field.alignment}));
                    }
                    md5.update(", ");
                }
                md5.update("}");
            },
            .array => |ar| {
                md5.update(std.fmt.comptimePrint("[{d}]", .{ar.len}));
                md5.update(std.mem.asBytes(&self.getSignature(ar.child)));
            },
            .vector => |ar| {
                md5.update(std.fmt.comptimePrint("@Vector({d}, ", .{ar.len}));
                md5.update(std.mem.asBytes(&self.getSignature(ar.child)));
                md5.update(")");
            },
            .optional => |op| {
                md5.update("?");
                md5.update(std.mem.asBytes(&self.getSignature(op.child)));
            },
            .error_union => |eu| {
                md5.update(std.mem.asBytes(&self.getSignature(eu.error_set)));
                md5.update("!");
                md5.update(std.mem.asBytes(&self.getSignature(eu.payload)));
            },
            .error_set => |es| {
                if (td.type == anyerror) {
                    md5.update("anyerror");
                } else {
                    md5.update("error{");
                    if (es) |errors| {
                        inline for (errors) |err| {
                            md5.update(err.name);
                            md5.update(",");
                        }
                    }
                    md5.update("}");
                }
            },
            .pointer => |pt| {
                md5.update(switch (pt.size) {
                    .one => "*",
                    .many => "[*",
                    .slice => "[",
                    .c => "[*c",
                });
                if (pt.sentinel_ptr) |ptr| {
                    const value = @as(*const pt.child, @ptrCast(@alignCast(ptr))).*;
                    md5.update(std.fmt.comptimePrint(":{d}", .{value}));
                }
                md5.update(switch (pt.size) {
                    .one => "",
                    else => "]",
                });
                if (pt.is_const) {
                    md5.update("const ");
                }
                if (pt.is_allowzero) {
                    md5.update("allowzero ");
                }
                md5.update(std.mem.asBytes(&self.getSignature(pt.child)));
            },
            .@"fn" => |f| {
                md5.update("fn (");
                if (f.is_var_args) {
                    md5.update("...");
                }
                for (f.params) |param| {
                    if (param.is_noalias) {
                        md5.update("noalias ");
                    }
                    if (param.type) |PT| {
                        md5.update(std.mem.asBytes(&self.getSignature(PT)));
                    } else {
                        md5.update("anytype");
                    }
                    md5.update(", ");
                }
                md5.update(") ");
                if (f.calling_convention != .auto) {
                    md5.update("callconv(.");
                    md5.update(@tagName(f.calling_convention));
                    md5.update(") ");
                }
                if (f.return_type) |RT| {
                    md5.update(std.mem.asBytes(&self.getSignature(RT)));
                }
            },
            else => md5.update(@typeName(td.type)),
        }
        var out: [16]u8 = undefined;
        md5.final(&out);
        td.signature = std.mem.bytesToValue(u64, out[0..8]);
    }

    test "scan" {
        @setEvalBranchQuota(200000);
        const ns = struct {
            pub const StructA = struct {
                number: i32,
                string: []const u8,
            };
        };
        comptime var tdc = init(0);
        comptime tdc.scan(ns);
        try expect(comptime tdc.indexOf(ns.StructA) != null);
    }

    test "setAttributes" {
        @setEvalBranchQuota(200000);
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
        try expectEqual(true, tdc.get(ns.StructA).attrs.is_supported);
        try expectEqual(true, tdc.get(ns.StructB).attrs.is_supported);
        try expectEqual(true, tdc.get(@TypeOf(ns.normal)).attrs.is_supported);
        try expectEqual(false, tdc.get(@TypeOf(ns.generic1)).attrs.is_supported);
        try expectEqual(false, tdc.get(@TypeOf(ns.generic2)).attrs.is_supported);
        try expectEqual(true, tdc.get(*ns.StructA).attrs.is_supported);
        try expectEqual(true, tdc.get(*ns.StructB).attrs.is_supported);
        try expectEqual(true, tdc.get(ns.StructC).attrs.is_supported);
        try expectEqual(true, tdc.get(ns.StructD).attrs.is_supported);
        try expectEqual(true, tdc.get(ns.UnionA).attrs.is_supported);
        try expectEqual(true, tdc.get(@TypeOf(null)).attrs.is_supported);
        try expectEqual(true, tdc.get(@TypeOf(undefined)).attrs.is_supported);
        try expectEqual(true, tdc.get(noreturn).attrs.is_supported);
        try expectEqual(true, tdc.get(u17).attrs.is_supported);
        try expectEqual(true, tdc.get(i18).attrs.is_supported);
        // pointer should include this
        try expectEqual(true, tdc.get(usize).attrs.is_supported);

        // is_comptime_only
        try expectEqual(true, tdc.get(type).attrs.is_comptime_only);
        try expectEqual(true, tdc.get(*const type).attrs.is_comptime_only);
        try expectEqual(true, tdc.get(?type).attrs.is_comptime_only);
        // has_pointer
        try expectEqual(false, tdc.get(i32).attrs.has_pointer);
        try expectEqual(true, tdc.get([*]i32).attrs.has_pointer);
        try expectEqual(true, tdc.get([]const u8).attrs.has_pointer);
        try expectEqual(true, tdc.get([5]*u8).attrs.has_pointer);
        try expectEqual(true, tdc.get([][]u8).attrs.has_pointer);
        try expectEqual(false, tdc.get(ns.A).attrs.has_pointer);
        try expectEqual(false, tdc.get(ns.B).attrs.has_pointer);
        try expectEqual(true, tdc.get(ns.C).attrs.has_pointer);
        try expectEqual(true, tdc.get(ns.D).attrs.has_pointer);
        // comptime fields should be ignored
        try expectEqual(false, tdc.get(ns.E).attrs.has_pointer);
    }

    test "setSignature" {
        @setEvalBranchQuota(200000);
        const ns = struct {
            pub const Uint32 = u32;
            pub const Uint64 = u64;
            pub const StructA = struct {
                number: i32,
            };
            pub const StructB = struct {
                numberA: i32,
            };
            pub const StructC = struct {
                numberA: i32 align(16),
            };
            pub const PtrA = *u32;
            pub const PtrB = *const u32;
            pub const FnA = fn () i32;
            pub const FnB = fn () u32;
            pub const FnC = fn () callconv(.c) u32;
            pub const FnD = fn (u32) u32;
        };
        comptime var tdc = init(0);
        comptime tdc.scan(ns);
        const sig1 = comptime tdc.get(ns.Uint32).signature;
        const sig2 = comptime tdc.get(ns.Uint64).signature;
        try expect(sig1 != sig2);
        const sig3 = comptime tdc.get(ns.StructA).signature;
        const sig4 = comptime tdc.get(ns.StructB).signature;
        try expect(sig3 != sig4);
        const sig5 = comptime tdc.get(ns.StructC).signature;
        try expect(sig4 != sig5);
        const sig6 = comptime tdc.get(ns.PtrA).signature;
        const sig7 = comptime tdc.get(ns.PtrB).signature;
        try expect(sig6 != sig7);
        const sig8 = comptime tdc.get(ns.FnA).signature;
        const sig9 = comptime tdc.get(ns.FnB).signature;
        try expect(sig8 != sig9);
        const sig10 = comptime tdc.get(ns.FnC).signature;
        try expect(sig9 != sig10);
        const sig11 = comptime tdc.get(ns.FnD).signature;
        try expect(sig9 != sig11);
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
        .@"opaque" => u8,
        else => T,
    };
    return struct {
        value: ET,
        is_required: bool = true,
    };
}

pub fn Slice(comptime T: type, comptime s: ?Sentinel(T)) type {
    const ET = switch (@typeInfo(T)) {
        .@"opaque" => u8,
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
    const f = @typeInfo(T).@"fn";
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
        .default_value_ptr = null,
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
                .default_value_ptr = null,
            };
            arg_index += 1;
        }
    }
    return @Type(.{
        .@"struct" = .{
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
    try expectEqual(3, fieldsA.len);
    try expectEqualSlices(u8, "retval", fieldsA[0].name);
    try expectEqualSlices(u8, "0", fieldsA[1].name);
    try expectEqualSlices(u8, "1", fieldsA[2].name);
    const ArgB = ArgumentStruct(@TypeOf(ns.B));
    const fieldsB = std.meta.fields(ArgB);
    try expectEqual(2, fieldsB.len);
    try expectEqualSlices(u8, "retval", fieldsB[0].name);
    try expectEqualSlices(u8, "0", fieldsB[1].name);
    const ArgC = ArgumentStruct(@TypeOf(ns.C));
    const fieldsC = std.meta.fields(ArgC);
    try expectEqual(4, fieldsC.len);
}

pub fn FnPointerTarget(comptime T: type) type {
    return switch (@typeInfo(T)) {
        .pointer => |pt| switch (@typeInfo(pt.child)) {
            .@"fn" => pt.child,
            else => @compileError("Not a function pointer"),
        },
        else => @compileError("Not a function pointer"),
    };
}

test "FnPointerTarget" {
    const FT = FnPointerTarget(*const fn () void);
    try expectEqual(fn () void, FT);
}

pub fn removeSentinel(comptime ptr: anytype) retval_type: {
    const PT = @TypeOf(ptr);
    var pt = @typeInfo(PT).pointer;
    var ar = @typeInfo(pt.child).array;
    ar.sentinel_ptr = null;
    pt.child = @Type(.{ .array = ar });
    break :retval_type @Type(.{ .pointer = pt });
} {
    return @ptrCast(ptr);
}

fn ReturnValue(comptime arg: anytype) type {
    const FT = Function(arg);
    const f = @typeInfo(FT).@"fn";
    return f.return_type orelse @TypeOf(undefined);
}

test "ReturnValue" {
    const T = ReturnValue(fn () void);
    try expectEqual(void, T);
}

fn IteratorPayload(comptime T: type) ?type {
    return switch (@typeInfo(T)) {
        .optional => |op| switch (@typeInfo(op.child)) {
            .error_union => |eu| eu.payload,
            else => op.child,
        },
        .error_union => |eu| IteratorPayload(eu.payload),
        else => null,
    };
}

test "IteratorPayload" {
    const T1 = IteratorPayload(?i32);
    try expectEqual(i32, T1);
    const T2 = IteratorPayload(anyerror!?i32);
    try expectEqual(i32, T2);
    const T3 = IteratorPayload(i32);
    try expectEqual(null, T3);
    const T4 = IteratorPayload(anyerror!i32);
    try expectEqual(null, T4);
    const T5 = IteratorPayload(?anyerror!i32);
    try expectEqual(i32, T5);
}

pub fn hasDefaultFields(comptime T: type) bool {
    return switch (@typeInfo(T)) {
        .@"struct" => |st| inline for (st.fields) |field| {
            if (field.default_value_ptr == null) break false;
        } else true,
        else => false,
    };
}

test "hasDefaultFields" {
    const S1 = struct {
        number1: i32,
        number2: i32,
    };
    try expectEqual(false, hasDefaultFields(S1));
    const S2 = struct {
        number1: i32 = 1,
        number2: i32,
    };
    try expectEqual(false, hasDefaultFields(S2));
    const S3 = struct {
        number1: i32 = 1,
        number2: i32 = 2,
    };
    try expectEqual(true, hasDefaultFields(S3));
}

fn NextMethodReturnValue(comptime FT: type, comptime T: type) ?type {
    const f = @typeInfo(FT).@"fn";
    const arg_match = comptime check: {
        var self_count = 0;
        var alloc_count = 0;
        var struct_count = 0;
        var other_count = 0;
        for (f.params, 0..) |param, i| {
            const PT = param.type orelse break :check false;
            if (i == 0 and PT == *T) {
                self_count += 1;
            } else if (PT == std.mem.Allocator) {
                alloc_count += 1;
            } else if (hasDefaultFields(PT)) {
                struct_count += 1;
            } else {
                other_count += 1;
            }
        }
        break :check self_count == 1 and other_count == 0 and alloc_count <= 1 and struct_count <= 1;
    };
    if (arg_match) {
        if (f.return_type) |RT| {
            if (IteratorPayload(RT) != null) return RT;
        }
    }
    return null;
}

test "NextMethodReturnValue" {
    const S = struct {
        pub fn next1(_: *@This()) ?i32 {
            return null;
        }

        pub fn next2(_: *@This()) error{OutOfMemory}!?i32 {
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

        pub fn next6(_: *@This(), _: struct { a: i32 = 0 }) ?i32 {
            return null;
        }

        pub fn next7(_: *@This(), _: struct { a: i32 = 0, b: i32 }) ?i32 {
            return null;
        }
    };
    const T1 = NextMethodReturnValue(@TypeOf(S.next1), S);
    try expectEqual(?i32, T1);
    const T2 = NextMethodReturnValue(@TypeOf(S.next2), S);
    try expectEqual(error{OutOfMemory}!?i32, T2);
    const T3 = NextMethodReturnValue(@TypeOf(S.next3), S);
    try expectEqual(null, T3);
    const T4 = NextMethodReturnValue(@TypeOf(S.next4), S);
    try expectEqual(null, T4);
    const T5 = NextMethodReturnValue(@TypeOf(S.next5), S);
    try expectEqual(null, T5);
    const T6 = NextMethodReturnValue(@TypeOf(S.next6), S);
    try expectEqual(?i32, T6);
    const T7 = NextMethodReturnValue(@TypeOf(S.next7), S);
    try expectEqual(null, T7);
}

pub fn IteratorReturnValue(comptime T: type) ?type {
    switch (@typeInfo(T)) {
        .@"struct", .@"union", .@"opaque" => if (@hasDecl(T, "next")) {
            const next = @field(T, "next");
            return NextMethodReturnValue(@TypeOf(next), T);
        },
        .error_union => |eu| if (IteratorReturnValue(eu.payload)) |RT| {
            return switch (@typeInfo(RT)) {
                .error_union => |rt_eu| (eu.error_set || rt_eu.error_set)!rt_eu.payload,
                else => eu.error_set!RT,
            };
        },
        else => {},
    }
    return null;
}

test "IteratorReturnValue" {
    const T1 = IteratorReturnValue(std.mem.SplitIterator(u8, .sequence));
    try expect(T1 != null);
    try expectEqual([]const u8, IteratorPayload(T1.?));
    const T2 = IteratorReturnValue(error{Doh}!std.fs.path.ComponentIterator(.posix, u8));
    try expect(T2 != null);
    const T3 = IteratorReturnValue(std.fs.path);
    try expect(T3 == null);
}

pub fn isIteratorAllocating(comptime T: type) bool {
    switch (@typeInfo(T)) {
        .@"struct", .@"union", .@"opaque" => if (@hasDecl(T, "next")) {
            const next = @field(T, "next");
            const FT = @TypeOf(next);
            return inline for (@typeInfo(FT).@"fn".params) |param| {
                if (param.type == std.mem.Allocator) break true;
            } else false;
        },
        .error_union => |eu| return isIteratorAllocating(eu.payload),
        else => {},
    }
    return false;
}

test "isIteratorAllocating" {
    const result1 = isIteratorAllocating(std.mem.SplitIterator(u8, .sequence));
    try expectEqual(false, result1);
}

const InternalType = enum {
    promise,
    generator,
    abort_signal,
};

pub fn getInternalType(comptime OT: ?type) ?InternalType {
    if (OT) |T| {
        if (@typeInfo(T) == .@"struct") {
            if (@hasDecl(T, "internal_type") and @TypeOf(T.internal_type) == InternalType) {
                return T.internal_type;
            }
        }
    }
    return null;
}

test "getInternalType" {
    try expectEqual(.promise, getInternalType(Promise(i32)));
    try expectEqual(.generator, getInternalType(Generator(?i32, false)));
    try expectEqual(.abort_signal, getInternalType(AbortSignal));
}

fn Any(comptime T: type) type {
    return switch (@typeInfo(T)) {
        .error_union => |eu| anyerror!eu.payload,
        else => T,
    };
}

pub fn Promise(comptime T: type) type {
    return struct {
        ptr: ?*anyopaque = null,
        callback: *const fn (?*anyopaque, T) void,

        pub const payload = T;

        const internal_type: InternalType = .promise;

        pub fn init(ptr: ?*const anyopaque, cb: anytype) @This() {
            return .{
                .ptr = @constCast(ptr),
                .callback = getCallback(fn (?*anyopaque, T) void, cb),
            };
        }

        pub fn resolve(self: @This(), value: T) void {
            self.callback(self.ptr, value);
        }

        pub fn any(self: @This()) Promise(Any(T)) {
            return .{ .ptr = self.ptr, .callback = @ptrCast(self.callback) };
        }

        pub fn partition(self: @This(), allocator: std.mem.Allocator, count: usize) !@This() {
            if (count == 1) {
                return self;
            }
            const ThisPromise = @This();
            const Context = struct {
                allocator: std.mem.Allocator,
                promise: ThisPromise,
                count: usize,
                fired: bool = false,

                pub fn resolve(ctx: *@This(), value: T) void {
                    var call = false;
                    var free = false;
                    if (@typeInfo(T) == .error_union) {
                        if (value) |_| {
                            free = @atomicRmw(usize, &ctx.count, .Sub, 1, .acq_rel) == 1;
                            call = free and @cmpxchgStrong(bool, &ctx.fired, false, true, .acq_rel, .monotonic) == null;
                        } else |_| {
                            call = @cmpxchgStrong(bool, &ctx.fired, false, true, .acq_rel, .monotonic) == null;
                            free = @atomicRmw(usize, &ctx.count, .Sub, 1, .acq_rel) == 1;
                        }
                    } else {
                        free = @atomicRmw(usize, &ctx.count, .Sub, 1, .acq_rel) == 1;
                        call = free;
                    }
                    if (call) {
                        ctx.promise.resolve(value);
                    }
                    if (free) {
                        const allocator_copy = ctx.allocator;
                        allocator_copy.destroy(ctx);
                    }
                }
            };
            const ctx = try allocator.create(Context);
            ctx.* = .{ .allocator = allocator, .promise = self, .count = count };
            return @This().init(ctx, Context.resolve);
        }

        test "partition" {
            if (T == anyerror!u32) {
                const ns = struct {
                    var test_value: T = 0;

                    fn resolve(_: *anyopaque, value: T) void {
                        test_value = value;
                    }
                };
                var gpa = std.heap.GeneralPurposeAllocator(.{}){};
                const promise1: @This() = @This().init(null, ns.resolve);
                const multipart_promise1 = try promise1.partition(gpa.allocator(), 3);
                multipart_promise1.resolve(1);
                multipart_promise1.resolve(2);
                try expectEqual(0, ns.test_value);
                multipart_promise1.resolve(3);
                try expectEqual(3, ns.test_value);
                const promise2: @This() = @This().init(null, ns.resolve);
                const multipart_promise2 = try promise2.partition(gpa.allocator(), 3);
                multipart_promise2.resolve(error.OutOfMemory);
                try expectError(error.OutOfMemory, ns.test_value);
            }
        }
    };
}

test {
    _ = Promise(anyerror!u32);
}

pub fn Function(comptime arg: anytype) type {
    const AT = @TypeOf(arg);
    const FT = if (@typeInfo(AT) == .type) arg else AT;
    return switch (@typeInfo(FT)) {
        .@"fn" => FT,
        else => @compileError("Function expected, received " ++ @typeName(FT)),
    };
}

pub fn PromiseOf(comptime arg: anytype) type {
    const FT = Function(arg);
    const f = @typeInfo(FT).@"fn";
    return Promise(f.return_type.?);
}

pub fn PromiseArgOf(comptime arg: anytype) type {
    const FT = Function(arg);
    const f = @typeInfo(FT).@"fn";
    return inline for (f.params) |param| {
        if (getInternalType(param.type) == .promise) break param.type.?;
    } else @compileError("No promise argument: " ++ @typeName(FT));
}

pub fn Generator(comptime T: type, comptime need_allocator: bool) type {
    if (IteratorPayload(T) == null) {
        @compileError("Expecting optional type, received: " ++ @typeName(T));
    }
    return if (need_allocator)
        struct {
            allocator: std.mem.Allocator,
            ptr: ?*anyopaque = null,
            callback: *const fn (allocator: std.mem.Allocator, ?*anyopaque, T) bool,

            pub const payload = T;

            const internal_type: InternalType = .generator;

            pub fn init(allocator: std.mem.Allocator, ptr: ?*const anyopaque, cb: anytype) @This() {
                return .{
                    .allocator = allocator,
                    .ptr = @constCast(ptr),
                    .callback = getCallback(fn (?*anyopaque, T) bool, cb),
                };
            }

            pub fn yield(self: @This(), value: T) bool {
                return self.callback(self.allocator, self.ptr, value);
            }

            pub fn end(self: anytype) void {
                _ = self.yield(null);
            }

            pub fn pipe(self: anytype, arg: anytype) void {
                const AT = @TypeOf(arg);
                if (IteratorReturnValue(AT) == null) {
                    @compileError("Expecting an iterator, received: " ++ @typeName(AT));
                }
                var iter = switch (@typeInfo(AT)) {
                    .error_union => arg catch |err| {
                        _ = self.yield(err);
                        return;
                    },
                    else => arg,
                };
                defer if (@hasDecl(@TypeOf(iter), "deinit")) iter.deinit();
                while (true) {
                    const result = iter.next(self.allocator);
                    // break if callback returns false
                    if (!self.yield(result)) break;
                    // break if result is an error or null
                    switch (@typeInfo(@TypeOf(result))) {
                        .error_union => if (result) |value| {
                            if (value == null) break;
                        } else |_| break,
                        .optional => if (result == null) break,
                        else => {},
                    }
                }
            }

            pub fn any(self: @This()) Generator(Any(T), need_allocator) {
                return .{
                    .allocator = self.allocator,
                    .ptr = self.ptr,
                    .callback = @ptrCast(self.callback),
                };
            }
        }
    else
        struct {
            ptr: ?*anyopaque = null,
            callback: *const fn (?*anyopaque, T) bool,

            pub const payload = T;

            const internal_type: InternalType = .generator;

            pub fn init(ptr: ?*const anyopaque, cb: anytype) @This() {
                return .{
                    .ptr = @constCast(ptr),
                    .callback = getCallback(fn (?*anyopaque, T) bool, cb),
                };
            }

            pub fn yield(self: @This(), value: T) bool {
                return self.callback(self.ptr, value);
            }

            pub fn end(self: anytype) void {
                _ = self.yield(null);
            }

            pub fn pipe(self: anytype, arg: anytype) void {
                const AT = @TypeOf(arg);
                if (IteratorReturnValue(AT) == null) {
                    @compileError("Expecting an iterator, received: " ++ @typeName(AT));
                }
                var iter = switch (@typeInfo(AT)) {
                    .error_union => arg catch |err| {
                        _ = self.yield(err);
                        return;
                    },
                    else => arg,
                };
                defer if (@hasDecl(@TypeOf(iter), "deinit")) iter.deinit();
                while (true) {
                    const result = iter.next();
                    // break if callback returns false
                    if (!self.yield(result)) break;
                    // break if result is an error or null
                    switch (@typeInfo(@TypeOf(result))) {
                        .error_union => if (result) |value| {
                            if (value == null) break;
                        } else |_| break,
                        .optional => if (result == null) break,
                        else => {},
                    }
                }
            }

            pub fn any(self: @This()) Generator(Any(T), need_allocator) {
                return .{
                    .ptr = self.ptr,
                    .callback = @ptrCast(self.callback),
                };
            }
        };
}

pub fn GeneratorOf(comptime arg: anytype) type {
    const FT = Function(arg);
    const f = @typeInfo(FT).@"fn";
    return if (IteratorReturnValue(f.return_type.?)) |T|
        Generator(T, isIteratorAllocating(f.return_type.?))
    else
        @compileError("Function does not return an iterator: " ++ @typeName(FT));
}

pub fn GeneratorArgOf(comptime arg: anytype) type {
    const FT = Function(arg);
    const f = @typeInfo(FT).@"fn";
    return inline for (f.params) |param| {
        if (getInternalType(param.type) == .generator) break param.type.?;
    } else @compileError("No generator argument: " ++ @typeName(FT));
}

pub const AbortSignal = struct {
    ptr: *const volatile i32,

    const internal_type: InternalType = .abort_signal;

    pub inline fn on(self: @This()) bool {
        return self.ptr.* != 0;
    }

    pub inline fn off(self: @This()) bool {
        return self.ptr.* == 0;
    }
};

pub fn Queue(comptime T: type) type {
    return struct {
        const Node = struct {
            next: *Node,
            payload: T,
        };
        const tail: *Node = @ptrFromInt(std.mem.alignBackward(usize, std.math.maxInt(usize), @alignOf(Node)));

        head: *Node = tail,
        allocator: std.mem.Allocator,
        stopped: bool = false,
        item_futex: std.atomic.Value(u32) = std.atomic.Value(u32).init(0),

        pub fn push(self: *@This(), value: T) !void {
            const new_node = try self.alloc();
            new_node.* = .{ .next = tail, .payload = value };
            self.insert(new_node);
            self.item_futex.store(1, .release);
            std.Thread.Futex.wake(&self.item_futex, 1);
        }

        fn alloc(self: *@This()) !*Node {
            while (true) {
                const current_head = self.head;
                if (current_head != tail and isMarkedReference(current_head.next)) {
                    const next_node = getUnmarkedReference(current_head.next);
                    if (cas(&self.head, current_head, next_node)) return current_head;
                } else break;
            }
            return try self.allocator.create(Node);
        }

        fn insert(self: *@This(), node: *Node) void {
            while (true) {
                if (self.head == tail) {
                    if (cas(&self.head, tail, node)) return;
                } else {
                    var current_node = self.head;
                    while (true) {
                        const next_node = getUnmarkedReference(current_node.next);
                        if (next_node == tail) {
                            const next = switch (isMarkedReference(current_node.next)) {
                                false => node,
                                true => getMarkedReference(node),
                            };
                            if (cas(&current_node.next, current_node.next, next)) return;
                            break;
                        }
                        current_node = next_node;
                    }
                }
            }
        }

        pub fn pull(self: *@This()) ?T {
            var current_node = self.head;
            while (current_node != tail) {
                const next_node = getUnmarkedReference(current_node.next);
                if (!isMarkedReference(current_node.next)) {
                    if (cas(&current_node.next, next_node, getMarkedReference(next_node))) {
                        return current_node.payload;
                    }
                }
                current_node = next_node;
            }
            self.item_futex.store(0, .release);
            return null;
        }

        pub fn wait(self: *@This()) void {
            std.Thread.Futex.wait(&self.item_futex, 0);
        }

        pub fn stop(self: *@This()) void {
            if (self.stopped) return;
            self.stopped = true;
            while (self.pull()) |_| {}
            // wake up awaking threads and prevent them from sleep again
            self.item_futex.store(1, .release);
            std.Thread.Futex.wake(&self.item_futex, std.math.maxInt(u32));
        }

        pub fn deinit(self: *@This()) void {
            var current_node = self.head;
            return while (current_node != tail) {
                const next_node = getUnmarkedReference(current_node.next);
                self.allocator.destroy(current_node);
                current_node = next_node;
            };
        }

        inline fn isMarkedReference(ptr: *Node) bool {
            return @intFromPtr(ptr) & 1 != 0;
        }

        inline fn getUnmarkedReference(ptr: *Node) *Node {
            return @ptrFromInt(@intFromPtr(ptr) & ~@as(usize, 1));
        }

        inline fn getMarkedReference(ptr: *Node) *Node {
            @setRuntimeSafety(false);
            return @ptrFromInt(@intFromPtr(ptr) | @as(usize, 1));
        }

        inline fn cas(ptr: **Node, old: *Node, new: *Node) bool {
            return @cmpxchgWeak(*Node, ptr, old, new, .seq_cst, .monotonic) == null;
        }
    };
}

test "Queue" {
    var gpa = std.heap.DebugAllocator(.{}).init;
    var queue: Queue(i32) = .{ .allocator = gpa.allocator() };
    try queue.push(123);
    try queue.push(456);
    const value1 = queue.pull();
    try expectEqual(123, value1);
    const value2 = queue.pull();
    try expectEqual(456, value2);
    const value3 = queue.pull();
    try expectEqual(null, value3);
    try queue.push(888);
    const value4 = queue.pull();
    try expectEqual(888, value4);
    queue.deinit();
}

pub fn WorkQueue(comptime ns: type, comptime internal_ns: type) type {
    const decls = std.meta.declarations(ns);
    return struct {
        queue: Queue(WorkItem) = undefined,
        thread_count: usize = 0,
        status: Status = .uninitialized,
        init_remaining: usize = undefined,
        init_futex: std.atomic.Value(u32) = undefined,
        init_result: WaitResult = undefined,
        init_promise: ?Promise(WaitResult) = undefined,
        deinit_promise: ?Promise(void) = undefined,

        pub const ThreadStartError = switch (@hasDecl(ns, "onThreadStart")) {
            false => error{},
            true => switch (@typeInfo(ReturnValue(ns.onThreadStart))) {
                .error_union => |eu| eu.error_set,
                else => error{},
            },
        };
        pub const ThreadStartParams = switch (@hasDecl(ns, "onThreadStart")) {
            false => struct {},
            true => std.meta.ArgsTuple(@TypeOf(ns.onThreadStart)),
        };
        pub const ThreadEndParams = switch (@hasDecl(ns, "onThreadEnd")) {
            false => struct {},
            true => std.meta.ArgsTuple(@TypeOf(ns.onThreadEnd)),
        };
        pub const Options = init: {
            const fields = std.meta.fields(struct {
                allocator: std.mem.Allocator,
                stack_size: usize = if (builtin.target.cpu.arch.isWasm()) 262144 else std.Thread.SpawnConfig.default_stack_size,
                n_jobs: usize = 1,
                thread_start_params: ThreadStartParams,
                thread_end_params: ThreadEndParams,
            });
            // there're no start or end params, provide a default value
            var new_fields: [fields.len]std.builtin.Type.StructField = undefined;
            for (fields, 0..) |field, i| {
                new_fields[i] = field;
                if (@sizeOf(field.type) == 0) {
                    new_fields[i].default_value_ptr = @ptrCast(&@as(field.type, .{}));
                }
            }
            break :init @Type(.{
                .@"struct" = .{
                    .layout = .auto,
                    .fields = &new_fields,
                    .decls = &.{},
                    .is_tuple = false,
                },
            });
        };

        pub fn init(self: *@This(), options: Options) !void {
            switch (self.status) {
                .uninitialized => {},
                .initialized => return error.AlreadyInitialized,
                .deinitializing => return error.Deinitializing,
            }
            const allocator = options.allocator;
            self.queue = .{ .allocator = allocator };
            self.init_remaining = options.n_jobs;
            self.init_futex = std.atomic.Value(u32).init(0);
            self.init_result = {};
            self.init_promise = null;
            self.deinit_promise = null;
            if (@hasDecl(internal_ns, "onQueueInit")) {
                const result = @call(.auto, internal_ns.onQueueInit, .{});
                switch (@typeInfo(@TypeOf(result))) {
                    .error_union => if (result) |_| {} else |err| return err,
                    else => {},
                }
            }
            errdefer {
                if (@hasDecl(internal_ns, "onQueueDeinit")) {
                    _ = @call(.auto, internal_ns.onQueueDeinit, .{});
                }
                self.queue.stop();
            }
            const min_stack_size: usize = if (std.Thread.use_pthreads) switch (@bitSizeOf(usize)) {
                32 => 4096,
                else => 1048576,
            } else std.heap.pageSize();
            const spawn_config: std.Thread.SpawnConfig = .{
                .stack_size = @max(min_stack_size, options.stack_size),
                .allocator = allocator,
            };
            for (0..options.n_jobs) |_| {
                const thread = try std.Thread.spawn(spawn_config, handleWorkItems, .{
                    self,
                    options.thread_start_params,
                    options.thread_end_params,
                });
                thread.detach();
                self.thread_count += 1;
            }
            self.status = .initialized;
        }

        pub fn wait(self: *@This()) WaitResult {
            std.Thread.Futex.wait(&self.init_futex, 0);
            return self.init_result;
        }

        pub fn waitAsync(self: *@This(), promise: Promise(WaitResult)) void {
            if (self.init_futex.load(.acquire) == 1) {
                promise.resolve(self.init_result);
            } else {
                self.init_promise = promise;
            }
        }

        pub fn deinitAsync(self: *@This(), promise: ?Promise(void)) void {
            switch (self.status) {
                .initialized => {},
                else => {
                    if (promise) |p| p.resolve({});
                    return;
                },
            }
            self.deinit_promise = promise;
            self.status = .deinitializing;
            self.queue.stop();
        }

        pub fn push(self: *@This(), comptime func: anytype, args: ArgsOf(func), dest: ?PromiseOrGenerator(func)) !void {
            switch (self.status) {
                .initialized => {},
                else => return error.Unexpected,
            }
            const key = comptime enumOf(func);
            const fieldName = @tagName(key);
            const Call = @FieldType(WorkItem, fieldName);
            const item = switch (@hasField(Call, "generator")) {
                true => @unionInit(WorkItem, fieldName, .{ .args = args, .generator = dest }),
                false => @unionInit(WorkItem, fieldName, .{ .args = args, .promise = dest }),
            };
            try self.queue.push(item);
        }

        pub fn clear(self: *@This()) void {
            switch (self.status) {
                .initialized => {},
                else => return,
            }
            while (self.queue.pull() != null) {}
        }

        const Status = enum {
            uninitialized,
            initialized,
            deinitializing,
        };
        const WaitResult = switch (ThreadStartError) {
            error{} => void,
            else => ThreadStartError!void,
        };
        const WorkItem = init: {
            var enum_fields: [decls.len]std.builtin.Type.EnumField = undefined;
            var union_fields: [decls.len]std.builtin.Type.UnionField = undefined;
            var count = 0;
            for (decls) |decl| {
                const DT = @TypeOf(@field(ns, decl.name));
                switch (@typeInfo(DT)) {
                    .@"fn" => |f| {
                        if (f.return_type) |RT| {
                            // if the return value is an iterator, then a generator is expected
                            // otherwise an optional promise can be provided
                            const Task = if (IteratorReturnValue(RT)) |IT| struct {
                                args: std.meta.ArgsTuple(DT),
                                generator: ?Generator(IT, isIteratorAllocating(RT)),
                            } else struct {
                                args: std.meta.ArgsTuple(DT),
                                promise: ?Promise(RT),
                            };
                            enum_fields[count] = .{ .name = decl.name, .value = count };
                            union_fields[count] = .{
                                .name = decl.name,
                                .type = Task,
                                .alignment = @alignOf(Task),
                            };
                            count += 1;
                        }
                    },
                    else => {},
                }
            }
            break :init @Type(.{
                .@"union" = .{
                    .layout = .auto,
                    .tag_type = @Type(.{
                        .@"enum" = .{
                            .tag_type = if (count <= 256) u8 else u16,
                            .fields = enum_fields[0..count],
                            .decls = &.{},
                            .is_exhaustive = true,
                        },
                    }),
                    .fields = union_fields[0..count],
                    .decls = &.{},
                },
            });
        };
        const WorkItemEnum = @typeInfo(WorkItem).@"union".tag_type.?;

        fn enumOf(comptime func: anytype) WorkItemEnum {
            return for (decls) |decl| {
                const dv = @field(ns, decl.name);
                if (@TypeOf(dv) == @TypeOf(func)) {
                    if (dv == func) break @field(WorkItemEnum, decl.name);
                }
            } else @compileError("Function not found in " ++ @typeName(ns));
        }

        fn ArgsOf(comptime func: anytype) type {
            return std.meta.ArgsTuple(@TypeOf(func));
        }

        fn PromiseOrGenerator(comptime func: anytype) type {
            const RT = ReturnValue(func);
            return if (IteratorReturnValue(RT)) |IT|
                Generator(IT, isIteratorAllocating(RT))
            else
                Promise(RT);
        }

        fn handleWorkItems(
            self: *@This(),
            thread_start_params: ThreadStartParams,
            thread_end_params: ThreadEndParams,
        ) void {
            var start_succeeded = true;
            if (@hasDecl(ns, "onThreadStart")) {
                const result = @call(.auto, ns.onThreadStart, thread_start_params);
                if (ThreadStartError != error{}) {
                    if (result) |_| {} else |err| {
                        self.init_result = err;
                        start_succeeded = false;
                    }
                }
            }
            if (@atomicRmw(usize, &self.init_remaining, .Sub, 1, .monotonic) == 1) {
                if (@typeInfo(WaitResult) != .error_union or !std.meta.isError(self.init_result)) {
                    self.init_futex.store(1, .release);
                    std.Thread.Futex.wake(&self.init_futex, std.math.maxInt(u32));
                    if (self.init_promise) |promise| promise.resolve(self.init_result);
                } else {
                    // delay reporting error until threads have stopped
                    self.queue.stop();
                }
            }
            while (true) {
                if (self.queue.pull()) |item| {
                    invokeFunction(item);
                } else switch (self.queue.stopped) {
                    false => self.queue.wait(),
                    true => break,
                }
            }
            if (@hasDecl(ns, "onThreadEnd")) {
                if (start_succeeded) _ = @call(.auto, ns.onThreadEnd, thread_end_params);
            }
            if (@atomicRmw(usize, &self.thread_count, .Sub, 1, .monotonic) == 1) {
                self.queue.deinit();
                self.status = .uninitialized;
                if (@typeInfo(WaitResult) == .error_union and std.meta.isError(self.init_result)) {
                    self.init_futex.store(1, .release);
                    std.Thread.Futex.wake(&self.init_futex, std.math.maxInt(u32));
                    if (self.init_promise) |promise| promise.resolve(self.init_result);
                }
                if (self.deinit_promise) |promise| promise.resolve({});
                if (@hasDecl(internal_ns, "onQueueDeinit")) {
                    _ = @call(.auto, internal_ns.onQueueDeinit, .{});
                }
            }
        }

        fn invokeFunction(item: WorkItem) void {
            const un = @typeInfo(WorkItem).@"union";
            inline for (un.fields) |field| {
                const key = @field(WorkItemEnum, field.name);
                if (item == key) {
                    const func = @field(ns, field.name);
                    const call = @field(item, field.name);
                    const result = @call(.auto, func, call.args);
                    switch (@hasField(@TypeOf(call), "generator")) {
                        true => if (call.generator) |g| g.pipe(result),
                        false => if (call.promise) |p| p.resolve(result),
                    }
                }
            }
        }
    };
}

test "WorkQueue" {
    const test_ns = struct {
        var total: i32 = 0;

        pub fn hello(num: i32) void {
            total += num;
        }

        pub fn world() void {}

        pub fn shutdown(futex: *std.atomic.Value(u32), _: void) void {
            futex.store(1, .monotonic);
            std.Thread.Futex.wake(futex, 1);
        }
    };
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    var queue: WorkQueue(test_ns, struct {}) = .{};
    try queue.init(.{ .allocator = gpa.allocator(), .n_jobs = 1 });
    try queue.push(test_ns.hello, .{123}, null);
    try queue.push(test_ns.hello, .{456}, null);
    try queue.push(test_ns.world, .{}, null);
    std.time.sleep(1e+8);
    try expect(test_ns.total == 123 + 456);
    var futex: std.atomic.Value(u32) = .init(0);
    queue.deinitAsync(.init(&futex, test_ns.shutdown));
    // wait for thread shutdown
    std.Thread.Futex.wait(&futex, 0);
}

fn isValidCallback(comptime FT: type, comptime AT: type, comptime RT: type) bool {
    switch (@typeInfo(FT)) {
        .@"fn" => |f| {
            if (f.params.len == 2 and f.return_type == RT) {
                if (f.params[0].type != null and f.params[1].type == AT) {
                    comptime var T = f.params[0].type.?;
                    if (@typeInfo(T) == .optional) T = @typeInfo(T).optional.child;
                    if (@typeInfo(T) == .pointer and @typeInfo(T).pointer.size == .one) return true;
                }
            }
        },
        .pointer => |pt| {
            if (@typeInfo(pt.child) == .@"fn" and isValidCallback(pt.child, AT, RT)) {
                return true;
            }
        },
        else => {},
    }
    return false;
}

test "isValidCallback" {
    try expectEqual(false, isValidCallback(void, u32, void));
    try expectEqual(false, isValidCallback(*anyopaque, u32, void));
    try expectEqual(true, isValidCallback(*fn (*anyopaque, u32) void, u32, void));
    try expectEqual(true, isValidCallback(*fn (?*anyopaque, u32) void, u32, void));
    try expectEqual(false, isValidCallback(*fn (*anyopaque, u32) bool, u32, void));
    try expectEqual(true, isValidCallback(*fn (*usize, u32) void, u32, void));
    try expectEqual(false, isValidCallback(*fn (*usize, u32) i32, u32, void));
    try expectEqual(false, isValidCallback(*fn ([*]usize, u32) void, u32, void));
    try expectEqual(false, isValidCallback(**fn (*usize, u32) void, u32, void));
}

fn getCallback(comptime FT: type, cb: anytype) *const FT {
    const CBT = @TypeOf(cb);
    const f = @typeInfo(FT).@"fn";
    if (comptime !isValidCallback(CBT, f.params[1].type.?, f.return_type.?)) {
        @compileError("Expecting " ++ @typeName(FT) ++ ", received: " ++ @typeName(CBT));
    }
    const fn_ptr = switch (@typeInfo(CBT)) {
        .pointer => cb,
        .@"fn" => &cb,
        else => unreachable,
    };
    return @ptrCast(fn_ptr);
}

test "getCallback" {
    const ns = struct {
        fn hello(_: *const u32, _: i32) void {}
    };
    const cb = getCallback(fn (?*anyopaque, i32) void, ns.hello);
    try expectEqual(@intFromPtr(&ns.hello), @intFromPtr(cb));
}

test {
    _ = Memory;
    _ = TypeData;
    _ = TypeDataCollector;
}

const runtime_safety = (builtin.mode == .ReleaseSafe or builtin.mode == .Debug);
