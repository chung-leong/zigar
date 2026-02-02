const c = @cImport({
    @cInclude("stdio.h");
});

pub const fread = c.fread;
pub const fopen = c.fopen;
pub const fclose = c.fclose;
