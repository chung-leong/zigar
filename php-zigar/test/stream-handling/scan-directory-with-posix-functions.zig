const std = @import("std");

const c = @cImport({
    @cInclude("dirent.h");
});

pub fn print(path: [*:0]const u8) !void {
    const dir = c.opendir(path) orelse return error.UnableToOpenDirectory;
    defer _ = c.closedir(dir);
    while (c.readdir(dir)) |entry_c_ptr| {
        const entry = entry_c_ptr.*;
        const Entry = @TypeOf(entry);
        const name_bytes: [*:0]const u8 = if (@hasField(Entry, "d_name"))
            @ptrCast(&entry.d_name)
        else get: {
            const bytes: [*]const u8 = @ptrCast(entry_c_ptr);
            const offset = @offsetOf(Entry, "d_type") + 1;
            break :get @ptrCast(bytes[offset..]);
        };
        const name_len = std.mem.len(name_bytes);
        const name = name_bytes[0..name_len];
        const entry_type = if (@hasField(@TypeOf(entry), "d_type"))
            switch (entry.d_type) {
                c.DT_REG => "file",
                c.DT_DIR => "dir",
                else => "unknown",
            }
        else
            "unknown";
        std.debug.print("{s} ({s})\n", .{ name, entry_type });
    }
}
