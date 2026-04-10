const std = @import("std");

const AbortSignal = @import("../abort-signal.zig").AbortSignal;
const accessor = @import("../accessor.zig");
const Error = accessor.Error;
const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const ZigClassEntry = @import("../class-entry.zig").ZigClassEntry;
const StructurePurpose = @import("../enums.zig").StructurePurpose;
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
const String = php.String;
const Value = php.Value;
const Promise = @import("../promise.zig").Promise;
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

    const Super = structure.StructLike(@This());

    pub const Static = struct {
        prop_names: []*String = &.{},
        backing_int: ?struct {
            class: *ZigClassEntry,
            accessors: *accessor.Any,
        } = null,
        required_field_count: usize = 0,
        callback: ?*Object = null,

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
            while (iter.next()) |member| {
                if (member.flags.is_required) self.required_field_count += 1;
            }
            // create a list of property names for use by iterator
            self.prop_names = try class.createPropertyList(.instance);
            // create callback function for promise or generator
            switch (class.purpose) {
                inline .promise, .generator => |p| {
                    const closure = switch (p) {
                        .promise => Promise.getHandler(),
                        .generator => Generator.getHandler(),
                        else => unreachable,
                    };
                    const cb_member = try class.getMember(.instance, "callback");
                    if (cb_member.class.type != .pointer) return error.Unexpected;
                    const cb_obj = try cb_member.class.createObject(null, &closure);
                    self.callback = cb_obj;
                },
                else => {},
            }
        }

        pub fn deinit(self: *@This()) void {
            if (self.callback) |cb| php.release(cb);
            if (self.prop_names.len > 0) php.allocator.free(self.prop_names);
        }
    };

    pub fn setStorage(self: *@This(), buffer: *ByteBuffer, table: *const Value) !void {
        try Super.setStorage(self, buffer, table);
        const class = ZigClassEntry.fromStructure(self);
        if (class.flags.@"struct".is_packed) {
            // mark buffer as packed so that child fields that are vectors are correctly handled
            buffer.markPackedData();
        }
    }

    pub fn initialize(self: *@This(), allocator: ?*const std.mem.Allocator, initializer: ?*const Value) !void {
        try Super.initialize(self, allocator, initializer);
        const class = ZigClassEntry.fromStructure(self);
        switch (class.purpose) {
            .unknown => {},
            // clear the buffer of special purpose structs to ensure their pointers are null
            // during clean-up after an initialization error
            else => try self.buffer.clear(),
        }
    }

    pub fn checkArguments(self: *@This(), arg_iter: *php.ArgumentIterator) !void {
        if (arg_iter.len != 1) {
            // check if the struct has default values for all fields
            const class = ZigClassEntry.fromStructure(self);
            const static = class.getStaticData(@This());
            if (arg_iter.len != 0 or static.required_field_count != 0) {
                return php.throwExceptionFmt("{s} constructor expects an array as argument or named arguments", .{
                    class.getStructureName(),
                });
            }
        }
    }

    pub fn getValue(self: *@This(), transform: accessor.Transform) !Value {
        if (transform == .integer) {
            const class = ZigClassEntry.fromStructure(self);
            const flags = class.getFlags(@This());
            if (flags.is_packed) {
                // TODO: handle packed struct
                @panic("TODO");
            }
        }
        return Super.getValue(self, transform);
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
        const target = try self.getProperty(php.persistent("ptr"), null);
        return accessor.getOpaqueTarget(T, &target);
    }

    pub fn freeObject(obj: *Object) void {
        const class = ZigClassEntry.fromObject(obj);
        const self = fromObject(obj);
        // release special context object
        switch (class.purpose) {
            inline else => |t| {
                const ctx_type: ?type = switch (t) {
                    .promise => Promise,
                    .generator => Generator,
                    // ptr points to an i32, but it's the first field of AbortSignal
                    .abort_signal => AbortSignal,
                    else => null,
                };
                if (ctx_type) |T| {
                    if (self.getSpecialContext(T) catch null) |ctx| ctx.release();
                }
            },
        }
        Super.freeObject(obj);
    }

    pub fn getIterator(obj: *Object) !?*ObjectIterator {
        const class = ZigClassEntry.fromObject(obj);
        const static = class.getStaticData(@This());
        return switch (class.purpose) {
            .iterator => try iterator.IteratorIterator.create(obj),
            .generator => try iterator.GeneratorIterator.create(obj),
            else => try iterator.PropertyIterator(@This()).create(obj, static.prop_names, &.{}),
        };
    }

    pub const finalize = Super.finalize;
    pub const externalize = Super.externalize;
    pub const getExtent = Super.getExtent;
    pub const setValue = Super.setValue;
    pub const getProperty = Super.getProperty;
    pub const setProperty = Super.setProperty;
    pub const castObject = Super.castObject;
    pub const getMethod = Super.getMethod;
    pub const readProperty = Super.readProperty;
    pub const writeProperty = Super.writeProperty;
    pub const hasProperty = Super.hasProperty;
    pub const getProperties = Super.getProperties;
    pub const getPropertyPointer = Super.getPropertyPointer;
    pub const getGarbageCollection = Super.getGarbageCollection;
    const fromObject = Super.fromObject;
};
