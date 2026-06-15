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
const HashTable = php.HashTable;
const N = php.getStaticString;
const MethodCallCaches = php.MethodCallCaches;
const Object = php.Object;
const String = php.String;
const Value = php.Value;
const structure = @import("structure.zig");
const ZigClassEntry = @import("class-entry.zig").ZigClassEntry;
const ZigObject = @import("object.zig").ZigObject;

pub const Generator = struct {
    status: enum { unused, waiting, resolved, finished, released } = .unused,
    fiber: Value,
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
            .fiber = php.createValueNull(),
            .callback = if (callback) |*cb| php.reuse(cb).* else null,
        };
        return self;
    }

    pub fn addRef(self: *@This()) void {
        self.buffer.addRef();
    }

    pub fn release(self: *@This()) void {
        if (self.status != .finished and self.status != .unused) {
            // preserve the generator until the content source has been informed
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

    pub fn moveForward(self: *@This()) !void {
        if (self.status != .finished) {
            self.status = .waiting;
            try CallDispatcher.event_loop.suspendFiber(&self.fiber);
        }
    }

    pub fn rewind(self: *@This()) !void {
        if (self.status == .unused) {
            php.release(&self.fiber);
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
                self.status = .finished;
                self.release();
                return false;
            },
            .waiting => CallDispatcher.event_loop.resumeFiberAfterward(&self.fiber),
            else => {},
        }
        php.release(&self.result);
        self.result = php.reuse(value).*;
        self.status = if (php.isValueNull(value)) .finished else .resolved;
        if (self.transform) |tm| try tm.apply(&self.result);
        if (self.callback) |*cb| {
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
        const ptr_struct = try structure.Pointer.fromValue(ptr);
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

    pub const Methods = struct {
        yield: Function,
    };
    const CallbackContext = struct {
        allocator: ?*std.mem.Allocator,
        argument_class: *ZigClassEntry,
        pointer: Value,
        call_cache: FunctionCallCache,
        named_params: ?*HashTable,

        pub fn init(generator: *const Value, extern_allocator: ?*std.mem.Allocator) !@This() {
            const generator_struct = try structure.Struct.fromValue(generator);
            const attached_allocator = get: {
                if (generator_struct.getProperty(N("allocator"), null)) |av| {
                    defer php.release(&av);
                    const allocator_struct = try structure.Struct.fromValue(&av);
                    break :get try allocator_struct.getAllocator();
                } else |_| break :get null;
            };
            const callback_value = try generator_struct.getProperty(N("callback"), null);
            defer php.release(&callback_value);
            const callback_struct = try structure.Pointer.fromValue(&callback_value);
            const fn_value = try callback_struct.getValue(.none);
            defer php.release(&fn_value);
            // when a generator has an attached allocator, it appears as the first callback
            // argument; the value argument is therefore "2" instead of "1"
            const arg_name = if (attached_allocator != null) N("2") else N("1");
            const arg_class = try structure.Function.getArgumentClass(&fn_value, arg_name);
            // allocator has to be passed by name
            const named_params = if (attached_allocator) |a| create: {
                const ht = php.createArray();
                const allocator_value = php.createValuePointer(a);
                php.setHashEntry(ht, N("allocator"), &allocator_value);
                break :create ht;
            } else null;
            const ptr_value = try generator_struct.getProperty(N("ptr"), null);
            errdefer php.release(&ptr_value);
            return .{
                .call_cache = try .init(&fn_value),
                .allocator = attached_allocator orelse extern_allocator,
                .argument_class = arg_class,
                .pointer = ptr_value,
                .named_params = named_params,
            };
        }

        pub fn deinit(self: *@This()) void {
            self.call_cache.deinit();
            php.release(&self.pointer);
            if (self.named_params) |ht| php.release(ht);
        }

        pub fn send(self: *@This(), value: *const Value) !Value {
            if (self.allocator) |a| {
                const converted_value = try structure.Function.allocateArgument(a, value, self.argument_class);
                defer php.release(&converted_value);
                self.call_cache.useNamedArguments(self.named_params);
                const result = try self.call_cache.invoke(&.{ self.pointer, converted_value });
                try structure.Function.externalizeArgument(a, &converted_value);
                return result;
            } else {
                return try self.call_cache.invoke(&.{ self.pointer, value.* });
            }
        }

        pub fn sendAll(self: *@This(), source: *const Value) !void {
            var src_cache: MethodCallCaches(.{ .current, .next }) = try .init(source);
            defer src_cache.deinit();
            while (true) {
                const value = try src_cache.method.current.invoke(&.{});
                defer php.release(&value);
                const result = try self.send(&value);
                const cont = try php.getValueBool(&result);
                if (!cont or php.isValueNull(&value)) break;
                _ = try src_cache.method.next.invoke(&.{});
            }
        }
    };

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

    pub fn findMethod(self: *@This(), name: *String) ?*php.Function {
        return inline for (std.meta.fields(Methods)) |field| {
            if (php.matchString(name, field.name)) break &@field(self.methods, field.name);
        } else return null;
    }

    pub fn handleYield(ed: *ExecuteData, return_value: *Value) !void {
        var arg_iter: ArgumentIterator = .init(ed);
        if (arg_iter.len != 1) return failure.reportArgCountMismatch("yield", 1, 1, arg_iter.len);
        const value = arg_iter.next().?;
        const generator_struct = try structure.Struct.fromValue(arg_iter.this);
        const allocator = try generator_struct.getAllocator();
        return_value.* = try yield(arg_iter.this, value, allocator);
    }

    pub fn yield(generator: *const Value, value: *const Value, extern_allocator: ?*std.mem.Allocator) !Value {
        var cb_context: CallbackContext = try .init(generator, extern_allocator);
        defer cb_context.deinit();
        return try cb_context.send(value);
    }

    pub fn pipe(generator: *const Value, source: *const Value, extern_allocator: ?*std.mem.Allocator) !void {
        const iterator_obj = php.getValueObject(source) catch return error.NotIterator;
        const iterator = php.getInterface(.iterator);
        if (!php.instanceOf(iterator_obj, iterator)) return error.NotIterator;

        var cb_context: CallbackContext = try .init(generator, extern_allocator);
        defer cb_context.deinit();
        cb_context.sendAll(source) catch |err| {
            // send exception to Zig if possible
            const ex = php.captureException() catch return err;
            defer php.release(ex);
            const ex_value = php.createValueObject(ex);
            _ = cb_context.send(&ex_value) catch {
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
