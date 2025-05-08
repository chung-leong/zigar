pub fn getBytes() []const u8 {
    return "Hello";
}

pub fn getText() []const u8 {
    return "Hello";
}

pub const @"meta(zigar)" = struct {
    pub fn isRetvalString(comptime func: anytype) bool {
        return func == getText;
    }
};
