pub const Point = struct {
    x: u32,
    y: u32,
};
pub const Points = []Point;

pub fn memset(ptr: *anyopaque, byte_count: usize, value: u8) void {
    const bytes: [*]u8 = @ptrCast(ptr);
    for (0..byte_count) |index| {
        bytes[index] = value;
    }
}
