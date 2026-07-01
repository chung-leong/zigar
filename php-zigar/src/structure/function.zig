const std = @import("std");

const AbortSignal = @import("../abort-signal.zig").AbortSignal;
const accessor = @import("../accessor.zig");
const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const ZigClassEntry = @import("../class-entry.zig").ZigClassEntry;
const CallDispatcher = @import("../dispatch.zig").CallDispatcher;
const failure = @import("../failure.zig");
const Generator = @import("../generator.zig").Generator;
const ZigObject = @import("../object.zig").ZigObject;
const php = @import("../php.zig");
const ArgumentIterator = php.ArgumentIterator;
const ClassEntry = php.ClassEntry;
const ExecuteData = php.ExecuteData;
const FunctionCallCache = php.FunctionCallCache;
const HashTable = php.HashTable;
const Object = php.Object;
const String = php.String;
const Value = php.Value;
const Promise = @import("../promise.zig").Promise;
const structure = @import("../structure.zig");
const invokeMethod = structure.invokeMethod;

pub const Function = struct {
    closure: Closure = undefined,
    // force buffer to be the last field using alignment
    transform: ?accessor.Transform align(@alignOf(*ByteBuffer)) = null,
    buffer: *ByteBuffer = undefined,

    pub const Super = structure.Parent(@This());
    pub const Static = struct {
        thunk_address: usize = undefined,
        controller_address: usize = 0,
        argument_class: *ZigClassEntry = undefined,
        first_arg_class: ?*ZigClassEntry = null,

        pub fn init(self: *@This(), class_obj: *Object) !void {
            const class = ZigClassEntry.fromObject(class_obj);
            const thunk_buf = class.instance.template.buffer orelse return error.Unexpected;
            self.thunk_address = @intFromPtr(thunk_buf.bytes.ptr);
            const arg_member = try class.getMember(.instance, 0);
            const arg_count = arg_member.class.length orelse return error.MissingLength;
            switch (arg_member.class.type) {
                .arg_struct, .variadic_struct => {
                    self.argument_class = arg_member.class;
                    if (arg_count > 0) {
                        const arg = try arg_member.class.getMember(.instance, "0");
                        switch (arg.class.type) {
                            .@"struct", .@"union", .@"enum", .@"opaque", .pointer => {
                                self.first_arg_class = arg.class;
                            },
                            else => {},
                        }
                    }
                },
                else => return error.Unexpected,
            }
        }

        pub fn matchFirstArgument(self: *@This(), this_value: *const Value) bool {
            var arg_class = self.first_arg_class orelse return false;
            var this_obj = php.getValueObject(this_value) catch return false;
            if (arg_class.type == .pointer) {
                const target_member = arg_class.getMember(.instance, 0) catch unreachable;
                switch (target_member.class.type) {
                    .@"struct", .@"union", .@"enum", .@"opaque" => {
                        arg_class = target_member.class;
                        self.first_arg_class = arg_class;
                    },
                    else => {
                        self.first_arg_class = null;
                        return false;
                    },
                }
            }
            if (ZigObject(structure.Pointer).isInstance(this_obj)) {
                const pointer = structure.Pointer.fromObject(this_obj);
                const target = pointer.getValue(.none) catch return false;
                this_obj = php.getValueObject(&target) catch return false;
            }
            // see if the class entry matches and this_obj isn't the class object
            return this_obj.ce == arg_class.entry() and this_obj != arg_class.object;
        }

        pub fn runCallback(self: *@This(), call_cache: *FunctionCallCache, arg_bytes: []u8, futex_handle: usize) !void {
            // need to make a copy of the arguments, since arg_bytes are on the stack
            const arg_buffer = try ByteBuffer.create(self.argument_class.alignment);
            defer arg_buffer.release();
            try arg_buffer.allocate(null, arg_bytes.len);
            try arg_buffer.copyBytes(arg_bytes);
            const arg_obj = try self.argument_class.createObjectFromBuffer(arg_buffer, null);
            defer php.release(arg_obj);
            const arg_struct = structure.ArgStruct.fromObject(arg_obj);
            var args_on_stack: [16]Value = undefined;
            var args_allocated = false;
            const arg_count = arg_struct.getArgumentCount();
            const args = if (arg_count <= args_on_stack.len) args_on_stack[0..arg_count] else alloc: {
                args_allocated = true;
                break :alloc try php.allocator.alloc(Value, arg_count);
            };
            defer if (args_allocated) php.allocator.free(args);
            try arg_struct.extractArguments(args);
            defer for (args) |*arg| php.release(arg);
            const arg_info = call_cache.argumentInfo();
            var named_args: ?*HashTable = null;
            try arg_struct.extractNamedArguments(arg_info, &named_args);
            defer if (named_args) |ht| php.release(ht);
            call_cache.useNamedArguments(named_args);
            if (arg_struct.hasAsyncCallback()) {
                // wake the calling thread prior to invoking the callback (which could potentially
                // switch to a different fiber) when we have a promise or generator interface
                CallDispatcher.releaseCallingThread(futex_handle, .SUCCESS);
            }
            const result = call_cache.invoke(args) catch |err| get: {
                const ex = php.captureException() catch throw: {
                    _ = &php.throwError(err);
                    break :throw php.captureException() catch unreachable;
                };
                break :get php.createValueObject(ex);
            };
            defer php.release(&result);
            if (arg_struct.hasAsyncCallback()) {
                // hand the value to the promise or generator
                arg_struct.sendReturnValue(&result) catch |err| {
                    php.triggerWarning(err);
                };
                return error.EarlyRelease;
            } else {
                // replace buffer so the retval gets written into the stack;
                var stack_buffer: ByteBuffer = .init(arg_bytes);
                arg_struct.buffer = &stack_buffer;
                defer arg_struct.buffer = arg_buffer;
                try arg_struct.setReturnValue(&result);
            }
        }
    };

    pub const Closure = struct {
        php_portion: php.Function,
        self: *Function,
    };

    pub fn initialize(self: *@This(), _: ?*std.mem.Allocator, initializer: ?*const Value, read_only: bool) !void {
        if (initializer) |value| {
            if (!php.isValueNull(value)) {
                try self.setValue(value, .none);
            }
        }
        if (read_only) self.buffer.protect();
    }

    pub fn finalize(self: *@This(), init_called: bool) !void {
        const handler = php.transform(handleCall);
        self.closure = .{
            .self = self,
            .php_portion = php.createFunctionEx(handler, null, 0, true),
        };
        try Super.finalize(self, init_called);
    }

    pub fn getValue(self: *@This(), transform: accessor.Transform) !Value {
        return switch (transform) {
            .boolean => php.createValueBool(true),
            else => use: {
                if (transform != .none) {
                    self.transform = transform;
                }
                break :use Super.getValue(self, .none);
            },
        };
    }

    pub fn setValue(self: *@This(), value: *const Value, transform: accessor.Transform) !void {
        if (transform == .none) {
            if (self.buffer.flags.read_only) return error.WriteProtected;
            const class = ZigClassEntry.fromStructure(self);
            if (php.getValueObject(value) catch null) |other_obj| {
                if (php.instanceOf(other_obj, class.entry())) {
                    return error.CannotCloneObject;
                }
            }
            class.host.dispatcher.destroyJsThunk(class, self.buffer) catch {};
            const static = class.getStaticData(@This());
            if (static.argument_class.type == .variadic_struct) {
                return failure.report("variadic function pointer cannot point to a PHP function", .{});
            }
            try class.host.dispatcher.createJsThunk(class, @constCast(value), self.buffer);
        } else {
            return error.Unsupported;
        }
    }

    pub fn createExportableVersion(self: *@This(), name: *String) *php.Function {
        const bytes = php.malloc(@sizeOf(Closure));
        const closure_copy: *Closure = @ptrCast(@alignCast(bytes));
        closure_copy.* = self.closure;
        closure_copy.php_portion.common.function_name = php.reuse(name);
        return &closure_copy.php_portion;
    }

    pub fn detachThunk(self: *@This()) void {
        const class = ZigClassEntry.fromStructure(self);
        class.host.dispatcher.detachThunk(self.buffer);
    }

    pub fn getArgumentClass(fn_value: *const Value, name: *const String) !*ZigClassEntry {
        const func_class = try ZigClassEntry.fromValue(fn_value);
        const arg_struct_member = try func_class.getMember(.instance, 0);
        const arg_member = try arg_struct_member.class.getMember(.instance, name);
        return arg_member.class;
    }

    pub fn allocateArgument(allocator: *std.mem.Allocator, value: *const Value, arg_class: *ZigClassEntry) !Value {
        // don't bother when it's null, since no memory would be allocated
        if (php.isValueNull(value)) return value.*;
        const arg_obj = try arg_class.createObject(allocator, value, false);
        return php.createValueObject(arg_obj);
    }

    pub fn externalizeArgument(_: *std.mem.Allocator, value: *const Value) !void {
        const arg_obj = php.getValueObject(value) catch return;
        try invokeMethod(arg_obj, "externalize", .{});
    }

    pub fn freeObject(obj: *Object) void {
        const self = fromObject(obj);
        const class = ZigClassEntry.fromObject(obj);
        class.host.dispatcher.destroyJsThunk(class, self.buffer) catch {};
        Super.freeObject(obj);
    }

    pub fn handleCall(ed: *ExecuteData, return_value: *Value) !void {
        const func: *php.Function = @ptrCast(ed.func);
        const closure: *Closure = @fieldParentPtr("php_portion", func);
        const self: *@This() = closure.self;
        const fn_addr = @intFromPtr(self.buffer.bytes.ptr);
        if (fn_addr == 0) {
            // why would the address be zero?
            @panic("TODO");
        }
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        var arg_iter: ArgumentIterator = .init(ed);
        if (static.matchFirstArgument(arg_iter.this)) {
            // the this variable is the first argument per Zig convention
            arg_iter.makeThisFirst();
        }
        const arg = try static.argument_class.createUninitializedObject();
        defer php.release(arg);
        switch (static.argument_class.type) {
            .arg_struct => {
                const arg_struct = structure.ArgStruct.fromObject(arg);
                try arg_struct.copyArguments(null, &arg_iter);
                const arg_addr = @intFromPtr(arg_struct.buffer.bytes.ptr);
                try class.host.runThunk(static.thunk_address, fn_addr, arg_addr);
                // if the argument struct has a function pointer, assume that the Zig code is retaining a copy of it
                // or has released it already; mark it as detached in the PHP object so it doesn't get freed
                try arg_struct.detachFunctionThunks();
                const result = get: {
                    var retval = try arg_struct.getReturnValue();
                    if (arg_struct.flags.has_promise) {
                        const promise_struct = try arg_struct.getSpecialArgument(Promise);
                        const promise = try promise_struct.getSpecialContext(Promise);
                        if (!php.isValueNull(&retval)) {
                            // if the return value isn't null, we assume the function is choosing to not be async
                            if (self.transform) |tm| try tm.apply(&retval);
                            break :get retval;
                        }
                        promise.transform = self.transform;
                        if (promise.callback == null) {
                            // wait for promise to resolve when there's no callback function
                            break :get try promise.await();
                        } else {
                            if (!CallDispatcher.event_loop.isProper()) {
                                return failure.report("callback functions cannot be used without a proper event loop", .{});
                            }
                            // bump ref count and instruct the promise to release itself when the callback is invoked
                            promise.detach();
                            break :get php.createValueNull();
                        }
                    } else if (arg_struct.flags.has_generator) {
                        const generator_struct = try arg_struct.getSpecialArgument(Generator);
                        const generator = try generator_struct.getSpecialContext(Generator);
                        generator.transform = self.transform;
                        if (generator.callback == null) {
                            // return generator
                            break :get generator_struct.toValue();
                        } else {
                            break :get php.createValueNull();
                        }
                    } else {
                        if (self.transform) |tm| try tm.apply(&retval);
                        break :get retval;
                    }
                };
                return_value.* = result;
            },
            .variadic_struct => {
                const arg_struct = structure.VariadicStruct.fromObject(arg);
                try arg_struct.copyArguments(null, &arg_iter);
                const arg_addr = @intFromPtr(arg_struct.buffer.bytes.ptr);
                const attr_addr = @intFromPtr(arg_struct.attributes.ptr);
                const arg_count = arg_struct.attributes.len;
                try class.host.runVariadicThunk(static.thunk_address, fn_addr, arg_addr, attr_addr, arg_count);
                var retval = try arg_struct.getReturnValue();
                if (self.transform) |tm| try tm.apply(&retval);
                return_value.* = retval;
            },
            else => unreachable,
        }
    }

    pub fn getClosure(obj: *Object, ce: *[*c]ClassEntry, func: *[*c]php.Function, this: ?*[*c]Object, _: bool) c_int {
        const self = Super.fromObject(obj);
        func.* = &self.closure.php_portion;
        ce.* = obj.ce;
        if (this) |ptr| ptr.* = obj;
        return php.SUCCESS;
    }

    pub fn compare(a: *Value, b: *Value) !c_int {
        const obj_a = php.getValueObject(a) catch return -1;
        const obj_b = php.getValueObject(b) catch return 1;
        if (obj_a == obj_b) return 0;
        if (obj_a.ce != obj_b.ce) {
            return if (@intFromPtr(obj_a.ce) < @intFromPtr(obj_b.ce)) -1 else 1;
        }
        const struct_a = fromObject(obj_a);
        const struct_b = fromObject(obj_b);
        const address_a = @intFromPtr(struct_a.buffer.bytes.ptr);
        const address_b = @intFromPtr(struct_b.buffer.bytes.ptr);
        return if (address_a == address_b) 0 else if (address_a < address_b) -1 else 1;
    }

    pub const setStorage = Super.setStorage;
    pub const externalize = Super.externalize;
    pub const getExtent = Super.getExtent;
    pub const getProperty = Super.getProperty;
    pub const setProperty = Super.setProperty;
    pub const propertyExists = Super.propertyExists;
    pub const checkArguments = Super.checkArguments;
    pub const visitPointers = Super.visitPointers;
    pub const getConstructor = Super.getConstructor;
    pub const cloneObject = Super.cloneObject;
    pub const castObject = Super.castObject;
    pub const getProperties = Super.getProperties;
    pub const getPropertyPointer = Super.getPropertyPointer;
    pub const getGarbageCollection = Super.getGarbageCollection;
    pub const fromObject = Super.fromObject;
    pub const fromValue = Super.fromValue;
};
