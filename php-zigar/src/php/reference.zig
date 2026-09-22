pub const std = @import("std");

const php = @import("root.zig");
const c = php.c;
const emalloc = php.emalloc;
const Value = php.Value;

pub const Reference = struct {
    pub fn create(value: Value) *@This() {
        const ref: *Reference = @ptrCast(@alignCast(emalloc(@sizeOf(Reference), @src())));
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

    impl: c.zend_reference,
};
