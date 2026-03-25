const std = @import("std");

const accessor = @import("../accessor.zig");
const ObjectTransform = accessor.ObjectTransform;
const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const ZigClassEntry = @import("../class-entry.zig").ZigClassEntry;
const Closure = @import("../closure.zig").Closure;
const ZigObject = @import("../object.zig").ZigObject;
const php = @import("../php.zig");
const FiberTransfer = php.FiberTransfer;
const Object = php.Object;
const String = php.String;
const Value = php.Value;
const Promise = @import("../promise.zig").Promise;
const structure = @import("../structure.zig");

pub fn ArgStruct(variadic: bool) type {
    _ = variadic;
    return struct {
        flags: packed struct {
            has_allocator: bool = false,
            has_promise: bool = false,
            has_callback: bool = false,
            has_generator: bool = false,
            has_abort_controller: bool = false,
        } align(@alignOf(*anyopaque)) = .{},
        table: Value = undefined,
        buffer: *ByteBuffer = undefined,

        const Super = structure.Parent(@This());

        pub const Static = struct {
            arg_accessors: []*accessor.Any = undefined,
            retval_accessors: *accessor.Any = undefined,
            retval_transform: ?ObjectTransform = undefined,
            allocator: ?*ZigClassEntry.Member = null,
            promise: ?*ZigClassEntry.Member = null,
            generator: ?*ZigClassEntry.Member = null,
            abort_controller: ?*ZigClassEntry.Member = null,
            callback: ?*Object = null,

            pub fn init(self: *@This(), class_obj: *Object) !void {
                const class = ZigClassEntry.fromObject(class_obj);
                var iter = class.getMemberIterator(.instance);
                if (iter.len == 0) return error.Unexpected;
                var arg_count: usize = 0;
                _ = iter.next(); // first member is retval
                while (iter.next()) |member| {
                    switch (member.class.purpose) {
                        .allocator, .promise, .generator => {},
                        else => arg_count += 1,
                    }
                }
                iter.reset();
                self.arg_accessors = try php.allocator.alloc(*accessor.Any, arg_count);
                const retval_member = iter.next().?;
                self.retval_accessors = &retval_member.accessors;
                self.retval_transform = retval_member.objectTransform();
                var index: usize = 0;
                while (iter.next()) |member| {
                    switch (member.class.purpose) {
                        .allocator => {
                            self.allocator = member;
                        },
                        .promise => if (self.callback == null) {
                            self.promise = member;
                            const closure = Promise.getHandler();
                            const cb_member = try member.class.getMember(.instance, "callback");
                            if (cb_member.class.type != .pointer) return error.Unexpected;
                            const cb_obj = try cb_member.class.obtainNewObject();
                            const cb_struct = ZigObject(structure.Pointer).fromObject(cb_obj).structure();
                            try cb_struct.writeSelf(&closure);
                            self.callback = cb_obj;
                        },
                        .generator => if (self.callback == null) {
                            self.generator = member;
                        },
                        else => {
                            self.arg_accessors[index] = &member.accessors;
                            index += 1;
                        },
                    }
                }
            }

            pub fn deinit(self: *@This()) void {
                php.allocator.free(self.arg_accessors);
                if (self.callback) |cb| php.release(cb);
            }
        };

        pub fn copyArguments(self: *@This(), arg_iter: *php.ArgumentIterator) !void {
            const class = ZigClassEntry.fromStructure(self);
            const static = class.getStaticData(@This());
            if (arg_iter.len != static.arg_accessors.len) return error.IncorrectArgumentCount;
            // use accessors to write into the argument struct
            var index: usize = 0;
            while (arg_iter.next()) |arg| : (index += 1) {
                const acc = static.arg_accessors[index];
                try acc.set(self, arg);
            }
            // set special arguments
            if (static.allocator) |m| {
                const allocator_value = try m.accessors.get(self);
                const allocator_obj = try php.getValueObject(&allocator_value);
                defer php.release(allocator_obj);
                const allocator_struct = ZigObject(structure.Struct).fromObject(allocator_obj).structure();
                const allocator_class = ZigClassEntry.fromObject(allocator_obj);
                if (allocator_class.type != .@"struct" or allocator_class.purpose != .allocator) {
                    return error.Unexpected;
                }
                const allocator_byte_ptr: [*]u8 = @ptrCast(&class.host.allocator);
                const allocator_bytes = allocator_byte_ptr[0..@sizeOf(std.mem.Allocator)];
                try allocator_struct.buffer.copyBytes(allocator_bytes);
                self.flags.has_allocator = true;
            }
            if (static.promise) |m| {
                const promise = try Promise.create();
                const promise_value = try m.accessors.get(self);
                const promise_obj = try php.getValueObject(&promise_value);
                defer php.release(promise_obj);
                const promise_struct = ZigObject(structure.Struct).fromObject(promise_obj).structure();
                const promise_class = ZigClassEntry.fromObject(promise_obj);
                const ptr_member = try promise_class.getMember(.instance, php.persistent("ptr"));
                const opaque_class = try ptr_member.class.getPointerTarget();
                const opaque_obj = try opaque_class.createObjectFromBuffer(promise.buffer, null);
                defer php.release(opaque_obj);
                const opaque_value = php.createValueObject(opaque_obj);
                try promise_struct.writeMember(php.persistent("ptr"), &opaque_value, null);
                const callback_value = php.createValueObject(static.callback.?);
                try promise_struct.writeMember(php.persistent("callback"), &callback_value, null);
                self.flags.has_promise = true;
            }
        }

        pub fn getArgumentCount(self: *@This()) usize {
            const class = ZigClassEntry.fromStructure(self);
            const static = class.getStaticData(@This());
            return static.arg_accessors.len;
        }

        pub fn extractArguments(self: *@This(), args: []Value) !void {
            const class = ZigClassEntry.fromStructure(self);
            const static = class.getStaticData(@This());
            for (static.arg_accessors, 0..) |acc, i| {
                errdefer for (0..i) |j| php.release(&args[j]);
                args[i] = try acc.get(self);
            }
        }

        pub fn getReturnValue(self: *@This()) !Value {
            const class = ZigClassEntry.fromStructure(self);
            const static = class.getStaticData(@This());
            var value = try static.retval_accessors.get(self);
            if (static.retval_transform) |ot| try ot.apply(&value);
            return value;
        }

        pub fn setReturnValue(self: *@This(), value: *const Value) !void {
            const class = ZigClassEntry.fromStructure(self);
            const static = class.getStaticData(@This());
            return try static.retval_accessors.set(self, value);
        }

        pub fn getSpecialArgument(self: *@This(), name: @TypeOf(.enum_literal)) !*structure.Struct {
            const class = ZigClassEntry.fromStructure(self);
            const static = class.getStaticData(@This());
            const member = @field(static, @tagName(name)) orelse return error.Missing;
            const value = try member.accessors.get(self);
            const obj = php.getValueObject(&value) catch unreachable;
            defer php.release(obj);
            return ZigObject(structure.Struct).fromObject(obj).structure();
        }

        pub const setStorage = Super.setStorage;
        pub const readSelf = Super.readSelf;
        pub const freeObject = Super.freeObject;
        pub const getReferencedObjects = Super.getReferencedObjects;
        const fromObject = Super.fromObject;
    };
}
