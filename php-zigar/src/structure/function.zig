const std = @import("std");

const AbortSignal = @import("../abort-signal.zig").AbortSignal;
const accessor = @import("../accessor.zig");
const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const ZigClassEntry = @import("../class-entry.zig").ZigClassEntry;
const Generator = @import("../generator.zig").Generator;
const ZigObject = @import("../object.zig").ZigObject;
const php = @import("../php.zig");
const ArgumentIterator = php.ArgumentIterator;
const ClassEntry = php.ClassEntry;
const ExecuteData = php.ExecuteData;
const Object = php.Object;
const Value = php.Value;
const Promise = @import("../promise.zig").Promise;
const structure = @import("../structure.zig");

pub const Function = struct {
    closure: Closure = undefined,
    // force buffer to be the last field using alignment
    transform: accessor.Transform align(@alignOf(*ByteBuffer)) = .none,
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

        pub fn matchFirstArgument(self: *@This(), value: *const Value) bool {
            var arg_class = self.first_arg_class orelse return false;
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
            var obj = php.getValueObject(value) catch return false;
            if (!ZigClassEntry.isZig(obj.ce)) return false;
            if (ZigObject(structure.Pointer).isInstance(obj)) {
                const pointer = ZigObject(structure.Pointer).fromObject(obj).structure();
                const target = pointer.getValue(.none) catch return false;
                obj = php.getValueObject(&target) catch return false;
            }
            return obj.ce == arg_class.entry();
        }

        pub fn runCallback(self: *@This(), callable: *Value, arg_bytes: []u8) !void {
            // need to make a copy of the arguments, since arg_bytes are on the stack
            const arg_buffer = try ByteBuffer.create(self.argument_class.alignment);
            try arg_buffer.allocate(null, arg_bytes.len);
            try arg_buffer.copyBytes(arg_bytes);
            defer arg_buffer.release();
            const arg_obj = try self.argument_class.createObjectFromBuffer(arg_buffer, null);
            defer php.release(arg_obj);
            const arg_struct = ZigObject(structure.ArgStruct(false)).fromObject(arg_obj).structure();
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
            const result = try php.invokeFunction(callable, args);
            defer php.release(&result);
            // replace buffer so the retval gets written into the stack
            var stack_buffer: ByteBuffer = .init(arg_bytes);
            arg_buffer.release();
            arg_struct.buffer = &stack_buffer;
            try arg_struct.setReturnValue(&result);
        }
    };
    pub const Closure = struct {
        self: *Function,
        php_portion: php.Function,
    };

    pub fn finalize(self: *@This(), init_called: bool) !void {
        self.closure = .{
            .self = self,
            .php_portion = php.createTransformedFunction(handleCall, "call", 0, true),
        };
        try Super.finalize(self, init_called);
    }

    pub fn getValue(self: *@This(), transform: accessor.Transform) !Value {
        self.transform = transform;
        return Super.getValue(self, .none);
    }

    pub fn setValue(self: *@This(), value: *const Value, transform: accessor.Transform) !void {
        if (transform == .none) {
            if (try Super.copySelf(self, value)) return;
            const class = ZigClassEntry.fromStructure(self);
            if (!php.isCallable(value)) return error.NotCallable;
            const thunk_address = try class.host.dispatcher.createJsThunk(class, @constCast(value));
            const ptr: [*]u8 = @ptrFromInt(thunk_address);
            self.buffer.bytes = ptr[0..0];
        } else {
            return error.Unsupported;
        }
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
        const arg = try static.argument_class.createObject(null, null, false);
        defer php.release(arg);
        switch (static.argument_class.type) {
            inline .arg_struct, .variadic_struct => |t| {
                const S = @field(structure.by_enum, @tagName(t));
                const arg_struct = ZigObject(S).fromObject(arg).structure();
                const arg_addr = @intFromPtr(arg_struct.buffer.bytes.ptr);
                try arg_struct.copyArguments(&arg_iter);
                if (t == .arg_struct) {
                    try class.host.runThunk(static.thunk_address, fn_addr, arg_addr);
                }
                return_value.* = get: {
                    var retval = try arg_struct.getReturnValue();
                    if (arg_struct.flags.has_promise) {
                        const promise_struct = try arg_struct.getSpecialArgument(Promise);
                        const promise = try promise_struct.getSpecialContext(Promise);
                        if (!php.isValueNull(&retval)) {
                            // if the return value isn't null, we assume the function is choosing to not be async
                            try self.transform.apply(&retval);
                            break :get retval;
                        }
                        // wait for promise to resolve
                        promise.transform = self.transform;
                        break :get try promise.await();
                    } else if (arg_struct.flags.has_generator) {
                        const generator_struct = try arg_struct.getSpecialArgument(Generator);
                        const generator = try generator_struct.getSpecialContext(Generator);
                        generator.transform = self.transform;
                        // return generator
                        const generator_obj = ZigObject(structure.Struct).fromStructure(generator_struct).object();
                        php.addRef(generator_obj);
                        break :get php.createValueObject(generator_obj);
                    } else {
                        try self.transform.apply(&retval);
                        break :get retval;
                    }
                };
            },
            else => unreachable,
        }
    }

    pub fn getClosure(obj: *Object, ce: *[*c]ClassEntry, func: *[*c]php.Function, this: ?*[*c]Object, _: bool) c_int {
        const self = Super.fromObject(obj);
        func.* = &self.closure.php_portion;
        ce.* = obj.ce;
        if (this) |ptr| ptr.* = null;
        return php.SUCCESS;
    }

    pub const setStorage = Super.setStorage;
    pub const initialize = Super.initialize;
    pub const externalize = Super.externalize;
    pub const getExtent = Super.getExtent;
    pub const getProperty = Super.getProperty;
    pub const setProperty = Super.setProperty;
    pub const propertyExists = Super.propertyExists;
    pub const checkArguments = Super.checkArguments;
    pub const visitPointers = Super.visitPointers;
    pub const castObject = Super.castObject;
    pub const freeObject = Super.freeObject;
    pub const getGarbageCollection = Super.getGarbageCollection;
    const fromObject = Super.fromObject;
};
