pub const Slice = []u32;

pub fn fifth(slice: []u32) u32 {
    return if (slice.len >= 5) slice[4] else 0;
}
