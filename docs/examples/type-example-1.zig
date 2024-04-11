const std = @import("std");

pub const Uint32 = u32;

pub fn printTypeName(comptime T: type) void {
    std.debug.print("{s}\n", .{@typeName(T)});
}
