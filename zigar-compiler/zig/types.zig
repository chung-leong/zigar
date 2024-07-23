const std = @import("std");
const builtin = @import("builtin");
const expect = std.testing.expect;

pub const Error = error{
    unknown,
    unable_to_allocate_memory,
    unable_to_free_memory,
    unable_to_retrieve_memory_location,
    unable_to_create_data_view,
    unable_to_create_object,
    unable_to_obtain_slot,
    unable_to_retrieve_object,
    unable_to_insert_object,
    unable_to_start_structure_definition,
    unable_to_add_structure_member,
    unable_to_add_static_member,
    unable_to_add_method,
    unable_to_create_structure_template,
    unable_to_create_string,
    unable_to_add_structure_template,
    unable_to_define_structure,
    unable_to_write_to_console,
    too_many_arguments,
};

pub const HostOptions = struct {
    omit_methods: bool = false,
    omit_variables: bool = false,
};

pub const StructureType = enum(u32) {
    primitive = 0,
    array,
    @"struct",
    extern_struct,
    packed_struct,
    arg_struct,
    variadic_struct,
    extern_union,
    bare_union,
    tagged_union,
    error_union,
    error_set,
    @"enum",
    optional,
    single_pointer,
    slice_pointer,
    multi_pointer,
    c_pointer,
    slice,
    vector,
    @"opaque",
    function,
};

pub const MemberType = enum(u32) {
    void = 0,
    bool,
    int,
    uint,
    float,
    object,
    type,
    @"comptime",
    static,
    literal,
    null,
    undefined,
    unsupported,
};

pub const Value = *opaque {};
pub const Thunk = *const fn (ptr: ?*anyopaque, arg_ptr: *anyopaque) callconv(.C) ?Value;
pub const VariadicThunk = *const fn (ptr: ?*anyopaque, arg_ptr: *anyopaque, attr_ptr: *const anyopaque, arg_count: usize) ?Value;

pub const Structure = struct {
    name: ?[]const u8 = null,
    structure_type: StructureType,
    length: ?usize,
    byte_size: ?usize,
    alignment: ?u16,
    is_const: bool = false,
    is_tuple: bool = false,
    is_iterator: bool = false,
    has_pointer: bool,
};

pub const Member = struct {
    name: ?[]const u8 = null,
    member_type: MemberType,
    is_required: bool = false,
    bit_offset: ?usize = null,
    bit_size: ?usize = null,
    byte_size: ?usize = null,
    slot: ?usize = null,
    structure: ?Value,
};

pub const Method = struct {
    name: ?[]const u8 = null,
    thunk_id: usize,
    structure: Value,
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
        const len: usize = switch (pt.size) {
            .One => @sizeOf(pt.child),
            .Slice => @sizeOf(pt.child) * ptr.len,
            .Many, .C => get: {
                if (address != 0) {
                    if (pt.sentinel) |opaque_ptr| {
                        const sentinel_ptr: *const pt.child = @ptrCast(@alignCast(opaque_ptr));
                        var len: usize = 0;
                        while (ptr[len] != sentinel_ptr.*) {
                            len += 1;
                        }
                        break :get (len + 1) * @sizeOf(pt.child);
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
};

test "Memory.from" {
    var a: i32 = 1234;
    const memA = Memory.from(&a, false);
    const b: []const u8 = "Hello";
    const memB = Memory.from(b, false);
    const c: [*]const u8 = b.ptr;
    const memC = Memory.from(c, true);
    const d: [*c]const u8 = b.ptr;
    const memD = Memory.from(d, false);
    const e = &b;
    const memE = Memory.from(e, false);
    const f: [*:0]const u8 = "Hello";
    const memF = Memory.from(f, false);
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

test "Memory.to" {
    var array: [5]u8 = .{ 'H', 'e', 'l', 'l', 'o' };
    const memory: Memory = .{
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

pub fn ErrorIntType() type {
    return @Type(.{
        .Int = .{
            .signedness = .unsigned,
            .bits = @bitSizeOf(anyerror),
        },
    });
}

test "ErrorIntType" {
    try expectCT(ErrorIntType() == u16);
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
    has_pointer: bool = false,
    has_unsupported: bool = false,
    known: bool = false,
};

pub const TypeData = struct {
    Type: type,
    slot: ?usize = null,
    name: ?[:0]const u8 = null,
    attrs: TypeAttributes = .{},

    pub fn getName(comptime self: @This()) [:0]const u8 {
        return self.name orelse @typeName(self.Type);
    }

    pub fn getSlot(comptime self: @This()) usize {
        return self.slot orelse @compileError("No assigned slot: " ++ @typeName(self.Type));
    }

    pub fn getStructureType(comptime self: @This()) StructureType {
        return if (self.attrs.is_arguments)
            switch (self.attrs.is_variadic) {
                false => .arg_struct,
                true => .variadic_struct,
            }
        else if (self.attrs.is_slice)
            .slice
        else switch (@typeInfo(self.Type)) {
            .Bool,
            .Int,
            .ComptimeInt,
            .Float,
            .ComptimeFloat,
            .Null,
            .Undefined,
            .Void,
            .Type,
            .EnumLiteral,
            => .primitive,
            .Struct => |st| switch (st.layout) {
                .@"extern" => .extern_struct,
                .@"packed" => .packed_struct,
                else => .@"struct",
            },
            .Union => |un| switch (un.layout) {
                .@"extern" => .extern_union,
                else => if (un.tag_type) |_| .tagged_union else .bare_union,
            },
            .ErrorUnion => .error_union,
            .ErrorSet => .error_set,
            .Optional => .optional,
            .Enum => .@"enum",
            .Array => .array,
            .Pointer => |pt| switch (pt.size) {
                .One => .single_pointer,
                .Many => .multi_pointer,
                .Slice => .slice_pointer,
                .C => .c_pointer,
            },
            .Vector => .vector,
            .Opaque => .@"opaque",
            else => @compileError("Unsupported type: " ++ @typeName(self.Type)),
        };
    }

    pub fn getMemberType(comptime self: @This(), comptime is_comptime: bool) MemberType {
        return switch (self.isSupported()) {
            false => .unsupported,
            true => switch (is_comptime) {
                true => .@"comptime",
                false => switch (@typeInfo(self.Type)) {
                    .Bool => .bool,
                    .Int => |int| if (int.signedness == .signed) .int else .uint,
                    .Float => .float,
                    .Enum => |en| if (@typeInfo(en.tag_type).Int.signedness == .signed) .int else .uint,
                    .ErrorSet => .uint,
                    .Struct,
                    .Union,
                    .Array,
                    .ErrorUnion,
                    .Optional,
                    .Pointer,
                    .Vector,
                    => .object,
                    .Type => .type,
                    .EnumLiteral => .literal,
                    .ComptimeInt, .ComptimeFloat => .@"comptime",
                    .Void => .void,
                    .Null => .null,
                    else => .undefined,
                },
            },
        };
    }

    pub fn getElementType(comptime self: @This()) type {
        return if (self.attrs.is_slice)
            self.Type.ElementType
        else switch (@typeInfo(self.Type)) {
            inline .Array, .Vector => |ar| ar.child,
            else => @compileError("Not an array, vector, or slice"),
        };
    }

    pub fn getTargetType(comptime self: @This()) type {
        return switch (@typeInfo(self.Type)) {
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

    pub fn getByteSize(comptime self: @This()) ?usize {
        if (self.attrs.is_slice and self.Type.is_opaque) {
            // opaque types have unknown size
            return null;
        }
        return switch (@typeInfo(self.Type)) {
            .Null, .Undefined => 0,
            .Fn, .Opaque => null,
            .ErrorSet => @sizeOf(anyerror),
            else => return @sizeOf(self.Type),
        };
    }

    pub fn getBitSize(comptime self: @This()) ?usize {
        return switch (@typeInfo(self.Type)) {
            .Null, .Undefined => 0,
            .Fn, .Opaque => null,
            .ErrorSet => @bitSizeOf(anyerror),
            else => return @bitSizeOf(self.Type),
        };
    }

    pub fn getAlignment(comptime self: @This()) ?u16 {
        if (self.attrs.is_slice and self.Type.is_opaque) {
            // opaque types have unknown alignment
            return null;
        }
        return switch (@typeInfo(self.Type)) {
            .Null, .Undefined => 0,
            .Opaque => null,
            .ErrorSet => @alignOf(anyerror),
            else => return @alignOf(self.Type),
        };
    }

    pub fn getLength(comptime self: @This()) ?usize {
        return switch (@typeInfo(self.Type)) {
            .Array => |ar| ar.len,
            .Vector => |ve| ve.len,
            else => null,
        };
    }

    pub fn getSentinel(comptime self: @This()) ?Sentinel(self.getElementType()) {
        return switch (self.attrs.is_slice) {
            true => self.Type.sentinel,
            else => @compileError("Not a slice"),
        };
    }

    pub fn getSelectorType(comptime self: @This()) ?type {
        return switch (@typeInfo(self.Type)) {
            .Union => |un| un.tag_type orelse switch (runtime_safety and un.layout != .@"extern") {
                true => IntType(un.fields.len),
                false => null,
            },
            .Optional => |op| switch (@typeInfo(op.child)) {
                .Pointer => usize, // size of the pointer itself
                .ErrorSet => ErrorIntType(),
                else => u8,
            },
            else => @compileError("Not a union or optional"),
        };
    }

    pub fn getSelectorBitOffset(comptime self: @This()) comptime_int {
        return switch (@typeInfo(self.Type)) {
            .Union => get: {
                const TT = self.getSelectorType().?;
                const fields = @typeInfo(self.Type).Union.fields;
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

    pub fn getErrorBitOffset(comptime self: @This()) comptime_int {
        return switch (@typeInfo(self.Type)) {
            // value is placed after the error number if its alignment is smaller than that of anyerror
            .ErrorUnion => |eu| if (@alignOf(anyerror) > @alignOf(eu.payload)) 0 else @sizeOf(eu.payload) * 8,
            else => @compileError("Not an error union"),
        };
    }

    pub fn getContentBitOffset(comptime self: @This()) comptime_int {
        return switch (@typeInfo(self.Type)) {
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

    pub fn isConst(comptime self: @This()) bool {
        return switch (@typeInfo(self.Type)) {
            .Pointer => |pt| pt.is_const,
            else => false,
        };
    }

    pub fn isSingle(comptime self: @This()) bool {
        return switch (@typeInfo(self.Type)) {
            .Pointer => |pt| pt.size == .One,
            else => false,
        };
    }

    pub fn isTuple(comptime self: @This()) bool {
        return switch (@typeInfo(self.Type)) {
            .Struct => |st| st.is_tuple,
            else => false,
        };
    }

    pub fn isPacked(comptime self: @This()) bool {
        return switch (@typeInfo(self.Type)) {
            .Struct => |st| st.layout == .@"packed",
            .Union => |un| un.layout == .@"packed",
            else => false,
        };
    }

    pub fn isBitVector(comptime self: @This()) bool {
        return switch (@typeInfo(self.Type)) {
            .Vector => |ve| @sizeOf(ve.child) * ve.len > @sizeOf(self.Type),
            else => false,
        };
    }

    pub fn isIterator(comptime self: @This()) bool {
        switch (@typeInfo(self.Type)) {
            .Struct, .Union, .Opaque => if (@hasDecl(self.Type, "next")) {
                const next = @field(self.Type, "next");
                if (NextMethodReturnType(@TypeOf(next), self.Type)) |_| {
                    return true;
                }
            },
            else => {},
        }
        return false;
    }

    pub fn isPointer(comptime self: @This()) bool {
        return switch (@typeInfo(self.Type)) {
            .Pointer => true,
            else => false,
        };
    }

    pub fn isArguments(comptime self: @This()) bool {
        return self.attrs.is_arguments;
    }

    pub fn isSupported(comptime self: @This()) bool {
        return self.attrs.is_supported;
    }

    pub fn isComptimeOnly(comptime self: @This()) bool {
        return self.attrs.is_comptime_only;
    }

    pub fn hasPointer(comptime self: @This()) bool {
        return self.attrs.has_pointer;
    }

    pub fn hasUnsupported(comptime self: @This()) bool {
        return if (self.attrs.is_supported) self.attrs.has_unsupported else true;
    }
};

test "TypeData.getName" {
    try expectCT(std.mem.eql(u8, TypeData.getName(.{ .Type = u32, .name = @typeName(u32) }), "u32"));
    try expectCT(std.mem.eql(u8, TypeData.getName(.{ .Type = void, .name = "nothing" }), "nothing"));
}

test "TypeData.getStructureType" {
    const Enum = enum { apple, banana };
    const TaggedUnion = union(Enum) {
        apple: i32,
        banana: i32,
    };
    const BareUnion = union {};
    const ExternUnion = extern union {};
    try expectCT(TypeData.getStructureType(.{ .Type = i32 }) == .primitive);
    try expectCT(TypeData.getStructureType(.{ .Type = Enum }) == .@"enum");
    try expectCT(TypeData.getStructureType(.{ .Type = BareUnion }) == .bare_union);
    try expectCT(TypeData.getStructureType(.{ .Type = TaggedUnion }) == .tagged_union);
    try expectCT(TypeData.getStructureType(.{ .Type = ExternUnion }) == .extern_union);
}

test "TypeData.getElementType" {
    try expectCT(TypeData.getElementType(.{ .Type = Slice(u8, null), .attrs = .{ .is_slice = true } }) == u8);
}

test "TypeData.getTargetType" {
    try expectCT(TypeData.getTargetType(.{ .Type = []i32 }) == Slice(i32, null));
    try expectCT(TypeData.getTargetType(.{ .Type = *const anyopaque }) == Slice(anyopaque, null));
    try expectCT(TypeData.getTargetType(.{ .Type = *i32 }) == i32);
}

test "TypeData.getMemberType" {
    try expectCT(TypeData.getMemberType(.{ .Type = i32, .attrs = .{ .is_supported = true } }, false) == .int);
    try expectCT(TypeData.getMemberType(.{ .Type = u32, .attrs = .{ .is_supported = true } }, false) == .uint);
    try expectCT(TypeData.getMemberType(.{ .Type = *u32, .attrs = .{ .is_supported = true } }, false) == .object);
    try expectCT(TypeData.getMemberType(.{ .Type = type, .attrs = .{ .is_supported = true } }, false) == .type);
    try expectCT(TypeData.getMemberType(.{ .Type = type, .attrs = .{ .is_supported = true } }, true) == .@"comptime");
    try expectCT(TypeData.getMemberType(.{ .Type = type, .attrs = .{ .is_supported = false } }, true) == .unsupported);
}

test "TypeData.getByteSize" {
    try expectCT(TypeData.getByteSize(.{ .Type = void }) == 0);
    try expectCT(TypeData.getByteSize(.{ .Type = @TypeOf(null) }) == 0);
    try expectCT(TypeData.getByteSize(.{ .Type = u8 }) == 1);
}

test "TypeData.getBitSize" {
    try expectCT(TypeData.getBitSize(.{ .Type = void }) == 0);
    try expectCT(TypeData.getBitSize(.{ .Type = @TypeOf(null) }) == 0);
    try expectCT(TypeData.getBitSize(.{ .Type = u8 }) == 8);
}

test "TypeData.getAlignment" {
    try expectCT(TypeData.getAlignment(.{ .Type = void }) == 1);
    try expectCT(TypeData.getAlignment(.{ .Type = u8 }) == 1);
    try expectCT(TypeData.getAlignment(.{ .Type = u32 }) == 4);
}

test "TypeData.getLength" {
    try expectCT(TypeData.getLength(.{ .Type = [5]u8 }) == 5);
    try expectCT(TypeData.getLength(.{ .Type = u8 }) == null);
    try expectCT(TypeData.getLength(.{ .Type = @Vector(3, f32) }) == 3);
}

test "TypeData.isConst" {
    try expectCT(TypeData.isConst(.{ .Type = i32 }) == false);
    try expectCT(TypeData.isConst(.{ .Type = *i32 }) == false);
    try expectCT(TypeData.isConst(.{ .Type = *const i32 }) == true);
}

test "TypeData.isSingle" {
    try expectCT(TypeData.isSingle(.{ .Type = i32 }) == false);
    try expectCT(TypeData.isSingle(.{ .Type = *i32 }) == true);
    try expectCT(TypeData.isSingle(.{ .Type = []i32 }) == false);
    try expectCT(TypeData.isSingle(.{ .Type = [*]i32 }) == false);
}

test "TypeData.isTuple" {
    try expectCT(TypeData.isTuple(.{ .Type = @TypeOf(.{}) }) == true);
    try expectCT(TypeData.isTuple(.{ .Type = struct {} }) == false);
}

test "TypeData.isPacked" {
    const A = struct {
        number: u17,
        flag: bool,
    };
    const B = packed union {
        flag1: bool,
        flag2: bool,
    };
    try expectCT(TypeData.isPacked(.{ .Type = A }) == false);
    try expectCT(TypeData.isPacked(.{ .Type = B }) == true);
}

test "TypeData.isBitVector" {
    const A = @Vector(8, bool);
    const B = @Vector(4, f32);
    try expectCT(TypeData.isBitVector(.{ .Type = A }) == true);
    try expectCT(TypeData.isBitVector(.{ .Type = B }) == false);
}

test "TypeData.isIterator" {
    try expect(TypeData.isIterator(.{ .Type = std.mem.SplitIterator(u8, .sequence) }));
    try expect(TypeData.isIterator(.{ .Type = std.fs.path.ComponentIterator(.posix, u8) }));
    try expect(TypeData.isIterator(.{ .Type = std.fs.path }) == false);
}

test "TypeData.getSentinel" {
    try expectCT(TypeData.getSentinel(.{ .Type = Slice(u8, .{ .value = 0 }), .attrs = .{ .is_slice = true } }).?.value == 0);
    try expectCT(TypeData.getSentinel(.{ .Type = Slice(i32, .{ .value = 7 }), .attrs = .{ .is_slice = true } }).?.value == 7);
    try expectCT(TypeData.getSentinel(.{ .Type = Slice(i32, .{ .value = -2 }), .attrs = .{ .is_slice = true } }).?.value == -2);
    try expectCT(TypeData.getSentinel(.{ .Type = Slice(i32, null), .attrs = .{ .is_slice = true } }) == null);
}

test "TypeData.getSelectorType" {
    const Tag = enum { cat, dog };
    const Union = union(Tag) {
        cat: u32,
        dog: u32,
    };
    try expectCT(TypeData.getSelectorType(.{ .Type = Union }) == Tag);
    if (runtime_safety) {
        const BareUnion = union {
            cat: u32,
            dog: u32,
        };
        try expectCT(TypeData.getSelectorType(.{ .Type = BareUnion }) == u8);
    }
}

test "TypeData.getSelectorBitOffset" {
    const Union = union(enum) {
        cat: i32,
        dog: i32,
    };
    try expectCT(TypeData.getSelectorBitOffset(.{ .Type = Union }) == 32);
}

test "TypeData.getContentBitOffset" {
    const Union = union(enum) {
        cat: i32,
        dog: i32,
    };
    try expectCT(TypeData.getContentBitOffset(.{ .Type = Union }) == 0);
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
                // set alternate names of types now that we have the slot
                self.setName(td);
            }
        }
        // add arg structs once we can determine which functions are callable
        inline for (self.functions.slice()) |FT| {
            const f = @typeInfo(FT).Fn;
            if (!f.is_generic) {
                const index = self.append(ArgumentStruct(FT));
                const td = self.at(index);
                self.setAttributes(td);
                self.setSlot(td);
                td.attrs.is_arguments = true;
                td.attrs.is_variadic = f.is_var_args;
                td.name = std.fmt.comptimePrint("Arg{d:0>4}", .{td.getSlot()});
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

    fn append(comptime self: *@This(), comptime T: type) usize {
        if (self.indexOf(T)) |index| {
            return index;
        }
        const index = self.types.len;
        self.types = self.types.concat(.{ .Type = T });
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
            inline .Array, .Vector, .Optional, .Pointer => |ar| self.add(ar.child),
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
                    self.add(PT);
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
                const td = self.at(index);
                const TT = td.getTargetType();
                if (TT != pt.child) {
                    const slice_index = self.append(TT);
                    const slice_td = self.at(slice_index);
                    slice_td.attrs.is_slice = true;
                    slice_td.name = if (slice_td.getSentinel()) |s|
                        std.fmt.comptimePrint("[_:{d}]{s}", .{ s.value, @typeName(pt.child) })
                    else
                        std.fmt.comptimePrint("[_]{s}", .{@typeName(pt.child)});
                }
                self.add(usize);
            },
            .ErrorSet => self.add(ErrorIntType()),
            .Struct => |st| if (st.backing_integer) |IT| self.add(IT),
            inline .Union, .Optional => if (self.at(index).getSelectorType()) |ST| {
                self.add(ST);
            },
            else => {},
        }
        return index;
    }

    fn add(comptime self: *@This(), comptime T: type) void {
        _ = self.append(T);
    }

    fn addTypeOf(comptime self: *@This(), comptime value: anytype) void {
        const T = @TypeOf(value);
        switch (@typeInfo(T)) {
            .Type => self.add(value),
            .ComptimeFloat => self.add(*const f64),
            .ComptimeInt => self.add(*const IntType(value)),
            .EnumLiteral => self.add(@TypeOf(@tagName(value))),
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

    fn find(comptime self: *@This(), comptime T: type) bool {
        return self.indexOf(T) != null;
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
            if (td.Type == T) {
                break index;
            }
        } else null;
    }

    fn getSlot(comptime self: *@This(), comptime T: type) usize {
        const td = self.get(T);
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
        switch (@typeInfo(td.Type)) {
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
                    if (field_attrs.has_pointer and un.tag_type != null) {
                        // we can only handle pointers in tagged unions
                        td.attrs.has_pointer = true;
                    }
                }
            },
            else => {},
        }
    }

    fn getName(comptime self: *@This(), comptime T: type) [:0]const u8 {
        const td = self.get(T);
        self.setName(td);
        return td.name.?;
    }

    fn setName(comptime self: *@This(), comptime td: *TypeData) void {
        if (td.name != null) {
            return;
        }
        const name = @typeName(td.Type);
        td.name = if (isCryptic(name)) self.getGenericName(td.Type) else name;
    }

    fn getGenericName(comptime self: *@This(), comptime T: type) [:0]const u8 {
        return switch (@typeInfo(T)) {
            .ErrorUnion => |eu| std.fmt.comptimePrint("{s}!{s}", .{ self.getName(eu.error_set), self.getName(eu.payload) }),
            .Optional => |op| std.fmt.comptimePrint("?{s}", .{self.getName(op.child)}),
            .Array => |ar| std.fmt.comptimePrint("[{d}]{s}", .{ ar.len, self.getName(ar.child) }),
            .Pointer => |pt| format: {
                const name = @typeName(T);
                const size_end_index = find: {
                    comptime var index = 0;
                    comptime var in_brackets = false;
                    inline while (index < @min(25, name.len)) : (index += 1) {
                        switch (name[index]) {
                            '*' => if (!in_brackets) break :find index + 1,
                            '[' => in_brackets = true,
                            ']' => break :find index + 1,
                            else => {},
                        }
                    } else {
                        break :find 0;
                    }
                };
                const size = name[0..size_end_index];
                const modifier = if (pt.is_const) "const " else if (pt.is_volatile) "volatile " else "";
                break :format std.fmt.comptimePrint("{s}{s}{s}", .{ size, modifier, self.getName(pt.child) });
            },
            else => format: {
                const prefix = switch (@typeInfo(T)) {
                    .Struct => "Struct",
                    .ErrorSet => "ErrorSet",
                    else => "Type",
                };
                break :format std.fmt.comptimePrint("{s}{d:0>4}", .{ prefix, self.getSlot(T) });
            },
        };
    }

    fn isCryptic(comptime name: []const u8) bool {
        return if (name.len > 50)
            true
        else if (name[name.len - 1] == '}')
            true
        else
            false;
    }
};

test "TypeDataCollector.scan" {
    @setEvalBranchQuota(10000);
    const Test = struct {
        pub const StructA = struct {
            number: i32,
            string: []const u8,
        };
    };
    comptime var tdc = TypeDataCollector.init(0);
    comptime tdc.scan(Test);
    try expectCT(tdc.find(Test.StructA) == true);
}

test "TypeDataCollector.setAttributes" {
    @setEvalBranchQuota(10000);
    const Test = struct {
        pub const StructA = struct {
            number: i32,
            string: []const u8,
        };
        pub const StructB = struct {
            comptime Type: type = Thunk,
            thunk: Thunk,
        };
        pub const StructC = struct {
            number: i32 = 0,
            ptr: ?*@This(),
        };
        pub const StructD = struct {
            thunk: Thunk,
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
    };
    comptime var tdc = TypeDataCollector.init(0);
    comptime tdc.scan(Test);
    // is_supported
    try expectCT(tdc.get(Test.StructA).isSupported() == true);
    try expectCT(tdc.get(Test.StructB).isSupported() == true);
    try expectCT(tdc.get(Thunk).isSupported() == false);
    try expectCT(tdc.get(*Test.StructA).isSupported() == true);
    try expectCT(tdc.get(*Test.StructB).isSupported() == true);
    try expectCT(tdc.get(Test.StructC).isSupported() == true);
    try expectCT(tdc.get(Test.StructD).isSupported() == true);
    try expectCT(tdc.get(Test.UnionA).isSupported() == true);
    try expectCT(tdc.get(@TypeOf(null)).isSupported() == true);
    try expectCT(tdc.get(@TypeOf(undefined)).isSupported() == true);
    try expectCT(tdc.get(noreturn).isSupported() == true);
    try expectCT(tdc.get(u17).isSupported() == true);
    try expectCT(tdc.get(i18).isSupported() == true);
    // pointer should include this
    try expectCT(tdc.get(usize).isSupported() == true);

    // is_comptime_only
    try expectCT(tdc.get(type).isComptimeOnly() == true);
    try expectCT(tdc.get(*const type).isComptimeOnly() == true);
    try expectCT(tdc.get(?type).isComptimeOnly() == true);
    // has_pointer
    try expectCT(tdc.get(i32).hasPointer() == false);
    try expectCT(tdc.get([*]i32).hasPointer() == true);
    try expectCT(tdc.get([]const u8).hasPointer() == true);
    try expectCT(tdc.get([5]*u8).hasPointer() == true);
    try expectCT(tdc.get([][]u8).hasPointer() == true);
    try expectCT(tdc.get(Test.A).hasPointer() == false);
    try expectCT(tdc.get(Test.B).hasPointer() == false);
    try expectCT(tdc.get(Test.C).hasPointer() == true);
    // pointers in union are inaccessible
    try expectCT(tdc.get(Test.D).hasPointer() == false);
    // // comptime fields should be ignored
    try expectCT(tdc.get(Test.E).hasPointer() == false);
}

test "TypeDataCollector.setNames" {
    @setEvalBranchQuota(10000);
    const Test = struct {
        pub const tuple = .{.tuple};
        pub const Error = error{ a, b, c };
    };
    comptime var tdc = TypeDataCollector.init(0);
    comptime tdc.scan(Test);
    const s_td = tdc.get(@TypeOf(Test.tuple));
    const s_name = std.fmt.comptimePrint("Struct{d:0>4}", .{s_td.slot.?});
    try expectCT(std.mem.eql(u8, s_td.getName(), s_name));
    const e_td = tdc.get(Test.Error);
    const e_name = std.fmt.comptimePrint("ErrorSet{d:0>4}", .{e_td.slot.?});
    try expectCT(std.mem.eql(u8, e_td.getName(), e_name));
}

fn TypeDatabase(comptime len: comptime_int) type {
    return struct {
        entries: [len]TypeData,

        pub fn get(comptime self: @This(), comptime T: type) TypeData {
            for (self.entries) |entry| {
                if (entry.Type == T) {
                    return entry;
                }
            } else {
                @compileError("No type data for " ++ @typeName(T));
            }
        }
    };
}

test "TypeDatabase.get" {
    @setEvalBranchQuota(10000);
    const Test = struct {
        pub const StructA = struct {
            number: i32,
            string: []const u8,
        };
        pub const StructB = struct {
            thunk: Thunk,
        };
        pub const StructC = struct {
            number: i32 = 0,
            ptr: *@This(),
        };
        pub const StructD = struct {
            thunk: Thunk,
            ptr: *@This(),
        };
        pub const UnionA = union(enum) {
            cat: u32,
            dog: u32,
        };

        pub const a1: StructA = .{ .number = 123, .string = "Hello" };
        pub var a2: StructA = .{ .number = 123, .string = "Hello" };
    };
    comptime var tdc = TypeDataCollector.init(0);
    comptime tdc.scan(Test);
    const tdb = comptime tdc.createDatabase();
    try expectCT(tdb.get(Test.StructA).isSupported() == true);
    try expectCT(tdb.get(Test.StructB).isSupported() == true);
    try expectCT(tdb.get(Thunk).isSupported() == false);
    try expectCT(tdb.get(*Test.StructA).isSupported() == true);
    try expectCT(tdb.get(*const Test.StructA).isSupported() == true);
    try expectCT(tdb.get(Test.StructC).isSupported() == true);
    try expectCT(tdb.get(Test.StructD).isSupported() == true);
    try expectCT(tdb.get(Test.UnionA).isSupported() == true);
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
        const ElementType = ET;
        const sentinel = s;
        const is_opaque = ET != T;

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
            if (param.type != std.mem.Allocator and param.type != null) {
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
        if (param.type != std.mem.Allocator and param.type != null) {
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
    const ArgA = ArgumentStruct(@TypeOf(Test.A));
    const fieldsA = std.meta.fields(ArgA);
    try expect(fieldsA.len == 3);
    try expect(fieldsA[0].name[0] == 'r');
    try expect(fieldsA[1].name[0] == '0');
    try expect(fieldsA[2].name[0] == '1');
    const ArgB = ArgumentStruct(@TypeOf(Test.B));
    const fieldsB = std.meta.fields(ArgB);
    try expect(fieldsB.len == 2);
    try expect(fieldsB[0].name[0] == 'r');
    try expect(fieldsB[1].name[0] == '0');
    const ArgC = ArgumentStruct(@TypeOf(Test.C));
    const fieldsC = std.meta.fields(ArgC);
    try expect(fieldsC.len == 3);
}

pub fn ThunkType(comptime function: anytype) type {
    return switch (@typeInfo(@TypeOf(function)).Fn.is_var_args) {
        false => Thunk,
        true => VariadicThunk,
    };
}

fn expectCT(comptime value: bool) !void {
    try expect(value);
}

const runtime_safety = (builtin.mode == .ReleaseSafe or builtin.mode == .Debug);
