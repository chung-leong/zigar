const c = @cImport({
    @cInclude("stdio.h");
});

pub fn rename(path: [*:0]const u8, new_path: [*:0]const u8) !void {
    const result = c.rename(path, new_path);
    if (result < 0) return error.UnableToRenameFile;
}
