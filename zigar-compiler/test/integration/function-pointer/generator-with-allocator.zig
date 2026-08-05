const std = @import("std");

const zigar = @import("zigar");

pub const JSError = error{Unexpected};
pub const Avenger = struct {
    real_name: []const u8,
    superhero_name: []const u8,
    age: u32,
};

pub const Callback = *const fn (
    generator: zigar.function.Generator(JSError!?Avenger, true),
) void;

var gpa = std.heap.GeneralPurposeAllocator(.{}){};

pub fn receive(allocator: std.mem.Allocator, _: ?*anyopaque, arg: JSError!?Avenger) bool {
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
    f(.{ .allocator = gpa.allocator(), .callback = receive });
}
