const std = @import("std");

const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const ZigClass = @import("../class.zig").ZigClass;
const ZigObject = @import("../object.zig").ZigObject;
const php = @import("../php.zig");
const ClassEntry = php.ClassEntry;
const ExecuteData = php.ExecuteData;
const Object = php.Object;
const Value = php.Value;
const structure = @import("../structure.zig");

pub const Function = struct {
    address: usize = undefined,
    function: php.Function = undefined,
    is_method: bool = false,

    const Super = structure.Parent(@This());
    pub const Static = struct {
        thunk_address: usize = undefined,
        controller_address: usize = undefined,
        argument_class: *ZigClass = undefined,

        pub fn init(self: *@This(), class: *ZigClass) !void {
            self.thunk_address = getAddress(class, .instance);
            self.controller_address = getAddress(class, .static);
            const member = try class.getMember(.instance, 0);
            const arg_class = member.class orelse return error.MissingClass;
            switch (arg_class.type) {
                .arg_struct, .variadic_struct => self.argument_class = arg_class,
                else => return error.Unexpected,
            }
        }

        fn getAddress(class: *ZigClass, comptime scope: ZigClass.ScopeType) usize {
            const buffer = @field(class, @tagName(scope)).template.bytes orelse return 0;
            return @intFromPtr(buffer.bytes.ptr);
        }
    };

    pub fn setStorage(self: *@This(), buffer: *ByteBuffer, _: *const Value) !void {
        self.address = @intFromPtr(buffer.bytes.ptr);
        // buffer.release(); // the buffer only existed to convey the function's address
        self.function = php.createFunction(run, "run");
    }

    pub fn getClosure(obj: *Object, ce: *[*c]ClassEntry, func: *[*c]php.Function, this: ?*[*c]Object, _: bool) c_int {
        const self = Super.fromObject(obj);
        ce.* = obj.ce;
        func.* = &self.function;
        if (this) |ptr| ptr.* = null;
        return php.SUCCESS;
    }

    pub fn freeObject(obj: *Object) void {
        const self = Super.fromObject(obj);
        php.destroyFunction(&self.function);
        Super.freeObject(obj);
    }

    pub fn run(ed: *ExecuteData, return_value: *Value) void {
        if (invokeThunk(ed)) |result| {
            return_value.* = result;
        } else |err| {
            switch (err) {
                error.IncorrectArgumentCount => php.reportWrongParamCount(),
                else => php.throwError(err),
            }
            return_value.* = php.createValueNull();
        }
    }

    pub fn invokeThunk(ed: *ExecuteData) !Value {
        const self: *@This() = @fieldParentPtr("function", @as(*php.Function, ed.func));
        const class = ZigClass.fromStructure(self);
        const static = class.getStaticData(Function);
        const arg = try ZigClass.createObject(static.argument_class.entry());
        defer php.release(arg);
        var arg_iter: php.ArgumentIterator = .init(ed, self.is_method);
        switch (static.argument_class.type) {
            .arg_struct => {
                const arg_struct = structure.ArgStruct.fromObject(arg);
                const arg_addr = @intFromPtr(arg_struct.bytes.bytes.ptr);
                try arg_struct.copyArguments(&arg_iter);
                try class.host.runThunk(static.thunk_address, self.address, arg_addr);
                return try arg_struct.getReturnValue();
            },
            .variadic_struct => {
                // TODO
                unreachable;
            },
            else => unreachable,
        }
    }

    pub const fromObject = Super.fromObject;
    pub const readSelf = Super.readSelf;
    pub const readProperty = Super.readProperty;
};
