const std = @import("std");

const accessor = @import("accessor.zig");
const ByteBuffer = @import("buffer.zig").ByteBuffer;
const enums = @import("enums.zig");
const StructureType = enums.StructureType;
const Iterator = @import("iterator.zig").Iterator;
const php = @import("php.zig");
const ClassEntry = php.ClassEntry;
const HashTable = php.HashTable;
const HashTableIterator = php.HashTableIterator;
const Object = php.Object;
const ObjectIterator = php.ObjectIterator;
const String = php.String;
const Value = php.Value;
pub const ArgStruct = @import("structure/arg-struct.zig").ArgStruct;
pub const Array = @import("structure/array.zig").Array;
pub const Class = @import("structure/class.zig").Class;
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
pub const Struct = @import("structure/struct.zig").Struct;
pub const Union = @import("structure/union.zig").Union;
pub const VariadicStruct = @import("structure/variadic-struct.zig").VariadicStruct;
pub const Vector = @import("structure/vector.zig").Vector;
const ZigClassEntry = @import("class-entry.zig").ZigClassEntry;
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
        const scope: ZigClassEntry.ScopeType = if (@hasDecl(S, "scope")) S.scope else .instance;

        pub const CacheEntry = extern struct {
            class: ?*const ZigClassEntry,
            accessors: *const accessor.Any,
        };
        pub const ByteExtent = struct {
            address: usize,
            len: usize = 1,
        };

        pub fn fromObject(obj: *Object) *S {
            return &ZigObject(S).fromObject(obj).zig_portion;
        }

        pub fn object(self: *S) *Object {
            return &ZigObject(S).fromStructure(self).php_portion;
        }

        pub fn setStorage(self: *S, bytes: *ByteBuffer, slots: *const Value) !void {
            if (@hasField(S, "bytes")) {
                const class = ZigClassEntry.fromStructure(self);
                const byte_size = class.byte_size orelse return error.Unexpected;
                if (byte_size != bytes.bytes.len) {
                    return php.throwExceptionFmt("{s} has {d} byte{s}, received {d}", .{
                        class.getName(),
                        byte_size,
                        if (byte_size != 1) "s" else "",
                        bytes.bytes.len,
                    });
                }
                self.bytes = bytes;
                self.bytes.addRef();
            }
            if (@hasField(S, "slots")) {
                self.slots = slots.*;
                php.addRef(&self.slots);
            }
        }

        pub fn getExtent(self: *S) ByteExtent {
            if (!@hasField(S, "bytes")) @compileError("No buffer: " ++ @typeName(S));
            return .{ .address = @intFromPtr(self.bytes.bytes.ptr) };
        }

        pub fn copyArguments(self: *S, arg_iter: *php.ArgumentIterator) !void {
            if (arg_iter.len != 1) {
                const arg_desc = switch (@hasDecl(S, "constructor_args")) {
                    true => @field(S, "constructor_args"),
                    false => "one argument",
                };
                const class = ZigClassEntry.fromStructure(self);
                return php.throwExceptionFmt("{s} constructor expects " ++ arg_desc, .{
                    class.getStructureName(),
                });
            }
            const arg = arg_iter.next() orelse unreachable;
            return try S.writeSelf(self, arg);
        }

        // error set cannot be inferred due to recursion
        pub fn writeContainer(self: *S, value: *const Value) accessor.Error!void {
            const ht = try php.getValueHashTable(value);
            var iter: HashTableIterator = .init(ht, .{});
            while (iter.next()) |field_value| {
                const name = iter.currentName() orelse return error.KeyIsNotString;
                writeMember(self, name, field_value, null) catch |err| {
                    return throwFieldError(self, name, err);
                };
            }
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
            const class = ZigClassEntry.fromStructure(self);
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

        pub fn findMethod(self: *S, name: *String) !?*php.Function {
            // methods are actually static functions with self as the first argument
            const class = ZigClassEntry.fromStructure(self);
            const member = try class.getMember(.static, name);
            if (!member.flags.is_method) return null;
            const class_struct = ZigObject(Class(S)).fromObject(class.object).structure();
            var field = try member.accessors.get(class_struct);
            defer php.release(&field);
            const field_obj = php.getValueObject(&field) catch return null;
            const field_class = ZigClassEntry.fromObject(field_obj);
            if (field_class.type != .function) return null;
            const func = ZigObject(Function).fromObject(field_obj).structure();
            return func.closure.function();
        }

        pub fn throwFieldError(self: *S, name: *String, err: anytype) error{ExceptionThrown} {
            const class = ZigClassEntry.fromStructure(self);
            return switch (err) {
                error.Missing => switch (scope) {
                    .instance => php.throwExceptionFmt("no field named '{s}' in {s} '{s}' (zig)", .{
                        php.getStringContent(name),
                        class.getStructureName(),
                        class.getName(),
                    }),
                    .static => php.throwExceptionFmt("{s} '{s}' has no member named '{s}' (zig)", .{
                        class.getStructureName(),
                        class.getName(),
                        php.getStringContent(name),
                    }),
                },
                else => php.throwError(err),
            };
        }

        pub fn freeObject(obj: *Object) void {
            const self = fromObject(obj);
            if (@hasField(S, "bytes")) self.bytes.release();
            if (@hasField(S, "slots")) php.release(&self.slots);
            const class = ZigClassEntry.fromObject(obj);
            class.release();
        }

        pub fn readContainerProperty(obj: *Object, name: *String, prop_type: c_int, cache_slot: ?[*]?*anyopaque, retval: *Value) !*Value {
            _ = prop_type;
            const self = fromObject(obj);
            const value = readMember(self, name, cache_slot) catch |err| {
                _ = &throwFieldError(self, name, err);
                // PHP expects us to return a valid pointer
                return retval;
            };
            retval.* = value;
            return retval;
        }

        pub fn writeContainerProperty(obj: *Object, name: *String, value: *Value, cache_slot: ?[*]?*anyopaque) !*Value {
            const self = fromObject(obj);
            writeMember(self, name, value, cache_slot) catch |err| {
                return throwFieldError(self, name, err);
            };
            return value;
        }

        pub fn hasVectorElement(obj: *Object, key: *Value, _: c_int) !c_int {
            const class = ZigClassEntry.fromObject(obj);
            const index = getIndex(key) catch return 0;
            const len = class.length orelse return error.MissingLength;
            return if (index < len) 1 else 0;
        }

        pub fn countVectorElements(obj: *Object, count: *php.Long) !c_int {
            const class = ZigClassEntry.fromObject(obj);
            const len = class.length orelse return error.MissingLength;
            if (len > std.math.maxInt(php.Long)) return error.TooLarge;
            count.* = @intCast(len);
            return php.SUCCESS;
        }

        pub fn getIndex(key: *Value) !usize {
            const key_long = try php.getValueLong(key);
            if (key_long < 0) return error.NegativeIndex;
            return @intCast(key_long);
        }

        pub fn getPropertyPointer(obj: *Object, name: *String, prop_type: c_int, cache_slot: ?[*]?*anyopaque) ?*Value {
            _ = obj;
            _ = name;
            _ = prop_type;
            _ = cache_slot;
            return null;
        }

        pub fn getContainerProperties(obj: *Object) !*HashTable {
            const self = fromObject(obj);
            const class = ZigClassEntry.fromObject(obj);
            const ht = php.createArray();
            var iter = class.getMemberIterator(.instance);
            while (iter.next()) |member| {
                if (iter.currentName()) |name| {
                    var value = try member.accessors.get(self);
                    php.setHashEntry(ht, name, &value);
                }
            }
            // caller seem to expect a hash table with zero refcount
            ht.gc.refcount = 0;
            return ht;
        }

        pub fn getVectorProperties(obj: *Object) !*HashTable {
            const ht = php.createArray();
            var count: c_long = undefined;
            _ = try S.countElements(obj, &count);
            var i: c_long = 0;
            while (i < count) : (i += 1) {
                var key = php.createValueLong(i);
                var value: Value = undefined;
                _ = try S.readElement(obj, &key, 0, &value);
                _ = php.appendHashEntry(ht, &value);
            }
            // same as above
            ht.gc.refcount = 0;
            return ht;
        }

        pub fn getVectorIterator(_: *ClassEntry, this: *Value, _: c_int) !?*ObjectIterator {
            const obj = try php.getValueObject(this);
            return try Iterator(S).create(obj);
        }

        pub fn getMethod(obj_ptr: *[*c]Object, name: *String, _: *const Value) !?*php.Function {
            const obj = obj_ptr.*;
            const self = fromObject(obj);
            return try findMethod(self, name);
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
            if (ErrorType(RT)) |ES| {
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
    const class = ZigClassEntry.fromObject(obj);
    switch (class.type) {
        inline else => |t| {
            const s_name = @tagName(t);
            const S = @field(by_enum, s_name);
            if (comptime @hasDecl(S, name)) {
                const func = @field(S, name);
                const self = Parent(S).fromObject(obj);
                const RT = ReturnType(S, name);
                const result = @call(.auto, func, .{self} ++ args);
                return if (ErrorType(RT) != null) try result else result;
            } else @panic(@typeName(S) ++ "has not implementation for " ++ name ++ "()");
        },
    }
}

fn ReturnType(comptime S: type, comptime name: []const u8) type {
    const FT = @TypeOf(@field(S, name));
    return @typeInfo(FT).@"fn".return_type.?;
}

fn ErrorType(comptime RT: type) ?type {
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
