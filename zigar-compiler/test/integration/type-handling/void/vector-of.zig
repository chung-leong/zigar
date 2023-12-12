const std = @import("std");

pub var vector: @Vector(4, void) = .{ {}, {}, {}, {} };
pub const vector_const: @Vector(4, void) = .{ {}, {}, {}, {} };

pub fn print() void {
    std.debug.print("{any}\n", .{vector});
}
