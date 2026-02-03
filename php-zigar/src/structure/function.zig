const std = @import("std");

const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const ZigClassEntry = @import("../class-entry.zig").ZigClassEntry;
const Closure = @import("../closure.zig").Closure;
const ZigObject = @import("../object.zig").ZigObject;
const php = @import("../php.zig");
const ArgumentIterator = php.ArgumentIterator;
const ClassEntry = php.ClassEntry;
const ExecuteData = php.ExecuteData;
const Object = php.Object;
const Value = php.Value;
const structure = @import("../structure.zig");

pub const Function = struct {
    address: usize = undefined,
    closure: *Closure = undefined,

    const Super = structure.Parent(@This());
    pub const Static = struct {
        thunk_address: usize = undefined,
        controller_address: usize = undefined,
        argument_class: *ZigClassEntry = undefined,

        pub fn init(self: *@This(), class: *ZigClassEntry) !void {
            self.thunk_address = getAddress(class, .instance);
            self.controller_address = getAddress(class, .static);
            const member = try class.getMember(.instance, 0);
            const arg_class = member.class orelse return error.MissingClass;
            switch (arg_class.type) {
                .arg_struct, .variadic_struct => self.argument_class = arg_class,
                else => return error.Unexpected,
            }
        }

        fn getAddress(class: *ZigClassEntry, comptime scope: ZigClassEntry.ScopeType) usize {
            const buffer = @field(class, @tagName(scope)).template.bytes orelse return 0;
            return @intFromPtr(buffer.bytes.ptr);
        }
    };

    pub fn setStorage(self: *@This(), buffer: *ByteBuffer, _: *const Value) !void {
        self.address = @intFromPtr(buffer.bytes.ptr);
        self.closure = try Closure.create(self, invokeThunk, null);
    }

    pub fn invokeThunk(self: *@This(), arg_iter: *ArgumentIterator) !?Value {
        if (self.address != 0) {
            const class = ZigClassEntry.fromStructure(self);
            const static = class.getStaticData(Function);
            const arg = try ZigClassEntry.createObject(static.argument_class.entry());
            defer php.release(arg);
            switch (static.argument_class.type) {
                .arg_struct => {
                    const arg_struct = ZigObject(structure.ArgStruct).fromObject(arg).structure();
                    const arg_addr = @intFromPtr(arg_struct.bytes.bytes.ptr);
                    const is_method_call = false;
                    if (is_method_call) arg_iter.makeThisFirst();
                    try arg_struct.copyArguments(arg_iter);
                    try class.host.runThunk(static.thunk_address, self.address, arg_addr);
                    return try arg_struct.getReturnValue();
                },
                .variadic_struct => {
                    // TODO
                    @panic("TODO");
                },
                else => unreachable,
            }
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

    pub const readSelf = Super.readSelf;
    const fromObject = Super.fromObject;
};
