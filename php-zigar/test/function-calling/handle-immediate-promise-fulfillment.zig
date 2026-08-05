const std = @import("std");

const zigar = @import("zigar");

pub fn fulfillInt(promise: zigar.function.Promise(i32)) void {
    promise.resolve(1234);
}

pub fn fulfillVoid(promise: zigar.function.Promise(void)) void {
    promise.resolve({});
}

const Rgba8888 = struct {
    r: u8,
    g: u8,
    b: u8,
    a: u8,
};

pub fn reduceColorDepthOfRgba8888ToArgb1555(promise: zigar.function.Promise(i32), input: []u8, alpha_threshold: u8) !void {
    if (input.len % 4 != 0) return error.InvalidInputSize;
    const rgba_image = std.mem.bytesAsSlice(Rgba8888, input);
    for (rgba_image) |*rgba| {
        rgba.r = rgba.r >> 3;
        rgba.g = rgba.g >> 3;
        rgba.b = rgba.b >> 3;
        rgba.a = if (rgba.a > alpha_threshold) 1 else 0;

        rgba.r = (rgba.r << 3) | (rgba.r >> 2);
        rgba.g = (rgba.g << 3) | (rgba.g >> 2);
        rgba.b = (rgba.b << 3) | (rgba.b >> 2);
        rgba.a = if (rgba.a > 0) 255 else 0;
    }
    promise.resolve(1234);
}
