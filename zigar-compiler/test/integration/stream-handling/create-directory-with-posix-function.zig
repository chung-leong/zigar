const c = @cImport({
    @cInclude("unistd.h");
});

pub fn create(path: [*:0]const u8) !void {
    const result = c.mkdir(path, 0);
    if (result != 0) return error.UnableToMakeDir;
}
