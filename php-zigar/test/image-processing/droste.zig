// Pixel Bender kernel "Droste" (translated using pb2zig)
const std = @import("std");

pub const kernel = struct {
    // constants
    const PI: f32 = 3.141592653;
    const TWOPI: f32 = 6.283185307;
    const PI180: f32 = 0.017453292;
    const I: @Vector(2, f32) = @Vector(2, f32){ 0.0, 1.0 };

    // kernel information
    pub const namespace = "com.subblue.filters";
    pub const vendor = "Tom Beddard";
    pub const version = 1;
    pub const description = "The Droste effect.";
    pub const parameters = .{
        .size = .{
            .type = @Vector(2, i32),
            .minValue = .{ 100, 100 },
            .maxValue = .{ 4000, 4000 },
            .defaultValue = .{ 680, 680 },
            .description = "Output size of final image",
        },
        .radiusInside = .{
            .type = f32,
            .minValue = 0.1,
            .maxValue = 100.0,
            .defaultValue = 25.0,
            .description = "The inner radius of the repeating annular",
        },
        .radiusOutside = .{
            .type = f32,
            .minValue = 1.0,
            .maxValue = 100.0,
            .defaultValue = 100.0,
            .description = "The outer radius of the repeating annular",
        },
        .periodicity = .{
            .type = f32,
            .minValue = -6.0,
            .maxValue = 6.0,
            .defaultValue = 1.0,
            .description = "The number of image the image is repeated on each level",
        },
        .strands = .{
            .type = i32,
            .minValue = -12,
            .maxValue = 12,
            .defaultValue = 1,
            .description = "The number of strands of the spiral",
        },
        .strandMirror = .{
            .type = bool,
            .defaultValue = true,
            .description = "Smoother repeating when using more than one strand",
        },
        .zoom = .{
            .type = f32,
            .minValue = 0.0,
            .maxValue = 30.0,
            .defaultValue = 0.0,
            .description = "Overall image magnification",
        },
        .rotate = .{
            .type = f32,
            .minValue = -360.0,
            .maxValue = 360.0,
            .defaultValue = 0.0,
            .description = "Overall image rotation",
        },
        .antialiasing = .{
            .type = i32,
            .minValue = 1,
            .maxValue = 3,
            .defaultValue = 1,
            .description = "Super sampling quality. Number of samples squared per pixel.",
        },
        .center = .{
            .type = @Vector(2, f32),
            .minValue = .{ -200.0, -200.0 },
            .maxValue = .{ 200.0, 200.0 },
            .defaultValue = .{ 0.0, 0.0 },
            .description = "Panning of the image in the output frame",
        },
        .centerShift = .{
            .type = @Vector(2, f32),
            .minValue = .{ -200.0, -200.0 },
            .maxValue = .{ 200.0, 200.0 },
            .defaultValue = .{ 0.0, 0.0 },
            .description = "Shift the centre of the spiral",
        },
        .backgroundRGBA = .{
            .type = @Vector(4, f32),
            .minValue = .{ 0.0, 0.0, 0.0, 0.0 },
            .maxValue = .{ 1.0, 1.0, 1.0, 1.0 },
            .defaultValue = .{ 0.0, 0.0, 0.0, 1.0 },
            .description = "Set the RGBA background colour",
        },
        .levels = .{
            .type = i32,
            .minValue = 1,
            .maxValue = 20,
            .defaultValue = 9,
            .description = "The number of repeating levels of the spiral",
        },
        .levelStart = .{
            .type = i32,
            .minValue = 1,
            .maxValue = 20,
            .defaultValue = 3,
            .description = "The starting spiral level",
        },
        .transparentInside = .{
            .type = bool,
            .defaultValue = true,
            .description = "Enable for images with transparent middle areas (such as a picture frame).",
        },
        .transparentOutside = .{
            .type = bool,
            .defaultValue = true,
            .description = "Enable for images with transparent areas around the outside.",
        },
        .twist = .{
            .type = bool,
            .defaultValue = true,
            .description = "Uncheck to unroll the circular annular of the image.",
        },
        .periodicityAuto = .{
            .type = bool,
            .defaultValue = false,
            .description = "Automatically set the ideal periodicity for the current radius settings.",
        },
        .rotatePolar = .{
            .type = f32,
            .minValue = -360.0,
            .maxValue = 360.0,
            .defaultValue = 0.0,
            .description = "Polar rotation",
        },
        .rotateSpin = .{
            .type = f32,
            .minValue = -360.0,
            .maxValue = 360.0,
            .defaultValue = 0.0,
            .description = "Spin mapped image. Best used with polar rotation.",
        },
        .hyperDroste = .{
            .type = bool,
            .defaultValue = false,
            .description = "Enable hyper droste effect.",
        },
        .fractalPoints = .{
            .type = i32,
            .minValue = 0,
            .maxValue = 10,
            .defaultValue = 0,
            .description = "Used by hyper droste option.",
        },
    };
    pub const inputImages = .{
        .src = .{ .channels = 4 },
    };
    pub const outputImages = .{
        .dst = .{ .channels = 4 },
    };

    // generic kernel instance type
    fn Instance(comptime InputStruct: type, comptime OutputStruct: type, comptime ParameterStruct: type) type {
        return struct {
            params: ParameterStruct,
            input: InputStruct,
            output: OutputStruct,
            outputCoord: @Vector(2, f32) = .{ 0.5, 0.5 },

            // output pixel
            dst: @Vector(4, f32) = undefined,

            // dependent variables
            r1: f32 = undefined,
            r2: f32 = undefined,
            p1: f32 = undefined,
            p2: f32 = undefined,
            w: f32 = undefined,
            h: f32 = undefined,
            sampleStep: f32 = undefined,
            sampleContribution: f32 = undefined,
            _shift: @Vector(2, f32) = undefined,
            _center: @Vector(2, f32) = undefined,
            _rotate: @Vector(2, f32) = undefined,
            _zoom: @Vector(2, f32) = undefined,
            xBounds: @Vector(2, f32) = undefined,
            yBounds: @Vector(2, f32) = undefined,
            xyMiddle: @Vector(2, f32) = undefined,
            minDimension: @Vector(2, f32) = undefined,
            imageSpin: [2]@Vector(2, f32) = undefined,
            tileBasedOnTransparency: bool = undefined,

            // functions defined in kernel
            pub fn evaluateDependents(self: *@This()) void {
                const size = self.params.size;
                const radiusInside = self.params.radiusInside;
                const radiusOutside = self.params.radiusOutside;
                const periodicity = self.params.periodicity;
                const strands = self.params.strands;
                const zoom = self.params.zoom;
                const rotate = self.params.rotate;
                const antialiasing = self.params.antialiasing;
                const center = self.params.center;
                const centerShift = self.params.centerShift;
                const transparentInside = self.params.transparentInside;
                const transparentOutside = self.params.transparentOutside;
                const twist = self.params.twist;
                const periodicityAuto = self.params.periodicityAuto;
                const rotateSpin = self.params.rotateSpin;
                self.r1 = radiusInside / 100.0;
                self.r2 = radiusOutside / 100.0;
                self.p1 = periodicity;
                if (self.p1 == 0.0) {
                    self.p1 = 0.001;
                }
                self.p2 = @as(f32, @floatFromInt(strands));
                if (self.p2 == 0.0) {
                    self.p2 = 0.0001;
                }
                self.tileBasedOnTransparency = @as(bool, if ((transparentInside or !transparentOutside)) true else false);
                self._shift = @as(@Vector(2, f32), @splat(1.0)) + centerShift / @as(@Vector(2, f32), @splat(100.0));
                self._center = (floatVectorFromIntVector(size) / @as(@Vector(2, f32), @splat(2.0))) + center * (floatVectorFromIntVector(size) / @as(@Vector(2, f32), @splat(2.0))) / @as(@Vector(2, f32), @splat(100.0));
                self.w = @as(f32, @floatFromInt(size[0]));
                self.h = @as(f32, @floatFromInt(size[1]));
                self.minDimension = @as(@Vector(2, f32), @splat(min(self.w, self.h) / 2.0));
                if (periodicityAuto) {
                    self.p1 = self.p2 / 2.0 * (1.0 + sqrt(1.0 - pow(log(self.r2 / self.r1) / PI, 2.0)));
                }
                self._rotate = if (self.p1 > 0.0) @Vector(2, f32){ -PI180 * rotate, 0.0 } else @Vector(2, f32){ PI180 * rotate, 0.0 };
                const sc: f32 = cos(radians(rotateSpin));
                const ss: f32 = sin(radians(rotateSpin));
                self.imageSpin = [2]@Vector(2, f32){
                    .{ sc, ss },
                    .{ -ss, sc },
                };
                self._zoom = @Vector(2, f32){
                    (exp(zoom) + radiusInside - 1.0) / 100.0,
                    0.0,
                };
                if (twist) {
                    self.xBounds = @Vector(2, f32){ -self.r2, self.r2 };
                    self.yBounds = @Vector(2, f32){ -self.r2, self.r2 };
                } else {
                    self.xBounds = @Vector(2, f32){
                        -log(self.r2 / self.r1),
                        log(self.r2 / self.r1),
                    };
                    self.yBounds = @Vector(2, f32){ 0.0, 2.1 * PI };
                }
                self.xyMiddle = @Vector(2, f32){
                    self.xBounds[0] + self.xBounds[1],
                    self.yBounds[0] + self.yBounds[1],
                } / @as(@Vector(2, f32), @splat(2.0));
                var xyRange: @Vector(2, f32) = .{
                    self.xBounds[1] - self.xBounds[0],
                    self.yBounds[1] - self.yBounds[0],
                };
                xyRange[0] = xyRange[1] * (self.w / self.h);
                self.xBounds = @Vector(2, f32){
                    self.xyMiddle[0] - xyRange[0] / 2.0,
                    self.xyMiddle[0] + xyRange[0] / 2.0,
                };
                self.sampleStep = 1.0 / @as(f32, @floatFromInt(antialiasing));
                self.sampleContribution = 1.0 / pow(@as(f32, @floatFromInt(antialiasing)), 2.0);
            }

            fn render(self: *@This(), z: @Vector(2, f32), alphaRemaining: *f32, sign: *i32, iteration: *i32, colorSoFar: *@Vector(4, f32)) void {
                const transparentOutside = self.params.transparentOutside;
                const src = self.input.src;
                const r1 = self.r1;
                const r2 = self.r2;
                const _shift = self._shift;
                const minDimension = self.minDimension;
                const tileBasedOnTransparency = self.tileBasedOnTransparency;
                const d: @Vector(2, f32) = minDimension * (z + _shift);
                sign.* = 0;
                if (tileBasedOnTransparency or iteration.* == 0) {
                    const color: @Vector(4, f32) = src.sampleLinear(d);
                    colorSoFar.* += color * @as(@Vector(4, f32), @splat((color[3] * alphaRemaining.*)));
                    alphaRemaining.* *= (1.0 - colorSoFar.*[3]);
                }
                if (tileBasedOnTransparency) {
                    if (!transparentOutside and alphaRemaining.* > 0.0) {
                        sign.* = -1;
                    }
                    if (transparentOutside and alphaRemaining.* > 0.0) {
                        sign.* = 1;
                    }
                } else {
                    if (iteration.* > 0) {
                        colorSoFar.* = src.sampleLinear(d);
                    }
                    const radius: f32 = length(z);
                    sign.* = if ((radius < r1)) -1 else @as(i32, if (radius > r2) 1 else 0);
                }
                iteration.* += 1;
            }

            fn renderPoint(self: *@This(), s: @Vector(2, f32)) @Vector(4, f32) {
                const strandMirror = self.params.strandMirror;
                const levels = self.params.levels;
                const levelStart = self.params.levelStart;
                const transparentOutside = self.params.transparentOutside;
                const twist = self.params.twist;
                const rotatePolar = self.params.rotatePolar;
                const hyperDroste = self.params.hyperDroste;
                const fractalPoints = self.params.fractalPoints;
                const r1 = self.r1;
                const r2 = self.r2;
                const p1 = self.p1;
                const p2 = self.p2;
                const w = self.w;
                const h = self.h;
                const _center = self._center;
                const _rotate = self._rotate;
                const _zoom = self._zoom;
                const xBounds = self.xBounds;
                const yBounds = self.yBounds;
                const xyMiddle = self.xyMiddle;
                const imageSpin = self.imageSpin;
                const tileBasedOnTransparency = self.tileBasedOnTransparency;
                var z: @Vector(2, f32) = undefined;
                const d: @Vector(2, f32) = undefined;
                _ = d;
                var ratio: @Vector(2, f32) = undefined;
                const radius: f32 = undefined;
                _ = radius;
                var theta: f32 = undefined;
                var div: f32 = undefined;
                var iteration: i32 = undefined;
                var sign: i32 = 0;
                var alphaRemaining: f32 = 1.0;
                var colorSoFar: @Vector(4, f32) = .{ 0.0, 0.0, 0.0, 0.0 };
                z = @Vector(2, f32){
                    (xBounds[0] + (xBounds[1] - xBounds[0]) * ((s[0] - _center[0]) + w / 2.0) / w),
                    (yBounds[0] + (yBounds[1] - yBounds[0]) * ((s[1] - _center[1]) + h / 2.0) / h),
                };
                if (twist) {
                    z = xyMiddle + complexMult(complexDivision((z - xyMiddle), _zoom), complexExp(complexMult(-I, _rotate)));
                }
                if (hyperDroste) {
                    z = complexSin(z);
                }
                if (fractalPoints > 0) {
                    z = power(z, fractalPoints);
                    z = complexTan(complexMult(z, @Vector(2, f32){ 2.0, 0.0 }));
                }
                if (rotatePolar != 0.0) {
                    theta = PI180 * rotatePolar;
                    div = (1.0 + pow(z[0], 2.0) + pow(z[1], 2.0) + ((1.0 - pow(z[0], 2.0) - pow(z[1], 2.0)) * cos(theta)) - (2.0 * z[0] * sin(theta))) / 2.0;
                    z[0] = z[0] * cos(theta) + ((1.0 - pow(z[0], 2.0) - pow(z[1], 2.0)) * sin(theta) / 2.0);
                    z = complexDivision(z, @Vector(2, f32){ div, 0.0 });
                }
                z = @"V * M"(z, imageSpin);
                if (twist) {
                    z = complexLog(complexDivision(z, @Vector(2, f32){ r1, 0.0 }));
                }
                const alpha: @Vector(2, f32) = .{
                    atan((p2 / p1) * (log(r2 / r1) / TWOPI)),
                    0.0,
                };
                const f: @Vector(2, f32) = .{ cos(alpha[0]), 0.0 };
                const beta: @Vector(2, f32) = complexMult(f, complexExp(complexMult(alpha, I)));
                var angle: @Vector(2, f32) = .{ -TWOPI * p1, 0.0 };
                if (p2 > 0.0) {
                    angle = -angle;
                }
                if (strandMirror) {
                    angle /= @as(@Vector(2, f32), @splat(p2));
                }
                z = complexDivision(complexMult(@Vector(2, f32){ p1, 0.0 }, z), beta);
                z = complexMult(@Vector(2, f32){ r1, 0.0 }, complexExp(z));
                if (tileBasedOnTransparency and levelStart > 0) {
                    if (transparentOutside) {
                        ratio = complexMult(@Vector(2, f32){ r2 / r1, 0.0 }, complexExp(complexMult(angle, I)));
                    } else {
                        ratio = complexMult(@Vector(2, f32){ r1 / r2, 0.0 }, complexExp(complexMult(angle, -I)));
                    }
                    z = complexMult(z, power(ratio, levelStart));
                }
                iteration = 0;
                self.render(z, &alphaRemaining, &sign, &iteration, &colorSoFar);
                if (sign < 0) {
                    ratio = complexMult(@Vector(2, f32){ r2 / r1, 0.0 }, complexExp(complexMult(angle, I)));
                }
                if (sign > 0) {
                    ratio = complexMult(@Vector(2, f32){ r1 / r2, 0.0 }, complexExp(complexMult(angle, -I)));
                }
                iteration = levelStart;
                const maxIteration: i32 = levels + levelStart - 1;
                while (sign != 0 and iteration < maxIteration) {
                    z = complexMult(z, ratio);
                    self.render(z, &alphaRemaining, &sign, &iteration, &colorSoFar);
                }
                return colorSoFar;
            }

            pub fn evaluatePixel(self: *@This()) void {
                const antialiasing = self.params.antialiasing;
                const backgroundRGBA = self.params.backgroundRGBA;
                const dst = self.output.dst;
                const sampleStep = self.sampleStep;
                const sampleContribution = self.sampleContribution;
                self.dst = @splat(0.0);

                var c: @Vector(4, f32) = backgroundRGBA;
                if (antialiasing > 1) {
                    {
                        var i: f32 = 0.0;
                        while (i < 1.0) {
                            var j: f32 = 0.0;
                            while (j < 1.0) {
                                c += @as(@Vector(4, f32), @splat(sampleContribution)) * self.renderPoint(@Vector(2, f32){
                                    self.outCoord()[0] + i,
                                    self.outCoord()[1] + j,
                                });
                                j += sampleStep;
                            }
                            i += sampleStep;
                        }
                    }
                } else {
                    c = self.renderPoint(self.outCoord());
                }
                if (c[3] < 1.0) {
                    c = mix(c, backgroundRGBA, 1.0 - c[3]);
                }
                self.dst = c;

                dst.writePixel(self.outputCoord, self.dst);
            }

            // macros
            fn complexMult(a: @Vector(2, f32), b: @Vector(2, f32)) @Vector(2, f32) {
                return @Vector(2, f32){
                    a[0] * b[0] - a[1] * b[1],
                    a[0] * b[1] + a[1] * b[0],
                };
            }

            fn complexMag(z: @Vector(2, f32)) f32 {
                return pow(length(z), 2.0);
            }

            fn complexReciprocal(z: @Vector(2, f32)) @Vector(2, f32) {
                return @Vector(2, f32){
                    z[0] / complexMag(z),
                    -z[1] / complexMag(z),
                };
            }

            fn complexDivision(a: @Vector(2, f32), b: @Vector(2, f32)) @Vector(2, f32) {
                return complexMult(a, complexReciprocal(b));
            }

            fn complexArg(z: @Vector(2, f32)) f32 {
                return atan2(z[1], z[0]);
            }

            fn complexLog(z: @Vector(2, f32)) @Vector(2, f32) {
                return @Vector(2, f32){
                    log(length(z)),
                    complexArg(z),
                };
            }

            fn complexExp(z: @Vector(2, f32)) @Vector(2, f32) {
                return @Vector(2, f32){
                    exp(z[0]) * cos(z[1]),
                    exp(z[0]) * sin(z[1]),
                };
            }

            fn sinh(x: f32) f32 {
                return (exp(x) - exp(-x)) / 2.0;
            }

            fn cosh(x: f32) f32 {
                return (exp(x) + exp(-x)) / 2.0;
            }

            fn complexSin(z: @Vector(2, f32)) @Vector(2, f32) {
                return @Vector(2, f32){
                    sin(z[0]) * cosh(z[1]),
                    cos(z[0]) * sinh(z[1]),
                };
            }

            fn complexTan(z: @Vector(2, f32)) @Vector(2, f32) {
                return @Vector(2, f32){
                    sin(2.0 * z[0]) / (cos(2.0 * z[0]) + cosh(2.0 * z[1])),
                    sinh(2.0 * z[1]) / (cos(2.0 * z[0]) + cosh(2.0 * z[1])),
                };
            }

            fn polar(r: f32, a: f32) @Vector(2, f32) {
                return @Vector(2, f32){
                    cos(a) * r,
                    sin(a) * r,
                };
            }

            fn power(z: @Vector(2, f32), p: i32) @Vector(2, f32) {
                return polar(pow(length(z), @as(f32, @floatFromInt(p))), @as(f32, @floatFromInt(p)) * complexArg(z));
            }

            pub fn outCoord(self: *@This()) @Vector(2, f32) {
                return self.outputCoord;
            }
        };
    }

    // kernel instance creation function
    pub fn create(input: anytype, output: anytype, params: anytype) Instance(@TypeOf(input), @TypeOf(output), @TypeOf(params)) {
        return .{
            .input = input,
            .output = output,
            .params = params,
        };
    }

    // built-in Pixel Bender functions
    fn radians(v: anytype) @TypeOf(v) {
        const multiplier = std.math.pi / 180.0;
        return switch (@typeInfo(@TypeOf(v))) {
            .vector => v * @as(@TypeOf(v), @splat(multiplier)),
            else => v * multiplier,
        };
    }

    fn sin(v: anytype) @TypeOf(v) {
        return @sin(v);
    }

    fn cos(v: anytype) @TypeOf(v) {
        return @cos(v);
    }

    fn atan(v: anytype) @TypeOf(v) {
        return switch (@typeInfo(@TypeOf(v))) {
            .vector => calc: {
                var result: @TypeOf(v) = undefined;
                inline for (0..@typeInfo(@TypeOf(v)).vector.len) |i| {
                    result[i] = atan(v[i]);
                }
                break :calc result;
            },
            else => std.math.atan(v),
        };
    }

    fn atan2(v1: anytype, v2: anytype) @TypeOf(v1) {
        return switch (@typeInfo(@TypeOf(v1))) {
            .vector => calc: {
                var result: @TypeOf(v1) = undefined;
                inline for (0..@typeInfo(@TypeOf(v1)).vector.len) |i| {
                    result[i] = atan2(v1[i], v2[i]);
                }
                break :calc result;
            },
            else => switch (@typeInfo(@TypeOf(std.math.atan2)).@"fn".params.len) {
                2 => std.math.atan2(v1, v2),
                else => std.math.atan2(@TypeOf(v1), v1, v2),
            },
        };
    }

    fn pow(v1: anytype, v2: anytype) @TypeOf(v1) {
        return switch (@typeInfo(@TypeOf(v1))) {
            .vector => calc: {
                var result: @TypeOf(v1) = undefined;
                inline for (0..@typeInfo(@TypeOf(v1)).vector.len) |i| {
                    result[i] = pow(v1[i], v2[i]);
                }
                break :calc result;
            },
            else => std.math.pow(@TypeOf(v1), v1, v2),
        };
    }

    fn exp(v: anytype) @TypeOf(v) {
        return @exp(v);
    }

    fn log(v: anytype) @TypeOf(v) {
        return @log(v);
    }

    fn sqrt(v: anytype) @TypeOf(v) {
        return @sqrt(v);
    }

    fn min(v1: anytype, v2: anytype) @TypeOf(v1) {
        return switch (@typeInfo(@TypeOf(v2))) {
            .vector => @min(v1, v2),
            else => switch (@typeInfo(@TypeOf(v1))) {
                .vector => @min(v1, @as(@TypeOf(v1), @splat(v2))),
                else => @min(v1, v2),
            },
        };
    }

    fn mix(v1: anytype, v2: anytype, p: anytype) @TypeOf(v1) {
        return switch (@typeInfo(@TypeOf(p))) {
            .vector => v1 * (@as(@TypeOf(p), @splat(1)) - p) + v2 * p,
            else => switch (@typeInfo(@TypeOf(v1))) {
                .vector => mix(v1, v2, @as(@TypeOf(v1), @splat(p))),
                else => v1 * (1 - p) + v2 * p,
            },
        };
    }

    fn length(v: anytype) f32 {
        return switch (@typeInfo(@TypeOf(v))) {
            .vector => @sqrt(@reduce(.Add, v * v)),
            else => @abs(v),
        };
    }

    fn @"V * M"(v1: anytype, m2: anytype) @TypeOf(v1) {
        var result: @TypeOf(v1) = undefined;
        inline for (m2, 0..) |column, c| {
            result[c] = @reduce(.Add, column * v1);
        }
        return result;
    }

    fn floatVectorFromIntVector(v: anytype) @Vector(@typeInfo(@TypeOf(v)).vector.len, f32) {
        const len = @typeInfo(@TypeOf(v)).vector.len;
        var result: @Vector(len, f32) = undefined;
        inline for (0..len) |i| {
            result[i] = @floatFromInt(v[i]);
        }
        return result;
    }
};

// keep auto-formatter from moving statement
const zigar = if (true) @import("zigar") else unreachable;

pub const Input = KernelInput(kernel);
pub const Output = KernelOutput(kernel);
pub const Parameters = KernelParameters(kernel);

pub fn process(input: Input, output: Output, params: Parameters) !void {
    // use inline loop to generate code for each image implementation (WebImage or GD)
    inline for (zigar.image.formats) |tag| {
        const input_field_names = comptime std.meta.fieldNames(Input);
        const output_field_names = comptime std.meta.fieldNames(Output);
        const output_image_0 = @field(output, output_field_names[0]);
        if (output_image_0 == tag) {
            // copy fields from zigar.image.Any to implementation-specific structs
            var input_impl: KernelInputImpl(tag.Type(.ro), kernel) = undefined;
            inline for (input_field_names) |name| {
                const input_image = @field(input, name);
                if (input_image != tag) unreachable;
                @field(input_impl, name).impl = input_image.getField(tag);
            }
            var output_impl: KernelOutputImpl(tag.Type(.rw), kernel) = undefined;
            inline for (output_field_names) |name| {
                const output_image = @field(output, name);
                if (output_image != tag) unreachable;
                @field(output_impl, name).impl = output_image.getField(tag);
            }
            // get the output dimensions (multiple outputs are possible but unlikely)
            var output_width: usize = 0;
            var output_height: usize = 0;
            inline for (output_field_names) |name| {
                const output_image = @field(output, name);
                var out = output_image.getField(tag);
                const w = out.getWidth();
                const h = out.getHeight();
                if (w > output_width) output_width = w;
                if (h > output_height) output_height = h;
            }
            // create the implementation-specific kernel instance
            var instance = kernel.create(input_impl, output_impl, params);
            // calculate variables that are dependent on kernel parameters
            if (@hasDecl(@TypeOf(instance), "evaluateDependents")) {
                instance.evaluateDependents();
            }
            // loop through all coordinates, starting from (0.5, 0.5)
            const width: f32 = @floatFromInt(output_width);
            const height: f32 = @floatFromInt(output_height);
            while (instance.outputCoord[1] < height) : (instance.outputCoord[1] += 1) {
                instance.outputCoord[0] = 0.5;
                while (instance.outputCoord[0] < width) : (instance.outputCoord[0] += 1) {
                    instance.evaluatePixel();
                }
            }
        }
    }
}

pub fn KernelImage(comptime Impl: type, comptime channels: comptime_int, comptime writable: bool) type {
    const Pixel = @Vector(channels, f32);
    const Coord = @Vector(2, f32);
    return struct {
        impl: Impl,

        fn writePixel(self: @This(), coord: Coord, pixel: Pixel) void {
            if (comptime !writable) unreachable;
            const i: @Vector(2, usize) = @intFromFloat(coord);
            self.impl.setPixel(Pixel, i[0], i[1], pixel);
        }

        fn pixelSize(self: @This()) Coord {
            _ = self;
            return .{ 1, 1 };
        }

        fn pixelAspectRatio(self: @This()) f32 {
            _ = self;
            return 1;
        }

        fn sampleNearest(self: @This(), coord: Coord) Pixel {
            return self.impl.sampleNearest(Pixel, coord);
        }

        fn sampleLinear(self: @This(), coord: Coord) Pixel {
            return self.impl.sampleLinear(Pixel, coord);
        }
    };
}

pub fn KernelInput(comptime Kernel: type) type {
    const input_fields = std.meta.fields(@TypeOf(Kernel.inputImages));
    comptime var struct_fields: [input_fields.len]std.builtin.Type.StructField = undefined;
    inline for (input_fields, 0..) |field, index| {
        struct_fields[index] = .{
            .name = field.name,
            .type = zigar.image.Any(.ro),
            .default_value_ptr = null,
            .is_comptime = false,
            .alignment = @alignOf(zigar.image.Any(.ro)),
        };
    }
    return @Type(.{
        .@"struct" = .{
            .layout = .auto,
            .fields = &struct_fields,
            .decls = &.{},
            .is_tuple = false,
        },
    });
}

pub fn KernelInputImpl(comptime Impl: type, comptime Kernel: type) type {
    const input_fields = std.meta.fields(@TypeOf(Kernel.inputImages));
    comptime var struct_fields: [input_fields.len]std.builtin.Type.StructField = undefined;
    inline for (input_fields, 0..) |field, index| {
        const input = @field(Kernel.inputImages, field.name);
        const KernelImageImpl = KernelImage(Impl, input.channels, false);
        struct_fields[index] = .{
            .name = field.name,
            .type = KernelImageImpl,
            .default_value_ptr = null,
            .is_comptime = false,
            .alignment = @alignOf(KernelImageImpl),
        };
    }
    return @Type(.{
        .@"struct" = .{
            .layout = .auto,
            .fields = &struct_fields,
            .decls = &.{},
            .is_tuple = false,
        },
    });
}

pub fn KernelOutput(comptime Kernel: type) type {
    const output_fields = std.meta.fields(@TypeOf(Kernel.outputImages));
    comptime var struct_fields: [output_fields.len]std.builtin.Type.StructField = undefined;
    inline for (output_fields, 0..) |field, index| {
        struct_fields[index] = .{
            .name = field.name,
            .type = zigar.image.Any(.rw),
            .default_value_ptr = null,
            .is_comptime = false,
            .alignment = @alignOf(zigar.image.Any(.rw)),
        };
    }
    return @Type(.{
        .@"struct" = .{
            .layout = .auto,
            .fields = &struct_fields,
            .decls = &.{},
            .is_tuple = false,
        },
    });
}

pub fn KernelOutputImpl(comptime Impl: type, comptime Kernel: type) type {
    const output_fields = std.meta.fields(@TypeOf(Kernel.outputImages));
    comptime var struct_fields: [output_fields.len]std.builtin.Type.StructField = undefined;
    inline for (output_fields, 0..) |field, index| {
        const output = @field(Kernel.outputImages, field.name);
        const KernelImageImpl = KernelImage(Impl, output.channels, true);
        const default_value: KernelImageImpl = undefined;
        struct_fields[index] = .{
            .name = field.name,
            .type = KernelImageImpl,
            .default_value_ptr = @ptrCast(&default_value),
            .is_comptime = false,
            .alignment = @alignOf(KernelImageImpl),
        };
    }
    return @Type(.{
        .@"struct" = .{
            .layout = .auto,
            .fields = &struct_fields,
            .decls = &.{},
            .is_tuple = false,
        },
    });
}

pub fn KernelParameters(comptime Kernel: type) type {
    const param_fields = std.meta.fields(@TypeOf(Kernel.parameters));
    comptime var struct_fields: [param_fields.len]std.builtin.Type.StructField = undefined;
    inline for (param_fields, 0..) |field, index| {
        const param = @field(Kernel.parameters, field.name);
        const default_value: ?*const anyopaque = get_def: {
            const value: param.type = switch (@hasField(@TypeOf(param), "defaultValue")) {
                true => param.defaultValue,
                false => switch (@typeInfo(param.type)) {
                    .int, .float => 0,
                    .bool => false,
                    .vector => @splat(0),
                    else => @compileError("Unrecognized parameter type: " ++ @typeName(param.type)),
                },
            };
            break :get_def @ptrCast(&value);
        };
        struct_fields[index] = .{
            .name = field.name,
            .type = param.type,
            .default_value_ptr = default_value,
            .is_comptime = false,
            .alignment = @alignOf(param.type),
        };
    }
    return @Type(.{
        .@"struct" = .{
            .layout = .auto,
            .fields = &struct_fields,
            .decls = &.{},
            .is_tuple = false,
        },
    });
}
