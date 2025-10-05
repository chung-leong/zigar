const std = @import("std");

pub fn printInfo() void {
    std.log.info("std.log.info\n", .{});
}

pub fn printError() void {
    std.log.err("std.log.err\n", .{});
}

pub const std_options: std.Options = .{
    .log_level = .err,
};
