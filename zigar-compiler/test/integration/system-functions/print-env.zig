const std = @import("std");
pub const get = std.process.getEnvVarOwned;

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

const module_ns = @This();
pub const @"meta(zigar)" = struct {
    pub fn isDeclString(T: type, field: std.meta.DeclEnum(T)) bool {
        return (T == module_ns and field == .get);
    }
};
