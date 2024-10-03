const std = @import("std");

pub const Error = error{ GoldfishDied, NoMoney };
pub const FileError = error{Corrupted};

pub var error_union: Error!FileError!i32 = 3000;

pub fn print() void {
    std.debug.print("{any}\n", .{error_union});
}
