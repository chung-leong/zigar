const std = @import("std");

const zigar = @import("zigar");

pub fn apply(image_in: zigar.image.Any(.ro), image_out: zigar.image.Any(.rw), intensity: f32) void {
    const Pixel = @Vector(4, f32);
    inline for (zigar.image.formats) |tag| {
        if (image_in == tag and image_out == tag) {
            const in = image_in.getField(tag);
            const out = image_out.getField(tag);
            var coord: @Vector(2, f32) = undefined;
            coord[1] = 0.5;
            for (0..out.getHeight()) |y| {
                coord[0] = 0.5;
                for (0..out.getWidth()) |x| {
                    const yiq_matrix: [4]@Vector(4, f32) = .{
                        .{ 0.299, 0.596, 0.212, 0.0 },
                        .{ 0.587, -0.275, -0.523, 0.0 },
                        .{ 0.114, -0.321, 0.311, 0.0 },
                        .{ 0.0, 0.0, 0.0, 1.0 },
                    };
                    const inverse_yiq: [4]@Vector(4, f32) = .{
                        .{ 1.0, 1.0, 1.0, 0.0 },
                        .{ 0.956, -0.272, -1.1, 0.0 },
                        .{ 0.621, -0.647, 1.7, 0.0 },
                        .{ 0.0, 0.0, 0.0, 1.0 },
                    };
                    const rgba_color = in.sampleNearest(@Vector(4, f32), coord);
                    var yiqa_color = @"M * V"(yiq_matrix, rgba_color);
                    yiqa_color[1] = intensity;
                    yiqa_color[2] = 0.0;
                    const pixel = @"M * V"(inverse_yiq, yiqa_color);
                    out.setPixel(Pixel, x, y, pixel);
                    coord[0] += 1;
                }
                coord[1] += 1;
            }
        }
    }
}

fn @"M * V"(m1: anytype, v2: anytype) @TypeOf(v2) {
    const ar = @typeInfo(@TypeOf(m1)).array;
    var t1: @TypeOf(m1) = undefined;
    inline for (m1, 0..) |column, c| {
        inline for (0..ar.len) |r| {
            t1[r][c] = column[r];
        }
    }
    var result: @TypeOf(v2) = undefined;
    inline for (t1, 0..) |column, c| {
        result[c] = @reduce(.Add, column * v2);
    }
    return result;
}
