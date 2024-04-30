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

const FieldData = struct {
    index: comptime_int,
    slot: comptime_int,

    pub fn init(comptime index: comptime_int, comptime slot: comptime_int) @This() {
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
    slot: comptime_int,
    fields: List,

    pub fn init(comptime T: type, comptime slot: comptime_int) @This() {
        return .{
            .Type = T,
            .name = @typeName(T),
            .slot = slot,
            .fields = List.init(0),
        };
    }

    pub fn getField(comptime self: *@This(), comptime field_index: comptime_int) *FieldData {
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

    pub fn getTypeName(comptime self: *@This(), comptime T: type) []const u8 {
        return self.getTypeData(T).name;
    }

    pub fn getTypeSlot(comptime self: *@This(), comptime T: type) comptime_int {
        return self.getTypeData(T).slot;
    }

    pub fn getFieldSlot(comptime self: *@This(), comptime T: type, comptime index: comptime_int) comptime_int {
        return self.getTypeData(T).getField(index).slot;
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
                    .Union => "Union",
                    .Opaque => "Opaque",
                    .Enum => "Enum",
                    .ErrorSet => "ErrorSet",
                    else => "Type",
                };
                const slot = self.getTypeSlot(T);
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

fn IntType(comptime StartT: type, comptime n: comptime_int) type {
    var IT = StartT;
    return while (!isInRangeOf(n, IT)) {
        IT = NextIntType(IT);
    } else IT;
}

test "IntType" {
    assert(IntType(i32, 0) == i32);
    assert(IntType(i32, 0xFFFFFFFF) == u32);
    assert(IntType(i32, -0xFFFFFFFF) == i64);
    assert(IntType(u8, 123) == u8);
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

fn isTuple(comptime T: type) bool {
    return switch (@typeInfo(T)) {
        .Struct => |st| st.is_tuple,
        else => false,
    };
}

test "isTuple" {
    assert(isTuple(@TypeOf(.{})) == true);
    assert(isTuple(struct {}) == false);
}

fn isPacked(comptime T: type) bool {
    return switch (@typeInfo(T)) {
        .Struct => |st| st.layout == enum_packed,
        .Union => |un| un.layout == enum_packed,
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

fn isPointer(comptime T: type) bool {
    return switch (@typeInfo(T)) {
        .Pointer => true,
        else => false,
    };
}

test "isPointer" {
    assert(isPointer(*u8) == true);
    assert(isPointer(u8) == false);
}

fn hasPointer(comptime T: type) bool {
    return switch (@typeInfo(T)) {
        .Pointer => true,
        .Array => |ar| hasPointer(ar.child),
        .Struct => |st| any: {
            inline for (st.fields) |field| {
                if (!field.is_comptime and hasPointer(field.type)) {
                    break :any true;
                }
            }
            break :any false;
        },
        .Union => |un| any: {
            // pointer in untagged union are not exportable
            if (un.tag_type) |_| {
                inline for (un.fields) |field| {
                    if (hasPointer(field.type)) {
                        break :any true;
                    }
                }
            }
            break :any false;
        },
        .Optional => |op| hasPointer(op.child),
        .ErrorUnion => |eu| hasPointer(eu.payload),
        else => false,
    };
}

test "hasPointer" {
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
    assert(hasPointer(u8) == false);
    assert(hasPointer(*u8) == true);
    assert(hasPointer([]u8) == true);
    assert(hasPointer([5]*u8) == true);
    assert(hasPointer([][]u8) == true);
    assert(hasPointer(A) == false);
    assert(hasPointer(B) == false);
    assert(hasPointer(C) == true);
    // pointers in union are inaccessible
    assert(hasPointer(D) == false);
    // comptime fields should be ignored
    assert(hasPointer(E) == false);
}

fn hasPointerArguments(comptime ArgT: type) bool {
    const st = @typeInfo(ArgT).Struct;
    inline for (st.fields, 0..) |field, index| {
        if (index != st.fields.len - 1 and hasPointer(field.type)) {
            return true;
        }
    }
    return false;
}

test "hasPointerArguments" {
    const ArgA = struct {
        @"0": u32,
        @"1": u32,
        retval: u32,
    };
    const ArgB = struct {
        @"0": *u32,
        @"1": u32,
        retval: u32,
    };
    const ArgC = struct {
        @"0": u32,
        @"1": u32,
        retval: []u32,
    };
    assert(hasPointerArguments(ArgA) == false);
    assert(hasPointerArguments(ArgB) == true);
    assert(hasPointerArguments(ArgC) == false);
}

fn calculateHash(comptime name: []const u8) u32 {
    @setEvalBranchQuota(name.len * 3);
    return std.hash.cityhash.CityHash32.hash(name);
}

fn getUniqueId(comptime arg: anytype) u32 {
    return calculateHash(@typeName(@TypeOf(arg)));
}

test "getUniqueId" {
    const id1 = getUniqueId(.{ .hello = i32 });
    const id2 = getUniqueId(.{ .hello = i32 });
    const id3 = getUniqueId(.{ .hello = u32 });
    const id4 = getUniqueId(.{ .hello = u32, .something = 123 });
    const id5 = getUniqueId(.{ .hello = u32, .something = 124 });
    assert(id1 == id2);
    assert(id1 != id3);
    assert(id3 != id4);
    assert(id4 != id5);
}

fn getMemberType(comptime T: type) MemberType {
    return switch (@typeInfo(T)) {
        .Bool => .bool,
        .Int => |int| if (int.signedness == .signed) .int else .uint,
        .Float => .float,
        .Enum => |en| getMemberType(en.tag_type),
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

test "getMemberType" {
    assert(getMemberType(i32) == .int);
    assert(getMemberType(u32) == .uint);
    assert(getMemberType(*u32) == .object);
    assert(getMemberType(type) == .type);
}

fn isSupported(comptime T: type) bool {
    const recursively = struct {
        fn check(comptime CT: type, comptime checking_before: anytype) bool {
            @setEvalBranchQuota(10000);
            inline for (checking_before) |BT| {
                if (CT == BT) {
                    return true;
                }
            }
            const checking_now = checking_before ++ .{CT};
            return switch (@typeInfo(CT)) {
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
                .ErrorUnion => |eu| check(eu.payload, checking_now),
                inline .Array, .Optional, .Pointer => |ar| check(ar.child, checking_now),
                .Struct => |st| inline for (st.fields) |field| {
                    if (!field.is_comptime and !check(field.type, checking_now)) {
                        break false;
                    }
                } else true,
                .Union => |un| inline for (un.fields) |field| {
                    if (!check(field.type, checking_now)) {
                        break false;
                    }
                } else true,
                else => false,
            };
        }
    };
    return recursively.check(T, .{});
}

test "isSupported" {
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
    assert(isSupported(StructA) == true);
    assert(isSupported(StructB) == false);
    assert(isSupported(Thunk) == false);
    assert(isSupported(*StructA) == true);
    assert(isSupported(*StructB) == false);
    assert(isSupported(StructC) == true);
    assert(isSupported(StructD) == false);
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
        .Struct => |st| if (isArgumentStruct(T)) .arg_struct else switch (st.layout) {
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
        .Opaque => .@"opaque",
        .Pointer => .pointer,
        .Vector => .vector,
        else => @compileError("Unsupported type: " ++ @typeName(T)),
    };
}

test "getStructureType" {
    const Enum = enum { apple, banana };
    const TaggedUnion = union(Enum) {
        apple: i32,
        banana: i32,
    };
    assert(getStructureType(i32) == .primitive);
    assert(getStructureType(Enum) == .enumeration);
    assert(getStructureType(union {}) == .bare_union);
    assert(getStructureType(TaggedUnion) == .tagged_union);
    assert(getStructureType(extern union {}) == .extern_union);
}

fn getStructureSize(comptime T: type) usize {
    return switch (@typeInfo(T)) {
        .Null, .Undefined => 0,
        .Opaque => missing(usize),
        else => return @sizeOf(T),
    };
}

test "getStructureSize" {
    assert(getStructureSize(void) == 0);
    assert(getStructureSize(@TypeOf(null)) == 0);
    assert(getStructureSize(u8) == 1);
}

fn getStructureAlign(comptime T: type) u16 {
    return switch (@typeInfo(T)) {
        .Opaque => missing(u16),
        .ErrorSet => @alignOf(anyerror),
        else => return @alignOf(T),
    };
}

test "getStructureAlign" {
    assert(getStructureAlign(void) == 1);
    assert(getStructureAlign(u8) == 1);
}

fn getStructureBitSize(comptime T: type) usize {
    return switch (@typeInfo(T)) {
        .Null, .Opaque, .Undefined => 0,
        else => return @bitSizeOf(T),
    };
}

test "getStructureBitSize" {
    assert(getStructureBitSize(void) == 0);
    assert(getStructureBitSize(@TypeOf(null)) == 0);
    assert(getStructureBitSize(u8) == 8);
}

fn getStructureLength(comptime T: type) usize {
    return switch (@typeInfo(T)) {
        .Array => |ar| ar.len,
        .Vector => |ve| ve.len,
        else => missing(usize),
    };
}

test "getStructureLength" {
    assert(getStructureLength([5]u8) == 5);
    assert(getStructureLength(u8) == missing(usize));
    assert(getStructureLength(@Vector(3, f32)) == 3);
}

pub fn fromMemory(memory: Memory, comptime PtrT: type) PtrT {
    const pt = @typeInfo(PtrT).Pointer;
    return switch (pt.size) {
        .One => @ptrCast(@alignCast(memory.bytes)),
        .Slice => slice: {
            if (memory.bytes == null) {
                break :slice &.{};
            }
            const count = memory.len / @sizeOf(pt.child);
            const many_ptr: [*]pt.child = @ptrCast(@alignCast(memory.bytes));
            break :slice many_ptr[0..count];
        },
        .Many => @ptrCast(@alignCast(memory.bytes)),
        .C => @ptrCast(@alignCast(memory.bytes)),
    };
}

test "fromMemory" {
    var array: [5]u8 = .{ 'H', 'e', 'l', 'l', 'o' };
    const memory: Memory = .{
        .bytes = &array,
        .len = array.len,
    };
    const p1 = fromMemory(memory, *u8);
    assert(p1.* == 'H');
    assert(@typeInfo(@TypeOf(p1)).Pointer.size == .One);
    const p2 = fromMemory(memory, []u8);
    assert(p2[0] == 'H');
    assert(p2.len == 5);
    assert(@typeInfo(@TypeOf(p2)).Pointer.size == .Slice);
    const p3 = fromMemory(memory, [*]u8);
    assert(p3[0] == 'H');
    assert(@typeInfo(@TypeOf(p3)).Pointer.size == .Many);
    const p4 = fromMemory(memory, [*c]u8);
    assert(p4[0] == 'H');
    assert(@typeInfo(@TypeOf(p4)).Pointer.size == .C);
}

pub fn toMemory(ptr: anytype, is_comptime: bool) Memory {
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
        .One => getStructureSize(pt.child),
        .Slice => getStructureSize(pt.child) * ptr.len,
        .Many => if (getSentinel(PtrT)) |sentinel| find: {
            var len: usize = 0;
            while (ptr[len] != sentinel) {
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

test "toMemory" {
    var a: i32 = 1234;
    const memA = toMemory(&a, false);
    const b: []const u8 = "Hello";
    const memB = toMemory(b, false);
    const c: [*]const u8 = b.ptr;
    const memC = toMemory(c, true);
    const d: [*c]const u8 = b.ptr;
    const memD = toMemory(d, false);
    const e = &b;
    const memE = toMemory(e, false);
    const f: [*:0]const u8 = "Hello";
    const memF = toMemory(f, false);
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

fn comparePointers(p1: anytype, p2: anytype) bool {
    const T = @TypeOf(p1);
    return switch (@typeInfo(T).Pointer.size) {
        .Slice => p1.ptr == p2.ptr and p1.len == p2.len,
        else => p1 == p2,
    };
}

test "comparePointers" {
    const a: []const u8 = "Hello world";
    const b: []const u8 = a[0..a.len];
    const c: []const u8 = a[2..a.len];
    const d: []const u8 = a[0..5];
    assert(comparePointers(a, b) == true);
    assert(comparePointers(a, c) == false);
    assert(comparePointers(a, d) == false);
    var number1: i32 = 1234;
    var number2: i32 = 1234;
    const e = &number1;
    const f = &number1;
    const g = &number2;
    assert(comparePointers(e, f) == true);
    assert(comparePointers(e, g) == false);
    const h: [*]i32 = @ptrCast(e);
    const i: [*]i32 = @ptrCast(g);
    assert(comparePointers(h, i) == false);
    const j: [*c]i32 = @ptrCast(e);
    const k: [*c]i32 = @ptrCast(g);
    assert(comparePointers(j, k) == false);
}

fn getGlobalSlot(host: anytype, comptime key: anytype) !usize {
    return host.getSlotNumber(0, getUniqueId(key));
}

fn getTypeSlot(host: anytype, comptime T: type, comptime key: anytype) !usize {
    return host.getSlotNumber(getUniqueId(.{T}), getUniqueId(key));
}

// NOTE: error type has to be specified here since the function is called recursively
// and https://github.com/ziglang/zig/issues/2971 has not been fully resolved yet
fn getStructure(host: anytype, comptime T: type) Error!Value {
    const s_slot = try getGlobalSlot(host, .{ .structure = T });
    return host.readSlot(null, s_slot) catch undefined: {
        const def: Structure = .{
            .name = getStructureName(T),
            .structure_type = getStructureType(T),
            .length = getStructureLength(T),
            .byte_size = getStructureSize(T),
            .alignment = getStructureAlign(T),
            .is_const = isConst(T),
            .is_tuple = isTuple(T),
            .has_pointer = hasPointer(T),
        };
        // create the structure and place it in the slot immediately
        // so that recursive definition works correctly
        const structure = try host.beginStructure(def);
        try host.writeSlot(null, s_slot, structure);
        // define the shape of the structure
        try addMembers(host, structure, T);
        // finalize the shape so that static members can be instances of the structure
        try host.finalizeShape(structure);
        try addStaticMembers(host, structure, T);
        try addMethods(host, structure, T);
        try host.endStructure(structure);
        break :undefined structure;
    };
}

fn getStructureName(comptime T: type) [*:0]const u8 {
    const name = @typeName(T);
    const alternate_name = comptime switch (@typeInfo(T)) {
        .ErrorSet => if (T == anyerror)
            name
        else
            std.fmt.comptimePrint("ErrorSet{d}", .{calculateHash(name)}),
        .Struct => if (getFunctionName(T)) |func_name|
            func_name
        else if (findPrefix(name, "struct{"))
            std.fmt.comptimePrint("Struct{d}", .{calculateHash(name)})
        else
            name,
        .ErrorUnion => |eu| format: {
            const es_name = getStructureName(eu.error_set);
            const pl_name = getStructureName(eu.payload);
            break :format std.fmt.comptimePrint("{s}!{s}", .{ es_name, pl_name });
        },
        else => name,
    };
    return getCString(alternate_name);
}

test "getStructureName" {
    const ns = struct {
        fn hello(number: i32) !i32 {
            return number + 2;
        }

        const cow = .{.{ .cow = 2 }};
        const pig = .{.{ .pig = 1 }};
    };

    const name1 = getStructureName([]u8);
    assert(name1[0] == '[');
    assert(name1[1] == ']');
    assert(name1[4] == 0);
    const ArgT = ArgumentStruct(ns.hello, @TypeOf(ns.hello));
    const name2 = getStructureName(ArgT);
    assert(name2[0] == 'h');
    assert(name2[1] == 'e');
    assert(name2[5] == 0);
    const name3 = getStructureName(@TypeOf(ns.cow));
    assert(name3[0] == 'S');
    assert(name3[1] == 't');
    const name4 = getStructureName(@TypeOf(ns.pig));
    assert(name4[0] == 'S');
    assert(name4[1] == 't');
    const name5 = getStructureName(@typeInfo(@TypeOf(ns.hello)).Fn.return_type orelse void);
    assert(name5[0] == 'E');
    assert(name5[1] == 'r');
}

fn getSliceName(comptime T: type) [*:0]const u8 {
    const ptr_name = @typeName(T);
    const needle = switch (@typeInfo(T).Pointer.size) {
        .Slice => "[",
        .C => "[*c",
        .Many => "[*",
        else => @compileError("Unexpected pointer type: " ++ ptr_name),
    };
    const replacement = if (@typeInfo(T).Pointer.size == .Slice or @typeInfo(T).Pointer.sentinel != null)
        "[_"
    else
        "[0";
    const new_len = ptr_name.len - needle.len + replacement.len;
    if (std.mem.indexOf(u8, ptr_name, needle)) |index| {
        comptime var array: [ptr_name.len + 2]u8 = undefined;
        @memcpy(array[0..index], ptr_name[0..index]);
        @memcpy(array[index .. index + replacement.len], replacement);
        @memcpy(array[index + replacement.len .. new_len], ptr_name[index + needle.len .. ptr_name.len]);
        array[new_len] = 0;
        return getCString(&array);
    } else {
        @compileError("Unexpected pointer type: " ++ ptr_name);
    }
}

test "getSliceName" {
    const name1 = comptime getSliceName([]const u8);
    assert(name1[0] == '[');
    assert(name1[1] == '_');
    assert(name1[2] == ']');
    assert(name1[11] == 0);
    const name2 = comptime getSliceName([:0]const u8);
    assert(name2[0] == '[');
    assert(name2[1] == '_');
    assert(name2[2] == ':');
    assert(name2[3] == '0');
    assert(name2[4] == ']');
    assert(name2[13] == 0);
    const name3 = comptime getSliceName([][4]u8);
    assert(name3[0] == '[');
    assert(name3[1] == '_');
    assert(name3[2] == ']');
    assert(name3[3] == '[');
    assert(name3[4] == '4');
    assert(name3[5] == ']');
    assert(name3[8] == 0);
    const name4 = comptime getSliceName([*:0]const u8);
    assert(name4[0] == '[');
    assert(name4[1] == '_');
    assert(name4[2] == ':');
    assert(name4[3] == '0');
    assert(name4[4] == ']');
    assert(name4[13] == 0);
    const name5 = comptime getSliceName([*]const u8);
    assert(name5[0] == '[');
    assert(name5[1] == '0');
    assert(name5[2] == ']');
    assert(name5[11] == 0);
    const name6 = comptime getSliceName([*c]const u8);
    assert(name6[0] == '[');
    assert(name6[1] == '0');
    assert(name6[2] == ']');
    assert(name6[11] == 0);
}

fn getSentinel(comptime T: type) ?@typeInfo(T).Pointer.child {
    if (@typeInfo(T).Pointer.sentinel) |ptr| {
        const sentinel_ptr: *const @typeInfo(T).Pointer.child = @alignCast(@ptrCast(ptr));
        return sentinel_ptr.*;
    } else {
        return null;
    }
}

test "getSentinel" {
    const sentinel1 = getSentinel([*:0]const u8);
    assert(sentinel1 == 0);
    const sentinel2 = getSentinel([*:7]const i32);
    assert(sentinel2 == 7);
}

fn getUnionSelectorType(comptime T: type) type {
    return switch (@typeInfo(T)) {
        .Union => |un| un.tag_type orelse IntType(u8, un.fields.len),
        else => @compileError("Not a union"),
    };
}

test "getUnionSelectorType" {
    const U = union {
        a: u32,
        b: u32,
    };
    assert(getUnionSelectorType(U) == u8);
}

fn getUnionSelectorOffset(comptime TT: type, comptime fields: []const std.builtin.Type.UnionField) comptime_int {
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
    return offset;
}

test "getUnionSelectorOffset" {
    const Union = union {
        cat: i32,
        dog: i32,
    };
    assert(getUnionSelectorOffset(i16, @typeInfo(Union).Union.fields) == 32);
    assert(getUnionSelectorOffset(i64, @typeInfo(Union).Union.fields) == 0);
}

fn getUnionSelector(comptime TT: type, comptime value: anytype) TT {
    return switch (@typeInfo(@TypeOf(value))) {
        .Union => |un| {
            const bytes = std.mem.asBytes(&value);
            const array = bytes.*;
            const offset = getUnionSelectorOffset(TT, un.fields);
            const offset_ptr: *const TT = @ptrCast(&array[offset / 8]);
            return offset_ptr.*;
        },
        else => @compileError("Not a union"),
    };
}

test "getUnionSelector" {
    const Union = union {
        cat: comptime_int,
        dog: i32,
    };
    const u: Union = .{ .dog = 1234 };
    const TT = getUnionSelectorType(Union);
    const selector = getUnionSelector(TT, u);
    assert(selector == 1);
}

fn addMembers(host: anytype, structure: Value, comptime T: type) !void {
    return switch (comptime getStructureType(T)) {
        .primitive,
        .error_set,
        .enumeration,
        => addPrimitiveMember(host, structure, T),
        .array => addArrayMember(host, structure, T),
        .@"struct",
        .extern_struct,
        .packed_struct,
        .arg_struct,
        => addStructMembers(host, structure, T),
        .extern_union,
        .bare_union,
        .tagged_union,
        => addUnionMembers(host, structure, T),
        .error_union => addErrorUnionMembers(host, structure, T),
        .optional => addOptionalMembers(host, structure, T),
        .pointer => addPointerMember(host, structure, T),
        .vector => addVectorMember(host, structure, T),
        else => void{},
    };
}

fn addPrimitiveMember(host: anytype, structure: Value, comptime T: type) !void {
    try host.attachMember(structure, .{
        .member_type = getMemberType(T),
        .bit_size = getStructureBitSize(T),
        .bit_offset = 0,
        .byte_size = getStructureSize(T),
        .slot = switch (getMemberType(T)) {
            .@"comptime", .literal, .type => 0,
            else => missing(usize),
        },
        .structure = try getStructure(host, T),
    }, false);
}

fn addArrayMember(host: anytype, structure: Value, comptime T: type) !void {
    const ar = @typeInfo(T).Array;
    try host.attachMember(structure, .{
        .member_type = getMemberType(ar.child),
        .bit_size = getStructureBitSize(ar.child),
        .byte_size = getStructureSize(ar.child),
        .structure = try getStructure(host, ar.child),
    }, false);
}

fn addVectorMember(host: anytype, structure: Value, comptime T: type) !void {
    const ve = @typeInfo(T).Vector;
    const child_size = getStructureSize(ve.child);
    const is_bitfields = child_size * ve.len > getStructureSize(T);
    try host.attachMember(structure, .{
        .member_type = getMemberType(ve.child),
        .bit_size = getStructureBitSize(ve.child),
        // byte_size is missing when it's a vector of bools (i.e. bits)
        .byte_size = if (is_bitfields) missing(usize) else child_size,
        .structure = try getStructure(host, ve.child),
    }, false);
}

fn addPointerMember(host: anytype, structure: Value, comptime T: type) !void {
    const pt = @typeInfo(T).Pointer;
    const child_structure = try getStructure(host, pt.child);
    const target_structure = switch (pt.size) {
        .One => child_structure,
        else => slice: {
            // set the length to zero when slice is always empty
            const length = if (pt.size == .Slice or pt.sentinel != null) missing(usize) else 0;
            const slice_slot = try getGlobalSlot(host, .{ .structure = pt.child, .size = pt.size });
            const slice_def: Structure = .{
                .name = comptime getSliceName(T),
                .structure_type = .slice,
                .length = length,
                .byte_size = @sizeOf(pt.child),
                .alignment = @alignOf(pt.child),
                .has_pointer = hasPointer(pt.child),
            };
            const slice_structure = try host.beginStructure(slice_def);
            try host.writeSlot(null, slice_slot, slice_structure);
            try host.attachMember(slice_structure, .{
                .member_type = getMemberType(pt.child),
                .bit_size = @bitSizeOf(pt.child),
                .byte_size = @sizeOf(pt.child),
                .structure = child_structure,
            }, false);
            if (getSentinel(T)) |sentinel| {
                try host.attachMember(slice_structure, .{
                    .name = "sentinel",
                    .member_type = getMemberType(pt.child),
                    .bit_offset = 0,
                    .bit_size = @bitSizeOf(pt.child),
                    .byte_size = @sizeOf(pt.child),
                    .structure = child_structure,
                }, false);
                const memory = toMemory(&sentinel, true);
                const dv = try host.captureView(memory);
                const template = try host.createTemplate(dv);
                try host.attachTemplate(slice_structure, template, false);
            }
            try host.finalizeShape(slice_structure);
            try host.endStructure(slice_structure);
            break :slice slice_structure;
        },
    };
    try host.attachMember(structure, .{
        .member_type = getMemberType(T),
        .bit_size = @bitSizeOf(T),
        .byte_size = @sizeOf(T),
        .slot = 0,
        .structure = target_structure,
    }, false);
}

fn isComptimeOnly(comptime T: type) bool {
    const recursively = struct {
        fn check(comptime CT: type, comptime checking_before: anytype) bool {
            @setEvalBranchQuota(10000);
            inline for (checking_before) |BT| {
                if (CT == BT) {
                    return false;
                }
            }
            const checking_now = checking_before ++ .{CT};
            return switch (@typeInfo(CT)) {
                .ComptimeFloat,
                .ComptimeInt,
                .EnumLiteral,
                .Type,
                .Null,
                .Undefined,
                => true,
                inline .Array, .Optional, .Pointer => |ar| check(ar.child, checking_now),
                .Struct => |st| inline for (st.fields) |field| {
                    // structs with comptime fields of comptime type can be created at runtime
                    if (!field.is_comptime and check(field.type, checking_now)) {
                        break true;
                    }
                } else false,
                .Union => |st| inline for (st.fields) |field| {
                    if (check(field.type, checking_now)) {
                        break true;
                    }
                } else false,
                .ErrorUnion => |eu| check(eu.payload, checking_now),
                else => false,
            };
        }
    };
    return recursively.check(T, .{});
}

test "isComptimeOnly" {
    assert(isComptimeOnly(type) == true);
    assert(isComptimeOnly(*type) == true);
    assert(isComptimeOnly(*?type) == true);
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
    if (comptime !isComptimeOnly(T)) {
        return value;
    }
    const RT = ComptimeFree(T);
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

fn exportComptimeValue(host: anytype, comptime value: anytype) !Value {
    return switch (@typeInfo(@TypeOf(value))) {
        .ComptimeInt => exportPointerTarget(host, &@as(IntType(i8, value), value), true),
        .ComptimeFloat => exportPointerTarget(host, &@as(f64, value), true),
        .EnumLiteral => exportPointerTarget(host, @tagName(value), true),
        .Type => getStructure(host, value),
        else => return exportPointerTarget(host, &value, true),
    };
}

fn attachComptimeValues(host: anytype, target: Value, comptime value: anytype) !void {
    const T = @TypeOf(value);
    switch (@typeInfo(T)) {
        .Type => {
            const obj = try getStructure(host, value);
            try host.writeSlot(target, 0, obj);
        },
        .ComptimeInt, .ComptimeFloat, .EnumLiteral => {
            const obj = try exportComptimeValue(host, value);
            try host.writeSlot(target, 0, obj);
        },
        .Array => {
            inline for (value, 0..) |element, index| {
                const obj = try exportComptimeValue(host, element);
                try host.writeSlot(target, index, obj);
            }
        },
        .Struct => |st| {
            inline for (st.fields, 0..) |field, index| {
                if (isComptimeOnly(field.type)) {
                    const field_value = @field(value, field.name);
                    const obj = try exportComptimeValue(host, field_value);
                    const slot = try getTypeSlot(host, T, .{ .index = index });
                    try host.writeSlot(target, slot, obj);
                }
            }
        },
        .Union => |un| {
            if (un.tag_type) |Tag| {
                const tag: Tag = value;
                inline for (un.fields, 0..) |field, index| {
                    if (@field(Tag, field.name) == tag) {
                        if (isComptimeOnly(field.type)) {
                            const field_value = @field(value, field.name);
                            const obj = try exportComptimeValue(host, field_value);
                            const slot = try getTypeSlot(host, T, .{ .index = index });
                            try host.writeSlot(target, slot, obj);
                        }
                    }
                }
            } else {
                @compileError("Unable to handle comptime value in bare union");
            }
        },
        .Optional => {
            if (value) |v| {
                const obj = try exportComptimeValue(host, v);
                try host.writeSlot(target, 0, obj);
            }
        },
        .ErrorUnion => {
            if (value) |v| {
                const obj = try exportComptimeValue(host, v);
                try host.writeSlot(target, 0, obj);
            } else |_| {}
        },
        else => {},
    }
}

fn exportPointerTarget(host: anytype, comptime ptr: anytype, comptime is_comptime: bool) !Value {
    const T = @TypeOf(ptr.*);
    const value_ptr = get: {
        // values that only exist at comptime need to have their comptime part replaced with void
        // (comptime keyword needed here since expression evaluates to different pointer types)
        if (comptime isComptimeOnly(T)) {
            var runtime_value: ComptimeFree(T) = removeComptimeValues(ptr.*);
            break :get &runtime_value;
        } else {
            break :get ptr;
        }
    };
    const memory = toMemory(value_ptr, is_comptime);
    const structure = try getStructure(host, T);
    const obj = try host.castView(memory, structure);
    if (comptime isComptimeOnly(T)) {
        try attachComptimeValues(host, obj, ptr.*);
    }
    return obj;
}

fn exportError(host: anytype, err: anyerror, structure: Value) !Value {
    const memory = toMemory(&err, true);
    const obj = try host.castView(memory, structure);
    return obj;
}

fn addStructMembers(host: anytype, structure: Value, comptime T: type) !void {
    const st = @typeInfo(T).Struct;
    // pre-allocate relocatable slots for fields that always need them
    inline for (st.fields, 0..) |field, index| {
        if (!field.is_comptime) {
            switch (getMemberType(field.type)) {
                .object => _ = try getTypeSlot(host, T, .{ .index = index }),
                else => {},
            }
        }
    }
    inline for (st.fields, 0..) |field, index| {
        if (comptime isSupported(field.type)) {
            const comptime_only = field.is_comptime or isComptimeOnly(field.type);
            try host.attachMember(structure, .{
                .name = getCString(field.name),
                .member_type = if (field.is_comptime) .@"comptime" else getMemberType(field.type),
                .is_required = field.default_value == null,
                .bit_offset = if (comptime_only) missing(usize) else @bitOffsetOf(T, field.name),
                .bit_size = if (comptime_only) missing(usize) else getStructureBitSize(field.type),
                .byte_size = if (comptime_only or isPacked(T)) missing(usize) else getStructureSize(field.type),
                .slot = try getTypeSlot(host, T, .{ .index = index }),
                .structure = try getStructure(host, field.type),
            }, false);
        }
    }
    if (!isArgumentStruct(T)) {
        // add default values
        var template_maybe: ?Value = null;
        const CFT = ComptimeFree(T);
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
                            const dest_ptr: *field.type = @ptrCast(&@field(values, field.name));
                            dest_ptr.* = default_value_ptr.*;
                        }
                    }
                }
            }
            const memory = toMemory(&values, true);
            const dv = try host.captureView(memory);
            template_maybe = try host.createTemplate(dv);
        }
        inline for (st.fields, 0..) |field, index| {
            if (field.default_value) |opaque_ptr| {
                const comptime_only = field.is_comptime or isComptimeOnly(field.type);
                if (comptime_only and comptime isSupported(field.type)) {
                    // comptime members aren't stored in the struct's memory
                    // they're separate objects in the slots of the struct template
                    const default_value_ptr: *const field.type = @ptrCast(@alignCast(opaque_ptr));
                    const value_obj = try exportPointerTarget(host, default_value_ptr, true);
                    const slot = try getTypeSlot(host, T, .{ .index = index });
                    template_maybe = template_maybe orelse try host.createTemplate(null);
                    try host.writeSlot(template_maybe.?, slot, value_obj);
                }
            }
        }
        if (template_maybe) |template| {
            try host.attachTemplate(structure, template, false);
        }
    }
}

fn addUnionMembers(host: anytype, structure: Value, comptime T: type) !void {
    const un = @typeInfo(T).Union;
    inline for (un.fields, 0..) |field, index| {
        switch (getMemberType(field.type)) {
            .object => _ = try getTypeSlot(host, T, .{ .index = index }),
            else => {},
        }
    }
    const TT = getUnionSelectorType(T);
    const has_selector = if (un.tag_type) |_|
        true
    else if (runtime_safety and un.layout != enum_extern)
        true
    else
        false;
    const tag_offset: comptime_int = if (has_selector) getUnionSelectorOffset(TT, un.fields) else missing(usize);
    const value_offset: comptime_int = if (tag_offset == 0) @sizeOf(TT) * 8 else 0;
    inline for (un.fields, 0..) |field, index| {
        try host.attachMember(structure, .{
            .name = getCString(field.name),
            .member_type = getMemberType(field.type),
            .bit_offset = value_offset,
            .bit_size = getStructureBitSize(field.type),
            .byte_size = if (isPacked(T)) missing(usize) else getStructureSize(field.type),
            .slot = try getTypeSlot(host, T, .{ .index = index }),
            .structure = try getStructure(host, field.type),
        }, false);
    }
    if (has_selector) {
        try host.attachMember(structure, .{
            .name = "selector",
            .member_type = getMemberType(TT),
            .bit_offset = tag_offset,
            .bit_size = @bitSizeOf(TT),
            .byte_size = if (isPacked(T)) missing(usize) else @sizeOf(TT),
            .structure = try getStructure(host, TT),
        }, false);
    }
}

fn StandardInt(comptime T: type) type {
    const int = @typeInfo(T).Int;
    return @Type(.{
        .Int = .{
            .signedness = int.signedness,
            .bits = @sizeOf(T) * 8,
        },
    });
}

test "StandardInt" {
    assert(StandardInt(u2) == u8);
    assert(StandardInt(i5) == i8);
    assert(StandardInt(i127) == i128);
}

fn addOptionalMembers(host: anytype, structure: Value, comptime T: type) !void {
    const op = @typeInfo(T).Optional;
    // value always comes first
    try host.attachMember(structure, .{
        .name = "value",
        .member_type = getMemberType(op.child),
        .bit_offset = 0,
        .bit_size = @bitSizeOf(op.child),
        .byte_size = @sizeOf(op.child),
        .slot = 0,
        .structure = try getStructure(host, op.child),
    }, false);
    // optional pointers and error use the value itself as the boolean (null|0 => false)
    const has_present_flag = @sizeOf(T) > @sizeOf(op.child);
    const present_offset = if (has_present_flag) @sizeOf(op.child) * 8 else 0;
    // for slices, @sizeof(op.child) would includes the length too, whereas we only need to known
    // whether the address is non-zero
    const value_as_bool_size = @min(@sizeOf(op.child), @sizeOf(*anyopaque));
    const present_byte_size = if (has_present_flag) @sizeOf(bool) else value_as_bool_size;
    try host.attachMember(structure, .{
        .name = "present",
        .member_type = .bool,
        .bit_offset = present_offset,
        .bit_size = present_byte_size * 8,
        .byte_size = present_byte_size,
        .structure = try getStructure(host, bool),
    }, false);
}

fn addErrorUnionMembers(host: anytype, structure: Value, comptime T: type) !void {
    const eu = @typeInfo(T).ErrorUnion;
    // value is placed after the error number if its alignment is smaller than that of anyerror
    const error_offset = if (@alignOf(anyerror) > @alignOf(eu.payload)) 0 else @sizeOf(eu.payload) * 8;
    const value_offset = if (error_offset == 0) @sizeOf(anyerror) * 8 else 0;
    try host.attachMember(structure, .{
        .name = "value",
        .member_type = getMemberType(eu.payload),
        .bit_offset = value_offset,
        .bit_size = @bitSizeOf(eu.payload),
        .byte_size = @sizeOf(eu.payload),
        .slot = 0,
        .structure = try getStructure(host, eu.payload),
    }, false);
    try host.attachMember(structure, .{
        .name = "error",
        .member_type = getMemberType(eu.error_set),
        .bit_offset = error_offset,
        .bit_size = @bitSizeOf(anyerror),
        .byte_size = @sizeOf(anyerror),
        .structure = try getStructure(host, eu.error_set),
    }, false);
}

fn addStaticMembers(host: anytype, structure: Value, comptime T: type) !void {
    // a stand-in type representing the "static side" of the structure
    const Static = opaque {};
    var template_maybe: ?Value = null;
    // add declared static members
    comptime var offset = 0;
    switch (@typeInfo(T)) {
        inline .Struct, .Union, .Enum, .Opaque => |st| {
            inline for (st.decls, 0..) |decl, index| {
                const decl_value_ptr = &@field(T, decl.name);
                if (comptime isSupported(@TypeOf(decl_value_ptr))) {
                    const DT = @TypeOf(decl_value_ptr.*);
                    // export type only if it's supported
                    if (comptime DT != type or isSupported(decl_value_ptr.*)) {
                        const is_const = comptime isConst(@TypeOf(decl_value_ptr));
                        if (is_const or !host.options.omit_variables) {
                            const slot = try getTypeSlot(host, Static, .{ .index = index });
                            try host.attachMember(structure, .{
                                .name = getCString(decl.name),
                                .member_type = if (is_const) .@"comptime" else .static,
                                .slot = slot,
                                .structure = try getStructure(host, DT),
                            }, true);
                            const value_obj = try exportPointerTarget(host, decl_value_ptr, is_const);
                            template_maybe = template_maybe orelse try host.createTemplate(null);
                            try host.writeSlot(template_maybe.?, slot, value_obj);
                        }
                    }
                }
                offset += 1;
            }
        },
        else => {},
    }
    // add implicit static members
    switch (@typeInfo(T)) {
        .Enum => |en| {
            // add fields as static members
            inline for (en.fields, 0..) |field, index| {
                const value = @field(T, field.name);
                const slot = try getTypeSlot(host, Static, .{ .index = offset + index });
                try host.attachMember(structure, .{
                    .name = getCString(field.name),
                    .member_type = .@"comptime",
                    .slot = slot,
                    .structure = structure,
                }, true);
                const value_obj = try exportPointerTarget(host, &value, true);
                template_maybe = template_maybe orelse try host.createTemplate(null);
                try host.writeSlot(template_maybe.?, slot, value_obj);
            }
            if (!en.is_exhaustive) {
                try host.attachMember(structure, .{
                    .member_type = .@"comptime",
                    .structure = structure,
                }, true);
            }
        },
        .ErrorSet => |es| if (es) |errors| {
            inline for (errors, 0..) |err_rec, index| {
                // get error from global set
                const err = @field(anyerror, err_rec.name);
                const slot = try getTypeSlot(host, Static, .{ .index = offset + index });
                try host.attachMember(structure, .{
                    .name = getCString(err_rec.name),
                    .member_type = .@"comptime",
                    .slot = slot,
                    .structure = structure,
                }, true);
                // can't use exportPointerTarget(), since each error in the set would be
                // considered a separate type--need special handling
                const value_obj = try exportError(host, err, structure);
                template_maybe = template_maybe orelse try host.createTemplate(null);
                try host.writeSlot(template_maybe.?, slot, value_obj);
            }
        },
        else => {},
    }
    if (template_maybe) |template| {
        try host.attachTemplate(structure, template, true);
    }
}

fn hasUnsupported(comptime params: []const std.builtin.Type.Fn.Param) bool {
    return inline for (params) |param| {
        if (param.type) |T| {
            if (T != std.mem.Allocator and !isSupported(T)) {
                break true;
            }
        } else {
            break true;
        }
    } else false;
}

test "hasUnsupported" {
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
    assert(hasUnsupported(@typeInfo(@TypeOf(Test.needFn)).Fn.params) == true);
    assert(hasUnsupported(@typeInfo(@TypeOf(Test.needOptionalFn)).Fn.params) == true);
    assert(hasUnsupported(@typeInfo(@TypeOf(Test.nothing)).Fn.params) == false);
    assert(hasUnsupported(@typeInfo(@TypeOf(Test.allocate)).Fn.params) == false);
    assert(hasUnsupported(@typeInfo(@TypeOf(std.debug.print)).Fn.params) == true);
}

fn addMethods(host: anytype, structure: Value, comptime T: type) !void {
    if (host.options.omit_methods) {
        return;
    }
    return switch (@typeInfo(T)) {
        inline .Struct, .Union, .Enum, .Opaque => |st| {
            inline for (st.decls) |decl| {
                switch (@typeInfo(@TypeOf(@field(T, decl.name)))) {
                    .Fn => |f| {
                        if (comptime f.is_generic or f.is_var_args) {
                            continue;
                        }
                        if (comptime hasUnsupported(f.params)) {
                            continue;
                        }
                        if (f.return_type) |RT| {
                            if (comptime !isSupported(RT)) {
                                continue;
                            }
                        }
                        const function = @field(T, decl.name);
                        const ArgT = ArgumentStruct(function, @TypeOf(function));
                        const arg_structure = try getStructure(host, ArgT);
                        const is_static_only = static: {
                            if (f.params.len > 0) {
                                if (f.params[0].type) |ParamT| {
                                    if (ParamT == T or ParamT == *const T or ParamT == *T) {
                                        break :static false;
                                    }
                                }
                            }
                            break :static true;
                        };
                        try host.attachMethod(structure, .{
                            .name = getCString(decl.name),
                            .thunk_id = @intFromPtr(createThunk(@TypeOf(host), function, ArgT)),
                            .structure = arg_structure,
                        }, is_static_only);
                    },
                    else => {},
                }
            }
        },
        else => {},
    };
}

// pass function itself so the name appears in the type name and the function type so that
// the type name will be unique
fn ArgumentStruct(comptime _: anytype, comptime T: type) type {
    const info = @typeInfo(T).Fn;
    const count = get: {
        var count = 1;
        for (info.params) |param| {
            if (param.type != std.mem.Allocator) {
                count += 1;
            }
        }
        break :get count;
    };
    var fields: [count]std.builtin.Type.StructField = undefined;
    var index = 0;
    for (info.params) |param| {
        if (param.type != std.mem.Allocator) {
            const name = std.fmt.comptimePrint("{d}", .{index});
            fields[index] = .{
                .name = name,
                .type = param.type orelse void,
                .is_comptime = false,
                .alignment = @alignOf(param.type orelse void),
                .default_value = null,
            };
            index += 1;
        }
    }
    fields[index] = .{
        .name = "retval",
        .type = info.return_type orelse void,
        .is_comptime = false,
        .alignment = @alignOf(info.return_type orelse void),
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
    const ArgA = ArgumentStruct(Test.A, @TypeOf(Test.A));
    const fieldsA = std.meta.fields(ArgA);
    assert(fieldsA.len == 3);
    assert(fieldsA[0].name[0] == '0');
    assert(fieldsA[1].name[0] == '1');
    assert(fieldsA[2].name[0] == 'r');
    const ArgB = ArgumentStruct(Test.B, @TypeOf(Test.B));
    const fieldsB = std.meta.fields(ArgB);
    assert(fieldsB.len == 2);
    assert(fieldsB[0].name[0] == '0');
    assert(fieldsB[1].name[0] == 'r');
    const ArgC = ArgumentStruct(Test.C, @TypeOf(Test.C));
    const fieldsC = std.meta.fields(ArgC);
    assert(fieldsC.len == 3);
}

fn findPrefix(comptime name: []const u8, comptime prefix: []const u8) bool {
    if (name.len < prefix.len) {
        return false;
    }
    inline for (prefix, 0..) |c, index| {
        if (name[index] != c) {
            return false;
        }
    }
    return true;
}

fn findIndex(comptime name: []const u8, comptime c: u8, comptime start: usize) usize {
    comptime var index = start;
    inline while (index < name.len) : (index += 1) {
        if (name[index] == c) {
            break;
        }
    }
    return index;
}

fn getFunctionName(comptime T: type) ?[]const u8 {
    const name = @typeName(T);
    const prefix = "exporter.ArgumentStruct((function '";
    if (comptime findPrefix(name, prefix)) {
        const start = prefix.len;
        const end = findIndex(name, '\'', start);
        return name[start..end];
    }
    return null;
}

test "getFunctionName" {
    const Test = struct {
        fn A(a: i32, b: bool) bool {
            return if (a > 10 and b) true else false;
        }

        fn @"weird name  "() void {}
    };
    const ArgA = ArgumentStruct(Test.A, @TypeOf(Test.A));
    const name_a = getFunctionName(ArgA) orelse "";
    assert(name_a[0] == 'A');
    assert(name_a.len == 1);
    const ArgWeird = ArgumentStruct(Test.@"weird name  ", @TypeOf(Test.@"weird name  "));
    const name_weird = getFunctionName(ArgWeird) orelse "";
    assert(name_weird[0] == 'w');
    assert(name_weird.len == 12);
}

fn isArgumentStruct(comptime T: type) bool {
    return if (getFunctionName(T)) |_| true else false;
}

test "isArgumentStruct" {
    const Test = struct {
        fn A(a: i32, b: bool) bool {
            return if (a > 10 and b) true else false;
        }
    };
    const ArgA = ArgumentStruct(Test.A, @TypeOf(Test.A));
    assert(isArgumentStruct(ArgA) == true);
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
    const memory = toMemory(err_name, true);
    return host.captureString(memory);
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
    const ArgA = ArgumentStruct(Test.A, @TypeOf(Test.A));
    const Host = @import("./exporter-c.zig").Host;
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

pub fn createRootFactory(comptime HostT: type, comptime T: type) Thunk {
    const RootFactory = struct {
        fn exportStructure(ptr: *anyopaque, arg_ptr: *anyopaque) callconv(.C) ?Value {
            const host = HostT.init(ptr, arg_ptr);
            defer host.release();
            if (getStructure(host, T)) |_| {
                return null;
            } else |err| {
                return createErrorMessage(host, err) catch null;
            }
        }
    };
    return RootFactory.exportStructure;
}
