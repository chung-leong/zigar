pub var int8: i8 = 127;
pub var uint8: u8 = 0;
pub var int16: i16 = -44;
pub var uint16: i16 = 44;
pub var int32: i32 = 1234;
pub var uint32: i32 = 34567;
pub var int64: i64 = 0x1FFF_FFFF_FFFF_FFFF;
pub var uint64: u64 = 0xFFFF_FFFF_FFFF_FFFF;

pub var int128: i128 = 1234;

pub var int4: i4 = 7;

pub const constant = 43;
var private: i32 = 123;
pub var variable: i32 = 0;

pub const int32Array4: [4]i32 = .{ 1, 2, 3, 4 };
pub const float64Array4x4: [4][4]f64 = .{
    .{ 1.1, 1.2, 1.3, 1.4 },
    .{ 2.1, 2.2, 2.3, 2.4 },
    .{ 3.1, 3.2, 3.3, 3.4 },
    .{ 4.1, 4.2, 4.3, 4.4 },
};
