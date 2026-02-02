pub fn fifth(slice: []u32) u32 {
    return if (slice.len >= 5) slice[4] else 0;
}

pub fn setFifth(slice: []u32, value: u32) void {
    slice[4] = value;
}
