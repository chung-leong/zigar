const c = @cImport({
    @cInclude("stdio.h");
});

pub fn get(path: [*:0]const u8) !c_int {
    const f = c.fopen(path, "r");
    if (f == null) return error.UnableToOpenFile;
    defer _ = c.fclose(f);
    return c.fileno(f);
}
