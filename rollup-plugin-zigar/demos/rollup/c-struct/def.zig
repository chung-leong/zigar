const c = @cImport(
    @cInclude("def.h"),
);

pub const Struct = c.Struct;
