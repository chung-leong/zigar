const std = @import("std");
const builtin = @import("builtin");
const assert = std.debug.assert;

fn assertCT(comptime value: bool) void {
    assert(value);
}

const runtime_safety = (builtin.mode == .ReleaseSafe or builtin.mode == .Debug);

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
    @"enum",
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
    name: ?[]const u8 = null,
    structure_type: StructureType,
    length: ?usize,
    byte_size: ?usize,
    alignment: ?u16,
    is_const: bool = false,
    is_tuple: bool = false,
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
    iterator_of: ?Value,
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

fn ErrorIntType() type {
    return @Type(.{
        .Int = .{
            .signedness = .unsigned,
            .bits = @bitSizeOf(anyerror),
        },
    });
}

test "ErrorIntType" {
    assertCT(ErrorIntType() == u16);
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
    assertCT(list.entries[4] == 1004);
    inline for (0..17) |index| {
        list = list.concat(index + 2000);
    }
    assertCT(list.entries[0] == 1000);
    assertCT(list.entries[16] == 1016);
    assertCT(list.entries[17] == 2000);
    assertCT(list.entries[33] == 2016);
}

const TypeAttributes = packed struct {
    is_supported: bool = false,
    is_comptime_only: bool = false,
    is_arguments: bool = false,
    has_pointer: bool = false,
    has_associate: bool = false,
    known: bool = false,
};

const TypeData = struct {
    Type: type,
    slot: ?usize = null,
    name: ?[:0]const u8 = null,
    attrs: TypeAttributes = .{},

    fn getName(comptime self: @This()) [:0]const u8 {
        return self.name orelse @typeName(self.Type);
    }

    fn getSlot(comptime self: @This()) usize {
        return self.slot orelse @compileError("No assigned slot: " ++ @typeName(self.Type));
    }

    fn getAssociateSlot(comptime self: @This()) usize {
        if (!self.attrs.has_associate) {
            @compileError("Type does not have associate slot: " ++ @typeName(self.Type));
        }
        return self.getSlot() + 1;
    }

    fn getStructureType(comptime self: @This()) StructureType {
        return if (self.attrs.is_arguments) .arg_struct else switch (@typeInfo(self.Type)) {
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
            .Enum => |en| getMemberType(.{ .Type = en.tag_type }),
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
            .ErrorSet => @sizeOf(anyerror),
            else => return @sizeOf(self.Type),
        };
    }

    fn getBitSize(comptime self: @This()) ?usize {
        return switch (@typeInfo(self.Type)) {
            .Null, .Undefined => 0,
            .Fn, .Opaque => null,
            .ErrorSet => @bitSizeOf(anyerror),
            else => return @bitSizeOf(self.Type),
        };
    }

    fn getAlignment(comptime self: @This()) ?u16 {
        return switch (@typeInfo(self.Type)) {
            .Null, .Undefined => 0,
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
        if (comptime std.mem.indexOf(u8, name, needle)) |index| {
            return std.fmt.comptimePrint("{s}{s}{s}", .{
                name[0..index],
                replacement,
                name[index + needle.len .. name.len],
            });
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
            .Optional => |op| switch (@typeInfo(op.child)) {
                .Pointer, .ErrorSet => 0, // offset of the pointer/error itself
                else => @sizeOf(op.child) * 8,
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
            .Struct => |st| st.layout == .@"packed",
            .Union => |un| un.layout == .@"packed",
            else => false,
        };
    }

    fn isBitVector(comptime self: @This()) bool {
        return switch (@typeInfo(self.Type)) {
            .Vector => |ve| @sizeOf(ve.child) * ve.len > @sizeOf(self.Type),
            else => false,
        };
    }

    fn isSupported(comptime self: @This()) bool {
        return self.attrs.is_supported;
    }

    fn isComptimeOnly(comptime self: @This()) bool {
        return self.attrs.is_comptime_only;
    }

    fn hasPointer(comptime self: @This()) bool {
        return self.attrs.has_pointer;
    }
};

test "TypeData.getName" {
    assertCT(std.mem.eql(u8, TypeData.getName(.{ .Type = u32, .name = @typeName(u32) }), "u32"));
    assertCT(std.mem.eql(u8, TypeData.getName(.{ .Type = void, .name = "nothing" }), "nothing"));
}

test "TypeData.getStructureType" {
    const Enum = enum { apple, banana };
    const TaggedUnion = union(Enum) {
        apple: i32,
        banana: i32,
    };
    const BareUnion = union {};
    const ExternUnion = extern union {};
    assertCT(TypeData.getStructureType(.{ .Type = i32 }) == .primitive);
    assertCT(TypeData.getStructureType(.{ .Type = Enum }) == .@"enum");
    assertCT(TypeData.getStructureType(.{ .Type = BareUnion }) == .bare_union);
    assertCT(TypeData.getStructureType(.{ .Type = TaggedUnion }) == .tagged_union);
    assertCT(TypeData.getStructureType(.{ .Type = ExternUnion }) == .extern_union);
}

test "TypeData.getMemberType" {
    assertCT(TypeData.getMemberType(.{ .Type = i32 }) == .int);
    assertCT(TypeData.getMemberType(.{ .Type = u32 }) == .uint);
    assertCT(TypeData.getMemberType(.{ .Type = *u32 }) == .object);
    assertCT(TypeData.getMemberType(.{ .Type = type }) == .type);
}

test "TypeData.getByteSize" {
    assertCT(TypeData.getByteSize(.{ .Type = void }) == 0);
    assertCT(TypeData.getByteSize(.{ .Type = @TypeOf(null) }) == 0);
    assertCT(TypeData.getByteSize(.{ .Type = u8 }) == 1);
}

test "TypeData.getBitSize" {
    assertCT(TypeData.getBitSize(.{ .Type = void }) == 0);
    assertCT(TypeData.getBitSize(.{ .Type = @TypeOf(null) }) == 0);
    assertCT(TypeData.getBitSize(.{ .Type = u8 }) == 8);
}

test "TypeData.getAlignment" {
    assertCT(TypeData.getAlignment(.{ .Type = void }) == 1);
    assertCT(TypeData.getAlignment(.{ .Type = u8 }) == 1);
    assertCT(TypeData.getAlignment(.{ .Type = u32 }) == 4);
}

test "TypeData.getLength" {
    assertCT(TypeData.getLength(.{ .Type = [5]u8 }) == 5);
    assertCT(TypeData.getLength(.{ .Type = u8 }) == null);
    assertCT(TypeData.getLength(.{ .Type = @Vector(3, f32) }) == 3);
}

test "TypeData.isConst" {
    assertCT(TypeData.isConst(.{ .Type = i32 }) == false);
    assertCT(TypeData.isConst(.{ .Type = *i32 }) == false);
    assertCT(TypeData.isConst(.{ .Type = *const i32 }) == true);
}

test "TypeData.isSlice" {
    assertCT(TypeData.isSlice(.{ .Type = i32 }) == false);
    assertCT(TypeData.isSlice(.{ .Type = *i32 }) == false);
    assertCT(TypeData.isSlice(.{ .Type = []i32 }) == true);
    assertCT(TypeData.isSlice(.{ .Type = [*]i32 }) == true);
}

test "TypeData.isTuple" {
    assertCT(TypeData.isTuple(.{ .Type = @TypeOf(.{}) }) == true);
    assertCT(TypeData.isTuple(.{ .Type = struct {} }) == false);
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
    assertCT(TypeData.isPacked(.{ .Type = A }) == false);
    assertCT(TypeData.isPacked(.{ .Type = B }) == true);
}

test "TypeData.isBitVector" {
    const A = @Vector(8, bool);
    const B = @Vector(4, f32);
    assertCT(TypeData.isBitVector(.{ .Type = A }) == true);
    assertCT(TypeData.isBitVector(.{ .Type = B }) == false);
}

test "TypeData.getSliceLength" {
    assertCT(TypeData.getSliceLength(.{ .Type = []const u8 }) == null);
    assertCT(TypeData.getSliceLength(.{ .Type = [*:0]const u8 }) == null);
    assertCT(TypeData.getSliceLength(.{ .Type = [*]const u8 }).? == 0);
}

test "TypeData.getSliceName" {
    const name1 = comptime TypeData.getSliceName(.{ .Type = []const u8 });
    assertCT(std.mem.eql(u8, name1[0..3], "[_]"));
    const name2 = comptime TypeData.getSliceName(.{ .Type = [:0]const u8 });
    assertCT(std.mem.eql(u8, name2[0..5], "[_:0]"));
    const name3 = comptime TypeData.getSliceName(.{ .Type = [][4]u8 });
    assertCT(std.mem.eql(u8, name3[0..6], "[_][4]"));
    const name4 = comptime TypeData.getSliceName(.{ .Type = [*:0]const u8 });
    assertCT(std.mem.eql(u8, name4[0..5], "[_:0]"));
    const name5 = comptime TypeData.getSliceName(.{ .Type = [*]const u8 });
    assertCT(std.mem.eql(u8, name5[0..3], "[0]"));
    const name6 = comptime TypeData.getSliceName(.{ .Type = [*c]const u8 });
    assertCT(std.mem.eql(u8, name6[0..3], "[0]"));
}

test "TypeData.getSentinel" {
    assertCT(TypeData.getSentinel(.{ .Type = [*:0]const u8 }) == 0);
    assertCT(TypeData.getSentinel(.{ .Type = [*:7]const i32 }) == 7);
}

test "TypeData.getSelectorType" {
    const Tag = enum { cat, dog };
    const Union = union(Tag) {
        cat: u32,
        dog: u32,
    };
    assertCT(TypeData.getSelectorType(.{ .Type = Union }) == Tag);
    if (runtime_safety) {
        const BareUnion = union {
            cat: u32,
            dog: u32,
        };
        assertCT(TypeData.getSelectorType(.{ .Type = BareUnion }) == u8);
    }
}

test "TypeData.getSelectorBitOffset" {
    const Union = union(enum) {
        cat: i32,
        dog: i32,
    };
    assertCT(TypeData.getSelectorBitOffset(.{ .Type = Union }) == 32);
}

test "TypeData.getContentBitOffset" {
    const Union = union(enum) {
        cat: i32,
        dog: i32,
    };
    assertCT(TypeData.getContentBitOffset(.{ .Type = Union }) == 0);
}

const TypeDataCollector = struct {
    types: ComptimeList(TypeData),
    functions: ComptimeList(type),
    next_slot: usize = 0,

    fn init(comptime capacity: comptime_int) @This() {
        return .{
            .types = ComptimeList(TypeData).init(capacity),
            .functions = ComptimeList(type).init(capacity / 8),
        };
    }

    fn scan(comptime self: *@This(), comptime T: type) void {
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
            if (!f.is_generic and !f.is_var_args) {
                const index = self.append(ArgumentStruct(FT));
                const td = self.at(index);
                self.setAttributes(td);
                self.setSlot(td);
                td.attrs.is_arguments = true;
                td.name = std.fmt.comptimePrint("Arg{d:0>4}", .{td.getSlot()});
            }
        }
    }

    fn createDatabase(comptime self: *const @This()) TypeDatabase(self.types.len) {
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
                if (!f.is_generic and !f.is_var_args) {
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
            .Pointer => self.add(usize),
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
        if (td.attrs.has_associate) {
            // additional slot for type associate
            self.next_slot += 1;
        }
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
                td.attrs.has_associate = pt.size != .One; // associated slice class
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
                        if (!field_attrs.is_supported) {
                            td.attrs.is_supported = false;
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
                    if (!field_attrs.is_supported) {
                        td.attrs.is_supported = false;
                    }
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
    assertCT(tdc.find(Test.StructA) == true);
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
    assertCT(tdc.get(Test.StructA).isSupported() == true);
    assertCT(tdc.get(Test.StructB).isSupported() == false);
    assertCT(tdc.get(Thunk).isSupported() == false);
    assertCT(tdc.get(*Test.StructA).isSupported() == true);
    assertCT(tdc.get(*Test.StructB).isSupported() == false);
    assertCT(tdc.get(Test.StructC).isSupported() == true);
    assertCT(tdc.get(Test.StructD).isSupported() == false);
    assertCT(tdc.get(Test.UnionA).isSupported() == true);
    assertCT(tdc.get(@TypeOf(null)).isSupported() == true);
    assertCT(tdc.get(@TypeOf(undefined)).isSupported() == true);
    assertCT(tdc.get(noreturn).isSupported() == true);
    assertCT(tdc.get(u17).isSupported() == true);
    assertCT(tdc.get(i18).isSupported() == true);
    // pointer should include this
    assertCT(tdc.get(usize).isSupported() == true);

    // is_comptime_only
    assertCT(tdc.get(type).isComptimeOnly() == true);
    assertCT(tdc.get(*const type).isComptimeOnly() == true);
    assertCT(tdc.get(?type).isComptimeOnly() == true);
    // has_pointer
    assertCT(tdc.get(i32).hasPointer() == false);
    assertCT(tdc.get([*]i32).hasPointer() == true);
    assertCT(tdc.get([]const u8).hasPointer() == true);
    assertCT(tdc.get([5]*u8).hasPointer() == true);
    assertCT(tdc.get([][]u8).hasPointer() == true);
    assertCT(tdc.get(Test.A).hasPointer() == false);
    assertCT(tdc.get(Test.B).hasPointer() == false);
    assertCT(tdc.get(Test.C).hasPointer() == true);
    // pointers in union are inaccessible
    assertCT(tdc.get(Test.D).hasPointer() == false);
    // // comptime fields should be ignored
    assertCT(tdc.get(Test.E).hasPointer() == false);
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
    assertCT(std.mem.eql(u8, s_td.getName(), s_name));
    const e_td = tdc.get(Test.Error);
    const e_name = std.fmt.comptimePrint("ErrorSet{d:0>4}", .{e_td.slot.?});
    assertCT(std.mem.eql(u8, e_td.getName(), e_name));
}

fn TypeDatabase(comptime len: comptime_int) type {
    return struct {
        entries: [len]TypeData,

        fn get(comptime self: @This(), comptime T: type) TypeData {
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
    assertCT(tdb.get(Test.StructA).isSupported() == true);
    assertCT(tdb.get(Test.StructB).isSupported() == false);
    assertCT(tdb.get(Thunk).isSupported() == false);
    assertCT(tdb.get(*Test.StructA).isSupported() == true);
    assertCT(tdb.get(*const Test.StructA).isSupported() == true);
    assertCT(tdb.get(Test.StructC).isSupported() == true);
    assertCT(tdb.get(Test.StructD).isSupported() == false);
    assertCT(tdb.get(Test.UnionA).isSupported() == true);
}

// NOTE: error type has to be specified here since the function is called recursively
// and https://github.com/ziglang/zig/issues/2971 has not been fully resolved yet
fn getStructure(ctx: anytype, comptime T: type) Error!Value {
    const td = ctx.tdb.get(T);
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
    switch (comptime td.getStructureType()) {
        .primitive,
        .error_set,
        .@"enum",
        => try addPrimitiveMember(ctx, structure, td),
        .array => try addArrayMember(ctx, structure, td),
        .@"struct",
        .extern_struct,
        .packed_struct,
        .arg_struct,
        => try addStructMembers(ctx, structure, td),
        .extern_union,
        .bare_union,
        .tagged_union,
        => try addUnionMembers(ctx, structure, td),
        .error_union => try addErrorUnionMembers(ctx, structure, td),
        .optional => try addOptionalMembers(ctx, structure, td),
        .pointer => try addPointerMember(ctx, structure, td),
        .vector => try addVectorMember(ctx, structure, td),
        else => {},
    }
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
    const child_td = ctx.tdb.get(@typeInfo(td.Type).Array.child);
    try ctx.host.attachMember(structure, .{
        .member_type = child_td.getMemberType(),
        .bit_size = child_td.getBitSize(),
        .byte_size = child_td.getByteSize(),
        .structure = try getStructure(ctx, child_td.Type),
    }, false);
}

fn addVectorMember(ctx: anytype, structure: Value, comptime td: TypeData) !void {
    const child_td = ctx.tdb.get(@typeInfo(td.Type).Vector.child);
    const child_byte_size = if (td.isBitVector()) null else child_td.getByteSize();
    try ctx.host.attachMember(structure, .{
        .member_type = child_td.getMemberType(),
        .bit_size = child_td.getBitSize(),
        .byte_size = child_byte_size,
        .structure = try getStructure(ctx, child_td.Type),
    }, false);
}

fn addPointerMember(ctx: anytype, structure: Value, comptime td: TypeData) !void {
    const child_td = ctx.tdb.get(@typeInfo(td.Type).Pointer.child);
    const child_structure = try getStructure(ctx, child_td.Type);
    const target_structure = if (comptime !td.isSlice()) child_structure else define_slice: {
        const slice_def: Structure = .{
            .name = td.getSliceName(),
            .structure_type = .slice,
            .length = td.getSliceLength(),
            .byte_size = child_td.getByteSize(),
            .alignment = child_td.getAlignment(),
            .has_pointer = child_td.hasPointer(),
        };
        const slice_structure = try ctx.host.beginStructure(slice_def);
        const slice_slot = td.getAssociateSlot();
        try ctx.host.writeSlot(null, slice_slot, slice_structure);
        try ctx.host.attachMember(slice_structure, .{
            .member_type = child_td.getMemberType(),
            .bit_size = child_td.getBitSize(),
            .byte_size = child_td.getByteSize(),
            .structure = child_structure,
        }, false);
        if (comptime @typeInfo(child_td.Type) != .Opaque) {
            // need the check for opaque child, since we cannot define an optional opaque
            // which getSentinel() would return
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
        const field_td = ctx.tdb.get(field.type);
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
    if (st.backing_integer) |IT| {
        // add member for backing int
        const int_td = ctx.tdb.get(IT);
        try ctx.host.attachMember(structure, .{
            .member_type = int_td.getMemberType(),
            .bit_offset = 0,
            .bit_size = int_td.getBitSize(),
            .byte_size = int_td.getByteSize(),
            .structure = try getStructure(ctx, IT),
        }, false);
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
                const field_td = ctx.tdb.get(field.type);
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
        const field_td = ctx.tdb.get(field.type);
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
        const selector_td = ctx.tdb.get(TT);
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
    const child_td = ctx.tdb.get(@typeInfo(td.Type).Optional.child);
    try ctx.host.attachMember(structure, .{
        .name = "value",
        .member_type = child_td.getMemberType(),
        .bit_offset = 0,
        .bit_size = child_td.getBitSize(),
        .byte_size = child_td.getByteSize(),
        .slot = 0,
        .structure = try getStructure(ctx, child_td.Type),
    }, false);
    const ST = td.getSelectorType().?;
    const selector_td = ctx.tdb.get(ST);
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
    const payload_td = ctx.tdb.get(@typeInfo(td.Type).ErrorUnion.payload);
    try ctx.host.attachMember(structure, .{
        .name = "value",
        .member_type = payload_td.getMemberType(),
        .bit_offset = td.getContentBitOffset(),
        .bit_size = payload_td.getBitSize(),
        .byte_size = payload_td.getByteSize(),
        .slot = 0,
        .structure = try getStructure(ctx, payload_td.Type),
    }, false);
    const error_td = ctx.tdb.get(@typeInfo(td.Type).ErrorUnion.error_set);
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
                const decl_ptr_td = ctx.tdb.get(@TypeOf(decl_ptr));
                if (comptime decl_ptr_td.isSupported()) {
                    const decl_value = decl_ptr.*;
                    const DT = @TypeOf(decl_value);
                    const is_supported = comptime check: {
                        if (DT == type) {
                            // export type only if it's supported
                            // not sure why the following line is necessary
                            const tdb = ctx.tdb;
                            const target_td = tdb.get(decl_value);
                            if (!target_td.isSupported()) {
                                break :check false;
                            }
                        }
                        break :check true;
                    };
                    if (is_supported) {
                        // always export constants while variables can optionally be switch off
                        if (decl_ptr_td.isConst() or !ctx.host.options.omit_variables) {
                            const slot = index;
                            try ctx.host.attachMember(structure, .{
                                .name = decl.name,
                                .member_type = if (decl_ptr_td.isConst()) .@"comptime" else .static,
                                .slot = slot,
                                .structure = try getStructure(ctx, DT),
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
                const DT = @TypeOf(decl_value);
                switch (@typeInfo(DT)) {
                    .Fn => |f| {
                        const is_callable = check: {
                            if (f.is_generic or f.is_var_args) {
                                break :check false;
                            }
                            inline for (f.params) |param| {
                                if (param.type) |PT| {
                                    if (PT != std.mem.Allocator) {
                                        const param_td = ctx.tdb.get(PT);
                                        if (!param_td.isSupported() or param_td.isComptimeOnly()) {
                                            break :check false;
                                        }
                                    }
                                } else {
                                    // anytype is unsupported
                                    break :check false;
                                }
                            } else {
                                if (f.return_type) |RT| {
                                    const reval_td = ctx.tdb.get(RT);
                                    if (!reval_td.isSupported() or reval_td.isComptimeOnly()) {
                                        break :check false;
                                    }
                                } else {
                                    // comptime generated return value
                                    break :check false;
                                }
                                break :check true;
                            }
                        };
                        if (is_callable) {
                            const ArgT = ArgumentStruct(DT);
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
                                .name = @ptrCast(decl.name),
                                .thunk_id = @intFromPtr(createThunk(@TypeOf(ctx.host), decl_value, ArgT)),
                                .structure = arg_structure,
                                .iterator_of = try getIteratorStructure(ctx, DT),
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

fn getIteratorStructure(ctx: anytype, comptime FT: type) !?Value {
    const f = @typeInfo(FT).Fn;
    if (f.return_type) |RT| {
        switch (@typeInfo(RT)) {
            .Struct, .Union, .Opaque, .Enum => if (@hasDecl(RT, "next")) {
                const next = @field(RT, "next");
                if (NextMethodReturnType(@TypeOf(next), RT)) |PT| {
                    return getStructure(ctx, PT);
                }
            },
            else => {},
        }
    }
    return null;
}

fn NextMethodReturnType(comptime FT: type, comptime T: type) ?type {
    const f = @typeInfo(FT).Fn;
    if (f.return_type) |RT| {
        if (f.params.len == 1 and f.params[0].type == *T) {
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
    assert(T1 == i32);
    const T2 = NextMethodReturnType(@TypeOf(S.next2), S) orelse unreachable;
    assert(T2 == i32);
    const T3 = NextMethodReturnType(@TypeOf(S.next3), S);
    assert(T3 == null);
    const T4 = NextMethodReturnType(@TypeOf(S.next4), S);
    assert(T4 == null);
    const T5 = NextMethodReturnType(@TypeOf(S.next5), S);
    assert(T5 == null);
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
    assert(T1 == i32);
    const T2 = PayloadType(anyerror!?i32) orelse unreachable;
    assert(T2 == i32);
    const T3 = PayloadType(i32);
    assert(T3 == null);
}

fn ArgumentStruct(comptime T: type) type {
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
    var fields: [count]std.builtin.Type.StructField = undefined;
    var index = 0;
    for (f.params) |param| {
        if (param.type != std.mem.Allocator and param.type != null) {
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
    const RT = if (f.return_type) |RT| switch (RT) {
        noreturn => void,
        else => RT,
    } else void;
    fields[index] = .{
        .name = "retval",
        .type = RT,
        .is_comptime = false,
        .alignment = @alignOf(RT),
        .default_value = null,
    };
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
    assert(fieldsA.len == 3);
    assert(fieldsA[0].name[0] == '0');
    assert(fieldsA[1].name[0] == '1');
    assert(fieldsA[2].name[0] == 'r');
    const ArgB = ArgumentStruct(@TypeOf(Test.B));
    const fieldsB = std.meta.fields(ArgB);
    assert(fieldsB.len == 2);
    assert(fieldsB[0].name[0] == '0');
    assert(fieldsB[1].name[0] == 'r');
    const ArgC = ArgumentStruct(@TypeOf(Test.C));
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
            const retval = @call(modifier, function, args);
            if (comptime @TypeOf(retval) != noreturn) {
                arg_ptr.retval = retval;
            }
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
    const ArgA = ArgumentStruct(@TypeOf(Test.A));
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
    const td = ctx.tdb.get(@TypeOf(ptr.*));
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
        .ComptimeInt => exportPointerTarget(ctx, &@as(IntType(value), value), true),
        .ComptimeFloat => exportPointerTarget(ctx, &@as(f64, value), true),
        .EnumLiteral => exportPointerTarget(ctx, @tagName(value), true),
        .Type => getStructure(ctx, value),
        else => return exportPointerTarget(ctx, &value, true),
    };
}

fn attachComptimeValues(ctx: anytype, target: Value, comptime value: anytype) !void {
    const td = ctx.tdb.get(@TypeOf(value));
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
                const field_td = ctx.tdb.get(field.type);
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
                        const field_td = ctx.tdb.get(field.type);
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
                try ctx.host.writeSlot(target, 0, obj);
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
                    .alignment = if (st.layout != .@"packed") @alignOf(FT) else 0,
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
    @setEvalBranchQuota(200000);
    comptime var tdc = TypeDataCollector.init(256);
    comptime tdc.scan(T);
    const tdb = comptime tdc.createDatabase();
    const RootFactory = struct {
        fn exportStructure(ptr: *anyopaque, arg_ptr: *anyopaque) callconv(.C) ?Value {
            @setEvalBranchQuota(200000);
            const host = HostT.init(ptr, arg_ptr);
            defer host.release();
            const ctx = .{ .host = host, .tdb = tdb };
            if (getStructure(ctx, T)) |_| {
                return null;
            } else |err| {
                return createErrorMessage(host, err) catch null;
            }
            return null;
        }
    };
    return RootFactory.exportStructure;
}
