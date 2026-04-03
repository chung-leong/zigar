const std = @import("std");

const accessor = @import("accessor.zig");
const ObjectTransform = accessor.ObjectTransform;
const ByteBuffer = @import("buffer.zig").ByteBuffer;
const enums = @import("enums.zig");
const StructureType = enums.StructureType;
const iterator = @import("iterator.zig");
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
    .arg_struct = ArgStruct(false),
    .variadic_struct = ArgStruct(true),
    .function = Function,
    .@"comptime" = Comptime,
};
pub const RefStatus = packed struct {
    checked: bool = false,
    broken: bool = false,
};
pub const VisitOptions = packed struct {
    include_inactive: bool = false,
};

pub fn enumName(comptime S: type) []const u8 {
    return inline for (comptime std.meta.fields(@TypeOf(by_enum))) |field| {
        if (@field(by_enum, field.name) == S) break field.name;
    } else @compileError("Unrecognized structure type: " ++ @typeName(S));
}

pub fn Parent(comptime S: type) type {
    return struct {
        pub const CacheEntry = extern struct {
            class: ?*const ZigClassEntry,
            member: *const ZigClassEntry.Member,
        };
        pub const ByteExtent = struct {
            address: usize,
            len: usize = 1,
        };
        pub const scope: ZigClassEntry.ScopeType = if (@hasDecl(S, "scope")) S.scope else .instance;

        pub fn object(self: *S) *Object {
            return &ZigObject(S).fromStructure(self).php_portion;
        }

        pub fn fromObject(obj: *Object) *S {
            return &ZigObject(S).fromObject(obj).zig_portion;
        }

        pub fn getExtent(self: *S) ByteExtent {
            return .{ .address = @intFromPtr(self.buffer.bytes.ptr) };
        }

        pub fn setStorage(self: *S, buffer: *ByteBuffer, table: *const Value) !void {
            if (@hasField(S, "buffer")) {
                self.buffer = buffer;
                buffer.addRef();
            }
            if (@hasField(S, "table")) {
                self.table = table.*;
                php.addRef(table);
            }
        }

        pub fn initialize(self: *S, allocator: ?*const std.mem.Allocator, initializer: ?*const Value) !void {
            if (@hasField(S, "buffer")) {
                const class = ZigClassEntry.fromStructure(self);
                const len = class.byte_size.?;
                try self.buffer.allocate(allocator, len);
                if (class.instance.template.buffer) |def| {
                    // copy default values from template
                    try self.buffer.copy(def);
                }
                const obj = ZigObject(S).fromStructure(self).object();
                if (@hasDecl(S, "getExtent")) {
                    try class.registerObject(obj);
                }
            }
            if (initializer) |value| {
                if (@hasDecl(S, "writeSelf")) {
                    try self.writeSelf(value);
                } else @panic("Not implemented");
            }
        }

        pub fn finalize(self: *S, init_called: bool) !void {
            _ = init_called;
            if (@hasDecl(S, "buffer")) {
                const obj = ZigObject(S).fromStructure(self).object();
                const class = ZigClassEntry.fromObject(obj);
                try class.registerObject(self.object());
            }
        }

        pub fn externalize(self: *S) !void {
            if (@hasField(S, "buffer")) {
                if (self.buffer.externalize()) {
                    try self.visitPointers(Pointer.externalizeTarget, .{}, .{});
                }
            }
        }

        pub fn visitPointers(self: *S, cb: anytype, args: anytype, comptime options: VisitOptions) accessor.Error!void {
            _ = self;
            _ = cb;
            _ = args;
            _ = options;
        }

        pub fn checkArguments(self: *S, arg_iter: *php.ArgumentIterator) !void {
            if (arg_iter.len != 1) {
                const class = ZigClassEntry.fromStructure(self);
                return php.throwExceptionFmt("{s} constructor expects one argument", .{
                    class.getStructureName(),
                });
            }
        }

        pub fn readSelf(self: *S, transform: ObjectTransform) !Value {
            if (transform != .to_value) return error.Unsupported;
            return try returnSelf(self);
        }

        pub fn copySelf(self: *S, value: *const Value) !bool {
            switch (php.getType(value)) {
                .object => {
                    const obj = php.getValueObject(value) catch unreachable;
                    const class = ZigClassEntry.fromStructure(self);
                    if (php.instanceOf(obj.ce, class.entry())) {
                        const obj_struct = ZigObject(S).fromObject(obj).structure();
                        try self.buffer.copy(obj_struct.buffer);
                        return true;
                    }
                },
                .null => {
                    try self.buffer.clear();
                    return true;
                },
                else => {},
            }
            return false;
        }

        pub fn returnSelf(self: *S) !Value {
            const obj = ZigObject(S).fromStructure(self).object();
            php.addRef(obj);
            return php.createValueObject(obj);
        }

        pub fn returnBytes(self: *S) !Value {
            if (!@hasField(S, "buffer")) return error.Unsupported;
            const str = try self.buffer.getString();
            return php.createValueString(str);
        }

        pub fn readMember(self: *S, name: *String) !Value {
            const transform = ObjectTransform.fromPropName(name) orelse return error.Missing;
            return self.readSelf(transform) catch |err| {
                const E = @TypeOf(err);
                return if (isPartOf(error.Unsupported, E) and err == error.Unsupported)
                    error.Missing
                else
                    err;
            };
        }

        pub fn writeMember(self: *S, name: *String, value: *const Value) accessor.Error!void {
            if (php.matchString(name, "__value")) {
                try self.writeSelf(value);
            } else if (@hasField(S, "buffer") and php.matchString(name, "__bytes")) {
                const sc = try php.getValueStringContent(value);
                try self.buffer.copyBytes(sc);
            } else {
                return error.NotFound;
            }
        }

        pub fn hasMember(_: *S, name: *String) bool {
            return ObjectTransform.fromPropName(name) != null;
        }

        pub fn findMethod(self: *S, name: *String) !?*php.Function {
            // methods are actually static functions with self as the first argument
            const class = ZigClassEntry.fromStructure(self);
            const static = class.getStaticData(S);
            const member = try class.getMember(.static, name);
            if (!member.flags.is_method) return null;
            const class_struct = ZigObject(Class(S)).fromObject(static.class_obj).structure();
            var field = try member.accessors.get(class_struct);
            defer php.release(&field);
            const field_obj = php.getValueObject(&field) catch return null;
            const field_class = ZigClassEntry.fromObject(field_obj);
            if (field_class.type != .function) return null;
            const func = ZigObject(Function).fromObject(field_obj).structure();
            return &func.closure.php_portion;
        }

        pub fn throwFieldException(self: *S, name: *String, access: accessor.FieldAccess, err: anytype) error{ExceptionThrown} {
            const class = ZigClassEntry.fromStructure(self);
            const E = @TypeOf(err);
            if (isPartOf(error.Missing, E) and err == error.Missing) {
                return switch (scope) {
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
                };
            } else {
                if (!isPartOf(error.ExceptionThrown, E) or err != error.ExceptionThrown) {
                    _ = &php.throwError(err);
                }
                return php.throwExceptionFmt("unable to {s} field '{s}' in {s} '{s}' (zig)", .{
                    @tagName(access),
                    php.getStringContent(name),
                    class.getStructureName(),
                    class.getName(),
                });
            }
        }

        pub fn freeObject(obj: *Object) void {
            const self = fromObject(obj);
            const class = ZigClassEntry.fromObject(obj);
            defer class.release();
            // only structure that a pointer can points to implement getExtent()
            if (@hasField(S, "buffer")) {
                if (@hasDecl(S, "getExtent")) {
                    if (!self.buffer.flags.uninitialized and !self.buffer.flags.temporary) {
                        class.unregisterObject(obj);
                    }
                }
                self.buffer.release();
            }
            if (@hasField(S, "table")) php.release(&self.table);
        }

        pub fn castObject(obj: *Object, retval: *Value, type_id: c_int) !c_int {
            const desired_type = try php.Type.fromInt(type_id);
            const self = fromObject(obj);
            switch (desired_type) {
                .string => retval.* = self.readSelf(.to_string) catch return php.FAILURE,
                .long => retval.* = self.readSelf(.to_integer) catch return php.FAILURE,
                .boolean, .double => {
                    retval.* = try self.readSelf(.to_value);
                    if (php.getValueObject(retval)) |value_obj| {
                        defer php.release(value_obj);
                        if (desired_type == .boolean) {
                            retval.* = php.createValueBool(true);
                        } else {
                            return php.FAILURE;
                        }
                    } else |_| {
                        try php.convertValue(retval, desired_type);
                    }
                },
                else => return php.FAILURE,
            }
            return php.SUCCESS;
        }

        pub fn readProperty(obj: *Object, name: *String, prop_type: c_int, cache_slot: ?[*]?*anyopaque, retval: *Value) *Value {
            // unlike readElement(), PHP does not expect this function to return a null pointer;
            // we cannot therefore return an error union;
            _ = prop_type;
            _ = cache_slot;
            const self = fromObject(obj);
            if (readMember(self, name)) |value| {
                retval.* = value;
            } else |err| {
                retval.* = php.createValueNull();
                _ = &throwFieldException(self, name, .read, err);
            }
            return retval;
        }

        pub fn writeProperty(obj: *Object, name: *String, value: *Value, cache_slot: ?[*]?*anyopaque) !*Value {
            _ = cache_slot;
            const self = fromObject(obj);
            writeMember(self, name, value) catch |err| {
                return throwFieldException(self, name, .write, err);
            };
            return value;
        }

        pub fn hasProperty(obj: *Object, name: *String, prop_type: c_int, cache_slot: ?[*]?*anyopaque) c_int {
            _ = prop_type;
            _ = cache_slot;
            const self = fromObject(obj);
            return if (hasMember(self, name)) 1 else 0;
        }

        pub fn getMethod(obj_ptr: *[*c]Object, name: *String, _: ?*const Value) !?*php.Function {
            const obj = obj_ptr.*;
            const self = fromObject(obj);
            return try findMethod(self, name);
        }

        pub fn getReferencedObjects(_: *Object, table: *[*c]Value, n: *c_int) ?*HashTable {
            table.* = null;
            n.* = 0;
            return null;
        }
    };
}

pub fn StructLike(comptime S: type) type {
    return struct {
        pub const Super = Parent(S);
        pub const CacheEntry = extern struct {
            class: ?*const ZigClassEntry,
            member: *const ZigClassEntry.Member,
        };
        pub const ByteExtent = Super.ByteExtent;
        pub const scope = Super.scope;

        pub fn readSelf(self: *S, transform: ObjectTransform) !Value {
            return switch (transform) {
                .to_value => returnSelf(self),
                .to_plain => create: {
                    const ht = try S.getProperties(object(self));
                    var iter: HashTableIterator = .init(ht, .{});
                    while (iter.next()) |value| {
                        // make child objects plain too
                        if (php.getType(value) == .object) {
                            try transform.apply(value);
                        }
                    }
                    php.addRef(ht);
                    var value = php.createValueArray(ht);
                    // don't convert if the struct is a tuple
                    if (!isTuple(self)) try php.convertValue(&value, .object);
                    break :create value;
                },
                .to_bytes => try returnBytes(self),
                .to_string, .to_integer => error.Unsupported,
            };
        }

        // error set cannot be inferred due to recursion
        pub fn writeSelf(self: *S, value: *const Value) accessor.Error!void {
            if (try copySelf(self, value)) return;
            const ht = try php.getValueHashTable(value);
            var iter: HashTableIterator = .init(ht, .{});
            while (iter.next()) |field_value| {
                const name = iter.currentName() orelse return error.KeyIsNotString;
                writeMember(self, name, field_value, null) catch |err| {
                    return throwFieldException(self, name, .write, err);
                };
            }
        }

        pub fn readMember(self: *S, name: *String, cache_slot: ?[*]?*anyopaque) !Value {
            if (findMember(self, name, cache_slot)) |member| {
                var value = try member.accessors.get(self);
                if (member.objectTransform()) |ot| try ot.apply(&value);
                return value;
            } else |_| {
                return Super.readMember(self, name);
            }
        }

        pub fn writeMember(self: *S, name: *String, value: *const Value, cache_slot: ?[*]?*anyopaque) !void {
            if (findMember(self, name, cache_slot)) |member| {
                try member.accessors.set(self, value);
            } else |_| {
                if (scope == .instance) try Super.writeMember(self, name, value);
            }
        }

        pub fn hasMember(self: *S, name: *String, cache_slot: ?[*]?*anyopaque) bool {
            if (findMember(self, name, cache_slot)) |_| {
                return true;
            } else |_| {
                return Super.hasMember(self, name);
            }
        }

        pub fn findMember(self: *S, name: *String, cache_slot: ?[*]?*anyopaque) !*const ZigClassEntry.Member {
            const class = ZigClassEntry.fromStructure(self);
            const cache_entry: ?*CacheEntry = @ptrCast(cache_slot);
            if (cache_entry) |cached| {
                if (cached.class == class) return cached.member;
            }
            const member = try class.getMember(scope, name);
            if (cache_entry) |cached| {
                cached.class = class;
                cached.member = member;
            }
            return member;
        }

        pub fn readProperty(obj: *Object, name: *String, prop_type: c_int, cache_slot: ?[*]?*anyopaque, retval: *Value) *Value {
            // this function cannot return an error union (see comment in Parent.readProperty())
            _ = prop_type;
            const self = fromObject(obj);
            if (readMember(self, name, cache_slot)) |value| {
                retval.* = value;
            } else |err| {
                retval.* = php.createValueNull();
                _ = &throwFieldException(self, name, .read, err);
            }
            return retval;
        }

        pub fn writeProperty(obj: *Object, name: *String, value: *Value, cache_slot: ?[*]?*anyopaque) !*Value {
            const self = fromObject(obj);
            writeMember(self, name, value, cache_slot) catch |err| {
                return throwFieldException(self, name, .write, err);
            };
            return value;
        }

        pub fn hasProperty(obj: *Object, name: *String, prop_type: c_int, cache_slot: ?[*]?*anyopaque) c_int {
            _ = prop_type;
            const self = fromObject(obj);
            return if (hasMember(self, name, cache_slot)) 1 else 0;
        }

        pub fn getProperties(obj: *Object) !*HashTable {
            const self = fromObject(obj);
            const class = ZigClassEntry.fromObject(obj);
            const ht = php.createArray();
            var iter = class.getMemberIterator(scope);
            const is_tuple = isTuple(self);
            while (iter.next()) |member| {
                if (iter.currentName()) |name| {
                    var value = try member.accessors.get(self);
                    errdefer php.release(&value);
                    if (member.objectTransform()) |ot| try ot.apply(&value);
                    if (is_tuple) {
                        _ = php.appendHashEntry(ht, &value);
                    } else {
                        php.setHashEntry(ht, name, &value);
                    }
                }
            }
            // caller seem to expect a hash table with zero refcount
            ht.gc.refcount = 0;
            return ht;
        }

        pub fn getPropertyPointer(obj: *Object, name: *String, prop_type: c_int, cache_slot: ?[*]?*anyopaque) ?*Value {
            _ = obj;
            _ = name;
            _ = prop_type;
            _ = cache_slot;
            return null;
        }

        pub fn isTuple(self: *S) bool {
            if (scope == .instance) {
                const class = ZigClassEntry.fromStructure(self);
                const flags = class.getFlags(S);
                if (@hasField(@TypeOf(flags), "is_tuple")) {
                    return flags.is_tuple;
                }
            }
            return false;
        }

        pub const object = Super.object;
        pub const fromObject = Super.fromObject;
        pub const getExtent = Super.getExtent;
        pub const setStorage = Super.setStorage;
        pub const initialize = Super.initialize;
        pub const finalize = Super.finalize;
        pub const externalize = Super.externalize;
        pub const checkArguments = Super.checkArguments;
        pub const copySelf = Super.copySelf;
        pub const returnSelf = Super.returnSelf;
        pub const returnBytes = Super.returnBytes;
        pub const visitPointers = Super.visitPointers;
        pub const throwFieldException = Super.throwFieldException;

        pub const freeObject = Super.freeObject;
        pub const castObject = Super.castObject;
        pub const getReferencedObjects = Super.getReferencedObjects;
        pub const getMethod = Super.getMethod;
    };
}

pub fn ArrayLike(comptime S: type) type {
    return struct {
        pub const Super = Parent(S);
        pub const ByteExtent = Super.ByteExtent;
        pub const scope = Super.scope;

        pub fn readSelf(self: *S, transform: ObjectTransform) !Value {
            return switch (transform) {
                .to_value => returnSelf(self),
                .to_plain => create: {
                    const len = self.getLength();
                    const ht = php.createArray();
                    for (0..len) |i| {
                        var value = try self.getElement(i, true);
                        try transform.apply(&value);
                        _ = php.appendHashEntry(ht, &value);
                    }
                    break :create php.createValueArray(ht);
                },
                .to_string => create: {
                    const class = ZigClassEntry.fromStructure(self);
                    const flags = class.getFlags(S);
                    if (!@hasField(@TypeOf(flags), "is_string") or !flags.is_string) {
                        break :create error.Unsupported;
                    }
                    const len = self.getLength();
                    const byte_count = self.buffer.bytes.len;
                    if (byte_count == len) {
                        break :create php.createValueStringContent(self.buffer.bytes);
                    } else if (byte_count == len * 2) {
                        // TODO: convert to UTF-8
                        @panic("TODO");
                    } else {
                        break :create error.Unexpected;
                    }
                },
                .to_integer => error.Unsupported,
                .to_bytes => try returnBytes(self),
            };
        }

        pub fn writeSelf(self: *S, value: *const Value) !void {
            if (try copySelf(self, value)) return;
            const ht = try php.getValueArray(value);
            const len = self.getLength();
            var iter: HashTableIterator = .init(ht, .{});
            while (iter.next()) |field_value| {
                const key = iter.currentIndex() orelse return error.KeyIsNotInteger;
                if (key < 0) return error.NegativeIndex;
                const index: usize = @intCast(key);
                if (index >= len) return error.OutOfBound;
                try self.setElement(index, field_value);
            }
        }

        pub fn visitPointers(self: *S, cb: anytype, args: anytype, comptime options: VisitOptions) accessor.Error!void {
            const class = ZigClassEntry.fromStructure(self);
            if (class.flags.common.has_pointer) {
                const len = self.getLength();
                for (0..len) |index| {
                    const value = try self.getElement(index, false);
                    defer php.release(&value);
                    const obj = php.getValueObject(&value) catch return;
                    try invokeMethod(obj, "visitPointers", .{ cb, args, options });
                }
            }
        }

        pub fn readElement(obj: *Object, key: *Value, _: c_int, retval: *Value) !*Value {
            const self = fromObject(obj);
            const len = self.getLength();
            const index = try getIndex(key, len);
            retval.* = try self.getElement(index, true);
            return retval;
        }

        pub fn writeElement(obj: *Object, key: *Value, value: *Value) !void {
            const self = fromObject(obj);
            const len = self.getLength();
            const index = try getIndex(key, len);
            try self.setElement(index, value);
        }

        pub fn hasElement(obj: *Object, key: *Value, _: c_int) !c_int {
            const self = fromObject(obj);
            const len = self.getLength();
            return if (getIndex(key, len)) |_| 1 else |_| 0;
        }

        pub fn countElements(obj: *Object, count: *php.Long) !c_int {
            const self = fromObject(obj);
            const len = self.getLength();
            if (len > std.math.maxInt(php.Long)) return error.TooLarge;
            count.* = @intCast(len);
            return php.SUCCESS;
        }

        pub fn getIndex(key: *Value, len: usize) !usize {
            const key_long = try php.getValueLong(key);
            if (key_long < 0) return error.NegativeIndex;
            const index: usize = @intCast(key_long);
            // need bound check needed even though the ByteBuffer performs bound check because
            // element might be zero-bit
            if (index >= len) return error.OutOfBound;
            return index;
        }

        pub fn getProperties(obj: *Object) !*HashTable {
            const self = fromObject(obj);
            const ht = php.createArray();
            const len = self.getLength();
            for (0..len) |i| {
                var value = try self.getElement(i, true);
                _ = php.appendHashEntry(ht, &value);
            }
            // zero-count hash table expected
            ht.gc.refcount = 0;
            return ht;
        }

        pub fn handleGetIterator(_: *ClassEntry, this: *Value, _: c_int) !?*ObjectIterator {
            const obj = try php.getValueObject(this);
            return try iterator.ArrayIterator(S).create(obj);
        }

        pub const fromObject = Super.fromObject;
        pub const getExtent = Super.getExtent;
        pub const setStorage = Super.setStorage;
        pub const initialize = Super.initialize;
        pub const finalize = Super.finalize;
        pub const externalize = Super.externalize;
        pub const checkArguments = Super.checkArguments;
        pub const copySelf = Super.copySelf;
        pub const returnSelf = Super.returnSelf;
        pub const returnBytes = Super.returnBytes;

        pub const readProperty = Super.readProperty;
        pub const writeProperty = Super.writeProperty;
        pub const hasProperty = Super.hasProperty;
        pub const freeObject = Super.freeObject;
        pub const castObject = Super.castObject;
        pub const getReferencedObjects = Super.getReferencedObjects;
    };
}

pub fn invokeMethod(obj: *Object, comptime name: []const u8, args: anytype) RT: {
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
            const C = Class(S);
            // the class object has the same class entry as instance objects; we can only
            // distingish the two by checking the object handlers
            if (ZigObject(C).isInstance(obj)) {
                if (comptime @hasDecl(C, name)) {
                    const func = @field(C, name);
                    const self = ZigObject(C).fromObject(obj).structure();
                    const RT = ReturnType(C, name);
                    const result = @call(.auto, func, .{self} ++ args);
                    return if (ErrorType(RT) != null) try result else result;
                } else @panic(@typeName(C) ++ "has not implementation for " ++ name ++ "()");
            } else {
                if (comptime @hasDecl(S, name)) {
                    const func = @field(S, name);
                    const self = ZigObject(S).fromObject(obj).structure();
                    const RT = ReturnType(S, name);
                    const result = @call(.auto, func, .{self} ++ args);
                    return if (ErrorType(RT) != null) try result else result;
                } else @panic(@typeName(S) ++ "has not implementation for " ++ name ++ "()");
            }
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

fn isPartOf(comptime err: anytype, comptime Set: anytype) bool {
    const errors = @typeInfo(Set).error_set orelse return true;
    return inline for (errors) |e| {
        if (std.mem.eql(u8, @errorName(err), e.name)) break true;
    } else false;
}
