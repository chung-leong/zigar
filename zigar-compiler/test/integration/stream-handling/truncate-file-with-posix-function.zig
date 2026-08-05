const c = @import("c");

pub fn truncate(path: [*:0]const u8, len: c_long) !void {
    if (c.truncate(path, len) != 0) return error.UnableToTruncate;
}
