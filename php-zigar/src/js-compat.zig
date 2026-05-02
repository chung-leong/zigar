const std = @import("std");

const accessor = @import("accessor.zig");
const ByteBuffer = @import("buffer.zig").ByteBuffer;
const cache = @import("cache.zig");
const failure = @import("failure.zig");
const php = @import("php.zig");
const ArgumentIterator = php.ArgumentIterator;
const ClassEntry = php.ClassEntry;
const ExecuteData = php.ExecuteData;
const Function = php.Function;
const HashTable = php.HashTable;
const HashTableIterator = php.HashTableIterator;
const Object = php.Object;
const ObjectHandlers = php.ObjectHandlers;
const String = php.String;
const Value = php.Value;

pub const ArrayBuffer = struct {
    buffer: ?*ByteBuffer = null,
    php_portion: Object = .{},

    var class_entry: *ClassEntry = undefined;
    var constructor: Function = undefined;
    var handlers: ObjectHandlers = undefined;

    pub const PropCache = cache.IdCache(.{ .byteLength, .detached }, "", .{});
    pub const class_name = "ArrayBuffer";

    pub inline fn object(self: *@This()) *Object {
        return &self.php_portion;
    }

    pub inline fn fromObject(obj: *Object) *@This() {
        return @fieldParentPtr("php_portion", obj);
    }

    pub fn is(obj: *const Object) bool {
        return obj.ce.? == class_entry;
    }

    pub fn create(buffer: *ByteBuffer) !*Object {
        const obj = try handleCreateObject(class_entry);
        const self = fromObject(obj);
        self.buffer = buffer;
        buffer.addRef();
        return obj;
    }

    pub fn getConstructor(_: *Object) *php.Function {
        return &constructor;
    }

    pub fn freeObject(obj: *Object) void {
        const self = fromObject(obj);
        if (self.buffer) |buf| buf.release();
    }

    pub fn castObject(obj: *Object, retval: *Value, type_id: c_int) !c_int {
        const desired_type = try php.ValueType.fromInt(type_id);
        const self = fromObject(obj);
        const buf = self.buffer orelse return error.Uninitialized;
        retval.* = switch (desired_type) {
            .string => get: {
                const str = try buf.getString(null);
                break :get php.createValueString(str);
            },
            .boolean => php.createValueBool(true),
            else => return php.FAILURE,
        };
        return php.SUCCESS;
    }

    pub fn readProperty(obj: *Object, name: *String, _: c_int, cache_slot: ?[*]?*anyopaque, retval: *Value) *Value {
        if (PropCache.idFromString(name, cache_slot)) |id| {
            const self = fromObject(obj);
            if (self.getProperty(id)) |value| {
                retval.* = value;
            } else |err| {
                php.throwError(reportFieldError(name, .read, err));
            }
        } else {
            php.throwError(reportFieldError(name, .read, error.Missing));
            retval.* = php.createValueNull();
        }
        return retval;
    }

    fn getProperty(self: *@This(), id: PropCache.Id) !Value {
        const buf = self.buffer orelse return error.Uninitialized;
        return switch (id) {
            .byteLength => php.createValueAnyInt(buf.bytes.len),
            .detached => php.createValueBool(buf.flags.uninitialized),
        };
    }

    pub fn writeProperty(obj: *Object, name: *String, value: *Value, cache_slot: ?[*]?*anyopaque) !*Value {
        _ = obj;
        _ = value;
        if (PropCache.idFromString(name, cache_slot)) |id| {
            return switch (id) {
                .byteLength, .detached => reportFieldError(name, .write, error.WriteProtected),
            };
        } else {
            return reportFieldError(name, .write, error.Missing);
        }
    }

    pub fn hasProperty(obj: *Object, name: *String, prop_type: c_int, cache_slot: ?[*]?*anyopaque) c_int {
        _ = prop_type;
        _ = obj;
        return if (PropCache.idFromString(name, cache_slot)) |_| 1 else 0;
    }

    pub fn getProperties(obj: *Object) !*HashTable {
        const self = fromObject(obj);
        const ht = php.createArray();
        inline for (comptime std.meta.fields(PropCache.Id)) |field| {
            const value = try self.getProperty(@field(PropCache.Id, field.name));
            php.setHashEntry(ht, field.name, &value);
        }
        ht.gc.refcount = 0;
        return ht;
    }

    pub fn handleCreateObject(ce: *ClassEntry) !*Object {
        const prop_size = php.getObjectPropertySize(ce);
        const size: usize = @intCast(@sizeOf(@This()) + prop_size);
        const mem = php.emalloc(size) orelse return error.OutOfMemory;
        errdefer php.efree(mem);
        const self: *@This() = @ptrCast(@alignCast(mem));
        self.* = .{};
        // initialize the PHP portion
        const obj = self.object();
        obj.handlers = &handlers;
        php.initializeStandardObject(obj, class_entry);
        return obj;
    }

    pub fn handleConstructor(ed: *ExecuteData, _: *Value) !void {
        var iter: ArgumentIterator = .init(ed);
        const obj = try php.getValueObject(&ed.This);
        const self = fromObject(obj);
        const buf = try ByteBuffer.create(.@"1");
        errdefer buf.release();
        if (iter.next()) |arg| {
            if (php.getValueString(arg) catch null) |str| {
                buf.referenceString(str);
            } else if (php.getValueUlong(arg) catch null) |size| {
                try buf.allocate(null, size);
            } else {
                var tmp = arg.*;
                try php.convertValue(&tmp, .string);
                defer php.release(&tmp);
                return failure.report("{s} expects a string or a positive integer, recevied: {s}", .{
                    class_name,
                    php.getValueStringContent(&tmp) catch unreachable,
                });
            }
        } else {
            buf.referencExternal("");
        }
        self.buffer = buf;
    }

    pub fn registerClass() !void {
        var ce: ClassEntry = .{
            .name = php.persistent(class_name),
        };
        const parent_ce = php.getClassEntry(.standard);
        class_entry = php.registerInternalClass(&ce, parent_ce) orelse {
            return error.ClassRegistrationFailure;
        };
        class_entry.unnamed_1.create_object = php.transform(handleCreateObject);
        constructor = php.createTransformedFunction(handleConstructor, "__construct", 0, true);
        handlers.offset = @offsetOf(@This(), "php_portion");
        inline for (comptime std.meta.fields(@TypeOf(php.object_handler_mapping))) |field| {
            const func_name = @field(php.object_handler_mapping, field.name);
            @field(handlers, field.name) = if (@hasDecl(@This(), func_name))
                php.transform(@field(@This(), func_name))
            else if (@hasField(@TypeOf(php.std_object_handlers.*), field.name))
                @field(php.std_object_handlers, field.name)
            else
                null;
        }
    }

    pub fn reportFieldError(name: *String, access: accessor.FieldAccess, err: anytype) error{Unexpected} {
        if (failure.match(err, error.Missing)) {
            return failure.report("no field named '{s}' in {s}", .{
                php.getStringContent(name),
                class_name,
            });
        } else {
            const message = failure.acquireMessage(err);
            defer failure.freeMessage(message);
            return failure.report("unable to {s} field '{s}' in {s}: {s}", .{
                @tagName(access),
                php.getStringContent(name),
                class_name,
                message,
            });
        }
    }

    comptime {
        if (@offsetOf(@This(), "php_portion") + @sizeOf(Object) != @sizeOf(@This())) {
            @compileError("PHP object is in the wrong position");
        }
    }
};

pub fn TypedArrayOf(comptime T: type, comptime clamped: bool) type {
    return struct {
        array_buffer: ?*Object = null,
        buffer: ?*ByteBuffer = null,
        php_portion: Object = .{},

        var class_entry: *ClassEntry = undefined;
        var constructor: Function = undefined;
        var handlers: ObjectHandlers = undefined;

        pub const PropCache = cache.IdCache(.{ .buffer, .byteLength, .byteOffset, .length }, "", .{});
        pub const class_name = switch (@typeInfo(T)) {
            .int => |int| switch (int.signedness) {
                .signed => std.fmt.comptimePrint("Int{d}Array", .{int.bits}),
                .unsigned => switch (clamped) {
                    false => std.fmt.comptimePrint("Uint{d}Array", .{int.bits}),
                    true => std.fmt.comptimePrint("Uint{d}ClampedArray", .{int.bits}),
                },
            },
            .float => |float| std.fmt.comptimePrint("Float{d}Array", .{float.bits}),
            else => @compileError("Unexpected type: " ++ @typeName(T)),
        };

        pub inline fn object(self: *@This()) *Object {
            return &self.php_portion;
        }

        pub inline fn fromObject(obj: *Object) *@This() {
            return @fieldParentPtr("php_portion", obj);
        }

        pub fn create(buffer: *ByteBuffer) !*Object {
            const obj = try handleCreateObject(class_entry);
            const self = fromObject(obj);
            self.buffer = buffer;
            buffer.addRef();
            return obj;
        }

        pub fn getConstructor(_: *Object) *php.Function {
            return &constructor;
        }

        pub fn freeObject(obj: *Object) void {
            const self = fromObject(obj);
            if (self.buffer) |buf| buf.release();
        }

        pub fn castObject(obj: *Object, retval: *Value, type_id: c_int) !c_int {
            const desired_type = try php.ValueType.fromInt(type_id);
            const self = fromObject(obj);
            const buf = self.buffer orelse return error.Uninitialized;
            retval.* = switch (desired_type) {
                .string => get: {
                    const str = try buf.getString(null);
                    break :get php.createValueString(str);
                },
                .boolean => php.createValueBool(true),
                else => return php.FAILURE,
            };
            return php.SUCCESS;
        }

        pub fn readElement(obj: *Object, key: *Value, _: c_int, retval: *Value) !*Value {
            const self = fromObject(obj);
            const len = try self.getLength();
            const index = try getIndex(key, len);
            const buf = self.buffer orelse return error.Uninitialized;
            const ptr: [*]T = @ptrCast(@alignCast(buf.bytes.ptr));
            retval.* = switch (@typeInfo(T)) {
                .int => php.createValueAnyInt(ptr[index]),
                .float => php.createValueDouble(ptr[index]),
                else => unreachable,
            };
            return retval;
        }

        pub fn writeElement(obj: *Object, key: *Value, value: *Value) !void {
            const self = fromObject(obj);
            const len = try self.getLength();
            const index = try getIndex(key, len);
            const buf = self.buffer orelse return error.Uninitialized;
            const ptr: [*]T = @ptrCast(@alignCast(buf.bytes.ptr));
            ptr[index] = try extractValue(value);
        }

        pub fn hasElement(obj: *Object, key: *Value, _: c_int) !c_int {
            const self = fromObject(obj);
            const len = try self.getLength();
            return if (getIndex(key, len)) |_| 1 else |_| 0;
        }

        pub fn countElements(obj: *Object, count: *php.Long) !c_int {
            const self = fromObject(obj);
            const len = try self.getLength();
            if (len > std.math.maxInt(php.Long)) return error.TooLarge;
            count.* = @intCast(len);
            return php.SUCCESS;
        }

        fn getIndex(key: *Value, len: usize) !usize {
            const key_long = try php.getValueLong(key);
            if (key_long < 0) return error.NegativeIndex;
            const index: usize = @intCast(key_long);
            // need bound check needed even though the ByteBuffer performs bound check because
            // element might be zero-bit
            if (index >= len) return error.OutOfBound;
            return index;
        }

        pub fn readProperty(obj: *Object, name: *String, _: c_int, cache_slot: ?[*]?*anyopaque, retval: *Value) *Value {
            if (PropCache.idFromString(name, cache_slot)) |id| {
                const self = fromObject(obj);
                if (self.getProperty(id)) |value| {
                    retval.* = value;
                } else |err| {
                    php.throwError(reportFieldError(name, .read, err));
                }
            } else {
                php.throwError(reportFieldError(name, .read, error.Missing));
                retval.* = php.createValueNull();
            }
            return retval;
        }

        pub fn writeProperty(obj: *Object, name: *String, value: *Value, cache_slot: ?[*]?*anyopaque) !*Value {
            _ = obj;
            _ = value;
            if (PropCache.idFromString(name, cache_slot)) |id| {
                return switch (id) {
                    else => reportFieldError(name, .write, error.WriteProtected),
                };
            } else {
                return reportFieldError(name, .write, error.Missing);
            }
        }

        pub fn hasProperty(obj: *Object, name: *String, prop_type: c_int, cache_slot: ?[*]?*anyopaque) c_int {
            _ = prop_type;
            _ = obj;
            return if (PropCache.idFromString(name, cache_slot)) |_| 1 else 0;
        }

        pub fn getProperties(obj: *Object) !*HashTable {
            const self = fromObject(obj);
            const buf = self.buffer orelse return error.Uninitialized;
            const len = try self.getLength();
            const ptr: [*]T = @ptrCast(@alignCast(buf.bytes.ptr));
            const ht = php.createArray();
            for (0..len) |index| {
                const value = switch (@typeInfo(T)) {
                    .int => php.createValueAnyInt(ptr[index]),
                    .float => php.createValueDouble(ptr[index]),
                    else => unreachable,
                };
                _ = php.appendHashEntry(ht, &value);
            }
            ht.gc.refcount = 0;
            return ht;
        }

        pub fn handleCreateObject(ce: *ClassEntry) !*Object {
            const prop_size = php.getObjectPropertySize(ce);
            const size: usize = @intCast(@sizeOf(@This()) + prop_size);
            const mem = php.emalloc(size) orelse return error.OutOfMemory;
            errdefer php.efree(mem);
            const self: *@This() = @ptrCast(@alignCast(mem));
            self.* = .{};
            // initialize the PHP portion
            const obj = self.object();
            obj.handlers = &handlers;
            php.initializeStandardObject(obj, class_entry);
            return obj;
        }

        pub fn handleConstructor(ed: *ExecuteData, _: *Value) !void {
            var iter: ArgumentIterator = .init(ed);
            const obj = try php.getValueObject(&ed.This);
            const self = fromObject(obj);
            var buf: *ByteBuffer = undefined;
            if (iter.next()) |arg| {
                if (php.getValueObject(arg) catch null) |arg_obj| {
                    if (ArrayBuffer.is(arg_obj)) {
                        const ab = ArrayBuffer.fromObject(arg_obj);
                        const ab_buf = ab.buffer orelse return error.Uninitialized;
                        const offset: usize = if (iter.next()) |arg1| get: {
                            const i = try php.getValueUlong(arg1);
                            if (i % @sizeOf(T) != 0) return error.InvalidOffset;
                            break :get i;
                        } else 0;
                        const len: usize = if (iter.next()) |arg2| get: {
                            const n = try php.getValueUlong(arg2);
                            if (offset + n * @sizeOf(T) > ab_buf.bytes.len) return error.InvalidLength;
                            break :get n;
                        } else calc: {
                            if (offset > ab_buf.bytes.len) return error.InvalidOffset;
                            const byte_len = ab_buf.bytes.len - offset;
                            const n = byte_len / @sizeOf(T);
                            if (n * @sizeOf(T) != byte_len) return error.InvalidLength;
                            break :calc n;
                        };
                        buf = try ab_buf.slice(offset, len, .fromByteUnits(@alignOf(T)), 0);
                        self.array_buffer = arg_obj;
                        php.addRef(arg_obj);
                    }
                } else if (php.getValueArray(arg) catch null) |ht| {
                    buf = try ByteBuffer.create(.@"1");
                    errdefer buf.release();
                    try buf.allocate(null, ht.nNumOfElements);
                    const ptr: [*]T = @ptrCast(@alignCast(buf.bytes.ptr));
                    var ht_iter: HashTableIterator = .init(ht, .{});
                    var index: usize = 0;
                    while (ht_iter.next()) |value| {
                        ptr[index] = try extractValue(value);
                        index += 1;
                    }
                } else if (php.getValueUlong(arg) catch null) |len| {
                    buf = try ByteBuffer.create(.@"1");
                    errdefer buf.release();
                    try buf.allocate(null, len * @sizeOf(T));
                    try buf.clear();
                } else {
                    var tmp = arg.*;
                    try php.convertValue(&tmp, .string);
                    return failure.report("{s} expects an ArrayBuffer, array, iterator, or positive interger, received: {s}", .{
                        class_name,
                        php.getValueStringContent(&tmp) catch unreachable,
                    });
                }
            } else {
                buf = try ByteBuffer.create(.@"1");
                buf.referencExternal("");
            }
            self.buffer = buf;
        }

        pub fn registerClass() !void {
            var ce: ClassEntry = .{
                .name = php.persistent(class_name),
                .num_interfaces = TypedArray.interfaces.len,
                .unnamed_2 = .{
                    .interfaces = @ptrCast(&TypedArray.interfaces),
                },
            };
            const parent_ce = php.getClassEntry(.standard);
            class_entry = php.registerInternalClass(&ce, parent_ce) orelse {
                return error.ClassRegistrationFailure;
            };
            class_entry.unnamed_1.create_object = php.transform(handleCreateObject);
            constructor = php.createTransformedFunction(handleConstructor, "__construct", 0, true);
            inline for (comptime std.meta.fields(@TypeOf(php.object_handler_mapping))) |field| {
                const func_name = @field(php.object_handler_mapping, field.name);
                @field(handlers, field.name) = if (@hasDecl(@This(), func_name))
                    php.transform(@field(@This(), func_name))
                else if (@hasField(@TypeOf(php.std_object_handlers.*), field.name))
                    @field(php.std_object_handlers, field.name)
                else
                    null;
            }
        }

        fn getProperty(self: *@This(), id: PropCache.Id) !Value {
            const buf = self.buffer orelse return error.Uninitialized;
            switch (id) {
                .buffer => {
                    if (self.array_buffer) |obj| {
                        php.addRef(obj);
                        return php.createValueObject(obj);
                    } else {
                        const parent_buf = buf.getBase();
                        const obj = try ArrayBuffer.create(parent_buf);
                        self.array_buffer = obj;
                        return php.createValueObject(obj);
                    }
                },
                .byteLength => {
                    return php.createValueAnyInt(buf.bytes.len);
                },
                .byteOffset => {
                    const parent_buf = buf.getBase();
                    const offset = @intFromPtr(parent_buf.bytes.ptr) - @intFromPtr(buf.bytes.ptr);
                    return php.createValueAnyInt(offset);
                },
                .length => {
                    const len = try self.getLength();
                    return php.createValueAnyInt(len);
                },
            }
        }

        fn getLength(self: *@This()) !usize {
            const buf = self.buffer orelse return error.Uninitialized;
            return buf.bytes.len / @sizeOf(T);
        }

        fn extractValue(value: *Value) !T {
            return switch (@typeInfo(T)) {
                .int => |int| switch (int.signedness) {
                    .signed => @truncate(try php.getValueLong(value)),
                    .unsigned => switch (clamped) {
                        false => @truncate(try php.getValueUlong(value)),
                        true => get: {
                            const min = comptime std.math.minInt(T);
                            const max = comptime std.math.maxInt(T);
                            const num = try php.getValueLong(value);
                            break :get if (num < min)
                                min
                            else if (num > max)
                                max
                            else
                                @intCast(num);
                        },
                    },
                },
                .float => @floatCast(try php.getValueDouble(value)),
                else => unreachable,
            };
        }

        fn reportFieldError(name: *String, access: accessor.FieldAccess, err: anytype) error{Unexpected} {
            if (failure.match(err, error.Missing)) {
                return failure.report("no field named '{s}' in {s}", .{
                    php.getStringContent(name),
                    class_name,
                });
            } else {
                const message = failure.acquireMessage(err);
                defer failure.freeMessage(message);
                return failure.report("unable to {s} field '{s}' in {s}: {s}", .{
                    @tagName(access),
                    php.getStringContent(name),
                    class_name,
                    message,
                });
            }
        }

        comptime {
            if (@offsetOf(@This(), "php_portion") + @sizeOf(Object) != @sizeOf(@This())) {
                @compileError("PHP object is in the wrong position");
            }
        }
    };
}

pub const TypedArray = struct {
    var class_entry: *ClassEntry = undefined;

    pub const class_name = "TypedArray";
    pub var interfaces: [2]*ClassEntry = undefined;

    pub fn registerClass() !void {
        var ce: ClassEntry = .{
            .name = php.persistent(class_name),
        };
        class_entry = php.registerInternalInterface(&ce) orelse {
            return error.ClassRegistrationFailure;
        };
        interfaces = .{ class_entry, php.getInterface(.iterator) };
    }
};

pub fn registerClasses() !void {
    try ArrayBuffer.registerClass();
    try TypedArray.registerClass();
    inline for (.{ i8, i16, i32, i64, u8, u16, u32, u64, f16, f32, f64 }) |T| {
        try TypedArrayOf(T, false).registerClass();
    }
    try TypedArrayOf(u8, true).registerClass();
}
