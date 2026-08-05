const std = @import("std");

const Object = struct {
    a: i32,
    b: i32,
};

pub fn print(objects: [*]const Object, count: usize) void {
    for (0..count) |index| {
        std.debug.print("{any}\n", .{objects[index]});
    }
}
