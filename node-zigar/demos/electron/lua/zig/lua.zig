const std = @import("std");

const zlua = @import("zlua");

var gpa = std.heap.GeneralPurposeAllocator(.{}){};
const allocator = gpa.allocator();
const LuaOpaque = opaque {};
const LuaOpaquePtr = *align(@alignOf(zlua.Lua)) LuaOpaque;

pub fn createLua() !LuaOpaquePtr {
    const lua = try zlua.Lua.init(allocator);
    lua.openLibs();
    return @ptrCast(lua);
}

pub fn runLuaCode(opaque_ptr: LuaOpaquePtr, code: [:0]const u8) !void {
    const lua: *zlua.Lua = @ptrCast(opaque_ptr);
    try lua.loadString(code);
    try lua.protectedCall(.{});
}

pub fn freeLua(opaque_ptr: LuaOpaquePtr) void {
    const lua: *zlua.Lua = @ptrCast(opaque_ptr);
    lua.deinit();
}
