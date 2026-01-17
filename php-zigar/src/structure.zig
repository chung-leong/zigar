const std = @import("std");

const byte_buffer = @import("byte-buffer.zig");
const ByteBuffer = byte_buffer.ByteBuffer;
const php = @import("php.zig");
const Value = php.Value;
const Object = php.Object;
const String = php.String;
const HashTable = php.HashTable;
pub const ArgStruct = @import("structure/arg-struct.zig").ArgStruct;
pub const Array = @import("structure/array.zig").Array;
pub const Enum = @import("structure/enum.zig").Enum;
pub const ErrorSet = @import("structure/error-set.zig").ErrorSet;
pub const ErrorUnion = @import("structure/error-union.zig").ErrorUnion;
pub const Function = @import("structure/function.zig").Function;
pub const Opaque = @import("structure/opaque.zig").Opaque;
pub const Optional = @import("structure/optional.zig").Optional;
pub const Pointer = @import("structure/pointer.zig").Pointer;
pub const Primitive = @import("structure/primitive.zig").Primitive;
pub const Slice = @import("structure/slice.zig").Slice;
pub const Static = @import("structure/static.zig").Static;
pub const Struct = @import("structure/struct.zig").Struct;
pub const Union = @import("structure/union.zig").Union;
pub const VariadicStruct = @import("structure/variadic-struct.zig").VariadicStruct;
pub const Vector = @import("structure/vector.zig").Vector;
const zig_class = @import("zig-class.zig");
const ZigClass = zig_class.ZigClass;
const zig_object = @import("zig-object.zig");
const ZigObject = zig_object.ZigObject;

pub const by_enum = .{
    .primitive = Primitive,
    .array = Array,
    .@"struct" = Struct,
    .@"union" = Union,
    .error_union = ErrorUnion,
    .error_set = ErrorSet,
    .@"enum" = Enum,
    .optional = Optional,
    .pointer = Pointer,
    .slice = Slice,
    .vector = Vector,
    .@"opaque" = Opaque,
    .arg_struct = ArgStruct,
    .variadic_struct = VariadicStruct,
    .function = Function,
};

pub fn enumName(comptime S: type) []const u8 {
    return inline for (comptime std.meta.fields(@TypeOf(by_enum))) |field| {
        if (@field(by_enum, field.name) == S) break field.name;
    } else @compileError("Recognized structure type: " ++ @typeName(S));
}

pub fn Parent(comptime S: type) type {
    return struct {
        const scope: ZigClass.ScopeType = if (@hasDecl(S, "scope")) S.scope else .instance;

        pub fn setStorage(self: *S, bytes: *ByteBuffer, slots: ?*HashTable) !void {
            if (@hasField(S, "bytes")) self.bytes = bytes;
            if (@hasField(S, "slots")) self.slots = slots;
        }

        pub fn getValue(self: *S) !Value {
            // by default just return the object itself
            return php.createValueObject(object(self));
        }

        pub fn freeObject(obj: *Object) void {
            const self = fromObject(obj);
            const class = ZigClass.fromObject(obj);
            if (@hasField(S, "bytes")) self.bytes.release();
            if (@hasField(S, "slots")) if (self.slots) |ht| php.release(ht);
            class.release();
        }

        pub fn readProperty(obj: *Object, name: *String, prop_type: c_int, cache_slot: ?[*]?*anyopaque, retval: *Value) *Value {
            _ = prop_type;
            if (tryReadProperty(obj, name, cache_slot)) |value| {
                retval.* = value;
                php.addRef(retval);
            } else |err| {
                throwFieldError(obj, name, err);
            }
            return retval;
        }

        pub fn tryReadProperty(obj: *Object, name: *String, cache_slot: ?[*]?*anyopaque) !Value {
            _ = cache_slot;
            const self = fromObject(obj);
            if (@hasDecl(S, "getValue")) {
                // see if it's call from an accessor
                if (name == zig_object.dollar_sign) return try self.getValue();
            }
            const class = ZigClass.fromObject(obj);
            if (class.getMember(scope, name)) |member| {
                switch (member.accessors) {
                    .primitive => |acc| if (@hasField(S, "bytes"))
                        return try acc.get(self.bytes),
                    .object => |acc| if (@hasField(S, "bytes") and @hasField(S, "slots")) {
                        if (self.slots) |slots| {
                            // TODO switch to pointer
                            const value = try acc.get(self.bytes, slots);
                            return value;
                        }
                    },
                    .prebaked => |acc| if (@hasField(S, "slots")) {
                        if (self.slots) |slots| {
                            const value = try acc.get(slots);
                            return value;
                        }
                    },
                    else => {},
                }
                return error.InvalidOperation;
            } else |err| {
                if (@hasDecl(S, "getValue")) {
                    // maybe the end-user is accessing $ property
                    if (zig_object.isDollarSign(name)) return try self.getValue();
                }
                return err;
            }
        }

        pub fn writeProperty(obj: *Object, name: *String, value: *Value, cache_slot: ?[*]?*anyopaque) *Value {
            tryWriteProperty(obj, name, value, cache_slot) catch |err| {
                throwFieldError(obj, name, err);
            };
            return value;
        }

        pub fn tryWriteProperty(obj: *Object, name: *String, value: *Value, cache_slot: ?[*]?*anyopaque) !void {
            _ = cache_slot;
            const self = fromObject(obj);
            if (@hasDecl(S, "setValue")) {
                // check for access from accessors
                if (name == zig_object.dollar_sign)
                    return try self.setValue(value);
            }
            // find member
            const class = ZigClass.fromObject(obj);
            if (class.getMember(scope, name)) |member| {
                // write to bytes and/or slots using setter
                switch (member.accessors) {
                    .primitive => |acc| if (@hasField(S, "bytes"))
                        return try acc.set(self.bytes, value),
                    .object => |acc| if (@hasField(S, "bytes") and @hasField(S, "slots")) {
                        if (self.slots) |slots|
                            return try acc.set(self.bytes, slots, value);
                    },
                    .prebaked => |acc| if (@hasField(S, "slots")) {
                        if (self.slots) |slots| {
                            return try acc.set(slots, value);
                        }
                    },
                    else => {},
                }
                return error.InvalidOperation;
            } else |err| {
                if (@hasDecl(S, "setValue")) {
                    // maybe the end-user is accessing $ property
                    if (zig_object.isDollarSign(name)) return try self.setValue(value);
                }
                return err;
            }
        }

        fn throwFieldError(obj: *Object, name: *String, err: anytype) void {
            switch (err) {
                error.Missing => {
                    const class = ZigClass.fromObject(obj);
                    const class_name = class.getName();
                    const field_name = php.getStringContent(name);
                    const type_name = class.getStructureName();
                    if (scope == .instance) {
                        php.throwExceptionFmt("no field named '{s}' in {s} '{s}'", .{
                            field_name,
                            type_name,
                            class_name,
                        });
                    } else {
                        php.throwExceptionFmt("{s} '{s}' has no member named '{s}'", .{
                            type_name,
                            class_name,
                            field_name,
                        });
                    }
                },
                else => php.throwError(err),
            }
        }

        pub fn fromObject(obj: *Object) *S {
            return &ZigObject(S).fromObject(obj).zig_portion;
        }

        pub fn object(self: *S) *Object {
            return &ZigObject(S).fromStructure(self).php_portion;
        }
    };
}
