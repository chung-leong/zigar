const std = @import("std");

pub const Error = error{ goldfish_died, no_money };
pub const FileError = error{corrupted};

pub var error_union: Error!FileError!i32 = 3000;

pub fn print() void {
    std.debug.print("{any}\n", .{error_union});
}
