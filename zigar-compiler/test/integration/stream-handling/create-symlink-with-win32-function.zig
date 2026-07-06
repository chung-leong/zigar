const c = @import("c");

pub fn symlink(path: [*:0]const u8, new_path: [*:0]const u8) !void {
    if (c.CreateSymbolicLinkA(new_path, path, 0) == 0) {
        return error.UnableToCreateSymlink;
    }
}
