const std = @import("std");

const zigar = @import("zigar");

pub const Test = struct {
    self: *@This(),
    number: i32,
};

pub fn create(allocator: std.mem.Allocator) !*Test {
    std.debug.print("creating...\n", .{});
    const t = try allocator.create(Test);
    t.* = .{ .self = t, .number = 1234 };
    return t;
}
