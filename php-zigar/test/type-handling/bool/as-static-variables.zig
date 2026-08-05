const std = @import("std");

pub var bool1: bool = true;
pub var bool2: bool = false;
pub const bool3: bool = true;
pub const bool4: bool = false;

pub fn print() void {
    std.debug.print("{s}", .{if (bool1) "yes" else "no"});
}
