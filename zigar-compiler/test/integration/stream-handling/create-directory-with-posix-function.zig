const c = @cImport({
    @cInclude("unistd.h");
});

pub fn create(path: [*:0]const u8) !void {
    const param_count = @typeInfo(@TypeOf(c.mkdir)).@"fn".params.len;
    const result = if (param_count == 1) c.mkdir(path) else c.mkdir(path, 0);
    if (result != 0) return error.UnableToMakeDir;
}
