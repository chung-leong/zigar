const std = @import("std");

const Struct = struct {
    index: i32,

    fn next(self: *@This()) ?[]const u8 {
        defer self.index += 1;
        return switch (self.index) {
            0 => "apple",
            1 => "orange",
            2 => "lemon",
            else => return null,
        };
    }
};

const Opaque = opaque {
    pub fn next(self: *@This()) ?[]const u8 {
        const ptr: *Struct = @ptrCast(@alignCast(self));
        return ptr.next();
    }
};

pub fn getOpaque(allocator: std.mem.Allocator) !*Opaque {
    const ptr = try allocator.create(Struct);
    ptr.* = .{ .index = 1 };
    return @ptrCast(@alignCast(ptr));
}
