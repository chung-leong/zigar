const std = @import("std");

const accessor = @import("accessor.zig");
const Transform = accessor.Transform;
const ByteBuffer = @import("buffer.zig").ByteBuffer;
const CallDispatcher = @import("dispatch.zig").CallDispatcher;
const php = @import("php.zig");
const php_ng = @import("php/root.zig");
const Array = php_ng.Array;
const Function = php_ng.Function;
const Object = php_ng.Object;
const String = php_ng.String;
const N = String.static;
const Value = php_ng.Value;
const structure = @import("structure.zig");
const ZigClassEntry = @import("class-entry.zig").ZigClassEntry;

pub const Promise = struct {
    status: enum { unused, waiting, resolved, detached, released } = .unused,
    fiber: Value,
    result: Value,
    callback: ?Value,
    callback_cache: Function.CallCache,
    transform: ?Transform = null,
    buffer: *ByteBuffer,
    arguments: ?*Array = null,

    pub fn create(callback: ?Value) !*@This() {
        const alignment: std.mem.Alignment = .fromByteUnits(@alignOf(@This()));
        const buf = try ByteBuffer.create(alignment);
        try buf.allocate(null, @sizeOf(@This()));
        const self: *@This() = @ptrCast(@alignCast(buf.bytes.ptr));
        self.* = .{
            .buffer = buf,
            .result = .fromNull(),
            .fiber = .fromNull(),
            .callback_cache = if (callback) |cb| try .init(cb) else undefined,
            .callback = if (callback) |cb| cb.retain() else null,
        };
        return self;
    }

    pub fn release(self: *@This()) void {
        if (self.status != .resolved and self.status != .unused and self.status != .detached) {
            // preserve the promise object until the callback is called
            self.status = .released;
            return;
        }
        if (self.buffer.ref_count == 1) {
            if (self.callback) |cb| {
                cb.release();
                self.callback_cache.deinit();
            }
            self.result.release();
            self.fiber.release();
            if (self.arguments) |args| args.release();
        }
        // this needs to happen last, since self points to the memory in the buffer
        self.buffer.release();
    }

    pub fn retain(self: *@This(), args: *Array) void {
        self.arguments = args;
    }

    pub fn detach(self: *@This()) void {
        std.debug.assert(self.callback != null);
        self.status = .detached;
        self.buffer.addRef();
    }

    pub fn await(self: *@This()) !Value {
        // std.debug.print("Promise.await() called\n", .{});
        if (self.status == .unused) {
            self.fiber.release();
            self.fiber = try CallDispatcher.event_loop.getFiber();
            self.status = .waiting;
            try CallDispatcher.event_loop.suspendFiber(self.fiber);
        }
        // throw if the callback received an exception
        if (self.result.kind() == .object) {
            const obj = self.result.object();
            if (obj.hasStandardInterface(.throwable)) {
                return php_ng.throwException(obj);
            }
        }
        // it's up to the caller to dispose of the result
        return self.result.retain();
    }

    pub fn resolve(self: *@This(), value: Value) !void {
        switch (self.status) {
            .released => {
                self.status = .resolved;
                self.release();
                return;
            },
            .waiting => CallDispatcher.event_loop.resumeFiberAfterward(self.fiber),
            else => {},
        }
        self.result = value.retain();
        if (self.transform) |tm| try tm.apply(@ptrCast(&self.result));
        if (self.status == .detached) {
            defer self.release();
            const retval = try self.callback_cache.invoke(&.{self.result});
            retval.release();
        } else {
            self.status = .resolved;
        }
    }

    pub fn createHandler() Value {
        var func: Function = .fromHandler(onResolve, null);
        const closure = func.createClosure(null, null, null);
        return closure.toValue();
    }

    pub fn onResolve(args: struct {
        pointer: *Object,
        result: Value,
    }) !void {
        const ptr_struct = structure.Pointer.fromObject(@ptrCast(args.pointer));
        const target_og = try ptr_struct.getValue(.none);
        const target: Value = .fromZval(target_og);
        defer target.release();
        const self = try accessor.getOpaqueTarget(@This(), @ptrCast(&target));
        try self.resolve(args.result);
    }
};

pub const PromiseStatic = struct {
    methods: Methods,
    callback: ?*Object = null,

    pub const Methods = struct {
        resolve: Function,
    };
    const CallbackContext = struct {
        allocator: ?*std.mem.Allocator,
        argument_class: *ZigClassEntry,
        pointer: Value,
        call_cache: Function.CallCache,

        pub fn init(promise_obj: *Object, extern_allocator: ?*std.mem.Allocator) !@This() {
            const promise_struct = structure.Struct.fromObject(@ptrCast(promise_obj));
            const callback_value_og = try promise_struct.getProperty(@ptrCast(N("callback")), null);
            const callback_value: Value = .fromZval(callback_value_og);
            defer callback_value.release();
            const callback_struct = try structure.Pointer.fromValue(@ptrCast(&callback_value));
            const fn_value_og = try callback_struct.getValue(.none);
            const fn_value: Value = .fromZval(fn_value_og);
            defer fn_value.release();
            const arg_class = try structure.Function.getArgumentClass(@ptrCast(&fn_value), @ptrCast(N("1")));
            const ptr_value_og = try promise_struct.getProperty(@ptrCast(N("ptr")), null);
            const ptr_value: Value = .fromZval(ptr_value_og);
            errdefer ptr_value.release();
            return .{
                .call_cache = try .init(fn_value),
                .allocator = extern_allocator,
                .argument_class = arg_class,
                .pointer = ptr_value,
            };
        }

        pub fn deinit(self: *@This()) void {
            self.call_cache.deinit();
            self.pointer.release();
        }

        pub fn send(self: *@This(), value: Value) !void {
            if (self.allocator) |a| {
                const converted_value_og = try structure.Function.allocateArgument(a, @ptrCast(&value), self.argument_class);
                const converted_value: Value = .fromZval(converted_value_og);
                defer converted_value.release();
                _ = try self.call_cache.invoke(&.{ self.pointer, converted_value });
                try structure.Function.externalizeArgument(a, @ptrCast(&converted_value));
            } else {
                _ = try self.call_cache.invoke(&.{ self.pointer, value });
            }
        }
    };

    pub fn init(self: *@This()) !void {
        self.* = .{
            .methods = .{
                .resolve = .fromHandler(onResolve, *Object),
            },
        };
    }

    pub fn deinit(self: *@This()) void {
        if (self.callback) |cb| cb.release();
    }

    pub fn getCallback(self: *@This(), class: *ZigClassEntry) !*Object {
        return self.callback orelse create: {
            const closure = Promise.createHandler();
            defer closure.release();
            const cb_member = try class.getMember(.instance, "callback");
            const cb_obj = try cb_member.class.createObject(null, @ptrCast(&closure), false);
            self.callback = @ptrCast(cb_obj);
            break :create @ptrCast(cb_obj);
        };
    }

    pub fn findMethod(self: *@This(), name: *String) ?*php.Function {
        const fn_ng = inline for (comptime std.meta.fieldNames(Methods)) |field_name| {
            if (name.matchSlice(field_name)) break &@field(self.methods, field_name);
        } else return null;
        return @ptrCast(fn_ng);
    }

    pub fn onResolve(promise_obj: *Object, args: struct {
        result: Value,
    }) !void {
        // see if there's an allocator stashed in the buffer
        const promise_struct = structure.Struct.fromObject(@ptrCast(promise_obj));
        const allocator = promise_struct.buffer.getAllocator();
        try resolve(promise_obj, args.result, allocator);
    }

    pub fn resolve(promise_obj: *Object, value: Value, extern_allocator: ?*std.mem.Allocator) !void {
        var cb_context: CallbackContext = try .init(promise_obj, extern_allocator);
        defer cb_context.deinit();
        try cb_context.send(value);
    }
};
