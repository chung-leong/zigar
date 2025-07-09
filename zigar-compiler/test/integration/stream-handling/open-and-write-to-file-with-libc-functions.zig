const std = @import("std");

pub fn save(path: [*:0]const u8, data: []const u8) !usize {
    const file = std.c.fopen(path, "w") orelse return error.UnableToOpenFile;
    defer _ = std.c.fclose(file);
    return std.c.fwrite(data.ptr, 1, data.len, file);
}
