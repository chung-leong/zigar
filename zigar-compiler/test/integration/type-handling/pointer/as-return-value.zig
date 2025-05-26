pub fn getBytes() []const u8 {
    return "World";
}

pub fn getText() []const u8 {
    return "Hello";
}

pub const @"meta(zigar)" = struct {
    pub fn isRetvalString(comptime func: anytype) bool {
        return @TypeOf(func) == @TypeOf(getText) and func == getText;
    }
};
