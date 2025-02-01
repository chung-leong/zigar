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
        is_generator: bool = false,
        is_abort_signal: bool = false,

        is_optional: bool = false,
        _: u19 = 0,
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

pub fn IntFor(comptime n: comptime_int) type {
    comptime var bits = 8;
    const signedness = if (n < 0) .signed else .unsigned;
    return inline while (true) : (bits *= 2) {
        const T = @Type(.{ .Int = .{ .signedness = signedness, .bits = bits } });
        if (std.math.minInt(T) <= n and n <= std.math.maxInt(T)) {
            break T;
        }
    };
}

test "IntFor" {
    try expectCT(IntFor(0) == u8);
    try expectCT(IntFor(0xFFFFFFFF) == u32);
    try expectCT(IntFor(-0xFFFFFFFF) == i64);
    try expectCT(IntFor(123) == u8);
    try expectCT(IntFor(-123) == i8);
}

pub const ErrorInt = @Type(.{
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
    signature: u64 = 0,

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
                true => IntFor(un.fields.len),
                false => null,
            },
            .Optional => |op| switch (@typeInfo(op.child)) {
                .Pointer => usize, // size of the pointer itself
                .ErrorSet => ErrorInt,
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

    pub fn getSignature(comptime self: @This()) u64 {
        return self.signature;
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

    pub fn isIterator(comptime self: @This()) bool {
        return IteratorReturnValue(self.type) != null;
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

    pub fn isFunction(comptime self: @This()) bool {
        return switch (@typeInfo(self.type)) {
            .Fn => true,
            else => false,
        };
    }

    pub fn isVariadic(comptime self: @This()) bool {
        return switch (@typeInfo(self.type)) {
            .Fn => |f| f.is_var_args,
            else => false,
        };
    }

    pub fn isArguments(comptime self: @This()) bool {
        return self.attrs.is_arguments;
    }

    pub fn isThrowing(comptime self: @This()) bool {
        return inline for (@typeInfo(self.type).Struct.fields, 0..) |field, i| {
            if (i == 0) {
                // retval
                if (@typeInfo(field.type) == .ErrorUnion) break true;
            } else {
                const internal_type = comptime getInternalType(field.type);
                if (internal_type == .promise or internal_type == .generator) {
                    switch (@typeInfo(field.type.payload)) {
                        .ErrorUnion => break true,
                        .Optional => |op| switch (@typeInfo(op.child)) {
                            .ErrorUnion => break true,
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

    pub fn isOptional(comptime self: @This()) bool {
        return self.isAllocator() or getInternalType(self.type) != null;
    }

    pub fn isAllocator(comptime self: @This()) bool {
        return self.type == std.mem.Allocator;
    }

    pub fn isPromise(comptime self: @This()) bool {
        return getInternalType(self.type) == .promise;
    }

    pub fn isGenerator(comptime self: @This()) bool {
        return getInternalType(self.type) == .generator;
    }

    pub fn isAbortSignal(comptime self: @This()) bool {
        return getInternalType(self.type) == .abort_signal;
    }

    pub fn isOptionalStruct(comptime self: @This()) bool {
        return hasDefaultFields(self.type);
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

    pub fn isInternal(comptime self: @This()) bool {
        return switch (@typeInfo(self.type)) {
            .Struct => @hasDecl(self.type, "internal_type") and @TypeOf(self.type.internal_type) == InternalType,
            else => false,
        };
    }

    test "isInternal" {
        try expectCT(isInternal(.{ .type = AbortSignal }) == true);
        try expectCT(isInternal(.{ .type = struct {} }) == false);
        try expectCT(isInternal(.{ .type = Promise(f64) }) == true);
        try expectCT(isInternal(.{ .type = Promise(anyerror!u32) }) == true);
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
            // set signature of types
            self.setSignature(td);
            if (td.isSupported()) {
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
            .ErrorSet => self.add(ErrorInt),
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

    fn addTypeOf(comptime self: *@This(), comptime value: anytype) void {
        const T = @TypeOf(value);
        switch (@typeInfo(T)) {
            .Type => self.add(value),
            .ComptimeFloat => self.add(*const f64),
            .ComptimeInt => self.add(*const IntFor(value)),
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
            inline .Array, .Vector, .Optional => |ar| {
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

    fn setSignature(comptime self: *@This(), comptime td: *TypeData) void {
        if (td.isSupported()) {
            td.signature = self.calcSignature(td);
        }
    }

    fn calcSignature(comptime self: *@This(), comptime td: *TypeData) u64 {
        var md5 = std.crypto.hash.Md5.init(.{});
        switch (@typeInfo(td.type)) {
            .Struct => |st| {
                md5.update(switch (st.layout) {
                    .@"extern" => "extern struct",
                    .@"packed" => "packed struct",
                    else => "struct",
                });
                if (st.backing_integer) |BIT| {
                    md5.update("(");
                    md5.update(std.mem.asBytes(&self.get(BIT).signature));
                    md5.update(")");
                }
                md5.update(" {");
                for (st.fields) |field| {
                    if (!field.is_comptime) {
                        md5.update(field.name);
                        md5.update(": ");
                        md5.update(std.mem.asBytes(&self.get(field.type).signature));
                        if (field.alignment != @alignOf(field.type)) {
                            md5.update(std.fmt.comptimePrint(" align({d})\n", .{field.alignment}));
                        }
                        md5.update(", ");
                    }
                }
                md5.update("}");
            },
            .Union => |un| {
                md5.update(switch (un.layout) {
                    .@"extern" => "extern union",
                    else => "union",
                });
                if (un.tag_type) |TT| {
                    md5.update("(");
                    md5.update(std.mem.asBytes(&self.get(TT).signature));
                    md5.update(")");
                }
                md5.update(" {");
                for (un.fields) |field| {
                    md5.update(field.name);
                    md5.update(": ");
                    md5.update(std.mem.asBytes(&self.get(field.type).signature));
                    if (field.alignment != @alignOf(field.type)) {
                        md5.update(std.fmt.comptimePrint(" align({d})", .{field.alignment}));
                    }
                    md5.update(", ");
                }
                md5.update("}");
            },
            .Array => |ar| {
                md5.update(std.fmt.comptimePrint("[{d}]", .{ar.len}));
                md5.update(std.mem.asBytes(&self.get(ar.child).signature));
            },
            .Vector => |ar| {
                md5.update(std.fmt.comptimePrint("@Vector({d}, ", .{ar.len}));
                md5.update(std.mem.asBytes(&self.get(ar.child).signature));
                md5.update(")");
            },
            .Optional => |op| {
                md5.update("?");
                md5.update(std.mem.asBytes(&self.get(op.child).signature));
            },
            .ErrorUnion => |eu| {
                md5.update(std.mem.asBytes(&self.get(eu.error_set).signature));
                md5.update("!");
                md5.update(std.mem.asBytes(&self.get(eu.payload).signature));
            },
            .Pointer => |pt| {
                md5.update(switch (pt.size) {
                    .One => "*",
                    .Many => "[*",
                    .Slice => "[",
                    .C => "[*c",
                });
                if (pt.sentinel) |ptr| {
                    const value = @as(*const pt.child, @ptrCast(@alignCast(ptr))).*;
                    md5.update(std.fmt.comptimePrint(":{d}", .{value}));
                }
                md5.update(switch (pt.size) {
                    .One => "",
                    else => "]",
                });
                if (pt.is_const) {
                    md5.update("const ");
                }
                if (pt.is_allowzero) {
                    md5.update("allowzero ");
                }
                md5.update(std.mem.asBytes(&self.get(pt.child).signature));
            },
            .Fn => |f| {
                md5.update("fn (");
                if (f.is_var_args) {
                    md5.update("...");
                }
                for (f.params) |param| {
                    if (param.is_noalias) {
                        md5.update("noalias ");
                    }
                    if (param.type) |PT| {
                        md5.update(std.mem.asBytes(&self.get(PT).signature));
                    } else {
                        md5.update("anytype");
                    }
                    md5.update(", ");
                }
                md5.update(") ");
                if (f.calling_convention != .Unspecified) {
                    md5.update("callconv(.");
                    md5.update(@tagName(f.calling_convention));
                    md5.update(") ");
                }
                if (f.return_type) |RT| {
                    md5.update(std.mem.asBytes(&self.get(RT).signature));
                }
            },
            else => md5.update(@typeName(td.type)),
        }
        var out: [16]u8 = undefined;
        md5.final(&out);
        return std.mem.bytesToValue(u64, out[0..8]);
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
        try expectCT(tdc.indexOf(ns.StructA) != null);
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
            pub const FnC = fn () callconv(.C) u32;
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

fn ReturnValue(comptime arg: anytype) type {
    const FT = Function(arg);
    const f = @typeInfo(FT).Fn;
    return f.return_type orelse @TypeOf(undefined);
}

test "ReturnValue" {
    const T = ReturnValue(fn () void);
    try expect(T == void);
}

fn IteratorPayload(comptime T: type) ?type {
    return switch (@typeInfo(T)) {
        .Optional => |op| switch (@typeInfo(op.child)) {
            .ErrorUnion => |eu| eu.payload,
            else => op.child,
        },
        .ErrorUnion => |eu| IteratorPayload(eu.payload),
        else => null,
    };
}

test "IteratorPayload" {
    const T1 = IteratorPayload(?i32);
    try expect(T1 == i32);
    const T2 = IteratorPayload(anyerror!?i32);
    try expect(T2 == i32);
    const T3 = IteratorPayload(i32);
    try expect(T3 == null);
    const T4 = IteratorPayload(anyerror!i32);
    try expect(T4 == null);
    const T5 = IteratorPayload(?anyerror!i32);
    try expect(T5 == i32);
}

fn hasDefaultFields(comptime T: type) bool {
    return switch (@typeInfo(T)) {
        .Struct => |st| inline for (st.fields) |field| {
            if (field.default_value == null) break false;
        } else true,
        else => false,
    };
}

test "hasDefaultFields" {
    const S1 = struct {
        number1: i32,
        number2: i32,
    };
    try expect(hasDefaultFields(S1) == false);
    const S2 = struct {
        number1: i32 = 1,
        number2: i32,
    };
    try expect(hasDefaultFields(S2) == false);
    const S3 = struct {
        number1: i32 = 1,
        number2: i32 = 2,
    };
    try expect(hasDefaultFields(S3) == true);
}

fn NextMethodReturnValue(comptime FT: type, comptime T: type) ?type {
    const f = @typeInfo(FT).Fn;
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
    try expect(T1 orelse unreachable == ?i32);
    const T2 = NextMethodReturnValue(@TypeOf(S.next2), S);
    try expect(T2 orelse unreachable == error{OutOfMemory}!?i32);
    const T3 = NextMethodReturnValue(@TypeOf(S.next3), S);
    try expect(T3 == null);
    const T4 = NextMethodReturnValue(@TypeOf(S.next4), S);
    try expect(T4 == null);
    const T5 = NextMethodReturnValue(@TypeOf(S.next5), S);
    try expect(T5 == null);
    const T6 = NextMethodReturnValue(@TypeOf(S.next6), S);
    try expect(T6 orelse unreachable == ?i32);
    const T7 = NextMethodReturnValue(@TypeOf(S.next7), S);
    try expect(T7 == null);
}

pub fn IteratorReturnValue(comptime T: type) ?type {
    switch (@typeInfo(T)) {
        .Struct, .Union, .Opaque => if (@hasDecl(T, "next")) {
            const next = @field(T, "next");
            return NextMethodReturnValue(@TypeOf(next), T);
        },
        .ErrorUnion => |eu| if (IteratorReturnValue(eu.payload)) |RT| {
            return switch (@typeInfo(RT)) {
                .ErrorUnion => |rt_eu| (eu.error_set || rt_eu.error_set)!rt_eu.payload,
                else => eu.error_set!RT,
            };
        },
        else => {},
    }
    return null;
}

test "IteratorReturnValue" {
    const T1 = IteratorReturnValue(std.mem.SplitIterator(u8, .sequence));
    try expect(T1 != null and IteratorPayload(T1.?) == []const u8);
    const T2 = IteratorReturnValue(error{Doh}!std.fs.path.ComponentIterator(.posix, u8));
    try expect(T2 != null);
    const T3 = IteratorReturnValue(std.fs.path);
    try expect(T3 == null);
}

const InternalType = enum {
    promise,
    generator,
    abort_signal,
};

pub fn getInternalType(comptime OT: ?type) ?InternalType {
    if (OT) |T| {
        if (@typeInfo(T) == .Struct) {
            if (@hasDecl(T, "internal_type") and @TypeOf(T.internal_type) == InternalType) {
                return T.internal_type;
            }
        }
    }
    return null;
}

test "getInternalType" {
    try expect(getInternalType(Promise(i32)) == .promise);
    try expect(getInternalType(Generator(?i32)) == .generator);
    try expect(getInternalType(AbortSignal) == .abort_signal);
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
                    if (@typeInfo(T) == .ErrorUnion) {
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
                try expect(ns.test_value catch unreachable == 0);
                multipart_promise1.resolve(3);
                try expect(ns.test_value catch unreachable == 3);
                const promise2: @This() = @This().init(null, ns.resolve);
                const multipart_promise2 = try promise2.partition(gpa.allocator(), 3);
                multipart_promise2.resolve(error.OutOfMemory);
                try expect(ns.test_value catch 777 == 777);
            }
        }
    };
}

test {
    _ = Promise(anyerror!u32);
}

pub fn Function(comptime arg: anytype) type {
    const AT = @TypeOf(arg);
    const FT = if (@typeInfo(AT) == .Type) arg else AT;
    return switch (@typeInfo(FT)) {
        .Fn => FT,
        else => @compileError("Function expected, received " ++ @typeName(FT)),
    };
}

pub fn PromiseOf(comptime arg: anytype) type {
    const FT = Function(arg);
    const f = @typeInfo(FT).Fn;
    return inline for (f.params) |param| {
        if (getInternalType(param.type) == .promise) break param.type.?;
    } else Promise(f.return_type.?);
}

pub fn Generator(comptime T: type) type {
    if (IteratorPayload(T) == null) {
        @compileError("Expecting optional type, received: " ++ @typeName(T));
    }
    return struct {
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

        pub fn end(self: @This()) void {
            _ = self.yield(null);
        }

        pub fn pipe(self: @This(), arg: anytype) void {
            const AT = @TypeOf(arg);
            if (IteratorReturnValue(AT) == null) {
                @compileError("Expecting an iterator, received: " ++ @typeName(AT));
            }
            var iter = switch (@typeInfo(AT)) {
                .ErrorUnion => arg catch |err| {
                    _ = self.yield(err);
                    return;
                },
                else => arg,
            };
            while (true) {
                const result = iter.next();
                // break if callback returns false
                if (!self.yield(result)) break;
                // break if result is an error or null
                switch (@typeInfo(@TypeOf(result))) {
                    .ErrorUnion => if (result) |value| {
                        if (value == null) break;
                    } else |_| break,
                    .Optional => if (result == null) break,
                    else => {},
                }
            }
        }
    };
}

pub fn GeneratorOf(comptime arg: anytype) type {
    const FT = Function(arg);
    const f = @typeInfo(FT).Fn;
    return inline for (f.params) |param| {
        if (getInternalType(param.type) == .generator) break param.type.?;
    } else typedef: {
        if (IteratorReturnValue(f.return_type.?)) |T| {
            break :typedef Generator(T);
        } else {
            @compileError("Function does not return an iterator: " ++ @typeName(FT));
        }
    };
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
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    var queue: Queue(i32) = .{ .allocator = gpa.allocator() };
    try queue.push(123);
    try queue.push(456);
    const value1 = queue.pull();
    try expect(value1 == 123);
    const value2 = queue.pull();
    try expect(value2 == 456);
    const value3 = queue.pull();
    try expect(value3 == null);
    try queue.push(888);
    const value4 = queue.pull();
    try expect(value4 == 888);
    queue.deinit();
}

pub fn WorkQueue(comptime ns: type) type {
    const st = switch (@typeInfo(ns)) {
        .Struct => |st| st,
        else => @compileError("Struct expected, received " ++ @typeName(ns)),
    };
    return struct {
        queue: Queue(WorkItem) = undefined,
        threads: []std.Thread = undefined,
        thread_count: usize = 0,
        status: Status = .uninitialized,
        init_remaining: usize = undefined,
        init_futex: std.atomic.Value(u32) = undefined,
        init_result: ThreadStartError!void = undefined,
        init_promise: ?Promise(ThreadStartError!void) = undefined,
        deinit_promise: ?Promise(void) = undefined,

        pub const Status = enum {
            uninitialized,
            initialized,
            deinitializing,
        };
        pub const Options = init: {
            const fields = std.meta.fields(struct {
                allocator: std.mem.Allocator,
                stack_size: usize = if (builtin.target.isWasm()) 262144 else 1048576,
                n_jobs: usize = 1,
                thread_start_params: ThreadStartParams,
                thread_end_params: ThreadEndParams,
            });
            // there're no start or end params, provide a default value
            var new_fields: [fields.len]std.builtin.Type.StructField = undefined;
            for (fields, 0..) |field, i| {
                new_fields[i] = field;
                if (@sizeOf(field.type) == 0) {
                    new_fields[i].default_value = @ptrCast(&@as(field.type, .{}));
                }
            }
            break :init @Type(.{
                .Struct = .{
                    .layout = .auto,
                    .fields = &new_fields,
                    .decls = &.{},
                    .is_tuple = false,
                },
            });
        };
        pub const WorkItem = init: {
            var enum_fields: [st.decls.len]std.builtin.Type.EnumField = undefined;
            var union_fields: [st.decls.len]std.builtin.Type.UnionField = undefined;
            var count = 0;
            for (st.decls) |decl| {
                const DT = @TypeOf(@field(ns, decl.name));
                switch (@typeInfo(DT)) {
                    .Fn => |f| {
                        if (f.return_type) |RT| {
                            // if the return value is an iterator, then a generator is expected
                            // otherwise an optional promise can be provided
                            const Task = if (IteratorReturnValue(RT)) |IT| struct {
                                args: std.meta.ArgsTuple(DT),
                                generator: ?Generator(IT),
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
                .Union = .{
                    .layout = .auto,
                    .tag_type = @Type(.{
                        .Enum = .{
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

        pub fn init(self: *@This(), options: Options) !void {
            switch (self.status) {
                .uninitialized => {},
                .initialized => return error.AlreadyInitialized,
                .deinitializing => return error.Deinitializing,
            }
            const allocator = options.allocator;
            self.queue = .{ .allocator = allocator };
            self.threads = try allocator.alloc(std.Thread, options.n_jobs);
            self.init_remaining = self.threads.len;
            self.init_futex = std.atomic.Value(u32).init(0);
            self.init_result = {};
            self.init_promise = null;
            self.deinit_promise = null;
            errdefer allocator.free(self.threads);
            errdefer for (0..self.thread_count) |i| self.threads[i].join();
            errdefer self.queue.deinit();
            const min_stack_size: usize = if (std.Thread.use_pthreads) switch (@bitSizeOf(usize)) {
                32 => 4096,
                else => 1048576,
            } else std.mem.page_size;
            const spawn_config: std.Thread.SpawnConfig = .{
                .stack_size = @max(min_stack_size, options.stack_size),
                .allocator = allocator,
            };
            for (0..options.n_jobs) |i| {
                self.threads[i] = try std.Thread.spawn(spawn_config, handleWorkItems, .{
                    self,
                    options.thread_start_params,
                    options.thread_end_params,
                });
                self.thread_count += 1;
            }
            self.status = .initialized;
        }

        pub fn wait(self: *@This()) ThreadStartError!void {
            std.Thread.Futex.wait(&self.init_futex, 0);
            return self.init_result;
        }

        pub fn waitAsync(self: *@This(), promise: Promise(ThreadStartError!void)) void {
            if (self.init_futex.load(.acquire) == 1) {
                promise.resolve(self.init_result);
            } else {
                self.init_promise = promise;
            }
        }

        pub fn deinit(self: *@This()) void {
            switch (self.status) {
                .initialized => {},
                else => return,
            }
            self.status = .deinitializing;
            self.queue.stop();
            for (self.threads) |thread| thread.join();
            self.queue.deinit();
            self.queue.allocator.free(self.threads);
            self.status = .uninitialized;
        }

        pub fn deinitAsync(self: *@This(), promise: Promise(void)) void {
            switch (self.status) {
                .initialized => {},
                else => return promise.resolve({}),
            }
            self.status = .deinitializing;
            self.deinit_promise = promise;
            self.queue.stop();
            for (self.threads) |thread| thread.detach();
        }

        pub fn push(self: *@This(), comptime func: anytype, args: ArgsOf(func), dest: ?PromiseOrGenerator(func)) !void {
            switch (self.status) {
                .initialized => {},
                else => return error.Unexpected,
            }
            const key = comptime EnumOf(func);
            const fieldName = @tagName(key);
            // @FieldType() not available in 0.13.0
            const Call = inline for (@typeInfo(WorkItem).Union.fields) |field| {
                if (comptime std.mem.eql(u8, field.name, fieldName)) break field.type;
            } else unreachable;
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

        const WorkItemEnum = @typeInfo(WorkItem).Union.tag_type.?;
        const ThreadStartParams = switch (@hasDecl(ns, "onThreadStart")) {
            false => struct {},
            true => std.meta.ArgsTuple(@TypeOf(ns.onThreadStart)),
        };
        const ThreadEndParams = switch (@hasDecl(ns, "onThreadEnd")) {
            false => struct {},
            true => std.meta.ArgsTuple(@TypeOf(ns.onThreadEnd)),
        };
        const ThreadStartError = switch (@hasDecl(ns, "onThreadStart")) {
            false => error{},
            true => switch (@typeInfo(ReturnValue(ns.onThreadStart))) {
                .ErrorUnion => |eu| eu.error_set,
                else => error{},
            },
        };

        fn EnumOf(comptime func: anytype) WorkItemEnum {
            return for (st.decls) |decl| {
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
            return if (IteratorReturnValue(RT)) |IT| Generator(IT) else Promise(RT);
        }

        fn handleWorkItems(
            self: *@This(),
            thread_start_params: ThreadStartParams,
            thread_end_params: ThreadEndParams,
        ) void {
            var error_encountered = false;
            if (comptime @hasDecl(ns, "onThreadStart")) {
                const result = @call(.auto, ns.onThreadStart, thread_start_params);
                if (comptime ThreadStartError != error{}) {
                    if (result) |_| {} else |err| {
                        self.init_result = err;
                        error_encountered = true;
                    }
                }
            }
            if (@atomicRmw(usize, &self.init_remaining, .Sub, 1, .monotonic) == 1) {
                self.init_futex.store(1, .release);
                std.Thread.Futex.wake(&self.init_futex, std.math.maxInt(u32));
                if (self.init_promise) |promise| promise.resolve(self.init_result);
            }
            if (!error_encountered) {
                while (true) {
                    if (self.queue.pull()) |item| {
                        invokeFunction(item);
                    } else switch (self.queue.stopped) {
                        false => self.queue.wait(),
                        true => break,
                    }
                }
                if (comptime @hasDecl(ns, "onThreadEnd")) {
                    _ = @call(.auto, ns.onThreadEnd, thread_end_params);
                }
            }
            if (@atomicRmw(usize, &self.thread_count, .Sub, 1, .acq_rel) == 1) {
                // perform actual deinit here if deinitAsync() was called
                if (self.deinit_promise) |promise| {
                    self.queue.allocator.free(self.threads);
                    self.queue.deinit();
                    self.status = .uninitialized;
                    promise.resolve({});
                }
            }
        }

        fn invokeFunction(item: WorkItem) void {
            const un = @typeInfo(WorkItem).Union;
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
    };
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    var queue: WorkQueue(test_ns) = .{};
    try queue.init(.{ .allocator = gpa.allocator(), .n_jobs = 1 });
    try queue.push(test_ns.hello, .{123}, null);
    try queue.push(test_ns.hello, .{456}, null);
    try queue.push(test_ns.world, .{}, null);
    std.time.sleep(1e+8);
    try expect(test_ns.total == 123 + 456);
    queue.deinit();
}

fn expectCT(comptime value: bool) !void {
    try expect(value);
}

fn isValidCallback(comptime FT: type, comptime AT: type, comptime RT: type) bool {
    switch (@typeInfo(FT)) {
        .Fn => |f| {
            if (f.params.len == 2 and f.return_type == RT) {
                if (f.params[0].type != null and f.params[1].type == AT) {
                    switch (@typeInfo(f.params[0].type.?)) {
                        .Pointer => |pt| if (pt.size == .One) {
                            return true;
                        },
                        else => {},
                    }
                }
            }
        },
        .Pointer => |pt| {
            if (@typeInfo(pt.child) == .Fn and isValidCallback(pt.child, AT, RT)) {
                return true;
            }
        },
        else => {},
    }
    return false;
}

test "isValidCallback" {
    try expect(isValidCallback(void, u32, void) == false);
    try expect(isValidCallback(*anyopaque, u32, void) == false);
    try expect(isValidCallback(*fn (*anyopaque, u32) void, u32, void) == true);
    try expect(isValidCallback(*fn (*anyopaque, u32) bool, u32, void) == false);
    try expect(isValidCallback(*fn (*usize, u32) void, u32, void) == true);
    try expect(isValidCallback(*fn (*usize, u32) i32, u32, void) == false);
    try expect(isValidCallback(*fn ([*]usize, u32) void, u32, void) == false);
    try expect(isValidCallback(**fn (*usize, u32) void, u32, void) == false);
}

fn getCallback(comptime FT: type, cb: anytype) *const FT {
    const CBT = @TypeOf(cb);
    const f = @typeInfo(FT).Fn;
    if (comptime !isValidCallback(CBT, f.params[1].type.?, f.return_type.?)) {
        @compileError("Expecting " ++ @typeName(FT) ++ ", received: " ++ @typeName(CBT));
    }
    const fn_ptr = switch (@typeInfo(CBT)) {
        .Pointer => cb,
        .Fn => &cb,
        else => unreachable,
    };
    return @ptrCast(fn_ptr);
}

test "getCallback" {
    const ns = struct {
        fn hello(_: *const u32, _: i32) void {}
    };
    const cb = getCallback(fn (?*anyopaque, i32) void, ns.hello);
    try expect(@intFromPtr(cb) == @intFromPtr(&ns.hello));
}

test {
    _ = Memory;
    _ = TypeData;
    _ = TypeDataCollector;
}

const runtime_safety = (builtin.mode == .ReleaseSafe or builtin.mode == .Debug);
