const std = @import("std");
const builtin = @import("builtin");
const types = @import("./types.zig");

const alignForward = std.mem.alignForward;

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
        var function_ptr: *const F = @ptrCast(&function);
        std.mem.doNotOptimizeAway(&function_ptr);
        arg_struct.retval = @call(.auto, function_ptr, args);
    } else {
        const alloc = try Allocation.init(arg_bytes, arg_attrs, f.params.len);
        // on most platforms, we can call the function with extra pass-by-register arguments;
        // they just gets ignored; this reduce the number of functions we need to generate
        // on PowerPC we can't do that, since stack space is allocated for pass-by-register
        // arguments; luckily only fixed arguments are passed by register so we just need
        // to count those
        const max_int_count = switch (abi.register_shadowing) {
            false => abi.registers.int,
            true => comptime count: {
                var n = 0;
                for (@typeInfo(@TypeOf(function)).Fn.params) |param| {
                    if (param.type) |T| {
                        switch (@typeInfo(T)) {
                            .Float => {},
                            else => {
                                if (@sizeOf(T) <= abi.limits.int) {
                                    const size = std.mem.alignForward(usize, @sizeOf(T), @sizeOf(abi.IntType));
                                    n += size / @sizeOf(abi.IntType);
                                }
                            },
                        }
                    }
                }
                break :count @min(abi.registers.float, n);
            },
        };
        const max_float_count = switch (abi.register_shadowing) {
            false => abi.registers.float,
            true => comptime count: {
                var n = 0;
                for (@typeInfo(@TypeOf(function)).Fn.params) |param| {
                    if (param.type) |T| {
                        switch (@typeInfo(T)) {
                            .Float => {
                                if (@sizeOf(T) <= abi.limits.float) {
                                    const size = std.mem.alignForward(usize, @sizeOf(T), @sizeOf(abi.IntType));
                                    n += size / @sizeOf(abi.IntType);
                                }
                            },
                            else => {},
                        }
                    }
                }
                break :count @min(abi.registers.int, n);
            },
        };
        const int_args = alloc.get(.int, max_int_count);
        const float_args = alloc.get(.float, max_float_count);
        arg_struct.retval = inline for (0..max_stack_count + 1) |stack_count| {
            if (alloc.getCount(.stack) == stack_count) {
                const stack_args = alloc.get(.stack, stack_count);
                break callWithArgs(f.return_type.?, f.calling_convention, function, float_args, int_args, stack_args);
            }
        } else unreachable;
    }
}

const max_stack_count = 32;
const ArgAttributes = extern struct {
    offset: u16,
    size: u16,
    alignment: u16,
    is_float: bool,
    is_signed: bool,
};
const ArgDestination = enum { float, int, stack };
const Abi = struct {
    FloatType: type = f64,
    IntType: type = isize,
    registers: struct {
        int: comptime_int,
        float: comptime_int,
    },
    limits: struct {
        int: comptime_int = @sizeOf(isize) * 2,
        float: comptime_int = @sizeOf(f64) * 2,
    } = .{},
    min_align: struct {
        int: comptime_int = @alignOf(isize),
        float: comptime_int = @alignOf(f64),
        stack: struct {
            int: comptime_int = @alignOf(isize),
            float: comptime_int = @alignOf(isize),
        } = .{},
    } = .{},
    max_align: struct {
        stack: struct {
            int: ?comptime_int = null,
            float: ?comptime_int = null,
        } = .{},
    } = .{},
    variadic: struct {
        int: ArgDestination = .int,
        float: ArgDestination = .float,
    } = .{},
    misfitting: struct {
        int: ArgDestination = .stack,
        float: ArgDestination = .stack,
    } = .{},
    float_promotion: bool = false,
    register_shadowing: bool = false,
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
            .limits = .{
                .float = @sizeOf(f128),
            },
            .min_align = .{
                .float = @alignOf(f128),
            },
            .variadic = .{
                .float = .int,
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
            .limits = .{
                .float = @sizeOf(f128),
            },
            .min_align = .{
                .float = @alignOf(f128),
            },
        },
    },
    .aarch64 => switch (builtin.target.os.tag) {
        .macos, .ios, .tvos, .watchos => .{
            .FloatType = f128,
            .registers = .{
                // x0 - x7
                .int = 8,
                // v0 - v7
                .float = 8,
            },
            .limits = .{
                .float = @sizeOf(f128),
            },
            .min_align = .{
                .float = @alignOf(f128),
            },
            .variadic = .{
                .int = .stack,
                .float = .stack,
            },
        },
        else => .{
            .FloatType = f128,
            .registers = .{
                // x0 - x7
                .int = 8,
                // v0 - v7
                .float = 8,
            },
            .limits = .{
                .float = @sizeOf(f128),
            },
            .min_align = .{
                .float = @alignOf(f128),
            },
        },
    },
    .riscv64 => .{
        .registers = .{
            // a0 - a7
            .int = 8,
            .float = 8,
        },
        .limits = .{
            .int = 8 * @sizeOf(isize),
            .float = @sizeOf(f64),
        },
        .min_align = .{
            .int = @alignOf(i32),
            .float = @alignOf(i64),
            .stack = .{
                .int = @sizeOf(isize),
                .float = @sizeOf(isize),
            },
        },
        .variadic = .{
            .float = .int,
        },
        .misfitting = .{
            .float = .int,
        },
    },
    .powerpc64le => .{
        .registers = .{
            // r3 - r10
            .int = 8,
            // f1 - f13
            .float = 13,
        },
        .variadic = .{
            .int = .stack,
            .float = .stack,
        },
        .limits = .{
            .float = @sizeOf(f64),
        },
        .min_align = .{
            .stack = .{
                .float = @sizeOf(i32),
            },
        },
        .float_promotion = true,
        .register_shadowing = true,
    },
    .x86 => .{
        .registers = .{
            .int = 0,
            .float = 0,
        },
        .min_align = .{
            .stack = .{
                .int = @alignOf(i8),
                .float = @alignOf(i8),
            },
        },
        .max_align = .{
            .stack = .{
                .float = @alignOf(i32),
            },
        },
    },
    .arm => .{
        .registers = .{
            .int = 0,
            .float = 0,
        },
    },
    else => @compileError("Variadic functions not supported on this architecture: " ++ @tagName(builtin.target.cpu.arch)),
};
const Allocation = struct {
    const Type = enum { float, int, stack };

    float_offset: usize = 0,
    int_offset: usize = 0,
    stack_offset: usize = 0,
    float_bytes: [abi.registers.float * @sizeOf(abi.FloatType)]u8 align(@alignOf(abi.FloatType)) = undefined,
    int_bytes: [abi.registers.int * @sizeOf(abi.IntType)]u8 align(@alignOf(abi.IntType)) = undefined,
    stack_bytes: [max_stack_count * @sizeOf(abi.IntType)]u8 align(@alignOf(abi.IntType)) = undefined,

    fn get(self: *const @This(), comptime bin: ArgDestination, comptime count: usize) *const [count]switch (bin) {
        .float => abi.FloatType,
        else => abi.IntType,
    } {
        const bytes = &@field(self, @tagName(bin) ++ "_bytes");
        return @ptrCast(bytes);
    }

    fn getCount(self: *const @This(), comptime bin: ArgDestination) usize {
        const offset = @field(self, @tagName(bin) ++ "_offset");
        const T = switch (bin) {
            .float => abi.FloatType,
            else => abi.IntType,
        };
        return offset / @sizeOf(T);
    }

    fn init(arg_bytes: [*]const u8, arg_attrs: []const ArgAttributes, fixed_arg_count: usize) !@This() {
        var self: @This() = .{};
        const bins = [_]ArgDestination{ .float, .int, .stack };
        // inline for (bins) |bin| {
        //     const dest_bytes = &@field(self, @tagName(bin) ++ "_bytes");
        //     for (dest_bytes) |*p| p.* = 0xbb;
        // }
        for (arg_attrs, 0..) |a, index| {
            if (a.alignment == 0) {
                return Error.invalid_argument_attributes;
            }
            const is_variadic = index >= fixed_arg_count;
            const raw_bytes = arg_bytes[a.offset .. a.offset + a.size];
            const bytes: []const u8 = switch (abi.float_promotion and a.is_float and a.size == 4 and !is_variadic) {
                true => promote: {
                    const double: f64 = @floatCast(std.mem.bytesToValue(f32, raw_bytes));
                    break :promote &std.mem.toBytes(double);
                },
                false => raw_bytes,
            };
            inline for (bins) |bin| {
                const bin_name = @tagName(bin);
                // don't generate code for pass-by-register when there're no registers to use
                if (@hasField(@TypeOf(abi.registers), bin_name)) {
                    if (@field(abi.registers, bin_name) == 0) continue;
                }
                // runtime controlled continue is not allowed by Zig for some reason
                // we need to use break-to-label here instead
                alloc: {
                    if (bin == .float) {
                        if (a.is_float) {
                            // variadic floats are passed as int on some platforms
                            if (abi.variadic.float != .float and is_variadic) {
                                break :alloc;
                            }
                        } else {
                            break :alloc;
                        }
                    } else if (bin == .int) {
                        if (a.is_float) {
                            if (abi.misfitting.float != .int) {
                                if (abi.variadic.float == .int) {
                                    if (!is_variadic) {
                                        // this happens when the number of fixed float arg is larger than
                                        // the number of float registers
                                        break :alloc;
                                    }
                                } else {
                                    break :alloc;
                                }
                            }
                        } else {
                            if (abi.variadic.int != .int and is_variadic) {
                                break :alloc;
                            }
                        }
                    }
                    if (@hasField(@TypeOf(abi.limits), bin_name)) {
                        // see if the argument is too large to pass by register
                        const limit = @field(abi.limits, bin_name);
                        if (a.size > limit) break :alloc;
                    }
                    const min_align: usize = get: {
                        const value = @field(abi.min_align, bin_name);
                        break :get switch (bin) {
                            .stack => if (a.is_float) value.float else value.int,
                            else => value,
                        };
                    };
                    const max_align: usize = get: {
                        if (bin == .stack) {
                            if (a.is_float) {
                                if (abi.max_align.stack.float) |v| break :get v;
                            } else {
                                if (abi.max_align.stack.int) |v| break :get v;
                            }
                        }
                        break :get std.math.maxInt(usize);
                    };
                    const offset_ptr = &@field(self, bin_name ++ "_offset");
                    const dest_bytes = &@field(self, bin_name ++ "_bytes");
                    const arg_align: usize = @min(max_align, @max(min_align, a.alignment));
                    const last_offset = offset_ptr.*;
                    const start = alignForward(usize, last_offset, arg_align);
                    const end = start + bytes.len;
                    if (end <= dest_bytes.len) {
                        // std.debug.print("{any}: {d} - {d}\n", .{ bin, start, end });
                        const padding_bytes = dest_bytes[last_offset..start];
                        for (padding_bytes) |*p| p.* = 0;
                        const arg_dest_bytes = dest_bytes[start..end];
                        @memcpy(arg_dest_bytes, bytes);
                        offset_ptr.* = end;
                        if (@alignOf(abi.IntType) != abi.min_align.int and abi.variadic.float == .int) {
                            if (bin == .int and !a.is_float) {
                                const next_offset = alignForward(usize, end, @alignOf(abi.IntType));
                                const padding_bytes_after = dest_bytes[end..next_offset];
                                for (padding_bytes_after) |*p| p.* = 0;
                                offset_ptr.* = next_offset;
                            }
                        }
                        break;
                    }
                }
            } else {
                return Error.too_many_arguments;
            }
        }
        inline for (bins) |bin| {
            const end_align: usize = switch (bin) {
                .float => @alignOf(abi.FloatType),
                else => @alignOf(abi.IntType),
            };
            const offset_ptr = &@field(self, @tagName(bin) ++ "_offset");
            const dest_bytes = &@field(self, @tagName(bin) ++ "_bytes");
            const last_offset = offset_ptr.*;
            const end = alignForward(usize, last_offset, end_align);
            const padding_bytes = dest_bytes[last_offset..end];
            for (padding_bytes) |*p| p.* = 0;
            offset_ptr.* = end;
        }
        return self;
    }

    fn dump(self: *const @This()) void {
        const bins = [_]ArgDestination{ .float, .int, .stack };
        inline for (bins) |bin| {
            const count = self.getCount(bin);
            if (count > 0) {
                const max_count = switch (bin) {
                    .float => abi.registers.float,
                    .int => abi.registers.int,
                    .stack => max_stack_count,
                };
                const words = self.get(bin, max_count);
                const in_use = words.*[0..count];
                const label = switch (bin) {
                    .float => "Float registers",
                    .int => "Int registers",
                    .stack => "Stack",
                };
                std.debug.print("{s}: {any}\n", .{ label, in_use });
            }
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
    // ensure that the cast sticks
    var function_ptr: *const F = @ptrCast(@alignCast(ptr));
    std.mem.doNotOptimizeAway(&function_ptr);
    return @call(.auto, function_ptr, args);
}

fn createTest(RT: type, tuple: anytype) type {
    const ArgStruct = types.ArgumentStruct(fn (@TypeOf(tuple[0]), ...) callconv(.C) RT);
    comptime var current_offset: u16 = @sizeOf(ArgStruct);
    comptime var offsets: [tuple.len]u16 = undefined;
    inline for (tuple, 0..) |value, index| {
        const T = @TypeOf(value);
        const alignment: u16 = @alignOf(T);
        const offset = alignForward(usize, current_offset, alignment);
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
                    std.debug.print("\nMismatch: {any} != {any} (arg{d})\n", .{ arg, value, index });
                    std.debug.print("     arg: {x}\n", .{bytes1});
                    std.debug.print("   tuple: {x}\n", .{bytes2});
                    failed = true;
                }
            }
            return if (failed) 0 else 777;
        }

        pub fn attempt() !void {
            var arg_bytes: [arg_size]u8 align(@alignOf(ArgStruct)) = undefined;
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
            try call(check, argStruct, @ptrCast(&attrs), attrs.len);
            if (argStruct.retval != 777) {
                return error.TestUnexpectedResult;
            }
        }

        pub fn run() !void {
            attempt() catch |err| {
                return switch (builtin.target.cpu.arch) {
                    .x86_64, .x86 => err,
                    // dumpStackTrace() doesn't work correctly for other archs
                    // avoid the panic in panic error by skipping the test
                    else => error.SkipZigTest,
                };
            };
        }
    };
}

fn is(comptime arch: std.Target.Cpu.Arch, comptime tag: ?std.Target.Os.Tag) bool {
    if (builtin.target.cpu.arch == arch) {
        if (tag == null or builtin.target.os.tag == tag.?) {
            return true;
        }
    }
    return false;
}

test "parameter passing (u32)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest;
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest;
    try createTest(u32, .{
        @as(u32, 1234),
    }).run();
}

test "parameter passing (i32)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest;
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest;
    try createTest(i32, .{
        @as(i32, -1234),
    }).run();
}

test "parameter passing (i32, i32)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest;
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest;
    try createTest(u32, .{
        @as(i32, 1234),
        @as(i32, 4567),
    }).run();
}

test "parameter passing (f32)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest;
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest;
    try createTest(f32, .{
        @as(f32, 1.234),
    }).run();
}

test "parameter passing (i64)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest;
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest;
    try createTest(u32, .{
        @as(i64, 1234),
    }).run();
}

test "parameter passing (f64)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest;
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest;
    try createTest(f32, .{
        @as(f64, 1.234),
    }).run();
}

test "parameter passing (i32, f32)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest;
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest;
    try createTest(u32, .{
        @as(i32, 1234),
        @as(f32, 1.2345),
    }).run();
}

test "parameter passing (f32, f32)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest;
    try createTest(u32, .{
        @as(f32, 1.234),
        @as(f32, 4.5678),
    }).run();
}

test "parameter passing (i32, f64)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest;
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest;
    try createTest(u32, .{
        @as(i32, 1000),
        @as(f64, 1.23),
    }).run();
}

test "parameter passing (i32, i32, f64)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest;
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest;
    try createTest(u32, .{
        @as(i32, 1000),
        @as(i32, 2000),
        @as(f64, 3.14),
    }).run();
}

test "parameter passing (f64, f32)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest;
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest;
    try createTest(u32, .{
        @as(f64, 1.234),
        @as(f32, 4.5678),
    }).run();
}

test "parameter passing (f64, f64)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest;
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest;
    try createTest(u32, .{
        @as(f64, 1.24),
        @as(f64, 4.5678),
    }).run();
}

test "parameter passing (i64, f64)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest;
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest;
    try createTest(u32, .{
        @as(i64, 1000),
        @as(f64, 4.5678),
    }).run();
}

test "parameter passing (f32, f32, f32)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest;
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest;
    try createTest(u32, .{
        @as(f32, 1.234),
        @as(f32, 4.567),
        @as(f32, 7.890),
    }).run();
}

test "parameter passing (f32, f32, f32, f32)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest;
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest;
    try createTest(u32, .{
        @as(f32, 1.234),
        @as(f32, 2.345),
        @as(f32, 3.456),
        @as(f32, 4.567),
    }).run();
}

test "parameter passing (f64, f64, f64)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest;
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest;
    try createTest(f64, .{
        @as(f64, 1.234),
        @as(f64, 4.567),
        @as(f64, 7.890),
    }).run();
}

test "parameter passing (f128, f128, f128)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest;
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest;
    if (comptime is(.aarch64, .macos)) return error.SkipZigTest;
    try createTest(f128, .{
        @as(f128, 1.234),
        @as(f128, 4.567),
        @as(f128, 7.890),
    }).run();
}

test "parameter passing (i32, f32, f32)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest;
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest;
    try createTest(u32, .{
        @as(i32, 1234),
        @as(f32, 1.234),
        @as(f32, 4.567),
    }).run();
}

test "parameter passing (u64, f32, f64)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest;
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest;
    try createTest(u32, .{
        @as(u64, 1234),
        @as(f32, 1.234),
        @as(f64, 4.567),
    }).run();
}

test "parameter passing (f128, f64, f32)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest;
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest;
    try createTest(u32, .{
        @as(f128, 1234),
        @as(f64, 1.234),
        @as(f32, 4.567),
    }).run();
}

test "parameter passing (i32, f32, i32, f32)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest;
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest;
    try createTest(u32, .{
        @as(i32, 1234),
        @as(f32, 1.234),
        @as(i32, 4567),
        @as(f32, 4.567),
    }).run();
}

test "parameter passing (i32, f32, i32, f32, i32, f32)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest;
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest;
    try createTest(u32, .{
        @as(i64, 1234),
        @as(i32, 9999),
        @as(f32, 1.234),
        @as(i32, 4567),
        @as(f32, 4.567),
        @as(i32, 7),
        @as(f32, 7.890),
        @as(f32, 17.890),
    }).run();
}

test "parameter passing (i32, f64, i32, f64)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest;
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest;
    try createTest(u32, .{
        @as(i32, 1234),
        @as(f64, 1.234),
        @as(i32, 4567),
        @as(f64, 4.567),
    }).run();
}

test "parameter passing (f32, i32, f32, i32)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest;
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest;
    try createTest(u32, .{
        @as(f32, 1.234),
        @as(i32, 4567),
        @as(f32, 4.567),
        @as(i32, 1234),
    }).run();
}

test "parameter passing (f64, f64, f64, f64, f64, f64, f64, f64)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest;
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest;
    try createTest(u32, .{
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

test "parameter passing (f32, f32, f32, f32, f32, f32, f32, f32)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest;
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest;
    try createTest(u32, .{
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

test "parameter passing (f128, f128, f128, f64, f64, f64, f64, f64)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest;
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest;
    try createTest(f64, .{
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

test "parameter passing (f32, f32, f32, f32, f32, f32, f32, f32, f32, f32)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest;
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest;
    try createTest(u32, .{
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

test "parameter passing (u32, u32, u32, u32, u32, u32, u32, u32)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest;
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest;
    try createTest(i64, .{
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

test "parameter passing ([*:0]const u8, f32, f32, f32, f32, f32, f32, f32, f32, [*:0]const u8)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest;
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest;
    try createTest(u32, .{
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

test "parameter passing (i64, i64)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest;
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest;
    try createTest(i64, .{
        @as(i64, -1),
        @as(i64, -2),
    }).run();
}

test "parameter passing (u128, u128)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest;
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest;
    try createTest(i64, .{
        @as(u128, 0xFFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF),
        @as(u128, 0xFFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFE),
    }).run();
}

test "parameter passing (u128, u128, u128, u128)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest;
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest;
    if (comptime is(.x86_64, .linux)) return error.SkipZigTest;
    try createTest(i64, .{
        @as(u128, 1000),
        @as(u128, 2000),
        @as(u128, 3000),
        @as(u128, 4000),
    }).run();
}

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
        const offset = alignForward(usize, current_offset, @alignOf(param.type.?));
        offsets[index] = offset;
        current_offset = offset + @sizeOf(param.type.?);
    }
    inline for (tuple, 0..) |value, index| {
        const T = @TypeOf(value);
        const offset = alignForward(usize, current_offset, @alignOf(T));
        offsets[f.params.len + index] = offset;
        current_offset = offset + @sizeOf(T);
    }
    const arg_size = current_offset;
    return struct {
        pub fn attempt() !void {
            var arg_bytes: [arg_size]u8 align(@alignOf(ArgStruct)) = undefined;
            var attrs: [f.params.len + tuple.len]ArgAttributes = undefined;
            var buffer1 = std.mem.zeroes([1024]u8);
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
            try call(c.sprintf, argStruct, @ptrCast(&attrs), attrs.len);
            if (argStruct.retval < 0) {
                return error.SprintfFailed;
            }
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
            if (retval2 < 0) {
                return error.SprintfFailed;
            }
            const len1: usize = @intCast(argStruct.retval);
            const len2: usize = @intCast(retval2);
            const s1 = buffer1[0..len1];
            const s2 = buffer2[0..len2];
            if (s1.len != s2.len or !std.mem.eql(u8, s1, s2)) {
                std.debug.print("\nMismatch: {s} != {s}\n", .{ s1, s2 });
                return error.TestUnexpectedResult;
            }
        }

        pub fn run() !void {
            attempt() catch |err| {
                return switch (builtin.target.cpu.arch) {
                    .x86_64, .x86 => err,
                    else => error.SkipZigTest,
                };
            };
        }
    };
}

test "sprintf (i64)" {
    if (!builtin.link_libc) return error.SkipZigTest;
    try createSprintfTest("%d", .{
        @as(i64, 1234),
    }).run();
}

test "sprintf (i64, i32)" {
    if (!builtin.link_libc) return error.SkipZigTest;
    try createSprintfTest("%d %d", .{
        @as(i64, 1234),
        @as(i32, 4567),
    }).run();
}

test "sprintf (i64, i32, f64)" {
    if (!builtin.link_libc) return error.SkipZigTest;
    try createSprintfTest("%d %d %f", .{
        @as(i64, 1234),
        @as(i32, 4567),
        @as(f64, 3.14),
    }).run();
}

test "sprintf (i64, i32, f64, [*:0]const u8)" {
    if (!builtin.link_libc) return error.SkipZigTest;
    try createSprintfTest("%s, %lld %d %f", .{
        @as([*:0]const u8, "Hello world"),
        @as(i64, 1234),
        @as(i32, 4567),
        @as(f64, 3.14),
    }).run();
}

test "sprintf (i64, i64, i64, i64, i64, i64, i64, i64, i64, i64, i64, i64, i64, i64, i64, i64)" {
    if (@sizeOf(isize) == 4) return; // too many arguments for 32-bit platform
    if (!builtin.link_libc) return error.SkipZigTest;
    try createSprintfTest("%d %d %d %d %d %d %d %d %d %d %d %d %d %d %d %d", .{
        @as(i64, 1),
        @as(i64, 2),
        @as(i64, 3),
        @as(i64, 4),
        @as(i64, 5),
        @as(i64, 6),
        @as(i64, 7),
        @as(i64, 8),
        @as(i64, 9),
        @as(i64, 10),
        @as(i64, 11),
        @as(i64, 12),
        @as(i64, 13),
        @as(i64, 14),
        @as(i64, 15),
        @as(i64, 16),
    }).run();
}

test "sprintf (f64)" {
    if (!builtin.link_libc) return error.SkipZigTest;
    try createSprintfTest("%f", .{
        @as(f64, 1.23),
    }).run();
}

test "sprintf (f64, f64)" {
    if (!builtin.link_libc) return error.SkipZigTest;
    try createSprintfTest("Hello %f %f!!", .{
        @as(f64, 1.234),
        @as(f64, 4.234),
    }).run();
}

test "sprintf (i32, f64)" {
    if (!builtin.link_libc) return error.SkipZigTest;
    try createSprintfTest("%d %f", .{
        @as(i32, 123),
        @as(f64, 1.23),
    }).run();
}

test "sprintf (i32, i32, f64)" {
    if (!builtin.link_libc) return error.SkipZigTest;
    try createSprintfTest("%d %d %f", .{
        @as(i32, 123),
        @as(i32, 456),
        @as(f64, 1.23),
    }).run();
}

test "sprintf (f64, f64, f64, f64, f64, f64, f64, f64, f64, f64)" {
    if (!builtin.link_libc) return error.SkipZigTest;
    try createSprintfTest("%f %f %f %f %f %f %f %f %f %f", .{
        @as(f64, 1),
        @as(f64, 2),
        @as(f64, 3),
        @as(f64, 4),
        @as(f64, 5),
        @as(f64, 6),
        @as(f64, 7),
        @as(f64, 8),
        @as(f64, 9),
        @as(f64, 10),
    }).run();
}

test "sprintf (f64, f64, f64, f64, f64, f64, f64, f64, f64, f64, f64, f64, f64, f64, f64, f64)" {
    if (@sizeOf(isize) == 4) return; // too many arguments for 32-bit platform
    if (!builtin.link_libc) return error.SkipZigTest;
    try createSprintfTest("%f %f %f %f %f %f %f %f %f %f %f %f %f %f %f %f", .{
        @as(f64, 1),
        @as(f64, 2),
        @as(f64, 3),
        @as(f64, 4),
        @as(f64, 5),
        @as(f64, 6),
        @as(f64, 7),
        @as(f64, 8),
        @as(f64, 9),
        @as(f64, 10),
        @as(f64, 11),
        @as(f64, 12),
        @as(f64, 13),
        @as(f64, 14),
        @as(f64, 15),
        @as(f64, 16),
    }).run();
}

test "sprintf (i64, f64)" {
    if (!builtin.link_libc) return error.SkipZigTest;
    try createSprintfTest("%ld %f", .{
        @as(i64, -123),
        @as(f64, 3.14),
    }).run();
}

test "sprintf (i64, f64, i64, f64)" {
    if (!builtin.link_libc) return error.SkipZigTest;
    try createSprintfTest("%ld %f %ld %f", .{
        @as(i64, -123),
        @as(f64, 3.14),
        @as(i64, -235),
        @as(f64, 7.77),
    }).run();
}

test "sprintf (i16, i16)" {
    if (!builtin.link_libc) return error.SkipZigTest;
    try createSprintfTest("%hd %hd", .{
        @as(i16, -123),
        @as(i16, -124),
    }).run();
}

test "sprintf (i8, i8)" {
    if (!builtin.link_libc) return error.SkipZigTest;
    try createSprintfTest("%hhd %hhd", .{
        @as(i16, -123),
        @as(i16, -124),
    }).run();
}

test "sprintf (i64, c_longdouble, i64, c_longdouble)" {
    if (!builtin.link_libc) return error.SkipZigTest;
    try createSprintfTest("%ld %f", .{
        @as(i64, -123),
        @as(c_longdouble, 3.14),
        @as(i64, -235),
        @as(c_longdouble, 7.77),
    }).run();
}

test "sprintf (c_longdouble, c_longdouble)" {
    if (!builtin.link_libc) return error.SkipZigTest;
    try createSprintfTest("%ld %f", .{
        @as(c_longdouble, 3.14),
        @as(c_longdouble, 7.77),
    }).run();
}

pub fn panic(_: []const u8, _: ?*std.builtin.StackTrace, _: ?usize) noreturn {
    //std.debug.print("{s}\n", .{msg});
    return std.process.abort();
}
