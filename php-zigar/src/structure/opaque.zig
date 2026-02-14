const std = @import("std");

const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const ZigClassEntry = @import("../class-entry.zig").ZigClassEntry;
const php = @import("../php.zig");
const Object = php.Object;
const Value = php.Value;
const structure = @import("../structure.zig");

pub const Opaque = struct {
    bytes: *ByteBuffer = undefined,

    const Super = structure.Parent(@This());
    pub const Static = struct {
        class_obj: *Object = undefined,

        pub fn init(self: *@This(), class_obj: *Object) !void {
            // because methods are really static functions, we need to maintain a ref on the class object
            self.class_obj = class_obj;
            php.addRef(self.class_obj);
        }

        pub fn deinit(self: *@This()) void {
            php.release(self.class_obj);
        }
    };

    pub const setStorage = Super.setStorage;
    pub const getExtent = Super.getExtent;
    pub const readSelf = Super.readSelf;
    pub const freeObject = Super.freeObject;
};
