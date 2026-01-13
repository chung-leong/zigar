const std = @import("std");

const byte_buffer = @import("../byte-buffer.zig");
const ByteBuffer = byte_buffer.ByteBuffer;
const php = @import("../php.zig");
const ClassEntry = php.ClassEntry;
const ExecuteData = php.ExecuteData;
const HashTable = php.HashTable;
const Object = php.Object;
const String = php.String;
const Value = php.Value;
const zig_class_entry = @import("../zig-class.zig");
const ZigClass = zig_class_entry.ZigClass;
const zig_object = @import("../zig-object.zig");
const ZigObject = zig_object.ZigObject;
const All = @import("all.zig").All;

pub const Function = struct {
    closure: *ZigObject(Closure) = undefined,

    const Parent = All(@This());

    pub const Static = struct {
        thunk_address: usize = undefined,
        controller_address: usize = undefined,

        pub fn initialize(self: *@This(), class: *ZigClass) !void {
            self.thunk_address = try getAddress(class, .instance);
            self.controller_address = getAddress(class, .static) catch 0;
            std.debug.print("thunk_address = {x}\n", .{self.thunk_address});
            std.debug.print("controller_address = {x}\n", .{self.controller_address});
        }

        fn getAddress(class: *ZigClass, comptime scope: ZigClass.ScopeType) !usize {
            const tpl = try class.getTemplate(scope);
            const buffer = tpl.bytes orelse return error.NoBuffer;
            return @intFromPtr(buffer.bytes.ptr);
        }
    };

    pub fn setStorage(self: *@This(), buffer: *ByteBuffer, _: ?*HashTable) !void {
        const obj = ZigObject(@This()).fromStructure(self);
        const class = ZigClass.fromEntry(obj.php_portion.ce);
        self.closure = try ZigObject(Closure).create(class, buffer, undefined);
    }

    pub fn getValue(self: *@This()) !Value {
        return php.createValueObject(self.closure.object());
    }

    pub fn freeObject(obj: *Object) void {
        const self = Parent.fromObject(obj);
        self.closure.release();
        Parent.freeObject(obj);
    }
    pub const readProperty = Parent.readProperty;
};

pub const Closure = struct {
    address: usize = undefined,
    function: php.Function = undefined,

    const Parent = All(@This());

    pub fn setStorage(self: *@This(), buffer: *ByteBuffer, _: ?*HashTable) !void {
        self.address = @intFromPtr(buffer.bytes.ptr);
        std.debug.print("address = {x}\n", .{self.address});
        const class = ZigClass.fromStructure(self);
        self.function.internal_function = .{
            .type = php.INTERNAL_FUNCTION,
            .function_name = php.createString("fn"),
            .scope = class.entry(),
            .handler = &php.transform(run),
        };
    }

    pub fn getClosure(obj: *Object, ce: *[*c]ClassEntry, func: *[*c]php.Function, this: ?*[*c]Object, _: bool) c_int {
        const self = Parent.fromObject(obj);
        ce.* = obj.ce;
        func.* = &self.function;
        if (this) |ptr| ptr.* = null;
        return php.SUCCESS;
    }

    pub fn freeObject(obj: *Object) void {
        const self = Parent.fromObject(obj);
        php.release(self.function.internal_function.function_name);
        Parent.freeObject(obj);
    }

    fn run(ed: *ExecuteData, return_value: *Value) !void {
        const self = fromFunction(ed.func);
        const class = ZigClass.fromStructure(self);
        const static = class.getStaticData(Function);
        const arg_addr = 0xDEADBEEF;
        try class.host.runThunk(static.thunk_address, self.address, arg_addr);
        _ = return_value;
    }

    fn fromFunction(func: *php.Function) *@This() {
        return @fieldParentPtr("function", func);
    }
};
