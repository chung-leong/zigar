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
const ObjectIterator = php.ObjectIterator;
const ObjectIteratorFunctions = php.ObjectIteratorFunctions;
const String = php.String;
const Value = php.Value;

pub const ArrayBuffer = struct {
    buffer: ?*ByteBuffer = null,
    php_portion: Object = .{},

    var class_entry: *ClassEntry = undefined;
    var constructor: Function = undefined;
    var handlers: ObjectHandlers = undefined;

    pub const PropCache = cache.IdCache(.{ .byteLength, .detached, .readOnly }, "", .{});
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
            .readOnly => php.createValueBool(buf.flags.read_only),
        };
    }

    pub fn writeProperty(obj: *Object, name: *String, value: *Value, cache_slot: ?[*]?*anyopaque) !*Value {
        _ = obj;
        _ = value;
        if (PropCache.idFromString(name, cache_slot)) |id| {
            return switch (id) {
                .byteLength,
                .detached,
                .readOnly,
                => reportFieldError(name, .write, error.WriteProtected),
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

    pub fn compare(a: *Value, b: *Value) c_int {
        const obj_a = php.getValueObject(a) catch return -1;
        const obj_b = php.getValueObject(b) catch return 1;
        if (obj_a.ce != obj_b.ce) {
            return if (@intFromPtr(obj_a.ce) < @intFromPtr(obj_b.ce)) -1 else 1;
        }
        const self = fromObject(obj_a);
        const other = fromObject(obj_b);
        if (self.buffer == other.buffer) return 0;
        if (self.buffer) |buf_a| {
            if (other.buffer) |buf_b| {
                if (buf_a.flags.read_only != buf_b.flags.read_only) {
                    return if (buf_a.flags.read_only) 1 else -1;
                }
                if (buf_a.flags.uninitialized != buf_b.flags.uninitialized) {
                    return if (buf_a.flags.uninitialized) 1 else -1;
                }
                return switch (std.mem.order(u8, buf_a.bytes, buf_b.bytes)) {
                    .eq => 0,
                    .gt => 1,
                    .lt => -1,
                };
            } else {
                return 1;
            }
        } else {
            return -1;
        }
    }

    pub fn getGarbageCollection(obj: *Object, table: *[*c]Value, n: *c_int) !?*HashTable {
        _ = obj;
        _ = table;
        n.* = 0;
        return null;
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
            switch (php.getValueType(arg)) {
                .string => {
                    const str = php.getValueString(arg) catch unreachable;
                    const read_only = get: {
                        const arg1 = iter.next() orelse break :get false;
                        break :get try php.getValueBool(arg1);
                    };
                    buf.referenceString(str, read_only);
                },
                .long, .double => {
                    const size = try php.getValueUlong(arg);
                    try buf.allocate(null, size);
                    try buf.clear();
                },
                else => {
                    var tmp = arg.*;
                    try php.convertValue(&tmp, .string);
                    defer php.release(&tmp);
                    return failure.report("{s} expects a string or a positive integer, recevied: {s}", .{
                        class_name,
                        php.getValueStringContent(&tmp) catch unreachable,
                    });
                },
            }
        } else {
            buf.referencExternal("");
        }
        self.buffer = buf;
    }

    pub fn handleGetIterator(_: *ClassEntry, _: *Value, _: c_int) !?*ObjectIterator {
        return null;
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
        class_entry.get_iterator = php.transform(handleGetIterator);
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

        pub fn compare(a: *Value, b: *Value) c_int {
            const obj_a = php.getValueObject(a) catch return -1;
            const obj_b = php.getValueObject(b) catch return 1;
            if (obj_a.ce != obj_b.ce) {
                return if (@intFromPtr(obj_a.ce) < @intFromPtr(obj_b.ce)) -1 else 1;
            }
            const self = fromObject(obj_a);
            const other = fromObject(obj_b);
            if (self.buffer == other.buffer) return 0;
            if (self.buffer) |buf_a| {
                if (other.buffer) |buf_b| {
                    if (buf_a.flags.read_only != buf_b.flags.read_only) {
                        return if (buf_a.flags.read_only) 1 else -1;
                    }
                    if (buf_a.flags.uninitialized != buf_b.flags.uninitialized) {
                        return if (buf_a.flags.uninitialized) 1 else -1;
                    }
                    const ptr_a: [*]T = @ptrCast(@alignCast(buf_a.bytes.ptr));
                    const ptr_b: [*]T = @ptrCast(@alignCast(buf_b.bytes.ptr));
                    const len_a = buf_a.bytes.len / @sizeOf(T);
                    const len_b = buf_b.bytes.len / @sizeOf(T);
                    const items_a = ptr_a[0..len_a];
                    const items_b = ptr_b[0..len_b];
                    return switch (std.mem.order(T, items_a, items_b)) {
                        .eq => 0,
                        .gt => 1,
                        .lt => -1,
                    };
                } else {
                    return 1;
                }
            } else {
                return -1;
            }
        }

        pub fn getGarbageCollection(obj: *Object, table: *[*c]Value, n: *c_int) !?*HashTable {
            _ = obj;
            _ = table;
            n.* = 0;
            return null;
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
                switch (php.getValueType(arg)) {
                    .object => {
                        const arg_obj = php.getValueObject(arg) catch unreachable;
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
                            buf = try ab_buf.slice(offset, len * @sizeOf(T), .fromByteUnits(@alignOf(T)), 0);
                            self.array_buffer = arg_obj;
                            php.addRef(arg_obj);
                        } else if (is(arg_obj)) {
                            const other = fromObject(arg_obj);
                            const other_buf = other.buffer orelse return error.Uninitialized;
                            buf = try other_buf.duplciate();
                        } else {
                            var tmp = arg.*;
                            try php.convertValue(&tmp, .array);
                            const ht = php.getValueArray(arg) catch unreachable;
                            buf = try createBufferFromArray(ht);
                        }
                    },
                    .array => {
                        const ht = php.getValueArray(arg) catch unreachable;
                        buf = try createBufferFromArray(ht);
                    },
                    .long, .double => {
                        const len = try php.getValueUlong(arg);
                        buf = try ByteBuffer.create(.@"1");
                        errdefer buf.release();
                        try buf.allocate(null, len * @sizeOf(T));
                        try buf.clear();
                    },
                    else => {
                        var tmp = arg.*;
                        try php.convertValue(&tmp, .string);
                        return failure.report("{s} expects an ArrayBuffer, array, iterator, or positive interger, received: {s}", .{
                            class_name,
                            php.getValueStringContent(&tmp) catch unreachable,
                        });
                    },
                }
            } else {
                buf = try ByteBuffer.create(.@"1");
                buf.referencExternal("");
            }
            self.buffer = buf;
        }

        pub fn handleGetIterator(_: *ClassEntry, this: *Value, _: c_int) !?*ObjectIterator {
            const obj = try php.getValueObject(this);
            return try Iterator.create(obj);
        }

        pub fn registerClass() !void {
            const interfaces: [*c][*c]ClassEntry = @ptrCast(@alignCast(php.malloc(@sizeOf(*ClassEntry) * 2)));
            interfaces[0] = php.getInterface(.iterator);
            interfaces[1] = TypedArray.class_entry;
            var ce: ClassEntry = .{
                .name = php.persistent(class_name),
                .num_interfaces = 2,
                .unnamed_2 = .{ .interfaces = interfaces },
            };
            const parent_ce = php.getClassEntry(.standard);
            class_entry = php.registerInternalClass(&ce, parent_ce) orelse {
                return error.ClassRegistrationFailure;
            };
            class_entry.unnamed_1.create_object = php.transform(handleCreateObject);
            class_entry.get_iterator = php.transform(handleGetIterator);
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

        fn createBufferFromArray(ht: *HashTable) !*ByteBuffer {
            const buf = try ByteBuffer.create(.@"1");
            errdefer buf.release();
            try buf.allocate(null, @sizeOf(T) * ht.nNumOfElements);
            const ptr: [*]T = @ptrCast(@alignCast(buf.bytes.ptr));
            var ht_iter: HashTableIterator = .init(ht, .{});
            var index: usize = 0;
            while (ht_iter.next()) |value| {
                ptr[index] = try extractValue(value);
                index += 1;
            }
            return buf;
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

        pub const Iterator = struct {
            iter: ObjectIterator,
            object: *Object,
            len: usize,
            index: usize,

            fn fromIter(iter: *ObjectIterator) *@This() {
                return @fieldParentPtr("iter", iter);
            }

            pub fn create(obj: *Object) !*ObjectIterator {
                const self = try php.allocator.create(@This());
                const array = fromObject(obj);
                php.initializeIterator(&self.iter);
                php.addRef(obj);
                self.object = obj;
                self.len = try array.getLength();
                self.index = 0;
                self.iter.funcs = &methods;
                self.iter.data = php.createValueNull();
                return &self.iter;
            }

            pub fn destroy(iter: *ObjectIterator) void {
                const self = fromIter(iter);
                php.release(self.object);
            }

            pub fn isValid(iter: *ObjectIterator) !c_int {
                const self = fromIter(iter);
                return if (self.index < self.len) php.SUCCESS else php.FAILURE;
            }

            pub fn getCurrentData(iter: *ObjectIterator) *Value {
                const self = fromIter(iter);
                const array = fromObject(self.object);
                const buf = array.buffer.?;
                const ptr: [*]T = @ptrCast(@alignCast(buf.bytes.ptr));
                iter.data = switch (@typeInfo(T)) {
                    .int => php.createValueAnyInt(ptr[self.index]),
                    .float => php.createValueDouble(ptr[self.index]),
                    else => unreachable,
                };
                return &iter.data;
            }

            pub fn getCurrentKey(iter: *ObjectIterator, key_ptr: *Value) void {
                const self = fromIter(iter);
                key_ptr.* = php.createValueAnyInt(self.index);
            }

            pub fn moveForward(iter: *ObjectIterator) void {
                const self = fromIter(iter);
                self.index += 1;
            }

            pub fn rewind(iter: *ObjectIterator) !void {
                const self = fromIter(iter);
                self.index = 0;
            }

            const methods: ObjectIteratorFunctions = .{
                .dtor = php.transform(destroy),
                .valid = php.transform(isValid),
                .get_current_data = php.transform(getCurrentData),
                .get_current_key = php.transform(getCurrentKey),
                .move_forward = php.transform(moveForward),
                .rewind = php.transform(rewind),
            };
        };

        comptime {
            if (@offsetOf(@This(), "php_portion") + @sizeOf(Object) != @sizeOf(@This())) {
                @compileError("PHP object is in the wrong position");
            }
        }
    };
}

pub const TypedArray = struct {
    pub const class_name = "TypedArray";
    pub var class_entry: *ClassEntry = undefined;

    pub fn registerClass() !void {
        var ce: ClassEntry = .{
            .name = php.persistent(class_name),
        };
        class_entry = php.registerInternalInterface(&ce) orelse {
            return error.ClassRegistrationFailure;
        };
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
