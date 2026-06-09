const std = @import("std");

const zigar = @import("zigar");

var gpa: std.heap.DebugAllocator(.{}) = .init;

pub const allocator = gpa.allocator();

pub const PromiseCallback = fn (i32, zigar.function.Promise([]const u8)) void;
pub const GeneratorCallback = fn (i32, zigar.function.Generator(?[]const u8, false)) void;

fn resolve(ptr: *anyopaque, text: []const u8) void {
    std.debug.print("p: ptr = {x}, s = {s}\n", .{ @intFromPtr(ptr), text });
}

fn yield(ptr: *anyopaque, text: ?[]const u8) bool {
    std.debug.print("g: ptr = {x}, s = {?s}\n", .{ @intFromPtr(ptr), text });
    return true;
}

const some_ptr: *const anyopaque = &allocator;

pub fn callp(cb: *const PromiseCallback) void {
    std.debug.print("ptr = {x}\n", .{@intFromPtr(some_ptr)});
    const promise: zigar.function.Promise([]const u8) = .init(some_ptr, resolve);
    cb(12345, promise);
}

pub fn callg(cb: *const GeneratorCallback) void {
    std.debug.print("ptr = {x}\n", .{@intFromPtr(some_ptr)});
    const generator: zigar.function.Generator(?[]const u8, false) = .init(some_ptr, yield);
    cb(45678, generator);
}
