const std = @import("std");

const accessor = @import("accessor.zig");
const ByteBuffer = @import("buffer.zig").ByteBuffer;
const cache = @import("cache.zig");
const enums = @import("enums.zig");
const StructureType = enums.StructureType;
const failure = @import("failure.zig");
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
        pub const ByteExtent = struct {
            address: usize,
            len: usize = 1,
        };
        pub const scope: ZigClassEntry.ScopeType = if (@hasDecl(S, "scope")) S.scope else .instance;

        const TransformCache = cache.TransformCache;

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

        pub fn initialize(self: *S, allocator: ?*const std.mem.Allocator, initializer: ?*const Value, read_only: bool) !void {
            if (!@hasField(S, "buffer")) return;
            const class = ZigClassEntry.fromStructure(self);
            const len = class.byte_size.?;
            try self.buffer.allocate(allocator, len);
            if (class.instance.template.buffer) |def| {
                // copy default values from template
                try self.buffer.copy(def);
            }
            if (initializer) |value| {
                try self.setValue(value, .none);
                if (read_only) self.buffer.protect(true);
            }
        }

        pub fn finalize(self: *S, _: bool) !void {
            if (@hasField(S, "buffer")) {
                const obj = ZigObject(S).fromStructure(self).object();
                const class = ZigClassEntry.fromObject(obj);
                if (!self.buffer.flags.uninitialized) {
                    try class.registerObject(obj);
                }
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
                return failure.report("{s} constructor expects one argument", .{
                    class.getStructureName(),
                });
            }
        }

        pub fn getValue(self: *S, transform: accessor.Transform) accessor.Error!Value {
            switch (transform) {
                .string, .integer, .float, .boolean => |tm| {
                    var value = try self.getValue(.none);
                    try tm.apply(&value);
                    return value;
                },
                .bytes, .base64 => |tm| {
                    if (!@hasField(S, "buffer")) return error.Unsupported;
                    const encoding: ?ByteBuffer.Encoding = switch (tm) {
                        .bytes => null,
                        .base64 => .base64,
                        else => unreachable,
                    };
                    const str = try self.buffer.getString(encoding);
                    return php.createValueString(str);
                },
                .plain => return error.Unsupported,
                .none => {
                    const obj = object(self);
                    php.addRef(obj);
                    return php.createValueObject(obj);
                },
            }
        }

        pub fn setValue(self: *S, value: *const Value, transform: accessor.Transform) accessor.Error!void {
            switch (transform) {
                .bytes, .base64 => |t| {
                    if (!@hasField(S, "buffer")) return error.Unsupported;
                    const str = try php.getValueString(value);
                    const encoding: ?ByteBuffer.Encoding = switch (t) {
                        .bytes => null,
                        .base64 => .base64,
                        else => unreachable,
                    };
                    try self.buffer.copyString(str, encoding);
                },
                .none => {
                    if (@hasField(S, "buffer")) {
                        if (try copySelf(self, value)) return;
                    }
                    return error.Unsupported;
                },
                else => return self.setValue(value, .none),
            }
        }

        pub fn copySelf(self: *S, value: *const Value) !bool {
            switch (php.getValueType(value)) {
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

        pub fn getProperty(self: *S, name: *String, cache_slot: ?[*]?*anyopaque) accessor.Error!Value {
            const transform = TransformCache.idFromString(name, cache_slot) orelse return error.Missing;
            return try self.getValue(transform);
        }

        pub fn setProperty(self: *S, name: *String, value: *const Value, cache_slot: ?[*]?*anyopaque) accessor.Error!void {
            const transform = TransformCache.idFromString(name, cache_slot) orelse return error.Missing;
            return try self.setValue(value, transform);
        }

        pub fn propertyExists(_: *S, name: *String, cache_slot: ?[*]?*anyopaque) bool {
            return TransformCache.idFromString(name, cache_slot) != null;
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
            return &func.closure.php_portion;
        }

        pub fn reportFieldError(self: *S, name: *String, access: accessor.FieldAccess, err: anytype) error{ ExceptionThrown, Unexpected } {
            const class = ZigClassEntry.fromStructure(self);
            if (failure.match(err, error.Missing)) {
                return switch (scope) {
                    .instance => failure.report("no field named '{s}' in {s} '{s}'", .{
                        php.getStringContent(name),
                        class.getStructureName(),
                        class.getName(),
                    }),
                    .static => failure.report("{s} '{s}' has no member named '{s}'", .{
                        class.getStructureName(),
                        class.getName(),
                        php.getStringContent(name),
                    }),
                };
            } else if (failure.match(err, error.ExceptionThrown)) {
                return error.ExceptionThrown;
            } else {
                const message = failure.acquireMessage(err);
                defer failure.freeMessage(message);
                return failure.report("unable to {s} field '{s}' in {s} '{s}': {s}", .{
                    @tagName(access),
                    php.getStringContent(name),
                    class.getStructureName(),
                    class.getName(),
                    message,
                });
            }
        }

        pub fn freeObject(obj: *Object) void {
            const self = fromObject(obj);
            const class = ZigClassEntry.fromObject(obj);
            // std.debug.print("freeObject: {}, object {d}, {x}\n", .{ S, obj.handle, @intFromPtr(self) });
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
            class.destroyObject(obj);
        }

        pub fn castObject(obj: *Object, retval: *Value, type_id: c_int) !c_int {
            const desired_type = try php.ValueType.fromInt(type_id);
            const self = fromObject(obj);
            const transform: accessor.Transform = switch (desired_type) {
                .string => .string,
                .long => .integer,
                .double => .float,
                .boolean => .boolean,
                else => return php.FAILURE,
            };
            retval.* = try self.getValue(transform);
            return php.SUCCESS;
        }

        pub fn readProperty(obj: *Object, name: *String, prop_type: c_int, cache_slot: ?[*]?*anyopaque, retval: *Value) *Value {
            // unlike readElement(), PHP does not expect this function to return a null pointer;
            // we cannot therefore return an error union;
            const self = fromObject(obj);
            if (self.getProperty(name, cache_slot)) |value| {
                retval.* = value;
                if (prop_type == php.BP_VAR_IS) {
                    // silent access doesn't increment refcount
                    php.delRef(retval);
                }
            } else |err| {
                retval.* = php.createValueNull();
                php.throwError(reportFieldError(self, name, .read, err));
            }
            return retval;
        }

        pub fn writeProperty(obj: *Object, name: *String, value: *Value, cache_slot: ?[*]?*anyopaque) !*Value {
            const self = fromObject(obj);
            self.setProperty(name, value, cache_slot) catch |err| {
                return reportFieldError(self, name, .write, err);
            };
            return value;
        }

        pub fn hasProperty(obj: *Object, name: *String, prop_type: c_int, cache_slot: ?[*]?*anyopaque) c_int {
            _ = prop_type;
            const self = fromObject(obj);
            return if (self.propertyExists(name, cache_slot)) 1 else 0;
        }

        pub fn getProperties(_: *Object) !*HashTable {
            const ht = php.createArray();
            // caller seem to expect a hash table with zero refcount
            ht.gc.refcount = 0;
            return ht;
        }
        pub fn getMethod(obj_ptr: *[*c]Object, name: *String, _: ?*const Value) !?*php.Function {
            const obj = obj_ptr.*;
            const self = fromObject(obj);
            return try findMethod(self, name);
        }

        pub fn getGarbageCollection(obj: *Object, table: *[*c]Value, n: *c_int) !?*HashTable {
            const self = fromObject(obj);
            const class = ZigClassEntry.fromObject(obj);
            const gc_buffer = class.host.gc_buffer.start(obj);
            try gc_buffer.addObject(class.object);
            if (@hasField(S, "table")) {
                try gc_buffer.add(&self.table);
            }
            gc_buffer.use(table, n);
            return null;
        }
    };
}

pub fn StructLike(comptime S: type) type {
    return struct {
        pub const Super = Parent(S);
        pub const ByteExtent = Super.ByteExtent;
        pub const scope = Super.scope;

        const MemberCache = cache.MemberCache;

        pub fn getValue(self: *S, transform: accessor.Transform) accessor.Error!Value {
            switch (transform) {
                .string, .integer => return error.Unsupported,
                .plain => {
                    var iter: iterator.PropertyIterator(S) = .init(ZigObject(S).fromStructure(self).object());
                    const ht = php.createArray();
                    while (iter.next()) |prop_value| {
                        const name = iter.current_name.?;
                        if (php.getValueObject(prop_value) catch null) |obj| {
                            if (ZigClassEntry.isZig(obj.ce)) {
                                // make child objects plain too
                                const prop_plain_value = try invokeMethod(obj, "getValue", .{.plain});
                                php.setHashEntry(ht, name, &prop_plain_value);
                                continue;
                            }
                        }
                        php.setHashEntryRef(ht, name, prop_value);
                    }
                    var value = php.createValueArray(ht);
                    // don't convert if the struct is a tuple
                    if (!isTuple(self)) try php.convertValue(&value, .object);
                    return value;
                },
                else => {},
            }
            return Super.getValue(self, transform);
        }

        // error set cannot be inferred due to recursion
        pub fn setValue(self: *S, value: *const Value, transform: accessor.Transform) accessor.Error!void {
            if (transform == .none) {
                if (try copySelf(self, value)) return;
                const ht = try php.getValueHashTable(value);
                var iter: HashTableIterator = .init(ht, .{});
                while (iter.next()) |field_value| {
                    const name = iter.currentName() orelse return error.KeyIsNotString;
                    setProperty(self, name, field_value, null) catch |err| {
                        return reportFieldError(self, name, .write, err);
                    };
                }
                return;
            }
            return Super.setValue(self, value, transform);
        }

        pub fn getProperty(self: *S, name: *String, cache_slot: ?[*]?*anyopaque) accessor.Error!Value {
            return if (findMember(self, name, cache_slot)) |member|
                try member.accessors.get(self)
            else if (scope == .instance)
                try Super.getProperty(self, name, cache_slot)
            else
                error.Missing;
        }

        pub fn setProperty(self: *S, name: *String, value: *const Value, cache_slot: ?[*]?*anyopaque) accessor.Error!void {
            if (findMember(self, name, cache_slot)) |member| {
                try member.accessors.set(self, value);
            } else if (scope == .instance) {
                try Super.setProperty(self, name, value, cache_slot);
            } else {
                return error.Missing;
            }
        }

        pub fn propertyExists(self: *S, name: *String, cache_slot: ?[*]?*anyopaque) bool {
            return if (findMember(self, name, cache_slot)) |_|
                true
            else
                Super.propertyExists(self, name, cache_slot);
        }

        pub fn findMember(self: *S, name: *String, cache_slot: ?[*]?*anyopaque) ?*const ZigClassEntry.Member {
            const class = ZigClassEntry.fromStructure(self);
            if (MemberCache.find(cache_slot, class) catch return null) |m| return m;
            const member = class.getMember(scope, name) catch return null;
            MemberCache.set(cache_slot, class, member);
            return member;
        }

        pub fn getProperties(obj: *Object) !*HashTable {
            var iter: iterator.PropertyIterator(S) = .init(obj);
            defer iter.deinit();
            const self = fromObject(obj);
            const ht = php.createArray();
            const is_tuple = isTuple(self);
            while (iter.next()) |value| {
                if (is_tuple) {
                    _ = php.appendHashEntryRef(ht, value);
                } else {
                    php.setHashEntryRef(ht, iter.current_name.?, value);
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
        pub const visitPointers = Super.visitPointers;
        pub const reportFieldError = Super.reportFieldError;

        pub const readProperty = Super.readProperty;
        pub const writeProperty = Super.writeProperty;
        pub const hasProperty = Super.hasProperty;
        pub const freeObject = Super.freeObject;
        pub const castObject = Super.castObject;
        pub const getGarbageCollection = Super.getGarbageCollection;
        pub const getMethod = Super.getMethod;
    };
}

pub fn ArrayLike(comptime S: type) type {
    return struct {
        pub const Super = Parent(S);
        pub const ByteExtent = Super.ByteExtent;
        pub const scope = Super.scope;

        pub fn getValue(self: *S, transform: accessor.Transform) !Value {
            switch (transform) {
                .plain => {
                    const len = self.getLength();
                    const ht = php.createArray();
                    for (0..len) |i| {
                        var value = try self.getElement(i);
                        try transform.apply(&value);
                        _ = php.appendHashEntry(ht, &value);
                    }
                    return php.createValueArray(ht);
                },
                .string => {
                    if (!isString(self)) return error.Unsupported;
                    const len = self.getLength();
                    const bytes = try self.buffer.data(0, false);
                    if (bytes.len == len) {
                        switch (self.buffer.source) {
                            .string => |str| {
                                // return the original string if possible
                                if (str.len == len) {
                                    php.addRef(str);
                                    return php.createValueString(str);
                                }
                            },
                            else => {},
                        }
                        return php.createValueStringContent(self.buffer.bytes);
                    } else if (bytes.len == len * 2) {
                        // convert from WTF-16 to WTF-8
                        const wtf16_ptr: [*]u16 = @ptrCast(@alignCast(bytes.ptr));
                        const wtf16_slice = wtf16_ptr[0..len];
                        const wtf8_len = std.unicode.calcWtf8Len(wtf16_slice);
                        const wtf8_str = php.createStringWithLength(wtf8_len);
                        const wtf8_slice = @constCast(php.getStringContent(wtf8_str));
                        _ = std.unicode.wtf16LeToWtf8(wtf8_slice, wtf16_slice);
                        return php.createValueString(wtf8_str);
                    } else unreachable;
                },
                .integer => return error.Unsupported,
                else => {},
            }
            return Super.getValue(self, transform);
        }

        pub fn setValue(self: *S, value: *const Value, transform: accessor.Transform) accessor.Error!void {
            if (try copySelf(self, value)) return;
            if (transform == .string) {
                if (!isString(self)) return error.Unsupported;
                const len = self.getLength();
                const bytes = try self.buffer.data(0, true);
                const str_bytes = try php.getValueStringContent(value);
                if (bytes.len == len) {
                    const str_len = str_bytes.len;
                    if (len != str_len) return reportLengthMismatch(self, len, str_len);
                    @memcpy(bytes, str_bytes);
                } else if (bytes.len == len * 2) {
                    const str_len = std.unicode.calcWtf16LeLen(str_bytes) catch return error.IncorrectEncoding;
                    if (len != str_len) return reportLengthMismatch(self, len, str_len);
                    const wtf16_ptr: [*]u16 = @ptrCast(@alignCast(bytes.ptr));
                    const wtf16_slice = wtf16_ptr[0..len];
                    _ = std.unicode.wtf8ToWtf16Le(wtf16_slice, str_bytes) catch return error.IncorrectEncoding;
                } else unreachable;
                return;
            } else if (transform == .none) {
                if (isString(self) and php.getValueType(value) == .string) {
                    return self.setValue(value, .string);
                }
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
                return;
            }
            return Super.setValue(self, value, transform);
        }

        pub fn visitPointers(self: *S, cb: anytype, args: anytype, comptime options: VisitOptions) accessor.Error!void {
            const class = ZigClassEntry.fromStructure(self);
            if (class.flags.common.has_pointer) {
                const len = self.getLength();
                for (0..len) |index| {
                    const value = try self.getElementEx(index, null);
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
            retval.* = try self.getElement(index);
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
                var value = try self.getElement(i);
                _ = php.appendHashEntry(ht, &value);
            }
            // zero-count hash table expected
            ht.gc.refcount = 0;
            return ht;
        }

        pub fn getIterator(obj: *Object) !?*ObjectIterator {
            return try iterator.ArrayIterator(S).create(obj);
        }

        pub fn isString(self: *S) bool {
            const class = ZigClassEntry.fromStructure(self);
            const flags = class.getFlags(S);
            return @hasField(@TypeOf(flags), "is_string") and flags.is_string;
        }

        pub fn reportLengthMismatch(self: *S, expected: usize, received: usize) error{Unexpected} {
            const class = ZigClassEntry.fromStructure(self);
            return failure.report("{s} '{s}' expects {d} bytes, received {d}", .{
                class.getStructureName(),
                class.getName(),
                expected,
                received,
            });
        }

        pub const fromObject = Super.fromObject;
        pub const getExtent = Super.getExtent;
        pub const setStorage = Super.setStorage;
        pub const initialize = Super.initialize;
        pub const finalize = Super.finalize;
        pub const externalize = Super.externalize;
        pub const getProperty = Super.getProperty;
        pub const setProperty = Super.setProperty;
        pub const propertyExists = Super.propertyExists;
        pub const checkArguments = Super.checkArguments;
        pub const copySelf = Super.copySelf;

        pub const readProperty = Super.readProperty;
        pub const writeProperty = Super.writeProperty;
        pub const hasProperty = Super.hasProperty;
        pub const freeObject = Super.freeObject;
        pub const castObject = Super.castObject;
        pub const getGarbageCollection = Super.getGarbageCollection;
    };
}

pub fn OptionalLike(comptime S: type) type {
    return struct {
        pub const Super = Parent(S);
        pub const ByteExtent = Super.ByteExtent;
        pub const scope = Super.scope;

        pub fn getProperties(obj: *Object) !*HashTable {
            const self = fromObject(obj);
            const child = try self.getValue(.none);
            if (php.getValueObject(&child) catch null) |child_obj| {
                defer php.release(child_obj);
                if (child_obj.handlers.*.get_properties) |f| {
                    return f(child_obj);
                }
            }
            return php.createArray();
        }

        pub fn getIterator(obj: *Object) !?*ObjectIterator {
            const self = fromObject(obj);
            var child = try self.getValue(.none);
            if (php.getValueObject(&child) catch null) |child_obj| {
                defer php.release(child_obj);
                if (child_obj.ce.*.get_iterator) |f| {
                    return f(child_obj.ce, &child, 0);
                }
            }
            return null;
        }

        pub const fromObject = Super.fromObject;
        pub const getExtent = Super.getExtent;
        pub const setStorage = Super.setStorage;
        pub const initialize = Super.initialize;
        pub const finalize = Super.finalize;
        pub const externalize = Super.externalize;
        pub const getValue = Super.getValue;
        pub const setValue = Super.setValue;
        pub const getProperty = Super.getProperty;
        pub const setProperty = Super.setProperty;
        pub const propertyExists = Super.propertyExists;
        pub const checkArguments = Super.checkArguments;
        pub const copySelf = Super.copySelf;
        pub const visitPointers = Super.visitPointers;

        pub const readProperty = Super.readProperty;
        pub const writeProperty = Super.writeProperty;
        pub const hasProperty = Super.hasProperty;
        pub const freeObject = Super.freeObject;
        pub const castObject = Super.castObject;
        pub const getGarbageCollection = Super.getGarbageCollection;
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
