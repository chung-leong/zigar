const std = @import("std");

const php = @import("../root.zig");
const Array = php.Array;
const c = php.c;
const Function = php.Function;
const Value = php.Value;
pub const Iterator = @import("Arguments/Iterator.zig");

pub fn this(self: *const @This()) Value {
    return @as(*Value, @ptrCast(@constCast(&self.impl.This))).*;
}

pub fn getExtraNamed(self: *const @This()) ?*Array {
    const zarr = self.impl.extra_named_params orelse return null;
    return @ptrCast(zarr);
}

pub fn callee(self: *const @This()) *Function {
    return @ptrCast(self.impl.func);
}

pub fn iterate(self: *const @This()) Iterator {
    return .init(self);
}

impl: c.zend_execute_data,
