const std = @import("std");
const builtin = @import("builtin");

pub const ArgAttributes = packed struct {
    offset: u16,
    size: u8,
    is_float: bool,
    is_signed: bool,
};
pub const Error = error{
    too_many_arguments,
    unsupported_type_for_variadic_function,
};

pub fn call(function: anytype, arg_ptr: [*]u8, attrs: []const ArgAttributes) !void {
    const f = @typeInfo(@TypeOf(function)).Fn;
    const RT = f.return_type.?;
    const alloc = try allocate(arg_ptr, attrs[1..]);
    const retval_ptr: *RT = @ptrCast(@alignCast(&arg_ptr[attrs[0].offset]));
    const int_args = alloc.int_values;
    const float_args = alloc.float_values;
    retval_ptr.* = inline for (0..max_stack_count + 1) |stack_count| {
        if (alloc.stack == stack_count) {
            var stack_args: [stack_count]isize = undefined;
            @memcpy(&stack_args, alloc.stack_values[0..stack_count]);
            break callWithArgs(RT, f.calling_convention, function, float_args, int_args, stack_args);
        }
    } else unreachable;
}

const max_arg_count = 32;
const max_stack_count = max_arg_count - @min(abi.registers.int, abi.registers.float);
const Abi = struct {
    registers: struct {
        int: comptime_int,
        float: comptime_int,
    },
    FloatType: type = f64,
    IntType: type = isize,
};
const abi: Abi = switch (builtin.target.cpu.arch) {
    .x86_64 => switch (builtin.target.os.tag) {
        .windows => .{
            .registers = .{
                // RCX, RDX, R8, R9
                .int = 4,
                // XMM0, XMM1, XMM2, XMM3
                .float = 4,
            },
        },
        else => .{
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
    },
    .arm, .armeb => .{
        .registers = .{ .int = 0, .float = 0 },
    },
    else => @compileError("Unsupported platform"),
};

const Allocation = struct {
    float: usize = 0,
    int: usize = 0,
    stack: usize = 0,
    float_values: [abi.registers.float]abi.FloatType = undefined,
    int_values: [abi.registers.int]abi.IntType = undefined,
    stack_values: [max_stack_count]abi.IntType = undefined,
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
                    .bits = @typeInfo(abi.IntType).Int.bits,
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

fn allocate(arg_ptr: [*]const u8, arg_attrs: []const ArgAttributes) !Allocation {
    var alloc: Allocation = .{};
    loop: for (arg_attrs) |a| {
        var bytes = arg_ptr[a.offset .. a.offset + @as(u16, @intCast(a.size))];
        if (a.is_float) {
            if (a.size <= @sizeOf(abi.FloatType) * 2 and comptime abi.registers.float > 0) {
                while (true) {
                    if (alloc.float < alloc.float_values.len) {
                        const end = @min(bytes.len, @sizeOf(abi.FloatType));
                        alloc.float_values[alloc.float] = floatFromBytes(bytes[0..end]);
                        alloc.float += 1;
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
                    if (alloc.int < alloc.int_values.len) {
                        const end = @min(bytes.len, @sizeOf(abi.IntType));
                        alloc.int_values[alloc.int] = intFromBytes(bytes[0..end], a.is_signed);
                        alloc.int += 1;
                        if (end == bytes.len) continue :loop;
                        bytes = bytes[end..];
                    } else {
                        break;
                    }
                }
            }
        }
        if (a.size <= @sizeOf(abi.IntType) * 2) {
            while (true) {
                if (alloc.stack < alloc.stack_values.len) {
                    const end = @min(bytes.len, @sizeOf(abi.IntType));
                    alloc.stack_values[alloc.stack] = intFromBytes(bytes[0..end], a.is_signed);
                    alloc.stack += 1;
                    if (end == bytes.len) continue :loop;
                    bytes = bytes[end..];
                } else {
                    return Error.too_many_arguments;
                }
            }
        } else {
            if (alloc.stack < alloc.stack_values.len) {
                alloc.stack_values[alloc.stack] = @bitCast(@intFromPtr(bytes.ptr));
                alloc.stack += 1;
            } else {
                return Error.too_many_arguments;
            }
        }
    }
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
            p.type = if (index < float_args.len) f64 else isize;
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
    const function: *const F = @ptrCast(ptr);
    comptime var tuple_fields: [params.len]std.builtin.Type.StructField = undefined;
    inline for (params, 0..) |param, index| {
        const T = param.type.?;
        tuple_fields[index] = .{
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
            .fields = &tuple_fields,
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
