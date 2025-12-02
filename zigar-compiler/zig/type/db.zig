const std = @import("std");
const expect = std.testing.expect;
const expectEqual = std.testing.expectEqual;
const builtin = @import("builtin");

const fn_transform = @import("../zigft/fn-transform.zig");
const ArgStruct = @import("arg-struct.zig").ArgStruct;
const Sentinel = @import("slice.zig").Sentinel;
const Slice = @import("slice.zig").Slice;
const util = @import("util.zig");

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
                        const sentinel_ptr: *const pt.child = @ptrCast(@alignCast(ptr));
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
                        break :debug_tag util.IntFor(un.fields.len);
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
        return util.IteratorReturnValue(self.type) != null;
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

    pub fn isExpectingInstanceOf(comptime self: @This(), comptime T: type) bool {
        switch (@typeInfo(self.type)) {
            .@"fn" => |f| {
                if (f.params.len > 0) {
                    if (f.params[0].type) |PT| {
                        return PT == T;
                    }
                }
            },
            else => {},
        }
        return false;
    }

    test "isExpectingInstanceOf" {
        const A = struct {
            number: i32 = 0,

            fn a() void {}
            fn b(_: i32) void {}
            fn c(_: @This()) void {}
            fn d(_: *@This()) void {}
            fn e(_: *const @This()) void {}
        };
        const B = struct {};
        try expectEqual(false, isExpectingInstanceOf(.{ .type = @TypeOf(A.a) }, A));
        try expectEqual(false, isExpectingInstanceOf(.{ .type = @TypeOf(A.b) }, A));
        try expectEqual(true, isExpectingInstanceOf(.{ .type = @TypeOf(A.c) }, A));
        try expectEqual(false, isExpectingInstanceOf(.{ .type = @TypeOf(A.d) }, A));
        try expectEqual(false, isExpectingInstanceOf(.{ .type = @TypeOf(A.e) }, A));
        try expectEqual(false, isExpectingInstanceOf(.{ .type = @TypeOf(A.e) }, B));
        try expectEqual(false, isExpectingInstanceOf(.{ .type = u32 }, B));
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
                if (util.getInternalType(field.type)) |it| {
                    if (it == .promise or it == .generator) {
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
            std.fs.File, std.fs.Dir => true,
            else => util.getInternalType(self.type) != null,
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
                const ArgT = ArgStruct(T);
                self.append(.{
                    .type = ArgT,
                    .parent_type = T,
                    .attrs = .{
                        .is_arguments = true,
                        .is_variadic = f.is_var_args,
                    },
                });
                if (f.calling_convention == .@"inline") {
                    self.add(fn_transform.Uninlined(T));
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
            .comptime_int => self.add(*const util.IntFor(value)),
            .enum_literal => self.add(@TypeOf(util.removeSentinel(@tagName(value)))),
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
                td.attrs.is_supported = switch (td.type) {
                    std.Options => false,
                    else => true,
                };
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
        var xxhash = std.hash.XxHash64.init(0);
        switch (@typeInfo(td.type)) {
            .@"struct" => |st| {
                xxhash.update(switch (st.layout) {
                    .@"extern" => "extern struct",
                    .@"packed" => "packed struct",
                    else => "struct",
                });
                if (st.backing_integer) |BIT| {
                    xxhash.update("(");
                    xxhash.update(std.mem.asBytes(&self.getSignature(BIT)));
                    xxhash.update(")");
                }
                xxhash.update(" {");
                for (st.fields) |field| {
                    if (!field.is_comptime) {
                        xxhash.update(field.name);
                        xxhash.update(": ");
                        xxhash.update(std.mem.asBytes(&self.getSignature(field.type)));
                        if (field.alignment != @alignOf(field.type)) {
                            xxhash.update(std.fmt.comptimePrint(" align({d})\n", .{field.alignment}));
                        }
                        xxhash.update(", ");
                    }
                }
                xxhash.update("}");
            },
            .@"union" => |un| {
                xxhash.update(switch (un.layout) {
                    .@"extern" => "extern union",
                    else => "union",
                });
                if (un.tag_type) |TT| {
                    xxhash.update("(");
                    xxhash.update(std.mem.asBytes(&self.getSignature(TT)));
                    xxhash.update(")");
                }
                xxhash.update(" {");
                for (un.fields) |field| {
                    xxhash.update(field.name);
                    xxhash.update(": ");
                    xxhash.update(std.mem.asBytes(&self.getSignature(field.type)));
                    if (field.alignment != @alignOf(field.type)) {
                        xxhash.update(std.fmt.comptimePrint(" align({d})", .{field.alignment}));
                    }
                    xxhash.update(", ");
                }
                xxhash.update("}");
            },
            .array => |ar| {
                xxhash.update(std.fmt.comptimePrint("[{d}]", .{ar.len}));
                xxhash.update(std.mem.asBytes(&self.getSignature(ar.child)));
            },
            .vector => |ar| {
                xxhash.update(std.fmt.comptimePrint("@Vector({d}, ", .{ar.len}));
                xxhash.update(std.mem.asBytes(&self.getSignature(ar.child)));
                xxhash.update(")");
            },
            .optional => |op| {
                xxhash.update("?");
                xxhash.update(std.mem.asBytes(&self.getSignature(op.child)));
            },
            .error_union => |eu| {
                xxhash.update(std.mem.asBytes(&self.getSignature(eu.error_set)));
                xxhash.update("!");
                xxhash.update(std.mem.asBytes(&self.getSignature(eu.payload)));
            },
            .error_set => |es| {
                if (td.type == anyerror) {
                    xxhash.update("anyerror");
                } else {
                    xxhash.update("error{");
                    if (es) |errors| {
                        inline for (errors) |err| {
                            xxhash.update(err.name);
                            xxhash.update(",");
                        }
                    }
                    xxhash.update("}");
                }
            },
            .pointer => |pt| {
                xxhash.update(switch (pt.size) {
                    .one => "*",
                    .many => "[*",
                    .slice => "[",
                    .c => "[*c",
                });
                if (pt.sentinel_ptr) |ptr| {
                    const value = @as(*const pt.child, @ptrCast(@alignCast(ptr))).*;
                    xxhash.update(std.fmt.comptimePrint(":{d}", .{value}));
                }
                xxhash.update(switch (pt.size) {
                    .one => "",
                    else => "]",
                });
                if (pt.is_const) {
                    xxhash.update("const ");
                }
                if (pt.is_allowzero) {
                    xxhash.update("allowzero ");
                }
                xxhash.update(std.mem.asBytes(&self.getSignature(pt.child)));
            },
            .@"fn" => |f| {
                xxhash.update("fn (");
                for (f.params) |param| {
                    if (param.is_noalias) {
                        xxhash.update("noalias ");
                    }
                    if (param.type) |PT| {
                        xxhash.update(std.mem.asBytes(&self.getSignature(PT)));
                    } else {
                        xxhash.update("anytype");
                    }
                    xxhash.update(", ");
                }
                if (f.is_var_args) {
                    xxhash.update("...");
                }
                xxhash.update(") ");
                if (f.calling_convention != .auto) {
                    xxhash.update("callconv(.");
                    xxhash.update(@tagName(f.calling_convention));
                    xxhash.update(") ");
                }
                if (f.return_type) |RT| {
                    xxhash.update(std.mem.asBytes(&self.getSignature(RT)));
                }
            },
            else => xxhash.update(@typeName(td.type)),
        }
        td.signature = xxhash.final();
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

test {
    _ = TypeData;
    _ = TypeDataCollector;
}

const ErrorInt = @Int(.unsigned, @bitSizeOf(anyerror));

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

const runtime_safety = (builtin.mode == .ReleaseSafe or builtin.mode == .Debug);
