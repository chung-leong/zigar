const std = @import("std");
const zigar = @import("zigar");

pub const JSError = error{Unexpected};
pub const Avenger = struct {
    real_name: []const u8,
    superhero_name: []const u8,
    age: u32,
};

pub const Callback = *const fn (
    allocator: std.mem.Allocator,
    generator: zigar.function.Generator(JSError!?Avenger),
) void;

const allocator = zigar.mem.getDefaultAllocator();

pub fn receive(_: ?*anyopaque, arg: JSError!?Avenger) bool {
    if (arg) |object_maybe| {
        if (object_maybe) |object| {
            std.debug.print("real_name = {s}, superhero_name = {s}, age = {d}\n", .{
                object.real_name,
                object.superhero_name,
                object.age,
            });
            allocator.free(object.real_name);
            allocator.free(object.superhero_name);
        }
    } else |err| {
        std.debug.print("error = {s}\n", .{@errorName(err)});
    }
    return true;
}

pub fn call(f: Callback) void {
    f(allocator, .{ .callback = receive });
}
