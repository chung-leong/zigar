// Pixel Bender kernel "VertexRenderer" (translated using pb2zig)
const std = @import("std");

pub const kernel = struct {
    // kernel information
    pub const namespace = "Metallic";
    pub const vendor = "Petri Leskinen";
    pub const version = 1;
    pub const description = "Metallic -effect";
    pub const parameters = .{
        .lightsource = .{
            .type = @Vector(3, f32),
            .minValue = .{
                -1000.0,
                -1000.0,
                -1000.0,
            },
            .maxValue = .{
                1000.0,
                1000.0,
                1000.0,
            },
            .defaultValue = .{ 200.0, 60.0, 40.0 },
            .description = "xyz-location of the light source",
        },
        .shininess = .{
            .type = i32,
            .minValue = 2,
            .maxValue = 64,
            .defaultValue = 40,
            .description = "shininess",
        },
        .shadow = .{
            .type = f32,
            .minValue = 0.0,
            .maxValue = 1.0,
            .defaultValue = 0.4,
            .description = "depth of shadow areas",
        },
        .relief = .{
            .type = f32,
            .minValue = 1.0,
            .maxValue = 10.0,
            .defaultValue = 2.0,
            .description = "the height of 3D effect",
        },
        .stripesize = .{
            .type = @Vector(2, f32),
            .minValue = .{ 1.0, 1.0 },
            .maxValue = .{ 256.0, 200.0 },
            .defaultValue = .{ 256.0, 10.0 },
            .description = "the size for input 'stripe'",
        },
        .viewDirection = .{
            .type = @Vector(3, f32),
            .minValue = .{ -1.0, -1.0, -1.0 },
            .maxValue = .{ 1.0, 1.0, 1.0 },
            .defaultValue = .{ 0.0, 0.0, 1.0 },
        },
    };
    pub const inputImages = .{
        .source = .{ .channels = 4 },
        .stripe = .{ .channels = 4 },
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

            // functions defined in kernel
            pub fn evaluatePixel(self: *@This()) void {
                const lightsource = self.params.lightsource;
                const shininess = self.params.shininess;
                const shadow = self.params.shadow;
                const relief = self.params.relief;
                const stripesize = self.params.stripesize;
                const viewDirection = self.params.viewDirection;
                const source = self.input.source;
                const stripe = self.input.stripe;
                const dst = self.output.dst;
                self.dst = @splat(0.0);

                const po: @Vector(2, f32) = self.outCoord();
                var tmp4: @Vector(4, f32) = undefined;
                self.dst = source.sampleLinear(po);
                if (self.dst[3] > 0.01) {
                    const sourcesample: @Vector(4, f32) = self.dst;
                    tmp4 = source.sampleLinear(po + @Vector(2, f32){ -3.0, 0.0 });
                    const tmp1 = tmp4;
                    tmp4 = source.sampleLinear(po + @Vector(2, f32){ -2.0, 0.0 });
                    const tmp2 = tmp4;
                    tmp4 = source.sampleLinear(po + @Vector(2, f32){ -1.0, 0.0 });
                    const tmp3 = tmp4;
                    tmp4 = source.sampleLinear(po + @Vector(2, f32){ 1.0, 0.0 });
                    const tmp5 = tmp4;
                    tmp4 = source.sampleLinear(po + @Vector(2, f32){ 2.0, 0.0 });
                    const tmp6 = tmp4;
                    tmp4 = source.sampleLinear(po + @Vector(2, f32){ 3.0, 0.0 });
                    const tmp7 = tmp4;
                    tmp4 = source.sampleLinear(po + @Vector(2, f32){ 0.0, -3.0 });
                    const tmp8 = tmp4;
                    tmp4 = source.sampleLinear(po + @Vector(2, f32){ 0.0, -2.0 });
                    const tmp9 = tmp4;
                    tmp4 = source.sampleLinear(po + @Vector(2, f32){ 0.0, -1.0 });
                    const tmp10 = tmp4;
                    tmp4 = source.sampleLinear(po + @Vector(2, f32){ 0.0, 1.0 });
                    const tmp11 = tmp4;
                    tmp4 = source.sampleLinear(po + @Vector(2, f32){ 0.0, 2.0 });
                    const tmp12 = tmp4;
                    tmp4 = source.sampleLinear(po + @Vector(2, f32){ 0.0, 3.0 });
                    const tmp13 = tmp4;
                    var normal: @Vector(3, f32) = .{
                        (0.7 * tmp1[1] + 0.2 * tmp4[0] + 0.1 * tmp4[2]) + (0.7 * tmp2[1] + 0.2 * tmp4[0] + 0.1 * tmp4[2]) + (0.7 * tmp3[1] + 0.2 * tmp4[0] + 0.1 * tmp4[2]) - (0.7 * tmp5[1] + 0.2 * tmp4[0] + 0.1 * tmp4[2]) - (0.7 * tmp6[1] + 0.2 * tmp4[0] + 0.1 * tmp4[2]) - (0.7 * tmp7[1] + 0.2 * tmp4[0] + 0.1 * tmp4[2]),
                        (0.7 * tmp8[1] + 0.2 * tmp4[0] + 0.1 * tmp4[2]) + (0.7 * tmp9[1] + 0.2 * tmp4[0] + 0.1 * tmp4[2]) + (0.7 * tmp10[1] + 0.2 * tmp4[0] + 0.1 * tmp4[2]) - (0.7 * tmp11[1] + 0.2 * tmp4[0] + 0.1 * tmp4[2]) - (0.7 * tmp12[1] + 0.2 * tmp4[0] + 0.1 * tmp4[2]) - (0.7 * tmp13[1] + 0.2 * tmp4[0] + 0.1 * tmp4[2]),
                        12.0 / relief,
                    };
                    var len: f32 = 1.0 / sqrt(normal[0] * normal[0] + normal[1] * normal[1] + normal[2] * normal[2] + 0.0);
                    normal *= @as(@Vector(3, f32), @splat(len));
                    var lightbeam: @Vector(3, f32) = lightsource;
                    lightbeam = @shuffle(f32, lightbeam, @shuffle(f32, lightbeam, undefined, @Vector(2, i32){ 0, 1 }) - po, @Vector(3, i32){ -1, -2, 2 });
                    tmp4 = sourcesample;
                    const tmp14 = tmp4;
                    lightbeam[2] -= 5.0 * relief * ((0.7 * tmp14[1] + 0.2 * tmp4[0] + 0.1 * tmp4[2]) - 1.0);
                    len = 1.0 / sqrt(lightbeam[0] * lightbeam[0] + lightbeam[1] * lightbeam[1] + lightbeam[2] * lightbeam[2] + 0.0);
                    lightbeam *= @as(@Vector(3, f32), @splat(len));
                    var refl: f32 = shadow + (1.0 - shadow) * dot(normal, lightbeam);
                    const v: @Vector(3, f32) = reflectVector(viewDirection, normal);
                    var spec: f32 = dot(v, lightbeam);
                    if (spec > 0.0) {
                        spec = pow(spec, @as(f32, @floatFromInt(shininess)));
                        refl += spec;
                    }
                    refl = clamp(refl, 0.0, 1.0);
                    self.dst = stripe.sampleLinear(@Vector(2, f32){
                        0.5 + (stripesize[0] - 1.0) * refl,
                        stripesize[1],
                    });
                    self.dst[3] *= sourcesample[3];
                }

                dst.writePixel(self.outputCoord, self.dst);
            }

            // macros
            fn reflectVector(v: @Vector(3, f32), n: @Vector(3, f32)) @Vector(3, f32) {
                return (@as(@Vector(3, f32), @splat(2.0)) * n * @as(@Vector(3, f32), @splat(dot(v, n))) / @as(@Vector(3, f32), @splat((n[0] * n[0] + n[1] * n[1] + n[2] * n[2]))) - v);
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

    fn sqrt(v: anytype) @TypeOf(v) {
        return @sqrt(v);
    }

    fn clamp(v: anytype, min_val: anytype, max_val: anytype) @TypeOf(v) {
        return switch (@typeInfo(@TypeOf(min_val))) {
            .vector => calc: {
                const T = @typeInfo(@TypeOf(v)).vector.child;
                const result1 = @select(T, v < min_val, min_val, v);
                const result2 = @select(T, result1 > max_val, max_val, result1);
                break :calc result2;
            },
            else => switch (@typeInfo(@TypeOf(v))) {
                .vector => clamp(v, @as(@TypeOf(v), @splat(min_val)), @as(@TypeOf(v), @splat(max_val))),
                else => calc: {
                    if (v < min_val) {
                        break :calc min_val;
                    } else if (v > max_val) {
                        break :calc max_val;
                    } else {
                        break :calc v;
                    }
                },
            },
        };
    }

    fn dot(v1: anytype, v2: anytype) f32 {
        return switch (@typeInfo(@TypeOf(v1))) {
            .vector => @reduce(.Add, v1 * v2),
            else => v1 * v2,
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
