const std = @import("std");

pub var optional: ?[]const u8 = "Hello";
pub var alt_text: []const u8 = "World";

pub fn print() void {
    std.debug.print("{any}\n", .{optional});
}

const Self = @This();

pub const @"meta(zigar)" = struct {
    pub fn isFieldString(comptime T: type, comptime name: []const u8) bool {
        return T == Self and std.mem.eql(u8, name, "optional");
    }
};
