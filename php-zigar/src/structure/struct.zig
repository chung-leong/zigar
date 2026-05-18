const std = @import("std");
const builtin = @import("builtin");

const AbortSignal = @import("../abort-signal.zig").AbortSignal;
const accessor = @import("../accessor.zig");
const Error = accessor.Error;
const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const cache = @import("../cache.zig");
const ZigClassEntry = @import("../class-entry.zig").ZigClassEntry;
const StructurePurpose = @import("../enums.zig").StructurePurpose;
const failure = @import("../failure.zig");
const gd = @import("../gd.zig");
const Generator = @import("../generator.zig").Generator;
const iterator = @import("../iterator.zig");
const ZigObject = @import("../object.zig").ZigObject;
const php = @import("../php.zig");
const ArgumentIterator = php.ArgumentIterator;
const ClassEntry = php.ClassEntry;
const HashTable = php.HashTable;
const HashTableIterator = php.HashTableIterator;
const Object = php.Object;
const ObjectIterator = php.ObjectIterator;
const Stream = php.Stream;
const String = php.String;
const Value = php.Value;
const Promise = @import("../promise.zig").Promise;
const SpecialExports = @import("../special-exports.zig").SpecialExports;
const structure = @import("../structure.zig");

pub const Struct = struct {
    table: Value = undefined,
    buffer: *ByteBuffer = undefined,

    pub const SpecialArgs = struct {
        allocator: ?Value = null,
        callback: ?Value = null,
        signal: ?Value = null,
        timeout: ?Value = null,
    };

    pub const Super = structure.StructLike(@This());
    pub const Static = struct {
        backing_int: ?struct {
            class: *ZigClassEntry,
            accessors: *accessor.Any,
        } = null,
        required_field_count: usize = 0,
        callback: ?*Object = null,
        is_root: bool = false,

        pub fn init(self: *@This(), class_obj: *Object) !void {
            const class = ZigClassEntry.fromObject(class_obj);
            var iter = class.getMemberIterator(.instance);
            // look for backing int
            const backing_int_member = while (iter.next()) |member| {
                if (member.flags.is_backing_int) break member;
            } else null;
            if (backing_int_member) |bim| {
                self.backing_int = .{
                    .class = bim.class,
                    .accessors = &bim.accessors,
                };
            }
            // count the number of required arguments
            iter.reset();
            while (iter.next()) |member| {
                if (member.flags.is_required) self.required_field_count += 1;
            }
            // create callback function for promise or generator
            switch (class.purpose) {
                inline .promise, .generator => |p| {
                    const closure = switch (p) {
                        .promise => Promise.createHandler(),
                        .generator => Generator.createHandler(),
                        else => unreachable,
                    };
                    defer php.release(&closure);
                    const cb_member = try class.getMember(.instance, "callback");
                    if (cb_member.class.type != .pointer) return error.Unexpected;
                    const cb_obj = try cb_member.class.createObject(null, &closure, false);
                    self.callback = cb_obj;
                },
                else => {},
            }
        }

        pub fn deinit(self: *@This()) void {
            if (self.callback) |cb| php.release(cb);
        }

        pub fn getStaticProperty(self: *@This(), name: *String, cache_slot: ?[*]?*anyopaque) !Value {
            if (self.is_root) {
                if (RootPropCache.idFromString(name, cache_slot)) |id| {
                    switch (id) {
                        .zigar => {
                            const class = ZigClassEntry.fromStatic(self);
                            const obj = try SpecialExports.create(class.host);
                            return php.createValueObject(obj);
                        },
                    }
                }
            }
            return error.Missing;
        }
    };
    pub const RootPropCache = cache.IdCache(.{.zigar}, "__", .{});

    pub fn setStorage(self: *@This(), buffer: *ByteBuffer, table: *const Value) !void {
        try Super.setStorage(self, buffer, table);
        const class = ZigClassEntry.fromStructure(self);
        if (class.flags.@"struct".is_packed) {
            // mark buffer as packed so that child fields that are vectors are correctly handled
            buffer.markPackedData();
        }
    }

    pub fn checkArguments(self: *@This(), arg_iter: *php.ArgumentIterator) !void {
        if (arg_iter.len != 1) {
            // check if the struct has default values for all fields
            const class = ZigClassEntry.fromStructure(self);
            const static = class.getStaticData(@This());
            if (arg_iter.len != 0 or static.required_field_count != 0) {
                return failure.report("{s} constructor expects an array as argument or named arguments", .{
                    class.getStructureName(),
                });
            }
        }
    }

    pub fn getValue(self: *@This(), transform: accessor.Transform) !Value {
        if (transform == .integer) {
            const class = ZigClassEntry.fromStructure(self);
            const static = class.getStaticData(@This());
            if (static.backing_int) |int| {
                return try int.accessors.get(self);
            }
        }
        return Super.getValue(self, transform);
    }

    pub fn setValue(self: *@This(), value: *const Value, transform: accessor.Transform) accessor.Error!void {
        const class = ZigClassEntry.fromStructure(self);
        switch (class.purpose) {
            .gd_image => {
                const ptr = gd.getPointer(value) orelse {
                    return failure.report("GD image object expected", .{});
                };
                const ptr_value = php.createValuePointer(ptr);
                try self.setProperty(php.persistent("ptr"), &ptr_value, null);
                php.release(&self.table);
                self.table = value.*;
                php.addRef(&self.table);
                return;
            },
            .file => {
                if (self.getStreamHandle(value, false)) |handle| {
                    try self.setProperty(php.persistent("handle"), &handle, null);
                    return;
                } else {
                    const arg_d = php.createValueDebug(value);
                    defer php.release(&arg_d);
                    return failure.report("{s} '{s}' expects a file resource pointer from fopen(), received: {s}\n", .{
                        class.getStructureName(),
                        class.getName(),
                        php.getValueStringContent(&arg_d) catch unreachable,
                    });
                }
            },
            .directory => {
                if (self.getStreamHandle(value, true)) |handle| {
                    try self.setProperty(php.persistent("fd"), &handle, null);
                    return;
                } else if (failure.hasMessage()) {
                    return error.Unexpected;
                } else {
                    const arg_d = php.createValueDebug(value);
                    defer php.release(&arg_d);
                    return failure.report("{s} '{s}' expects a directory handle from opendir(), received: {s}\n", .{
                        class.getStructureName(),
                        class.getName(),
                        php.getValueStringContent(&arg_d) catch unreachable,
                    });
                }
            },
            else => {},
        }
        return Super.setValue(self, value, transform);
    }

    pub fn visitPointers(self: *@This(), cb: anytype, args: anytype, comptime options: structure.VisitOptions) accessor.Error!void {
        const class = ZigClassEntry.fromStructure(self);
        if (class.flags.common.has_pointer) {
            var iter = class.getMemberIterator(.instance);
            while (iter.next()) |member| {
                if (member.class.flags.common.has_pointer) {
                    const value = try member.accessors.getEx(self, null);
                    defer php.release(&value);
                    const obj = php.getValueObject(&value) catch continue;
                    try structure.invokeMethod(obj, "visitPointers", .{ cb, args, options });
                }
            }
        }
    }

    pub fn initSpecial(self: *@This(), comptime T: type, args: SpecialArgs) !void {
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        switch (T) {
            std.mem.Allocator => {
                if (args.allocator) |av| {
                    const src_obj = try php.getValueObject(&av);
                    const src_class = ZigClassEntry.fromObject(src_obj);
                    if (src_class.type != .@"struct" or src_class.purpose != .allocator) {
                        return error.NotAllocator;
                    }
                    const src_struct = fromObject(src_obj);
                    try self.buffer.copy(src_struct.buffer);
                } else {
                    const byte_ptr: [*]u8 = @ptrCast(&class.host.allocator);
                    const bytes = byte_ptr[0..@sizeOf(std.mem.Allocator)];
                    try self.buffer.copyBytes(bytes);
                }
            },
            Promise, Generator => {
                const ctx = try T.create(args.callback);
                const ptr_value = php.createValuePointer(ctx.buffer.bytes.ptr);
                try self.setProperty(php.persistent("ptr"), &ptr_value, null);
                const callback_value = php.createValueObject(static.callback.?);
                try self.setProperty(php.persistent("callback"), &callback_value, null);
                if (class.getMember(.instance, php.persistent("allocator")) catch null) |m| {
                    const allocator_value = try m.accessors.get(self);
                    const allocator_obj = try php.getValueObject(&allocator_value);
                    defer php.release(allocator_obj);
                    const allocator_struct = ZigObject(structure.Struct).fromObject(allocator_obj).structure();
                    try allocator_struct.initSpecial(std.mem.Allocator, args);
                }
            },
            AbortSignal => {
                const signal = if (args.signal) |av| get: {
                    const signal_obj = php.getValueObject(&av) catch return error.NotAbortSignal;
                    if (signal_obj.ce != ZigClassEntry.abort_signal_class) return error.NotAbortSignal;
                    php.addRef(signal_obj);
                    break :get AbortSignal.fromObject(signal_obj);
                } else try AbortSignal.create(args.timeout);
                const ptr_value = php.createValuePointer(&signal.value);
                try self.setProperty(php.persistent("ptr"), &ptr_value, null);
            },
            else => {},
        }
    }

    pub fn getSpecialContext(self: *@This(), comptime T: type) !*T {
        const ptr_value = try self.getProperty(php.persistent("ptr"), null);
        const ptr_obj = try php.getValueObject(&ptr_value);
        defer php.release(ptr_obj);
        const ptr_struct = ZigObject(structure.Pointer).fromObject(ptr_obj).structure();
        const target = try ptr_struct.getValue(.none);
        defer php.release(&target);
        return accessor.getOpaqueTarget(T, &target);
    }

    pub fn freeObject(obj: *Object) void {
        const class = ZigClassEntry.fromObject(obj);
        const self = fromObject(obj);
        // release special context object
        switch (class.purpose) {
            .promise => if (self.getSpecialContext(Promise) catch null) |ctx| ctx.release(),
            .generator => if (self.getSpecialContext(Generator) catch null) |ctx| ctx.release(),
            .abort_signal => if (self.getSpecialContext(AbortSignal) catch null) |ctx| ctx.release(),
            .file => if (self.getProperty(php.persistent("handle"), null) catch null) |handle| {
                if (getDescriptor(&handle) catch null) |fd| {
                    if (class.host.dispatcher.isVirtualStream(fd)) {
                        class.host.dispatcher.removeStream(fd) catch {};
                    }
                }
            },
            .directory => if (self.getProperty(php.persistent("fd"), null) catch null) |handle| {
                if (getDescriptor(&handle) catch null) |fd| {
                    if (class.host.dispatcher.isVirtualStream(fd)) {
                        class.host.dispatcher.removeStream(fd) catch {};
                    }
                }
            },
            else => {},
        }
        Super.freeObject(obj);
    }

    extern fn _get_osfhandle(fd: c_int) std.os.windows.HANDLE;

    fn getStreamHandle(self: *@This(), value: *const Value, is_dir: bool) ?Value {
        const strm = php.getValueStream(value) catch return null;
        if (php.getDescriptor(strm)) |fd| {
            if (builtin.target.os.tag == .windows) {
                const handle = _get_osfhandle(fd);
                return php.createValuePointer(handle);
            } else {
                return php.createValueAnyInt(fd);
            }
        } else {
            // not a real file/dir--create a virtual descriptor
            const class = ZigClassEntry.fromStructure(self);
            if (class.host.dispatcher.addStream(strm, is_dir) catch null) |fd| {
                if (builtin.target.os.tag == .windows) {
                    // the fake win32 handle for a virtual file is its descriptor left-shifted by 1
                    const handle: *anyopaque = @ptrFromInt(fd << 1);
                    return php.createValuePointer(handle);
                } else {
                    return php.createValueAnyInt(fd);
                }
            }
        }
        return null;
    }

    fn getDescriptor(value: *const Value) !c_long {
        if (builtin.target.os.tag == .windows) {
            const ptr_obj = try php.getValueObject(value);
            const ptr_struct = ZigObject(structure.Pointer).fromObject(ptr_obj).structure();
            const address = try ptr_struct.getAddress();
            return @intCast(address >> 1);
        } else {
            return try php.getValueLong(value);
        }
    }

    pub const initialize = Super.initialize;
    pub const finalize = Super.finalize;
    pub const externalize = Super.externalize;
    pub const getExtent = Super.getExtent;
    pub const getProperty = Super.getProperty;
    pub const setProperty = Super.setProperty;
    pub const propertyExists = Super.propertyExists;
    pub const getConstructor = Super.getConstructor;
    pub const castObject = Super.castObject;
    pub const getMethod = Super.getMethod;
    pub const readProperty = Super.readProperty;
    pub const writeProperty = Super.writeProperty;
    pub const hasProperty = Super.hasProperty;
    pub const getProperties = Super.getProperties;
    pub const getPropertyPointer = Super.getPropertyPointer;
    pub const compare = Super.compare;
    pub const getGarbageCollection = Super.getGarbageCollection;
    pub const getIterator = Super.getIterator;
    const fromObject = Super.fromObject;
};
