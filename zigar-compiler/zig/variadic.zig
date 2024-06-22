const std = @import("std");
const builtin = @import("builtin");

pub const max_arg_count = 32;
pub const ArgAttributes = packed struct {
    offset: u16,
    size: u8,
    is_float: bool = false,
    is_signed: bool = false,
};
pub const Error = error{
    too_many_arguments,
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

const Destination = enum { int, float, stack };
const Allocation = struct {
    int: usize = 0,
    float: usize = 0,
    stack: usize = 0,
    total: usize = 0,
    destinations: [max_arg_count]Destination = undefined,
};

pub fn convert(comptime T: type, arg_ptr: [*]const u8, a: ArgAttributes) T {
    const start = a.offset;
    const end = start + @as(u16, @intCast(a.size));
    const bytes = arg_ptr[start..end];
    if (a.is_float) {
        const value: f64 = switch (a.size) {
            4 => @floatCast(std.mem.bytesToValue(f32, bytes)),
            8 => std.mem.bytesToValue(f64, bytes),
            else => unreachable,
        };
        return if (T == f64) value else @bitCast(value);
    } else if (T == isize) {
        const value: isize = switch (a.size) {
            1 => @intCast(std.mem.bytesToValue(i8, bytes)),
            2 => @intCast(std.mem.bytesToValue(i16, bytes)),
            4 => @intCast(std.mem.bytesToValue(i32, bytes)),
            8 => if (@sizeOf(isize) == 8) std.mem.bytesToValue(i32, bytes) else unreachable,
            else => unreachable,
        };
        return value;
    } else unreachable;
}

pub fn allocate(arg_attrs: []const ArgAttributes) !Allocation {
    var alloc: Allocation = .{};
    for (arg_attrs, 0..) |a, index| {
        var dest: ?Destination = null;
        if (a.is_float and a.size <= @sizeOf(f64)) {
            if (alloc.float + 1 <= registers.float) {
                alloc.float += 1;
                dest = .float;
            }
        } else {
            if (a.size == @sizeOf(usize) * 2) {
                if (alloc.int + 2 <= registers.int) {
                    alloc.int += 2;
                    dest = .int;
                }
            } else {
                if (alloc.int + 1 <= registers.int) {
                    alloc.int += 1;
                    dest = .int;
                }
            }
        }
        if (dest == null) {
            alloc.stack += if (a.size == @sizeOf(usize) * 2) 2 else 1;
            dest = .stack;
        }
        if (alloc.stack >= max_stack_count or index >= max_arg_count) {
            return Error.too_many_arguments;
        }
        alloc.destinations[index] = dest.?;
    }
    return alloc;
}

pub fn copy(
    arg_ptr: [*]const u8,
    arg_attrs: []const ArgAttributes,
    alloc: Allocation,
    float_args: []f64,
    int_args: []isize,
    stack_args: []isize,
) void {
    var float_index: usize = 0;
    var int_index: usize = 0;
    var stack_index: usize = 0;
    for (arg_attrs, 0..) |a, index| {
        switch (alloc.destinations[index]) {
            .float => {
                float_args[float_index] = convert(f64, arg_ptr, a);
                float_index += 1;
            },
            else => |d| {
                const ptr_args = if (d == .int) &int_args else &stack_args;
                const ptr_index = if (d == .int) &int_index else &stack_index;
                if (a.size <= @sizeOf(usize)) {
                    ptr_args.*[ptr_index.*] = convert(isize, arg_ptr, a);
                    ptr_index.* += 1;
                } else if (a.size == @sizeOf(usize) * 2) {
                    ptr_args.*[ptr_index.*] = convert(isize, arg_ptr, .{
                        .offset = a.offset,
                        .size = @sizeOf(usize),
                    });
                    ptr_index.* += 1;
                    ptr_args.*[ptr_index.*] = convert(isize, arg_ptr, .{
                        .offset = a.offset + @sizeOf(usize),
                        .size = @sizeOf(usize),
                    });
                    ptr_index.* += 1;
                } else {
                    ptr_args.*[ptr_index.*] = @bitCast(@intFromPtr(&arg_ptr[a.offset]));
                    ptr_index.* += 1;
                }
            },
        }
    }
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
