const std = @import("std");

const accessor = @import("../accessor.zig");
const ObjectTransform = accessor.ObjectTransform;
const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const ZigClassEntry = @import("../class-entry.zig").ZigClassEntry;
const Closure = @import("../closure.zig").Closure;
const Generator = @import("../generator.zig").Generator;
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
            has_abort_signal: bool = false,
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
            abort_signal: ?*ZigClassEntry.Member = null,

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
                        inline .allocator, .promise, .generator, .abort_signal => |t| {
                            @field(self, @tagName(t)) = member;
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
            }
        };

        pub fn copyArguments(self: *@This(), arg_iter: *php.ArgumentIterator) !void {
            const class = ZigClassEntry.fromStructure(self);
            const static = class.getStaticData(@This());
            // take out initializers for special arguments
            var special_args: structure.Struct.SpecialArgs = .{};
            arg_iter.extractNamedArguments(&special_args, .{
                .allocator = static.allocator != null,
                .callback = static.promise != null or static.generator != null,
                .abort_signal = static.abort_signal != null,
            });
            if (arg_iter.len != static.arg_accessors.len) return error.IncorrectArgumentCount;
            // use accessors to write into the argument struct
            var index: usize = 0;
            while (arg_iter.next()) |arg| : (index += 1) {
                const acc = static.arg_accessors[index];
                try acc.set(self, arg);
            }
            // initialize special arguments
            inline for (.{ .allocator, .promise, .generator, .abort_signal }) |t| {
                if (@field(static, @tagName(t))) |m| {
                    const value = try m.accessors.get(self);
                    const obj = try php.getValueObject(&value);
                    defer php.release(obj);
                    const a_struct = ZigObject(structure.Struct).fromObject(obj).structure();
                    try a_struct.initSpecial(t, special_args);
                    @field(self.flags, "has_" ++ @tagName(t)) = true;
                }
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
