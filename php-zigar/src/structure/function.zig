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
    buffer: *ByteBuffer = undefined,
    closure: *Closure = undefined,

    const Super = structure.Parent(@This());
    pub const Static = struct {
        thunk_address: usize = undefined,
        controller_address: usize = undefined,
        argument_class: *ZigClassEntry = undefined,
        first_arg_ce: ?*ClassEntry = null,

        pub fn init(self: *@This(), class: *ZigClassEntry) !void {
            self.thunk_address = getAddress(class, .instance);
            self.controller_address = getAddress(class, .static);
            const member = try class.getMember(.instance, 0);
            const arg_class = member.class orelse return error.MissingClass;
            const arg_count = arg_class.length orelse return error.MissingLength;
            switch (arg_class.type) {
                .arg_struct, .variadic_struct => {
                    self.argument_class = arg_class;
                    if (arg_count > 0) {
                        const arg = try arg_class.getMember(.instance, "0");
                        if (arg.class) |c| self.first_arg_ce = c.entry();
                    }
                },
                else => return error.Unexpected,
            }
        }

        fn getAddress(class: *ZigClassEntry, comptime scope: ZigClassEntry.ScopeType) usize {
            const buffer = @field(class, @tagName(scope)).template.bytes orelse return 0;
            return @intFromPtr(buffer.bytes.ptr);
        }
    };

    pub fn setStorage(self: *@This(), buffer: *ByteBuffer, slots: *const Value) !void {
        try Super.setStorage(self, buffer, slots);
        self.closure = try Closure.create(self, invokeThunk, null);
    }

    pub fn writeSelf(self: *@This(), value: *const Value) !void {
        const class = ZigClassEntry.fromStructure(self);
        _ = class;
        _ = value;
    }

    pub fn invokeThunk(self: *@This(), arg_iter: *ArgumentIterator) !?Value {
        const fn_addr = @intFromPtr(self.buffer.bytes.ptr);
        if (fn_addr != 0) {
            const class = ZigClassEntry.fromStructure(self);
            const static = class.getStaticData(Function);
            const arg = try ZigClassEntry.createObject(static.argument_class.entry());
            defer php.release(arg);
            switch (static.argument_class.type) {
                .arg_struct => {
                    const arg_struct = ZigObject(structure.ArgStruct).fromObject(arg).structure();
                    const arg_addr = @intFromPtr(arg_struct.bytes.bytes.ptr);
                    const is_method_call = init: {
                        if (static.first_arg_ce) |ce| {
                            if (php.getValueObject(arg_iter.this)) |obj| {
                                break :init obj.ce == ce;
                            } else |_| {}
                        }
                        break :init false;
                    };
                    if (is_method_call) arg_iter.makeThisFirst();
                    try arg_struct.copyArguments(arg_iter);
                    try class.host.runThunk(static.thunk_address, fn_addr, arg_addr);
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
