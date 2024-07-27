const c = @cImport(
    @cInclude("stdio.h"),
);

pub const snprintf = c.snprintf;

pub const I8 = i8;
pub const U8 = u8;
pub const I16 = i16;
pub const U16 = u16;
pub const I32 = i32;
pub const U32 = u32;
pub const I64 = i64;
pub const U64 = u64;
pub const Usize = usize;
pub const F64 = f64;
pub const CStr = [*:0]const u8;
