const std = @import("std");

pub const Error = error{ goldfish_died, no_money };

pub var error_union: Error![]const u8 = "Hello";
pub var alt_text: []const u8 = "World";

pub fn print() void {
    std.debug.print("{any}\n", .{error_union});
}
