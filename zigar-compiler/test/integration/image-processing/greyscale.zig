const std = @import("std");

const zigar = @import("zigar");

pub fn greyscale(image: zigar.image.Any(.rw)) void {
    inline for (zigar.image.formats) |tag| {
        if (image == tag) {
            const in = image.getField(tag);
            const out = in;
            for (0..out.getHeight()) |y| {
                for (0..out.getWidth()) |x| {
                    const pixel = in.getPixel(@Vector(4, f32), x, y);
                    const value = (pixel[0] + pixel[1] + pixel[2]) / 3;
                    out.setPixel(@Vector(4, f32), x, y, .{ value, value, value, pixel[3] });
                }
            }
        }
    }
}
