const std = @import("std");

pub fn print(text: []u8) void {
    std.debug.print("text = {s}\n", .{text});
    text[0] = 'J';
}
