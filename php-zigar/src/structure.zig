const std = @import("std");

const interface = @import("./module/native/interface.zig");
const StructureType = interface.StructureType;
const accessor = @import("accessor.zig");
const ByteBuffer = @import("buffer.zig").ByteBuffer;
const failure = @import("failure.zig");
const Error = failure.Error;
const getObjectBuffer = @import("object.zig").getObjectBuffer;
const iterator = @import("iterator.zig");
const js_compat = @import("js-compat.zig");
const php = @import("php.zig");
const ArgumentIterator = php.ArgumentIterator;
const ClassEntry = php.ClassEntry;
const ExecuteData = php.ExecuteData;
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
pub const VisitOptions = packed struct {
    ignore_inactive: bool = true,
    ignore_uncreated: bool = true,
    ignore_arguments: bool = true,
    ignore_return_value: bool = true,
};

pub fn enumName(comptime S: type) []const u8 {
    return inline for (comptime std.meta.fields(@TypeOf(by_enum))) |field| {
        if (@field(by_enum, field.name) == S) break field.name;
    } else @compileError("Unrecognized structure type: " ++ @typeName(S));
}

pub fn Parent(comptime S: type) type {
    return struct {
        pub const scope: ZigClassEntry.ScopeType = if (@hasDecl(S, "scope")) S.scope else .instance;

        pub fn object(self: *S) *Object {
            return &ZigObject(S).fromStructure(self).php_portion;
        }

        pub fn fromObject(obj: *Object) *S {
            return &ZigObject(S).fromObject(obj).zig_portion;
        }

        pub fn fromValue(value: *const Value) !*S {
            const obj = try php.getValueObject(value);
            return fromObject(obj);
        }

        pub fn toValue(self: *S) Value {
            const obj = object(self);
            return php.createValueObject(php.reuse(obj));
        }

        pub fn getExtent(self: *S) ByteBuffer.Extent {
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

        pub fn initialize(self: *S, allocator: ?*std.mem.Allocator, initializer: ?*const Value, read_only: bool) !void {
            if (!@hasField(S, "buffer")) return;
            const class = ZigClassEntry.fromStructure(self);
            const len = class.byte_size orelse 0;
            try self.buffer.allocate(allocator, len);
            const initialized = attempt: {
                if (initializer) |value| {
                    if (!php.isValueNull(value)) {
                        try self.setValue(value, .none);
                        break :attempt true;
                    }
                }
                break :attempt false;
            };
            if (!initialized) {
                if (class.instance.template.buffer) |def| {
                    try self.buffer.copy(def);
                }
            }
            if (read_only) self.buffer.protect();
        }

        pub fn finalize(self: *S, _: bool) !void {
            if (@hasField(S, "buffer")) {
                const obj = ZigObject(S).fromStructure(self).object();
                const class = ZigClassEntry.fromObject(obj);
                if (!self.buffer.flags.uninitialized and !self.buffer.flags.transient) {
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

        pub fn visitPointers(self: *S, cb: anytype, args: anytype, comptime options: VisitOptions) Error!void {
            _ = self;
            _ = cb;
            _ = args;
            _ = options;
        }

        pub fn checkArguments(self: *S, arg_iter: *ArgumentIterator) !void {
            if (arg_iter.len != 1) {
                const class = ZigClassEntry.fromStructure(self);
                return failure.report("{s} constructor expects one argument", .{
                    class.getStructureName(),
                });
            }
        }

        pub fn getValue(self: *S, transform: accessor.Transform) Error!Value {
            switch (transform) {
                .string, .integer, .float, .boolean => |tm| {
                    var value = try self.getValue(.none);
                    if (php.getValueObject(&value) catch null) |obj| {
                        if (ZigClassEntry.isZig(obj.ce)) {
                            defer php.release(obj);
                            return if (tm == .boolean) php.createValueBool(true) else error.Unsupported;
                        }
                    }
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
                .plain, .clamped_array, .typed_array => return error.Unsupported,
                .none => {
                    const obj = object(self);
                    return php.createValueObject(php.reuse(obj));
                },
            }
        }

        pub fn setValue(self: *S, value: *const Value, transform: accessor.Transform) Error!void {
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
            const obj = php.getValueObject(value) catch return false;
            const class = ZigClassEntry.fromStructure(self);
            if (!php.instanceOf(obj, class.entry())) return false;
            const obj_struct = S.fromObject(obj);
            try self.buffer.copy(obj_struct.buffer);
            return true;
        }

        pub fn getProperty(self: *S, name: *String, cache_slot: ?[*]?*anyopaque) Error!Value {
            const class = ZigClassEntry.fromStructure(self);
            const transform_cache = class.getTransformCache();
            const transform = transform_cache.idFromString(name, cache_slot) orelse return error.Missing;
            return try self.getValue(transform);
        }

        pub fn setProperty(self: *S, name: *String, value: *const Value, cache_slot: ?[*]?*anyopaque) Error!void {
            const class = ZigClassEntry.fromStructure(self);
            const transform_cache = class.getTransformCache();
            const transform = transform_cache.idFromString(name, cache_slot) orelse return error.Missing;
            return try self.setValue(value, transform);
        }

        pub fn propertyExists(self: *S, name: *String, cache_slot: ?[*]?*anyopaque) bool {
            const class = ZigClassEntry.fromStructure(self);
            const transform_cache = class.getTransformCache();
            return transform_cache.idFromString(name, cache_slot) != null;
        }

        pub fn findMethod(self: *S, name: *String) !?*php.Function {
            // methods are actually static functions with self as the first argument
            const class = ZigClassEntry.fromStructure(self);
            const member = try class.getMember(.static, name);
            if (!member.flags.is_method) return null;
            const class_struct = Class(S).fromObject(class.object);
            var field_value = try member.accessors.get(class_struct);
            defer php.release(&field_value);
            const field_obj = php.getValueObject(&field_value) catch return null;
            const field_class = ZigClassEntry.fromObject(field_obj);
            if (field_class.type != .function) return null;
            const func_struct = Function.fromObject(field_obj);
            const func = &func_struct.closure.php_portion;
            func.internal_function.function_name = name;
            return func;
        }

        pub fn reportFieldError(self: *S, name: *String, access: accessor.FieldAccess, err: anytype) error{ ExceptionThrown, FailureReported } {
            const class = ZigClassEntry.fromStructure(self);
            if (failure.match(err, error.FailureReported)) {
                return error.FailureReported;
            } else if (failure.match(err, error.Missing)) {
                return switch (access) {
                    .call => failure.report("{s} '{s}' has no function named '{s}'", .{
                        class.getStructureName(),
                        class.getName(),
                        php.getStringContent(name),
                    }),
                    .read, .write => switch (scope) {
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
                    },
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

        pub fn getConstructor(obj: *Object) *php.Function {
            const class = ZigClassEntry.fromObject(obj);
            const class_obj = class.object;
            const class_struct = Class(S).fromObject(class_obj);
            return &class_struct.constructor;
        }

        pub fn cloneObject(obj: *Object) *Object {
            const class = ZigClassEntry.fromObject(obj);
            const initializer = php.createValueObject(obj);
            const buf = getObjectBuffer(obj);
            const new_obj = class.createObject(null, &initializer, buf.flags.read_only) catch |err| {
                @panic(@errorName(err));
            };
            return new_obj;
        }

        pub fn freeObject(obj: *Object) void {
            const self = fromObject(obj);
            const class = ZigClassEntry.fromObject(obj);
            // std.debug.print("freeObject: {s} => {}, object {d}, {x}, refcount = {d}\n", .{ class.getName(), S, obj.handle, @intFromPtr(self), obj.gc.refcount });
            // only structure that a pointer can points to implement getExtent()
            if (@hasField(S, "buffer")) {
                if (@hasDecl(S, "getExtent")) {
                    if (!self.buffer.flags.uninitialized and !self.buffer.flags.transient) {
                        class.unregisterObject(obj);
                    }
                }
                self.buffer.release();
            }
            if (@hasField(S, "table")) {
                // switch (S) {
                //     ArgStruct, Optional, Pointer => {
                //         std.debug.print("freeObject: {s} => {}, object {d}, {x}, refcount = {d}\n", .{ class.getName(), S, obj.handle, @intFromPtr(self), obj.gc.refcount });
                //         if (php.getValueType(&self.table) == .array) {
                //             const ht = php.getValueHashTable(&self.table) catch unreachable;
                //             var iter: php.HashTableIterator = .init(ht, .{});
                //             while (iter.next()) |child| {
                //                 if (php.getValueObject(child) catch null) |child_obj| {
                //                     // if (child_obj.gc.refcount > 1) {
                //                     std.debug.print("slot {d}: object {d}, refcount = {d}\n", .{ iter.currentIndex().?, child_obj.handle, child_obj.gc.refcount });
                //                     // }
                //                 }
                //             }
                //         } else if (php.getValueType(&self.table) == .object) {
                //             if (php.getValueObject(&self.table) catch null) |child_obj| {
                //                 // if (child_obj.gc.refcount > 1) {
                //                 std.debug.print("slot X: object {d}, refcount = {d}\n", .{ child_obj.handle, child_obj.gc.refcount });
                //                 // }
                //             }
                //         }
                //     },
                //     else => {},
                // }
                php.release(&self.table);
            }
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
            var retval_type = php.getValueType(retval);
            // boolean is not a real type
            if (retval_type == .true or retval_type == .false) {
                retval_type = .boolean;
            }
            if (retval_type != desired_type) {
                php.release(retval);
                return php.FAILURE;
            }
            return php.SUCCESS;
        }

        pub fn readProperty(obj: *Object, name: *String, prop_type: c_int, cache_slot: ?[*]?*anyopaque, retval: *Value) *Value {
            // unlike readElement(), PHP does not expect this function to return a null pointer;
            // we cannot therefore return an error union;
            const self = fromObject(obj);
            if (self.getProperty(name, cache_slot)) |value| {
                retval.* = value;
                if (prop_type == php.BP_VAR_UNSET) {
                    php.throwError(error.IllegalOperation);
                } else if (prop_type == php.BP_VAR_W) {
                    if (php.getValueType(&value) != .object) {
                        php.throwError(error.IllegalOperation);
                    }
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

        pub fn getPropertyPointer(obj: *Object, name: *String, prop_type: c_int, cache_slot: ?[*]?*anyopaque) ?*Value {
            _ = obj;
            _ = name;
            _ = prop_type;
            _ = cache_slot;
            return null;
        }

        pub fn getMethod(obj_ptr: *[*c]Object, name: *String, _: ?*const Value) !?*php.Function {
            const obj = obj_ptr.*;
            const self = fromObject(obj);
            return self.findMethod(name) catch |err| {
                return reportFieldError(self, name, .call, err);
            };
        }

        pub fn compare(a: *Value, b: *Value) !c_int {
            const obj_a = php.getValueObject(a) catch return -1;
            const obj_b = php.getValueObject(b) catch return 1;
            if (obj_a == obj_b) return 0;
            if (obj_a.ce != obj_b.ce) {
                return if (@intFromPtr(obj_a.ce) < @intFromPtr(obj_b.ce)) -1 else 1;
            }
            const struct_a = fromObject(obj_a);
            const struct_b = fromObject(obj_b);
            const value_a = try struct_a.getValue(.none);
            defer php.release(&value_a);
            const value_b = try struct_b.getValue(.none);
            defer php.release(&value_b);
            return php.compareValues(&value_a, &value_b);
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
        pub const scope = Super.scope;

        pub fn getValue(self: *S, transform: accessor.Transform) !Value {
            switch (transform) {
                .string, .integer => return error.Unsupported,
                .plain => {
                    const obj = object(self);
                    const class = ZigClassEntry.fromObject(obj);
                    var plain = class.host.getPlainObject(obj, class.flags.@"struct".is_tuple);
                    if (plain.status == .existing) return plain.value;
                    defer class.host.removePlainObject(obj);
                    var iter: iterator.PropertyIterator(S) = .init(obj);
                    defer iter.deinit();
                    while (iter.next()) |prop_value| {
                        try transform.apply(prop_value);
                        plain.add(iter.current_name.?, prop_value);
                    }
                    return plain.value;
                },
                else => {},
            }
            return Super.getValue(self, transform);
        }

        pub fn getProperty(self: *S, name: *String, cache_slot: ?[*]?*anyopaque) Error!Value {
            return if (findMember(self, name, cache_slot)) |member|
                try member.accessors.get(self)
            else
                try Super.getProperty(self, name, cache_slot);
        }

        pub fn setProperty(self: *S, name: *String, value: *const Value, cache_slot: ?[*]?*anyopaque) Error!void {
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

        pub fn findMethod(self: *S, name: *String) !?*php.Function {
            return Super.findMethod(self, name) catch |err| {
                if (err != error.Missing) return err;
                // maybe we're invoking a function pointer
                const value = try self.getProperty(name, null);
                defer php.release(&value);
                const obj = php.getValueObject(&value) catch return error.NotFunction;
                const func = invokeMethod(obj, "getCallable", .{}) catch |prop_err| {
                    return if (err == error.NotImplemented) error.NotFunction else prop_err;
                };
                return func;
            };
        }

        pub fn findMember(self: *S, name: *String, cache_slot: ?[*]?*anyopaque) ?*const ZigClassEntry.Member {
            const class = ZigClassEntry.fromStructure(self);
            const member_cache = class.getMemberCache();
            if (member_cache.find(cache_slot, class)) |m| return m;
            const member = class.getMember(scope, name) catch return null;
            member_cache.set(cache_slot, class, member);
            return member;
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

        pub fn getProperties(obj: *Object) !*HashTable {
            var iter: iterator.PropertyIterator(S) = .init(obj);
            defer iter.deinit();
            const ht = php.createArray();
            while (iter.next()) |value| {
                php.setHashEntryRef(ht, iter.current_name.?, value);
            }
            // caller seem to expect a hash table with zero refcount
            ht.gc.refcount = 0;
            return ht;
        }

        pub fn compare(a: *Value, b: *Value) !c_int {
            const obj_a = php.getValueObject(a) catch return -1;
            const obj_b = php.getValueObject(b) catch return 1;
            if (obj_a == obj_b) return 0;
            if (obj_a.ce != obj_b.ce) {
                return if (@intFromPtr(obj_a.ce) < @intFromPtr(obj_b.ce)) -1 else 1;
            }
            var iter_a: iterator.PropertyIterator(S) = .init(obj_a);
            defer iter_a.deinit();
            var iter_b: iterator.PropertyIterator(S) = .init(obj_b);
            defer iter_b.deinit();
            return while (iter_a.next()) |child_value_a| {
                const child_value_b = iter_b.next().?;
                const result = php.compareValues(child_value_a, child_value_b);
                if (result != 0) break result;
            } else 0;
        }

        pub fn getIterator(obj: *Object) !?*ObjectIterator {
            return try iterator.PropertyIterator(S).create(obj);
        }

        pub const object = Super.object;
        pub const fromObject = Super.fromObject;
        pub const fromValue = Super.fromValue;
        pub const toValue = Super.toValue;
        pub const getExtent = Super.getExtent;
        pub const setStorage = Super.setStorage;
        pub const initialize = Super.initialize;
        pub const finalize = Super.finalize;
        pub const externalize = Super.externalize;
        pub const setValue = Super.setValue;
        pub const checkArguments = Super.checkArguments;
        pub const copySelf = Super.copySelf;
        pub const visitPointers = Super.visitPointers;
        pub const reportFieldError = Super.reportFieldError;

        pub const getConstructor = Super.getConstructor;
        pub const cloneObject = Super.cloneObject;
        pub const readProperty = Super.readProperty;
        pub const writeProperty = Super.writeProperty;
        pub const hasProperty = Super.hasProperty;
        pub const getPropertyPointer = Super.getPropertyPointer;
        pub const freeObject = Super.freeObject;
        pub const castObject = Super.castObject;
        pub const getMethod = Super.getMethod;
        pub const getGarbageCollection = Super.getGarbageCollection;
    };
}

pub fn ArrayLike(comptime S: type) type {
    return struct {
        pub const Super = Parent(S);
        pub const scope = Super.scope;

        pub fn getValue(self: *S, transform: accessor.Transform) !Value {
            switch (transform) {
                .plain => return try createPlainArray(self, transform),
                .string => {
                    if (!isString(self)) {
                        if (S == Slice or S == Array) {
                            return try createPlainArray(self, .string);
                        }
                        return error.Unsupported;
                    }
                    const len = self.getLength();
                    const bytes = try self.buffer.data(0, false);
                    if (bytes.len == len) {
                        switch (self.buffer.source_type) {
                            .string => {
                                // return the original string if possible
                                const str = self.buffer.source.string;
                                if (str.len == len) return php.createValueString(php.reuse(str));
                            },
                            else => {},
                        }
                        return php.createValueStringContent(self.buffer.bytes);
                    } else if (bytes.len == len * 2) {
                        // convert from WTF-16 to WTF-8
                        const wtf16_ptr: [*]const u16 = @ptrCast(@alignCast(bytes.ptr));
                        const wtf16_slice = wtf16_ptr[0..len];
                        const wtf8_len = std.unicode.calcWtf8Len(wtf16_slice);
                        const wtf8_str = php.createStringWithLength(wtf8_len);
                        const wtf8_slice = @constCast(php.getStringContent(wtf8_str));
                        _ = std.unicode.wtf16LeToWtf8(wtf8_slice, wtf16_slice);
                        return php.createValueString(wtf8_str);
                    } else unreachable;
                },
                .integer => return error.Unsupported,
                .typed_array => {
                    const class = ZigClassEntry.fromStructure(self);
                    const obj = try class.createTypedArray(self.buffer);
                    return php.createValueObject(obj);
                },
                .clamped_array => {
                    const class = ZigClassEntry.fromStructure(self);
                    const obj = try class.createClampedArray(self.buffer);
                    return php.createValueObject(obj);
                },
                else => {},
            }
            return Super.getValue(self, transform);
        }

        fn createPlainArray(self: *S, elem_transform: accessor.Transform) !Value {
            const len = self.getLength();
            const ht = php.createArray();
            for (0..len) |i| {
                var value = try self.getElement(i);
                try elem_transform.apply(&value);
                _ = php.appendHashEntry(ht, &value);
            }
            return php.createValueArray(ht);
        }

        pub fn setValue(self: *S, orig_value: *const Value, transform: accessor.Transform) Error!void {
            if (try copySelf(self, orig_value)) return;
            const value = &php.convertIterator(orig_value);
            defer php.release(value);
            switch (transform) {
                .string => {
                    if (!isString(self)) return error.Unsupported;
                    const len = self.getLength();
                    const bytes = try self.buffer.data(0, true);
                    const str_bytes = try php.getValueStringContent(value);
                    const class = ZigClassEntry.fromStructure(self);
                    if (bytes.len == len) {
                        const str_len = str_bytes.len;
                        if (len != str_len) return failure.reportLengthMismatch(class, len, str_len);
                        @memcpy(bytes, str_bytes);
                    } else if (bytes.len == len * 2) {
                        const str_len = std.unicode.calcWtf16LeLen(str_bytes) catch return error.IncorrectEncoding;
                        if (len != str_len) return failure.reportLengthMismatch(class, len, str_len);
                        const wtf16_ptr: [*]u16 = @ptrCast(@alignCast(bytes.ptr));
                        const wtf16_slice = wtf16_ptr[0..len];
                        _ = std.unicode.wtf8ToWtf16Le(wtf16_slice, str_bytes) catch return error.IncorrectEncoding;
                    } else unreachable;
                    return;
                },
                .none => {
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
                },
                else => {},
            }
            return Super.setValue(self, value, transform);
        }

        pub fn visitPointers(self: *S, cb: anytype, args: anytype, comptime options: VisitOptions) Error!void {
            const class = ZigClassEntry.fromStructure(self);
            if (class.flags.common.has_pointer) {
                const len = self.getLength();
                for (0..len) |index| {
                    if (try self.getElementObject(index, !options.ignore_uncreated)) |obj| {
                        try invokeMethod(obj, "visitPointers", .{ cb, args, options });
                    }
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

        pub fn compare(a: *Value, b: *Value) !c_int {
            const obj_a = php.getValueObject(a) catch return -1;
            const obj_b = php.getValueObject(b) catch return 1;
            if (obj_a == obj_b) return 0;
            if (obj_a.ce != obj_b.ce) {
                return if (@intFromPtr(obj_a.ce) < @intFromPtr(obj_b.ce)) -1 else 1;
            }
            const struct_a = S.fromObject(obj_a);
            const struct_b = S.fromObject(obj_b);
            const len_a = struct_a.getLength();
            const len_b = struct_b.getLength();
            const len = @min(len_a, len_b);
            return for (0..len) |i| {
                const value_a = try struct_a.getElement(i);
                defer php.release(&value_a);
                const value_b = try struct_b.getElement(i);
                defer php.release(&value_b);
                const result = php.compareValues(&value_a, &value_b);
                if (result != 0) break result;
            } else if (len_a == len_b) 0 else if (len_a < len_b) -1 else 1;
        }

        pub fn getIterator(obj: *Object) !?*ObjectIterator {
            return try iterator.ArrayIterator(S).create(obj);
        }

        pub fn isString(self: *S) bool {
            const class = ZigClassEntry.fromStructure(self);
            const flags = class.getFlags(S);
            return @hasField(@TypeOf(flags), "is_string") and flags.is_string;
        }

        pub const fromObject = Super.fromObject;
        pub const fromValue = Super.fromValue;
        pub const toValue = Super.toValue;
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

        pub const getConstructor = Super.getConstructor;
        pub const readProperty = Super.readProperty;
        pub const writeProperty = Super.writeProperty;
        pub const hasProperty = Super.hasProperty;
        pub const getPropertyPointer = Super.getPropertyPointer;
        pub const cloneObject = Super.cloneObject;
        pub const freeObject = Super.freeObject;
        pub const castObject = Super.castObject;
        pub const getGarbageCollection = Super.getGarbageCollection;
    };
}

pub fn OptionalLike(comptime S: type) type {
    return struct {
        pub const Super = Parent(S);
        pub const scope = Super.scope;

        pub fn getElement(self: *S, index: usize) Error!Value {
            const target_obj = self.getChildObject() orelse return error.AccessingMissingObject;
            return invokeMethod(target_obj, "getElement", .{index});
        }

        pub fn setElement(self: *S, index: usize, value: *const Value) Error!void {
            const target_obj = self.getChildObject() orelse return error.AccessingMissingObject;
            return invokeMethod(target_obj, "setElement", .{ index, value });
        }

        pub fn getLength(self: *S) usize {
            const target_obj = self.getChildObject() orelse return 0;
            return invokeMethod(target_obj, "getLength", .{}) catch unreachable;
        }

        pub fn findMethod(self: *S, name: *String) Error!?*php.Function {
            const target_obj = self.getChildObject() orelse return error.AccessingMissingObject;
            return invokeMethod(target_obj, "findMethod", .{name}) catch |err| check: {
                break :check if (err == error.Missing) null else err;
            };
        }

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
        pub const fromValue = Super.fromValue;
        pub const toValue = Super.toValue;
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
        pub const readElement = ArrayLike(S).readElement;
        pub const writeElement = ArrayLike(S).writeElement;
        pub const hasElement = ArrayLike(S).hasElement;
        pub const countElements = ArrayLike(S).countElements;
        pub const checkArguments = Super.checkArguments;
        pub const copySelf = Super.copySelf;
        pub const visitPointers = Super.visitPointers;

        pub const getConstructor = Super.getConstructor;
        pub const cloneObject = Super.cloneObject;
        pub const readProperty = Super.readProperty;
        pub const writeProperty = Super.writeProperty;
        pub const hasProperty = Super.hasProperty;
        pub const getPropertyPointer = Super.getPropertyPointer;
        pub const freeObject = Super.freeObject;
        pub const castObject = Super.castObject;
        pub const compare = Super.compare;
        pub const getMethod = Super.getMethod;
        pub const getGarbageCollection = Super.getGarbageCollection;
    };
}

pub fn invokeMethod(obj: *Object, comptime name: []const u8, args: anytype) RT: {
    // merge the error sets of all implementations and verify that they have the same payload
    var error_set = error{};
    var payload: ?type = null;
    for (std.meta.fields(@TypeOf(by_enum))) |field| {
        const S = @field(by_enum, field.name);
        if (@hasDecl(S, name)) {
            const RT = ReturnType(S, name);
            if (ErrorType(RT)) |ES| {
                error_set = error_set || ES;
            }
            const PL = Payload(RT);
            if (payload) |current| {
                if (PL != current) {
                    @compileError(@typeName(S) ++ "." ++ name ++ "() returns " ++ @typeName(PL) ++ " instead of " ++ @typeName(current));
                }
            } else {
                payload = PL;
            }
        } else {
            error_set = error_set || error{NotImplemented};
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
            switch (ZigObject(S).isInstance(obj)) {
                inline else => |is_instance| {
                    const T = if (is_instance) S else C;
                    if (comptime @hasDecl(T, name)) {
                        const func = @field(T, name);
                        const self = T.fromObject(obj);
                        const RT = ReturnType(T, name);
                        const result = @call(.auto, func, .{self} ++ args);
                        return if (ErrorType(RT) != null) try result else result;
                    } else {
                        return error.NotImplemented;
                    }
                },
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
