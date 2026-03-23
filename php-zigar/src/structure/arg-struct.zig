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
        slots: Value = undefined,
        promise: ?*Promise = null,
        bytes: *ByteBuffer = undefined,

        const Super = structure.Parent(@This());

        pub const Static = struct {
            arg_accessors: []*accessor.Any = undefined,
            retval_accessors: *accessor.Any = undefined,
            retval_transform: ObjectTransform = undefined,
            allocator_accessors: ?*accessor.Any = null,
            promise_accessors: ?*accessor.Any = null,
            generator_accessors: ?*accessor.Any = null,
            abort_controller_accessors: ?*accessor.Any = null,

            pub fn init(self: *@This(), class_obj: *Object) !void {
                const class = ZigClassEntry.fromObject(class_obj);
                var iter = class.getMemberIterator(.instance);
                if (iter.len == 0) return error.Unexpected;
                var arg_count: usize = 0;
                _ = iter.next(); // first member is retval
                while (iter.next()) |member| {
                    if (member.class) |c| {
                        switch (c.purpose) {
                            .allocator, .promise, .generator => continue,
                            else => {},
                        }
                    }
                    arg_count += 1;
                }
                iter.reset();
                self.arg_accessors = try php.allocator.alloc(*accessor.Any, arg_count);
                const retval_member = iter.next().?;
                self.retval_accessors = &retval_member.accessors;
                var index: usize = 0;
                while (iter.next()) |member| {
                    if (member.class) |c| {
                        switch (c.purpose) {
                            inline .allocator, .promise, .generator => |t| {
                                @field(self, @tagName(t) ++ "_accessors") = &member.accessors;
                                continue;
                            },
                            else => {},
                        }
                    }
                    self.arg_accessors[index] = &member.accessors;
                    index += 1;
                }
            }

            pub fn deinit(self: *@This()) void {
                php.allocator.free(self.arg_accessors);
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
            if (static.allocator_accessors) |acc| {
                const value = php.createValuePointer(&class.host.allocator);
                try acc.set(self, &value);
            }
            if (static.promise_accessors) |acc| {
                self.promise = try Promise.create();
                const value = php.createValuePointer(self.promise);
                try acc.set(self, &value);
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
            try static.retval_transform.apply(&value);
            return value;
        }

        pub fn setReturnValue(self: *@This(), value: *const Value) !void {
            const class = ZigClassEntry.fromStructure(self);
            const static = class.getStaticData(@This());
            return try static.retval_accessors.set(self, value);
        }

        pub const setStorage = Super.setStorage;
        pub const readSelf = Super.readSelf;
        pub const freeObject = Super.freeObject;
        pub const getReferencedObjects = Super.getReferencedObjects;
        const fromObject = Super.fromObject;
    };
}
