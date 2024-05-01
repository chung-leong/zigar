const std = @import("std");
const builtin = @import("builtin");

fn assertCT(comptime value: bool) void {
    std.debug.assert(value);
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

pub fn optional(optional_value: anytype) comptime_int {
    if (optional_value) |value| {
        return value;
    } else {
        const T = @typeInfo(optional_value).Optional.child;
        return std.math.maxInt(T);
    }
}

pub const Member = extern struct {
    name: ?[*:0]const u8 = null,
    member_type: MemberType,
    is_required: bool = false,
    bit_offset: usize = std.math.maxInt(usize),
    bit_size: usize = std.math.maxInt(usize),
    byte_size: usize = std.math.maxInt(usize),
    slot: usize = std.math.maxInt(usize),
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
    assertCT(list.get(4).* == 1004);
    inline for (0..17) |_| {
        list = list.expand();
    }
    assertCT(list.get(4).* == 1004);
    assertCT(list.get(16).* == 1016);
}

const FieldData = struct {
    index: usize,
    slot: comptime_int,

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
    slot: ?usize = null,
    alternate_name: ?[:0]const u8 = null,
    fields: List,
    is_supported: ?bool = null,
    is_comptime_only: ?bool = null,
    has_pointer: ?bool = null,

    fn init(comptime T: type) @This() {
        return .{
            .Type = T,
            .fields = List.init(0),
        };
    }

    fn getName(comptime self: @This()) [:0]const u8 {
        return self.alternate_name orelse @typeName(self.Type);
    }

    fn getSlot(comptime self: @This()) usize {
        return self.slot.?;
    }

    fn getStructureType(comptime self: @This()) StructureType {
        return switch (@typeInfo(self.Type)) {
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

    fn isConst(comptime self: @This()) bool {
        return switch (@typeInfo(self.Type)) {
            .Pointer => |pt| pt.is_const,
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

    fn getField(comptime self: *@This(), comptime field_index: usize) *FieldData {
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

test "TypeData.getField" {
    const T = struct {};
    comptime var td = TypeData.init(T);
    inline for (4..9) |index| {
        _ = comptime td.getField(index);
    }
    assertCT(td.getField(4).slot == 0);
    assertCT(td.getField(4).index == 4);
    assertCT(td.getField(6).slot == 2);
    assertCT(td.getField(8).index == 8);
}

const TypeDatabase = struct {
    const List = ComptimeList(TypeData);

    types: List,
    next_slot: usize = 0,

    fn init(comptime capacity: comptime_int) @This() {
        return .{
            .types = List.init(capacity),
        };
    }

    fn getTypeData(comptime self: *@This(), comptime T: type) *TypeData {
        @setEvalBranchQuota(self.types.len);
        comptime var index = 0;
        inline while (index < self.types.len) : (index += 1) {
            const ptr = &self.types.entries[index];
            if (ptr.Type == T) {
                return ptr;
            }
        }
        const next_index = self.types.len;
        self.types = self.types.expand();
        const ptr = self.types.get(next_index);
        ptr.* = TypeData.init(T);
        // assign a slot if the type is supported
        if (self.isSupported(T)) {
            ptr.slot = self.next_slot;
            self.next_slot += 1;
            // replace long and cryptic names with generic one to save space
            if (isCryptic(ptr.getName())) {
                ptr.alternate_name = self.getGenericName(T);
            }
        }
        return ptr;
    }

    fn isSupported(comptime self: *@This(), comptime T: type) bool {
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

    fn isComptimeOnly(comptime self: *@This(), comptime T: type) bool {
        const td = self.getTypeData(T);
        if (td.is_comptime_only == null) {
            td.is_comptime_only = switch (@typeInfo(T)) {
                .ComptimeFloat,
                .ComptimeInt,
                .EnumLiteral,
                .Type,
                .Null,
                .Undefined,
                => true,
                .ErrorUnion => |eu| self.isComptimeOnly(eu.payload),
                inline .Array, .Optional, .Pointer => |ar| self.isComptimeOnly(ar.child),
                inline .Struct, .Union => |st| inline for (st.fields) |field| {
                    if (@hasField(@TypeOf(field), "is_comptime") and field.is_comptime) {
                        continue;
                    }
                    // structs with comptime fields of comptime type can be created at runtime
                    if (self.isComptimeOnly(field.type)) {
                        break true;
                    }
                } else false,
                else => false,
            };
        }
        return td.is_comptime_only.?;
    }

    fn hasPointer(comptime self: *@This(), comptime T: type) bool {
        const td = self.getTypeData(T);
        if (td.has_pointer == null) {
            td.has_pointer = switch (@typeInfo(T)) {
                .Pointer => true,
                .ErrorUnion => |eu| self.hasPointer(eu.payload),
                inline .Array, .Optional => |ar| self.hasPointer(ar.child),
                inline .Struct, .Union => |st| check: {
                    // pointer in untagged union are not exportable
                    if (@hasField(@TypeOf(st), "tag_type") and st.tag_type == null) {
                        break :check false;
                    }
                    // set to false to prevent recursion
                    td.is_supported = false;
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
    assertCT(tdb.isSupported(StructA) == true);
    assertCT(tdb.isSupported(StructB) == false);
    assertCT(tdb.isSupported(Thunk) == false);
    assertCT(tdb.isSupported(*StructA) == true);
    assertCT(tdb.isSupported(*StructB) == false);
    assertCT(tdb.isSupported(StructC) == true);
    assertCT(tdb.isSupported(StructD) == false);
}

test "TypeDatabase.isComptimeOnly" {
    comptime var tdb = TypeDatabase.init(0);
    assertCT(tdb.isComptimeOnly(type) == true);
    assertCT(tdb.isComptimeOnly(*type) == true);
    assertCT(tdb.isComptimeOnly(*?type) == true);
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
    const D = union {
        a: A,
        c: C,
    };
    const E = struct {
        number: i32,
        comptime pointer: ?*u32 = null,
    };
    comptime var tdb = TypeDatabase.init(0);
    assertCT(tdb.hasPointer(u8) == false);
    assertCT(tdb.hasPointer(*u8) == true);
    assertCT(tdb.hasPointer([]u8) == true);
    assertCT(tdb.hasPointer([5]*u8) == true);
    assertCT(tdb.hasPointer([][]u8) == true);
    assertCT(tdb.hasPointer(A) == false);
    assertCT(tdb.hasPointer(B) == false);
    assertCT(tdb.hasPointer(C) == true);
    // pointers in union are inaccessible
    assertCT(tdb.hasPointer(D) == false);
    // comptime fields should be ignored
    assertCT(tdb.hasPointer(E) == false);
}

test "TypeDatabase.getGenericName" {
    comptime var tdb = TypeDatabase.init(0);
    const s_name = comptime tdb.getGenericName(@TypeOf(.{.tuple}));
    assertCT(std.mem.eql(u8, s_name, "Struct0000"));
    const e_name = comptime tdb.getGenericName(error{ a, b, c });
    assertCT(std.mem.eql(u8, e_name, "ErrorSet0001"));
}
