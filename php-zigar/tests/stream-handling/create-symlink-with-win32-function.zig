const windows_h = @cImport({
    @cInclude("windows.h");
});

pub fn symlink(path: [*:0]const u8, new_path: [*:0]const u8) !void {
    if (windows_h.CreateSymbolicLinkA(new_path, path, 0) == 0) {
        return error.UnableToCreateSymlink;
    }
}
