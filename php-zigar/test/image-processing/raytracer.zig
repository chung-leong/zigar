// Pixel Bender kernel "RayTracer" (translated using pb2zig)
const std = @import("std");

pub const kernel = struct {
    // constants
    const PI: f32 = 3.141592653589793;

    // kernel information
    pub const namespace = "Newgrounds";
    pub const vendor = "Newgrounds";
    pub const version = 1;
    pub const description = "Pixel Blender Raytracing";
    pub const parameters = .{
        .viewPlaneDistance = .{
            .type = f32,
            .minValue = 0.1,
            .maxValue = 5.0,
            .defaultValue = 2.0,
        },
        .lightPos = .{
            .type = @Vector(3, f32),
            .minValue = .{ -6.0, -6.0, -25.0 },
            .maxValue = .{ 6.0, 6.0, 0.0 },
            .defaultValue = .{ 0.0, 2.0, -4.0 },
        },
        .sphere0Position = .{
            .type = @Vector(3, f32),
            .minValue = .{ -6.0, -6.0, -25.0 },
            .maxValue = .{ 6.0, 6.0, -2.0 },
            .defaultValue = .{ 0.0, 2.0, -10.0 },
        },
        .sphere0Radius = .{
            .type = f32,
            .minValue = 0.1,
            .maxValue = 8.0,
            .defaultValue = 2.0,
        },
        .sphere0Color = .{
            .type = @Vector(3, f32),
            .minValue = .{ 0.0, 0.0, 0.0 },
            .maxValue = .{ 1.0, 1.0, 1.0 },
            .defaultValue = .{ 0.8, 0.8, 0.8 },
        },
        .sphere0Material = .{
            .type = @Vector(4, f32),
            .minValue = .{ 0.0, 0.0, 0.0, 0.0 },
            .maxValue = .{ 1.0, 1.0, 1.0, 1.0 },
            .defaultValue = .{ 0.05, 0.1, 1.0, 1.0 },
        },
    };
    pub const inputImages = .{};
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
            sphereArray: [NUM_SPHERES * SPHERE_PARAMETER_COUNT]f32 = undefined,

            // constants
            const RENDER_WIDTH: f32 = 512.0;
            const RENDER_HEIGHT: f32 = 512.0;
            const SPECULAR_EXPONENT: f32 = 50.0;
            const MAX_RAY_SHOTS: i32 = 4;
            const NUM_SPHERES: i32 = 35;
            const SPHERE_PARAMETER_COUNT: i32 = 11;

            // functions defined in kernel
            pub fn evaluateDependents(self: *@This()) void {
                const sphere0Position = self.params.sphere0Position;
                const sphere0Radius = self.params.sphere0Radius;
                const sphere0Color = self.params.sphere0Color;
                const sphere0Material = self.params.sphere0Material;
                self.sphereArray[0] = sphere0Position[0];
                self.sphereArray[1] = sphere0Position[1];
                self.sphereArray[2] = sphere0Position[2];
                self.sphereArray[3] = sphere0Radius;
                self.sphereArray[4] = sphere0Color[0];
                self.sphereArray[5] = sphere0Color[1];
                self.sphereArray[6] = sphere0Color[2];
                self.sphereArray[7] = sphere0Material[0];
                self.sphereArray[8] = sphere0Material[1];
                self.sphereArray[9] = sphere0Material[2];
                self.sphereArray[10] = sphere0Material[3];
                self.sphereArray[11] = 0.0;
                self.sphereArray[12] = -1003.0;
                self.sphereArray[13] = -8.0;
                self.sphereArray[14] = 1000.0;
                self.sphereArray[15] = 0.6;
                self.sphereArray[16] = 0.6;
                self.sphereArray[17] = 0.6;
                self.sphereArray[18] = 0.1;
                self.sphereArray[19] = 0.8;
                self.sphereArray[20] = 0.5;
                self.sphereArray[21] = 0.5;
                {
                    var i: i32 = SPHERE_PARAMETER_COUNT * 2;
                    while (i < NUM_SPHERES * SPHERE_PARAMETER_COUNT) {
                        const ifloat: f32 = @floatFromInt(i);
                        self.sphereArray[@intCast(i)] = sin(ifloat / 5.0) * 6.0;
                        self.sphereArray[@intCast(i + 1)] = sin(ifloat / 4.1) * 2.5;
                        self.sphereArray[@intCast(i + 2)] = -18.0 - sin(ifloat / 3.1 + 1.2) * 10.0;
                        self.sphereArray[@intCast(i + 3)] = pow(sin(ifloat / 1.34 + 65.3) * 0.5 + 0.5, 3.0) * 1.0 + 0.2;
                        self.sphereArray[@intCast(i + 4)] = cos(ifloat / 2.1 + 1.3) * 0.5 + 0.5;
                        self.sphereArray[@intCast(i + 5)] = cos(ifloat / 0.1 + 1.3) * 0.5 + 0.5;
                        self.sphereArray[@intCast(i + 6)] = cos(ifloat / 5.1 + 6.3) * 0.5 + 0.5;
                        self.sphereArray[@intCast(i + 7)] = 0.1;
                        self.sphereArray[@intCast(i + 8)] = 0.7;
                        self.sphereArray[@intCast(i + 9)] = 1.0;
                        self.sphereArray[@intCast(i + 10)] = pow(sin(ifloat / 2.1 + 1.243) * 0.5 + 0.5, 5.0);
                        i += SPHERE_PARAMETER_COUNT;
                    }
                }
            }

            fn shootRay(self: *@This(), origin: @Vector(3, f32), dir: @Vector(3, f32), hit: *i32, pos: *@Vector(3, f32), t: *f32, sphereNum: *i32) void {
                const sphereArray = self.sphereArray;
                var curT: f32 = undefined;
                var B: f32 = undefined;
                var C: f32 = undefined;
                var disc: f32 = undefined;
                var spherePos: @Vector(3, f32) = undefined;
                var sphereToOrigin: @Vector(3, f32) = undefined;
                var sphereRadius: f32 = undefined;
                hit.* = 0;
                t.* = 99999.0;
                {
                    var i: i32 = 0;
                    while (i < NUM_SPHERES * SPHERE_PARAMETER_COUNT) {
                        spherePos = @Vector(3, f32){
                            sphereArray[@intCast(i)],
                            sphereArray[@intCast(i + 1)],
                            sphereArray[@intCast(i + 2)],
                        };
                        sphereRadius = sphereArray[@intCast(i + 3)];
                        sphereToOrigin = origin - spherePos;
                        B = dot(sphereToOrigin, dir);
                        C = dot(sphereToOrigin, sphereToOrigin) - sphereRadius * sphereRadius;
                        disc = B * B - C;
                        if (disc > 0.0) {
                            curT = -B - sqrt(disc);
                            if (curT > 0.0 and curT < t.*) {
                                sphereNum.* = i;
                                t.* = curT;
                                hit.* = 1;
                            }
                        }
                        i += SPHERE_PARAMETER_COUNT;
                    }
                }
                pos.* = origin + dir * @as(@Vector(3, f32), @splat(t.*));
            }

            pub fn evaluatePixel(self: *@This()) void {
                const viewPlaneDistance = self.params.viewPlaneDistance;
                const lightPos = self.params.lightPos;
                const dst = self.output.dst;
                const sphereArray = self.sphereArray;
                self.dst = @splat(0.0);

                self.dst = @Vector(4, f32){ 0.0, 0.0, 0.0, 1.0 };
                var origin: @Vector(3, f32) = .{ 0.0, 0.0, 0.0 };
                var dir: @Vector(3, f32) = .{
                    2.0 * self.outCoord()[0] / RENDER_WIDTH - 1.0,
                    -2.0 * self.outCoord()[1] / RENDER_HEIGHT + 1.0,
                    -viewPlaneDistance,
                };
                var sphereNum: i32 = undefined;
                var spherePos: @Vector(3, f32) = undefined;
                var sphereRadius: f32 = undefined;
                var sphereColor: @Vector(3, f32) = undefined;
                var sphereMaterial: @Vector(4, f32) = undefined;
                var hitPoint: @Vector(3, f32) = undefined;
                var t: f32 = undefined;
                var hit: i32 = undefined;
                var sphereHit: @Vector(3, f32) = undefined;
                var n: @Vector(3, f32) = undefined;
                var lightVector: @Vector(3, f32) = undefined;
                var lightVectorLen: f32 = undefined;
                var l: @Vector(3, f32) = undefined;
                var lReflect: @Vector(3, f32) = undefined;
                var dirReflect: @Vector(3, f32) = undefined;
                var shadowTest: i32 = undefined;
                var temp: @Vector(3, f32) = undefined;
                var temp2: i32 = undefined;
                var rayShots: i32 = MAX_RAY_SHOTS;
                var colorScale: @Vector(3, f32) = .{ 1.0, 1.0, 1.0 };
                var specular: f32 = undefined;
                var diffuse: f32 = undefined;
                var lightVal: f32 = undefined;
                var phi: f32 = undefined;
                var uv: @Vector(2, f32) = undefined;
                while (rayShots > 0) {
                    dir = normalize(dir);
                    self.shootRay(origin, dir, &hit, &hitPoint, &t, &sphereNum);
                    if (hit != 0) {
                        spherePos = @Vector(3, f32){
                            sphereArray[@intCast(sphereNum)],
                            sphereArray[@intCast(sphereNum + 1)],
                            sphereArray[@intCast(sphereNum + 2)],
                        };
                        sphereRadius = sphereArray[@intCast(sphereNum + 3)];
                        sphereColor = @Vector(3, f32){
                            sphereArray[@intCast(sphereNum + 4)],
                            sphereArray[@intCast(sphereNum + 5)],
                            sphereArray[@intCast(sphereNum + 6)],
                        };
                        sphereMaterial = @Vector(4, f32){
                            sphereArray[@intCast(sphereNum + 7)],
                            sphereArray[@intCast(sphereNum + 8)],
                            sphereArray[@intCast(sphereNum + 9)],
                            sphereArray[@intCast(sphereNum + 10)],
                        };
                        sphereHit = hitPoint - spherePos;
                        n = sphereHit / @as(@Vector(3, f32), @splat(sphereRadius));
                        lightVector = lightPos - hitPoint;
                        lightVectorLen = length(lightVector);
                        l = lightVector / @as(@Vector(3, f32), @splat(lightVectorLen));
                        self.shootRay(hitPoint, l, &shadowTest, &temp, &t, &temp2);
                        if (shadowTest == 0) {
                            shadowTest = 1;
                        } else if (t < lightVectorLen) {
                            shadowTest = 0;
                        }
                        diffuse = dot(l, n);
                        lReflect = l - @as(@Vector(3, f32), @splat(2.0 * diffuse)) * n;
                        specular = dot(dir, lReflect);
                        diffuse = max(diffuse, 0.0);
                        specular = pow(max(specular, 0.0), SPECULAR_EXPONENT);
                        if (sphereNum == 11) {
                            phi = acos(-dot(@Vector(3, f32){ 1.0, 0.0, 0.0 }, n));
                            uv = @Vector(2, f32){
                                acos(dot(@Vector(3, f32){ 0.0, 0.0, 1.0 }, n) / sin(phi)) / (2.0 * PI),
                                phi / PI,
                            };
                            sphereColor *= @as(@Vector(3, f32), @splat(@as(f32, if ((mod(floor(uv[0] * 2000.0) + floor(uv[1] * 2000.0), 2.0) == 0.0)) 0.5 else 1.0)));
                        }
                        lightVal = (sphereMaterial[0] + @as(f32, @floatFromInt(shadowTest)) * (diffuse * sphereMaterial[1] + specular * sphereMaterial[2]));
                        const res: @Vector(3, f32) = colorScale * @as(@Vector(3, f32), @splat(lightVal)) * sphereColor;
                        self.dst += @Vector(4, f32){
                            res[0],
                            res[1],
                            res[2],
                            0.0,
                        };
                        if (sphereMaterial[3] > 0.0) {
                            dirReflect = dir - @as(@Vector(3, f32), @splat(2.0 * dot(dir, n))) * n;
                            dirReflect = normalize(dirReflect);
                            origin = hitPoint;
                            dir = dirReflect;
                            rayShots -= 1;
                            colorScale *= @as(@Vector(3, f32), @splat(sphereMaterial[3])) * sphereColor;
                        } else {
                            rayShots = 0;
                        }
                    } else {
                        rayShots = 0;
                    }
                }

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
    fn sin(v: anytype) @TypeOf(v) {
        return @sin(v);
    }

    fn cos(v: anytype) @TypeOf(v) {
        return @cos(v);
    }

    fn acos(v: anytype) @TypeOf(v) {
        return switch (@typeInfo(@TypeOf(v))) {
            .vector => calc: {
                var result: @TypeOf(v) = undefined;
                inline for (0..@typeInfo(@TypeOf(v)).vector.len) |i| {
                    result[i] = acos(v[i]);
                }
                break :calc result;
            },
            else => std.math.acos(v),
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

    fn sqrt(v: anytype) @TypeOf(v) {
        return @sqrt(v);
    }

    fn floor(v: anytype) @TypeOf(v) {
        return @floor(v);
    }

    fn mod(v1: anytype, v2: anytype) @TypeOf(v1) {
        return switch (@typeInfo(@TypeOf(v2))) {
            .vector => @mod(v1, v2),
            else => switch (@typeInfo(@TypeOf(v1))) {
                .vector => @mod(v1, @as(@TypeOf(v1), @splat(v2))),
                else => @mod(v1, v2),
            },
        };
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

    fn length(v: anytype) f32 {
        return switch (@typeInfo(@TypeOf(v))) {
            .vector => @sqrt(@reduce(.Add, v * v)),
            else => @abs(v),
        };
    }

    fn dot(v1: anytype, v2: anytype) f32 {
        return switch (@typeInfo(@TypeOf(v1))) {
            .vector => @reduce(.Add, v1 * v2),
            else => v1 * v2,
        };
    }

    fn normalize(v: anytype) @TypeOf(v) {
        return switch (@typeInfo(@TypeOf(v))) {
            .vector => v / @as(@TypeOf(v), @splat(@sqrt(@reduce(.Add, v * v)))),
            else => if (v > 0) 1 else -1,
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
