const std = @import("std");

pub const Custom = @import("Module/Custom.zig").@"fn";
const php = @import("root.zig");
const c = php.c;
const pi = php.imports;
const Function = php.Function;

pub fn name(self: *const @This()) [:0]const u8 {
    return std.mem.sliceTo(self.impl.name, 0);
}

pub fn version(self: *const @This()) [:0]const u8 {
    return std.mem.sliceTo(self.impl.version, 0);
}

pub fn fromZendModuleEntry(zmod: c.zend_module_entry) @This() {
    return .{ .impl = zmod };
}

pub fn displayIniEntries(self: *const @This()) void {
    pi.display_ini_entries(@ptrCast(@constCast(self)));
}

pub const Type = enum(c_int) { persistent = 1, temporary = 2 };
pub const Dependency = struct {
    name: [:0]const u8,
    rel: enum { lt, le, eq, ge, gt },
    version: [:0]const u8,
    type: enum { required, conflicts, optional },
};

impl: c.zend_module_entry,
