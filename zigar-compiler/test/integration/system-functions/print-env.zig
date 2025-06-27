const std = @import("std");

var gpa = std.heap.GeneralPurposeAllocator(.{}){};
const allocator = gpa.allocator();

pub fn print() !void {
    var env = try std.process.getEnvMap(allocator);
    defer env.deinit();
    var iter = env.iterator();
    while (iter.next()) |entry| {
        std.debug.print("{s} = {s}\n", .{ entry.key_ptr.*, entry.value_ptr.* });
    }
}
