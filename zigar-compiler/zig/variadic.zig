const std = @import("std");
const builtin = @import("builtin");
const types = @import("./types.zig");
const assert = std.debug.assert;

pub const Error = error{
    too_many_arguments,
    unsupported_type_for_variadic_function,
    invalid_argument_attributes,
};

pub fn call(function: anytype, arg_struct: anytype, attr_ptr: *const anyopaque, arg_count: usize) !void {
    const is_wasm = switch (builtin.target.cpu.arch) {
        .wasm32, .wasm64 => true,
        else => false,
    };
    const f = @typeInfo(@TypeOf(function)).Fn;
    const arg_bytes: [*]u8 = @ptrCast(arg_struct);
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
            false => @sizeOf(@TypeOf(arg_struct)),
        };
        const vararg_ptr: [*]const u8 = arg_bytes[vararg_offset..];
        inline for (0..f.params.len + 1) |index| {
            if (index < f.params.len) {
                const name = std.fmt.comptimePrint("{d}", .{index});
                args[index] = @field(arg_struct.*, name);
            } else {
                args[index] = vararg_ptr;
            }
        }
        arg_struct.retval = @call(.auto, function_ptr, args);
    } else {
        const alloc = try Allocation.init(arg_bytes, arg_attrs, f.params.len);
        // alloc.dump();
        const int_args = alloc.getInts();
        const float_args = alloc.getFloats();
        arg_struct.retval = inline for (0..max_stack_count + 1) |stack_count| {
            if (alloc.getStackCount() == stack_count) {
                const stack_args = alloc.getStack(stack_count);
                const result = callWithArgs(f.return_type.?, f.calling_convention, function, float_args, int_args, stack_args);
                break result;
            }
        } else unreachable;
    }
}

const max_arg_count = 32;
const max_stack_count = max_arg_count - @min(abi.registers.int, abi.registers.float);
const ArgAttributes = extern struct {
    offset: u16,
    size: u16,
    alignment: u16,
    is_float: bool,
    is_signed: bool,
};
const Abi = struct {
    FloatType: type = f64,
    IntType: type = isize,
    registers: struct {
        int: comptime_int,
        float: comptime_int,
    },
    min_float_align: comptime_int = @alignOf(f64),
    min_int_align: comptime_int = @alignOf(isize),
    min_stack_align: comptime_int = @alignOf(isize),
    pass_variadic_float_as_int: bool = false,
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
            .min_float_align = @alignOf(f128),
            .pass_variadic_float_as_int = true,
        },
        else => .{
            .FloatType = f128,
            .registers = .{
                // RDI, RSI, RDX, RCX, R8, R9
                .int = 6,
                // XMM0 - XMM7
                .float = 8,
            },
            .min_float_align = @alignOf(f128),
        },
    },
    .aarch64, .aarch64_be, .aarch64_32 => .{
        .registers = .{
            // x0 - x7
            .int = 8,
            .float = 0,
        },
    },
    .riscv64 => .{
        .registers = .{
            // a0 - a7
            .int = 8,
            .float = 8,
        },
        .min_int_align = @alignOf(i32),
        .pass_variadic_float_as_int = true,
    },
    // .powerpc64le => .{
    //     .registers = .{ .int = 0, .float = 0 },
    // },
    .x86 => .{
        .registers = .{ .int = 0, .float = 0 },
        .min_stack_align = @alignOf(i8),
    },
    .arm, .armeb => .{
        .registers = .{ .int = 0, .float = 0 },
    },
    else => @compileError("Variadic functions not supported on this architecture: " ++ @tagName(builtin.target.cpu.arch)),
};
const Allocation = struct {
    const Bin = enum { float, int, stack };

    float_offset: usize = 0,
    int_offset: usize = 0,
    stack_offset: usize = 0,
    float_bytes: [abi.registers.float * @sizeOf(abi.FloatType)]u8 align(@alignOf(abi.FloatType)) = undefined,
    int_bytes: [abi.registers.int * @sizeOf(abi.IntType)]u8 align(@alignOf(abi.IntType)) = undefined,
    stack_bytes: [max_stack_count * @sizeOf(abi.IntType)]u8 align(@alignOf(abi.IntType)) = undefined,

    fn getFloats(self: *const @This()) *const [abi.registers.float]abi.FloatType {
        return @ptrCast(&self.float_bytes);
    }

    fn getInts(self: *const @This()) *const [abi.registers.int]abi.IntType {
        return @ptrCast(&self.int_bytes);
    }

    fn getStack(self: *const @This(), comptime count: usize) *const [count]abi.IntType {
        return @ptrCast(&self.stack_bytes);
    }

    fn getFloatCount(self: *const @This()) usize {
        return self.float_offset / @sizeOf(abi.FloatType);
    }

    fn getIntCount(self: *const @This()) usize {
        return self.int_offset / @sizeOf(abi.IntType);
    }

    fn getStackCount(self: *const @This()) usize {
        return self.stack_offset / @sizeOf(abi.IntType);
    }

    fn init(arg_bytes: [*]const u8, arg_attrs: []const ArgAttributes, fixed_arg_count: usize) !@This() {
        var self: @This() = .{};
        for (&self.float_bytes) |*p| p.* = 0xAA;
        for (&self.int_bytes) |*p| p.* = 0xAA;
        for (&self.stack_bytes) |*p| p.* = 0xAA;
        loop: for (arg_attrs, 0..) |a, index| {
            var bytes = arg_bytes[a.offset .. a.offset + a.size];
            if (a.alignment == 0) {
                return Error.invalid_argument_attributes;
            }
            const can_use_float = switch (abi.pass_variadic_float_as_int) {
                false => true,
                true => index < fixed_arg_count,
            };
            if (a.is_float and can_use_float) {
                if (a.size <= @sizeOf(abi.FloatType) * 2 and comptime abi.registers.float > 0) {
                    while (true) {
                        const end = @min(bytes.len, @sizeOf(abi.FloatType));
                        if (self.use(.float, bytes[0..end], a)) {
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
                        const end = @min(bytes.len, @sizeOf(abi.IntType));
                        if (self.use(.int, bytes[0..end], a)) {
                            if (end == bytes.len) continue :loop;
                            bytes = bytes[end..];
                        } else {
                            break;
                        }
                    }
                }
            }
            if (!self.use(.stack, bytes, a)) {
                return Error.too_many_arguments;
            }
        }
        const float_align: usize = @alignOf(abi.FloatType);
        self.float_offset = (self.float_offset + float_align - 1) & ~(float_align - 1);
        const int_align: usize = @alignOf(abi.IntType);
        self.int_offset = (self.int_offset + int_align - 1) & ~(int_align - 1);
        self.stack_offset = (self.stack_offset + int_align - 1) & ~(int_align - 1);
        return self;
    }

    fn use(self: *@This(), bin: Bin, bytes: []const u8, a: ArgAttributes) bool {
        const min_align: usize = switch (bin) {
            .float => abi.min_float_align,
            .int => abi.min_int_align,
            .stack => abi.min_stack_align,
        };
        const max_align: usize = switch (bin) {
            .float => @alignOf(abi.FloatType),
            .int => @alignOf(abi.IntType),
            .stack => @alignOf(abi.IntType),
        };
        const offset_ptr = switch (bin) {
            .float => &self.float_offset,
            .int => &self.int_offset,
            .stack => &self.stack_offset,
        };
        const destination = switch (bin) {
            .float => &self.float_bytes,
            .int => &self.int_bytes,
            .stack => &self.stack_bytes,
        };
        const arg_align: usize = @max(min_align, @min(a.alignment, max_align));
        const start = offset_ptr.*;
        const offset = (start + arg_align - 1) & ~(arg_align - 1);
        const next_offset = offset + bytes.len;
        if (next_offset <= destination.len) {
            const padding_bytes = destination[start..offset];
            for (padding_bytes) |*p| p.* = 0;
            const dest_bytes = destination[offset..next_offset];
            @memcpy(dest_bytes, bytes);
            offset_ptr.* = next_offset;
            return true;
        } else {
            return false;
        }
    }

    fn dump(self: *const @This()) void {
        std.debug.print("\n", .{});
        const int_reg_count = self.getIntCount();
        if (int_reg_count > 0) {
            const int_regs = self.getInts();
            const int_regs_in_use = int_regs.*[0..int_reg_count];
            std.debug.print("Int registers: {any}\n", .{int_regs_in_use});
        }
        const float_reg_count = self.getFloatCount();
        if (float_reg_count > 0) {
            const float_regs = self.getFloats();
            const float_regs_in_use = float_regs.*[0..float_reg_count];
            std.debug.print("Float registers: {any}\n", .{float_regs_in_use});
        }
        const stack_word_count = self.getStackCount();
        if (stack_word_count > 0) {
            const stack_words = self.getStack(max_stack_count);
            const stack_words_in_use = stack_words.*[0..stack_word_count];
            std.debug.print("Stack: {any}\n", .{stack_words_in_use});
        }
    }
};

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
            .is_var_args = false,
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

fn createTest(RT: type, tuple: anytype) type {
    const ArgStruct = types.ArgumentStruct(fn (@TypeOf(tuple[0]), ...) callconv(.C) RT);
    comptime var current_offset: u16 = @sizeOf(ArgStruct);
    comptime var offsets: [tuple.len]u16 = undefined;
    inline for (tuple, 0..) |value, index| {
        const T = @TypeOf(value);
        const alignment: u16 = @alignOf(T);
        const offset = (current_offset + alignment - 1) & ~(alignment - 1);
        offsets[index] = offset;
        current_offset = offset + @sizeOf(T);
    }
    const arg_size = current_offset;
    return struct {
        fn check(arg0: @TypeOf(tuple[0]), ...) callconv(.C) RT {
            var va_list = @cVaStart();
            defer @cVaEnd(&va_list);
            var failed = false;
            inline for (tuple, 0..) |value, index| {
                const arg = switch (index) {
                    0 => arg0,
                    else => @cVaArg(&va_list, @TypeOf(value)),
                };
                const bytes1 = std.mem.toBytes(arg);
                const bytes2 = std.mem.toBytes(value);
                if (!std.mem.eql(u8, &bytes1, &bytes2)) {
                    std.debug.print("Mismatch: {any} != {any} (arg{d})\n", .{ arg, value, index });
                    std.debug.print("     arg: {x}\n", .{bytes1});
                    std.debug.print("   tuple: {x}\n", .{bytes2});
                    failed = true;
                }
            }
            return if (failed) 0 else 777;
        }

        pub fn run() void {
            var arg_bytes: [arg_size]u8 = undefined;
            var attrs: [tuple.len]ArgAttributes = undefined;
            inline for (&attrs, 0..) |*p, index| {
                const offset = offsets[index];
                const value = tuple[index];
                const T = @TypeOf(value);
                p.* = .{
                    .offset = offset,
                    .size = @sizeOf(T),
                    .alignment = @alignOf(T),
                    .is_float = @typeInfo(T) == .Float,
                    .is_signed = @typeInfo(T) == .Int and @typeInfo(T).Int.signedness == .signed,
                };
                const bytes = std.mem.toBytes(value);
                @memcpy(arg_bytes[offset .. offset + bytes.len], &bytes);
            }
            const argStruct = @as(*ArgStruct, @ptrCast(@alignCast(&arg_bytes)));
            call(check, argStruct, @ptrCast(&attrs), attrs.len) catch |err| {
                std.debug.print("Error: {s}", .{@errorName(err)});
                panic("Error happend");
            };
            if (argStruct.retval != 777) {
                panic("Parameters do not match");
            }
        }

        pub fn panic(message: []const u8) noreturn {
            comptime var type_list: [tuple.len][]const u8 = undefined;
            inline for (tuple, 0..) |value, index| {
                type_list[index] = @typeName(@TypeOf(value));
            }
            std.debug.print("   types: {s}\n", .{type_list});
            if (builtin.target.cpu.arch == .x86_64) {
                @panic(message);
            } else {
                // dumpStackTrace() doesn't work correctly for other archs
                // avoid the panic in panic error by simply exiting
                std.debug.print("Panic: {s}\n", .{message});
                std.process.exit(1);
            }
        }
    };
}

test "parameter passing - u32" {
    createTest(u32, .{
        @as(u32, 1234),
    }).run();
}

test "parameter passing - i32" {
    createTest(i32, .{
        @as(i32, -1234),
    }).run();
}

test "parameter passing - i32, i32" {
    createTest(u32, .{
        @as(i32, 1234),
        @as(i32, 4567),
    }).run();
}

test "parameter passing - f32" {
    createTest(f32, .{
        @as(f64, 1.234),
    }).run();
}

test "parameter passing - i32, f32" {
    createTest(u32, .{
        @as(i32, 1234),
        @as(f32, 1.2345),
    }).run();
}

test "parameter passing - f32, f32" {
    createTest(u32, .{
        @as(f32, 1.234),
        @as(f32, 4.5678),
    }).run();
}

test "parameter passing - f32, f32, f32" {
    createTest(u32, .{
        @as(f32, 1.234),
        @as(f32, 4.567),
        @as(f32, 7.890),
    }).run();
}

test "parameter passing - f64, f64, f64" {
    createTest(f64, .{
        @as(f64, 1.234),
        @as(f64, 4.567),
        @as(f64, 7.890),
    }).run();
}

test "parameter passing - f128, f128, f128" {
    createTest(f128, .{
        @as(f128, 1.234),
        @as(f128, 4.567),
        @as(f128, 7.890),
    }).run();
}

test "parameter passing - i32, f32, f32" {
    createTest(u32, .{
        @as(i32, 1234),
        @as(f32, 1.234),
        @as(f32, 4.567),
    }).run();
}

test "parameter passing - u64, f32, f64" {
    createTest(u32, .{
        @as(u64, 1234),
        @as(f32, 1.234),
        @as(f64, 4.567),
    }).run();
}

test "parameter passing - f128, f64, f32" {
    createTest(u32, .{
        @as(f128, 1234),
        @as(f64, 1.234),
        @as(f32, 4.567),
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

test "parameter passing - f64, f64, f64, f64, f64, f64, f64, f64" {
    createTest(u32, .{
        @as(f64, 0.1),
        @as(f64, 0.2),
        @as(f64, 0.3),
        @as(f64, 0.4),
        @as(f64, 0.5),
        @as(f64, 0.6),
        @as(f64, 0.7),
        @as(f64, 0.8),
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

test "parameter passing - f128, f128, f128, f64, f64, f64, f64, f64" {
    createTest(f64, .{
        @as(f128, 0.1),
        @as(f128, 0.2),
        @as(f128, 0.3),
        @as(f64, 0.4),
        @as(f64, 0.5),
        @as(f64, 0.6),
        @as(f64, 0.7),
        @as(f64, 0.8),
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

test "parameter passing - i64, i64" {
    createTest(i64, .{
        @as(i64, -1),
        @as(i64, -2),
    }).run();
}

test "parameter passing - u128, u128" {
    createTest(i64, .{
        @as(u128, 0xFFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF),
        @as(u128, 0xFFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFE),
    }).run();
}

// test "parameter passing - u128, u128, u128, u128" {
//     createTest(i64, .{
//         @as(u128, 1000),
//         @as(u128, 2000),
//         @as(u128, 3000),
//         @as(u128, 4000),
//     }).run();
// }

const c = switch (builtin.link_libc) {
    true => @cImport({
        @cInclude("stdio.h");
    }),
    false => {},
};

fn createSprintfTest(fmt: []const u8, tuple: anytype) type {
    const FT = @TypeOf(c.sprintf);
    const f = @typeInfo(FT).Fn;
    const ArgStruct = types.ArgumentStruct(FT);
    comptime var current_offset: u16 = @sizeOf(ArgStruct);
    comptime var offsets: [f.params.len + tuple.len]u16 = undefined;
    inline for (f.params, 0..) |param, index| {
        const alignment: u16 = @alignOf(param.type.?);
        const offset = (current_offset + alignment - 1) & ~(alignment - 1);
        offsets[index] = offset;
        current_offset = offset + @sizeOf(param.type.?);
    }
    inline for (tuple, 0..) |value, index| {
        const T = @TypeOf(value);
        const alignment: u16 = @alignOf(T);
        const offset = (current_offset + alignment - 1) & ~(alignment - 1);
        offsets[f.params.len + index] = offset;
        current_offset = offset + @sizeOf(T);
    }
    const arg_size = current_offset;
    return struct {
        pub fn run() void {
            var arg_bytes: [arg_size]u8 align(@alignOf(ArgStruct)) = undefined;
            var attrs: [f.params.len + tuple.len]ArgAttributes = undefined;
            var buffer1 = std.mem.zeroes([256]u8);
            inline for (&attrs, 0..) |*p, index| {
                const offset = offsets[index];
                const value = switch (index) {
                    0 => @as([*c]u8, @ptrCast(&buffer1)),
                    1 => @as([*c]const u8, @ptrCast(fmt)),
                    else => tuple[index - f.params.len],
                };
                const T = @TypeOf(value);
                p.* = .{
                    .offset = offset,
                    .size = @sizeOf(T),
                    .alignment = @alignOf(T),
                    .is_float = @typeInfo(T) == .Float,
                    .is_signed = @typeInfo(T) == .Int and @typeInfo(T).Int.signedness == .signed,
                };
                const bytes = std.mem.toBytes(value);
                @memcpy(arg_bytes[offset .. offset + bytes.len], &bytes);
            }
            const argStruct = @as(*ArgStruct, @ptrCast(@alignCast(&arg_bytes)));
            call(c.sprintf, argStruct, @ptrCast(&attrs), attrs.len) catch |err| {
                std.debug.print("Error: {s}", .{@errorName(err)});
                panic("Error happend");
            };

            if (argStruct.retval >= 0) {
                // call sprintf() directly
                var buffer2 = std.mem.zeroes([256]u8);
                comptime var arg_types: [f.params.len + tuple.len]type = undefined;
                inline for (f.params, 0..) |param, index| {
                    arg_types[index] = param.type.?;
                }
                inline for (tuple, 0..) |value, index| {
                    arg_types[f.params.len + index] = @TypeOf(value);
                }
                const ArgTuple = std.meta.Tuple(&arg_types);
                var arg_tuple: ArgTuple = undefined;
                inline for (&arg_tuple, 0..) |*a, index| {
                    a.* = switch (index) {
                        0 => @ptrCast(&buffer2),
                        1 => @ptrCast(fmt),
                        else => tuple[index - f.params.len],
                    };
                }
                const retval2: isize = @call(.auto, c.sprintf, arg_tuple);
                if (retval2 >= 0) {
                    const len1: usize = @intCast(argStruct.retval);
                    const len2: usize = @intCast(retval2);
                    const s1 = buffer1[0..len1];
                    const s2 = buffer2[0..len2];
                    if (s1.len != s2.len or !std.mem.eql(u8, s1, s2)) {
                        std.debug.print("Mismatch: {s} != {s}", .{ s1, s2 });
                        panic("Result does not match");
                    }
                } else {
                    panic("Direct call failed");
                }
            } else {
                panic("Call failed");
            }
        }

        pub fn panic(message: []const u8) noreturn {
            if (builtin.target.cpu.arch == .x86_64) {
                @panic(message);
            } else {
                // don't think we can obtain the backtrace for other arch yet
                // avoid the panic in panic error by simply exiting
                std.debug.print("Panic: {s}\n", .{message});
                std.process.exit(1);
            }
        }
    };
}

test "sprintf - i64" {
    if (!builtin.link_libc) return;
    createSprintfTest("%d", .{
        @as(i64, 1234),
    }).run();
}

test "sprintf - i64 i32" {
    if (!builtin.link_libc) return;
    createSprintfTest("%d %d", .{
        @as(i64, 1234),
        @as(i32, 4567),
    }).run();
}

test "sprintf - i64 i32 f64" {
    if (!builtin.link_libc) return;
    createSprintfTest("%d %d %f", .{
        @as(i64, 1234),
        @as(i32, 4567),
        @as(f64, 3.14),
    }).run();
}

test "sprintf - i64 i32 f64 [*:0]const u8" {
    if (!builtin.link_libc) return;
    createSprintfTest("%d %d %f %s", .{
        @as(i64, 1234),
        @as(i32, 4567),
        @as(f64, 3.14),
        @as([*:0]const u8, "Hello world"),
    }).run();
}
