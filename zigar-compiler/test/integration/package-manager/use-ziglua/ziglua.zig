const std = @import("std");
const lua_wrapper = @import("lua_wrapper");

pub fn run(code: [:0]const u8) !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    const allocator = gpa.allocator();
    defer _ = gpa.deinit();

    var lua = try lua_wrapper.Lua.init(allocator);
    defer lua.deinit();

    lua.openLibs();
    try lua.loadString(code);
    try lua.protectedCall(.{});
}
