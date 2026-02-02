const c = @cImport({
    @cInclude("stdio.h");
});

pub const fwrite = c.fwrite;
pub const fopen = c.fopen;
pub const fclose = c.fclose;
