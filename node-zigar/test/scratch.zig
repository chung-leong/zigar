const std = @import("std");

pub fn hello() void {
    return std.debug.print("Hello world!", .{});
}

pub var name: []const u8 = "Hello world!";

pub const EnumLiteral = @TypeOf(.enum_literal);
pub const Type = type;
pub const Null = @TypeOf(null);
pub const Undefined = @TypeOf(undefined);
