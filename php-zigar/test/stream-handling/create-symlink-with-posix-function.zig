const c = @import("c");

pub fn symlink(path: [*:0]const u8, new_path: [*:0]const u8) !void {
    const result = c.symlink(path, new_path);
    if (result < 0) return error.UnableToCreateSymlink;
}
