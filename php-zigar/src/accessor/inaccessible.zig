const std = @import("std");

const accessor = @import("../accessor.zig");
const Error = accessor.Error;
const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const php = @import("../php.zig");
const Value = php.Value;

const Attributes = struct {};

pub const Inaccessible = struct {
    comptime type: accessor.Type = .inaccessible,
    comptime attributes: Attributes = .{},

    pub fn get(_: @This()) Error!Value {
        return error.Inaccessible;
    }

    pub fn set(_: @This(), _: *ByteBuffer, _: *const Value) Error!void {
        return error.Inaccessible;
    }

    pub fn getElement(_: @This(), _: usize) Error!Value {
        return error.Inaccessible;
    }

    pub fn setElement(_: @This(), _: *ByteBuffer, _: usize, _: *const Value) Error!void {
        return error.Inaccessible;
    }
};
