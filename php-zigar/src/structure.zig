const std = @import("std");

const accessor = @import("accessor.zig");
const ByteBuffer = @import("buffer.zig").ByteBuffer;
const enums = @import("enums.zig");
const StructureType = enums.StructureType;
const php = @import("php.zig");
const ClassEntry = php.ClassEntry;
const HashTable = php.HashTable;
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
const ZigClass = @import("class.zig").ZigClass;
const ZigObject = @import("object.zig").ZigObject;

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

        pub fn fromObject(obj: *Object) *S {
            return &ZigObject(S).fromObject(obj).zig_portion;
        }

        pub fn object(self: *S) *Object {
            return &ZigObject(S).fromStructure(self).php_portion;
        }

        pub fn setStorage(self: *S, bytes: *ByteBuffer, slots: *const Value) !void {
            if (@hasField(S, "bytes")) {
                self.bytes = bytes;
                self.bytes.addRef();
            }
            if (@hasField(S, "slots")) {
                self.slots = slots.*;
                php.addRef(&self.slots);
            }
        }

        pub fn copyArguments(self: *S, arg_iter: *php.ArgumentIterator) !void {
            if (arg_iter.len != 1) {
                const arg_desc = switch (@hasDecl(S, "constructor_args")) {
                    true => @field(S, "constructor_args"),
                    false => "one argument",
                };
                const class = ZigClass.fromStructure(self);
                php.throwExceptionFmt("{s} constructor expects " ++ arg_desc, .{
                    class.getStructureName(),
                });
                return error.ExceptionThrown;
            }
            const arg = arg_iter.next() orelse unreachable;
            return S.writeSelf(self, arg);
        }

        pub fn readSelf(self: *S) !Value {
            // by default just return the object itself
            const obj = ZigObject(S).fromStructure(self).object();
            php.addRef(obj);
            return php.createValueObject(obj);
        }

        pub fn readMember(self: *S, name: *String, cache_slot: ?[*]?*anyopaque) !Value {
            if (findAccessors(self, name, cache_slot)) |accessors| {
                return try accessors.get(self);
            } else |err| {
                if (@hasDecl(S, "readSelf")) {
                    if (isDollarSign(name)) return try self.readSelf();
                }
                return err;
            }
        }

        pub fn writeMember(self: *S, name: *String, value: *Value, cache_slot: ?[*]?*anyopaque) !void {
            if (findAccessors(self, name, cache_slot)) |accessors| {
                return try accessors.set(self, value);
            } else |err| {
                if (@hasDecl(S, "writeSelf")) {
                    if (isDollarSign(name)) return try self.writeSelf(value);
                }
                return err;
            }
        }

        pub fn findAccessors(self: *S, name: *String, cache_slot: ?[*]?*anyopaque) !*const accessor.Any {
            const class = ZigClass.fromStructure(self);
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

        pub fn throwFieldError(self: *S, name: *String, err: anytype) void {
            switch (err) {
                error.Missing => {
                    const class = ZigClass.fromStructure(self);
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

        pub fn freeObject(obj: *Object) void {
            const self = fromObject(obj);
            if (@hasField(S, "bytes")) self.bytes.release();
            if (@hasField(S, "slots")) php.release(&self.slots);
            const class = ZigClass.fromObject(obj);
            class.release();
        }

        pub fn readProperty(obj: *Object, name: *String, prop_type: c_int, cache_slot: ?[*]?*anyopaque, retval: *Value) !*Value {
            _ = prop_type;
            const self = fromObject(obj);
            const value = readMember(self, name, cache_slot) catch |err| {
                throwFieldError(self, name, err);
                // PHP expects us to return a valid pointer
                return retval;
            };
            retval.* = value;
            return retval;
        }

        pub fn writeProperty(obj: *Object, name: *String, value: *Value, cache_slot: ?[*]?*anyopaque) !*Value {
            const self = fromObject(obj);
            writeMember(self, name, value, cache_slot) catch |err| {
                throwFieldError(self, name, err);
                return error.ExceptionThrown;
            };
            return value;
        }

        pub fn getPropertyPointer(obj: *Object, name: *String, prop_type: c_int, cache_slot: ?[*]?*anyopaque) ?*Value {
            _ = obj;
            _ = name;
            _ = prop_type;
            _ = cache_slot;
            return null;
        }
    };
}

pub fn invokeFunction(obj: *Object, comptime name: []const u8, args: anytype) RT: {
    var error_set = error{};
    var payload: ?type = null;
    for (std.meta.fields(@TypeOf(by_enum))) |field| {
        const S = @field(by_enum, field.name);
        if (@hasDecl(S, name)) {
            const RT = ReturnType(S, name);
            if (Error(RT)) |ES| {
                error_set = error_set || ES;
            }
            if (payload) |PL| {
                const PL2 = Payload(RT);
                if (PL != PL2)
                    @compileError(@typeName(S) ++ "." ++ name ++ "() returns " ++ @typeName(PL2) ++ " instead of " ++ @typeName(PL));
            } else {
                payload = Payload(RT);
            }
        }
    }
    if (payload == null) @compileError("No matching function: " ++ name);
    break :RT @Type(.{ .error_union = .{ .error_set = error_set, .payload = payload.? } });
} {
    const class = ZigClass.fromObject(obj);
    switch (class.type) {
        inline else => |t| {
            const s_name = @tagName(t);
            const S = @field(by_enum, s_name);
            if (comptime @hasDecl(S, name)) {
                const func = @field(S, name);
                const self = Parent(S).fromObject(obj);
                const RT = ReturnType(S, name);
                const result = @call(.auto, func, .{self} ++ args);
                return if (Error(RT) != null) try result else result;
            } else @panic(@typeName(S) ++ "has not implementation for " ++ name ++ "()");
        },
    }
}

fn ReturnType(comptime S: type, comptime name: []const u8) type {
    const FT = @TypeOf(@field(S, name));
    return @typeInfo(FT).@"fn".return_type.?;
}

fn Error(comptime RT: type) ?type {
    return switch (@typeInfo(RT)) {
        .error_union => |eu| eu.error_set,
        else => null,
    };
}

fn Payload(comptime RT: type) type {
    return switch (@typeInfo(RT)) {
        .error_union => |eu| eu.payload,
        else => RT,
    };
}

fn isDollarSign(str: *String) bool {
    return str.len == 1 and str.val[0] == '$';
}
