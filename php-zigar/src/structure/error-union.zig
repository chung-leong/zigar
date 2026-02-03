const std = @import("std");

const accessor = @import("../accessor.zig");
const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const ZigClassEntry = @import("../class-entry.zig").ZigClassEntry;
const php = @import("../php.zig");
const Object = php.Object;
const String = php.String;
const Value = php.Value;
const structure = @import("../structure.zig");
const error_set = @import("error-set.zig");
const ErrorSet = error_set.ErrorSet;

pub const ErrorUnion = struct {
    bytes: *ByteBuffer = undefined,
    slots: Value = undefined,

    const Super = structure.Parent(@This());
    pub const Static = struct {
        payload_acc: *accessor.Any = undefined,
        error_acc: *accessor.Primitive = undefined,
        error_class: *ZigClassEntry = undefined,

        pub fn init(self: *@This(), class: *ZigClassEntry) !void {
            const member0 = try class.getMember(.instance, 0);
            self.payload_acc = &member0.accessors;
            const member1 = try class.getMember(.instance, 1);
            if (member1.accessors != .primitive) return error.InvalidAccessor;
            self.error_acc = &member1.accessors.primitive;
            self.error_class = member1.class orelse return error.MissingClass;
        }
    };

    pub fn readSelf(self: *@This()) !Value {
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        const err_value = try static.error_acc.get(self.bytes);
        const err_code = try php.getValueLong(&err_value);
        if (err_code == 0) {
            // return the payload when there's no error
            return try static.payload_acc.get(self);
        } else {
            // throw the error set object when there is one
            const error_set_static = static.error_class.getStaticData(ErrorSet);
            const err_obj = try error_set_static.acquireError(err_code);
            php.throwExceptionObject(err_obj);
            return php.createValueNull();
        }
    }

    pub fn writeSelf(self: *@This(), value: *const Value) !void {
        const class = ZigClassEntry.fromStructure(self);
        var static = class.getStaticData(@This());
        const err_value = find: {
            // see if value is an Throwable
            const exception = php.getValueObject(value) catch
                break :find null;
            if (!php.instanceOf(exception.ce, php.getInterface(.throwable)))
                break :find null;
            // look up the error number
            const error_set_static = static.error_class.getStaticData(ErrorSet);
            if (ZigClassEntry.isZigError(exception.ce)) {
                break :find try error_set_static.readErrorValue(exception);
            } else {
                const msg_value = try php.invokeMethod(exception, "getMessage", .{});
                const message = try php.getValueStringContent(&msg_value);
                if (error_set_static.findError(message)) |err_obj| {
                    break :find try error_set_static.readErrorValue(err_obj);
                } else |_| {
                    return php.throwExceptionFmt("'{s}' does not correspond to error in global set (zig)", .{
                        message,
                    });
                }
            }
        };
        if (err_value) |ev|
            try static.error_acc.set(self.bytes, &ev)
        else
            try static.payload_acc.set(self, value);
    }

    pub const setStorage = Super.setStorage;
    pub const copyArguments = Super.copyArguments;
    pub const freeObject = Super.freeObject;
    const fromObject = Super.fromObject;
};
