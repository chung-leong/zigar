const std = @import("std");
const builtin = @import("builtin");
const assert = std.debug.assert;

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

pub const Structure = extern struct {
    name: ?[*:0]const u8 = null,
    structure_type: StructureType,
    length: usize,
    byte_size: usize,
    alignment: u16,
    is_const: bool = false,
    is_tuple: bool = false,
    has_pointer: bool,
};

pub fn missing(comptime T: type) comptime_int {
    return std.math.maxInt(T);
}

pub const Member = extern struct {
    name: ?[*:0]const u8 = null,
    member_type: MemberType,
    is_required: bool = false,
    bit_offset: usize = missing(usize),
    bit_size: usize = missing(usize),
    byte_size: usize = missing(usize),
    slot: usize = missing(usize),
    structure: ?Value,
};

pub const MemoryAttributes = packed struct {
    alignment: u16 = 0,
    is_const: bool = false,
    is_comptime: bool = false,
    _: u14 = 0,
};

pub const Memory = extern struct {
    bytes: ?[*]u8 = null,
    len: usize = 0,
    attributes: MemoryAttributes = .{},
};

pub const Method = extern struct {
    name: ?[*:0]const u8 = null,
    thunk_id: usize,
    structure: Value,
};

fn ComptimeList(comptime T: type) type {
    return struct {
        entries: []T,
        len: comptime_int,

        pub fn init(comptime capacity: comptime_int) @This() {
            comptime var entries: [capacity]T = undefined;
            return .{
                .entries = &entries,
                .len = 0,
            };
        }

        pub fn expand(comptime self: @This()) @This() {
            const len = self.len + 1;
            if (len <= self.entries.len) {
                // adjust len
                return .{ .entries = self.entries, .len = len };
            } else {
                // need new array
                comptime var capacity = 2;
                while (capacity < len) {
                    capacity *= 2;
                }
                comptime var entries: [capacity]T = undefined;
                comptime var index = 0;
                @setEvalBranchQuota(self.len);
                inline while (index < self.len) : (index += 1) {
                    entries[index] = self.entries[index];
                }
                return .{ .entries = &entries, .len = len };
            }
        }

        pub fn get(comptime self: *@This(), comptime index: comptime_int) *T {
            return &self.entries[index];
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
    assert(list.get(4).* == 1004);
    inline for (0..17) |_| {
        list = list.expand();
    }
    assert(list.get(4).* == 1004);
    assert(list.get(16).* == 1016);
}

const FieldData = struct {
    index: usize,
    slot: usize,

    pub fn init(comptime index: usize, comptime slot: usize) @This() {
        return .{
            .index = index,
            .slot = slot,
        };
    }
};

const TypeData = struct {
    const List = ComptimeList(FieldData);

    Type: type,
    name: []const u8,
    type: StructureType,
    byte_size: ?usize,
    bit_size: ?usize,
    alignment: ?u16,
    length: ?usize,
    slot: usize,
    fields: List,
    is_supported: ?bool = null,

    pub fn init(comptime T: type, comptime slot: usize) @This() {
        return .{
            .Type = T,
            .name = @typeName(T),
            .type = getStructureType(T),
            .byte_size = getByteSize(T),
            .bit_size = getBitSize(T),
            .alignment = getAlignment(T),
            .length = getLength(T),
            .slot = slot,
            .fields = List.init(0),
        };
    }

    pub fn getField(comptime self: *@This(), comptime field_index: usize) *FieldData {
        @setEvalBranchQuota(self.fields.len);
        comptime var index = 0;
        inline while (index < self.fields.len) : (index += 1) {
            const ptr = &self.fields.entries[index];
            if (ptr.index == field_index) {
                return ptr;
            }
        }
        const slot = self.fields.len;
        self.fields = self.fields.expand();
        const ptr = self.fields.get(slot);
        ptr.* = FieldData.init(field_index, slot);
        return ptr;
    }

    fn getStructureType(comptime T: type) StructureType {
        return switch (@typeInfo(T)) {
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
            else => .@"opaque",
        };
    }

    fn getByteSize(comptime T: type) ?usize {
        return switch (@typeInfo(T)) {
            .Null, .Undefined => 0,
            .Fn, .Opaque => null,
            else => return @sizeOf(T),
        };
    }

    fn getBitSize(comptime T: type) ?usize {
        return switch (@typeInfo(T)) {
            .Null, .Undefined => 0,
            .Fn, .Opaque => null,
            else => return @bitSizeOf(T),
        };
    }

    fn getAlignment(comptime T: type) ?u16 {
        return switch (@typeInfo(T)) {
            .Opaque => null,
            .ErrorSet => @alignOf(anyerror),
            else => return @alignOf(T),
        };
    }

    fn getLength(comptime T: type) ?usize {
        return switch (@typeInfo(T)) {
            .Array => |ar| ar.len,
            .Vector => |ve| ve.len,
            else => null,
        };
    }
};

test "TypeData.getField" {
    const T = struct {};
    comptime var td = TypeData.init(T, 0);
    inline for (4..9) |index| {
        _ = comptime td.getField(index);
    }
    assert(comptime td.getField(4).slot == 0);
    assert(comptime td.getField(4).index == 4);
    assert(comptime td.getField(6).slot == 2);
    assert(comptime td.getField(8).index == 8);
}

test "TypeData.getStructureType" {
    const Enum = enum { apple, banana };
    const TaggedUnion = union(Enum) {
        apple: i32,
        banana: i32,
    };
    assert(TypeData.getStructureType(i32) == .primitive);
    assert(TypeData.getStructureType(Enum) == .enumeration);
    assert(TypeData.getStructureType(union {}) == .bare_union);
    assert(TypeData.getStructureType(TaggedUnion) == .tagged_union);
    assert(TypeData.getStructureType(extern union {}) == .extern_union);
}

test "TypeData.getByteSize" {
    assert(TypeData.getByteSize(void) == 0);
    assert(TypeData.getByteSize(@TypeOf(null)) == 0);
    assert(TypeData.getByteSize(u8) == 1);
}

test "TypeData.getBitSize" {
    assert(TypeData.getBitSize(void) == 0);
    assert(TypeData.getBitSize(@TypeOf(null)) == 0);
    assert(TypeData.getBitSize(u8) == 8);
}

test "TypeData.getAlignment" {
    assert(TypeData.getAlignment(void) == 1);
    assert(TypeData.getAlignment(u8) == 1);
}

test "TypeData.getLength" {
    assert(TypeData.getLength([5]u8) == 5);
    assert(TypeData.getLength(u8) == null);
    assert(TypeData.getLength(@Vector(3, f32)) == 3);
}

const TypeDatabase = struct {
    const List = ComptimeList(TypeData);

    types: List,

    pub fn init(comptime capacity: comptime_int) @This() {
        return .{
            .types = List.init(capacity),
        };
    }

    pub fn getTypeData(comptime self: *@This(), comptime T: type) *TypeData {
        @setEvalBranchQuota(self.types.len);
        comptime var index = 0;
        inline while (index < self.types.len) : (index += 1) {
            const ptr = &self.types.entries[index];
            if (ptr.Type == T) {
                return ptr;
            }
        }
        const slot = self.types.len;
        self.types = self.types.expand();
        const ptr = self.types.get(slot);
        ptr.* = TypeData.init(T, slot);
        // replace long and cryptic names with generic one to save space
        if (isCryptic(ptr.name)) {
            ptr.name = self.getGenericName(T);
        }
        return ptr;
    }

    pub fn isSupported(comptime self: *@This(), comptime T: type) bool {
        const td = self.getTypeData(T);
        if (td.is_supported == null) {
            td.is_supported = switch (@typeInfo(T)) {
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

    fn getGenericName(comptime self: *@This(), comptime T: type) []const u8 {
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
                const slot = self.getTypeData(T).slot;
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

test "TypeDatabase.isSupported" {
    comptime var tdb = TypeDatabase.init(0);
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
    assert(comptime tdb.isSupported(StructA) == true);
    assert(comptime tdb.isSupported(StructB) == false);
    assert(comptime tdb.isSupported(Thunk) == false);
    assert(comptime tdb.isSupported(*StructA) == true);
    assert(comptime tdb.isSupported(*StructB) == false);
    assert(comptime tdb.isSupported(StructC) == true);
    assert(comptime tdb.isSupported(StructD) == false);
}

test "TypeDatabase.getGenericName" {
    comptime var tdb = TypeDatabase.init(0);
    const s_name = comptime tdb.getGenericName(@TypeOf(.{.tuple}));
    assert(std.mem.eql(u8, s_name, "Struct0000"));
    const e_name = comptime tdb.getGenericName(error{ a, b, c });
    assert(std.mem.eql(u8, e_name, "ErrorSet0001"));
}
