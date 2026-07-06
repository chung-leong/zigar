const c = @import("c");

pub fn getLength(s: []const u8) usize {
    return c.strlen(s.ptr);
}
