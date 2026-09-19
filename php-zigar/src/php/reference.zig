pub const std = @import("std");

const php = @import("root.zig");
const c = php.c;

pub const Reference = struct {
    impl: c.zend_reference,
};
