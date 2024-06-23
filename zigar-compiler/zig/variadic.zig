const std = @import("std");
const builtin = @import("builtin");

pub const max_arg_count = 32;
pub const ArgAttributes = packed struct {
    offset: u16,
    size: u8,
    is_float: bool = false,
};
pub const Error = error{
    too_many_arguments,
    invalid_type_for_variadic_function,
};
pub const Registers = struct {
    int: comptime_int,
    float: comptime_int,
};
pub const registers: Registers = switch (builtin.target.cpu.arch) {
    .x86 => .{ .int = 0, .float = 0 },
    .x86_64 => switch (builtin.target.os.tag) {
        .windows => .{ .int = 4, .float = 4 },
        else => .{ .int = 6, .float = 8 },
    },
    .arm, .armeb => .{ .int = 0, .float = 0 },
    .aarch64, .aarch64_be, .aarch64_32 => .{ .int = 8, .float = 8 },
    else => @compileError("Unsupported platform"),
};
pub const max_stack_count = max_arg_count - @min(registers.int, registers.float);

const Allocation = struct {
    float: usize = 0,
    int: usize = 0,
    stack: usize = 0,
    float_values: [registers.float]f64 = undefined,
    int_values: [registers.int]isize = undefined,
    stack_values: [max_stack_count]isize = undefined,
};

pub fn allocate(arg_ptr: [*]const u8, arg_attrs: []const ArgAttributes) !Allocation {
    var alloc: Allocation = .{};
    for (arg_attrs) |a| {
        const bytes = arg_ptr[a.offset .. a.offset + @as(u16, @intCast(a.size))];
        const toValue = std.mem.bytesToValue;
        if (a.is_float) {
            var values: [2]?f64 = .{ null, null };
            values[0] = switch (a.size) {
                2 => @bitCast(@as(i64, @intCast(@as(i16, @bitCast(toValue(f16, bytes)))))),
                4 => @bitCast(@as(i64, @intCast(@as(i32, @bitCast(toValue(f32, bytes)))))),
                8 => std.mem.bytesToValue(f64, bytes),
                12 => @bitCast(@as(i64, @intCast(@as(i32, @bitCast(toValue(f32, bytes[0..8])))))),
                16 => std.mem.bytesToValue(f64, bytes[0..8]),
                else => return Error.invalid_type_for_variadic_function,
            };
            values[1] = switch (a.size) {
                12 => toValue(f64, bytes[4..12]),
                16 => toValue(f64, bytes[8..16]),
                else => null,
            };
            const needed: usize = if (values[1] != null) 2 else 1;
            if (alloc.float + needed <= alloc.float_values.len) {
                alloc.float_values[alloc.float] = values[0].?;
                if (values[1] != null) {
                    alloc.float_values[alloc.float + 1] = values[1].?;
                }
                alloc.float += needed;
            } else if (alloc.stack + needed <= alloc.stack_values.len) {
                alloc.stack_values[alloc.stack] = @bitCast(values[0].?);
                if (values[1] != null) {
                    alloc.stack_values[alloc.stack + 1] = @bitCast(values[1].?);
                }
                alloc.stack += needed;
            } else {
                return Error.too_many_arguments;
            }
        } else {
            var values: [2]?isize = .{ null, null };
            values[0] = switch (a.size) {
                1 => @intCast(toValue(i8, bytes)),
                2 => @intCast(toValue(i16, bytes)),
                4 => @intCast(toValue(i32, bytes)),
                8 => switch (@sizeOf(isize)) {
                    8 => toValue(i32, bytes),
                    4 => toValue(i32, bytes[0..4]),
                    else => unreachable,
                },
                16 => switch (@sizeOf(usize)) {
                    8 => toValue(i32, bytes[0..8]),
                    4 => @bitCast(@intFromPtr(&bytes[0])),
                    else => unreachable,
                },
                else => @bitCast(@intFromPtr(&bytes[0])),
            };
            values[1] = switch (a.size) {
                8 => switch (@sizeOf(usize)) {
                    4 => toValue(i32, bytes[0..4]),
                    else => null,
                },
                16 => switch (@sizeOf(usize)) {
                    8 => toValue(i32, bytes[8..16]),
                    else => null,
                },
                else => null,
            };
            const needed: usize = if (values[1] != null) 2 else 1;
            if (alloc.int + needed <= alloc.int_values.len) {
                alloc.int_values[alloc.int] = values[0].?;
                if (values[1] != null) {
                    alloc.int_values[alloc.int + 1] = values[1].?;
                }
                alloc.int += needed;
            } else if (alloc.stack + needed <= alloc.stack_values.len) {
                alloc.stack_values[alloc.stack] = values[0].?;
                if (values[1] != null) {
                    alloc.stack_values[alloc.stack + 1] = values[1].?;
                }
                alloc.stack += needed;
            } else {
                return Error.too_many_arguments;
            }
        }
    }
    if (alloc.int + alloc.float + alloc.stack > max_arg_count) {
        return Error.too_many_arguments;
    }
    return alloc;
}

pub fn call(
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
            .is_var_args = false,
            .return_type = RT,
            .params = &params,
        },
    });
    const function: *const F = @ptrCast(ptr);
    const Args = std.meta.ArgsTuple(F);
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
