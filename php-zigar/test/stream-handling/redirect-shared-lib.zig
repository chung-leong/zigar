const std = @import("std");

const zigar = @import("zigar");

pub fn use(path: []const u8) !void {
    var lib = try std.DynLib.open(path);
    defer lib.close();
    const print = lib.lookup(*const fn () void, "print") orelse return error.UnableToFindFunction;
    try zigar.io.redirect(print);
    print();
}
