const std = @import("std");

const ByteBuffer = @import("buffer.zig").ByteBuffer;
const CallDispatcher = @import("dispatch.zig").CallDispatcher;
const ModuleHost = @import("host.zig").ModuleHost;
const ObjectTransform = @import("accessor.zig").ObjectTransform;
const php = @import("php.zig");
const ArgumentIterator = php.ArgumentIterator;
const ClassEntry = php.ClassEntry;
const ExecuteData = php.ExecuteData;
const Fiber = php.Fiber;
const Function = php.Function;
const Object = php.Object;
const ObjectHandlers = php.ObjectHandlers;
const FiberTransfer = php.FiberTransfer;
const String = php.String;
const Value = php.Value;
const structure = @import("structure.zig");
const ZigObject = @import("object.zig").ZigObject;

pub const Generator = struct {
    status: enum { unresolved, waiting, resolved, finished, terminated } = .unresolved,
    fiber: Value = undefined,
    result: Value,
    callback: ?Value,
    index: isize = -1,
    transform: ObjectTransform = .to_value,
    buffer: *ByteBuffer,

    pub fn create(callback: ?*const Value) !*@This() {
        const alignment: std.mem.Alignment = .fromByteUnits(@alignOf(@This()));
        const buf = try ByteBuffer.createNew(@sizeOf(@This()), alignment, false);
        const self: *@This() = @ptrCast(@alignCast(buf.bytes.ptr));
        self.* = .{
            .buffer = buf,
            .result = php.createValueNull(),
            .callback = if (callback) |cb| init: {
                php.addRef(cb);
                break :init cb.*;
            } else null,
        };
        return self;
    }

    pub fn terminate(obj: *Object) void {
        const self = getSelf(obj);
        if (self.status != .finish) {
            self.status = .terminated;
            self.buffer.addRef();
        }
    }

    pub fn current(_: *anyopaque, arg_iter: *ArgumentIterator) !?Value {
        const self = getSelfFromValue(arg_iter.this);
        return if (self.status == .resolved)
            self.result
        else
            php.createValueNull();
    }

    pub fn key(_: *anyopaque, arg_iter: *ArgumentIterator) !?Value {
        const self = getSelfFromValue(arg_iter.this);
        return if (self.status == .resolved and self.index <= std.math.maxInt(c_long))
            php.createValueLong(@truncate(self.index))
        else
            php.createValueNull();
    }

    pub fn next(_: *anyopaque, arg_iter: *ArgumentIterator) !?Value {
        const self = getSelfFromValue(arg_iter.this);
        self.status = .waiting;
        try CallDispatcher.event_loop.suspendFiber(&self.fiber);
        self.index += 1;
        return php.createValueNull();
    }

    pub fn rewind(_: *anyopaque, arg_iter: *ArgumentIterator) !?Value {
        const self = getSelfFromValue(arg_iter.this);
        if (self.status == .unresolved) {
            self.fiber = try CallDispatcher.event_loop.getFiber();
            try self.next();
        }
        return php.createValueNull();
    }

    pub fn valid(_: *anyopaque, arg_iter: *ArgumentIterator) !?Value {
        const self = getSelfFromValue(arg_iter.this);
        return php.createValueBool(self.status == .resolved);
    }

    fn getSelfFromValue(arg_iter: *ArgumentIterator) !*@This() {
        const obj = try php.getValueObject(arg_iter.this);
        return getSelf(obj);
    }

    fn getSelf(obj: *Object) !*@This() {
        const generator_struct = ZigObject(structure.Struct).fromObject(obj).structure();
        return try generator_struct.getSpecialContext(.generator);
    }

    pub fn getHandler() Value {
        const handler = php.transform(runGenerator);
        var func = php.createFunction(handler, "output", 1, false);
        return php.createValueClosure(&func, null, null, null);
    }

    pub fn resolve(self: *@This(), value: *Value) !bool {
        self.status = .resolved;
        if (self.status == .terminated) {
            return false;
        } else {
            self.result = value.*;
            try self.transform.apply(&self.result);
            if (self.status == .waiting) {
                CallDispatcher.event_loop.resumeFiberAfterward(&self.fiber);
            }
            return true;
        }
    }

    pub fn runGenerator(ed: *ExecuteData, return_value: *Value) !void {
        var arg_iter: ArgumentIterator = .init(ed);
        const ptr = arg_iter.next() orelse return error.Unexpected;
        const ptr_obj = php.getValueObject(ptr) catch unreachable;
        const ptr_struct = ZigObject(structure.Optional).fromObject(ptr_obj).structure();
        const slice_value = try ptr_struct.readSelf(.to_value);
        const slice_obj = php.getValueObject(&slice_value) catch unreachable;
        const slice_struct = ZigObject(structure.Slice).fromObject(slice_obj).structure();
        const self: *@This() = @ptrCast(@alignCast(slice_struct.buffer.bytes.ptr));
        const result = arg_iter.next() orelse return error.Unexpected;
        const more = try self.resolve(result);
        return_value.* = php.createValueBool(more);
    }
};
