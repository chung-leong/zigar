const std = @import("std");

const accessor = @import("accessor.zig");
const byte_buffer = @import("byte-buffer.zig");
const ByteBuffer = byte_buffer.ByteBuffer;
const php = @import("php.zig");
const ClassEntry = php.ClassEntry;
const HashTable = php.HashTable;
const HashPosition = php.HashPosition;
const Object = php.Object;
const String = php.String;
const Value = php.Value;
pub const ArgStruct = @import("structure/arg-struct.zig").ArgStruct;
pub const Array = @import("structure/array.zig").Array;
pub const Comptime = @import("structure/comptime.zig").Comptime;
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
    .@"comptime" = Comptime,
};
pub const RefStatus = packed struct {
    checked: bool = false,
    broken: bool = false,
};

pub fn enumName(comptime S: type) []const u8 {
    return inline for (comptime std.meta.fields(@TypeOf(by_enum))) |field| {
        if (@field(by_enum, field.name) == S) break field.name;
    } else @compileError("Unrecognized structure type: " ++ @typeName(S));
}

pub fn Parent(comptime S: type) type {
    return struct {
        const scope: ZigClass.ScopeType = if (@hasDecl(S, "scope")) S.scope else .instance;
        const CacheEntry = extern struct {
            class: ?*const ZigClass,
            accessors: *const accessor.Any,
        };

        pub fn setStorage(self: *S, bytes: *ByteBuffer, slots: *const Value) !void {
            if (@hasField(S, "bytes")) {
                self.bytes = bytes;
                self.bytes.addRef();
            }
            if (@hasField(S, "slots")) {
                const class = ZigClass.fromStructure(self);
                self.slots = switch (class.getSlotCount(scope)) {
                    0 => php.createValueNull(),
                    1 => get: {
                        // get the only element inside the hash table
                        const ht = try php.getValueHashTable(slots);
                        var pos: HashPosition = undefined;
                        php.initializeHashPosition(ht, &pos);
                        break :get php.getHashPositionValue(ht, &pos).?.*;
                    },
                    else => slots.*,
                };
                php.addRef(&self.slots);
            }
        }

        pub fn readSelf(obj: *Object) !Value {
            // by default just return the object itself
            php.addRef(obj);
            return php.createValueObject(obj);
        }

        pub fn freeObject(obj: *Object) void {
            const self = fromObject(obj);
            if (@hasField(S, "bytes")) self.bytes.release();
            if (@hasField(S, "slots")) php.release(&self.slots);
            const class = ZigClass.fromObject(obj);
            class.release();
        }

        pub fn readProperty(obj: *Object, name: *String, prop_type: c_int, cache_slot: ?[*]?*anyopaque, retval: *Value) *Value {
            _ = prop_type;
            if (readMember(obj, name, cache_slot)) |value| {
                retval.* = value;
            } else |err| {
                throwFieldError(obj, name, err);
            }
            return retval;
        }

        pub fn readMember(obj: *Object, name: *String, cache_slot: ?[*]?*anyopaque) !Value {
            if (findAccessors(obj, name, cache_slot)) |accessors| {
                const self = fromObject(obj);
                return try accessors.get(self);
            } else |err| {
                if (@hasDecl(S, "readSelf")) {
                    if (isDollarSign(name)) return try S.readSelf(obj);
                }
                return err;
            }
        }

        pub fn writeProperty(obj: *Object, name: *String, value: *Value, cache_slot: ?[*]?*anyopaque) *Value {
            writeMember(obj, name, value, cache_slot) catch |err| {
                throwFieldError(obj, name, err);
            };
            return value;
        }

        pub fn writeMember(obj: *Object, name: *String, value: *Value, cache_slot: ?[*]?*anyopaque) !void {
            if (findAccessors(obj, name, cache_slot)) |accessors| {
                const self = fromObject(obj);
                return try accessors.set(self, value);
            } else |err| {
                if (@hasDecl(S, "writeSelf")) {
                    if (isDollarSign(name)) return try S.writeSelf(obj, value);
                }
                return err;
            }
        }

        fn findAccessors(obj: *Object, name: *String, cache_slot: ?[*]?*anyopaque) !*const accessor.Any {
            const class = ZigClass.fromObject(obj);
            const cache_entry: ?*CacheEntry = @ptrCast(cache_slot);
            if (cache_entry) |cached| {
                if (cached.class == class) return cached.accessors;
            }
            const member = try class.getMember(scope, name);
            if (cache_entry) |cached| {
                cached.class = class;
                cached.accessors = &member.accessors;
            }
            return &member.accessors;
        }

        fn isDollarSign(str: *String) bool {
            return str.len == 1 and str.val[0] == '$';
        }

        fn throwFieldError(obj: *Object, name: *String, err: anytype) void {
            switch (err) {
                error.Missing => {
                    const class = ZigClass.fromObject(obj);
                    if (scope == .instance) {
                        php.throwExceptionFmt("no field named '{s}' in {s} '{s}' (zig)", .{
                            php.getStringContent(name),
                            class.getStructureName(),
                            class.getName(),
                        });
                    } else {
                        php.throwExceptionFmt("{s} '{s}' has no member named '{s}' (zig)", .{
                            class.getStructureName(),
                            class.getName(),
                            php.getStringContent(name),
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
