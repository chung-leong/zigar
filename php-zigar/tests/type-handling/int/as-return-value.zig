pub fn getInt8() i8 {
    return 127;
}

pub fn getUint8() u8 {
    return 0;
}

pub fn getInt16() i16 {
    return -44;
}
pub fn getUint16() u16 {
    return 44;
}

pub fn getInt32() i32 {
    return 1234;
}

pub fn getUint32() i32 {
    return 34567;
}

pub fn getInt64() i64 {
    return 0x1FFF_FFFF_FFFF_FFFF;
}

pub fn getUint64() u64 {
    return 0xFFFF_FFFF_FFFF_FFFF;
}

pub fn getIsize() isize {
    return 1000;
}

pub fn getUsize() usize {
    return switch (@bitSizeOf(usize)) {
        64 => 0x7FFF_FFFF_FFFF_FFFF,
        else => 0x7FFF_FFFF,
    };
}
