const std = @import("std");

const accessor = @import("../accessor.zig");
const Error = accessor.Error;
const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const php = @import("../php.zig");
const Value = php.Value;

const Attributes = struct {};

pub const Null = struct {
    comptime type: accessor.Type = .null,
    comptime attributes: Attributes = .{},

    pub fn get(_: @This()) Error!Value {
        return php.createValueNull();
    }

    pub fn set(_: @This(), value: *const Value) Error!void {
        try php.getValueNull(value);
    }

    pub fn getElement(self: @This(), _: usize) Error!Value {
        return self.get();
    }

    pub fn setElement(self: @This(), _: usize, value: *const Value) Error!void {
        return self.set(value);
    }
};
