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

pub const Generator = struct {
    status: enum { unresolved, waiting, resolved, finished, released } = .unresolved,
    fiber: Value = undefined,
    result: Value,
    callback: ?Value,
    index: isize = 0,
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
            .callback = if (callback) |*cb| php.reuse(cb).* else null,
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
        if (self.callback) |*cb| php.release(cb);
    }

    pub fn moveForward(self: *@This()) !void {
        if (self.status != .finished) {
            self.status = .waiting;
            try CallDispatcher.event_loop.suspendFiber(&self.fiber);
        }
    }

    pub fn rewind(self: *@This()) !void {
        if (self.status == .unresolved) {
            self.fiber = try CallDispatcher.event_loop.getFiber();
            return try self.moveForward();
        }
    }

    pub fn isValid(self: *@This()) bool {
        return self.status == .resolved;
    }

    pub fn createHandler() Value {
        var func = php.createTransformedFunction(handleResolve, "resolve", 2, false);
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
        self.result = php.reuse(value).*;
        self.status = if (php.isValueNull(value)) .finished else .resolved;
        if (self.transform) |tm| try tm.apply(&self.result);
        if (self.callback) |*cb| {
            defer php.release(&self.result);
            const args: []Value = @ptrCast(&self.result);
            const retval = try php.invokeMethod(null, cb, args);
            defer php.release(&retval);
            return php.getValueType(&retval) != .false;
        } else {
            return self.status != .finished;
        }
    }

    pub fn handleResolve(ed: *ExecuteData, return_value: *Value) !void {
        var arg_iter: ArgumentIterator = .init(ed);
        const ptr = arg_iter.next() orelse return error.Unexpected;
        const ptr_obj = php.getValueObject(ptr) catch unreachable;
        const ptr_struct = ZigObject(structure.Pointer).fromObject(ptr_obj).structure();
        const target = try ptr_struct.getValue(.none);
        const self = try accessor.getOpaqueTarget(@This(), &target);
        const result = arg_iter.next() orelse return error.Unexpected;
        const more = try self.resolve(result);
        return_value.* = php.createValueBool(more);
    }
};

pub const GeneratorStatic = struct {
    methods: Methods = undefined,
    callback: *Object = undefined,

    pub fn init(self: *@This(), class: *ZigClassEntry) !void {
        const closure = Generator.createHandler();
        defer php.release(&closure);
        const cb_member = try class.getMember(.instance, "callback");
        if (cb_member.class.type != .pointer) return error.Unexpected;
        const cb_obj = try cb_member.class.createObject(null, &closure, false);
        self.callback = cb_obj;
        self.methods = .{
            .yield = php.createTransformedFunction(handleYield, "yield", 1, false),
        };
    }

    pub fn deinit(self: *@This()) void {
        php.release(self.callback);
    }

    pub const Methods = struct {
        yield: Function,
    };

    pub fn findMethod(self: *@This(), name: *String) ?*php.Function {
        return inline for (std.meta.fields(Methods)) |field| {
            if (php.matchString(name, field.name)) break &@field(self.methods, field.name);
        } else return null;
    }

    pub fn handleYield(ed: *ExecuteData, return_value: *Value) !void {
        var arg_iter: ArgumentIterator = .init(ed);
        if (arg_iter.len != 1) return failure.reportArgCountMismatch("yield", 1, 1, arg_iter.len);
        const value = arg_iter.next().?;
        const allocator = try getAllocator(arg_iter.this);
        return_value.* = try yield(arg_iter.this, value, allocator);
    }

    pub fn yield(generator: *const Value, value: *const Value, extern_allocator: ?*std.mem.Allocator) !Value {
        const fn_value, const ptr_value, const attached_allocator = try getCallbackParams(generator);
        defer php.release(&fn_value);
        defer php.release(&ptr_value);
        // use the external allocator only if there isn't one attached to the generator itself
        const allocator = attached_allocator orelse extern_allocator;
        const send_allocator = attached_allocator != null;
        return send(&fn_value, &ptr_value, value, allocator, send_allocator);
    }

    pub fn pipe(generator: *const Value, source: *const Value, extern_allocator: ?*std.mem.Allocator) !void {
        const fn_value, const ptr_value, const attached_allocator = try getCallbackParams(generator);
        defer php.release(&fn_value);
        defer php.release(&ptr_value);
        const allocator = attached_allocator orelse extern_allocator;
        const send_allocator = attached_allocator != null;
        if (!isIterator(source)) return error.NotIterator;
        const current = php.createValueString(N("current"));
        const next = php.createValueString(N("next"));
        while (true) {
            var value = try php.invokeMethod(source, &current, &.{});
            defer php.release(&value);
            const retval = try send(&fn_value, &ptr_value, &value, allocator, send_allocator);
            if (allocator) |a| try structure.Function.externalizeArgument(a, &value);
            const cont = try php.getValueBool(&retval);
            if (!cont or php.isValueNull(&value)) break;
            _ = try php.invokeMethod(source, &next, &.{});
        }
    }

    fn send(fn_value: *const Value, ptr_value: *const Value, value: *const Value, allocator: ?*std.mem.Allocator, send_allocator: bool) !Value {
        if (allocator) |a| {
            // when a generator has an attached allocator, it appears as the first callback
            // argument; the value argument is therefore "2" instead of "1"
            const arg_name = if (send_allocator) N("2") else N("1");
            const converted_value = try structure.Function.convertArgumentToInstance(a, value, fn_value, arg_name);
            defer php.release(&converted_value);
            const named_args = if (send_allocator) create: {
                // the allocator has to be passed by name
                const ht = php.createArray();
                const allocator_value = php.createValuePointer(a);
                php.setHashEntry(ht, N("allocator"), &allocator_value);
                break :create ht;
            } else null;
            defer if (named_args) |ht| php.release(ht);
            const result = try php.invokeMethodEx(null, fn_value, &.{ ptr_value.*, converted_value }, named_args);
            try structure.Function.externalizeArgument(a, &converted_value);
            return result;
        } else {
            return try php.invokeMethod(null, fn_value, &.{ ptr_value.*, value.* });
        }
    }

    fn getAllocator(this: *const Value) !?*std.mem.Allocator {
        const generator_struct = try structure.Struct.fromValue(this);
        const value = php.getProperty(&generator_struct.table, N("allocator")) catch return null;
        defer php.release(value);
        return php.getValuePointer(*std.mem.Allocator, value);
    }

    fn getCallbackParams(generator: *const Value) !std.meta.Tuple(&.{ Value, Value, ?*std.mem.Allocator }) {
        const generator_obj = try php.getValueObject(generator);
        const generator_struct = ZigObject(structure.Struct).fromObject(generator_obj).structure();
        const callback_value = try generator_struct.getProperty(N("callback"), null);
        const callback_obj = try php.getValueObject(&callback_value);
        defer php.release(callback_obj);
        const callback_struct = ZigObject(structure.Pointer).fromObject(callback_obj).structure();
        const fn_value = try callback_struct.getValue(.none);
        errdefer php.release(&fn_value);
        const ptr_value = try generator_struct.getProperty(N("ptr"), null);
        const allocator = get: {
            if (generator_struct.getProperty(N("allocator"), null) catch null) |av| {
                defer php.release(&av);
                const allocator_struct = try structure.Struct.fromValue(&av);
                break :get try allocator_struct.getAllocator();
            }
            break :get null;
        };
        return .{ fn_value, ptr_value, allocator };
    }

    fn isIterator(value: *const Value) bool {
        const generator_obj = php.getValueObject(value) catch return false;
        const iterator = php.getInterface(.iterator);
        return php.instanceOf(generator_obj.ce, iterator);
    }
};
