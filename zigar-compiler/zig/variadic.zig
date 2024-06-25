const std = @import("std");
const builtin = @import("builtin");
const assert = std.debug.assert;

pub const Error = error{
    too_many_arguments,
    unsupported_type_for_variadic_function,
    invalid_argument_attributes,
};

pub fn call(function: anytype, arg: anytype, attr_ptr: *const anyopaque, arg_count: usize) !void {
    const is_wasm = switch (builtin.target.cpu.arch) {
        .wasm32, .wasm64 => true,
        else => false,
    };
    const f = @typeInfo(@TypeOf(function)).Fn;
    const arg_bytes: [*]u8 = @ptrCast(arg);
    const arg_attrs = @as([*]const ArgAttributes, @ptrCast(@alignCast(attr_ptr)))[0..arg_count];
    if (comptime is_wasm) {
        const param_count = f.params.len + 1;
        const params: [param_count]std.builtin.Type.Fn.Param = define: {
            comptime var list: [param_count]std.builtin.Type.Fn.Param = undefined;
            inline for (&list, 0..) |*p, index| {
                if (index < f.params.len) {
                    p.* = f.params[index];
                } else {
                    p.is_generic = false;
                    p.is_noalias = false;
                    p.type = [*]const u8;
                }
            }
            break :define list;
        };
        const F = @Type(.{
            .Fn = .{
                .calling_convention = f.calling_convention,
                .is_generic = false,
                .is_var_args = false,
                .return_type = f.return_type,
                .params = &params,
            },
        });
        const Args = std.meta.ArgsTuple(F);
        var args: Args = undefined;
        // use a variable here, so that Zig doesn't try to call it as a vararg function
        // despite the cast to a non-vararg one
        var function_ptr: *const F = @ptrCast(&function);
        _ = &function_ptr;
        const vararg_offset = switch (arg_count > f.params.len) {
            // use the offset of the first vararg arg
            true => arg_attrs[f.params.len].offset,
            // just point it to the end of the struct
            false => @sizeOf(@TypeOf(arg)),
        };
        const vararg_ptr: [*]const u8 = arg_bytes[vararg_offset..];
        inline for (0..f.params.len + 1) |index| {
            if (index < f.params.len) {
                const name = std.fmt.comptimePrint("{d}", .{index});
                args[index] = @field(arg.*, name);
            } else {
                args[index] = vararg_ptr;
            }
        }
        arg.retval = @call(.auto, function_ptr, args);
    } else {
        const alloc = try allocate(arg_bytes, arg_attrs);
        const int_args: *const @TypeOf(alloc.int_regs) = &alloc.int_regs;
        const float_args: *const @TypeOf(alloc.float_regs) = &alloc.float_regs;
        arg.retval = inline for (0..max_stack_count + 1) |stack_count| {
            if (alloc.stack_count == stack_count * @sizeOf(abi.IntType)) {
                const stack_args: *const [stack_count]abi.IntType = @ptrCast(@alignCast(&alloc.stack));
                const result = callWithArgs(f.return_type.?, f.calling_convention, function, float_args, int_args, stack_args);
                break result;
            }
        } else unreachable;
    }
}

const ArgAttributes = extern struct {
    offset: u16,
    size: u16,
    alignment: u16,
    is_float: bool,
    is_signed: bool,
};
const max_arg_count = 32;
const max_stack_count = max_arg_count - @min(abi.registers.int, abi.registers.float);
const Abi = struct {
    FloatType: type = f64,
    IntType: type = isize,
    registers: struct {
        int: comptime_int,
        float: comptime_int,
    },
    min_stack_align: comptime_int = @alignOf(isize),
};
const abi: Abi = switch (builtin.target.cpu.arch) {
    .x86_64 => switch (builtin.target.os.tag) {
        .windows => .{
            .FloatType = f128,
            .registers = .{
                // RCX, RDX, R8, R9
                .int = 4,
                // XMM0, XMM1, XMM2, XMM3
                .float = 4,
            },
        },
        else => .{
            .FloatType = f128,
            .registers = .{
                // RDI, RSI, RDX, RCX, R8, R9
                .int = 6,
                // XMM0 - XMM7
                .float = 8,
            },
        },
    },
    .aarch64, .aarch64_be, .aarch64_32 => .{
        .registers = .{
            // x0-x7
            .int = 8,
            .float = 0,
        },
    },
    .x86 => .{
        .registers = .{ .int = 0, .float = 0 },
        .min_stack_align = @alignOf(u8),
    },
    .arm, .armeb => .{
        .registers = .{ .int = 0, .float = 0 },
    },
    else => @compileError("Unsupported platform"),
};
const Allocation = struct {
    float_count: usize = 0,
    int_count: usize = 0,
    stack_count: usize = 0,
    float_regs: [abi.registers.float]abi.FloatType = undefined,
    int_regs: [abi.registers.int]abi.IntType = undefined,
    stack: [max_stack_count * @sizeOf(abi.IntType)]u8 = undefined,
};

fn floatFromBytes(bytes: []const u8) abi.FloatType {
    return inline for (.{ f16, f32, f64, f128 }) |T| {
        const float = @typeInfo(T).Float;
        if (bytes.len * 8 == float.bits) {
            const value = std.mem.bytesToValue(T, bytes);
            const int_value: @Type(.{ .Int = .{
                .signedness = .unsigned,
                .bits = float.bits,
            } }) = @bitCast(value);
            const enlarged_int_value: @Type(.{
                .Int = .{
                    .signedness = .unsigned,
                    .bits = @typeInfo(abi.FloatType).Float.bits,
                },
            }) = @intCast(int_value);
            break @bitCast(enlarged_int_value);
        }
    } else unreachable;
}

fn intFromBytes(bytes: []const u8, is_signed: bool) abi.IntType {
    return inline for (.{ i8, u8, i16, u16, i32, u32, i64, u64 }) |T| {
        const int = @typeInfo(T).Int;
        if (bytes.len * 8 == int.bits and is_signed == (int.signedness == .signed)) {
            const value = std.mem.bytesToValue(T, bytes);
            const enlarged_value: @Type(.{
                .Int = .{
                    .signedness = int.signedness,
                    .bits = @typeInfo(abi.IntType).Int.bits,
                },
            }) = @intCast(value);
            break @bitCast(enlarged_value);
        }
    } else unreachable;
}

fn allocate(arg_bytes: [*]const u8, arg_attrs: []const ArgAttributes) !Allocation {
    var alloc: Allocation = .{};
    loop: for (arg_attrs) |a| {
        var bytes = arg_bytes[a.offset .. a.offset + a.size];
        if (a.alignment == 0) {
            return Error.invalid_argument_attributes;
        }
        if (a.is_float) {
            if (a.size <= @sizeOf(abi.FloatType) * 2 and comptime abi.registers.float > 0) {
                while (true) {
                    if (alloc.float_count < alloc.float_regs.len) {
                        const end = @min(bytes.len, @sizeOf(abi.FloatType));
                        alloc.float_regs[alloc.float_count] = floatFromBytes(bytes[0..end]);
                        alloc.float_count += 1;
                        if (end == bytes.len) continue :loop;
                        bytes = bytes[end..];
                    } else {
                        break;
                    }
                }
            }
        } else {
            if (a.size <= @sizeOf(abi.IntType) * 2 and comptime abi.registers.int > 0) {
                while (true) {
                    if (alloc.int_count < alloc.int_regs.len) {
                        const end = @min(bytes.len, @sizeOf(abi.IntType));
                        alloc.int_regs[alloc.int_count] = intFromBytes(bytes[0..end], a.is_signed);
                        alloc.int_count += 1;
                        if (end == bytes.len) continue :loop;
                        bytes = bytes[end..];
                    } else {
                        break;
                    }
                }
            }
        }
        const arg_align: usize = @intCast(@max(abi.min_stack_align, @min(a.alignment, @alignOf(abi.IntType))));
        const stack_offset = (alloc.stack_count + arg_align - 1) & ~(arg_align - 1);
        const new_stack_count = stack_offset + bytes.len;
        if (new_stack_count <= alloc.stack.len) {
            const stack_bytes = alloc.stack[stack_offset .. stack_offset + bytes.len];
            @memcpy(stack_bytes, bytes);
            alloc.stack_count = new_stack_count;
        } else {
            return Error.too_many_arguments;
        }
    }
    const int_align: usize = @alignOf(abi.IntType);
    alloc.stack_count = (alloc.stack_count + int_align - 1) & ~(int_align - 1);
    return alloc;
}

fn callWithArgs(
    comptime RT: type,
    comptime cc: std.builtin.CallingConvention,
    ptr: *const anyopaque,
    float_args: anytype,
    int_args: anytype,
    stack_args: anytype,
) RT {
    const param_count = float_args.len + int_args.len + stack_args.len;
    const params: [param_count]std.builtin.Type.Fn.Param = define: {
        comptime var list: [param_count]std.builtin.Type.Fn.Param = undefined;
        inline for (&list, 0..) |*p, index| {
            p.is_generic = false;
            p.is_noalias = false;
            p.type = if (index < float_args.len) abi.FloatType else abi.IntType;
        }
        break :define list;
    };
    const F = @Type(.{
        .Fn = .{
            .calling_convention = cc,
            .is_generic = false,
            .is_var_args = true,
            .return_type = RT,
            .params = &params,
        },
    });
    const function: *const F = @ptrCast(@alignCast(ptr));
    comptime var fields: [params.len]std.builtin.Type.StructField = undefined;
    inline for (params, 0..) |param, index| {
        const T = param.type.?;
        fields[index] = .{
            .name = std.fmt.comptimePrint("{d}", .{index}),
            .type = T,
            .default_value = null,
            .is_comptime = false,
            .alignment = if (@sizeOf(T) > 0) @alignOf(T) else 0,
        };
    }
    const Args = @Type(.{
        .Struct = .{
            .is_tuple = true,
            .layout = .auto,
            .decls = &.{},
            .fields = &fields,
        },
    });
    var args: Args = undefined;
    comptime var index = 0;
    inline for (float_args) |f_arg| {
        args[index] = f_arg;
        index += 1;
    }
    inline for (int_args) |i_arg| {
        args[index] = i_arg;
        index += 1;
    }
    inline for (stack_args) |s_arg| {
        args[index] = s_arg;
        index += 1;
    }
    return @call(.auto, function, args);
}

fn default(comptime field: std.builtin.Type.StructField) field.type {
    const opaque_ptr = field.default_value.?;
    const typed_ptr: *const field.type = @ptrCast(@alignCast(opaque_ptr));
    return typed_ptr.*;
}

fn createTest(RT: type, tuple: anytype) type {
    const fields = @typeInfo(@TypeOf(tuple)).Struct.fields;
    const ArgStruct = @Type(.{
        .Struct = .{
            .layout = .auto,
            .decls = &.{},
            .fields = &.{
                .{
                    .name = "retval",
                    .type = RT,
                    .default_value = null,
                    .is_comptime = false,
                    .alignment = if (@sizeOf(RT) > 0) @alignOf(RT) else 0,
                },
            },
            .is_tuple = false,
        },
    });
    comptime var current_offset: u16 = @sizeOf(ArgStruct);
    comptime var offsets: [fields.len]u16 = undefined;
    inline for (fields, 0..) |field, index| {
        const alignment: u16 = @alignOf(field.type);
        const offset = (current_offset + alignment - 1) & ~(alignment - 1);
        offsets[index] = offset;
        current_offset = offset + @sizeOf(field.type);
    }
    const arg_size = current_offset;
    return struct {
        var correct: ?bool = null;

        fn check(arg0: fields[0].type, ...) callconv(.C) RT {
            if (arg0 != default(fields[0])) {
                std.debug.print("Mismatch: {any} != {any}\n", .{ arg0, default(fields[0]) });
                correct = false;
                return 0;
            }
            var va_list = @cVaStart();
            defer @cVaEnd(&va_list);
            inline for (fields[1..]) |tuple_field| {
                const argN = @cVaArg(&va_list, tuple_field.type);
                if (argN != default(tuple_field)) {
                    std.debug.print("Mismatch: {any} != {any}\n", .{ argN, default(tuple_field) });
                    correct = false;
                    return 0;
                }
            }
            correct = true;
            return 777;
        }

        pub fn run() void {
            var arg_bytes: [arg_size]u8 = undefined;
            var attrs: [fields.len]ArgAttributes = undefined;
            inline for (&attrs, 0..) |*p, index| {
                const field = fields[index];
                const offset = offsets[index];
                const bytes = std.mem.toBytes(default(field));
                @memcpy(arg_bytes[offset .. offset + bytes.len], &bytes);
                p.* = .{
                    .offset = offset,
                    .size = @sizeOf(field.type),
                    .alignment = @alignOf(field.type),
                    .is_float = @typeInfo(field.type) == .Float,
                    .is_signed = @typeInfo(field.type) == .Int and @typeInfo(field.type).Int.signedness == .signed,
                };
            }
            const arg = @as(*ArgStruct, @ptrCast(@alignCast(&arg_bytes)));
            call(check, arg, @ptrCast(&attrs), attrs.len) catch |err| {
                std.debug.print("Error: {s}", .{@errorName(err)});
                @panic("Error happend");
            };
            const passed = correct orelse @panic("No result");
            if (!passed) {
                @panic("Parameters do not match");
            }
            if (arg.retval != 777) {
                std.debug.print("Mismatch: {any} != {any}\n", .{ arg.retval, 777 });
                @panic("Return value does not match");
            }
        }
    };
}

test "parameter passing - i32" {
    createTest(u32, .{
        @as(i32, 1234),
    }).run();
}

test "parameter passing - i32, i32" {
    createTest(u32, .{
        @as(i32, 1234),
        @as(i32, 4567),
    }).run();
}

test "parameter passing - i32, f32, i32, f32" {
    createTest(u32, .{
        @as(i32, 1234),
        @as(f32, 1.234),
        @as(i32, 4567),
        @as(f32, 4.567),
    }).run();
}

test "parameter passing - f32, f32, f32, f32, f32, f32, f32, f32" {
    createTest(u32, .{
        @as(f32, 0.1),
        @as(f32, 0.2),
        @as(f32, 0.3),
        @as(f32, 0.4),
        @as(f32, 0.5),
        @as(f32, 0.6),
        @as(f32, 0.7),
        @as(f32, 0.8),
    }).run();
}

test "parameter passing - f32, f32, f32, f32, f32, f32, f32, f32, f32, f32" {
    createTest(u32, .{
        @as(f32, 0.1),
        @as(f32, 0.2),
        @as(f32, 0.3),
        @as(f32, 0.4),
        @as(f32, 0.5),
        @as(f32, 0.6),
        @as(f32, 0.7),
        @as(f32, 0.8),
        @as(f32, 0.9),
        @as(f32, 1.0),
    }).run();
}

test "parameter passing - u32, u32, u32, u32, u32, u32, u32, u32" {
    createTest(i64, .{
        @as(u32, 1000),
        @as(u32, 2000),
        @as(u32, 3000),
        @as(u32, 4000),
        @as(u32, 5000),
        @as(u32, 6000),
        @as(u32, 7000),
        @as(u32, 8000),
    }).run();
}

test "parameter passing - [*:0]const u8, f32, f32, f32, f32, f32, f32, f32, f32, [*:0]const u8" {
    createTest(u32, .{
        @as([*:0]const u8, @ptrCast("Hello")),
        @as(f32, 0.2),
        @as(f32, 0.3),
        @as(f32, 0.4),
        @as(f32, 0.5),
        @as(f32, 0.6),
        @as(f32, 0.7),
        @as(f32, 0.8),
        @as(f32, 0.9),
        @as([*:0]const u8, @ptrCast("World")),
    }).run();
}
