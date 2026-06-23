const std = @import("std");

const zigar = @import("zigar");

const Parameters = struct {
    fill: f32 = 0.23,
    scale: f32 = 1.0,
    distort: @Vector(2, f32) = .{ 3.0, 1.7320508 },
    center: @Vector(2, f32) = .{ 120.0, 130.0 },
    minSolid: f32 = 0.005,
    maxSolid: f32 = 0.05,
};

pub fn apply(image_in: zigar.image.Any(.ro), image_out: zigar.image.Any(.rw), params: Parameters) void {
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
                    const fill = params.fill;
                    const scale = params.scale;
                    const distort = params.distort;
                    const center = params.center;
                    const minSolid = params.minSolid;
                    const maxSolid = params.maxSolid;

                    const sqr3: f32 = 1.7320508;
                    const halfPixel: @Vector(2, f32) = @Vector(2, f32){ 0.5, 0.5 };

                    var z: @Vector(2, f32) = @as(@Vector(2, f32), @splat(scale * 0.001)) * (coord - center);
                    const pixelCheck: f32 = z[0] * z[0] + z[1] * z[1];
                    z /= @as(@Vector(2, f32), @splat(pixelCheck));
                    var znew: @Vector(2, f32) = distort * z;
                    z = fract(znew);
                    z[1] *= sqr3;
                    znew = floor(znew);
                    var tmp: f32 = z[0] * z[0] + z[1] * z[1];
                    var alf: f32 = 0.0;
                    if (tmp < fill) {
                        alf = 1.0;
                        znew -= halfPixel;
                    } else {
                        tmp = z[0] - 0.5;
                        const tmp1 = tmp;
                        tmp = z[1] - 0.5 * sqr3;
                        const tmp2 = tmp;
                        if (tmp1 * tmp1 + tmp2 * tmp2 < fill) {
                            alf = 1.0;
                        } else {
                            tmp = z[1] - sqr3;
                            const tmp3 = tmp;
                            if (z[0] * z[0] + tmp3 * tmp3 < fill) {
                                alf = 1.0;
                                znew[0] -= 0.5;
                                znew[1] += 0.5;
                            } else {
                                tmp = z[0] - 1.0;
                                const tmp4 = tmp;
                                tmp = z[1] - sqr3;
                                const tmp5 = tmp;
                                if (tmp4 * tmp4 + tmp5 * tmp5 < fill) {
                                    alf = 1.0;
                                    znew += halfPixel;
                                } else {
                                    tmp = z[0] - 1.0;
                                    const tmp6 = tmp;
                                    if (tmp6 * tmp6 + z[1] * z[1] < fill) {
                                        alf = 1.0;
                                        znew[0] += 0.5;
                                        znew[1] += -0.5;
                                    }
                                }
                            }
                        }
                    }
                    z = znew / distort * @as(@Vector(2, f32), @splat(scale)) * @as(@Vector(2, f32), @splat(0.001));
                    z /= @as(@Vector(2, f32), @splat(z[0] * z[0] + z[1] * z[1]));
                    tmp = 1.0 - smoothStep(minSolid, maxSolid, pixelCheck / scale);
                    alf = max(tmp, alf);
                    var dst = in.sampleNearest(@Vector(4, f32), z + center);
                    dst[3] *= alf;
                    out.setPixel(Pixel, x, y, dst);
                    coord[0] += 1;
                }
                coord[1] += 1;
            }
        }
    }
}

fn floor(v: anytype) @TypeOf(v) {
    return @floor(v);
}

fn fract(v: anytype) @TypeOf(v) {
    return v - @floor(v);
}

fn max(v1: anytype, v2: anytype) @TypeOf(v1) {
    return switch (@typeInfo(@TypeOf(v2))) {
        .vector => @max(v1, v2),
        else => switch (@typeInfo(@TypeOf(v1))) {
            .vector => @max(v1, @as(@TypeOf(v1), @splat(v2))),
            else => @max(v1, v2),
        },
    };
}

fn smoothStep(edge0: anytype, edge1: anytype, v: anytype) @TypeOf(v) {
    return switch (@typeInfo(@TypeOf(edge0))) {
        .vector => calc: {
            const T = @TypeOf(v);
            const ET = @typeInfo(T).vector.child;
            const zeros: T = @splat(0);
            const ones: T = @splat(1);
            const twos: T = @splat(2);
            const threes: T = @splat(3);
            const value = (v - edge0) / (edge1 - edge0);
            const interpolated = value * value * (threes - twos * value);
            const result1 = @select(ET, v <= edge0, zeros, interpolated);
            const result2 = @select(ET, v >= edge1, ones, result1);
            break :calc result2;
        },
        else => switch (@typeInfo(@TypeOf(v))) {
            .vector => smoothStep(@as(@TypeOf(v), @splat(edge0)), @as(@TypeOf(v), @splat(edge1)), v),
            else => calc: {
                if (v <= edge0) {
                    break :calc 0;
                } else if (v >= edge1) {
                    break :calc 1;
                } else {
                    const value = (v - edge0) / (edge1 - edge0);
                    const interpolated = value * value * (3 - 2 * value);
                    break :calc interpolated;
                }
            },
        },
    };
}
