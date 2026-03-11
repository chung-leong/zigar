const std = @import("std");

pub const boolean = @import("accessor/boolean.zig");
pub const float = @import("accessor/float.zig");
pub const gmp = @import("accessor/gmp.zig");
pub const int = @import("accessor/int.zig");
pub const @"null" = @import("accessor/null.zig");
pub const slot = @import("accessor/slot.zig");
pub const vector = @import("accessor/vector.zig");
pub const @"void" = @import("accessor/void.zig");
const ByteBuffer = @import("buffer.zig").ByteBuffer;
const php = @import("php.zig");
const HashTable = php.HashTable;
const Value = php.Value;
const structure = @import("structure.zig");
const invokeMethod = structure.invokeMethod;
const ZigClassEntry = @import("class-entry.zig").ZigClassEntry;
const ZigObject = @import("object.zig").ZigObject;

pub const Error = error{
    CannotCreateObject,
    ExceptionThrown,
    Failure,
    IntegerOverflow,
    InvalidOperation,
    InvalidType,
    LengthMismatch,
    Missing,
    NegativeIndex,
    NotArray,
    NotArrayOrObject,
    NotBoolean,
    NotCallable,
    NotDouble,
    NotFound,
    NotInteger,
    NotNull,
    NotObject,
    NotString,
    NotTheSame,
    KeyIsNotInteger,
    KeyIsNotString,
    OutOfBound,
    OutOfMemory,
    ReadOnlyProperty,
    Unexpected,
    Unsupported,
    WriteProtected,
};

pub const Null = struct {
    params: Parameters,
    getter: *const Getter,
    setter: *const Setter,

    pub const Parameters = struct {};
    pub const Getter = fn (*const @This()) Error!Value;
    pub const Setter = fn (*const @This(), *const Value) Error!void;

    pub fn get(self: *const @This()) Error!Value {
        return try self.getter(self);
    }

    pub fn set(self: *const @This(), value: *const Value) Error!void {
        return try self.setter(self, value);
    }
};

pub const PrimitiveTransform = struct {
    class: *ZigClassEntry,

    pub fn toValue(self: *const @This(), value: *const Value) Error!Value {
        inline for (.{ .@"enum", .error_set }) |object_type| {
            if (self.class.type == object_type) {
                const S = @field(structure.by_enum, @tagName(object_type));
                const static = self.class.getStaticData(S);
                return static.findCanonical(value);
            }
        } else unreachable;
    }

    pub fn fromValue(self: *const @This(), value: *const Value) Error!*ByteBuffer {
        inline for (.{ .@"enum", .error_set }) |t| {
            if (self.class.type == t) {
                const S = @field(structure.by_enum, @tagName(t));
                const static = self.class.getStaticData(S);
                return static.findCanonicalBytes(value);
            }
        } else unreachable;
    }
};

pub const Primitive = struct {
    params: Parameters,
    getter: *const Getter,
    setter: *const Setter,

    pub const Parameters = struct {
        byte_offset: usize,
        bit_size: usize = 0,
        transform: ?PrimitiveTransform = null,
    };
    pub const Getter = fn (*const @This(), *ByteBuffer) Error!Value;
    pub const Setter = fn (*const @This(), *ByteBuffer, *const Value) Error!void;

    pub fn get(self: *const @This(), buffer: *ByteBuffer) Error!Value {
        return try self.getter(self, buffer);
    }

    pub fn set(self: *const @This(), buffer: *ByteBuffer, value: *const Value) Error!void {
        return try self.setter(self, buffer, value);
    }

    pub fn transform(self: *const @This(), new_transform: ?PrimitiveTransform) @This() {
        var copy = self.*;
        copy.params.transform = new_transform;
        return copy;
    }
};

pub const Vector = struct {
    params: Parameters,
    getter: *const Getter,
    setter: *const Setter,

    pub const Parameters = struct {
        bit_size: usize = 0,
        transform: ?PrimitiveTransform = null,
    };
    pub const Getter = fn (*const @This(), *ByteBuffer, usize) Error!Value;
    pub const Setter = fn (*const @This(), *ByteBuffer, usize, *const Value) Error!void;

    pub fn get(self: *const @This(), buffer: *ByteBuffer, index: usize) Error!Value {
        return try self.getter(self, buffer, index);
    }

    pub fn set(self: *const @This(), buffer: *ByteBuffer, index: usize, value: *const Value) Error!void {
        return try self.setter(self, buffer, index, value);
    }

    pub fn transform(self: *const @This(), new_transform: ?ObjectTransform) @This() {
        var copy = self.*;
        copy.params.transform = new_transform;
        return copy;
    }
};

pub const SlotAccessorType = enum { multi_slot, single_slot, multi_slot_prebaked, single_slot_prebaked, array_slot };

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
                value.* = try invokeMethod(obj, "readSelf", .{self});
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

    pub fn fromPropName(name: *const php.String) ?@This() {
        const transforms = .{
            .__plain = .to_plain,
            .__value = .to_value,
            .__string = .to_string,
            .__int = .to_integer,
            .__bytes = .to_bytes,
        };
        return inline for (std.meta.fields(@TypeOf(transforms))) |field| {
            if (php.matchString(name, field.name)) break @field(transforms, field.name);
        } else null;
    }
};

pub const MultiSlot = struct {
    params: Parameters,
    getter: *const Getter,
    setter: *const Setter,

    pub const Parameters = struct {
        byte_offset: usize = undefined,
        byte_size: usize,
        slot: usize,
        class: *ZigClassEntry,
    };
    pub const Getter = fn (*const @This(), *ByteBuffer, *Value) Error!Value;
    pub const Setter = fn (*const @This(), *ByteBuffer, *Value, *const Value) Error!void;

    pub fn get(self: *const @This(), buffer: *ByteBuffer, slots: *Value) Error!Value {
        return try self.getter(self, buffer, slots);
    }

    pub fn set(self: *const @This(), buffer: *ByteBuffer, slots: *Value, value: *const Value) Error!void {
        return try self.setter(self, buffer, slots, value);
    }
};

pub const SingleSlot = struct {
    params: Parameters,
    getter: *const Getter,
    setter: *const Setter,

    pub const Parameters = struct {
        byte_offset: usize = undefined,
        byte_size: usize,
        class: *ZigClassEntry,
    };
    pub const Getter = fn (*const @This(), *ByteBuffer, *Value) Error!Value;
    pub const Setter = fn (*const @This(), *ByteBuffer, *Value, *const Value) Error!void;

    pub fn get(self: *const @This(), buffer: *ByteBuffer, slots: *Value) Error!Value {
        return try self.getter(self, buffer, slots);
    }

    pub fn set(self: *const @This(), buffer: *ByteBuffer, slots: *Value, value: *const Value) Error!void {
        return try self.setter(self, buffer, slots, value);
    }
};

pub const ArraySlot = struct {
    params: Parameters,
    getter: *const Getter,
    setter: *const Setter,

    pub const Parameters = struct {
        byte_size: usize,
        class: *ZigClassEntry,
    };
    pub const Getter = fn (*const @This(), *ByteBuffer, *Value, usize) Error!Value;
    pub const Setter = fn (*const @This(), *ByteBuffer, *Value, usize, *const Value) Error!void;

    pub fn get(self: *const @This(), buffer: *ByteBuffer, slots: *Value, index: usize) Error!Value {
        return try self.getter(self, buffer, slots, index);
    }

    pub fn set(self: *const @This(), buffer: *ByteBuffer, slots: *Value, index: usize, value: *const Value) Error!void {
        return try self.setter(self, buffer, slots, index, value);
    }
};

pub const MultiSlotPrebaked = struct {
    params: Parameters,
    getter: *const Getter,
    setter: *const Setter,

    pub const Parameters = struct {
        slot: usize,
    };
    pub const Getter = fn (*const @This(), *Value) Error!Value;
    pub const Setter = fn (*const @This(), *Value, *const Value) Error!void;

    pub fn get(self: *const @This(), slots: *Value) Error!Value {
        return try self.getter(self, slots);
    }

    pub fn set(self: *const @This(), slots: *Value, value: *const Value) Error!void {
        return try self.setter(self, slots, value);
    }
};

pub const SingleSlotPrebaked = struct {
    params: Parameters,
    getter: *const Getter,
    setter: *const Setter,

    pub const Parameters = struct {};
    pub const Getter = fn (*const @This(), *Value) Error!Value;
    pub const Setter = fn (*const @This(), *Value, *const Value) Error!void;

    pub fn get(self: *const @This(), slots: *Value) Error!Value {
        return try self.getter(self, slots);
    }

    pub fn set(self: *const @This(), slots: *Value, value: *const Value) Error!void {
        return try self.setter(self, slots, value);
    }
};

pub const Any = union(enum) {
    primitive: Primitive,
    vector: Vector,
    multi_slot: MultiSlot,
    single_slot: SingleSlot,
    array_slot: ArraySlot,
    multi_slot_prebaked: MultiSlotPrebaked,
    single_slot_prebaked: SingleSlotPrebaked,
    null: Null,
    missing: void,

    pub fn get(self: *const @This(), source: anytype) !Value {
        const S = @TypeOf(source.*);
        switch (self.*) {
            .primitive => |acc| if (@hasField(S, "bytes"))
                return try acc.get(source.bytes),
            inline .multi_slot, .single_slot => |acc| if (@hasField(S, "bytes") and @hasField(S, "slots"))
                return try acc.get(source.bytes, &source.slots),
            inline .multi_slot_prebaked, .single_slot_prebaked => |acc| if (@hasField(S, "slots"))
                return try acc.get(&source.slots),
            .null => |acc| return try acc.get(),
            else => {},
        }
        return error.InvalidOperation;
    }

    pub fn getElement(self: *const @This(), source: anytype, index: usize) !Value {
        const S = @TypeOf(source.*);
        switch (self.*) {
            .vector => |acc| if (@hasField(S, "bytes"))
                return try acc.get(source.bytes, index),
            .array_slot => |acc| if (@hasField(S, "bytes") and @hasField(S, "slots"))
                return try acc.get(source.bytes, &source.slots, index),
            .null => |acc| return try acc.get(),
            else => {},
        }
        return error.InvalidOperation;
    }

    pub fn set(self: *const @This(), source: anytype, value: *const Value) !void {
        const S = @TypeOf(source.*);
        switch (self.*) {
            .primitive => |acc| if (@hasField(S, "bytes"))
                return try acc.set(source.bytes, value),
            inline .multi_slot, .single_slot => |acc| if (@hasField(S, "bytes") and @hasField(S, "slots"))
                return try acc.set(source.bytes, &source.slots, value),
            inline .multi_slot_prebaked, .single_slot_prebaked => |acc| if (@hasField(S, "slots"))
                return try acc.set(&source.slots, value),
            .null => |acc| return try acc.set(value),
            else => {},
        }
        return error.InvalidOperation;
    }

    pub fn setElement(self: *const @This(), source: anytype, index: usize, value: *const Value) !void {
        const S = @TypeOf(source.*);
        switch (self.*) {
            .vector => |acc| if (@hasField(S, "bytes"))
                return try acc.set(source.bytes, index, value),
            .array_slot => |acc| if (@hasField(S, "bytes") and @hasField(S, "slots"))
                return try acc.set(source.bytes, &source.slots, index, value),
            .null => |acc| return try acc.set(value),
            else => {},
        }
        return error.InvalidOperation;
    }
};

pub fn WithBitOffset(comptime T: type, comptime bit_offset: ?u3) type {
    return if (bit_offset) |offset| define: {
        const fields: [2]std.builtin.Type.StructField = .{
            .{
                .name = "padding",
                .type = @Type(.{
                    .int = .{ .bits = offset, .signedness = .unsigned },
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
        break :define @Type(.{
            .@"struct" = .{
                .layout = .@"packed",
                .decls = &.{},
                .fields = &fields,
                .is_tuple = false,
            },
        });
    } else T;
}
