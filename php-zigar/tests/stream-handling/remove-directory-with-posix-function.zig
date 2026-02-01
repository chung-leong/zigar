const c = @cImport({
    @cInclude("unistd.h");
});

pub fn remove(path: [*:0]const u8) !void {
    const result = c.rmdir(path);
    if (result != 0) return error.UnableToRemoveDir;
}
