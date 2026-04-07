const std = @import("std");

pub const Boolean = @import("accessor/boolean.zig").Boolean;
pub const Constant = @import("accessor/constant.zig").Constant;
pub const Float = @import("accessor/float.zig").Float;
pub const Gmp = @import("accessor/gmp.zig").Gmp;
pub const Inaccessible = @import("accessor/inaccessible.zig").Inaccessible;
pub const Int = @import("accessor/int.zig").Int;
pub const Null = @import("accessor/null.zig").Null;
pub const Property = @import("accessor/property.zig").Property;
pub const Slot = @import("accessor/slot.zig").Slot;
pub const Vector = @import("accessor/vector.zig").Vector;
pub const Void = @import("accessor/void.zig").Void;
const ByteBuffer = @import("buffer.zig").ByteBuffer;
const php = @import("php.zig");
const HashTable = php.HashTable;
const Object = php.Object;
const Value = php.Value;
const structure = @import("structure.zig");
const invokeMethod = structure.invokeMethod;
const ZigClassEntry = @import("class-entry.zig").ZigClassEntry;
const ZigObject = @import("object.zig").ZigObject;

pub const FieldAccess = enum { read, write };
pub const Error = error{
    AccessingDeallocatedMemory,
    CannotCreateObject,
    ExceptionThrown,
    Failure,
    Inaccessible,
    IntegerOverflow,
    InvalidOperation,
    InvalidType,
    LengthMismatch,
    Missing,
    NegativeIndex,
    NotAbortSignal,
    NotAllocator,
    NotArray,
    NotArrayOrObject,
    NotBoolean,
    NotCallable,
    NotDouble,
    NotFound,
    NotInteger,
    NotNull,
    NotObject,
    NotPointer,
    NotString,
    NotTheSame,
    NullPointer,
    KeyIsNotInteger,
    KeyIsNotString,
    OutOfBound,
    OutOfMemory,
    ReadOnlyProperty,
    Unexpected,
    Unsupported,
    WriteOnly,
    WriteProtected,
};
pub const Type = enum {
    void,
    bool,
    int,
    gmp,
    float,
    slot,
    vector,
    constant,
    null,
    property,
    inaccessible,
};

pub const ObjectTransform = enum {
    to_string,
    to_integer,
    to_plain,
    to_value,
    to_bytes,

    pub fn apply(self: @This(), value: *Value) Error!void {
        if (php.getType(value) == .object) {
            const obj = php.getValueObject(value) catch unreachable;
            if (ZigClassEntry.isZig(obj.ce) or ZigClassEntry.isZigError(obj.ce)) {
                defer php.release(obj);
                value.* = try invokeMethod(obj, "getValue", .{self});
                return;
            } else if (php.isGMP(obj)) {
                // leave GMP object as is
                if (self == .to_integer) return;
            }
        }
        switch (self) {
            .to_string => try php.convertValue(value, .string),
            .to_integer => try php.convertValue(value, .long),
            .to_bytes => return error.Unsupported,
            else => {},
        }
    }
};

pub fn WithBitOffset(comptime T: type, comptime bit_offset: u3) type {
    const fields: [2]std.builtin.Type.StructField = .{
        .{
            .name = "padding",
            .type = @Type(.{
                .int = .{ .bits = bit_offset, .signedness = .unsigned },
            }),
            .alignment = 0,
            .default_value_ptr = null,
            .is_comptime = false,
        },
        .{
            .name = "value",
            .type = T,
            .alignment = 0,
            .default_value_ptr = null,
            .is_comptime = false,
        },
    };
    return @Type(.{
        .@"struct" = .{
            .layout = .@"packed",
            .decls = &.{},
            .fields = &fields,
            .is_tuple = false,
        },
    });
}

pub fn getOpaqueTarget(comptime T: type, value: *const Value) !*T {
    const obj = php.getValueObject(value) catch unreachable;
    const class = ZigClassEntry.fromObject(obj);
    if (class.type != .slice) {
        return error.NotOpaque;
    }
    const slice_struct = ZigObject(structure.Slice).fromObject(obj).structure();
    if (@intFromPtr(slice_struct.buffer.bytes.ptr) == 0) return error.NullPointer;
    return @ptrCast(@alignCast(slice_struct.buffer.bytes.ptr));
}

pub const Any = union(enum) {
    pub fn getType(self: @This()) Type {
        @setEvalBranchQuota(2000000);
        return switch (self) {
            inline else => |acc| {
                return acc.type;
            },
        };
    }

    pub fn get(self: @This(), source: anytype) !Value {
        @setEvalBranchQuota(2000000);
        const S = @TypeOf(source.*);
        return switch (self) {
            inline else => |acc| {
                const A = @TypeOf(acc);
                if (S == ByteBuffer) @compileError("Calling accessor with buffer");
                const args = try comptime validate(S, A, "get");
                // const arg_count = switch (args) {
                //     .both => 3,
                //     .buffer => 2,
                //     .table => 2,
                //     .none => 1,
                // };
                // if (@typeInfo(@TypeOf(A.get)).@"fn".params.len != arg_count) {
                //     @compileError(std.fmt.comptimePrint("Incorrect argument count for {}.get(): passing {d} to {}", .{
                //         A,
                //         arg_count,
                //         @TypeOf(A.get),
                //     }));
                // }
                return switch (args) {
                    .both => try acc.get(source.buffer, &source.table),
                    .buffer => try acc.get(source.buffer),
                    .table => try acc.get(&source.table),
                    .none => try acc.get(),
                    .object => try acc.get(ZigObject(S).fromStructure(source).object()),
                };
            },
        };
    }

    pub fn set(self: @This(), source: anytype, value: *const Value) !void {
        @setEvalBranchQuota(2000000);
        const S = @TypeOf(source.*);
        return switch (self) {
            inline else => |acc| {
                const A = @TypeOf(acc);
                if (S == ByteBuffer) @compileError("Calling accessor with buffer");
                const args = try comptime validate(S, A, "set");
                // const arg_count = switch (args) {
                //     .both => 4,
                //     .buffer => 3,
                //     .table => 3,
                //     .none => 2,
                // };
                // if (@typeInfo(@TypeOf(A.set)).@"fn".params.len != arg_count) {
                //     @compileError(std.fmt.comptimePrint("Incorrect argument count for {}.set(): passing {d} to {}", .{
                //         A,
                //         arg_count,
                //         @TypeOf(A.set),
                //     }));
                // }
                return switch (args) {
                    .both => try acc.set(source.buffer, &source.table, value),
                    .buffer => try acc.set(source.buffer, value),
                    .table => try acc.set(&source.table, value),
                    .object => try acc.set(ZigObject(S).fromStructure(source).object(), value),
                    .none => try acc.set(value),
                };
            },
        };
    }

    pub fn getElement(self: @This(), source: anytype, index: usize) !Value {
        @setEvalBranchQuota(2000000);
        const S = @TypeOf(source.*);
        return switch (self) {
            inline else => |acc| {
                const A = @TypeOf(acc);
                if (S == ByteBuffer) @compileError("Calling accessor with buffer");
                const args = try comptime validate(S, A, "getElement");
                // const arg_count = switch (args) {
                //     .both => 4,
                //     .buffer => 3,
                //     .table => 3,
                //     .none => 2,
                // };
                // if (@typeInfo(@TypeOf(A.getElement)).@"fn".params.len != arg_count) {
                //     @compileError(std.fmt.comptimePrint("Incorrect argument count for {}.getElement(): passing {d} to {}", .{
                //         A,
                //         arg_count,
                //         @TypeOf(A.getElement),
                //     }));
                // }
                return switch (args) {
                    .both => try acc.getElement(source.buffer, &source.table, index),
                    .buffer => try acc.getElement(source.buffer, index),
                    .table => try acc.getElement(&source.table, index),
                    .object => try acc.getElement(ZigObject(S).fromStructure(source).object(), index),
                    .none => try acc.getElement(index),
                };
            },
        };
    }

    pub fn setElement(self: @This(), source: anytype, index: usize, value: *const Value) !void {
        @setEvalBranchQuota(2000000);
        const S = @TypeOf(source.*);
        return switch (self) {
            inline else => |acc| {
                const A = @TypeOf(acc);
                if (S == ByteBuffer) @compileError("Calling accessor with buffer");
                const args = try comptime validate(S, A, "setElement");
                // const arg_count = switch (args) {
                //     .both => 5,
                //     .buffer => 4,
                //     .table => 4,
                //     .none => 3,
                // };
                // if (@typeInfo(@TypeOf(A.setElement)).@"fn".params.len != arg_count) {
                //     @compileError(std.fmt.comptimePrint("Incorrect argument count for {}.setElement(): passing {d} to {}", .{
                //         A,
                //         arg_count,
                //         @TypeOf(A.setElement),
                //     }));
                // }
                return switch (args) {
                    .both => try acc.setElement(source.buffer, &source.table, index, value),
                    .buffer => try acc.setElement(source.buffer, index, value),
                    .table => try acc.setElement(&source.table, index, value),
                    .object => try acc.setElement(ZigObject(S).fromStructure(source).object(), index, value),
                    .none => try acc.setElement(index, value),
                };
            },
        };
    }

    pub fn getObject(self: @This(), comptime T: type, source: anytype) !*T {
        const value = try self.get(source);
        const obj = php.getValueObject(&value) catch unreachable;
        return ZigObject(T).fromObject(obj).structure();
    }

    pub fn isType(self: @This(), comptime accessor_type: Type) bool {
        @setEvalBranchQuota(2000000);
        return switch (self) {
            inline else => |acc| acc.type == accessor_type,
        };
    }

    fn hasArg(comptime A: type, comptime method: []const u8, comptime T: type) bool {
        const func = @field(A, method);
        const F = @TypeOf(func);
        return inline for (@typeInfo(F).@"fn".params) |param| {
            if (param.type == T) break true;
        } else false;
    }

    fn validate(comptime S: type, comptime A: type, comptime method: []const u8) !enum {
        both,
        buffer,
        table,
        object,
        none,
    } {
        if (!@hasDecl(A, method)) return error.InvalidOperation;
        const need_object = hasArg(A, method, *Object);
        if (need_object and !@hasDecl(S, "setStorage")) return error.InvalidOperation;
        const need_buffer = hasArg(A, method, *ByteBuffer);
        const need_table = hasArg(A, method, *Value);
        if (need_buffer and !@hasField(S, "buffer")) return error.InvalidOperation;
        if (need_table and !@hasField(S, "table")) return error.InvalidOperation;
        return switch (need_buffer) {
            true => switch (need_table) {
                true => .both,
                false => .buffer,
            },
            false => switch (need_table) {
                true => .table,
                false => switch (need_object) {
                    true => .object,
                    false => .none,
                },
            },
        };
    }

    // object
    multi_slot: Slot(.{}),
    single_slot: Slot(.{ .slots = .single }),
    array_slot: Slot(.{ .index = .use }),
    multi_slot_prebaked: Slot(.{ .prebaked = true }),
    single_slot_prebaked: Slot(.{ .slots = .single, .prebaked = true }),
    constant: Constant,
    property: Property,
    // null and void
    null: Null,
    void: Void,
    // scalar
    bool: Boolean(.{}),
    i8: Int(.{ .bit_size = 8, .signedness = .signed }),
    i16: Int(.{ .bit_size = 16, .signedness = .signed }),
    i32: Int(.{ .bit_size = 32, .signedness = .signed }),
    i64: Int(.{ .bit_size = 64, .signedness = .signed }),
    u8: Int(.{ .bit_size = 8, .signedness = .unsigned }),
    u16: Int(.{ .bit_size = 16, .signedness = .unsigned }),
    u32: Int(.{ .bit_size = 32, .signedness = .unsigned }),
    u64: Int(.{ .bit_size = 64, .signedness = .unsigned }),
    f16: Float(.{ .bit_size = 16 }),
    f32: Float(.{ .bit_size = 32 }),
    f64: Float(.{ .bit_size = 64 }),
    f80: Float(.{ .bit_size = 80 }),
    f128: Float(.{ .bit_size = 128 }),
    // vector
    bool_vec: Vector(.{ .bool = .{} }),
    u8_vec: Vector(.{ .int = .{ .bit_size = 8, .signedness = .unsigned } }),
    u16_vec: Vector(.{ .int = .{ .bit_size = 16, .signedness = .unsigned } }),
    u32_vec: Vector(.{ .int = .{ .bit_size = 32, .signedness = .unsigned } }),
    u64_vec: Vector(.{ .int = .{ .bit_size = 64, .signedness = .unsigned } }),
    i8_vec: Vector(.{ .int = .{ .bit_size = 8, .signedness = .signed } }),
    i16_vec: Vector(.{ .int = .{ .bit_size = 16, .signedness = .signed } }),
    i32_vec: Vector(.{ .int = .{ .bit_size = 32, .signedness = .signed } }),
    i64_vec: Vector(.{ .int = .{ .bit_size = 64, .signedness = .signed } }),
    f16_vec: Vector(.{ .float = .{ .bit_size = 16 } }),
    f32_vec: Vector(.{ .float = .{ .bit_size = 32 } }),
    f64_vec: Vector(.{ .float = .{ .bit_size = 64 } }),
    f80_vec: Vector(.{ .float = .{ .bit_size = 80 } }),
    f128_vec: Vector(.{ .float = .{ .bit_size = 128 } }),
    // non-standard int
    u0: Int(.{ .bit_size = 0, .signedness = .unsigned }),
    u1: Int(.{ .bit_size = 1, .signedness = .unsigned }),
    u2: Int(.{ .bit_size = 2, .signedness = .unsigned }),
    u3: Int(.{ .bit_size = 3, .signedness = .unsigned }),
    u4: Int(.{ .bit_size = 4, .signedness = .unsigned }),
    u5: Int(.{ .bit_size = 5, .signedness = .unsigned }),
    u6: Int(.{ .bit_size = 6, .signedness = .unsigned }),
    u7: Int(.{ .bit_size = 7, .signedness = .unsigned }),
    u9: Int(.{ .bit_size = 9, .signedness = .unsigned }),
    u10: Int(.{ .bit_size = 10, .signedness = .unsigned }),
    u11: Int(.{ .bit_size = 11, .signedness = .unsigned }),
    u12: Int(.{ .bit_size = 12, .signedness = .unsigned }),
    u13: Int(.{ .bit_size = 13, .signedness = .unsigned }),
    u14: Int(.{ .bit_size = 14, .signedness = .unsigned }),
    u15: Int(.{ .bit_size = 15, .signedness = .unsigned }),
    u17: Int(.{ .bit_size = 17, .signedness = .unsigned }),
    u18: Int(.{ .bit_size = 18, .signedness = .unsigned }),
    u19: Int(.{ .bit_size = 19, .signedness = .unsigned }),
    u20: Int(.{ .bit_size = 20, .signedness = .unsigned }),
    u21: Int(.{ .bit_size = 21, .signedness = .unsigned }),
    u22: Int(.{ .bit_size = 22, .signedness = .unsigned }),
    u23: Int(.{ .bit_size = 23, .signedness = .unsigned }),
    u24: Int(.{ .bit_size = 24, .signedness = .unsigned }),
    u25: Int(.{ .bit_size = 25, .signedness = .unsigned }),
    u26: Int(.{ .bit_size = 26, .signedness = .unsigned }),
    u27: Int(.{ .bit_size = 27, .signedness = .unsigned }),
    u28: Int(.{ .bit_size = 28, .signedness = .unsigned }),
    u29: Int(.{ .bit_size = 29, .signedness = .unsigned }),
    u30: Int(.{ .bit_size = 30, .signedness = .unsigned }),
    u31: Int(.{ .bit_size = 31, .signedness = .unsigned }),
    u33: Int(.{ .bit_size = 33, .signedness = .unsigned }),
    u34: Int(.{ .bit_size = 34, .signedness = .unsigned }),
    u35: Int(.{ .bit_size = 35, .signedness = .unsigned }),
    u36: Int(.{ .bit_size = 36, .signedness = .unsigned }),
    u37: Int(.{ .bit_size = 37, .signedness = .unsigned }),
    u38: Int(.{ .bit_size = 38, .signedness = .unsigned }),
    u39: Int(.{ .bit_size = 39, .signedness = .unsigned }),
    u40: Int(.{ .bit_size = 40, .signedness = .unsigned }),
    u41: Int(.{ .bit_size = 41, .signedness = .unsigned }),
    u42: Int(.{ .bit_size = 42, .signedness = .unsigned }),
    u43: Int(.{ .bit_size = 43, .signedness = .unsigned }),
    u44: Int(.{ .bit_size = 44, .signedness = .unsigned }),
    u45: Int(.{ .bit_size = 45, .signedness = .unsigned }),
    u46: Int(.{ .bit_size = 46, .signedness = .unsigned }),
    u47: Int(.{ .bit_size = 47, .signedness = .unsigned }),
    u48: Int(.{ .bit_size = 48, .signedness = .unsigned }),
    u49: Int(.{ .bit_size = 49, .signedness = .unsigned }),
    u50: Int(.{ .bit_size = 50, .signedness = .unsigned }),
    u51: Int(.{ .bit_size = 51, .signedness = .unsigned }),
    u52: Int(.{ .bit_size = 52, .signedness = .unsigned }),
    u53: Int(.{ .bit_size = 53, .signedness = .unsigned }),
    u54: Int(.{ .bit_size = 54, .signedness = .unsigned }),
    u55: Int(.{ .bit_size = 55, .signedness = .unsigned }),
    u56: Int(.{ .bit_size = 56, .signedness = .unsigned }),
    u57: Int(.{ .bit_size = 57, .signedness = .unsigned }),
    u58: Int(.{ .bit_size = 58, .signedness = .unsigned }),
    u59: Int(.{ .bit_size = 59, .signedness = .unsigned }),
    u60: Int(.{ .bit_size = 60, .signedness = .unsigned }),
    u61: Int(.{ .bit_size = 61, .signedness = .unsigned }),
    u62: Int(.{ .bit_size = 62, .signedness = .unsigned }),
    u63: Int(.{ .bit_size = 63, .signedness = .unsigned }),
    i0: Int(.{ .bit_size = 0, .signedness = .signed }),
    i1: Int(.{ .bit_size = 1, .signedness = .signed }),
    i2: Int(.{ .bit_size = 2, .signedness = .signed }),
    i3: Int(.{ .bit_size = 3, .signedness = .signed }),
    i4: Int(.{ .bit_size = 4, .signedness = .signed }),
    i5: Int(.{ .bit_size = 5, .signedness = .signed }),
    i6: Int(.{ .bit_size = 6, .signedness = .signed }),
    i7: Int(.{ .bit_size = 7, .signedness = .signed }),
    i9: Int(.{ .bit_size = 9, .signedness = .signed }),
    i10: Int(.{ .bit_size = 10, .signedness = .signed }),
    i11: Int(.{ .bit_size = 11, .signedness = .signed }),
    i12: Int(.{ .bit_size = 12, .signedness = .signed }),
    i13: Int(.{ .bit_size = 13, .signedness = .signed }),
    i14: Int(.{ .bit_size = 14, .signedness = .signed }),
    i15: Int(.{ .bit_size = 15, .signedness = .signed }),
    i17: Int(.{ .bit_size = 17, .signedness = .signed }),
    i18: Int(.{ .bit_size = 18, .signedness = .signed }),
    i19: Int(.{ .bit_size = 19, .signedness = .signed }),
    i20: Int(.{ .bit_size = 20, .signedness = .signed }),
    i21: Int(.{ .bit_size = 21, .signedness = .signed }),
    i22: Int(.{ .bit_size = 22, .signedness = .signed }),
    i23: Int(.{ .bit_size = 23, .signedness = .signed }),
    i24: Int(.{ .bit_size = 24, .signedness = .signed }),
    i25: Int(.{ .bit_size = 25, .signedness = .signed }),
    i26: Int(.{ .bit_size = 26, .signedness = .signed }),
    i27: Int(.{ .bit_size = 27, .signedness = .signed }),
    i28: Int(.{ .bit_size = 28, .signedness = .signed }),
    i29: Int(.{ .bit_size = 29, .signedness = .signed }),
    i30: Int(.{ .bit_size = 30, .signedness = .signed }),
    i31: Int(.{ .bit_size = 31, .signedness = .signed }),
    i33: Int(.{ .bit_size = 33, .signedness = .signed }),
    i34: Int(.{ .bit_size = 34, .signedness = .signed }),
    i35: Int(.{ .bit_size = 35, .signedness = .signed }),
    i36: Int(.{ .bit_size = 36, .signedness = .signed }),
    i37: Int(.{ .bit_size = 37, .signedness = .signed }),
    i38: Int(.{ .bit_size = 38, .signedness = .signed }),
    i39: Int(.{ .bit_size = 39, .signedness = .signed }),
    i40: Int(.{ .bit_size = 40, .signedness = .signed }),
    i41: Int(.{ .bit_size = 41, .signedness = .signed }),
    i42: Int(.{ .bit_size = 42, .signedness = .signed }),
    i43: Int(.{ .bit_size = 43, .signedness = .signed }),
    i44: Int(.{ .bit_size = 44, .signedness = .signed }),
    i45: Int(.{ .bit_size = 45, .signedness = .signed }),
    i46: Int(.{ .bit_size = 46, .signedness = .signed }),
    i47: Int(.{ .bit_size = 47, .signedness = .signed }),
    i48: Int(.{ .bit_size = 48, .signedness = .signed }),
    i49: Int(.{ .bit_size = 49, .signedness = .signed }),
    i50: Int(.{ .bit_size = 50, .signedness = .signed }),
    i51: Int(.{ .bit_size = 51, .signedness = .signed }),
    i52: Int(.{ .bit_size = 52, .signedness = .signed }),
    i53: Int(.{ .bit_size = 53, .signedness = .signed }),
    i54: Int(.{ .bit_size = 54, .signedness = .signed }),
    i55: Int(.{ .bit_size = 55, .signedness = .signed }),
    i56: Int(.{ .bit_size = 56, .signedness = .signed }),
    i57: Int(.{ .bit_size = 57, .signedness = .signed }),
    i58: Int(.{ .bit_size = 58, .signedness = .signed }),
    i59: Int(.{ .bit_size = 59, .signedness = .signed }),
    i60: Int(.{ .bit_size = 60, .signedness = .signed }),
    i61: Int(.{ .bit_size = 61, .signedness = .signed }),
    i62: Int(.{ .bit_size = 62, .signedness = .signed }),
    i63: Int(.{ .bit_size = 63, .signedness = .signed }),
    big_int: Gmp(.{ .signedness = .signed }),
    big_uint: Gmp(.{ .signedness = .unsigned }),
    u0_vec: Vector(.{ .int = .{ .bit_size = 0, .signedness = .unsigned } }),
    u1_vec: Vector(.{ .int = .{ .bit_size = 1, .signedness = .unsigned } }),
    u2_vec: Vector(.{ .int = .{ .bit_size = 2, .signedness = .unsigned } }),
    u3_vec: Vector(.{ .int = .{ .bit_size = 3, .signedness = .unsigned } }),
    u4_vec: Vector(.{ .int = .{ .bit_size = 4, .signedness = .unsigned } }),
    u5_vec: Vector(.{ .int = .{ .bit_size = 5, .signedness = .unsigned } }),
    u6_vec: Vector(.{ .int = .{ .bit_size = 6, .signedness = .unsigned } }),
    u7_vec: Vector(.{ .int = .{ .bit_size = 7, .signedness = .unsigned } }),
    u9_vec: Vector(.{ .int = .{ .bit_size = 9, .signedness = .unsigned } }),
    u10_vec: Vector(.{ .int = .{ .bit_size = 10, .signedness = .unsigned } }),
    u11_vec: Vector(.{ .int = .{ .bit_size = 11, .signedness = .unsigned } }),
    u12_vec: Vector(.{ .int = .{ .bit_size = 12, .signedness = .unsigned } }),
    u13_vec: Vector(.{ .int = .{ .bit_size = 13, .signedness = .unsigned } }),
    u14_vec: Vector(.{ .int = .{ .bit_size = 14, .signedness = .unsigned } }),
    u15_vec: Vector(.{ .int = .{ .bit_size = 15, .signedness = .unsigned } }),
    u17_vec: Vector(.{ .int = .{ .bit_size = 17, .signedness = .unsigned } }),
    u18_vec: Vector(.{ .int = .{ .bit_size = 18, .signedness = .unsigned } }),
    u19_vec: Vector(.{ .int = .{ .bit_size = 19, .signedness = .unsigned } }),
    u20_vec: Vector(.{ .int = .{ .bit_size = 20, .signedness = .unsigned } }),
    u21_vec: Vector(.{ .int = .{ .bit_size = 21, .signedness = .unsigned } }),
    u22_vec: Vector(.{ .int = .{ .bit_size = 22, .signedness = .unsigned } }),
    u23_vec: Vector(.{ .int = .{ .bit_size = 23, .signedness = .unsigned } }),
    u24_vec: Vector(.{ .int = .{ .bit_size = 24, .signedness = .unsigned } }),
    u25_vec: Vector(.{ .int = .{ .bit_size = 25, .signedness = .unsigned } }),
    u26_vec: Vector(.{ .int = .{ .bit_size = 26, .signedness = .unsigned } }),
    u27_vec: Vector(.{ .int = .{ .bit_size = 27, .signedness = .unsigned } }),
    u28_vec: Vector(.{ .int = .{ .bit_size = 28, .signedness = .unsigned } }),
    u29_vec: Vector(.{ .int = .{ .bit_size = 29, .signedness = .unsigned } }),
    u30_vec: Vector(.{ .int = .{ .bit_size = 30, .signedness = .unsigned } }),
    u31_vec: Vector(.{ .int = .{ .bit_size = 31, .signedness = .unsigned } }),
    u33_vec: Vector(.{ .int = .{ .bit_size = 33, .signedness = .unsigned } }),
    u34_vec: Vector(.{ .int = .{ .bit_size = 34, .signedness = .unsigned } }),
    u35_vec: Vector(.{ .int = .{ .bit_size = 35, .signedness = .unsigned } }),
    u36_vec: Vector(.{ .int = .{ .bit_size = 36, .signedness = .unsigned } }),
    u37_vec: Vector(.{ .int = .{ .bit_size = 37, .signedness = .unsigned } }),
    u38_vec: Vector(.{ .int = .{ .bit_size = 38, .signedness = .unsigned } }),
    u39_vec: Vector(.{ .int = .{ .bit_size = 39, .signedness = .unsigned } }),
    u40_vec: Vector(.{ .int = .{ .bit_size = 40, .signedness = .unsigned } }),
    u41_vec: Vector(.{ .int = .{ .bit_size = 41, .signedness = .unsigned } }),
    u42_vec: Vector(.{ .int = .{ .bit_size = 42, .signedness = .unsigned } }),
    u43_vec: Vector(.{ .int = .{ .bit_size = 43, .signedness = .unsigned } }),
    u44_vec: Vector(.{ .int = .{ .bit_size = 44, .signedness = .unsigned } }),
    u45_vec: Vector(.{ .int = .{ .bit_size = 45, .signedness = .unsigned } }),
    u46_vec: Vector(.{ .int = .{ .bit_size = 46, .signedness = .unsigned } }),
    u47_vec: Vector(.{ .int = .{ .bit_size = 47, .signedness = .unsigned } }),
    u48_vec: Vector(.{ .int = .{ .bit_size = 48, .signedness = .unsigned } }),
    u49_vec: Vector(.{ .int = .{ .bit_size = 49, .signedness = .unsigned } }),
    u50_vec: Vector(.{ .int = .{ .bit_size = 50, .signedness = .unsigned } }),
    u51_vec: Vector(.{ .int = .{ .bit_size = 51, .signedness = .unsigned } }),
    u52_vec: Vector(.{ .int = .{ .bit_size = 52, .signedness = .unsigned } }),
    u53_vec: Vector(.{ .int = .{ .bit_size = 53, .signedness = .unsigned } }),
    u54_vec: Vector(.{ .int = .{ .bit_size = 54, .signedness = .unsigned } }),
    u55_vec: Vector(.{ .int = .{ .bit_size = 55, .signedness = .unsigned } }),
    u56_vec: Vector(.{ .int = .{ .bit_size = 56, .signedness = .unsigned } }),
    u57_vec: Vector(.{ .int = .{ .bit_size = 57, .signedness = .unsigned } }),
    u58_vec: Vector(.{ .int = .{ .bit_size = 58, .signedness = .unsigned } }),
    u59_vec: Vector(.{ .int = .{ .bit_size = 59, .signedness = .unsigned } }),
    u60_vec: Vector(.{ .int = .{ .bit_size = 60, .signedness = .unsigned } }),
    u61_vec: Vector(.{ .int = .{ .bit_size = 61, .signedness = .unsigned } }),
    u62_vec: Vector(.{ .int = .{ .bit_size = 62, .signedness = .unsigned } }),
    u63_vec: Vector(.{ .int = .{ .bit_size = 63, .signedness = .unsigned } }),
    i0_vec: Vector(.{ .int = .{ .bit_size = 0, .signedness = .signed } }),
    i1_vec: Vector(.{ .int = .{ .bit_size = 1, .signedness = .signed } }),
    i2_vec: Vector(.{ .int = .{ .bit_size = 2, .signedness = .signed } }),
    i3_vec: Vector(.{ .int = .{ .bit_size = 3, .signedness = .signed } }),
    i4_vec: Vector(.{ .int = .{ .bit_size = 4, .signedness = .signed } }),
    i5_vec: Vector(.{ .int = .{ .bit_size = 5, .signedness = .signed } }),
    i6_vec: Vector(.{ .int = .{ .bit_size = 6, .signedness = .signed } }),
    i7_vec: Vector(.{ .int = .{ .bit_size = 7, .signedness = .signed } }),
    i9_vec: Vector(.{ .int = .{ .bit_size = 9, .signedness = .signed } }),
    i10_vec: Vector(.{ .int = .{ .bit_size = 10, .signedness = .signed } }),
    i11_vec: Vector(.{ .int = .{ .bit_size = 11, .signedness = .signed } }),
    i12_vec: Vector(.{ .int = .{ .bit_size = 12, .signedness = .signed } }),
    i13_vec: Vector(.{ .int = .{ .bit_size = 13, .signedness = .signed } }),
    i14_vec: Vector(.{ .int = .{ .bit_size = 14, .signedness = .signed } }),
    i15_vec: Vector(.{ .int = .{ .bit_size = 15, .signedness = .signed } }),
    i17_vec: Vector(.{ .int = .{ .bit_size = 17, .signedness = .signed } }),
    i18_vec: Vector(.{ .int = .{ .bit_size = 18, .signedness = .signed } }),
    i19_vec: Vector(.{ .int = .{ .bit_size = 19, .signedness = .signed } }),
    i20_vec: Vector(.{ .int = .{ .bit_size = 20, .signedness = .signed } }),
    i21_vec: Vector(.{ .int = .{ .bit_size = 21, .signedness = .signed } }),
    i22_vec: Vector(.{ .int = .{ .bit_size = 22, .signedness = .signed } }),
    i23_vec: Vector(.{ .int = .{ .bit_size = 23, .signedness = .signed } }),
    i24_vec: Vector(.{ .int = .{ .bit_size = 24, .signedness = .signed } }),
    i25_vec: Vector(.{ .int = .{ .bit_size = 25, .signedness = .signed } }),
    i26_vec: Vector(.{ .int = .{ .bit_size = 26, .signedness = .signed } }),
    i27_vec: Vector(.{ .int = .{ .bit_size = 27, .signedness = .signed } }),
    i28_vec: Vector(.{ .int = .{ .bit_size = 28, .signedness = .signed } }),
    i29_vec: Vector(.{ .int = .{ .bit_size = 29, .signedness = .signed } }),
    i30_vec: Vector(.{ .int = .{ .bit_size = 30, .signedness = .signed } }),
    i31_vec: Vector(.{ .int = .{ .bit_size = 31, .signedness = .signed } }),
    i33_vec: Vector(.{ .int = .{ .bit_size = 33, .signedness = .signed } }),
    i34_vec: Vector(.{ .int = .{ .bit_size = 34, .signedness = .signed } }),
    i35_vec: Vector(.{ .int = .{ .bit_size = 35, .signedness = .signed } }),
    i36_vec: Vector(.{ .int = .{ .bit_size = 36, .signedness = .signed } }),
    i37_vec: Vector(.{ .int = .{ .bit_size = 37, .signedness = .signed } }),
    i38_vec: Vector(.{ .int = .{ .bit_size = 38, .signedness = .signed } }),
    i39_vec: Vector(.{ .int = .{ .bit_size = 39, .signedness = .signed } }),
    i40_vec: Vector(.{ .int = .{ .bit_size = 40, .signedness = .signed } }),
    i41_vec: Vector(.{ .int = .{ .bit_size = 41, .signedness = .signed } }),
    i42_vec: Vector(.{ .int = .{ .bit_size = 42, .signedness = .signed } }),
    i43_vec: Vector(.{ .int = .{ .bit_size = 43, .signedness = .signed } }),
    i44_vec: Vector(.{ .int = .{ .bit_size = 44, .signedness = .signed } }),
    i45_vec: Vector(.{ .int = .{ .bit_size = 45, .signedness = .signed } }),
    i46_vec: Vector(.{ .int = .{ .bit_size = 46, .signedness = .signed } }),
    i47_vec: Vector(.{ .int = .{ .bit_size = 47, .signedness = .signed } }),
    i48_vec: Vector(.{ .int = .{ .bit_size = 48, .signedness = .signed } }),
    i49_vec: Vector(.{ .int = .{ .bit_size = 49, .signedness = .signed } }),
    i50_vec: Vector(.{ .int = .{ .bit_size = 50, .signedness = .signed } }),
    i51_vec: Vector(.{ .int = .{ .bit_size = 51, .signedness = .signed } }),
    i52_vec: Vector(.{ .int = .{ .bit_size = 52, .signedness = .signed } }),
    i53_vec: Vector(.{ .int = .{ .bit_size = 53, .signedness = .signed } }),
    i54_vec: Vector(.{ .int = .{ .bit_size = 54, .signedness = .signed } }),
    i55_vec: Vector(.{ .int = .{ .bit_size = 55, .signedness = .signed } }),
    i56_vec: Vector(.{ .int = .{ .bit_size = 56, .signedness = .signed } }),
    i57_vec: Vector(.{ .int = .{ .bit_size = 57, .signedness = .signed } }),
    i58_vec: Vector(.{ .int = .{ .bit_size = 58, .signedness = .signed } }),
    i59_vec: Vector(.{ .int = .{ .bit_size = 59, .signedness = .signed } }),
    i60_vec: Vector(.{ .int = .{ .bit_size = 60, .signedness = .signed } }),
    i61_vec: Vector(.{ .int = .{ .bit_size = 61, .signedness = .signed } }),
    i62_vec: Vector(.{ .int = .{ .bit_size = 62, .signedness = .signed } }),
    i63_vec: Vector(.{ .int = .{ .bit_size = 63, .signedness = .signed } }),
    big_int_vec: Vector(.{ .gmp = .{ .signedness = .signed } }),
    big_uint_vec: Vector(.{ .gmp = .{ .signedness = .unsigned } }),
    // bit offset
    bool_bo: Boolean(.{ .use_bit_offset = true }),
    u0_bo: Int(.{ .bit_size = 0, .signedness = .unsigned, .use_bit_offset = true }),
    u1_bo: Int(.{ .bit_size = 1, .signedness = .unsigned, .use_bit_offset = true }),
    u2_bo: Int(.{ .bit_size = 2, .signedness = .unsigned, .use_bit_offset = true }),
    u3_bo: Int(.{ .bit_size = 3, .signedness = .unsigned, .use_bit_offset = true }),
    u4_bo: Int(.{ .bit_size = 4, .signedness = .unsigned, .use_bit_offset = true }),
    u5_bo: Int(.{ .bit_size = 5, .signedness = .unsigned, .use_bit_offset = true }),
    u6_bo: Int(.{ .bit_size = 6, .signedness = .unsigned, .use_bit_offset = true }),
    u7_bo: Int(.{ .bit_size = 7, .signedness = .unsigned, .use_bit_offset = true }),
    u8_bo: Int(.{ .bit_size = 8, .signedness = .unsigned, .use_bit_offset = true }),
    u9_bo: Int(.{ .bit_size = 9, .signedness = .unsigned, .use_bit_offset = true }),
    u10_bo: Int(.{ .bit_size = 10, .signedness = .unsigned, .use_bit_offset = true }),
    u11_bo: Int(.{ .bit_size = 11, .signedness = .unsigned, .use_bit_offset = true }),
    u12_bo: Int(.{ .bit_size = 12, .signedness = .unsigned, .use_bit_offset = true }),
    u13_bo: Int(.{ .bit_size = 13, .signedness = .unsigned, .use_bit_offset = true }),
    u14_bo: Int(.{ .bit_size = 14, .signedness = .unsigned, .use_bit_offset = true }),
    u15_bo: Int(.{ .bit_size = 15, .signedness = .unsigned, .use_bit_offset = true }),
    u16_bo: Int(.{ .bit_size = 16, .signedness = .unsigned, .use_bit_offset = true }),
    u17_bo: Int(.{ .bit_size = 17, .signedness = .unsigned, .use_bit_offset = true }),
    u18_bo: Int(.{ .bit_size = 18, .signedness = .unsigned, .use_bit_offset = true }),
    u19_bo: Int(.{ .bit_size = 19, .signedness = .unsigned, .use_bit_offset = true }),
    u20_bo: Int(.{ .bit_size = 20, .signedness = .unsigned, .use_bit_offset = true }),
    u21_bo: Int(.{ .bit_size = 21, .signedness = .unsigned, .use_bit_offset = true }),
    u22_bo: Int(.{ .bit_size = 22, .signedness = .unsigned, .use_bit_offset = true }),
    u23_bo: Int(.{ .bit_size = 23, .signedness = .unsigned, .use_bit_offset = true }),
    u24_bo: Int(.{ .bit_size = 24, .signedness = .unsigned, .use_bit_offset = true }),
    u25_bo: Int(.{ .bit_size = 25, .signedness = .unsigned, .use_bit_offset = true }),
    u26_bo: Int(.{ .bit_size = 26, .signedness = .unsigned, .use_bit_offset = true }),
    u27_bo: Int(.{ .bit_size = 27, .signedness = .unsigned, .use_bit_offset = true }),
    u28_bo: Int(.{ .bit_size = 28, .signedness = .unsigned, .use_bit_offset = true }),
    u29_bo: Int(.{ .bit_size = 29, .signedness = .unsigned, .use_bit_offset = true }),
    u30_bo: Int(.{ .bit_size = 30, .signedness = .unsigned, .use_bit_offset = true }),
    u31_bo: Int(.{ .bit_size = 31, .signedness = .unsigned, .use_bit_offset = true }),
    u32_bo: Int(.{ .bit_size = 32, .signedness = .unsigned, .use_bit_offset = true }),
    u33_bo: Int(.{ .bit_size = 33, .signedness = .unsigned, .use_bit_offset = true }),
    u34_bo: Int(.{ .bit_size = 34, .signedness = .unsigned, .use_bit_offset = true }),
    u35_bo: Int(.{ .bit_size = 35, .signedness = .unsigned, .use_bit_offset = true }),
    u36_bo: Int(.{ .bit_size = 36, .signedness = .unsigned, .use_bit_offset = true }),
    u37_bo: Int(.{ .bit_size = 37, .signedness = .unsigned, .use_bit_offset = true }),
    u38_bo: Int(.{ .bit_size = 38, .signedness = .unsigned, .use_bit_offset = true }),
    u39_bo: Int(.{ .bit_size = 39, .signedness = .unsigned, .use_bit_offset = true }),
    u40_bo: Int(.{ .bit_size = 40, .signedness = .unsigned, .use_bit_offset = true }),
    u41_bo: Int(.{ .bit_size = 41, .signedness = .unsigned, .use_bit_offset = true }),
    u42_bo: Int(.{ .bit_size = 42, .signedness = .unsigned, .use_bit_offset = true }),
    u43_bo: Int(.{ .bit_size = 43, .signedness = .unsigned, .use_bit_offset = true }),
    u44_bo: Int(.{ .bit_size = 44, .signedness = .unsigned, .use_bit_offset = true }),
    u45_bo: Int(.{ .bit_size = 45, .signedness = .unsigned, .use_bit_offset = true }),
    u46_bo: Int(.{ .bit_size = 46, .signedness = .unsigned, .use_bit_offset = true }),
    u47_bo: Int(.{ .bit_size = 47, .signedness = .unsigned, .use_bit_offset = true }),
    u48_bo: Int(.{ .bit_size = 48, .signedness = .unsigned, .use_bit_offset = true }),
    u49_bo: Int(.{ .bit_size = 49, .signedness = .unsigned, .use_bit_offset = true }),
    u50_bo: Int(.{ .bit_size = 50, .signedness = .unsigned, .use_bit_offset = true }),
    u51_bo: Int(.{ .bit_size = 51, .signedness = .unsigned, .use_bit_offset = true }),
    u52_bo: Int(.{ .bit_size = 52, .signedness = .unsigned, .use_bit_offset = true }),
    u53_bo: Int(.{ .bit_size = 53, .signedness = .unsigned, .use_bit_offset = true }),
    u54_bo: Int(.{ .bit_size = 54, .signedness = .unsigned, .use_bit_offset = true }),
    u55_bo: Int(.{ .bit_size = 55, .signedness = .unsigned, .use_bit_offset = true }),
    u56_bo: Int(.{ .bit_size = 56, .signedness = .unsigned, .use_bit_offset = true }),
    u57_bo: Int(.{ .bit_size = 57, .signedness = .unsigned, .use_bit_offset = true }),
    u58_bo: Int(.{ .bit_size = 58, .signedness = .unsigned, .use_bit_offset = true }),
    u59_bo: Int(.{ .bit_size = 59, .signedness = .unsigned, .use_bit_offset = true }),
    u60_bo: Int(.{ .bit_size = 60, .signedness = .unsigned, .use_bit_offset = true }),
    u61_bo: Int(.{ .bit_size = 61, .signedness = .unsigned, .use_bit_offset = true }),
    u62_bo: Int(.{ .bit_size = 62, .signedness = .unsigned, .use_bit_offset = true }),
    u63_bo: Int(.{ .bit_size = 63, .signedness = .unsigned, .use_bit_offset = true }),
    u64_bo: Int(.{ .bit_size = 64, .signedness = .unsigned, .use_bit_offset = true }),
    i0_bo: Int(.{ .bit_size = 0, .signedness = .signed, .use_bit_offset = true }),
    i1_bo: Int(.{ .bit_size = 1, .signedness = .signed, .use_bit_offset = true }),
    i2_bo: Int(.{ .bit_size = 2, .signedness = .signed, .use_bit_offset = true }),
    i3_bo: Int(.{ .bit_size = 3, .signedness = .signed, .use_bit_offset = true }),
    i4_bo: Int(.{ .bit_size = 4, .signedness = .signed, .use_bit_offset = true }),
    i5_bo: Int(.{ .bit_size = 5, .signedness = .signed, .use_bit_offset = true }),
    i6_bo: Int(.{ .bit_size = 6, .signedness = .signed, .use_bit_offset = true }),
    i7_bo: Int(.{ .bit_size = 7, .signedness = .signed, .use_bit_offset = true }),
    i8_bo: Int(.{ .bit_size = 8, .signedness = .signed, .use_bit_offset = true }),
    i9_bo: Int(.{ .bit_size = 9, .signedness = .signed, .use_bit_offset = true }),
    i10_bo: Int(.{ .bit_size = 10, .signedness = .signed, .use_bit_offset = true }),
    i11_bo: Int(.{ .bit_size = 11, .signedness = .signed, .use_bit_offset = true }),
    i12_bo: Int(.{ .bit_size = 12, .signedness = .signed, .use_bit_offset = true }),
    i13_bo: Int(.{ .bit_size = 13, .signedness = .signed, .use_bit_offset = true }),
    i14_bo: Int(.{ .bit_size = 14, .signedness = .signed, .use_bit_offset = true }),
    i15_bo: Int(.{ .bit_size = 15, .signedness = .signed, .use_bit_offset = true }),
    i16_bo: Int(.{ .bit_size = 16, .signedness = .signed, .use_bit_offset = true }),
    i17_bo: Int(.{ .bit_size = 17, .signedness = .signed, .use_bit_offset = true }),
    i18_bo: Int(.{ .bit_size = 18, .signedness = .signed, .use_bit_offset = true }),
    i19_bo: Int(.{ .bit_size = 19, .signedness = .signed, .use_bit_offset = true }),
    i20_bo: Int(.{ .bit_size = 20, .signedness = .signed, .use_bit_offset = true }),
    i21_bo: Int(.{ .bit_size = 21, .signedness = .signed, .use_bit_offset = true }),
    i22_bo: Int(.{ .bit_size = 22, .signedness = .signed, .use_bit_offset = true }),
    i23_bo: Int(.{ .bit_size = 23, .signedness = .signed, .use_bit_offset = true }),
    i24_bo: Int(.{ .bit_size = 24, .signedness = .signed, .use_bit_offset = true }),
    i25_bo: Int(.{ .bit_size = 25, .signedness = .signed, .use_bit_offset = true }),
    i26_bo: Int(.{ .bit_size = 26, .signedness = .signed, .use_bit_offset = true }),
    i27_bo: Int(.{ .bit_size = 27, .signedness = .signed, .use_bit_offset = true }),
    i28_bo: Int(.{ .bit_size = 28, .signedness = .signed, .use_bit_offset = true }),
    i29_bo: Int(.{ .bit_size = 29, .signedness = .signed, .use_bit_offset = true }),
    i30_bo: Int(.{ .bit_size = 30, .signedness = .signed, .use_bit_offset = true }),
    i31_bo: Int(.{ .bit_size = 31, .signedness = .signed, .use_bit_offset = true }),
    i32_bo: Int(.{ .bit_size = 32, .signedness = .signed, .use_bit_offset = true }),
    i33_bo: Int(.{ .bit_size = 33, .signedness = .signed, .use_bit_offset = true }),
    i34_bo: Int(.{ .bit_size = 34, .signedness = .signed, .use_bit_offset = true }),
    i35_bo: Int(.{ .bit_size = 35, .signedness = .signed, .use_bit_offset = true }),
    i36_bo: Int(.{ .bit_size = 36, .signedness = .signed, .use_bit_offset = true }),
    i37_bo: Int(.{ .bit_size = 37, .signedness = .signed, .use_bit_offset = true }),
    i38_bo: Int(.{ .bit_size = 38, .signedness = .signed, .use_bit_offset = true }),
    i39_bo: Int(.{ .bit_size = 39, .signedness = .signed, .use_bit_offset = true }),
    i40_bo: Int(.{ .bit_size = 40, .signedness = .signed, .use_bit_offset = true }),
    i41_bo: Int(.{ .bit_size = 41, .signedness = .signed, .use_bit_offset = true }),
    i42_bo: Int(.{ .bit_size = 42, .signedness = .signed, .use_bit_offset = true }),
    i43_bo: Int(.{ .bit_size = 43, .signedness = .signed, .use_bit_offset = true }),
    i44_bo: Int(.{ .bit_size = 44, .signedness = .signed, .use_bit_offset = true }),
    i45_bo: Int(.{ .bit_size = 45, .signedness = .signed, .use_bit_offset = true }),
    i46_bo: Int(.{ .bit_size = 46, .signedness = .signed, .use_bit_offset = true }),
    i47_bo: Int(.{ .bit_size = 47, .signedness = .signed, .use_bit_offset = true }),
    i48_bo: Int(.{ .bit_size = 48, .signedness = .signed, .use_bit_offset = true }),
    i49_bo: Int(.{ .bit_size = 49, .signedness = .signed, .use_bit_offset = true }),
    i50_bo: Int(.{ .bit_size = 50, .signedness = .signed, .use_bit_offset = true }),
    i51_bo: Int(.{ .bit_size = 51, .signedness = .signed, .use_bit_offset = true }),
    i52_bo: Int(.{ .bit_size = 52, .signedness = .signed, .use_bit_offset = true }),
    i53_bo: Int(.{ .bit_size = 53, .signedness = .signed, .use_bit_offset = true }),
    i54_bo: Int(.{ .bit_size = 54, .signedness = .signed, .use_bit_offset = true }),
    i55_bo: Int(.{ .bit_size = 55, .signedness = .signed, .use_bit_offset = true }),
    i56_bo: Int(.{ .bit_size = 56, .signedness = .signed, .use_bit_offset = true }),
    i57_bo: Int(.{ .bit_size = 57, .signedness = .signed, .use_bit_offset = true }),
    i58_bo: Int(.{ .bit_size = 58, .signedness = .signed, .use_bit_offset = true }),
    i59_bo: Int(.{ .bit_size = 59, .signedness = .signed, .use_bit_offset = true }),
    i60_bo: Int(.{ .bit_size = 60, .signedness = .signed, .use_bit_offset = true }),
    i61_bo: Int(.{ .bit_size = 61, .signedness = .signed, .use_bit_offset = true }),
    i62_bo: Int(.{ .bit_size = 62, .signedness = .signed, .use_bit_offset = true }),
    i63_bo: Int(.{ .bit_size = 63, .signedness = .signed, .use_bit_offset = true }),
    i64_bo: Int(.{ .bit_size = 64, .signedness = .signed, .use_bit_offset = true }),
    f16_bo: Float(.{ .bit_size = 16, .use_bit_offset = true }),
    f32_bo: Float(.{ .bit_size = 32, .use_bit_offset = true }),
    f64_bo: Float(.{ .bit_size = 64, .use_bit_offset = true }),
    f80_bo: Float(.{ .bit_size = 80, .use_bit_offset = true }),
    f128_bo: Float(.{ .bit_size = 128, .use_bit_offset = true }),
    big_int_bo: Gmp(.{ .signedness = .signed, .use_bit_offset = true }),
    big_uint_bo: Gmp(.{ .signedness = .unsigned, .use_bit_offset = true }),
    inaccessible: Inaccessible,
};
