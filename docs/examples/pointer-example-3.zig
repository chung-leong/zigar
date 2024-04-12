const std = @import("std");

pub const File = struct {
    name: []const u8,
    data: []const u8,
};
pub const Directory = struct {
    name: []const u8,
    entries: []const DirectoryEntry,
};
pub const DirectoryEntry = union(enum) {
    file: *const File,
    dir: *const Directory,
};

fn indent(depth: u32) void {
    for (0..depth) |_| {
        std.debug.print("  ", .{});
    }
}

fn printFile(file: *const File, depth: u32) void {
    indent(depth);
    std.debug.print("{s} ({d})\n", .{ file.name, file.data.len });
}

fn printDirectory(dir: *const Directory, depth: u32) void {
    indent(depth);
    std.debug.print("{s}/\n", .{dir.name});
    for (dir.entries) |entry| {
        switch (entry) {
            .file => |f| printFile(f, depth + 1),
            .dir => |d| printDirectory(d, depth + 1),
        }
    }
}

pub fn printDirectoryTree(dir: *const Directory) void {
    printDirectory(dir, 0);
}
