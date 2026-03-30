const std = @import("std");

const accessor = @import("../accessor.zig");
const ObjectTransform = accessor.ObjectTransform;
const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const ZigClassEntry = @import("../class-entry.zig").ZigClassEntry;
const Closure = @import("../closure.zig").Closure;
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
    closure: *Closure = undefined,
    transform: ObjectTransform align(@alignOf(*ByteBuffer)) = .to_value, // force bytes to be the last field
    buffer: *ByteBuffer = undefined,

    const Super = structure.Parent(@This());

    pub const Static = struct {
        thunk_address: usize = undefined,
        controller_address: usize = 0,
        argument_class: *ZigClassEntry = undefined,
        first_arg_ce: ?*ClassEntry = null,

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
                        self.first_arg_ce = arg.class.entry();
                    }
                },
                else => return error.Unexpected,
            }
        }

        pub fn runCallback(self: *@This(), callable: *Value, arg_bytes: []u8) !void {
            // need to make a copy of the arguments, since arg_bytes are on the stack
            const arg_buffer = try ByteBuffer.create(self.argument_class.alignment);
            try arg_buffer.allocate(null, arg_bytes.len);
            try arg_buffer.copyBytes(arg_bytes);
            defer arg_buffer.release();
            const arg_obj = try self.argument_class.createPreinitializedObject(arg_buffer, null);
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
            var stack_buffer: ByteBuffer = .{ .bytes = arg_bytes };
            arg_buffer.release();
            arg_struct.buffer = &stack_buffer;
            try arg_struct.setReturnValue(&result);
        }
    };

    pub fn finalize(self: *@This()) !void {
        self.closure = try Closure.create(self, invokeThunk, "run");
    }

    pub fn readSelf(self: *@This(), transform: ObjectTransform) !Value {
        self.transform = transform;
        return self.returnSelf();
    }

    pub fn writeSelf(self: *@This(), value: *const Value) !void {
        if (try Super.copySelf(self, value)) return;
        const class = ZigClassEntry.fromStructure(self);
        if (!php.isCallable(value)) return error.NotCallable;
        const thunk_address = try class.host.dispatcher.createJsThunk(class, @constCast(value));
        const ptr: [*]u8 = @ptrFromInt(thunk_address);
        self.buffer.bytes = ptr[0..0];
    }

    pub fn invokeThunk(self: *@This(), arg_iter: *ArgumentIterator) !?Value {
        const fn_addr = @intFromPtr(self.buffer.bytes.ptr);
        if (fn_addr != 0) {
            const class = ZigClassEntry.fromStructure(self);
            const static = class.getStaticData(Function);
            const is_method_call = init: {
                if (static.first_arg_ce) |ce| {
                    if (php.getValueObject(arg_iter.this)) |obj| {
                        break :init obj.ce == ce;
                    } else |_| {}
                }
                break :init false;
            };
            if (is_method_call) arg_iter.makeThisFirst();
            var sfa = std.heap.stackFallback(8 * 1024, php.allocator);
            const allocator = sfa.get();
            const arg = try static.argument_class.createObject(&allocator, null);
            defer php.release(arg);
            return switch (static.argument_class.type) {
                inline .arg_struct, .variadic_struct => |t| run: {
                    const S = @field(structure.by_enum, @tagName(t));
                    const arg_struct = ZigObject(S).fromObject(arg).structure();
                    const arg_addr = @intFromPtr(arg_struct.buffer.bytes.ptr);
                    try arg_struct.copyArguments(arg_iter);
                    if (t == .arg_struct) {
                        try class.host.runThunk(static.thunk_address, fn_addr, arg_addr);
                    }
                    var retval = try arg_struct.getReturnValue();
                    if (arg_struct.flags.has_promise) {
                        const promise_struct = try arg_struct.getSpecialArgument(Promise);
                        const promise = try promise_struct.getSpecialContext(Promise);
                        promise.transform = self.transform;
                        if (!php.isNull(&retval)) {
                            // if the return value isn't null, we assume the function is choosing to not be async
                            try self.transform.apply(&retval);
                            break :run retval;
                        }
                        break :run try promise.await();
                    } else if (arg_struct.flags.has_generator) {
                        const generator_struct = try arg_struct.getSpecialArgument(Generator);
                        const generator = try generator_struct.getSpecialContext(Generator);
                        generator.transform = self.transform;
                        const generator_obj = ZigObject(structure.Struct).fromStructure(generator_struct).object();
                        php.addRef(generator_obj);
                        break :run php.createValueObject(generator_obj);
                    } else {
                        try self.transform.apply(&retval);
                        break :run retval;
                    }
                },
                else => unreachable,
            };
        } else {
            @panic("TODO");
        }
    }

    pub fn getClosure(obj: *Object, ce: *[*c]ClassEntry, func: *[*c]php.Function, this: ?*[*c]Object, _: bool) c_int {
        const self = Super.fromObject(obj);
        func.* = self.closure.function();
        ce.* = obj.ce;
        if (this) |ptr| ptr.* = null;
        return php.SUCCESS;
    }

    pub fn freeObject(obj: *Object) void {
        const self = Super.fromObject(obj);
        self.closure.release();
        Super.freeObject(obj);
    }

    pub const initialize = Super.initialize;
    pub const getExtent = Super.getExtent;
    pub const checkArguments = Super.checkArguments;
    pub const castObject = Super.castObject;
    pub const getReferencedObjects = Super.getReferencedObjects;
    const fromObject = Super.fromObject;
    const returnSelf = Super.returnSelf;
};
