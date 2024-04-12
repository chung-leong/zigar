const std = @import("std");

const Context = struct {
    string: []const u8,
};
const OpaquePtr = *align(@alignOf(Context)) opaque {};

pub fn startContext(allocator: std.mem.Allocator) !OpaquePtr {
    const ctx = try allocator.create(Context);
    ctx.string = try allocator.dupe(u8, "This is a test");
    return @ptrCast(ctx);
}

pub fn showContext(opaque_ptr: OpaquePtr) void {
    const ctx: *Context = @ptrCast(opaque_ptr);
    std.debug.print("{s}\n", .{ctx.string});
}
