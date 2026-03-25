const std = @import("std");

const CallDispatcher = @import("dispatch.zig").CallDispatcher;
const ModuleHost = @import("host.zig").ModuleHost;
const php = @import("php.zig");
const ArgumentIterator = php.ArgumentIterator;
const ExecuteData = php.ExecuteData;
const Fiber = php.Fiber;
const Object = php.Object;
const FiberTransfer = php.FiberTransfer;
const Value = php.Value;
const structure = @import("structure.zig");
const invokeMethod = structure.invokeMethod;
const ZigClassEntry = @import("class-entry.zig").ZigClassEntry;
const ZigObject = @import("object.zig").ZigObject;

pub const Promise = struct {
    ref_count: u32 = 1,
    status: enum { unresolved, waiting, resolved } = .unresolved,
    fiber: Value = undefined,
    result: Value = undefined,

    pub fn create() !*@This() {
        const self = try php.allocator.create(@This());
        self.* = .{};
        return self;
    }

    pub fn addRef(self: *@This()) void {
        self.ref_count += 1;
    }

    pub fn release(self: *@This()) void {
        self.ref_count -= 1;
        if (self.ref_count == 0) {
            self.dispatcher.host.release();
            php.allocator.destroy(self);
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
        if (php.getType(&self.result) == .object) {
            const result_obj = php.getValueObject(&self.result) catch unreachable;
            self.result = try invokeMethod(result_obj, "readSelf", .{.to_value});
        }
        return self.result;
    }

    pub fn resolve(self: *@This(), value: *Value) void {
        self.result = value.*;
        if (self.status == .waiting) {
            CallDispatcher.event_loop.resumeFiberAfterward(&self.fiber);
        }
        self.status = .resolved;
    }

    pub fn getHandler() Value {
        const handler = php.transform(resolvePromise);
        var func = php.createFunction(handler, "resolve", 1, false);
        return php.createValueClosure(&func, null, null, null);
    }

    pub fn resolvePromise(ed: *ExecuteData, return_value: *Value) !void {
        var arg_iter: ArgumentIterator = .init(ed);
        const ptr = arg_iter.next() orelse return error.Unexpected;
        const ptr_obj = php.getValueObject(ptr) catch unreachable;
        const ptr_struct = ZigObject(structure.Optional).fromObject(ptr_obj).structure();
        const slice_value = try ptr_struct.readSelf(.to_value);
        const slice_obj = php.getValueObject(&slice_value) catch unreachable;
        const slice_struct = ZigObject(structure.Slice).fromObject(slice_obj).structure();
        const promise: *Promise = @ptrCast(@alignCast(slice_struct.buffer.bytes.ptr));
        const result = arg_iter.next() orelse return error.Unexpected;
        promise.resolve(result);
        const eg = php.getExecutorGlobals();
        if (eg.exception) |_| {
            std.debug.print("Exception\n", .{});
        }
        return_value.* = php.createValueNull();
    }
};
