const std = @import("std");

const accessor = @import("../accessor.zig");
const byte_buffer = @import("../byte-buffer.zig");
const ByteBuffer = byte_buffer.ByteBuffer;
const php = @import("../php.zig");
const Object = php.Object;
const String = php.String;
const Value = php.Value;
const structure = @import("../structure.zig");
const zig_class = @import("../zig-class.zig");
const ZigClass = zig_class.ZigClass;
const error_set = @import("error-set.zig");
const ErrorSet = error_set.ErrorSet;

pub const ErrorUnion = struct {
    bytes: *ByteBuffer = undefined,
    slots: Value = undefined,

    const Super = structure.Parent(@This());
    pub const Static = struct {
        payload_acc: *accessor.Any = undefined,
        error_acc: *accessor.Primitive = undefined,
        error_class: *ZigClass = undefined,

        pub fn init(self: *@This(), class: *ZigClass) !void {
            const member0 = try class.getMember(.instance, 0);
            self.payload_acc = &member0.accessors;
            const member1 = try class.getMember(.instance, 1);
            if (member1.accessors != .primitive) return error.InvalidAccessor;
            self.error_acc = &member1.accessors.primitive;
            self.error_class = member1.class orelse return error.MissingClass;
        }
    };

    pub fn readSelf(obj: *Object) !Value {
        const self = fromObject(obj);
        const class = ZigClass.fromObject(obj);
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

    pub fn writeSelf(obj: *Object, value: *const Value) !void {
        const self = fromObject(obj);
        const class = ZigClass.fromObject(obj);
        var static = class.getStaticData(@This());
        const err_value = find: {
            // see if value is an Throwable
            const exception = php.getValueObject(value) catch
                break :find null;
            if (!php.instanceOf(exception.ce, php.getInterface(.throwable)))
                break :find null;
            // look up the error number
            const error_set_static = static.error_class.getStaticData(ErrorSet);
            if (exception.ce.*.unnamed_0.parent == zig_class.error_class) {
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

    pub const fromObject = Super.fromObject;
    pub const setStorage = Super.setStorage;
    pub const freeObject = Super.freeObject;
    pub const readProperty = Super.readProperty;
    pub const writeProperty = Super.writeProperty;
};
