pub const std = @import("std");

const c = @import("c.zig");
const pd = c.declarations;
const pi = c.imports;
const String = @import("string.zig").String;
const Value = @import("value.zig").Value;

pub const ClassEntry = struct {
    pub fn find(name: anytype) ?*@This() {
        const n = String.createFromAny(name);
        defer n.release();
        const zce = pi.zend_lookup_class(@constCast(name)) orelse return null;
        return @ptrCast(zce);
    }

    impl: pd.zend_class_entry,
};
