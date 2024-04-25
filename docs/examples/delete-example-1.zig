pub const User = struct {
    first_name: []const u8,
    last_name: []const u8,
};

pub var current_user: ?User = null;
