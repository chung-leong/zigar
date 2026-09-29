const std = @import("std");

const accessor = @import("accessor.zig");
const ByteBuffer = @import("buffer.zig").ByteBuffer;
const cache = @import("cache.zig");
const failure = @import("failure.zig");
const php_ng = @import("php/root.zig");
const pi = php_ng.imports;
const Array = php_ng.Array;
const c = php_ng.c;
const Class = php_ng.Class;
const Function = php_ng.Function;
const Object = php_ng.Object;
const PropertiesPurpose = Object.PropertiesPurpose;
const PropertyStatus = Object.PropertyStatus;
const String = php_ng.String;
const N = String.static;
const Value = php_ng.Value;

pub const ArrayBuffer = Object.Custom(struct {
    pub fn init(args: struct { buffer: ?*ByteBuffer }) !@This() {
        return .{ .buffer = args.buffer orelse try .create(.@"1") };
    }

    pub fn @"call __construct"(self: *@This(), args: struct {
        input: ?union(enum) {
            integer: c_ulong,
            string: *String,
        },
        read_only: bool = false,
    }) !void {
        if (args.input) |input| switch (input) {
            .string => |str| self.buffer.referenceString(str, args.read_only),
            .integer => |len| {
                try self.buffer.allocate(null, len);
                try self.buffer.clear();
            },
        } else {
            self.buffer.referenceBytes(&.{}, null);
        }
    }

    pub fn @"get byteLength"(self: *@This()) c_ulong {
        return self.buffer.bytes.len;
    }

    pub fn @"get detached"(self: *@This()) bool {
        return self.buffer.flags.uninitialized;
    }

    pub fn @"get readOnly"(self: *@This()) bool {
        return self.buffer.flags.read_only;
    }

    pub fn getConstructor(self: *@This()) ?*const Function {
        _ = self;
        return &constructor;
    }

    pub fn freeObject(self: *@This()) void {
        self.buffer.release();
    }

    pub fn castObject(self: *@This(), kind: Value.Kind) !Value {
        return switch (kind) {
            .string => get: {
                const str = try self.buffer.getString(null);
                break :get .fromString(str);
            },
            .boolean => .fromBoolean(true),
            else => error.UnsupportedConversion,
        };
    }

    pub fn getPropertiesFor(self: *@This(), purpose: PropertiesPurpose) !*Array {
        if (purpose == .debug) {
            if (self.flags.bytes_debug_output) {
                const arr: *Array = .create();
                if (self.buffer.data(0, false) catch null) |bytes| {
                    const bytes_arr: *Array = .create();
                    for (bytes, 0..) |byte, index| {
                        if (index == 50) {
                            const left = bytes.len - index;
                            if (left >= 10) {
                                var buffer: [128]u8 = undefined;
                                const text = try std.fmt.bufPrint(&buffer, "... {d} more bytes", .{left});
                                const text_value: Value = .fromString(.create(text));
                                bytes_arr.append(text_value);
                                break;
                            }
                        }
                        const byte_value: Value = .fromInteger(byte);
                        bytes_arr.append(byte_value);
                    }
                    const bytes_value: Value = .fromArray(bytes_arr);
                    arr.set("[BYTES]", bytes_value);
                }
                return arr;
            } else {
                // turn it back on
                self.flags.bytes_debug_output = true;
            }
        }
    }

    pub fn compareWith(self: *@This(), value: Value) c_int {
        const other_obj = value.getObject() catch return 1;
        if (!other_obj.isInstanceOf(ArrayBuffer.class())) {
            return ArrayBuffer.class().compareWith(other_obj.class());
        }
        const other = other_obj.toCustom(ArrayBuffer);
        if (self.buffer == other.buffer) return 0;
        if (self.buffer.flags.uninitialized != other.buffer.flags.uninitialized) {
            return if (self.buffer.flags.uninitialized) 1 else -1;
        }
        return switch (std.mem.order(u8, self.buffer.bytes, other.buffer.bytes)) {
            .eq => 0,
            .gt => 1,
            .lt => -1,
        };
    }

    fn reportFieldError(name: *String, access: accessor.FieldAccess, err: anytype) error{FailureReported} {
        if (failure.match(err, error.FailureReported)) {
            return error.FailureReported;
        } else if (failure.match(err, error.Missing)) {
            return failure.report("no field named '{s}' in {s}", .{
                name.slice(),
                class_name,
            });
        } else {
            const message = failure.acquireMessage(err);
            defer failure.freeMessage(message);
            return failure.report("unable to {s} field '{s}' in {s}: {s}", .{
                @tagName(access),
                name.slice(),
                class_name,
                message,
            });
        }
    }

    pub const PropCache = cache.IdCache(.{ .byteLength, .detached, .readOnly }, "", .{});
    pub const class_name = "ArrayBuffer";

    const constructor: Function = .fromHandler(@"call __construct", .{ .this = @This() });

    buffer: *ByteBuffer,
    flags: packed struct(usize) {
        bytes_debug_output: bool = true,
        _: u63 = 0,
    } = .{},
});

pub fn TypedArrayOf(comptime T: type, comptime clamped: bool) type {
    return Object.Custom(struct {
        pub fn init(args: struct { buffer: ?*ByteBuffer }) @This() {
            return .{
                .buffer = if (args.buffer) |buf| buf.retain() else init: {
                    var ptr: *ByteBuffer = undefined;
                    @as(*usize, @ptrCast(&ptr)).* = 0;
                    break :init ptr;
                },
            };
        }

        pub fn getConstructor(_: *@This()) ?*const Function {
            return &constructor;
        }

        pub fn freeObject(self: *@This()) void {
            if (@intFromPtr(self.buffer) != 0) self.buffer.release();
            if (self.array_buffer) |ab| ab.release();
        }

        pub fn castObject(self: *@This(), kind: Value.Kind) !Value {
            return switch (kind) {
                .string => get: {
                    const str = try self.buffer.getString(null);
                    break :get .fromString(str);
                },
                .boolean => .fromBoolean(true),
                else => return error.UnsupportedConversion,
            };
        }

        pub fn readElement(self: *@This(), key: *Value, access: Value.Access) !Value {
            _ = access;
            const len = self.getLength();
            const index = try getIndex(key, len);
            const bytes = try self.buffer.data(index * @sizeOf(T), false);
            const ptr: [*]const T = @ptrCast(@alignCast(bytes.ptr));
            const value = ptr[index];
            return switch (@typeInfo(T)) {
                .int => |int| switch (int.signedness) {
                    .signed => .fromInteger(value),
                    .unsigned => .fromUnsigned(value),
                },
                .float => .fromDouble(value),
                else => unreachable,
            };
        }

        pub fn writeElement(self: *@This(), key: Value, value: Value) !void {
            const len = self.getLength();
            const index = try getIndex(key, len);
            const bytes = try self.buffer.data(index * @sizeOf(T), true);
            const ptr: [*]T = @ptrCast(@alignCast(bytes.ptr));
            ptr[index] = try extractValue(value);
        }

        pub fn hasElement(self: *@This(), key: Value, status: Object.PropertyStatus) bool {
            _ = status;
            const len = self.getLength();
            return getIndex(key, len) != null;
        }

        pub fn countElements(self: *@This()) !usize {
            const len = self.getLength();
            if (len > std.math.maxInt(c_long)) return error.TooLarge;
            return @intCast(len);
        }

        pub fn compareWith(self: *@This(), value: Value) c_int {
            const other_obj = value.getObject() catch return 1;
            const class = TypedArray.class();
            if (other_obj.isInstanceOf(class)) {
                return class.compareWith(other_obj.class());
            }
            const other = other_obj.toCustom(TypedArray);
            if (self.buffer == other.buffer) return 0;
            if (self.buffer.flags.uninitialized or other.buffer.flags.uninitialized) {
                return if (self.buffer.flags.uninitialized) 1 else -1;
            }
            const ptr_a: [*]T = @ptrCast(@alignCast(self.buffer.bytes.ptr));
            const ptr_b: [*]T = @ptrCast(@alignCast(other.buffer.bytes.ptr));
            const len_a = self.buffer.bytes.len / @sizeOf(T);
            const len_b = other.buffer.bytes.len / @sizeOf(T);
            const items_a = ptr_a[0..len_a];
            const items_b = ptr_b[0..len_b];
            return switch (std.mem.order(T, items_a, items_b)) {
                .eq => 0,
                .gt => 1,
                .lt => -1,
            };
        }

        pub fn getProperties(self: *@This(), purpose: PropertiesPurpose) !*Array {
            const ptr: [*]const T, const len = init: {
                const bytes = self.buffer.data(0, false) catch {
                    break :init .{ &.{}, 0 };
                };
                break :init .{ @ptrCast(@alignCast(bytes.ptr)), self.getLength() };
            };
            const items = ptr[0..len];
            if (purpose == .debug) {
                const arr: *Array = .create();
                const items_arr: *Array = .create();
                for (items, 0..) |item, index| {
                    if (purpose == .debug) {
                        if (index == 50) {
                            const left = items.len - index;
                            if (left >= 10) {
                                var buffer: [128]u8 = undefined;
                                const text = try std.fmt.bufPrint(&buffer, "... {d} more items", .{left});
                                const text_value: Value = .fromString(.create(text));
                                items_arr.append(text_value);
                                break;
                            }
                        }
                    }
                    const value = createValue(item);
                    items_arr.append(value);
                }
                arr.set("[ITEMS]", .fromArray(items_arr));
                // at this point, array_buffer will have been created by getProperty()
                // if it was empty before
                const ab_obj = self.array_buffer.?;
                const ab = ab_obj.custom(ArrayBuffer);
                ab.flags.bytes_debug_output = false;
                // ArrayBuffer's getPropertiesFor() will reset the flag
                return arr;
            }
            return null;
        }

        pub fn getIterator(self: *@This()) ?*Object.Iterator {
            const zig_iter: Iterator = .init(self);
            const iter: Object.Iterator.Custom(Iterator) = .create(zig_iter);
            return @ptrCast(iter);
        }

        pub fn @"call __construct"(self: *@This(), args: struct {
            input: ?union(enum) {
                object: *Object,
                array: *Array,
                length: c_ulong,
            },
            offset: ?c_ulong,
            len: ?c_ulong,
        }) !void {
            const buf = if (args.input) |input| get: {
                switch (input) {
                    .object => |obj| {
                        if (obj.isInstanceOf(ArrayBuffer.class())) {
                            const ab = obj.toCustom(ArrayBuffer);
                            const offset: usize = args.offset orelse 0;
                            if (offset % @sizeOf(T) != 0) return error.InvalidOffset;
                            const len: usize = args.len orelse calc: {
                                if (offset > ab.buffer.bytes.len) return error.InvalidOffset;
                                const byte_len = ab.buffer.bytes.len - offset;
                                const n = byte_len / @sizeOf(T);
                                if (n * @sizeOf(T) != byte_len) return error.InvalidLength;
                                break :calc n;
                            };
                            if (offset + len * @sizeOf(T) > ab.buffer.bytes.len) return error.InvalidLength;
                            self.array_buffer = obj.retain();
                            const byte_len = len * @sizeOf(T);
                            if (offset == 0 and ab.buffer.bytes.len == byte_len) {
                                break :get ab.buffer.retain();
                            } else {
                                break :get try ab.buffer.slice(offset, byte_len, .@"1", 0);
                            }
                        } else if (obj.isInstanceOf(TypedArray.class())) {
                            const other = obj.toCustom(TypedArray);
                            const buf: *ByteBuffer = try .create(.@"1");
                            errdefer buf.release();
                            try buf.allocate(null, other.buffer.bytes.len);
                            try buf.copy(other.buffer);
                            break :get buf;
                        } else {
                            const value: Value = .fromObject(obj);
                            const tmp = value.cast(.array);
                            defer tmp.release();
                            const buf = try createBufferFromArray(tmp.array());
                            break :get buf;
                        }
                    },
                    .array => |arr| {
                        const buf = try createBufferFromArray(arr);
                        break :get buf;
                    },
                    .length => |len| {
                        const buf = try ByteBuffer.create(.@"1");
                        errdefer buf.release();
                        try buf.allocate(null, len * @sizeOf(T));
                        try buf.clear();
                        break :get buf;
                    },
                }
            } else get: {
                const buf = try ByteBuffer.create(.@"1");
                buf.referenceBytes(&.{}, null);
                break :get buf;
            };
            self.buffer = buf;
        }

        pub fn @"get buffer"(self: *@This()) !*Object {
            const obj = self.array_buffer orelse create: {
                const parent_buf = self.buffer.getBase();
                const ab = try ArrayBuffer.create(.{ .buffer = parent_buf });
                const ab_obj: *Object = @ptrCast(ab);
                self.array_buffer = ab_obj;
                break :create ab_obj;
            };
            return obj.retain();
        }

        pub fn @"get byteLength"(self: *@This()) c_ulong {
            return @intCast(self.buffer.bytes.len);
        }

        pub fn @"get byteOffset"(self: *@This()) c_ulong {
            const parent_buf = self.buffer.getBase();
            const offset = @intFromPtr(self.buffer.bytes.ptr) - @intFromPtr(parent_buf.bytes.ptr);
            return @intCast(offset);
        }

        pub fn @"get length"(self: *@This()) c_ulong {
            return @intCast(self.getLength());
        }

        fn getLength(self: *@This()) usize {
            return self.buffer.bytes.len / @sizeOf(T);
        }

        fn getIndex(key: Value, len: usize) !usize {
            const key_long = try key.getUnsigned();
            const index: usize = @intCast(key_long);
            // need bound check here even though ByteBuffer does that because
            // element might be zero-bit
            if (index >= len) return error.OutOfBound;
            return index;
        }

        fn createValue(item: T) Value {
            return switch (@typeInfo(T)) {
                .int => |int| switch (int.signedness) {
                    .signed => .fromInteger(item),
                    .unsigned => .fromUnsigned(item),
                },
                .float => .fromFloat(item),
                else => unreachable,
            };
        }

        fn createBufferFromArray(arr: *Array) !*ByteBuffer {
            const buf = try ByteBuffer.create(.@"1");
            errdefer buf.release();
            try buf.allocate(null, @sizeOf(T) * arr.length());
            const ptr: [*]T = @ptrCast(@alignCast(buf.bytes.ptr));
            var iter = arr.iterate(.{});
            var index: usize = 0;
            while (iter.next()) |value| {
                ptr[index] = try extractValue(value);
                index += 1;
            }
            return buf;
        }

        fn extractValue(value: Value) !T {
            return switch (@typeInfo(T)) {
                .int => |int| switch (int.signedness) {
                    .signed => @truncate(try value.getInteger()),
                    .unsigned => switch (clamped) {
                        false => @truncate(try value.getUnsigned()),
                        true => get: {
                            const min = comptime std.math.minInt(T);
                            const max = comptime std.math.maxInt(T);
                            const num = try value.getInteger();
                            break :get if (num < min)
                                min
                            else if (num > max)
                                max
                            else
                                @intCast(num);
                        },
                    },
                },
                .float => @floatCast(try value.getFloat()),
                else => unreachable,
            };
        }

        const constructor: Function = .fromHandler(@"call __construct", .{ .this = @This() });
        const Custom = @This();
        const Iterator = struct {
            array: *Custom,
            index: usize = 0,

            pub fn init(array: *Custom) @This() {
                const object: *Object = .fromCustom(array);
                object.addRef();
                return .{ .array = array };
            }

            pub fn deinit(self: *@This()) void {
                const object: *Object = .fromCustom(self.array);
                object.release();
            }

            pub fn next(self: *@This()) ?T {
                const bytes = self.buffer.data(self.index * @sizeOf(T), false) catch return null;
                const ptr: [*]const T = @ptrCast(@alignCast(bytes.ptr));
                return ptr[self.index];
            }

            pub fn reset(self: *@This()) void {
                self.index = 0;
            }
        };
        const TypedArray = TypedArrayOf(T, clamped);

        buffer: *ByteBuffer,
        array_buffer: ?*Object = null,
    });
}

const type_list = [_]type{ i8, i16, i32, i64, u8, u16, u32, u64, f16, f32, f64, u8 };

pub const TypeArrays = struct {
    pub const Int8Array = TypedArrayOf(i8, false);
    pub const Int16Array = TypedArrayOf(i16, false);
    pub const Int32Array = TypedArrayOf(i32, false);
    pub const Int64Array = TypedArrayOf(i64, false);
    pub const Uint8Array = TypedArrayOf(u8, false);
    pub const Uint16Array = TypedArrayOf(u16, false);
    pub const Uint32Array = TypedArrayOf(u32, false);
    pub const Uint64Array = TypedArrayOf(u64, false);
    pub const Uint8ClampedArray = TypedArrayOf(u8, true);
};

pub fn registerClasses() !void {
    try ArrayBuffer.registerClass(N("ArrayBuffer"));
    errdefer ArrayBuffer.unregisterClass();
    // try TypedArray.registerClass();
    // errdefer TypedArray.unregisterClass();
    // {
    //     var failed_index: usize = undefined;
    //     errdefer inline for (type_list, 0..) |T, index| {
    //         if (failed_index == index) break;
    //         TypedArrayOf(T, false).unregisterClass();
    //     };
    //     inline for (type_list, 0..) |T, index| {
    //         errdefer failed_index = index;
    //         try TypedArrayOf(T, false).registerClass();
    //     }
    // }
    // try TypedArrayOf(u8, true).registerClass();
}

pub fn unregisterClasses() void {
    ArrayBuffer.unregisterClass();
    // TypedArray.unregisterClass();
    // inline for (type_list) |T| {
    //     TypedArrayOf(T, false).unregisterClass();
    // }
    // TypedArrayOf(u8, true).unregisterClass();
}
