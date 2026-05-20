const std = @import("std");

const zigar = @import("zigar");

pub fn render(image_out: zigar.image.Any) void {
    const Pixel = @Vector(4, f32);
    switch (image_out) {
        inline else => |*im| {
            if (@TypeOf(im.*) == void) return;
            const width = im.getWidth();
            const height = im.getHeight();
            const half = height / 2;
            for (0..height) |y| {
                for (0..width) |x| {
                    const color: Pixel = switch (y > half) {
                        true => .{ 1, 0, 0, 1 },
                        false => .{ 1, 1, 1, 1 },
                    };
                    im.setPixel(Pixel, @truncate(x), @truncate(y), color);
                }
            }
        },
    }
}
