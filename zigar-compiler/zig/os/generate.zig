const std = @import("std");

pub fn main() !void {
    try generate(std.c, "std.c", "c.zig");
    const names: [8][]const u8 = .{
        "darwin",
        "dragonfly",
        "freebsd",
        "haiku",
        "linux",
        "netbsd",
        "openbsd",
        "solaris",
    };
    inline for (names) |name| {
        try generate(@field(std.os, name), "std.os." ++ name, name ++ ".zig");
    }
}

pub fn generate(comptime target: anytype, comptime target_name: []const u8, comptime file_name: []const u8) !void {
    const dir = std.fs.cwd();
    std.debug.print("Creating {s}...\n", .{file_name});
    var file = try dir.createFile(file_name, .{});
    defer file.close();
    var code = file.writer();
    try code.print("const std = @import(\"std\");\n\n", .{});
    try code.print("pub const target = {s};\n\n", .{target_name});
    try code.print("pub fn with(comptime substitutes: anytype) type {{\n", .{});
    try code.print("\treturn struct {{\n", .{});
    inline for (@typeInfo(target).Struct.decls) |decl| {
        if (decl.is_pub) {
            try code.print("\t\tpub const {s} = if (@hasDecl(substitutes, \"{s}\")) ", .{ decl.name, decl.name });
            try code.print("substitutes.{s} ", .{decl.name});
            try code.print("else ", .{});
            try code.print("{s}.{s};\n", .{ target_name, decl.name });
        }
    }
    try code.print("\t}};\n", .{});
    try code.print("}}\n", .{});
    std.debug.print("\n", .{});
}
