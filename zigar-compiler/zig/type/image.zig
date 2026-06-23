const std = @import("std");
const builtin = @import("builtin");

const util = @import("util.zig");

const is_wasm = builtin.target.cpu.arch.isWasm();
const runtime_safety = builtin.mode == .Debug or builtin.mode == .ReleaseSafe;

pub const Access = enum { ro, rw };
pub const Format = enum {
    web,
    web_hdr,
    gd,

    pub fn Type(self: @This(), acc: Access) type {
        return switch (self) {
            .web => WebImage(acc, .@"rgba-unorm8"),
            .web_hdr => WebImage(acc, .@"rgba-float16"),
            .gd => if (!is_wasm) GdImage(acc) else void,
        };
    }
};

pub const formats = init: {
    const fields = std.meta.fields(Format);
    var count: usize = 0;
    for (fields) |field| {
        if (@field(Format, field.name).Type(.rw) != void) count += 1;
    }
    var list: [count]Format = undefined;
    var index: usize = 0;
    for (fields) |field| {
        if (@field(Format, field.name).Type(.rw) != void) {
            list[index] = @field(Format, field.name);
            index += 1;
        }
    }
    break :init list;
};

pub fn AnyImage(acc: Access) type {
    return union(Format) {
        web: Format.web.Type(acc),
        web_hdr: Format.web_hdr.Type(acc),
        gd: Format.gd.Type(acc),

        pub const internal_type: util.InternalType = .any_image;

        pub fn getField(self: @This(), comptime tag: Format) tag.Type(acc) {
            return @field(self, @tagName(tag));
        }
    };
}

const PixelFormat = enum { @"rgba-unorm8", @"rgba-float16" };

pub fn WebImage(acc: Access, format: PixelFormat) type {
    return struct {
        data: switch (acc) {
            .ro => []const Pixel,
            .rw => []Pixel,
        },
        width: u32,
        height: u32,
        colorSpace: enum { srgb, @"display-p3" } = .srgb,

        pub const internal_type: util.InternalType = .web_image;
        pub const pixel_format = format;
        pub const Pixel = switch (format) {
            .@"rgba-unorm8" => [4]u8,
            .@"rgba-float16" => [4]f16,
        };

        pub fn getWidth(self: *const @This()) usize {
            return self.width;
        }

        pub fn getWidthAsFloat(self: *const @This()) f32 {
            return @floatFromInt(self.width);
        }

        pub fn getHeight(self: *const @This()) usize {
            return self.height;
        }

        pub fn getHeightAsFloat(self: *const @This()) f32 {
            return @floatFromInt(self.height);
        }

        pub fn getPixel(self: *const @This(), comptime T: type, x: usize, y: usize) T {
            const len = channels(T);
            const index = (y * self.width) + x;
            if (runtime_safety and index >= self.data.len) {
                @panic("Mismatch between data length and image dimensions");
            }
            return switch (format) {
                .@"rgba-unorm8" => convert: {
                    const int_vec: @Vector(4, u8) = self.data[index];
                    const multiplier = comptime calc: {
                        const one: T = @splat(1.0);
                        const max: T = @splat(@floatFromInt(std.math.maxInt(u8)));
                        break :calc one / max;
                    };
                    const float_vec: T = switch (len) {
                        1 => @floatFromInt(@shuffle(u8, int_vec, undefined, @Vector(1, i32){0})),
                        2 => @floatFromInt(@shuffle(u8, int_vec, undefined, @Vector(2, i32){ 0, 3 })),
                        3 => @floatFromInt(@shuffle(u8, int_vec, undefined, @Vector(3, i32){ 0, 1, 2 })),
                        4 => @floatFromInt(int_vec),
                        else => unreachable,
                    };
                    break :convert float_vec * multiplier;
                },
                .@"rgba-float16" => convert: {
                    const src_vec: @Vector(4, f16) = self.data[index];
                    const dst_vec: T = switch (len) {
                        1 => @floatCast(@shuffle(f16, src_vec, undefined, @Vector(1, i32){0})),
                        2 => @floatCast(@shuffle(f16, src_vec, undefined, @Vector(2, i32){ 0, 3 })),
                        3 => @floatCast(@shuffle(f16, src_vec, undefined, @Vector(3, i32){ 0, 1, 2 })),
                        4 => @floatCast(src_vec),
                        else => unreachable,
                    };
                    break :convert dst_vec;
                },
            };
        }

        pub fn setPixel(self: *const @This(), comptime T: type, x: usize, y: usize, pixel: T) void {
            if (acc == .ro) unreachable;
            const E = Child(T);
            const len = channels(T);
            const index = (y * self.width) + x;
            if (runtime_safety and index >= self.data.len) {
                @panic("Mismatch between data length and image dimensions");
            }
            const im_pixel: Pixel = switch (format) {
                .@"rgba-unorm8" => convert: {
                    const min: T = @splat(0.0);
                    const max: T = @splat(@floatFromInt(std.math.maxInt(u8)));
                    // expand to int range (1.0 to 255.0)
                    const float_vec_wo_min_max = pixel * max;
                    // apply minimum constraint
                    const float_vec_wo_max = @select(E, float_vec_wo_min_max > min, float_vec_wo_min_max, min);
                    // apply maximum constraint
                    const float_vec = @select(E, float_vec_wo_max < max, float_vec_wo_max, max);
                    const int_vec: @Vector(4, u8) = switch (len) {
                        1 => @intFromFloat(@shuffle(E, float_vec, max, @Vector(4, i32){ 0, 0, 0, -1 })),
                        2 => @intFromFloat(@shuffle(E, float_vec, undefined, @Vector(4, i32){ 0, 0, 0, 1 })),
                        3 => @intFromFloat(@shuffle(E, float_vec, max, @Vector(4, i32){ 0, 1, 2, -1 })),
                        4 => @intFromFloat(float_vec),
                        else => unreachable,
                    };
                    break :convert int_vec;
                },
                .@"rgba-float16" => convert: {
                    const max: T = @splat(1.0);
                    const dst_vec: @Vector(4, f16) = switch (len) {
                        1 => @floatCast(@shuffle(E, pixel, max, @Vector(4, i32){ 0, 0, 0, -1 })),
                        2 => @floatCast(@shuffle(E, pixel, undefined, @Vector(4, i32){ 0, 0, 0, 1 })),
                        3 => @floatCast(@shuffle(E, pixel, max, @Vector(4, i32){ 0, 1, 2, -1 })),
                        4 => @floatCast(pixel),
                        else => unreachable,
                    };
                    break :convert dst_vec;
                },
            };
            self.data[index] = im_pixel;
        }

        const Super = Parent(@This());

        pub fn sampleNearest(self: *const @This(), comptime T: type, coord: Coord(T)) T {
            return Super.sampleNearest(self, T, coord);
        }

        pub fn sampleLinear(self: *const @This(), comptime T: type, coord: Coord(T)) T {
            return Super.sampleLinear(self, T, coord);
        }
    };
}

pub fn GdImage(acc: Access) type {
    return struct {
        ptr: *anyopaque,

        pub const internal_type: util.InternalType = .gd_image;

        pub inline fn cast(self: *const @This()) *GdStruct {
            return @ptrCast(@alignCast(self.ptr));
        }

        pub fn getWidth(self: *const @This()) usize {
            const im = self.cast();
            return @intCast(im.sx);
        }

        pub fn getWidthAsFloat(self: *const @This()) f32 {
            const im = self.cast();
            return @floatFromInt(im.sx);
        }

        pub fn getHeight(self: *const @This()) usize {
            const im = self.cast();
            return @intCast(im.sy);
        }

        pub fn getHeightAsFloat(self: *const @This()) f32 {
            const im = self.cast();
            return @floatFromInt(im.sy);
        }

        pub fn getPixel(self: *const @This(), comptime T: type, x: usize, y: usize) T {
            const im = self.cast();
            const len = channels(T);
            const E = Child(T);
            const color = if (im.tpixels) |tpixels|
                tpixels[y][x]
            else if (im.pixels) |pixels|
                self.getPaletteColor(pixels[y][x])
            else
                unreachable;
            const color_u: c_uint = @bitCast(color);
            const r: u8 = @truncate((color_u & 0x00FF0000) >> 16);
            const g: u8 = @truncate((color_u & 0x0000FF00) >> 8);
            const b: u8 = @truncate((color_u & 0x000000FF) >> 0);
            const t: u8 = @truncate((color_u & 0x7F000000) >> 24);
            const a: u8 = 127 - t;
            const int_vec: @Vector(len, u8) = switch (len) {
                1 => .{r},
                2 => .{ r, a },
                3 => .{ r, g, b },
                4 => .{ r, g, b, a },
                else => unreachable,
            };
            const float_vec: T = @floatFromInt(int_vec);
            const multiplier = comptime calc: {
                const max_u8: E = @floatFromInt(std.math.maxInt(u8));
                const max_u7: E = @floatFromInt(std.math.maxInt(u7));
                const max: T = switch (len) {
                    1 => .{max_u8},
                    2 => .{ max_u8, max_u7 }, // alpha channel is only 7-bit
                    3 => .{ max_u8, max_u8, max_u8 },
                    4 => .{ max_u8, max_u8, max_u8, max_u7 },
                    else => unreachable,
                };
                const one: T = @splat(1.0);
                break :calc one / max;
            };
            return float_vec * multiplier;
        }

        pub fn setPixel(self: *const @This(), comptime T: type, x: usize, y: usize, pixel: T) void {
            if (acc == .ro) unreachable;
            const im = self.cast();
            const len = channels(T);
            const E = Child(T);
            const max_u8: E = @floatFromInt(std.math.maxInt(u8));
            const max_u7: E = @floatFromInt(std.math.maxInt(u7));
            const max: T = switch (len) {
                1 => .{max_u8},
                2 => .{ max_u8, max_u7 }, // alpha channel is only 7-bit
                3 => .{ max_u8, max_u8, max_u8 },
                4 => .{ max_u8, max_u8, max_u8, max_u7 },
                else => unreachable,
            };
            // expand to int range (1.0 to 255.0)
            const float_vec_wo_min_max = pixel * max;
            // apply maximum constraint
            const float_vec_wo_min = @select(E, float_vec_wo_min_max < max, float_vec_wo_min_max, max);
            // apply minimum constraint
            const min: T = @splat(0.0);
            const float_vec = @select(E, float_vec_wo_min > min, float_vec_wo_min, min);
            const int_vec: @Vector(4, u8) = switch (len) {
                1 => @intFromFloat(@shuffle(E, float_vec, max, @Vector(4, i32){ 0, 0, 0, -1 })),
                2 => @intFromFloat(@shuffle(E, float_vec, undefined, @Vector(4, i32){ 0, 0, 0, 1 })),
                3 => @intFromFloat(@shuffle(E, float_vec, max, @Vector(4, i32){ 0, 1, 2, -1 })),
                4 => @intFromFloat(float_vec),
                else => unreachable,
            };
            const r: c_int = int_vec[0];
            const g: c_int = int_vec[1];
            const b: c_int = int_vec[2];
            const a: c_int = int_vec[3];
            const t: c_int = 127 - a;
            if (im.tpixels) |tpixels| {
                const color = (r << 16) | (g << 8) | (b << 0) | (t << 24);
                tpixels[y][x] = color;
            } else if (im.pixels) |pixels| {
                const color_index = self.findClosestPaletteColor(r, g, b, t);
                pixels[y][x] = color_index;
            }
        }

        const Super = Parent(@This());

        pub fn sampleNearest(self: *const @This(), comptime T: type, coord: Coord(T)) T {
            return Super.sampleNearest(self, T, coord);
        }

        pub fn sampleLinear(self: *const @This(), comptime T: type, coord: Coord(T)) T {
            return Super.sampleLinear(self, T, coord);
        }

        inline fn component(color: c_int, mask: c_uint, comptime shift: u6) u8 {
            const value: c_uint = @bitCast(color);
            return @truncate((value & mask) >> shift);
        }

        fn getPaletteColor(self: *const @This(), color_index: c_int) c_int {
            const im = self.cast();
            const index: usize = @intCast(color_index);
            const r: c_int = im.red[index];
            const g: c_int = im.green[index];
            const b: c_int = im.blue[index];
            const t: c_int = im.alpha[index];
            return (r << 16) | (g << 8) | (b << 0) | (t << 24);
        }

        fn findClosestPaletteColor(self: *const @This(), r: c_int, g: c_int, b: c_int, a: c_int) u8 {
            const im = self.cast();
            var color_index: usize = undefined;
            var min_dist: c_int = undefined;
            const len: usize = @intCast(im.colors_total);
            for (0..len) |i| {
                const rd = im.red[i] - r;
                const gd = im.green[i] - g;
                const bd = im.blue[i] - b;
                const ad = im.alpha[i] - a;
                const dist = rd * rd + gd * gd + bd * bd + ad * ad;
                if (i == 0 or dist < min_dist) {
                    if (dist == 0) return @intCast(i);
                    min_dist = dist;
                    color_index = i;
                }
            }
            if (len < GdStruct.max_colors) {
                // allocate new color
                color_index = len;
                im.red[color_index] = r;
                im.green[color_index] = g;
                im.blue[color_index] = b;
                im.alpha[color_index] = a;
                im.open[color_index] = 0;
                im.colors_total += 1;
            }
            return @intCast(color_index);
        }
    };
}

const GdStruct = extern struct {
    const AlphaBlend = enum(c_uint) { replace, alpha_blend, normal, overlay, multiply };
    const Interlace = enum(c_uint) { no, use };
    const Interpolation = enum(c_uint) {
        default,
        bell,
        bessel,
        bilinear_fixed,
        bicubic,
        bicubic_fixed,
        blackman,
        box,
        bspline,
        catmullrom,
        gaussian,
        generalized_cubic,
        hermite,
        hamming,
        hanning,
        mitchell,
        nearest_neighbour,
        power,
        quadratic,
        sinc,
        triangle,
        weighted4,
    };
    const InterpolationFn = ?*const fn (f64) callconv(.c) f64;
    const SaveAlpha = enum(c_uint) { no, save };
    const TrueColor = enum(c_uint) { palette, yes };
    const max_colors = 256;

    pixels: ?[*][*]u8,
    sx: c_int,
    sy: c_int,
    colors_total: c_int,
    red: [max_colors]c_int,
    green: [max_colors]c_int,
    blue: [max_colors]c_int,
    open: [max_colors]c_int,
    transparent: c_int,
    poly_ints: ?[*]c_int,
    poly_allocated: c_int,
    brush: ?*@This(),
    tile: ?*@This(),
    brush_color_map: [max_colors]c_int,
    tile_color_map: [max_colors]c_int,
    style_length: c_int,
    style_pos: c_int,
    style: ?[*]c_int,
    interlace: Interlace,
    thick: c_int,
    alpha: [max_colors]c_int,
    true_color: TrueColor,
    tpixels: ?[*][*]c_int,
    alpha_blending: AlphaBlend,
    save_alpha: SaveAlpha,
    aa: c_int,
    aa_color: c_int,
    aa_dont_blend: c_int,
    cx1: c_int,
    cy1: c_int,
    cx2: c_int,
    cy2: c_int,
    res_x: c_uint,
    res_y: c_uint,
    interpolation: Interpolation,
    interpolation_fn: ?*const InterpolationFn,
};

fn Child(comptime T: type) type {
    return @typeInfo(T).vector.child;
}

fn Coord(comptime T: type) type {
    return @Vector(2, Child(T));
}

fn Parent(comptime Self: type) type {
    return struct {
        inline fn sampleNearest(self: *const Self, comptime T: type, coord: Coord(T)) T {
            const width = self.getWidth();
            const height = self.getHeight();
            const coord_i: @Vector(2, i32) = @intFromFloat(@floor(coord));
            // rely on integer overflow to filter out negative coordinates
            const x, const y = @as(@Vector(2, u32), @bitCast(coord_i));
            return switch (x < width and y < height) {
                true => self.getPixel(T, x, y),
                false => @splat(0),
            };
        }

        inline fn sampleLinear(self: *const Self, comptime T: type, coord: Coord(T)) T {
            const len = channels(T);
            const c = coord - @as(Coord(T), @splat(0.5));
            const c0 = @floor(c);
            const f0 = c - c0;
            const f1 = @as(Coord(T), @splat(1)) - f0;
            const w: @Vector(4, f32) = .{ f1[0] * f1[1], f0[0] * f1[1], f1[0] * f0[1], f0[0] * f0[1] };
            const p00 = self.sampleNearest(T, c0);
            const p10 = self.sampleNearest(T, c0 + Coord(T){ 1, 0 });
            const p01 = self.sampleNearest(T, c0 + Coord(T){ 0, 1 });
            const p11 = self.sampleNearest(T, c0 + Coord(T){ 1, 1 });
            var result: T = undefined;
            inline for (0..len) |i| {
                const p: @Vector(4, f32) = .{ p00[i], p10[i], p01[i], p11[i] };
                result[i] = @reduce(.Add, p * w);
            }
            return result;
        }
    };
}

fn channels(comptime T: type) comptime_int {
    switch (@typeInfo(T)) {
        .vector => |ve| if (@typeInfo(ve.child) == .float) {
            if (ve.len > 4) {
                @compileError("Unsupported number of channels: " ++ ve.len);
            }
            return ve.len;
        },
        else => {},
    }
    @compileError("Expecting float vector type, received: " ++ @typeName(T));
}
