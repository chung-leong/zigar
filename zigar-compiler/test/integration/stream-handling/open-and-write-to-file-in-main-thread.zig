const std = @import("std");

pub fn save(path: []const u8, data: []const u8) !usize {
    var file = try std.fs.createFileAbsolute(path, .{});
    defer file.close();
    return try file.write(data);
}
