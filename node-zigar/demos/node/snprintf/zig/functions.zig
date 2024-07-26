const c = @cImport(
    @cInclude("stdio.h"),
);

pub const snprintf = c.snprintf;
pub const sprintf = c.sprintf;
pub const printf = c.printf;
pub const fprintf = c.fprintf;
pub const fopen = c.fopen;
pub const fclose = c.fclose;

pub const I8 = i8;
pub const I16 = i16;
pub const I32 = i32;
pub const I64 = i64;
pub const Usize = usize;
pub const F64 = f64;
pub const CStr = [*:0]const u8;
