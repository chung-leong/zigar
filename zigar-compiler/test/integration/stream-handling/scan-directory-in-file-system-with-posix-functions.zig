const std = @import("std");
const allocator = std.heap.c_allocator;

const c = @cImport({
    @cInclude("dirent.h");
    @cInclude("sys/stat.h");
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
        const child_path = try std.fs.path.joinZ(allocator, &.{
            path[0..std.mem.len(path)],
            name,
        });
        defer allocator.free(child_path);
        var info: c.struct_stat = undefined;
        const result = c.stat(child_path.ptr, &info);
        if (result < 0) return error.UnableToStatFile;
        std.debug.print("{s} ({d} bytes)\n", .{ name, info.st_size });
    }
}
