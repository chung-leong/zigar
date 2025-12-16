const std = @import("std");

pub fn isFieldString(comptime T: type, comptime _: std.meta.FieldEnum(T)) bool {
    return true;
}

pub fn isDeclPlain(comptime T: type, comptime _: std.meta.DeclEnum(T)) bool {
    return true;
}
