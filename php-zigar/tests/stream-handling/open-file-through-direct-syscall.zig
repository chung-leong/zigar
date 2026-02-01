const std = @import("std");

pub fn check(path: [*:0]const u8) bool {
    const result: usize = std.os.linux.syscall3(std.os.linux.SYS.open, @intFromPtr(path), 0, 0);
    const fd: i32 = @bitCast(@as(u32, @truncate(result)));
    if (fd < 0) return false;
    _ = std.os.linux.syscall1(std.os.linux.SYS.close, result);
    return true;
}
