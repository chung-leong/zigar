pub const std = @import("std");

const c = @import("c.zig");
const pd = c.declarations;
const pi = c.imports;
const String = @import("string.zig").String;
const Value = @import("value.zig").Value;

pub const Callable = struct {
    value: Value,
};
