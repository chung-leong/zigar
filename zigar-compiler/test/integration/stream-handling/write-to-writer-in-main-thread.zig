const std = @import("std");

pub fn save(data: []const u8, writer: std.io.AnyWriter) !usize {
    return try writer.write(data);
}
