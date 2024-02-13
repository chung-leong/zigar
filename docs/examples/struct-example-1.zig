pub const User = struct {
    id: u64,
    name: []const u8,
    email: []const u8,
    age: ?u32 = null,
    popularity: i64 = -1,
};
