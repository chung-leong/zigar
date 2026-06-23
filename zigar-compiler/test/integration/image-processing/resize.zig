const std = @import("std");

const zigar = @import("zigar");

pub fn resize(image_in: zigar.image.Any(.ro), image_out: zigar.image.Any(.rw)) void {
    const Pixel = @Vector(4, f32);
    inline for (zigar.image.formats) |tag| {
        if (image_in == tag and image_out == tag) {
            const in = image_in.getField(tag);
            const out = image_out.getField(tag);
            const in_width = in.getWidth();
            const in_height = in.getHeight();
            const out_width = out.getWidth();
            const out_height = out.getHeight();
            const x_adv: f32 = @as(f32, @floatFromInt(in_width)) / @as(f32, @floatFromInt(out_width));
            const y_adv: f32 = @as(f32, @floatFromInt(in_height)) / @as(f32, @floatFromInt(out_height));
            var coord: @Vector(2, f32) = undefined;
            coord[1] = 0.5;
            for (0..out_height) |y| {
                coord[0] = 0.5;
                for (0..out_width) |x| {
                    const pixel = in.sampleLinear(Pixel, coord);
                    out.setPixel(Pixel, @truncate(x), @truncate(y), pixel);
                    coord[0] += x_adv;
                }
                coord[1] += y_adv;
            }
        }
    }
}
