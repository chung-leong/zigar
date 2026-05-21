// Pixel Bender kernel "CirclePacking" (translated using pb2zig)
const std = @import("std");

pub const kernel = struct {
    // kernel information
    pub const namespace = "CirclePattern";
    pub const vendor = "Petri Leskinen";
    pub const version = 1;
    pub const description = "CirclePattern";
    pub const parameters = .{
        .fill = .{
            .type = f32,
            .minValue = 0.0,
            .maxValue = 0.33,
            .defaultValue = 0.23,
        },
        .scale = .{
            .type = f32,
            .minValue = 1.0,
            .maxValue = 20.0,
            .defaultValue = 1.0,
        },
        .distort = .{
            .type = @Vector(2, f32),
            .minValue = .{ 0.1, 0.1 },
            .maxValue = .{ 8.0, 8.0 },
            .defaultValue = .{ 3.0, 1.7320508 },
        },
        .center = .{
            .type = @Vector(2, f32),
            .minValue = .{ -20.0, -20.0 },
            .maxValue = .{ 400.0, 400.0 },
            .defaultValue = .{ 120.0, 130.0 },
        },
        .minSolid = .{
            .type = f32,
            .minValue = 0.001,
            .maxValue = 0.1,
            .defaultValue = 0.005,
        },
        .maxSolid = .{
            .type = f32,
            .minValue = 0.001,
            .maxValue = 1.0,
            .defaultValue = 0.05,
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

            // constants
            const sqr3: f32 = 1.7320508;
            const halfPixel: @Vector(2, f32) = @Vector(2, f32){ 0.5, 0.5 };

            // functions defined in kernel
            pub fn evaluatePixel(self: *@This()) void {
                const fill = self.params.fill;
                const scale = self.params.scale;
                const distort = self.params.distort;
                const center = self.params.center;
                const minSolid = self.params.minSolid;
                const maxSolid = self.params.maxSolid;
                const src = self.input.src;
                const dst = self.output.dst;
                self.dst = @splat(0.0);

                var z: @Vector(2, f32) = @as(@Vector(2, f32), @splat(scale * 0.001)) * (self.outCoord() - center);
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
                self.dst = src.sampleNearest(z + center);
                self.dst[3] *= alf;

                dst.writePixel(self.outputCoord, self.dst);
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
};

// keep auto-formatter from moving statement
const zigar = if (true) @import("zigar") else unreachable;

pub const Input = KernelInput(kernel);
pub const Output = KernelOutput(kernel);
pub const Parameters = KernelParameters(kernel);

pub fn process(input: Input, output: Output, params: Parameters) !void {
    // use inline loop to generate code for each image implementation (WebImage or GD)
    inline for (zigar.image.Any.tags) |tag| {
        const input_field_names = comptime std.meta.fieldNames(Input);
        const output_field_names = comptime std.meta.fieldNames(Output);
        const output_image_0 = @field(output, output_field_names[0]);
        if (output_image_0 == tag) {
            const Impl = zigar.image.Any.FieldType(tag);
            // copy fields from zigar.image.Any to implementation-specific structs
            var input_impl: KernelInputImpl(Impl, kernel) = undefined;
            inline for (input_field_names) |name| {
                const input_image = @field(input, name);
                if (input_image != tag) unreachable;
                @field(input_impl, name).impl = input_image.getField(tag);
            }
            var output_impl: KernelOutputImpl(Impl, kernel) = undefined;
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
                instance.outputCoord[0] = 0;
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
            .type = zigar.image.Any,
            .default_value_ptr = null,
            .is_comptime = false,
            .alignment = @alignOf(zigar.image.Any),
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
            .type = zigar.image.Any,
            .default_value_ptr = null,
            .is_comptime = false,
            .alignment = @alignOf(zigar.image.Any),
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
