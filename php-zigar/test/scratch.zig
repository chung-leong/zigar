const std = @import("std");

const zigar = @import("zigar");

pub fn printInfo(image: zigar.image.Gd) void {
    std.debug.print("Hello\n", .{});
    const gd = image.cast();
    _ = &gd;
    std.debug.print("width = {d}, height = {d}\n", .{
        image.getWidth(),
        image.getHeight(),
    });
    const pixel = image.sampleLinear(@Vector(4, f32), @Vector(2, f32){ 100, 200 });
    std.debug.print("pixel = {}\n", .{pixel});
}
