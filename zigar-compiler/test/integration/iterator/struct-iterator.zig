const Struct = struct {
    index: i32,

    pub fn next(self: *@This()) ?[]const u8 {
        defer self.index += 1;
        return switch (self.index) {
            0 => "apple",
            1 => "orange",
            2 => "lemon",
            else => return null,
        };
    }
};

pub fn getStruct() Struct {
    return .{ .index = 0 };
}
