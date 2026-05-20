const std = @import("std");

const zigar = @import("zigar");

pub fn resize(image_in: zigar.image.Any, image_out: zigar.image.Any) void {
    const Pixel = @Vector(4, f32);
    switch (image_out) {
        inline else => |*im_out, tag| {
            if (@TypeOf(im_out.*) == void) return;
            if (image_in != tag) return;
            const im_in: @TypeOf(im_out) = &@field(image_in, @tagName(tag));
            const in_width = im_in.getWidth();
            const in_height = im_in.getHeight();
            const out_width = im_out.getWidth();
            const out_height = im_out.getHeight();
            const x_adv: f32 = @as(f32, @floatFromInt(in_width)) / @as(f32, @floatFromInt(out_width));
            const y_adv: f32 = @as(f32, @floatFromInt(in_height)) / @as(f32, @floatFromInt(out_height));
            var coord: @Vector(2, f32) = undefined;
            coord[1] = 0.5;
            for (0..out_height) |y| {
                coord[0] = 0.5;
                for (0..out_width) |x| {
                    const pixel = im_in.sampleLinear(Pixel, coord);
                    im_out.setPixel(Pixel, @truncate(x), @truncate(y), pixel);
                    coord[0] += x_adv;
                }
                coord[1] += y_adv;
            }
        },
    }
}
