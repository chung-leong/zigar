const std = @import("std");

const zigar = @import("zigar");

pub fn render(image_out: zigar.image.Any) void {
    const Pixel = @Vector(4, f32);
    inline for (zigar.image.Any.tags) |tag| {
        if (image_out == tag) {
            const out = image_out.getField(tag);
            const width = out.getWidth();
            const height = out.getHeight();
            const half = height / 2;
            for (0..height) |y| {
                for (0..width) |x| {
                    const color: Pixel = switch (y > half) {
                        true => .{ 1, 0, 0, 1 },
                        false => .{ 1, 1, 1, 1 },
                    };
                    out.setPixel(Pixel, @truncate(x), @truncate(y), color);
                }
            }
        }
    }
}
