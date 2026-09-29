pub const std = @import("std");

const php = @import("root.zig");
const php_al = php.allocator;
const c = php.c;
const Value = php.Value;

pub fn create(value: Value) *@This() {
    const ref = php_al.create(Reference) catch unreachable;
    ref.* = .{
        .impl = .{
            .gc = .{ .refcount = 1, .u = .{ .type_info = c.GC_REFERENCE } },
            .val = value.toZval(),
            .sources = .{ .ptr = null },
        },
    };
    return ref;
}

pub fn target(self: *const @This()) Value {
    return .fromZval(self.impl.val);
}

pub fn setTarget(self: *const @This(), value: Value) Value {
    self.impl = value.toZval();
}

const Reference = @This();

impl: c.zend_reference,
