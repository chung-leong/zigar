const std = @import("std");
const ziglua = @import("ziglua");

var gpa = std.heap.GeneralPurposeAllocator(.{}){};
const allocator = gpa.allocator();
const LuaOpaque = opaque {};
const LuaOpaquePtr = *align(@alignOf(ziglua.Lua)) LuaOpaque;

pub fn createLua() !LuaOpaquePtr {
    const lua = try ziglua.Lua.init(&allocator);
    lua.openLibs();
    return @ptrCast(lua);
}

pub fn runLuaCode(opaque_ptr: LuaOpaquePtr, code: [:0]const u8) !void {
    const lua: *ziglua.Lua = @ptrCast(opaque_ptr);
    try lua.loadString(code);
    try lua.protectedCall(0, 0, 0);
}

pub fn freeLua(opaque_ptr: LuaOpaquePtr) void {
    const lua: *ziglua.Lua = @ptrCast(opaque_ptr);
    lua.deinit();
}
