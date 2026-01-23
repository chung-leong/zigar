const std = @import("std");

const byte_buffer = @import("../byte-buffer.zig");
const ByteBuffer = byte_buffer.ByteBuffer;
const php = @import("../php.zig");
const HashPosition = php.HashPosition;
const ClassEntry = php.ClassEntry;
const ExecuteData = php.ExecuteData;
const Function = php.Function;
const Object = php.Object;
const String = php.String;
const Value = php.Value;
const structure = @import("../structure.zig");
const zig_class = @import("../zig-class.zig");
const ZigClass = zig_class.ZigClass;
const zig_object = @import("../zig-object.zig");
const ZigObject = zig_object.ZigObject;

pub const Static = struct {
    // this needs to be initialized, since setStorage() isn't called immediately
    slots: Value = .{},

    pub const scope: ZigClass.ScopeType = .static;

    const Super = structure.Parent(@This());

    pub fn getMethod(obj_ptr: *[*c]Object, name: *String, _: *const Value) !?*Function {
        const obj = obj_ptr.*;
        const field = Super.readMember(obj, name, null) catch return null;
        const field_obj = php.getValueObject(&field) catch return null;
        const field_class = ZigClass.fromObject(field_obj);
        if (field_class.type != .function) return null;
        const func = structure.Function.fromObject(field_obj);
        return &func.function;
    }

    pub const fromObject = Super.fromObject;
    pub const freeObject = Super.freeObject;
    pub const setStorage = Super.setStorage;
    pub const readSelf = Super.readSelf;
    pub const readProperty = Super.readProperty;
    pub const writeProperty = Super.writeProperty;
};
