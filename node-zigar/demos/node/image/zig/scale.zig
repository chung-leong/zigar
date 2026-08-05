const std = @import("std");

const zigar = @import("zigar");

pub fn scale(image_in: zigar.image.Any(.ro), image_out: zigar.image.Any(.rw)) void {
    const Pixel = @Vector(4, f32);
    inline for (zigar.image.formats) |tag| {
        if (image_in == tag and image_out == tag) {
            const in = image_in.getField(tag);
            const out = image_out.getField(tag);
            const x_adv: f32 = in.getWidthAsFloat() / out.getWidthAsFloat();
            const y_adv: f32 = in.getHeightAsFloat() / out.getHeightAsFloat();
            var coord: @Vector(2, f32) = undefined;
            coord[1] = 0.5;
            for (0..out.getHeight()) |y| {
                coord[0] = 0.5;
                for (0..out.getWidth()) |x| {
                    const pixel = in.sampleLinear(Pixel, coord);
                    out.setPixel(Pixel, x, y, pixel);
                    coord[0] += x_adv;
                }
                coord[1] += y_adv;
            }
        }
    }
}
