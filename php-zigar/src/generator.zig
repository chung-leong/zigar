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

pub const Generator = struct {
    status: enum { unresolved, waiting, resolved, finished, released } = .unresolved,
    fiber: Value = undefined,
    result: Value,
    callback: ?Value,
    index: isize = 0,
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

    pub fn addRef(self: *@This()) void {
        self.buffer.addRef();
    }

    pub fn release(self: *@This()) void {
        if (self.status == .finished) {
            self.buffer.release();
        } else {
            // preserve the generator until the content source has been informed
            self.status = .released;
        }
    }

    pub fn moveForward(self: *@This()) !bool {
        if (self.status != .finished) {
            self.status = .waiting;
            try CallDispatcher.event_loop.suspendFiber(&self.fiber);
            return true;
        } else {
            return false;
        }
    }

    pub fn rewind(self: *@This()) !bool {
        if (self.status == .unresolved) {
            self.fiber = try CallDispatcher.event_loop.getFiber();
            return try self.moveForward();
        } else {
            return false;
        }
    }

    pub fn isValid(self: *@This()) bool {
        return self.status == .resolved;
    }

    pub fn getHandler() Value {
        const handler = php.transform(resolveGenerator);
        var func = php.createFunction(handler, "output", 1, false);
        return php.createValueClosure(&func, null, null, null);
    }

    pub fn resolve(self: *@This(), value: *Value) !bool {
        switch (self.status) {
            .released => {
                self.buffer.release();
                return false;
            },
            .waiting => CallDispatcher.event_loop.resumeFiberAfterward(&self.fiber),
            else => {},
        }
        self.result = value.*;
        php.addRef(&self.result);
        try self.transform.apply(&self.result);
        if (!php.isNull(&self.result)) {
            self.status = .resolved;
            return true;
        } else {
            self.status = .finished;
            return false;
        }
    }

    pub fn resolveGenerator(ed: *ExecuteData, return_value: *Value) !void {
        var arg_iter: ArgumentIterator = .init(ed);
        const ptr = arg_iter.next() orelse return error.Unexpected;
        const ptr_obj = php.getValueObject(ptr) catch unreachable;
        const ptr_struct = ZigObject(structure.Optional).fromObject(ptr_obj).structure();
        const target = try ptr_struct.readSelf(.to_value);
        const self = try accessor.getOpaqueTarget(@This(), &target);
        const result = arg_iter.next() orelse return error.Unexpected;
        const more = try self.resolve(result);
        return_value.* = php.createValueBool(more);
    }
};
