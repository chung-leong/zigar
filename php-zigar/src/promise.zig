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
const N = php.getStaticString;
const Object = php.Object;
const String = php.String;
const Value = php.Value;
const structure = @import("structure.zig");
const ZigClassEntry = @import("class-entry.zig").ZigClassEntry;
const ZigObject = @import("object.zig").ZigObject;

pub const Promise = struct {
    status: enum { unresolved, waiting, resolved, released } = .unresolved,
    fiber: Value = undefined,
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
            .callback = if (callback) |cb| php.reuse(&cb).* else null,
        };
        return self;
    }

    pub fn release(self: *@This()) void {
        if (self.status == .resolved) {
            self.buffer.release();
        } else {
            // preserve the promise object until the callback is called
            self.status = .released;
        }
        if (self.callback) |*cb| php.release(cb);
    }

    pub fn await(self: *@This()) !Value {
        // std.debug.print("Promise.await() called\n", .{});
        if (self.status == .unresolved) {
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
        const allocator = try getAllocator(arg_iter.this);
        try resolve(arg_iter.this, value, allocator);
    }

    pub fn resolve(promise: *const Value, value: *const Value, allocator: ?*std.mem.Allocator) !void {
        const fn_value, const ptr_value = try getCallbackParams(promise);
        defer php.release(&fn_value);
        defer php.release(&ptr_value);
        try send(&fn_value, &ptr_value, value, allocator);
    }

    fn send(fn_value: *const Value, ptr_value: *const Value, value: *const Value, allocator: ?*std.mem.Allocator) !void {
        if (allocator) |a| {
            const converted_value = try structure.Function.allocateArgument(a, value, fn_value, N("1"));
            defer php.release(&converted_value);
            _ = try php.invokeMethod(null, fn_value, &.{ ptr_value.*, converted_value });
            try structure.Function.externalizeArgument(a, &converted_value);
        } else {
            _ = try php.invokeMethod(null, fn_value, &.{ ptr_value.*, value.* });
        }
    }

    fn getAllocator(this: *const Value) !?*std.mem.Allocator {
        const generator_struct = try structure.Struct.fromValue(this);
        const value = php.getProperty(&generator_struct.table, N("allocator")) catch return null;
        return php.getValuePointer(*std.mem.Allocator, value);
    }

    fn getCallbackParams(promise: *const Value) !std.meta.Tuple(&.{ Value, Value }) {
        const promise_obj = try php.getValueObject(promise);
        const promise_struct = ZigObject(structure.Struct).fromObject(promise_obj).structure();
        const callback_value = try promise_struct.getProperty(N("callback"), null);
        const callback_obj = try php.getValueObject(&callback_value);
        defer php.release(callback_obj);
        const callback_struct = ZigObject(structure.Pointer).fromObject(callback_obj).structure();
        const fn_value = try callback_struct.getValue(.none);
        errdefer php.release(&fn_value);
        const ptr_value = try promise_struct.getProperty(N("ptr"), null);
        return .{ fn_value, ptr_value };
    }
};
