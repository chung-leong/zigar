const std = @import("std");

const accessor = @import("accessor.zig");
const Transform = accessor.Transform;
const ByteBuffer = @import("buffer.zig").ByteBuffer;
const CallDispatcher = @import("dispatch.zig").CallDispatcher;
const failure = @import("failure.zig");
const php = @import("php.zig");
const ArgumentIterator = php.ArgumentIterator;
const ExecuteData = php.ExecuteData;
const Fiber = php.Fiber;
const Function = php.Function;
const FunctionCallCache = php.FunctionCallCache;
const N = php.getStaticString;
const Object = php.Object;
const String = php.String;
const Value = php.Value;
const structure = @import("structure.zig");
const ZigClassEntry = @import("class-entry.zig").ZigClassEntry;
const ZigObject = @import("object.zig").ZigObject;

pub const Promise = struct {
    status: enum { unresolved, waiting, resolved, released } = .unresolved,
    fiber: Value,
    result: Value,
    callback: ?Value,
    transform: ?Transform = null,
    buffer: *ByteBuffer,

    pub fn create(callback: ?Value) !*@This() {
        const alignment: std.mem.Alignment = .fromByteUnits(@alignOf(@This()));
        const buf = try ByteBuffer.create(alignment);
        try buf.allocate(null, @sizeOf(@This()));
        const self: *@This() = @ptrCast(@alignCast(buf.bytes.ptr));
        self.* = .{
            .buffer = buf,
            .result = php.createValueNull(),
            .fiber = php.createValueNull(),
            .callback = if (callback) |cb| php.reuse(&cb).* else null,
        };
        return self;
    }

    pub fn release(self: *@This()) void {
        if (self.status == .waiting) {
            // preserve the promise object until the callback is called
            self.status = .released;
            return;
        }
        if (self.buffer.ref_count == 1) {
            if (self.callback) |*cb| php.release(cb);
            php.release(&self.result);
            php.release(&self.fiber);
        }
        // this needs to happen last, since self points to the memory in the buffer
        self.buffer.release();
    }

    pub fn await(self: *@This()) !Value {
        // std.debug.print("Promise.await() called\n", .{});
        if (self.status == .unresolved) {
            php.release(&self.fiber);
            self.fiber = try CallDispatcher.event_loop.getFiber();
            self.status = .waiting;
            try CallDispatcher.event_loop.suspendFiber(&self.fiber);
        }
        return self.result;
    }

    pub fn resolve(self: *@This(), value: *Value) !void {
        switch (self.status) {
            .released => {
                self.buffer.release();
                return;
            },
            .waiting => CallDispatcher.event_loop.resumeFiberAfterward(&self.fiber),
            else => {},
        }
        self.result = php.reuse(value).*;
        self.status = .resolved;
        if (self.transform) |tm| try tm.apply(&self.result);
        if (self.callback) |*cb| {
            defer php.release(&self.result);
            const args: []Value = @ptrCast(&self.result);
            const retval = try php.invokeMethod(null, cb, args);
            php.release(&retval);
        }
    }

    pub fn createHandler() Value {
        var func = php.createTransformedFunction(handleResolve, "resolve", 2, false);
        return php.createValueClosure(&func, null, null, null);
    }

    pub fn handleResolve(ed: *ExecuteData, return_value: *Value) !void {
        var arg_iter: ArgumentIterator = .init(ed);
        const ptr = arg_iter.next() orelse return error.Unexpected;
        const ptr_obj = php.getValueObject(ptr) catch unreachable;
        const ptr_struct = ZigObject(structure.Pointer).fromObject(ptr_obj).structure();
        const target = try ptr_struct.getValue(.none);
        defer php.release(&target);
        const self = try accessor.getOpaqueTarget(@This(), &target);
        const result = arg_iter.next() orelse return error.Unexpected;
        try self.resolve(result);
        return_value.* = php.createValueNull();
    }
};

pub const PromiseStatic = struct {
    methods: Methods = undefined,
    callback: *Object = undefined,

    pub const Methods = struct {
        resolve: Function,
    };
    const CallbackContext = struct {
        allocator: ?*std.mem.Allocator,
        argument_class: *ZigClassEntry,
        pointer: Value,
        call_cache: FunctionCallCache,

        pub fn init(generator: *const Value, extern_allocator: ?*std.mem.Allocator) !@This() {
            const generator_struct = try structure.Struct.fromValue(generator);
            const callback_value = try generator_struct.getProperty(N("callback"), null);
            defer php.release(&callback_value);
            const callback_struct = try structure.Pointer.fromValue(&callback_value);
            const fn_value = try callback_struct.getValue(.none);
            defer php.release(&fn_value);
            const arg_class = try structure.Function.getArgumentClass(&fn_value, N("1"));
            const ptr_value = try generator_struct.getProperty(N("ptr"), null);
            errdefer php.release(&ptr_value);
            return .{
                .call_cache = try .init(&fn_value),
                .allocator = extern_allocator,
                .argument_class = arg_class,
                .pointer = ptr_value,
            };
        }

        pub fn deinit(self: *@This()) void {
            self.call_cache.deinit();
            php.release(&self.pointer);
        }

        pub fn send(self: *@This(), value: *const Value) !void {
            if (self.allocator) |a| {
                const converted_value = try structure.Function.allocateArgument(a, value, self.argument_class);
                defer php.release(&converted_value);
                _ = try self.call_cache.invoke(&.{ self.pointer, converted_value });
                try structure.Function.externalizeArgument(a, &converted_value);
            } else {
                _ = try self.call_cache.invoke(&.{ self.pointer, value.* });
            }
        }
    };

    pub fn init(self: *@This(), class: *ZigClassEntry) !void {
        const closure = Promise.createHandler();
        defer php.release(&closure);
        const cb_member = try class.getMember(.instance, "callback");
        if (cb_member.class.type != .pointer) return error.Unexpected;
        const cb_obj = try cb_member.class.createObject(null, &closure, false);
        self.callback = cb_obj;
        self.methods = .{
            .resolve = php.createTransformedFunction(handleResolve, "resolve", 1, false),
        };
    }

    pub fn deinit(self: *@This()) void {
        php.release(self.callback);
    }

    pub fn findMethod(self: *@This(), name: *String) ?*php.Function {
        return inline for (std.meta.fields(Methods)) |field| {
            if (php.matchString(name, field.name)) break &@field(self.methods, field.name);
        } else return null;
    }

    pub fn handleResolve(ed: *ExecuteData, _: *Value) !void {
        var arg_iter: ArgumentIterator = .init(ed);
        if (arg_iter.len != 1) return failure.reportArgCountMismatch("resolve", 1, 1, arg_iter.len);
        const value = arg_iter.next().?;
        // see if there's an allocator stashed in the buffer
        const promise_struct = try structure.Struct.fromValue(arg_iter.this);
        const allocator = promise_struct.buffer.getAllocator();
        try resolve(arg_iter.this, value, allocator);
    }

    pub fn resolve(promise: *const Value, value: *const Value, extern_allocator: ?*std.mem.Allocator) !void {
        var cb_context: CallbackContext = try .init(promise, extern_allocator);
        defer cb_context.deinit();
        try cb_context.send(value);
    }
};
