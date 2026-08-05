const std = @import("std");

pub fn exit(errno: u8) noreturn {
    return std.process.exit(errno);
}
