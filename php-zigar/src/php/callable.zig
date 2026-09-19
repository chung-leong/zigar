pub const std = @import("std");

const php = @import("root.zig");
const Value = php.Value;

pub const Callable = struct {
    value: Value,
};
