const std = @import("std");

const accessor = @import("accessor.zig");
const ObjectTransform = accessor.ObjectTransform;
const ByteBuffer = @import("buffer.zig").ByteBuffer;
const CallDispatcher = @import("dispatch.zig").CallDispatcher;
const php = @import("php.zig");
const ArgumentIterator = php.ArgumentIterator;
const ExecuteData = php.ExecuteData;
const Fiber = php.Fiber;
const Object = php.Object;
const Value = php.Value;
const structure = @import("structure.zig");
const ZigObject = @import("object.zig").ZigObject;

pub const Promise = struct {
    status: enum { unresolved, waiting, resolved, released } = .unresolved,
    fiber: Value = undefined,
    result: Value,
    callback: ?Value,
    transform: ObjectTransform = .to_value,
    buffer: *ByteBuffer,

    pub fn create(callback: ?Value) !*@This() {
        const alignment: std.mem.Alignment = .fromByteUnits(@alignOf(@This()));
        const buf = try ByteBuffer.create(alignment);
        try buf.allocate(null, @sizeOf(@This()));
        const self: *@This() = @ptrCast(@alignCast(buf.bytes.ptr));
        self.* = .{
            .buffer = buf,
            .result = php.createValueNull(),
            .callback = if (callback) |cb| init: {
                php.addRef(&cb);
                break :init cb;
            } else null,
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
    }

    pub fn await(self: *@This()) !Value {
        // std.debug.print("Promise.await() called\n", .{});
        if (self.status == .unresolved) {
            self.fiber = try CallDispatcher.event_loop.getFiber();
            self.status = .waiting;
            try CallDispatcher.event_loop.suspendFiber(&self.fiber);
        }
        // std.debug.print("Promise.await() resumed\n", .{});
        if (php.getValueType(&self.result) == .object) {
            const result_obj = php.getValueObject(&self.result) catch unreachable;
            self.result = try structure.invokeMethod(result_obj, "getValue", .{.to_value});
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
        self.result = value.*;
        php.addRef(&self.result);
        try self.transform.apply(&self.result);
        self.status = .resolved;
    }

    pub fn getHandler() Value {
        var func = php.createTransformedFunction(handleResolve, "resolve", 2, false);
        return php.createValueClosure(&func, null, null, null);
    }

    pub fn handleResolve(ed: *ExecuteData, return_value: *Value) !void {
        var arg_iter: ArgumentIterator = .init(ed);
        const ptr = arg_iter.next() orelse return error.Unexpected;
        const ptr_obj = php.getValueObject(ptr) catch unreachable;
        const ptr_struct = ZigObject(structure.Optional).fromObject(ptr_obj).structure();
        const target = try ptr_struct.getValue(.to_value);
        const self = try accessor.getOpaqueTarget(@This(), &target);
        const result = arg_iter.next() orelse return error.Unexpected;
        try self.resolve(result);
        return_value.* = php.createValueNull();
    }
};
