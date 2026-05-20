// Pixel Bender kernel "Sepia" (translated using pb2zig)
const std = @import("std");

const Image = zigar.image.Any;
const AbortSignal = zigar.function.AbortSignal;
const WorkQueue = zigar.thread.WorkQueue;

pub const kernel = struct {
    // kernel information
    pub const namespace = "AIF";
    pub const vendor = "Adobe Systems";
    pub const version = 2;
    pub const description = "a variable sepia filter";
    pub const parameters = .{
        .intensity = .{
            .type = f32,
            .minValue = 0.0,
            .maxValue = 1.0,
            .defaultValue = 0.0,
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
            outputCoord: @Vector(2, u32) = @splat(0),

            // output pixel
            dst: @Vector(4, f32) = undefined,

            // functions defined in kernel
            pub fn evaluatePixel(self: *@This()) void {
                const intensity = self.params.intensity;
                const src = self.input.src;
                const dst = self.output.dst;
                self.dst = @splat(0.0);

                var rgbaColor: @Vector(4, f32) = undefined;
                var yiqaColor: @Vector(4, f32) = undefined;
                const YIQMatrix: [4]@Vector(4, f32) = .{
                    .{
                        0.299,
                        0.596,
                        0.212,
                        0.0,
                    },
                    .{
                        0.587,
                        -0.275,
                        -0.523,
                        0.0,
                    },
                    .{
                        0.114,
                        -0.321,
                        0.311,
                        0.0,
                    },
                    .{ 0.0, 0.0, 0.0, 1.0 },
                };
                const inverseYIQ: [4]@Vector(4, f32) = .{
                    .{ 1.0, 1.0, 1.0, 0.0 },
                    .{
                        0.956,
                        -0.272,
                        -1.1,
                        0.0,
                    },
                    .{
                        0.621,
                        -0.647,
                        1.7,
                        0.0,
                    },
                    .{ 0.0, 0.0, 0.0, 1.0 },
                };
                rgbaColor = src.sampleNearest(self.outCoord());
                yiqaColor = @"M * V"(YIQMatrix, rgbaColor);
                yiqaColor[1] = intensity;
                yiqaColor[2] = 0.0;
                self.dst = @"M * V"(inverseYIQ, yiqaColor);

                dst.setPixel(self.outputCoord[0], self.outputCoord[1], self.dst);
            }

            pub fn outCoord(self: *@This()) @Vector(2, f32) {
                return .{ @as(f32, @floatFromInt(self.outputCoord[0])) + 0.5, @as(f32, @floatFromInt(self.outputCoord[1])) + 0.5 };
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
};

pub const Input = KernelInput(u8, kernel);
pub const Output = KernelOutput(u8, kernel);
pub const Parameters = KernelParameters(kernel);

pub fn createOutput(allocator: std.mem.Allocator, width: u32, height: u32, input: Input, params: Parameters) !Output {
    var output: Output = undefined;
    inline for (std.meta.fields(Output)) |field| {
        const ImageT = @TypeOf(@field(output, field.name));
        @field(output, field.name) = .{
            .data = try allocator.alloc(ImageT.Pixel, width * height),
            .width = width,
            .height = height,
        };
    }
    var instance = kernel.create(input, output, params);
    if (@hasDecl(@TypeOf(instance), "evaluateDependents")) {
        instance.evaluateDependents();
    }
    while (instance.outputCoord[1] < height) : (instance.outputCoord[1] += 1) {
        instance.outputCoord[0] = 0;
        while (instance.outputCoord[0] < width) : (instance.outputCoord[0] += 1) {
            instance.evaluatePixel();
        }
    }
    return output;
}

const ColorSpace = enum { srgb, @"display-p3" };

pub fn KernelInput(comptime Kernel: type) type {
    const input_fields = std.meta.fields(@TypeOf(Kernel.inputImages));
    comptime var struct_fields: [input_fields.len]std.builtin.Type.StructField = undefined;
    inline for (input_fields, 0..) |field, index| {
        struct_fields[index] = .{
            .name = field.name,
            .type = Image,
            .default_value_ptr = null,
            .is_comptime = false,
            .alignment = @alignOf(Image),
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

pub fn KernelOutput(comptime T: type, comptime Kernel: type) type {
    const output_fields = std.meta.fields(@TypeOf(Kernel.outputImages));
    comptime var struct_fields: [output_fields.len]std.builtin.Type.StructField = undefined;
    inline for (output_fields, 0..) |field, index| {
        const output = @field(Kernel.outputImages, field.name);
        struct_fields[index] = .{
            .name = field.name,
            .type = Image,
            .default_value_ptr = null,
            .is_comptime = false,
            .alignment = @alignOf(ImageT),
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

const builtin = if (true) @import("builtin") else unreachable;
const zigar = if (true) @import("zigar") else unreachable;
const Allocator = if (true) std.mem.Allocator else unreachable;
const Promise = zigar.function.PromiseOf(thread_ns.processSlice);
var work_queue: WorkQueue(thread_ns) = .{};
var gpa = switch (builtin.target.cpu.arch.isWasm()) {
    true => {},
    false => std.heap.DebugAllocator(.{}){},
};
const internal_allocator = switch (builtin.target.cpu.arch.isWasm()) {
    true => std.heap.wasm_allocator,
    false => gpa.allocator(),
};

pub fn startThreadPool(count: u32) !void {
    if (builtin.single_threaded) @panic("Unavailable");
    try work_queue.init(.{
        .allocator = internal_allocator,
        .stack_size = 65536,
        .n_jobs = count,
    });
}

pub fn stopThreadPoolAsync(promise: zigar.function.Promise(void)) void {
    if (builtin.single_threaded) @panic("Unavailable");
    work_queue.deinitAsync(promise);
}

pub fn createOutputAsync(allocator: Allocator, promise: Promise, signal: AbortSignal, width: u32, height: u32, input: Input, params: Parameters) !void {
    if (builtin.single_threaded) @panic("Unavailable");
    var output: Output = undefined;
    // allocate memory for output image
    const fields = std.meta.fields(Output);
    var allocated: usize = 0;
    errdefer inline for (fields, 0..) |field, i| {
        if (i < allocated) {
            allocator.free(@field(output, field.name).data);
        }
    };
    inline for (fields) |field| {
        const ImageT = @TypeOf(@field(output, field.name));
        const data = try allocator.alloc(ImageT.Pixel, width * height);
        @field(output, field.name) = .{
            .data = data,
            .width = width,
            .height = height,
        };
        allocated += 1;
    }
    // add work units to queue
    const workers: u32 = @intCast(@max(1, work_queue.thread_count));
    const scanlines: u32 = height / workers;
    const slices: u32 = if (scanlines > 0) workers else 1;
    const multipart_promise = try promise.partition(internal_allocator, slices);
    var slice_num: u32 = 0;
    while (slice_num < slices) : (slice_num += 1) {
        const start = scanlines * slice_num;
        const count = if (slice_num < slices - 1) scanlines else height - (scanlines * slice_num);
        try work_queue.push(thread_ns.processSlice, .{ signal, width, start, count, input, output, params }, multipart_promise);
    }
}

const thread_ns = struct {
    pub fn processSlice(signal: AbortSignal, start: u32, count: u32, input: Input, output: Output, params: Parameters) !Output {
        var instance = kernel.create(input, output, params);
        if (@hasDecl(@TypeOf(instance), "evaluateDependents")) {
            instance.evaluateDependents();
        }
        const end = start + count;
        instance.outputCoord[1] = start;
        while (instance.outputCoord[1] < end) : (instance.outputCoord[1] += 1) {
            instance.outputCoord[0] = 0;
            while (instance.outputCoord[0] < width) : (instance.outputCoord[0] += 1) {
                instance.evaluatePixel();
                if (signal.on()) return error.Aborted;
            }
        }
        return output;
    }
};
