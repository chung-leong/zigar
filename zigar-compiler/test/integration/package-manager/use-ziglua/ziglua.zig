const std = @import("std");
const ziglua = @import("ziglua");

pub fn run(code: [:0]const u8) !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    const allocator = gpa.allocator();
    defer _ = gpa.deinit();

    var lua = try ziglua.Lua.init(&allocator);
    defer lua.deinit();

    lua.openLibs();
    try lua.loadString(code);
    try lua.protectedCall(0, 0, 0);
}
