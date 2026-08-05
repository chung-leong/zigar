const std = @import("std");

const php = @import("php.zig");
const Object = php.Object;
const Value = php.Value;

const GdImage = extern struct {
    struct_ptr: *anyopaque,
    php_portion: Object,
};

pub fn getObject(value: *const Value) ?*Object {
    const obj = php.getValueObject(value) catch return null;
    const class_name = obj.ce.*.name orelse return null;
    if (!php.matchString(class_name, "GdImage")) return null;
    return obj;
}

pub fn getPointer(value: *const Value) ?*anyopaque {
    const obj = getObject(value) orelse return null;
    const gd_img: *GdImage = @fieldParentPtr("php_portion", obj);
    return gd_img.struct_ptr;
}
