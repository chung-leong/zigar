const std = @import("std");

const AbortSignal = @import("../abort-signal.zig").AbortSignal;
const accessor = @import("../accessor.zig");
const Transform = accessor.Transform;
const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const ZigClassEntry = @import("../class-entry.zig").ZigClassEntry;
const failure = @import("../failure.zig");
const Error = failure.Error;
const Generator = @import("../generator.zig").Generator;
const GeneratorStatic = @import("../generator.zig").GeneratorStatic;
const ZigObject = @import("../object.zig").ZigObject;
const php = @import("../php.zig");
const FiberTransfer = php.FiberTransfer;
const HashTable = php.HashTable;
const N = php.getStaticString;
const Object = php.Object;
const String = php.String;
const Value = php.Value;
const Promise = @import("../promise.zig").Promise;
const PromiseStatic = @import("../promise.zig").PromiseStatic;
const structure = @import("../structure.zig");
const invokeMethod = structure.invokeMethod;
const Pointer = structure.Pointer;

pub const ArgStruct = struct {
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
        last_arg_optional: bool = false,
        retval: *ZigClassEntry.Member = undefined,
        allocator: ?*ZigClassEntry.Member = null,
        promise: ?*ZigClassEntry.Member = null,
        generator: ?*ZigClassEntry.Member = null,
        abort_signal: ?*ZigClassEntry.Member = null,

        pub fn init(self: *@This(), class_obj: *Object) !void {
            const class = ZigClassEntry.fromObject(class_obj);
            var iter = class.getMemberIterator(.instance);
            if (iter.len == 0) return error.Unexpected;
            var arg_count: usize = 0;
            var last_arg_class: *ZigClassEntry = undefined;
            _ = iter.next(); // first member is retval
            while (iter.next()) |member| {
                switch (member.class.purpose) {
                    .allocator, .promise, .generator, .abort_signal => {},
                    else => {
                        arg_count += 1;
                        last_arg_class = member.class;
                    },
                }
            }
            iter.reset();
            self.arg_accessors = try php.allocator.alloc(*accessor.Any, arg_count);
            const retval_member = iter.next().?;
            self.retval = retval_member;
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
            if (arg_count > 0) {
                // allow omission of last argument if it's a struct with no required fields
                if (last_arg_class.type == .@"struct") {
                    var last_arg_iter = last_arg_class.getMemberIterator(.instance);
                    self.last_arg_optional = while (last_arg_iter.next()) |m| {
                        if (m.flags.is_required) break false;
                    } else true;
                }
            }
        }

        pub fn deinit(self: *@This()) void {
            php.allocator.free(self.arg_accessors);
        }

        pub fn getReturnValueClass(self: *@This()) !*ZigClassEntry {
            return if (self.promise) |m|
                try getCallbackArgumentClass(m.class)
            else if (self.generator) |m|
                try getCallbackArgumentClass(m.class)
            else
                self.retval.class;
        }

        fn getCallbackArgumentClass(class: *ZigClassEntry) !*ZigClassEntry {
            const cb_member = try class.getMember(.instance, N("callback"));
            const fn_member = try cb_member.class.getMember(.instance, 0);
            const arg_member = try fn_member.class.getMember(.instance, 0);
            // argument struct members have string keys
            const value_member = try arg_member.class.getMember(.instance, N("1"));
            return value_member.class;
        }
    };

    pub fn copyArguments(self: *@This(), allocator: ?*std.mem.Allocator, arg_iter: *php.ArgumentIterator) !void {
        // mark buffer as transient so argument objects don't get registered
        self.buffer.flags.transient = true;
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        // take out initializers for special arguments
        var special_args: structure.Struct.SpecialArgs = .{};
        arg_iter.extractNamedArguments(&special_args, .{
            .allocator = static.allocator != null,
            .callback = static.promise != null or static.generator != null,
            .signal = static.abort_signal != null,
            .timeout = static.abort_signal != null,
        });
        defer {
            inline for (comptime std.meta.fieldNames(structure.Struct.SpecialArgs)) |name| {
                if (@field(special_args, name)) |v| php.release(&v);
            }
        }
        try self.buffer.allocate(allocator, class.byte_size.?);
        if (class.instance.template.buffer) |buf| {
            try self.buffer.copy(buf);
        } else {
            try self.buffer.clear();
        }
        const max_arg_count = static.arg_accessors.len;
        const min_arg_count = if (static.last_arg_optional) max_arg_count - 1 else max_arg_count;
        const arg_count = arg_iter.len;
        if (arg_count < min_arg_count or arg_count > max_arg_count) {
            return error.IncorrectArgumentCount;
        }
        // use accessors to write into the argument struct
        var index: usize = 0;
        while (arg_iter.next()) |arg_given| : (index += 1) {
            var arg_target: Value = undefined;
            const arg = init: {
                // if argument is a pointer, dereference it
                if (php.getValueObject(arg_given) catch null) |arg_obj| {
                    if (ZigClassEntry.isZigInstance(arg_obj)) {
                        const arg_class = ZigClassEntry.fromObject(arg_obj);
                        if (arg_class.type == .pointer) {
                            const arg_struct = structure.Pointer.fromObject(arg_obj);
                            // get the target without increasing its refcount
                            const target_obj = try arg_struct.getTarget();
                            arg_target = php.createValueObject(target_obj);
                            break :init &arg_target;
                        }
                    }
                }
                break :init arg_given;
            };
            const acc = static.arg_accessors[index];
            acc.set(self, arg) catch |err| {
                if (failure.hasMessage()) {
                    const msg = failure.acquireMessage(err);
                    defer php.allocator.free(msg);
                    return failure.report("args[{d}]: {s}", .{ index, msg });
                } else {
                    return err;
                }
            };
        }
        // initialize special arguments
        inline for (.{ .allocator, .promise, .generator, .abort_signal }) |t| {
            if (@field(static, @tagName(t))) |m| {
                const field_value = try m.accessors.get(self);
                defer php.release(&field_value);
                const field_struct = try structure.Struct.fromValue(&field_value);
                const T = switch (t) {
                    .allocator => std.mem.Allocator,
                    .promise => Promise,
                    .generator => Generator,
                    .abort_signal => AbortSignal,
                    else => unreachable,
                };
                try field_struct.initSpecial(T, special_args);
                @field(self.flags, "has_" ++ @tagName(t)) = true;
            }
        }
    }

    pub fn resolvePromise(self: *@This(), value: *const Value, allocator: ?*std.mem.Allocator) !void {
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        const promise = try static.promise.?.accessors.get(self);
        defer php.release(&promise);
        return PromiseStatic.resolve(&promise, value, allocator);
    }

    pub fn pipeFromGenerator(self: *@This(), value: *const Value, allocator: ?*std.mem.Allocator) !void {
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        const generator = try static.generator.?.accessors.get(self);
        defer php.release(&generator);
        return GeneratorStatic.pipe(&generator, value, allocator);
    }

    pub fn getArgumentCount(self: *@This()) usize {
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        return static.arg_accessors.len;
    }

    pub fn extractArguments(self: *@This(), args: []Value) !void {
        self.buffer.flags.transient = true;
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        for (static.arg_accessors, 0..) |acc, i| {
            errdefer for (0..i) |j| php.release(&args[j]);
            var arg = try acc.get(self);
            if (php.isValueNull(&arg)) {
                // an exception might have been thrown by an error union
                if (php.captureException() catch null) |err_obj| {
                    arg = php.createValueObject(php.reuse(err_obj));
                }
            }
            args[i] = arg;
        }
    }

    pub fn extractNamedArguments(self: *@This(), arg_info: []php.ArgInfo, ht_ptr: *?*HashTable) !void {
        const class = ZigClassEntry.fromStructure(self);
        var accepts: struct {
            allocator: bool = false,
            callback: bool = false,
            signal: bool = false,
        } = .{};
        var has_named: bool = false;
        for (arg_info) |info| {
            inline for (std.meta.fields(@TypeOf(accepts))) |field| {
                if (php.matchString(info.name, field.name)) {
                    @field(accepts, field.name) = true;
                    has_named = true;
                }
            }
        }
        const args: ?*HashTable = if (has_named) php.createArray() else null;
        errdefer if (args) |ht| php.release(ht);
        const static = class.getStaticData(@This());
        // add allocator to named arg hash if function accepts one
        if (static.allocator) |m| {
            self.flags.has_allocator = true;
            if (accepts.allocator) {
                const allocator = try m.accessors.get(self);
                php.setHashEntry(args.?, N("allocator"), &allocator);
            }
        }
        // add callback for promise and generator if function accepts one
        if (static.generator) |m| {
            self.flags.has_generator = true;
            if (accepts.callback) {
                const callback_ht = php.createArray();
                errdefer php.release(callback_ht);
                const generator = try m.accessors.get(self);
                const method = php.createValueString(N("yield"));
                _ = php.appendHashEntry(callback_ht, &generator);
                _ = php.appendHashEntry(callback_ht, &method);
                const callback = php.createValueArray(callback_ht);
                php.setHashEntry(args.?, N("callback"), &callback);
                self.flags.has_callback = true;
                if (self.flags.has_allocator) {
                    // attach allocator to the generator
                    try self.attachAllocator(&generator);
                } else {
                    if (accepts.allocator) {
                        // see if the generator has an attached allocator
                        if (m.class.getMember(.instance, N("allocator")) catch null) |am| {
                            // make it available as a callback argument
                            const generator_struct = try structure.Struct.fromValue(&generator);
                            const allocator = try am.accessors.get(generator_struct);
                            php.setHashEntry(args.?, N("allocator"), &allocator);
                        }
                    }
                }
            }
        }
        if (static.promise) |m| {
            self.flags.has_promise = true;
            if (accepts.callback) {
                const callback_ht = php.createArray();
                errdefer php.release(callback_ht);
                const promise = try m.accessors.get(self);
                const method = php.createValueString(N("resolve"));
                _ = php.appendHashEntry(callback_ht, &promise);
                _ = php.appendHashEntry(callback_ht, &method);
                const callback = php.createValueArray(callback_ht);
                php.setHashEntry(args.?, N("callback"), &callback);
                self.flags.has_callback = true;
                if (self.flags.has_allocator) {
                    try self.attachAllocator(&promise);
                }
            }
        }
        // add abort signal to named arguments if function accepts one
        if (static.abort_signal) |m| {
            self.flags.has_abort_signal = true;
            if (accepts.signal) {
                const signal = try m.accessors.get(self);
                php.setHashEntry(args.?, N("signal"), &signal);
            }
        }
        ht_ptr.* = args;
    }

    fn attachAllocator(self: *@This(), dest_value: *const Value) !void {
        const dest_struct = try structure.Struct.fromValue(dest_value);
        const allocator = try self.getAllocator();
        dest_struct.buffer.attachAllcator(allocator);
    }

    pub fn hasAsyncCallback(self: *@This()) bool {
        return self.flags.has_promise or self.flags.has_generator;
    }

    pub fn getReturnValue(self: *@This()) !Value {
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        const value = try static.retval.accessors.get(self);
        // see if an error union has yielded an error
        const eg = php.getExecutorGlobals();
        if (eg.exception != null) return error.ExceptionThrown;
        return value;
    }

    pub fn setReturnValue(self: *@This(), value: *const Value) !void {
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        // if an allocator is part of the struct, then use the allocator to create an instance
        // of the retval to ensure autovivication uses that allocator
        var allocated_obj: *Object = undefined;
        var allocated: Value = undefined;
        if (self.flags.has_allocator) {
            const allocator = try self.getAllocator();
            allocated_obj = try static.retval.class.createObject(allocator, value, false);
            allocated = php.createValueObject(allocated_obj);
        }
        defer if (self.flags.has_allocator) php.release(&allocated);
        const retval = if (self.flags.has_allocator) &allocated else value;
        static.retval.accessors.set(self, retval) catch |err| {
            // see if the value given is an exception
            if (php.getValueException(value) catch null) |ex_obj| {
                // report the exception
                const message = try php.getExceptionMessage(ex_obj);
                defer php.release(&message);
                var text = try php.getValueStringContent(&message);
                if (std.mem.endsWith(u8, text, " (zig)")) text.len -= 6;
                return failure.report("{s}", .{text});
            }
            return err;
        };
        if (self.flags.has_allocator) {
            // assume allocated memory have been taken by Zig code
            invokeMethod(allocated_obj, "externalize", .{}) catch unreachable;
        }
    }

    pub fn sendReturnValue(self: *@This(), value: *const Value) !void {
        // don't do anything when a callback function was retrieved
        if (self.flags.has_callback) return;
        const allocator = if (self.flags.has_allocator) try self.getAllocator() else null;
        if (self.flags.has_promise) {
            self.resolvePromise(value, allocator) catch |err| {
                const new_err = switch (err) {
                    error.ExceptionThrown => failure.report("unable to find matching entry for PHP exception in error set of promise", .{}),
                    else => failure.report("unable to resolve promise: {s}", .{failure.getMessage(err)}),
                };
                return php.triggerWarning(new_err);
            };
        } else if (self.flags.has_generator) {
            self.pipeFromGenerator(value, allocator) catch |err| {
                const new_err = switch (err) {
                    error.ExceptionThrown => failure.report("unable to find matching entry for PHP exception in error set of generator", .{}),
                    else => failure.report("unable to yield generated value: {s}", .{failure.getMessage(err)}),
                };
                return php.triggerWarning(new_err);
            };
        }
    }

    pub fn getAllocator(self: *@This()) !*std.mem.Allocator {
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        const allocator_member = static.allocator orelse return error.Unexpected;
        const allocator_value = try allocator_member.accessors.get(self);
        defer php.release(&allocator_value);
        const allocator_struct = try structure.Struct.fromValue(&allocator_value);
        return try allocator_struct.getAllocator();
    }

    pub fn getSpecialArgument(self: *@This(), comptime T: type) !*structure.Struct {
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        const member = switch (T) {
            std.mem.Allocator => static.allocator,
            Promise => static.promise,
            Generator => static.generator,
            AbortSignal => static.abort_signal,
            else => @compileError("Unexpected type: " ++ @typeName(T)),
        } orelse return error.Missing;
        const value = try member.accessors.get(self);
        defer php.release(&value);
        return try structure.Struct.fromValue(&value);
    }

    pub fn detachFunctionThunks(self: *@This()) !void {
        try self.visitPointers(Pointer.detachFunctionThunk, .{}, .{ .ignore_arguments = false });
    }

    pub fn visitPointers(self: *@This(), cb: anytype, args: anytype, comptime options: structure.VisitOptions) Error!void {
        const class = ZigClassEntry.fromStructure(self);
        if (class.flags.common.has_pointer) {
            var iter = class.getMemberIterator(.instance);
            var index: usize = 0;
            while (iter.next()) |member| : (index += 1) {
                if (options.ignore_return_value and index == 0) continue;
                if (options.ignore_arguments and index != 0) continue;
                if (member.class.flags.common.has_pointer) {
                    if (try member.accessors.getObject(self, !options.ignore_uncreated)) |obj| {
                        try structure.invokeMethod(obj, "visitPointers", .{ cb, args, options });
                    }
                }
            }
        }
    }

    pub const setStorage = Super.setStorage;
    pub const getValue = Super.getValue;
    pub const propertyExists = Super.propertyExists;
    pub const freeObject = Super.freeObject;
    pub const getConstructor = Super.getConstructor;
    pub const getGarbageCollection = Super.getGarbageCollection;
    pub const fromObject = Super.fromObject;
    pub const fromValue = Super.fromValue;
};
