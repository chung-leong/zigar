const std = @import("std");
const builtin = @import("builtin");
const assert = std.debug.assert;

fn assertCT(comptime value: bool) void {
    assert(value);
}

const runtime_safety = (builtin.mode == .ReleaseSafe or builtin.mode == .Debug);

// support both 0.11 and 0.12
const enum_auto = if (@hasField(std.builtin.Type.ContainerLayout, "Auto")) .Auto else .auto;
const enum_packed = if (@hasField(std.builtin.Type.ContainerLayout, "Packed")) .Packed else .@"packed";
const enum_extern = if (@hasField(std.builtin.Type.ContainerLayout, "Extern")) .Extern else .@"extern";

// error type
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
    pointer_is_invalid,
};

fn getCString(comptime s: []const u8) [*:0]const u8 {
    return std.fmt.comptimePrint("{s}\x00", .{s});
}

// enums and external structs
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
    extern_union,
    bare_union,
    tagged_union,
    error_union,
    error_set,
    enumeration,
    optional,
    pointer,
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
};

pub const Value = *opaque {};
pub const Thunk = *const fn (ptr: *anyopaque, arg_ptr: *anyopaque) callconv(.C) ?Value;

pub const Structure = struct {
    name: ?[:0]const u8 = null,
    structure_type: StructureType,
    length: ?usize,
    byte_size: ?usize,
    alignment: ?u16,
    is_const: bool = false,
    is_tuple: bool = false,
    has_pointer: bool,
};

pub const Member = struct {
    name: ?[:0]const u8 = null,
    member_type: MemberType,
    is_required: bool = false,
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
        const len = switch (pt.size) {
            .One => @sizeOf(pt.child),
            .Slice => @sizeOf(pt.child) * ptr.len,
            .Many => if (pt.sentinel) |opaque_ptr| find: {
                const sentinel_ptr: *const pt.child = @ptrCast(@alignCast(opaque_ptr));
                var len: usize = 0;
                while (ptr[len] != sentinel_ptr.*) {
                    len += 1;
                }
                break :find (len + 1) * @sizeOf(pt.child);
            } else 0,
            .C => 0,
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
    assert(memA.len == 4);
    assert(memA.attributes.is_const == false);
    assert(memB.len == 5);
    assert(memB.attributes.is_const == true);
    assert(memC.len == 0);
    assert(memC.attributes.is_comptime == true);
    assert(memD.len == 0);
    assert(memD.attributes.is_const == true);
    assert(memE.len == @sizeOf(@TypeOf(b)));
    assert(memF.len == 6);
}

test "Memory.to" {
    var array: [5]u8 = .{ 'H', 'e', 'l', 'l', 'o' };
    const memory: Memory = .{
        .bytes = &array,
        .len = array.len,
    };
    const p1 = memory.to(*u8);
    assert(p1.* == 'H');
    assert(@typeInfo(@TypeOf(p1)).Pointer.size == .One);
    const p2 = memory.to([]u8);
    assert(p2[0] == 'H');
    assert(p2.len == 5);
    assert(@typeInfo(@TypeOf(p2)).Pointer.size == .Slice);
    const p3 = memory.to([*]u8);
    assert(p3[0] == 'H');
    assert(@typeInfo(@TypeOf(p3)).Pointer.size == .Many);
    const p4 = memory.to([*c]u8);
    assert(p4[0] == 'H');
    assert(@typeInfo(@TypeOf(p4)).Pointer.size == .C);
}

pub const Method = struct {
    name: ?[:0]const u8 = null,
    thunk_id: usize,
    structure: Value,
};

fn IntType(comptime n: comptime_int) type {
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
    assertCT(IntType(0) == u8);
    assertCT(IntType(0xFFFFFFFF) == u32);
    assertCT(IntType(-0xFFFFFFFF) == i64);
    assertCT(IntType(123) == u8);
    assertCT(IntType(-123) == i8);
}

fn ComptimeList(comptime T: type) type {
    return struct {
        pointers: []?*T,
        len: comptime_int,

        fn init(comptime capacity: comptime_int) @This() {
            comptime var pointers: [capacity]?*T = undefined;
            inline for (0..pointers.len) |index| {
                pointers[index] = null;
            }
            return .{
                .pointers = &pointers,
                .len = 0,
            };
        }

        fn expand(comptime self: @This()) @This() {
            const len = self.len + 1;
            if (len <= self.pointers.len) {
                // adjust len
                comptime var entry: T = undefined;
                self.pointers[self.len] = &entry;
                return .{ .pointers = self.pointers, .len = len };
            } else {
                // need new array
                comptime var capacity = 2;
                while (capacity < len) {
                    capacity *= 2;
                }
                comptime var pointers: [capacity]?*T = undefined;
                inline for (0..pointers.len) |index| {
                    pointers[index] = if (index < self.pointers.len) self.pointers[index] else null;
                }
                comptime var entry: T = undefined;
                pointers[self.len] = &entry;
                return .{ .pointers = &pointers, .len = len };
            }
        }

        fn get(comptime self: @This(), comptime index: comptime_int) *T {
            return self.pointers[index].?;
        }
    };
}

test "ComptimeList.expand" {
    const List = ComptimeList(comptime_int);
    comptime var list = List.init(0);
    inline for (0..17) |index| {
        list = list.expand();
        const ptr = list.get(index);
        ptr.* = index + 1000;
    }
    assertCT(list.get(4).* == 1004);
    inline for (0..17) |_| {
        list = list.expand();
    }
    assertCT(list.get(4).* == 1004);
    assertCT(list.get(16).* == 1016);
}

const TypeData = struct {
    Type: type,
    slot: ?usize = null,
    alternate_name: ?[:0]const u8 = null,
    alternate_structure_type: ?StructureType = null,
    is_supported: ?bool = null,
    is_comptime_only: ?bool = null,
    has_pointer: ?bool = null,

    fn init(comptime T: type) @This() {
        return .{ .Type = T };
    }

    fn getName(comptime self: @This()) [:0]const u8 {
        return self.alternate_name orelse @typeName(self.Type);
    }

    fn getSlot(comptime self: @This()) usize {
        return self.slot.?;
    }

    fn getStructureType(comptime self: @This()) StructureType {
        return self.alternate_structure_type orelse switch (@typeInfo(self.Type)) {
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
                enum_extern => .extern_struct,
                enum_packed => .packed_struct,
                else => .@"struct",
            },
            .Union => |un| switch (un.layout) {
                enum_extern => .extern_union,
                else => if (un.tag_type) |_| .tagged_union else .bare_union,
            },
            .ErrorUnion => .error_union,
            .ErrorSet => .error_set,
            .Optional => .optional,
            .Enum => .enumeration,
            .Array => .array,
            .Pointer => .pointer,
            .Vector => .vector,
            .Opaque => .@"opaque",
            else => @compileError("Unsupported type: " ++ @typeName(self.Type)),
        };
    }

    fn getMemberType(comptime self: @This()) MemberType {
        return switch (@typeInfo(self.Type)) {
            .Bool => .bool,
            .Int => |int| if (int.signedness == .signed) .int else .uint,
            .Float => .float,
            .Enum => |en| self.getMemberType(en.tag_type),
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
        };
    }

    fn getByteSize(comptime self: @This()) ?usize {
        return switch (@typeInfo(self.Type)) {
            .Null, .Undefined => 0,
            .Fn, .Opaque => null,
            else => return @sizeOf(self.Type),
        };
    }

    fn getBitSize(comptime self: @This()) ?usize {
        return switch (@typeInfo(self.Type)) {
            .Null, .Undefined => 0,
            .Fn, .Opaque => null,
            else => return @bitSizeOf(self.Type),
        };
    }

    pub fn getAlignment(comptime self: @This()) ?u16 {
        return switch (@typeInfo(self.Type)) {
            .Opaque => null,
            .ErrorSet => @alignOf(anyerror),
            else => return @alignOf(self.Type),
        };
    }

    fn getLength(comptime self: @This()) ?usize {
        return switch (@typeInfo(self.Type)) {
            .Array => |ar| ar.len,
            .Vector => |ve| ve.len,
            else => null,
        };
    }

    fn getSliceLength(comptime self: @This()) ?usize {
        const pt = @typeInfo(self.Type).Pointer;
        return if (pt.size == .Slice or pt.sentinel != null) null else 0;
    }

    fn getSliceName(comptime self: @This()) [:0]const u8 {
        const pt = @typeInfo(self.Type).Pointer;
        const name = @typeName(self.Type);
        const needle = switch (pt.size) {
            .Slice => "[",
            .C => "[*c",
            .Many => "[*",
            else => @compileError("Unexpected pointer type: " ++ name),
        };
        const replacement = if (pt.size == .Slice or pt.sentinel != null)
            "[_"
        else
            "[0";
        const new_len = name.len - needle.len + replacement.len;
        if (std.mem.indexOf(u8, name, needle)) |index| {
            comptime var array: [name.len + 2]u8 = undefined;
            @memcpy(array[0..index], name[0..index]);
            @memcpy(array[index .. index + replacement.len], replacement);
            @memcpy(array[index + replacement.len .. new_len], name[index + needle.len .. name.len]);
            array[new_len] = 0;
            return @ptrCast(&array);
        } else {
            @compileError("Unexpected pointer type: " ++ name);
        }
    }

    fn getSentinel(comptime self: @This()) ?@typeInfo(self.Type).Pointer.child {
        if (@typeInfo(self.Type).Pointer.sentinel) |ptr| {
            const sentinel_ptr: *const @typeInfo(self.Type).Pointer.child = @alignCast(@ptrCast(ptr));
            return sentinel_ptr.*;
        } else {
            return null;
        }
    }

    fn getSelectorType(comptime self: @This()) ?type {
        return switch (@typeInfo(self.Type)) {
            .Union => |un| un.tag_type orelse switch (runtime_safety and un.layout != enum_extern) {
                true => IntType(un.fields.len),
                false => null,
            },
            .Optional => |op| switch (@typeInfo(op.payload)) {
                .Pointer => usize, // the pointer itself
                else => u8,
            },
            else => @compileError("Not a union or optional"),
        };
    }

    fn getSelectorBitOffset(comptime self: @This()) comptime_int {
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
            .Optional => |op| switch (@typeInfo(op.payload)) {
                .Pointer => 0, // the pointer itself
                else => @sizeOf(self.Type),
            },
            else => @compileError("Not a union or optional"),
        };
    }

    fn getErrorBitOffset(comptime self: @This()) comptime_int {
        return switch (@typeInfo(self.Type)) {
            // value is placed after the error number if its alignment is smaller than that of anyerror
            .ErrorUnion => |eu| if (@alignOf(anyerror) > @alignOf(eu.payload)) 0 else @sizeOf(eu.payload) * 8,
            else => @compileError("Not an error union"),
        };
    }

    fn getContentBitOffset(comptime self: @This()) comptime_int {
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

    fn isConst(comptime self: @This()) bool {
        return switch (@typeInfo(self.Type)) {
            .Pointer => |pt| pt.is_const,
            else => false,
        };
    }

    fn isSlice(comptime self: @This()) bool {
        return switch (@typeInfo(self.Type)) {
            .Pointer => |pt| pt.size != .One,
            else => false,
        };
    }

    fn isTuple(comptime self: @This()) bool {
        return switch (@typeInfo(self.Type)) {
            .Struct => |st| st.is_tuple,
            else => false,
        };
    }

    fn isPacked(comptime self: @This()) bool {
        return switch (@typeInfo(self.Type)) {
            .Struct => |st| st.layout == enum_packed,
            .Union => |un| un.layout == enum_packed,
            else => false,
        };
    }

    fn isBitFields(comptime self: @This()) bool {
        return switch (@typeInfo(self.Type)) {
            .Vector => |ve| @sizeOf(ve.child) * ve.len > @sizeOf(self.Type),
            else => false,
        };
    }

    fn isSupported(comptime self: @This()) bool {
        return self.is_supported.?;
    }

    fn isComptimeOnly(comptime self: @This()) bool {
        return self.is_comptime_only.?;
    }

    fn hasPointer(comptime self: @This()) bool {
        return self.has_pointer.?;
    }
};

test "TypeData.getName" {
    assertCT(std.mem.eql(u8, TypeData.init(u32).getName(), "u32"));
    comptime var td = TypeData.init(void);
    td.alternate_name = "nothing";
    assertCT(std.mem.eql(u8, td.getName(), "nothing"));
}

test "TypeData.getStructureType" {
    const Enum = enum { apple, banana };
    const TaggedUnion = union(Enum) {
        apple: i32,
        banana: i32,
    };
    const BareUnion = union {};
    const ExternUnion = extern union {};
    assertCT(TypeData.init(i32).getStructureType() == .primitive);
    assertCT(TypeData.init(Enum).getStructureType() == .enumeration);
    assertCT(TypeData.init(BareUnion).getStructureType() == .bare_union);
    assertCT(TypeData.init(TaggedUnion).getStructureType() == .tagged_union);
    assertCT(TypeData.init(ExternUnion).getStructureType() == .extern_union);
}

test "TypeData.getMemberType" {
    assertCT(TypeData.init(i32).getMemberType() == .int);
    assertCT(TypeData.init(u32).getMemberType() == .uint);
    assertCT(TypeData.init(*u32).getMemberType() == .object);
    assertCT(TypeData.init(type).getMemberType() == .type);
}

test "TypeData.getByteSize" {
    assertCT(TypeData.init(void).getByteSize() == 0);
    assertCT(TypeData.init(@TypeOf(null)).getByteSize() == 0);
    assertCT(TypeData.init(u8).getByteSize() == 1);
}

test "TypeData.getBitSize" {
    assertCT(TypeData.init(void).getBitSize() == 0);
    assertCT(TypeData.init(@TypeOf(null)).getBitSize() == 0);
    assertCT(TypeData.init(u8).getBitSize() == 8);
}

test "TypeData.getAlignment" {
    assertCT(TypeData.init(void).getAlignment() == 1);
    assertCT(TypeData.init(u8).getAlignment() == 1);
    assertCT(TypeData.init(u32).getAlignment() == 4);
}

test "TypeData.getLength" {
    assertCT(TypeData.init([5]u8).getLength() == 5);
    assertCT(TypeData.init(u8).getLength() == null);
    assertCT(TypeData.init(@Vector(3, f32)).getLength() == 3);
}

test "TypeData.isConst" {
    assertCT(TypeData.init(i32).isConst() == false);
    assertCT(TypeData.init(*i32).isConst() == false);
    assertCT(TypeData.init(*const i32).isConst() == true);
}

test "TypeData.isSlice" {
    assertCT(TypeData.init(i32).isSlice() == false);
    assertCT(TypeData.init(*i32).isSlice() == false);
    assertCT(TypeData.init([]i32).isSlice() == true);
    assertCT(TypeData.init([*]i32).isSlice() == true);
}

test "TypeData.isTuple" {
    assertCT(TypeData.init(@TypeOf(.{})).isTuple() == true);
    assertCT(TypeData.init(struct {}).isTuple() == false);
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
    assertCT(TypeData.init(A).isPacked() == false);
    assertCT(TypeData.init(B).isPacked() == true);
}

test "TypeData.isBitFields" {
    const A = @Vector(8, bool);
    const B = @Vector(4, f32);
    assertCT(TypeData.init(A).isBitFields() == true);
    assertCT(TypeData.init(B).isBitFields() == false);
}

test "TypeData.getSliceLength" {
    assertCT(TypeData.init([]const u8).getSliceLength() == null);
    assertCT(TypeData.init([*:0]const u8).getSliceLength() == null);
    assertCT(TypeData.init([*]const u8).getSliceLength().? == 0);
}

test "TypeData.getSliceName" {
    const name1 = comptime TypeData.init([]const u8).getSliceName();
    assertCT(std.mem.eql(u8, name1[0..3], "[_]"));
    const name2 = comptime TypeData.init([:0]const u8).getSliceName();
    assertCT(std.mem.eql(u8, name2[0..5], "[_:0]"));
    const name3 = comptime TypeData.init([][4]u8).getSliceName();
    assertCT(std.mem.eql(u8, name3[0..6], "[_][4]"));
    const name4 = comptime TypeData.init([*:0]const u8).getSliceName();
    assertCT(std.mem.eql(u8, name4[0..5], "[_:0]"));
    const name5 = comptime TypeData.init([*]const u8).getSliceName();
    assertCT(std.mem.eql(u8, name5[0..3], "[0]"));
    const name6 = comptime TypeData.init([*c]const u8).getSliceName();
    assertCT(std.mem.eql(u8, name6[0..3], "[0]"));
}

test "TypeData.getSentinel" {
    assertCT(TypeData.init([*:0]const u8).getSentinel() == 0);
    assertCT(TypeData.init([*:7]const i32).getSentinel() == 7);
}

test "TypeData.getSelectorType" {
    const Tag = enum { cat, dog };
    const Union = union(Tag) {
        cat: u32,
        dog: u32,
    };
    assertCT(TypeData.init(Union).getSelectorType() == Tag);
    if (runtime_safety) {
        const BareUnion = union {
            cat: u32,
            dog: u32,
        };
        assertCT(TypeData.init(BareUnion).getSelectorType() == u8);
    }
}

test "TypeData.getSelectorBitOffset" {
    const Union = union(enum) {
        cat: i32,
        dog: i32,
    };
    assertCT(TypeData.init(Union).getSelectorBitOffset() == 32);
}

test "TypeData.getContentBitOffset" {
    const Union = union(enum) {
        cat: i32,
        dog: i32,
    };
    assertCT(TypeData.init(Union).getContentBitOffset() == 0);
}

const TypeDataCollector = struct {
    const List = ComptimeList(TypeData);

    types: List,
    next_slot: usize = 0,

    fn init(comptime capacity: comptime_int) @This() {
        return .{
            .types = List.init(capacity),
        };
    }

    fn scan(comptime self: *@This(), comptime T: type) void {
        _ = self.getTypeData(T);
    }

    fn createDatabase(comptime self: *const @This()) TypeDatabase(self.types.len) {
        comptime var db: TypeDatabase(self.types.len) = undefined;
        for (0..self.types.len) |index| {
            db.entries[index] = self.types.get(index).*;
        }
        return db;
    }

    fn getTypeData(comptime self: *@This(), comptime T: type) *TypeData {
        inline for (0..self.types.len) |index| {
            const td = self.types.get(index);
            if (comptime td.Type == T) {
                return td;
            }
        } else {
            const next_index = self.types.len;
            self.types = self.types.expand();
            const td = self.types.get(next_index);
            td.* = TypeData.init(T);
            if (self.isSupported(T)) {
                td.slot = self.next_slot;
                self.next_slot += 1;
                // replace long and cryptic names with generic one to save space
                if (isCryptic(td.getName())) {
                    td.alternate_name = self.getGenericName(T);
                }
                // determine these properties as well
                _ = self.hasPointer(T);
                _ = self.isComptimeOnly(T);

                // scan decls
                switch (@typeInfo(T)) {
                    inline .Struct, .Union, .Enum, .Opaque => |st| {
                        inline for (st.decls) |decl| {
                            const decl_ptr = &@field(T, decl.name);
                            if (comptime self.isSupported(@TypeOf(decl_ptr))) {
                                // add type only if it's supported
                                const decl_td = self.getTypeData(@TypeOf(decl_ptr.*));
                                if (comptime decl_td.Type == type and decl_td.isSupported()) {
                                    _ = self.getTypeData(decl_ptr.*);
                                }
                            }
                            // see if it's a callable function
                            switch (@typeInfo(@TypeOf(decl_ptr.*))) {
                                .Fn => {
                                    const function = decl_ptr.*;
                                    if (self.isCallable(function)) {
                                        // add argument struct
                                        const ArgT = ArgumentStruct(function);
                                        // use the name of the function as the type name
                                        const arg_td = self.getTypeData(ArgT);
                                        arg_td.alternate_name = decl.name;
                                        // set the structure type as well
                                        arg_td.alternate_structure_type = .arg_struct;
                                    }
                                },
                                else => {},
                            }
                        }
                    },
                    else => {},
                }
            }
            return td;
        }
    }

    fn isSupported(comptime self: *@This(), comptime T: type) bool {
        const td = self.getTypeData(T);
        if (td.is_supported == null) {
            td.is_supported = switch (@typeInfo(td.Type)) {
                .Type,
                .Bool,
                .Int,
                .ComptimeInt,
                .Float,
                .ComptimeFloat,
                .Void,
                .Null,
                .Undefined,
                .ErrorSet,
                .Enum,
                .Opaque,
                .Vector,
                .EnumLiteral,
                => true,
                .ErrorUnion => |eu| self.isSupported(eu.payload),
                inline .Array, .Optional, .Pointer => |ar| self.isSupported(ar.child),
                inline .Struct, .Union => |st| check: {
                    // set to true to prevent recursion
                    td.is_supported = true;
                    inline for (st.fields) |field| {
                        if (@hasField(@TypeOf(field), "is_comptime") and field.is_comptime) {
                            continue;
                        }
                        if (!self.isSupported(field.type)) {
                            break :check false;
                        }
                    } else {
                        break :check true;
                    }
                },
                else => false,
            };
        }
        return td.is_supported.?;
    }

    fn isComptimeOnly(comptime self: *@This(), comptime T: type) bool {
        const td = self.getTypeData(T);
        if (td.is_comptime_only == null) {
            td.is_comptime_only = switch (@typeInfo(td.Type)) {
                .ComptimeFloat,
                .ComptimeInt,
                .EnumLiteral,
                .Type,
                .Null,
                .Undefined,
                => true,
                .ErrorUnion => |eu| self.isComptimeOnly(eu.payload),
                inline .Array, .Optional, .Pointer => |ar| self.isComptimeOnly(ar.child),
                inline .Struct, .Union => |st| check: {
                    // set to false to prevent recursion
                    td.is_comptime_only = false;
                    inline for (st.fields) |field| {
                        if (@hasField(@TypeOf(field), "is_comptime") and field.is_comptime) {
                            continue;
                        }
                        // structs with comptime fields of comptime type can be created at runtime
                        if (self.isComptimeOnly(field.type)) {
                            break :check true;
                        }
                    } else {
                        break :check false;
                    }
                },
                else => false,
            };
        }
        return td.is_comptime_only.?;
    }

    fn hasPointer(comptime self: *@This(), comptime T: type) bool {
        const td = self.getTypeData(T);
        if (td.has_pointer == null) {
            td.has_pointer = switch (@typeInfo(td.Type)) {
                .Pointer => true,
                .ErrorUnion => |eu| self.hasPointer(eu.payload),
                inline .Array, .Optional => |ar| self.hasPointer(ar.child),
                inline .Struct, .Union => |st| check: {
                    // pointer in untagged union are not exportable
                    if (@hasField(@TypeOf(st), "tag_type") and st.tag_type == null) {
                        break :check false;
                    }
                    // set to false to prevent recursion
                    td.has_pointer = false;
                    inline for (st.fields) |field| {
                        if (@hasField(@TypeOf(field), "is_comptime") and field.is_comptime) {
                            continue;
                        }
                        if (self.hasPointer(field.type)) {
                            break :check true;
                        }
                    } else {
                        break :check false;
                    }
                },
                else => false,
            };
        }
        return td.has_pointer.?;
    }

    fn isCallable(comptime self: *@This(), comptime function: anytype) bool {
        const f = @typeInfo(@TypeOf(function)).Fn;
        if (f.is_generic or f.is_var_args) {
            return false;
        }
        inline for (f.params) |param| {
            if (param.type) |PT| {
                if (PT != std.mem.Allocator and !self.isSupported(PT)) {
                    return false;
                }
            } else {
                // anytype is unsupported
                break false;
            }
        }
        if (f.return_type) |RT| {
            if (!self.isSupported(RT)) {
                return false;
            }
        } else {
            // comptime generated return value
            return false;
        }
        return true;
    }

    fn getGenericName(comptime self: *@This(), comptime T: type) [:0]const u8 {
        return switch (@typeInfo(T)) {
            .ErrorUnion => |eu| std.fmt.comptimePrint("{s}!{s}", .{
                self.getGenericName(eu.error_set),
                self.getGenericName(eu.payload),
            }),
            .Optional => |op| std.fmt.comptimePrint("?{s}", .{
                self.getGenericName(op.child),
            }),
            .Array => |ar| std.fmt.comptimePrint("[{d}]{s}", .{
                ar.len,
                self.getGenericName(ar.child),
            }),
            .Pointer => |pt| format: {
                const name = @typeName(T);
                const size_end_index = find: {
                    comptime var index = 0;
                    inline while (index < 50) : (index += 1) {
                        switch (name[index]) {
                            ']', '*' => break :find index + 1,
                            else => {},
                        }
                    } else {
                        break :find 0;
                    }
                };
                const size = name[0..size_end_index];
                const modifier = if (pt.is_const) "const " else if (pt.is_volatile) "volatile " else "";
                break :format std.fmt.comptimePrint("{s}{s}{s}", .{
                    size,
                    modifier,
                    self.getGenericName(pt.child),
                });
            },
            else => format: {
                if (T == anyerror) {
                    break :format @typeName(T);
                }
                const prefix = switch (@typeInfo(T)) {
                    .Struct => "Struct",
                    .ErrorSet => "ErrorSet",
                    else => "Type",
                };
                const slot = self.getTypeData(T).getSlot();
                break :format std.fmt.comptimePrint("{s}{d:0>4}", .{ prefix, slot });
            },
        };
    }

    fn isCryptic(comptime name: []const u8) bool {
        if (comptime name.len > 100) {
            return true;
        }
        comptime var index = 0;
        return inline while (index < name.len) : (index += 1) {
            if (name[index] == '(') {
                // keep function call
                break false;
            } else if (name[index] == '{') {
                // anonymous struct or error set
                break true;
            }
        } else false;
    }
};

test "TypeDataCollector.isSupported" {
    comptime var tdc = TypeDataCollector.init(0);
    const StructA = struct {
        number: i32,
        string: []const u8,
    };
    const StructB = struct {
        thunk: Thunk,
    };
    const StructC = struct {
        number: i32 = 0,
        ptr: *@This(),
    };
    const StructD = struct {
        thunk: Thunk,
        ptr: *@This(),
    };
    const UnionA = union(enum) {
        cat: u32,
        dog: u32,
    };
    @setEvalBranchQuota(5000);
    assertCT(tdc.isSupported(StructA) == true);
    assertCT(tdc.isSupported(StructA) == true);
    assertCT(tdc.isSupported(StructB) == false);
    assertCT(tdc.isSupported(StructB) == false);
    assertCT(tdc.isSupported(Thunk) == false);
    assertCT(tdc.isSupported(*StructA) == true);
    assertCT(tdc.isSupported(*StructB) == false);
    assertCT(tdc.isSupported(StructC) == true);
    assertCT(tdc.isSupported(StructD) == false);
    assertCT(tdc.isSupported(UnionA) == true);
    assertCT(tdc.isSupported(@TypeOf(null)) == true);
    assertCT(tdc.isSupported(@TypeOf(undefined)) == true);
    assertCT(tdc.isSupported(noreturn) == false);
}

test "TypeDatabase.isComptimeOnly" {
    comptime var tdc = TypeDataCollector.init(0);
    assertCT(tdc.isComptimeOnly(type) == true);
    assertCT(tdc.isComptimeOnly(*type) == true);
    assertCT(tdc.isComptimeOnly(*?type) == true);
}

test "TypeDatabase.hasPointer" {
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
    // const D = union {
    //     a: A,
    //     c: C,
    // };
    const E = struct {
        number: i32,
        comptime pointer: ?*u32 = null,
    };
    @setEvalBranchQuota(5000);
    comptime var tdc = TypeDataCollector.init(0);
    assertCT(tdc.hasPointer(u8) == false);
    assertCT(tdc.hasPointer(*u8) == true);
    assertCT(tdc.hasPointer([]u8) == true);
    assertCT(tdc.hasPointer([5]*u8) == true);
    assertCT(tdc.hasPointer([][]u8) == true);
    assertCT(tdc.hasPointer(A) == false);
    assertCT(tdc.hasPointer(B) == false);
    assertCT(tdc.hasPointer(C) == true);
    // pointers in union are inaccessible
    // assertCT(tdc.hasPointer(D) == false);
    // comptime fields should be ignored
    assertCT(tdc.hasPointer(E) == false);
}

test "TypeDatabase.isCallable" {
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
    comptime var tdc = TypeDataCollector.init(0);
    assertCT(tdc.isCallable(Test.needFn) == false);
    assertCT(tdc.isCallable(Test.needOptionalFn) == false);
    assertCT(tdc.isCallable(Test.nothing) == true);
    assertCT(tdc.isCallable(Test.allocate) == true);
    assertCT(tdc.isCallable(std.debug.print) == false);
}

test "TypeDatabase.getGenericName" {
    comptime var tdc = TypeDataCollector.init(0);
    const s_name = comptime tdc.getGenericName(@TypeOf(.{.tuple}));
    assertCT(std.mem.eql(u8, s_name, "Struct0000"));
    const e_name = comptime tdc.getGenericName(error{ a, b, c });
    assertCT(std.mem.eql(u8, e_name, "ErrorSet0001"));
}

fn TypeDatabase(comptime len: comptime_int) type {
    return struct {
        entries: [len]TypeData,

        fn getTypeData(comptime self: @This(), comptime T: type) TypeData {
            for (self.entries) |entry| {
                if (entry.Type == T) {
                    return entry;
                }
            } else {
                @compileError("No type data for " ++ @typeName(T));
            }
        }

        fn isCallable(comptime self: @This(), comptime function: anytype) bool {
            const f = @typeInfo(@TypeOf(function)).Fn;
            if (f.is_generic or f.is_var_args) {
                return false;
            }
            inline for (f.params) |param| {
                if (param.type) |PT| {
                    if (PT != std.mem.Allocator and !self.getTypeData(PT).isSupported()) {
                        return false;
                    }
                } else {
                    // anytype is unsupported
                    break false;
                }
            }
            if (f.return_type) |RT| {
                if (!self.getTypeData(RT).isSupported()) {
                    return false;
                }
            } else {
                // comptime generated return value
                return false;
            }
            return true;
        }
    };
}

test "TypeDatabase.getTypeData" {
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
    @setEvalBranchQuota(5000);
    comptime var tdc = TypeDataCollector.init(0);
    comptime tdc.scan(Test);
    // std.debug.print("\nFound {d}:\n", .{tdc.types.len});
    // inline for (0..tdc.types.len) |index| {
    //     const td = tdc.types.get(index);
    //     std.debug.print("{any} {any}\n", .{ td.Type, td.is_supported });
    // }
    const tdb = comptime tdc.createDatabase();

    assertCT(tdb.getTypeData(Test.StructA).isSupported() == true);
    assertCT(tdb.getTypeData(Test.StructB).isSupported() == false);
    assertCT(tdb.getTypeData(Thunk).isSupported() == false);
    assertCT(tdb.getTypeData(*Test.StructA).isSupported() == true);
    assertCT(tdb.getTypeData(*const Test.StructA).isSupported() == true);
    assertCT(tdb.getTypeData(Test.StructC).isSupported() == true);
    assertCT(tdb.getTypeData(Test.StructD).isSupported() == false);
    assertCT(tdb.getTypeData(Test.UnionA).isSupported() == true);
}

// NOTE: error type has to be specified here since the function is called recursively
// and https://github.com/ziglang/zig/issues/2971 has not been fully resolved yet
fn getStructure(ctx: anytype, comptime T: type) Error!Value {
    const td = ctx.tdb.getTypeData(T);
    const slot = td.getSlot();
    return ctx.host.readSlot(null, slot) catch create: {
        const def: Structure = .{
            .name = td.getName(),
            .structure_type = td.getStructureType(),
            .length = td.getLength(),
            .byte_size = td.getByteSize(),
            .alignment = td.getAlignment(),
            .is_const = td.isConst(),
            .is_tuple = td.isTuple(),
            .has_pointer = td.hasPointer(),
        };
        // create the structure and place it in the slot immediately
        // so that recursive definition works correctly
        const structure = try ctx.host.beginStructure(def);
        try ctx.host.writeSlot(null, slot, structure);
        // define the shape of the structure
        try addMembers(ctx, structure, td);
        // finalize the shape so that static members can be instances of the structure
        try ctx.host.finalizeShape(structure);
        try addStaticMembers(ctx, structure, td);
        try addMethods(ctx, structure, td);
        try ctx.host.endStructure(structure);
        break :create structure;
    };
}

fn addMembers(ctx: anytype, structure: Value, comptime td: TypeData) !void {
    return switch (comptime td.getStructureType()) {
        .primitive,
        .error_set,
        .enumeration,
        => addPrimitiveMember(ctx, structure, td),
        .array => addArrayMember(ctx, structure, td),
        .@"struct",
        .extern_struct,
        .packed_struct,
        .arg_struct,
        => addStructMembers(ctx, structure, td),
        .extern_union,
        .bare_union,
        .tagged_union,
        => addUnionMembers(ctx, structure, td),
        .error_union => addErrorUnionMembers(ctx, structure, td),
        .optional => addOptionalMembers(ctx, structure, td),
        .pointer => addPointerMember(ctx, structure, td),
        .vector => addVectorMember(ctx, structure, td),
        else => void{},
    };
}

fn addPrimitiveMember(ctx: anytype, structure: Value, comptime td: TypeData) !void {
    const member_type = td.getMemberType();
    const slot: ?usize = switch (member_type) {
        .@"comptime", .literal, .type => 0,
        else => null,
    };
    try ctx.host.attachMember(structure, .{
        .member_type = member_type,
        .bit_size = td.getBitSize(),
        .bit_offset = 0,
        .byte_size = td.getByteSize(),
        .slot = slot,
        .structure = try getStructure(ctx, td.Type),
    }, false);
}

fn addArrayMember(ctx: anytype, structure: Value, comptime td: TypeData) !void {
    const child_td = ctx.tdb.getTypeData(@typeInfo(td.Type).Array.child);
    try ctx.host.attachMember(structure, .{
        .member_type = child_td.getMemberType(),
        .bit_size = child_td.getBitSize(),
        .byte_size = child_td.getByteSize(),
        .structure = try getStructure(ctx, child_td.Type),
    }, false);
}

fn addVectorMember(ctx: anytype, structure: Value, comptime td: TypeData) !void {
    const child_td = ctx.tdb.getTypeData(@typeInfo(td.Type).Vector.child);
    const child_byte_size = if (td.isBitfields()) null else child_td.getByteSize();
    try ctx.host.attachMember(structure, .{
        .member_type = child_td.getMemberType(),
        .bit_size = child_td.getBitSize(),
        .byte_size = child_byte_size,
        .structure = try getStructure(ctx, child_td.Type),
    }, false);
}

fn addPointerMember(ctx: anytype, structure: Value, comptime td: TypeData) !void {
    const child_td = ctx.tdb.getTypeData(@typeInfo(td.Type).Pointer.child);
    const child_structure = try getStructure(ctx, child_td.Type);
    const target_structure = if (!td.isSlice()) child_structure else define_slice: {
        const Slice = opaque {}; // dummy type
        const slice_td = ctx.tdb.getTypeData(Slice);
        const slice_def: Structure = .{
            .name = td.getSliceName(),
            .structure_type = .slice,
            .length = td.getSliceLength(),
            .byte_size = child_td.getByteSize(),
            .alignment = child_td.getAlignment(),
            .has_pointer = child_td.hasPointer(),
        };
        const slice_structure = try ctx.host.beginStructure(slice_def);
        try ctx.host.writeSlot(null, slice_td.getSlot(), slice_structure);
        try ctx.host.attachMember(slice_structure, .{
            .member_type = child_td.getMemberType(),
            .bit_size = child_td.getBitSize(),
            .byte_size = child_td.getByteSize(),
            .structure = child_structure,
        }, false);
        if (td.getSentinel()) |sentinel| {
            try ctx.host.attachMember(slice_structure, .{
                .name = "sentinel",
                .member_type = child_td.getMemberType(),
                .bit_offset = 0,
                .bit_size = child_td.getBitSize(),
                .byte_size = child_td.getByteSize(),
                .structure = child_structure,
            }, false);
            const memory = Memory.from(&sentinel, true);
            const dv = try ctx.host.captureView(memory);
            const template = try ctx.host.createTemplate(dv);
            try ctx.host.attachTemplate(slice_structure, template, false);
        }
        try ctx.host.finalizeShape(slice_structure);
        try ctx.host.endStructure(slice_structure);
        break :define_slice slice_structure;
    };
    try ctx.host.attachMember(structure, .{
        .member_type = td.getMemberType(),
        .bit_size = td.getBitSize(),
        .byte_size = td.getByteSize(),
        .slot = 0,
        .structure = target_structure,
    }, false);
}

fn addStructMembers(ctx: anytype, structure: Value, comptime td: TypeData) !void {
    const st = @typeInfo(td.Type).Struct;
    inline for (st.fields, 0..) |field, index| {
        const field_td = ctx.tdb.getTypeData(field.type);
        if (comptime field_td.isSupported()) {
            // comptime fields are not actually stored in the struct
            // fields of comptime types in comptime structs are handled in the same manner
            const is_actual = !field.is_comptime and !field_td.isComptimeOnly();
            try ctx.host.attachMember(structure, .{
                .name = field.name,
                .member_type = if (field.is_comptime) .@"comptime" else field_td.getMemberType(),
                .is_required = field.default_value == null,
                .bit_offset = if (is_actual) @bitOffsetOf(td.Type, field.name) else null,
                .bit_size = if (is_actual) field_td.getBitSize() else null,
                .byte_size = if (is_actual and !td.isPacked()) field_td.getByteSize() else null,
                .slot = index,
                .structure = try getStructure(ctx, field.type),
            }, false);
        }
    }
    if (td.getStructureType() != .arg_struct) {
        // add default values
        var template_maybe: ?Value = null;
        // strip out comptime content (e.g ?type -> ?void)
        const CFT = ComptimeFree(td.Type);
        if (@sizeOf(CFT) > 0) {
            var values: CFT = undefined;
            // obtain byte array containing data of default values
            // can't use std.mem.zeroInit() here, since it'd fail with unions
            const bytes: []u8 = std.mem.asBytes(&values);
            for (bytes) |*byte_ptr| {
                byte_ptr.* = 0;
            }
            inline for (st.fields) |field| {
                if (field.default_value) |opaque_ptr| {
                    const FT = @TypeOf(@field(values, field.name));
                    if (@sizeOf(FT) != 0) {
                        const default_value_ptr: *const field.type = @ptrCast(@alignCast(opaque_ptr));
                        if (FT == field.type) {
                            @field(values, field.name) = default_value_ptr.*;
                        } else {
                            // need cast here, as destination field is a different type with matching layout
                            // (e.g. ?type has just the present flag and so does a ?void)
                            const dest_ptr: *field.type = @ptrCast(&@field(values, field.name));
                            dest_ptr.* = default_value_ptr.*;
                        }
                    }
                }
            }
            const memory = Memory.from(&values, true);
            const dv = try ctx.host.captureView(memory);
            template_maybe = try ctx.host.createTemplate(dv);
        }
        inline for (st.fields, 0..) |field, index| {
            if (field.default_value) |opaque_ptr| {
                const field_td = ctx.tdb.getTypeData(field.type);
                const comptime_only = field.is_comptime or field_td.isComptimeOnly();
                if (comptime_only and comptime field_td.isSupported()) {
                    // comptime members aren't stored in the struct's memory
                    // they're separate objects in the slots of the struct template
                    const default_value_ptr: *const field.type = @ptrCast(@alignCast(opaque_ptr));
                    const value_obj = try exportPointerTarget(ctx, default_value_ptr, true);
                    template_maybe = template_maybe orelse try ctx.host.createTemplate(null);
                    try ctx.host.writeSlot(template_maybe.?, index, value_obj);
                }
            }
        }
        if (template_maybe) |template| {
            try ctx.host.attachTemplate(structure, template, false);
        }
    }
}

fn addUnionMembers(ctx: anytype, structure: Value, comptime td: TypeData) !void {
    const fields = @typeInfo(td.Type).Union.fields;
    inline for (fields, 0..) |field, index| {
        const field_td = ctx.tdb.getTypeData(field.type);
        try ctx.host.attachMember(structure, .{
            .name = field.name,
            .member_type = field_td.getMemberType(),
            .bit_offset = td.getContentBitOffset(),
            .bit_size = field_td.getBitSize(),
            .byte_size = field_td.getByteSize(),
            .slot = index,
            .structure = try getStructure(ctx, field_td.Type),
        }, false);
    }
    if (td.getSelectorType()) |TT| {
        const selector_td = ctx.tdb.getTypeData(TT);
        try ctx.host.attachMember(structure, .{
            .name = "selector",
            .member_type = selector_td.getMemberType(),
            .bit_offset = td.getSelectorBitOffset(),
            .bit_size = selector_td.getBitSize(),
            .byte_size = selector_td.getByteSize(),
            .structure = try getStructure(ctx, selector_td.Type),
        }, false);
    }
}

fn addOptionalMembers(ctx: anytype, structure: Value, comptime td: TypeData) !void {
    // value always comes first
    const child_td = ctx.tdb.getTypeData(@typeInfo(td.Type).Optional.child);
    try ctx.host.attachMember(structure, .{
        .name = "value",
        .member_type = child_td.getMemberType(),
        .bit_offset = 0,
        .bit_size = child_td.getBitSize(),
        .byte_size = child_td.getByteSize(),
        .slot = 0,
        .structure = try getStructure(ctx, child_td.Type),
    }, false);
    const ST = td.getSelectorType();
    const selector_td = ctx.tdb.getTypeData(ST);
    try ctx.host.attachMember(structure, .{
        .name = "present",
        .member_type = selector_td.getMemberType(),
        .bit_offset = td.getSelectorBitOffset(),
        .bit_size = selector_td.getBitSize(),
        .byte_size = selector_td.getByteSize(),
        .structure = try getStructure(ctx, selector_td.Type),
    }, false);
}

fn addErrorUnionMembers(ctx: anytype, structure: Value, comptime td: TypeData) !void {
    const payload_td = ctx.tdb.getTypeData(@typeInfo(td.Type).ErrorUnion.payload);
    try ctx.host.attachMember(structure, .{
        .name = "value",
        .member_type = payload_td.getMemberType(),
        .bit_offset = td.getContentBitOffset(),
        .bit_size = payload_td.getBitSize(),
        .byte_size = payload_td.getByteSize(),
        .slot = 0,
        .structure = try getStructure(ctx, payload_td.Type),
    }, false);
    const error_td = ctx.tdb.getTypeData(@typeInfo(td.Type).ErrorUnion.error_set);
    try ctx.host.attachMember(structure, .{
        .name = "error",
        .member_type = error_td.getMemberType(),
        .bit_offset = td.getErrorBitOffset(),
        .bit_size = error_td.getBitSize(),
        .byte_size = error_td.getByteSize(),
        .structure = try getStructure(ctx, error_td.Type),
    }, false);
}

fn addStaticMembers(ctx: anytype, structure: Value, comptime td: TypeData) !void {
    var template_maybe: ?Value = null;
    // add declared static members
    comptime var offset = 0;
    switch (@typeInfo(td.Type)) {
        inline .Struct, .Union, .Enum, .Opaque => |st| {
            inline for (st.decls, 0..) |decl, index| {
                const decl_ptr = &@field(td.Type, decl.name);
                const decl_ptr_td = ctx.tdb.getTypeData(@TypeOf(decl_ptr));
                if (comptime decl_ptr_td.isSupported()) {
                    // export type only if it's supported
                    const decl_td = ctx.tdb.getTypeData(@TypeOf(decl_ptr.*));
                    if (comptime decl_td.Type != type or decl_td.isSupported()) {
                        // always export constants while variables can optionally be switch off
                        if (decl_ptr_td.isConst() or !ctx.host.options.omit_variables) {
                            const slot = index;
                            try ctx.host.attachMember(structure, .{
                                .name = decl.name,
                                .member_type = if (decl_ptr_td.isConst()) .@"comptime" else .static,
                                .slot = slot,
                                .structure = try getStructure(ctx, decl_td.Type),
                            }, true);
                            const value_obj = try exportPointerTarget(ctx, decl_ptr, decl_ptr_td.isConst());
                            template_maybe = template_maybe orelse try ctx.host.createTemplate(null);
                            try ctx.host.writeSlot(template_maybe.?, slot, value_obj);
                        }
                    }
                }
                offset += 1;
            }
        },
        else => {},
    }
    // add implicit static members
    switch (@typeInfo(td.Type)) {
        .Enum => |en| {
            // add fields as static members
            inline for (en.fields, 0..) |field, index| {
                const value = @field(td.Type, field.name);
                const slot = offset + index;
                try ctx.host.attachMember(structure, .{
                    .name = field.name,
                    .member_type = .@"comptime",
                    .slot = slot,
                    .structure = structure,
                }, true);
                const value_obj = try exportPointerTarget(ctx, &value, true);
                template_maybe = template_maybe orelse try ctx.host.createTemplate(null);
                try ctx.host.writeSlot(template_maybe.?, slot, value_obj);
            }
            if (!en.is_exhaustive) {
                try ctx.host.attachMember(structure, .{
                    .member_type = .@"comptime",
                    .structure = structure,
                }, true);
            }
        },
        .ErrorSet => |es| if (es) |errors| {
            inline for (errors, 0..) |err_rec, index| {
                // get error from global set
                const err = @field(anyerror, err_rec.name);
                const slot = offset + index;
                try ctx.host.attachMember(structure, .{
                    .name = err_rec.name,
                    .member_type = .@"comptime",
                    .slot = slot,
                    .structure = structure,
                }, true);
                // can't use exportPointerTarget(), since each error in the set would be
                // considered a separate type--need special handling
                const value_obj = try exportError(ctx, err, structure);
                template_maybe = template_maybe orelse try ctx.host.createTemplate(null);
                try ctx.host.writeSlot(template_maybe.?, slot, value_obj);
            }
        },
        else => {},
    }
    if (template_maybe) |template| {
        try ctx.host.attachTemplate(structure, template, true);
    }
}

fn addMethods(ctx: anytype, structure: Value, comptime td: TypeData) !void {
    if (ctx.host.options.omit_methods) {
        return;
    }
    return switch (@typeInfo(td.Type)) {
        inline .Struct, .Union, .Enum, .Opaque => |st| {
            inline for (st.decls) |decl| {
                const decl_value = @field(td.Type, decl.name);
                switch (@typeInfo(@TypeOf(decl_value))) {
                    .Fn => |f| {
                        const function = decl_value;
                        if (ctx.tdb.isCallable(function)) {
                            const ArgT = ArgumentStruct(function);
                            const arg_structure = try getStructure(ctx, ArgT);
                            // see if the first param is an instance of the type in question or
                            // a pointer to one
                            const is_static_only = check: {
                                if (f.params.len > 0) {
                                    const ParamT = f.params[0].type.?;
                                    if (ParamT == td.Type or ParamT == *const td.Type or ParamT == *td.Type) {
                                        break :check false;
                                    }
                                }
                                break :check true;
                            };
                            try ctx.host.attachMethod(structure, .{
                                .name = decl.name,
                                .thunk_id = @intFromPtr(createThunk(@TypeOf(ctx.host), function, ArgT)),
                                .structure = arg_structure,
                            }, is_static_only);
                        }
                    },
                    else => {},
                }
            }
        },
        else => {},
    };
}

fn ArgumentStruct(comptime function: anytype) type {
    const f = @typeInfo(@TypeOf(function)).Fn;
    const count = get: {
        var count = 1;
        for (f.params) |param| {
            if (param.type != std.mem.Allocator) {
                count += 1;
            }
        }
        break :get count;
    };
    var fields: [count]std.builtin.Type.StructField = undefined;
    var index = 0;
    for (f.params) |param| {
        if (param.type != std.mem.Allocator) {
            const name = std.fmt.comptimePrint("{d}", .{index});
            fields[index] = .{
                .name = name,
                .type = param.type.?,
                .is_comptime = false,
                .alignment = @alignOf(param.type.?),
                .default_value = null,
            };
            index += 1;
        }
    }
    fields[index] = .{
        .name = "retval",
        .type = f.return_type.?,
        .is_comptime = false,
        .alignment = @alignOf(f.return_type.?),
        .default_value = null,
    };
    return @Type(.{
        .Struct = .{
            .layout = enum_auto,
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

fn createThunk(comptime HostT: type, comptime function: anytype, comptime ArgT: type) Thunk {
    const Args = std.meta.ArgsTuple(@TypeOf(function));
    const ns = struct {
        fn tryFunction(host: HostT, arg_ptr: *ArgT) !void {
            // extract arguments from argument struct
            var args: Args = undefined;
            const fields = @typeInfo(Args).Struct.fields;
            comptime var index = 0;
            inline for (fields, 0..) |field, i| {
                if (field.type == std.mem.Allocator) {
                    args[i] = createAllocator(&host);
                } else {
                    const name = std.fmt.comptimePrint("{d}", .{index});
                    // get the argument only if it isn't empty
                    if (comptime @sizeOf(@TypeOf(@field(arg_ptr.*, name))) > 0) {
                        args[i] = @field(arg_ptr.*, name);
                    }
                    index += 1;
                }
            }
            // never inline the function so its name would show up in the trace (unless it's marked inline)
            const modifier = switch (@typeInfo(@TypeOf(function)).Fn.calling_convention) {
                .Inline => .auto,
                else => .never_inline,
            };
            arg_ptr.*.retval = @call(modifier, function, args);
        }

        fn invokeFunction(ptr: *anyopaque, arg_ptr: *anyopaque) callconv(.C) ?Value {
            const host = HostT.init(ptr, arg_ptr);
            defer host.release();
            tryFunction(host, @ptrCast(@alignCast(arg_ptr))) catch |err| {
                return createErrorMessage(host, err) catch null;
            };
            return null;
        }
    };
    return ns.invokeFunction;
}

test "createThunk" {
    const Test = struct {
        fn A(a: i32, b: bool) bool {
            return if (a > 10 and b) true else false;
        }
    };
    const ArgA = ArgumentStruct(Test.A);
    const Host = struct {
        pub fn init(_: *anyopaque, _: ?*anyopaque) @This() {
            return .{};
        }

        pub fn release(_: @This()) void {}
    };
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

fn createAllocator(host_ptr: anytype) std.mem.Allocator {
    const HostPtrT = @TypeOf(host_ptr);
    const VTable = struct {
        fn alloc(p: *anyopaque, size: usize, ptr_align: u8, _: usize) ?[*]u8 {
            const h: HostPtrT = @alignCast(@ptrCast(p));
            const alignment = @as(u16, 1) << @as(u4, @truncate(ptr_align));
            return if (h.allocateMemory(size, alignment)) |m| m.bytes else |_| null;
        }

        fn resize(_: *anyopaque, _: []u8, _: u8, _: usize, _: usize) bool {
            return false;
        }

        fn free(p: *anyopaque, bytes: []u8, ptr_align: u8, _: usize) void {
            const h: HostPtrT = @alignCast(@ptrCast(p));
            h.freeMemory(.{
                .bytes = @ptrCast(bytes.ptr),
                .len = bytes.len,
                .attributes = .{
                    .alignment = @as(u16, 1) << @as(u4, @truncate(ptr_align)),
                },
            }) catch {};
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

fn createErrorMessage(host: anytype, err: anyerror) !Value {
    const err_name = @errorName(err);
    const memory = Memory.from(err_name, true);
    return host.captureString(memory);
}

fn exportPointerTarget(ctx: anytype, comptime ptr: anytype, comptime is_comptime: bool) !Value {
    const td = ctx.tdb.getTypeData(@TypeOf(ptr.*));
    const value_ptr = get: {
        // values that only exist at comptime need to have their comptime part replaced with void
        // (comptime keyword needed here since expression evaluates to different pointer types)
        if (comptime td.isComptimeOnly()) {
            var runtime_value: ComptimeFree(td.Type) = removeComptimeValues(ptr.*);
            break :get &runtime_value;
        } else {
            break :get ptr;
        }
    };
    const memory = Memory.from(value_ptr, is_comptime);
    const structure = try getStructure(ctx, td.Type);
    const obj = try ctx.host.castView(memory, structure);
    if (comptime td.isComptimeOnly()) {
        try attachComptimeValues(ctx, obj, ptr.*);
    }
    return obj;
}

fn exportError(ctx: anytype, err: anyerror, structure: Value) !Value {
    const memory = Memory.from(&err, true);
    const obj = try ctx.host.castView(memory, structure);
    return obj;
}

fn exportComptimeValue(ctx: anytype, comptime value: anytype) !Value {
    return switch (@typeInfo(@TypeOf(value))) {
        .ComptimeInt => exportPointerTarget(ctx, &@as(IntType(i8, value), value), true),
        .ComptimeFloat => exportPointerTarget(ctx, &@as(f64, value), true),
        .EnumLiteral => exportPointerTarget(ctx, @tagName(value), true),
        .Type => getStructure(ctx, value),
        else => return exportPointerTarget(ctx, &value, true),
    };
}

fn attachComptimeValues(ctx: anytype, target: Value, comptime value: anytype) !void {
    const td = ctx.tdb.getTypeData(@TypeOf(value));
    switch (@typeInfo(td.Type)) {
        .Type => {
            const obj = try getStructure(ctx, value);
            try ctx.host.writeSlot(target, 0, obj);
        },
        .ComptimeInt, .ComptimeFloat, .EnumLiteral => {
            const obj = try exportComptimeValue(ctx, value);
            try ctx.host.writeSlot(target, 0, obj);
        },
        .Array => {
            inline for (value, 0..) |element, index| {
                const obj = try exportComptimeValue(ctx, element);
                try ctx.host.writeSlot(target, index, obj);
            }
        },
        .Struct => |st| {
            inline for (st.fields, 0..) |field, index| {
                const field_td = ctx.tdb.getTypeData(field.type);
                if (field_td.isComptimeOnly()) {
                    const field_value = @field(value, field.name);
                    const obj = try exportComptimeValue(ctx, field_value);
                    try ctx.host.writeSlot(target, index, obj);
                }
            }
        },
        .Union => |un| {
            if (un.tag_type) |Tag| {
                const tag: Tag = value;
                inline for (un.fields, 0..) |field, index| {
                    if (@field(Tag, field.name) == tag) {
                        const field_td = ctx.tdb.getTypeData(field.type);
                        if (field_td.isComptimeOnly()) {
                            const field_value = @field(value, field.name);
                            const obj = try exportComptimeValue(ctx, field_value);
                            try ctx.host.writeSlot(target, index, obj);
                        }
                    }
                }
            } else {
                @compileError("Unable to handle comptime value in bare union");
            }
        },
        .Optional => {
            if (value) |v| {
                const obj = try exportComptimeValue(ctx, v);
                try ctx.host.writeSlot(target, 0, obj);
            }
        },
        .ErrorUnion => {
            if (value) |v| {
                const obj = try exportComptimeValue(ctx, v);
                try ctx.writeSlot(target, 0, obj);
            } else |_| {}
        },
        else => {},
    }
}

fn ComptimeFree(comptime T: type) type {
    return switch (@typeInfo(T)) {
        .ComptimeFloat,
        .ComptimeInt,
        .EnumLiteral,
        .Type,
        .Null,
        .Undefined,
        => void,
        .Array => |ar| [ar.len]ComptimeFree(ar.child),
        .Struct => |st| derive: {
            var new_fields: [st.fields.len]std.builtin.Type.StructField = undefined;
            inline for (st.fields, 0..) |field, index| {
                const FT = if (field.is_comptime) void else ComptimeFree(field.type);
                new_fields[index] = .{
                    .name = field.name,
                    .type = FT,
                    .default_value = null,
                    .is_comptime = false,
                    .alignment = if (st.layout != enum_packed) @alignOf(FT) else 0,
                };
            }
            break :derive @Type(.{
                .Struct = .{
                    .layout = st.layout,
                    .fields = &new_fields,
                    .decls = &.{},
                    .is_tuple = st.is_tuple,
                },
            });
        },
        .Union => |un| derive: {
            var new_fields: [un.fields.len]std.builtin.Type.UnionField = undefined;
            inline for (un.fields, 0..) |field, index| {
                const FT = ComptimeFree(field.type);
                new_fields[index] = .{
                    .name = field.name,
                    .type = FT,
                    .alignment = @alignOf(FT),
                };
            }
            break :derive @Type(.{
                .Union = .{
                    .layout = un.layout,
                    .tag_type = un.tag_type,
                    .fields = &new_fields,
                    .decls = &.{},
                },
            });
        },
        .Optional => |op| ?ComptimeFree(op.child),
        .ErrorUnion => |eu| eu.error_set!ComptimeFree(eu.payload),
        else => T,
    };
}

fn removeComptimeValues(comptime value: anytype) ComptimeFree(@TypeOf(value)) {
    const T = @TypeOf(value);
    const RT = ComptimeFree(T);
    if (comptime T == RT) {
        return value;
    }
    var result: RT = undefined;
    switch (@typeInfo(T)) {
        .ComptimeFloat,
        .ComptimeInt,
        .EnumLiteral,
        .Type,
        .Null,
        .Undefined,
        => result = {},
        .Array => {
            inline for (value, 0..) |element, index| {
                result[index] = removeComptimeValues(element);
            }
        },
        .Struct => |st| {
            inline for (st.fields) |field| {
                @field(result, field.name) = removeComptimeValues(@field(value, field.name));
            }
        },
        .Union => |un| {
            if (un.tag_type) |Tag| {
                const tag: Tag = value;
                const field_name = @tagName(tag);
                const field_value = @field(value, field_name);
                result = @unionInit(RT, field_name, removeComptimeValues(field_value));
            } else {
                @compileError("Unable to handle comptime value in bare union");
            }
        },
        .Optional => result = if (value) |v| removeComptimeValues(v) else null,
        .ErrorUnion => result = if (value) |v| removeComptimeValues(v) else |e| e,
        else => result = value,
    }
    return result;
}

pub fn createRootFactory(comptime HostT: type, comptime T: type) Thunk {
    @setEvalBranchQuota(10000);
    comptime var tdc = TypeDataCollector.init(256);
    comptime tdc.scan(T);
    const tdb = comptime tdc.createDatabase();
    const RootFactory = struct {
        fn exportStructure(ptr: *anyopaque, arg_ptr: *anyopaque) callconv(.C) ?Value {
            const host = HostT.init(ptr, arg_ptr);
            defer host.release();
            const ctx = .{ .host = host, .tdb = tdb };
            if (getStructure(ctx, T)) |_| {
                return null;
            } else |err| {
                return createErrorMessage(host, err) catch null;
            }
        }
    };
    return RootFactory.exportStructure;
}
