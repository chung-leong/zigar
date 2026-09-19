pub const std = @import("std");

const php = @import("root.zig");
const c = php.c;
const pi = php.imports;
const String = php.String;
const Value = php.Value;

pub const ClassEntry = struct {
    pub fn find(name: anytype) ?*@This() {
        const n = String.createFromAny(name);
        defer n.release();
        const zce = pi.zend_lookup_class(@constCast(name)) orelse return null;
        return @ptrCast(zce);
    }

    impl: c.zend_class_entry,
};
