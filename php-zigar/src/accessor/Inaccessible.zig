const std = @import("std");

const accessor = @import("../accessor.zig");
const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const Error = @import("../failure.zig").Error;
const php_ng = @import("../php/root.zig");
const Value = php_ng.Value;

pub fn get(_: @This()) Error!Value {
    return error.Inaccessible;
}

pub fn set(_: @This(), _: *ByteBuffer, _: Value) Error!void {
    return error.Inaccessible;
}

pub fn getElement(_: @This(), _: usize) Error!Value {
    return error.Inaccessible;
}

pub fn setElement(_: @This(), _: *ByteBuffer, _: usize, _: Value) Error!void {
    return error.Inaccessible;
}

const Attributes = struct {};

comptime type: accessor.Type = .inaccessible,
comptime attributes: Attributes = .{},
