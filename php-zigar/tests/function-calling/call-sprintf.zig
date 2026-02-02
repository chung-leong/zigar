const c = @cImport({
    @cInclude("stdio.h");
});

pub const sprintf = c.sprintf;

pub const Int = i32;
pub const Double = f64;
pub const Float = f32;
pub const StrPtr = [*:0]u8;
