const std = @import("std");

const ExternalAllocator = @import("./allocator.zig").ExternalAllocator;
const accessor = @import("accessor.zig");
const Transform = accessor.Transform;
const ByteBuffer = @import("buffer.zig").ByteBuffer;
const CallDispatcher = @import("dispatch.zig").CallDispatcher;
const failure = @import("failure.zig");
const php = @import("php.zig");
const ArgumentIterator = php.ArgumentIterator;
const php_ng = @import("php/root.zig");
const Function = php_ng.Function;
const Array = php_ng.Array;
const ClassEntry = php_ng.ClassEntry;
const Object = php_ng.Object;
const String = php_ng.String;
const N = String.static;
const Value = php_ng.Value;
const structure = @import("structure.zig");
const ZigClassEntry = @import("class-entry.zig").ZigClassEntry;
const ZigObject = @import("object.zig").ZigObject;

pub const Generator = struct {
    status: enum { unused, waiting, resolved, finished, released } = .unused,
    fiber: Value,
    result: Value,
    callback: ?Value,
    callback_cache: Function.CallCache,
    index: isize = 0,
    transform: ?Transform = null,
    buffer: *ByteBuffer,
    arguments: ?*Array = null,

    pub fn create(callback: ?Value) !*@This() {
        const alignment: std.mem.Alignment = .fromByteUnits(@alignOf(@This()));
        const buf = try ByteBuffer.create(alignment);
        try buf.allocate(null, @sizeOf(@This()));
        errdefer buf.release();
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

    pub fn addRef(self: *@This()) void {
        self.buffer.addRef();
    }

    pub fn release(self: *@This()) void {
        if (self.buffer.ref_count == 1) {
            if (self.status != .finished and self.status != .unused) {
                // preserve the generator until the content source has been informed
                self.status = .released;
                // wait for resolution
                CallDispatcher.event_loop.suspendFiber(self.fiber) catch {};
                return;
            }
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

    pub fn moveForward(self: *@This()) !void {
        if (self.status != .finished) {
            self.status = .waiting;
            try CallDispatcher.event_loop.suspendFiber(self.fiber);
        }
    }

    pub fn rewind(self: *@This()) !void {
        if (self.status == .unused) {
            self.fiber.release();
            self.fiber = try CallDispatcher.event_loop.getFiber();
            try self.moveForward();
        }
    }

    pub fn isValid(self: *@This()) bool {
        return self.status == .resolved;
    }

    pub fn createHandler() Value {
        var func = Function.fromHandler(onResolve, null);
        const closure = func.createClosure(null, null, null);
        return closure.toValue();
    }

    pub fn resolve(self: *@This(), value: Value) !bool {
        switch (self.status) {
            .released => {
                self.status = .finished;
                self.release();
                CallDispatcher.event_loop.resumeFiberAfterward(self.fiber);
                return false;
            },
            .waiting => CallDispatcher.event_loop.resumeFiberAfterward(self.fiber),
            else => {},
        }
        self.result.release();
        self.result = value.retain();
        if (value.isNull()) {
            self.status = .finished;
        } else {
            self.status = .resolved;
            if (self.transform) |tm| try tm.apply(@ptrCast(&self.result));
        }
        if (self.callback != null) {
            const retval = try self.callback_cache.invoke(&.{self.result});
            defer retval.release();
            return switch (retval.kind()) {
                .boolean => retval.boolean(),
                else => true,
            };
        } else {
            return self.status != .finished;
        }
    }

    pub fn onResolve(args: struct { ptr: Value, result: Value }) !bool {
        const ptr_struct = try structure.Pointer.fromValue(@ptrCast(&args.ptr));
        const target = try ptr_struct.getValue(.none);
        php.release(&target);
        const self = try accessor.getOpaqueTarget(@This(), &target);
        return try self.resolve(args.result);
    }
};

pub const GeneratorStatic = struct {
    methods: Methods,
    callback: ?*Object = null,

    pub const Methods = struct {
        yield: Function,
    };
    const CallbackContext = struct {
        allocator: ?std.mem.Allocator,
        argument_class: *ZigClassEntry,
        pointer: Value,
        call_cache: Function.CallCache,
        named_params: ?*Array = null,

        pub fn init(generator_obj: *Object, extern_allocator: ?*std.mem.Allocator) !@This() {
            const generator_struct = structure.Struct.fromObject(@ptrCast(generator_obj));
            const attached_allocator = get: {
                if (generator_struct.getProperty(@ptrCast(N("allocator")), null)) |av| {
                    defer php.release(&av);
                    break :get try ExternalAllocator.fromValue(&av);
                } else |_| break :get null;
            };
            const callback_value = try generator_struct.getProperty(@ptrCast(N("callback")), null);
            defer php.release(&callback_value);
            const callback_struct = try structure.Pointer.fromValue(&callback_value);
            const fn_value_og = try callback_struct.getValue(.none);
            const fn_value: Value = .fromZval(fn_value_og);
            defer fn_value.release();
            // when a generator has an attached allocator, it appears as the first callback
            // argument; the value argument is therefore "2" instead of "1"
            const arg_name = if (attached_allocator != null) N("2") else N("1");
            const arg_class = try structure.Function.getArgumentClass(@ptrCast(&fn_value), @ptrCast(arg_name));
            const ptr_value_og = try generator_struct.getProperty(@ptrCast(N("ptr")), null);
            const ptr_value: Value = .fromZval(ptr_value_og);
            errdefer ptr_value.release();
            return .{
                .call_cache = try .init(fn_value),
                .allocator = attached_allocator orelse if (extern_allocator) |ea| ea.* else null,
                .argument_class = arg_class,
                .pointer = ptr_value,
            };
        }

        pub fn deinit(self: *@This()) void {
            self.call_cache.deinit();
            self.pointer.release();
            if (self.named_params) |arr| arr.release();
        }

        pub fn send(self: *@This(), value: Value) !Value {
            if (self.allocator) |*al| {
                const converted_value_og = try structure.Function.allocateArgument(al, @ptrCast(&value), self.argument_class);
                const converted_value: Value = .fromZval(converted_value_og);
                defer converted_value.release();
                // allocator has to be passed by name
                const named_params = self.named_params orelse create: {
                    const arr: *Array = .create();
                    arr.set(N("allocator"), ExternalAllocator.toValue(al));
                    self.named_params = arr;
                    break :create arr;
                };
                self.call_cache.useNamedArguments(named_params);
                const result = try self.call_cache.invoke(&.{ self.pointer, converted_value });
                try structure.Function.externalizeArgument(al, @ptrCast(&converted_value));
                return result;
            } else {
                return try self.call_cache.invoke(&.{ self.pointer, value });
            }
        }

        pub fn sendAll(self: *@This(), source: Value) !void {
            var src_cache: Object.MethodCallCache(.{ .current, .next }) = try .init(source);
            defer src_cache.deinit();
            while (true) {
                const value = try src_cache.method.current.invoke(&.{});
                defer value.release();
                const result = try self.send(value);
                const cont = try result.getBoolean();
                if (!cont or value.isNull()) break;
                _ = try src_cache.method.next.invoke(&.{});
            }
        }
    };

    pub fn init(self: *@This()) !void {
        self.* = .{
            .methods = .{
                .yield = .fromHandler(onYield, *Object),
            },
        };
    }

    pub fn getCallback(self: *@This(), class: *ZigClassEntry) !*Object {
        return self.callback orelse create: {
            const closure = Generator.createHandler();
            defer closure.release();
            const cb_member = try class.getMember(.instance, "callback");
            const cb_obj_og = try cb_member.class.createObject(null, @ptrCast(&closure), false);
            const cb_obj: *Object = @ptrCast(cb_obj_og);
            self.callback = cb_obj;
            break :create cb_obj;
        };
    }

    pub fn deinit(self: *@This()) void {
        if (self.callback) |cb| cb.release();
    }

    pub fn findMethod(self: *@This(), name: *String) ?*php.Function {
        const fn_ng = inline for (comptime std.meta.fieldNames(Methods)) |field_name| {
            if (name.matchSlice(field_name)) break &@field(self.methods, field_name);
        } else return null;
        return @ptrCast(fn_ng);
    }

    pub fn onYield(generator_obj: *Object, args: struct {
        value: Value,
    }) !bool {
        const generator_struct = structure.Struct.fromObject(@ptrCast(generator_obj));
        const allocator = generator_struct.buffer.getAllocator();
        return try yield(generator_obj, args.value, allocator);
    }

    pub fn yield(generator_obj: *Object, value: Value, extern_allocator: ?*std.mem.Allocator) !bool {
        var cb_context: CallbackContext = try .init(generator_obj, extern_allocator);
        defer cb_context.deinit();
        const result = try cb_context.send(value);
        return switch (result.kind()) {
            .boolean => result.boolean(),
            else => true,
        };
    }

    pub fn pipe(generator_obj: *Object, source: Value, extern_allocator: ?*std.mem.Allocator) !void {
        const iterator_obj = source.getObject() catch return error.NotIterator;
        if (!iterator_obj.hasStandardInterface(.iterator)) return error.NotIterator;
        var cb_context: CallbackContext = try .init(generator_obj, extern_allocator);
        defer cb_context.deinit();
        cb_context.sendAll(source) catch |err| {
            // send exception to Zig if possible
            const ex = php.captureException() catch return err;
            defer php.release(ex);
            const ex_value = php.createValueObject(ex);
            _ = cb_context.send(.fromZval(ex_value)) catch {
                // discard any exception triggered by the attempt
                if (php.captureException() catch null) |send_ex| {
                    php.release(send_ex);
                }
                // rethrow it the original exception
                return php.throwException(php.reuse(ex));
            };
        };
    }
};
