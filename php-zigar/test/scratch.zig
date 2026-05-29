const c = @cImport(
    @cInclude("stdio.h"),
);

pub const PtrVoid = *anyopaque;

pub const fopen = c.fopen;
pub const fclose = c.fclose;
pub const fwrite = c.fwrite;
