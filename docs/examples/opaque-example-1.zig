const std = @import("std");

const Context = struct {
    number1: i32,
    number2: i32,
    number3: i32,
};
const OpaquePtr = *align(@alignOf(Context)) opaque {};

pub fn startContext(allocator: std.mem.Allocator) !OpaquePtr {
    const ctx = try allocator.create(Context);
    ctx.* = .{ .number1 = 10, .number2 = 20, .number3 = 30 };
    return @ptrCast(ctx);
}

pub fn showContext(opaque_ptr: OpaquePtr) void {
    const ctx: *Context = @ptrCast(opaque_ptr);
    std.debug.print("{any}\n", .{ctx.*});
}
