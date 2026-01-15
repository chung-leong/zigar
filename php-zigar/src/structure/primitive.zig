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
        accessors: accessor.Primitive = undefined,

        pub fn initialize(self: *@This(), class: *ZigClass) !void {
            _ = self;
            _ = class;
        }
    };

    pub const setStorage = Super.setStorage;
    pub const getValue = Super.getValue;
    pub const freeObject = Super.freeObject;
    pub const readProperty = Super.readProperty;
};
