const std = @import("std");

const accessor = @import("accessor.zig");
const ByteBuffer = @import("buffer.zig").ByteBuffer;
const CallDispatcher = @import("dispatch.zig").CallDispatcher;
const failure = @import("failure.zig");
const ModuleHost = @import("host.zig").ModuleHost;
const php = @import("php.zig");
const ArgumentIterator = php.ArgumentIterator;
const ClassEntry = php.ClassEntry;
const ExecuteData = php.ExecuteData;
const Fiber = php.Fiber;
const Function = php.Function;
const N = php.getStaticString;
const Object = php.Object;
const ObjectHandlers = php.ObjectHandlers;
const String = php.String;
const Value = php.Value;
const structure = @import("structure.zig");
const ZigClassEntry = @import("class-entry.zig").ZigClassEntry;
const ZigObject = @import("object.zig").ZigObject;

pub const AbortSignal = struct {
    value: std.atomic.Value(u32) align(@sizeOf(*anyopaque)) = .init(0),
    php_portion: php.Object = .{},

    const Methods = struct {
        abort: Function,
        timeout: Function,
    };

    var class_entry: *ClassEntry = undefined;
    var handlers: ObjectHandlers = undefined;
    var methods: Methods = undefined;

    pub inline fn object(self: *@This()) *Object {
        return &self.php_portion;
    }

    pub inline fn fromObject(obj: *Object) *@This() {
        return @fieldParentPtr("php_portion", obj);
    }

    pub fn fromValue(value: *const Value) !*@This() {
        const obj = php.getValueObject(value) catch return error.NotAbortSignal;
        if (!php.instanceOf(obj, class_entry)) return error.NotAbortSignal;
        return fromObject(obj);
    }

    pub fn isInstance(obj: *Object) bool {
        php.instanceOf(obj, class_entry);
    }

    pub fn addRef(self: *@This()) void {
        php.addRef(self.object());
    }

    pub fn release(self: *@This()) void {
        php.release(self.object());
    }

    pub fn create(timeout: ?Value) !*@This() {
        const ce = class_entry;
        const prop_size = php.getObjectPropertySize(ce);
        const size: usize = @intCast(@sizeOf(@This()) + prop_size);
        // we can't use the allocator here, since freeing is done by PHP itself
        const mem = php.emalloc(size, @src()) orelse return error.OutOfMemory;
        errdefer php.efree(mem, @src());
        const self: *@This() = @ptrCast(@alignCast(mem));
        self.* = .{};
        const obj = self.object();
        php.initializeStandardObject(obj, ce);
        // handlers need to be set after zend_object_std_init() due to change in PHP 8.3
        obj.handlers = &handlers;
        if (timeout) |v| try self.setTimeout(&v);
        return self;
    }

    pub fn abort(self: *@This()) void {
        self.value.store(1, .monotonic);
        std.Thread.Futex.wake(&self.value, std.math.maxInt(u32));
    }

    pub fn setTimeout(self: *@This(), value: *const Value) !void {
        const seconds = try php.getValueDouble(value);
        try CallDispatcher.event_loop.addTimeout(seconds, self);
    }

    pub fn getMethod(_: *[*c]Object, name: *String, _: ?*const Value) !?*Function {
        inline for (std.meta.fields(Methods)) |field| {
            if (std.mem.eql(u8, php.getStringContent(name), field.name)) {
                return &@field(methods, field.name);
            }
        }
        return null;
    }

    pub fn handleCreateObject(_: *ClassEntry) !*Object {
        const self = try create(null);
        return self.object();
    }

    pub fn handleAbort(ed: *ExecuteData, _: *Value) !void {
        const self = try getSelf(&ed.This);
        self.abort();
    }

    pub fn handleTimeout(ed: *ExecuteData, _: *Value) !void {
        var arg_iter: ArgumentIterator = .init(ed);
        const arg = arg_iter.next() orelse return error.NotDouble;
        const self = try getSelf(arg_iter.this);
        try self.setTimeout(arg);
    }

    pub fn registerClass() !void {
        var ce: ClassEntry = .{ .name = N("AbortSignal") };
        const parent_ce = php.getClassEntry(.standard);
        class_entry = try php.registerInternalClass(&ce, parent_ce);
        class_entry.unnamed_1.create_object = php.transform(handleCreateObject);
        methods = .{
            .abort = php.createTransformedFunction(handleAbort, "abort", 0, false),
            .timeout = php.createTransformedFunction(handleTimeout, "timeout", 1, false),
        };
        handlers = php.createHandlerTable(@This(), @offsetOf(@This(), "php_portion"));
    }

    pub fn unregisterClass() void {
        php.unregisterInternalClass(class_entry);
    }

    fn getSelf(value: *const Value) !*@This() {
        const obj = try php.getValueObject(value);
        return fromObject(obj);
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

pub const AbortSignalStatic = struct {
    methods: Methods = undefined,

    pub fn init(self: *@This(), _: *ZigClassEntry) !void {
        self.methods = .{
            .on = php.createTransformedFunction(handleOn, "on", 0, false),
            .off = php.createTransformedFunction(handleOff, "off", 0, false),
        };
    }

    pub fn deinit(_: *@This()) void {}

    pub const Methods = struct {
        on: Function,
        off: Function,
    };

    pub fn findMethod(self: *@This(), name: *String) ?*php.Function {
        return inline for (std.meta.fields(Methods)) |field| {
            if (php.matchString(name, field.name)) break &@field(self.methods, field.name);
        } else return null;
    }

    pub fn handleOn(ed: *ExecuteData, return_value: *Value) !void {
        try handleState(ed, return_value, true);
    }

    pub fn handleOff(ed: *ExecuteData, return_value: *Value) !void {
        try handleState(ed, return_value, false);
    }

    fn handleState(ed: *ExecuteData, return_value: *Value, expected: bool) !void {
        const arg_iter: ArgumentIterator = .init(ed);
        const fn_name = if (expected) "on" else "off";
        try arg_iter.verifyCount(0, 0, fn_name);
        const signal_struct = try structure.Struct.fromValue(arg_iter.this);
        const ptr = try signal_struct.getProperty(N("ptr"), null);
        defer php.release(&ptr);
        const ptr_struct = try structure.Pointer.fromValue(&ptr);
        const int_obj = try ptr_struct.getTarget();
        const int_struct = structure.Primitive.fromObject(int_obj);
        const long_value = try int_struct.getValue(.none);
        const state = try php.getValueLong(&long_value) != 0;
        return_value.* = php.createValueBool(state == expected);
    }
};
