const std = @import("std");

const accessor = @import("accessor.zig");
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
const String = php.String;
const Value = php.Value;
const structure = @import("structure.zig");
const ZigClassEntry = @import("class-entry.zig").ZigClassEntry;

pub const AbortSignal = struct {
    value: std.atomic.Value(u32) align(@sizeOf(*anyopaque)) = .init(0),
    php_portion: php.Object = .{},

    const Methods = struct {
        abort: Function,
        timeout: Function,
    };

    var object_handlers: ?ObjectHandlers = null;
    var object_methods: ?Methods = null;

    pub inline fn object(self: *@This()) *Object {
        return &self.php_portion;
    }

    pub inline fn fromObject(obj: *Object) *@This() {
        return @fieldParentPtr("php_portion", obj);
    }

    pub fn addRef(self: *@This()) void {
        php.addRef(self.object());
    }

    pub fn release(self: *@This()) void {
        php.release(self.object());
    }

    pub fn create(timeout: ?Value) !*@This() {
        const ce = ZigClassEntry.abort_signal_class;
        const prop_size = php.getObjectPropertySize(ce);
        const size: usize = @intCast(@sizeOf(@This()) + prop_size);
        // we can't use the allocator here, since freeing is done by PHP itself
        const mem = php.emalloc(size) orelse return error.OutOfMemory;
        errdefer php.efree(mem);
        const self: *@This() = @ptrCast(@alignCast(mem));
        self.* = .{};
        const obj = self.object();
        obj.handlers = getHandlers();
        php.initializeStandardObject(obj, ce);
        php.initializeObjectProperties(obj, ce);
        if (timeout) |v| try self.setTimeout(&v);
        return self;
    }

    pub fn abort(self: *@This()) void {
        self.value.store(1, .monotonic);
        std.Thread.Futex.wake(&self.value, std.math.maxInt(u32));
    }

    pub fn handleAbort(ed: *ExecuteData, _: *Value) !void {
        const self = try getSelf(&ed.This);
        self.abort();
    }

    pub fn setTimeout(self: *@This(), value: *const Value) !void {
        const seconds = try php.getValueDouble(value);
        try CallDispatcher.event_loop.addTimeout(seconds, self);
    }

    pub fn handleCreateObject(_: *ClassEntry) !*Object {
        const self = try create(null);
        return self.object();
    }

    pub fn handleGetMethod(_: *[*c]Object, name: *String, _: ?*const Value) !?*Function {
        const methods = getMethods();
        inline for (std.meta.fields(Methods)) |field| {
            if (std.mem.eql(u8, php.getStringContent(name), field.name)) {
                return &@field(methods, field.name);
            }
        }
        return null;
    }

    pub fn handleTimeout(ed: *ExecuteData, _: *Value) !void {
        var arg_iter: ArgumentIterator = .init(ed);
        const arg = arg_iter.next() orelse return error.NotDouble;
        const self = try getSelf(arg_iter.this);
        try self.setTimeout(arg);
    }

    fn getSelf(value: *const Value) !*@This() {
        const obj = try php.getValueObject(value);
        return fromObject(obj);
    }

    fn getHandlers() *ObjectHandlers {
        if (object_handlers == null) {
            object_handlers = php.std_object_handlers.*;
            const handlers = &object_handlers.?;
            handlers.get_method = php.transform(handleGetMethod);
        }
        return &object_handlers.?;
    }

    fn getMethods() *Methods {
        if (object_methods == null) {
            object_methods = .{
                .abort = php.createTransformedFunction(handleAbort, "abort", 0, false),
                .timeout = php.createTransformedFunction(handleTimeout, "timeout", 1, false),
            };
        }
        return &object_methods.?;
    }

    comptime {
        if (@offsetOf(@This(), "value") != 0) {
            @compileError("value is in the wrong position");
        }
        if (@offsetOf(@This(), "php_portion") + @sizeOf(Object) != @sizeOf(@This())) {
            @compileError("PHP object is in the wrong position");
        }
    }
};
