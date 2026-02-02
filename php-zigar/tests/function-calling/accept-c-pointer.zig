const std = @import("std");

pub const Object = extern struct {
    a: i32,
    b: i32,
};

pub fn print(objects: [*c]const Object, count: usize) void {
    for (0..count) |index| {
        std.debug.print("{any}\n", .{objects[index]});
    }
}
