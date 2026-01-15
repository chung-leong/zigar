const std = @import("std");

const accessor = @import("../accessor.zig");
const byte_buffer = @import("../byte-buffer.zig");
const ByteBuffer = byte_buffer.ByteBuffer;
const php = @import("../php.zig");
const Value = php.Value;
const Object = php.Object;
const String = php.String;
const structure = @import("../structure.zig");
const zig_class = @import("../zig-class.zig");
const ZigClass = zig_class.ZigClass;

pub const Primitive = struct {
    bytes: *ByteBuffer = undefined,

    const Super = structure.Parent(@This());

    pub const Static = struct {
        primitive: *accessor.Primitive = undefined,

        pub fn initialize(self: *@This(), class: *ZigClass) !void {
            // fetch the accessor in advance since we know it can only be a of the primitive type
            const member = try class.getMember(.instance, 0);
            if (member.accessors != .primitive) {
                // TODO: should return an error eventually
                // return error.InvalidAccessor;
                return;
            }
            self.primitive = &member.accessors.primitive;
        }
    };

    pub fn getValue(self: *@This()) !Value {
        const class = ZigClass.fromStructure(self);
        const primitive = class.getStaticData(@This()).primitive;
        return try primitive.get(self.bytes);
    }

    pub fn setValue(self: *@This(), value: *Value) !void {
        const class = ZigClass.fromStructure(self);
        const primitive = class.getStaticData(@This()).primitive;
        return try primitive.set(self.bytes, value);
    }

    pub const setStorage = Super.setStorage;
    // pub const getValue = Super.getValue;
    pub const freeObject = Super.freeObject;
    pub const readProperty = Super.readProperty;
    pub const writeProperty = Super.writeProperty;
};
