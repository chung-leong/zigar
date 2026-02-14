const std = @import("std");

const php = @import("php.zig");
const ArgumentIterator = php.ArgumentIterator;
const ExecuteData = php.ExecuteData;
const Function = php.Function;
const Object = php.Object;
const Value = php.Value;

pub const Closure = extern struct {
    ptr: *anyopaque,
    php_portion: Function,

    pub fn create(ptr: anytype, cb: anytype, name: []const u8) !*@This() {
        const ns = struct {
            fn run(ed: [*c]ExecuteData, return_value: [*c]Value) callconv(.c) void {
                const func: *Function = @ptrCast(ed.*.func);
                const c: *Closure = @fieldParentPtr("php_portion", func);
                var arg_iter: ArgumentIterator = .init(ed);
                const p: @TypeOf(ptr) = @ptrCast(@alignCast(c.ptr));
                const retval = php.removeError(cb(p, &arg_iter));
                const RT = @TypeOf(retval);
                switch (RT) {
                    ?Value => if (retval) |v| {
                        return_value.* = v;
                    },
                    void => {},
                    else => @compileError("Unexpected return value " ++ @typeName(RT)),
                }
            }
        };
        const self = try php.allocator.create(@This());
        self.* = .{
            .ptr = ptr,
            .php_portion = php.createFunction(ns.run, name),
        };
        return self;
    }

    pub fn function(self: *@This()) *Function {
        return &self.php_portion;
    }

    pub fn release(self: *@This()) void {
        php.destroyFunction(&self.php_portion);
        php.allocator.destroy(self);
    }
};
