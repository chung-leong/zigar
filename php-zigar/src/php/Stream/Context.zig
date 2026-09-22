const std = @import("std");

const php = @import("../root.zig");
const c = php.c;
const pi = php.imports;
const Resource = php.Resource;

pub fn resource(self: *const @This()) *Resource {
    return @ptrCast(self.impl.res);
}

impl: c.php_stream_context,
