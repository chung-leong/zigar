const std = @import("std");
const builtin = @import("builtin");
const expect = std.testing.expect;

const isAligned = std.mem.isAligned;
const alignForward = std.mem.alignForward;
const bytesToValue = std.mem.bytesToValue;

pub const Error = error{
    too_many_arguments,
    unsupported_type_for_variadic_function,
    invalid_argument_attributes,
};

const SignExtender = enum { callee, caller };
const Abi = struct {
    registers: struct {
        int: struct {
            type: type,
            count: comptime_int = 0,
            accept: struct {
                fixed: []const type = &.{},
                variadic: []const type = &.{},
            } = .{},
        },
        float: struct {
            type: type,
            count: comptime_int = 0,
            accept: struct {
                fixed: []const type = &.{},
                variadic: []const type = &.{},
            } = .{},
        },
    },
    sign_extender: SignExtender = .callee,

    fn init(arch: std.Target.Cpu.Arch, os_tag: std.Target.Os.Tag) @This() {
        return switch (arch) {
            .x86_64 => switch (os_tag) {
                .windows => .{
                    .registers = .{
                        .int = .{
                            .type = i64,
                            .count = 4, // RCX, RDX, R8, R9
                            .accept = .{
                                .fixed = &.{i64},
                                .variadic = &.{ i64, f128, f80, f64 },
                            },
                        },
                        .float = .{
                            .type = f128,
                            .count = 4, // XMM0, XMM1, XMM2, XMM3
                            .accept = .{
                                .fixed = &.{f128},
                            },
                        },
                    },
                },
                else => .{
                    .registers = .{
                        .int = .{
                            .type = i64,
                            .count = 6, // RDI, RSI, RDX, RCX, R8, R9
                            .accept = .{
                                .fixed = &.{i64},
                                .variadic = &.{i64},
                            },
                        },
                        .float = .{
                            .type = f128,
                            .count = 8, // // XMM0 - XMM7
                            .accept = .{
                                .fixed = &.{f128},
                                .variadic = &.{f128},
                            },
                        },
                    },
                },
            },
            .aarch64 => switch (builtin.target.os.tag) {
                .macos, .ios, .tvos, .watchos => .{
                    .registers = .{
                        .int = .{
                            .type = i64,
                            .count = 8, // x0 - x7
                            .accept = .{
                                .fixed = &.{i64},
                            },
                        },
                        .float = .{
                            .type = f128,
                            .count = 8, // v0 - v7
                            .accept = .{
                                .fixed = &.{f128},
                            },
                        },
                    },
                    .sign_extender = .caller,
                },
                else => .{
                    .registers = .{
                        .int = .{
                            .type = i64,
                            .count = 8, // x0 - x7
                            .accept = .{
                                .fixed = &.{ i64, i128 },
                                .variadic = &.{ i64, i128 },
                            },
                        },
                        .float = .{
                            .type = f128,
                            .count = 8, // v0 - v7
                            .accept = .{
                                .fixed = &.{f128},
                                .variadic = &.{f128},
                            },
                        },
                    },
                },
            },
            .riscv64 => .{
                .registers = .{
                    .int = .{
                        .type = i64,
                        .count = 8, // a0 - a7
                        .accept = .{
                            .fixed = &.{ i64, i128, f128, f80 },
                            .variadic = &.{ i64, i128, f128, f80, f64, f32, f16 },
                        },
                    },
                    .float = .{
                        .type = f64,
                        .count = 8, // fa0 = fa7
                        .accept = .{
                            .fixed = &.{f64},
                        },
                    },
                },
            },
            .powerpc64le => .{
                .registers = .{
                    .int = .{
                        .type = i64,
                        .count = 8, // r3 - r10
                        .accept = .{
                            .fixed = &.{i64},
                            .variadic = &.{ i64, f64, f32 },
                        },
                    },
                    .float = .{
                        .type = f64,
                        .count = 13, // f1 - f13
                        .accept = .{
                            .fixed = &.{f64},
                        },
                    },
                },
                .sign_extender = .caller,
            },
            .x86 => .{
                .registers = .{
                    .int = .{
                        .type = i32,
                        .count = 0,
                        .accept = .{
                            .fixed = &.{ i32, i16, i8 },
                            .variadic = &.{ i32, i16, i8 },
                        },
                    },
                    .float = .{
                        .type = f64,
                        .count = 0,
                    },
                },
            },
            .arm => .{
                .registers = .{
                    .int = .{
                        .type = i32,
                        .count = 0,
                        .accept = .{
                            .fixed = &.{i32},
                            .variadic = &.{i32},
                        },
                    },
                    .float = .{
                        .type = f64,
                        .count = 0,
                    },
                },
            },
            else => @compileError("Variadic functions not supported on this architecture: " ++ @tagName(builtin.target.cpu.arch)),
        };
    }

    fn extend(comptime self: @This(), comptime T: type, value: anytype) T {
        const ValueType = @TypeOf(value);
        const signed = switch (@typeInfo(ValueType)) {
            .Int => |int| int.signedness == .signed,
            .Float => true,
            else => false,
        };
        const value_bits = switch (@typeInfo(ValueType)) {
            .Int => |int| int.bits,
            .Float => |float| float.bits,
            else => @sizeOf(ValueType) * 8,
        };
        const signedness = if (signed) switch (self.sign_extender) {
            .callee => .unsigned,
            .caller => .signed,
        } else .unsigned;
        const IntType = @Type(.{ .Int = .{
            .bits = value_bits,
            .signedness = signedness,
        } });
        const retval_bits = switch (@typeInfo(T)) {
            .Int => |int| int.bits,
            .Float => |float| float.bits,
            else => @sizeOf(T) * 8,
        };
        const BigIntType = @Type(.{ .Int = .{
            .bits = retval_bits,
            .signedness = signedness,
        } });
        const int_value: IntType = @bitCast(value);
        const big_int_value: BigIntType = @intCast(int_value);
        return @bitCast(big_int_value);
    }

    fn getIntCount(comptime self: @This(), comptime T: type) usize {
        const Int = self.registers.int.type;
        return switch (@sizeOf(T) <= @sizeOf(Int)) {
            true => 1,
            false => @sizeOf(T) / @sizeOf(Int),
        };
    }

    fn getFloatCount(comptime self: @This(), comptime T: type) usize {
        const Float = self.registers.float.type;
        return switch (@sizeOf(T) <= @sizeOf(Float)) {
            true => 1,
            false => std.mem.alignForward(usize, @sizeOf(T), @sizeOf(Float)) / @sizeOf(Float),
        };
    }

    fn toInts(comptime self: @This(), value: anytype) [self.getIntCount(@TypeOf(value))]self.registers.int.type {
        const Int = self.registers.int.type;
        const count = comptime self.getIntCount(@TypeOf(value));
        return switch (count) {
            1 => [1]Int{self.extend(Int, value)},
            else => split: {
                const size = @sizeOf(Int);
                const bytes = std.mem.toBytes(value);
                var ints: [count]Int = undefined;
                inline for (&ints, 0..) |*p, index| {
                    p.* = std.mem.bytesToValue(Int, bytes[index * size .. index * size + size]);
                }
                break :split ints;
            },
        };
    }

    fn toFloats(comptime self: @This(), value: anytype) [self.getFloatCount(@TypeOf(value))]self.registers.float.type {
        const Float = self.registers.float.type;
        const count = comptime self.getFloatCount(@TypeOf(value));
        return switch (count) {
            1 => [1]Float{self.extend(Float, value)},
            else => split: {
                const size = @sizeOf(Float);
                const bytes = get: {
                    if (@sizeOf(@TypeOf(value)) == size * count) {
                        break :get std.mem.toBytes(value);
                    } else {
                        const BigInt = @Type(.{
                            .Int = .{
                                .bits = size * count * 8,
                                .signedness = .signed,
                            },
                        });
                        const big_int_value = self.extend(BigInt, value);
                        break :get std.mem.toBytes(big_int_value);
                    }
                };
                var ints: [count]Float = undefined;
                inline for (&ints, 0..) |*p, index| {
                    p.* = std.mem.bytesToValue(Float, bytes[index * size .. index * size + size]);
                }
                break :split ints;
            },
        };
    }

    fn packInt(comptime self: @This(), values: anytype) self.registers.int.type {
        const Int = self.registers.int.type;
        var bytes: [@sizeOf(Int)]u8 = undefined;
        var index: usize = 0;
        inline for (values) |value| {
            const value_bytes = std.mem.toBytes(value);
            @memcpy(bytes[index .. index + value_bytes.len], &value_bytes);
            index += value_bytes.len;
        }
        return std.mem.bytesToValue(Int, &bytes);
    }
};

test "Abi.extend" {
    const abi1: Abi = .{
        .registers = .{
            .int = .{
                .type = i64,
            },
            .float = .{
                .type = f64,
            },
        },
        .sign_extender = .caller,
    };
    const a = abi1.extend(u64, @as(u8, 233));
    try expect(a == 233);
    const b = abi1.extend(i64, @as(i8, -1));
    try expect(b == -1);
    const abi2: Abi = .{
        .registers = .{
            .int = .{
                .type = i64,
            },
            .float = .{
                .type = f64,
            },
        },
        .sign_extender = .callee,
    };
    const c = abi2.extend(u64, @as(u8, 0xFF));
    try expect(c == 0xFF);
    const d = abi2.extend(i64, @as(i8, -1));
    try expect(d == 0xFF);
    const e = abi2.extend(f64, @as(f32, -1));
    const ei: u64 = @bitCast(e);
    try expect(ei & 0xFFFF_FFFF_0000_0000 == 0);
    const f = abi1.extend(f64, @as(f32, -2));
    const fi: u64 = @bitCast(f);
    try expect(fi & 0xFFFF_FFFF_0000_0000 == 0xFFFF_FFFF_0000_0000);
}

test "Abi.toInts" {
    const abi1: Abi = .{
        .registers = .{
            .int = .{
                .type = i64,
            },
            .float = .{
                .type = f64,
            },
        },
        .sign_extender = .caller,
    };
    const a = abi1.toInts(@as(i8, -2));
    try expect(a.len == 1);
    try expect(a[0] == -2);
    const abi2: Abi = .{
        .registers = .{
            .int = .{
                .type = i32,
            },
            .float = .{
                .type = f64,
            },
        },
        .sign_extender = .caller,
    };
    const b = abi2.toInts(@as(i64, -2));
    try expect(b.len == 2);
    // assuming little endian
    try expect(b[0] == -2);
    try expect(b[1] == -1);
}

test "Abi.toFloats" {
    const abi1: Abi = .{
        .registers = .{
            .int = .{
                .type = i64,
            },
            .float = .{
                .type = f64,
            },
        },
        .sign_extender = .caller,
    };
    const a = abi1.toFloats(@as(f64, -2));
    try expect(a.len == 1);
    try expect(a[0] == -2);
    const abi2: Abi = .{
        .registers = .{
            .int = .{
                .type = i32,
            },
            .float = .{
                .type = f64,
            },
        },
        .sign_extender = .caller,
    };
    const b = abi2.toFloats(@as(f128, -2));
    try expect(b.len == 2);
    const c = abi2.toFloats(@as(f80, -2));
    try expect(c.len == 2);
}

fn callWithArgs(
    comptime RT: type,
    comptime cc: std.builtin.CallingConvention,
    ptr: *const anyopaque,
    fixed_floats: anytype,
    fixed_ints: anytype,
    variadic_floats: anytype,
    variadic_ints: anytype,
) RT {
    const Float = @typeInfo(@TypeOf(fixed_floats)).Array.child;
    const Int = @typeInfo(@TypeOf(fixed_ints)).Array.child;
    const fixed_arg_count = fixed_floats.len + fixed_ints.len;
    const params = define: {
        comptime var params: [fixed_arg_count]std.builtin.Type.Fn.Param = undefined;
        inline for (&params, 0..) |*p, index| {
            p.* = .{
                .is_generic = false,
                .is_noalias = false,
                .type = if (index < fixed_floats.len) Float else Int,
            };
        }
        break :define params;
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
    const total_arg_count = fixed_arg_count + variadic_floats.len + variadic_ints.len;
    const fields = define: {
        comptime var fields: [total_arg_count]std.builtin.Type.StructField = undefined;
        inline for (&fields, 0..) |*f, index| {
            const T = switch (index < fixed_arg_count) {
                true => switch (index < fixed_floats.len) {
                    true => Float,
                    false => Int,
                },
                false => switch (index < fixed_arg_count + variadic_floats.len) {
                    true => Float,
                    false => Int,
                },
            };
            f.* = .{
                .name = std.fmt.comptimePrint("{d}", .{index}),
                .type = T,
                .default_value = null,
                .is_comptime = false,
                .alignment = if (@sizeOf(T) > 0) @alignOf(T) else 0,
            };
        }
        break :define fields;
    };
    const Args = @Type(.{
        .Struct = .{
            .is_tuple = true,
            .layout = .auto,
            .decls = &.{},
            .fields = &fields,
        },
    });
    const args = create: {
        var args: Args = undefined;
        comptime var index = 0;
        inline for (fixed_floats) |float| {
            args[index] = float;
            index += 1;
        }
        inline for (fixed_ints) |int| {
            args[index] = int;
            index += 1;
        }
        inline for (variadic_floats) |float| {
            args[index] = float;
            index += 1;
        }
        inline for (variadic_ints) |int| {
            args[index] = int;
            index += 1;
        }
        break :create args;
    };
    const function_ptr: *const F = @ptrCast(@alignCast(ptr));
    return @call(.auto, function_ptr, args);
}

fn is(comptime arch: std.Target.Cpu.Arch, comptime tag: ?std.Target.Os.Tag) bool {
    if (builtin.target.cpu.arch == arch) {
        if (tag == null or builtin.target.os.tag == tag.?) {
            return true;
        }
    }
    return false;
}

fn in(comptime T: type, comptime list: []const type) bool {
    return inline for (list) |T2| {
        if (T == T2) break true;
    } else false;
}

test "callWithArgs (i64...i64, f64)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest;
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest;
    const abi = Abi.init(builtin.target.cpu.arch, builtin.target.os.tag);
    const ns = struct {
        fn function(arg0: i64, ...) callconv(.C) f64 {
            var va_list = @cVaStart();
            defer @cVaEnd(&va_list);
            const arg1 = @cVaArg(&va_list, i64);
            const arg2 = @cVaArg(&va_list, f64);
            return @as(f64, @floatFromInt(arg0 + arg1)) + arg2;
        }
    };
    const result1 = ns.function(1000, @as(i64, 7), @as(f64, 3.14));
    const f = @typeInfo(@TypeOf(ns.function)).Fn;
    const Float = abi.registers.float.type;
    const fixed_floats = [_]Float{};
    const fixed_ints = abi.toInts(@as(i64, 1000));
    const variadic_floats = comptime switch (in(Float, abi.registers.float.accept.variadic)) {
        true => abi.toFloats(@as(f64, 3.14)),
        false => [_]f64{},
    };
    const variadic_ints = comptime switch (in(Float, abi.registers.float.accept.variadic)) {
        true => abi.toInts(@as(i64, 7)),
        false => abi.toInts(@as(i64, 7)) ++ abi.toInts(@as(f64, 3.14)),
    };
    const result2 = callWithArgs(
        f.return_type.?,
        f.calling_convention,
        @ptrCast(&ns.function),
        fixed_floats,
        fixed_ints,
        variadic_floats,
        variadic_ints,
    );
    const variadic_floats_plus_garbage = comptime switch (in(f64, abi.registers.float.accept.variadic)) {
        true => variadic_floats ++ abi.toFloats(@as(f64, 34.32443)) ++ abi.toFloats(@as(f64, 434343.3)),
        false => variadic_floats,
    };
    const variadic_ints_plus_garbage = variadic_ints ++ abi.toInts(@as(i64, 1213)) ++ abi.toInts(@as(i64, 324));
    try expect(result1 == result2);
    // call with extra args
    const result3 = callWithArgs(
        f.return_type.?,
        f.calling_convention,
        @ptrCast(&ns.function),
        fixed_floats,
        fixed_ints,
        variadic_floats_plus_garbage,
        variadic_ints_plus_garbage,
    );
    try expect(result1 == result3);
}

test "callWithArgs (i64...i64, i32, i32)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest;
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest;
    const abi = Abi.init(builtin.target.cpu.arch, builtin.target.os.tag);
    const ns = struct {
        fn function(arg0: i64, ...) callconv(.C) i64 {
            var va_list = @cVaStart();
            defer @cVaEnd(&va_list);
            const arg1 = @cVaArg(&va_list, i64);
            const arg2 = @cVaArg(&va_list, i32);
            const arg3 = @cVaArg(&va_list, i32);
            return arg0 + arg1 + arg2 + arg3;
        }
    };
    const result1 = ns.function(1000, @as(i64, 7), @as(i32, -5), @as(i32, -2));
    const f = @typeInfo(@TypeOf(ns.function)).Fn;
    const Float = abi.registers.float.type;
    const fixed_floats = [_]Float{};
    const fixed_ints = abi.toInts(@as(i64, 1000));
    const variadic_floats = [_]Float{};
    const variadic_ints = abi.toInts(@as(i64, 7)) ++ abi.toInts(@as(i32, -5)) ++ abi.toInts(@as(i32, -2));
    const result2 = callWithArgs(
        f.return_type.?,
        f.calling_convention,
        @ptrCast(&ns.function),
        fixed_floats,
        fixed_ints,
        variadic_floats,
        variadic_ints,
    );
    try expect(result1 == result2);
}

test "callWithArgs (i64...i32, i32, i32)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest;
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest;
    const abi = Abi.init(builtin.target.cpu.arch, builtin.target.os.tag);
    const ns = struct {
        fn function(arg0: i64, ...) callconv(.C) i64 {
            var va_list = @cVaStart();
            defer @cVaEnd(&va_list);
            const arg1 = @cVaArg(&va_list, i32);
            const arg2 = @cVaArg(&va_list, i32);
            const arg3 = @cVaArg(&va_list, i32);
            return arg0 + arg1 + arg2 + arg3;
        }
    };
    const result1 = ns.function(1000, @as(i32, 7), @as(i32, -5), @as(i32, -2));
    const f = @typeInfo(@TypeOf(ns.function)).Fn;
    const Float = abi.registers.float.type;
    const fixed_floats = [_]Float{};
    const fixed_ints = abi.toInts(@as(i64, 1000));
    const variadic_floats = [_]Float{};
    const variadic_ints = abi.toInts(@as(i32, 7)) ++ abi.toInts(@as(i32, -5)) ++ abi.toInts(@as(i32, -2));
    const result2 = callWithArgs(
        f.return_type.?,
        f.calling_convention,
        @ptrCast(&ns.function),
        fixed_floats,
        fixed_ints,
        variadic_floats,
        variadic_ints,
    );
    try expect(result1 == result2);
}

test "callWithArgs (i64...i32, f32, f32)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest;
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest;
    const abi = Abi.init(builtin.target.cpu.arch, builtin.target.os.tag);
    const ns = struct {
        fn function(arg0: i64, ...) callconv(.C) f64 {
            var va_list = @cVaStart();
            defer @cVaEnd(&va_list);
            const arg1 = @cVaArg(&va_list, i32);
            const arg2 = @cVaArg(&va_list, f32);
            const arg3 = @cVaArg(&va_list, f32);
            return @as(f64, @floatFromInt(arg0)) + @as(f64, @floatFromInt(arg1)) + arg2 + arg3;
        }
    };
    const result1 = ns.function(1000, @as(i32, 7), @as(f32, -5), @as(f32, -2));
    const f = @typeInfo(@TypeOf(ns.function)).Fn;
    const Int = abi.registers.int.type;
    const Float = abi.registers.float.type;
    const fixed_floats = [_]Float{};
    const fixed_ints = abi.toInts(@as(i64, 1000));
    const variadic_floats = comptime switch (in(Float, abi.registers.float.accept.variadic)) {
        true => abi.toFloats(@as(f32, -5)) ++ abi.toFloats(@as(f32, -2)),
        false => [_]Float{},
    };
    const variadic_ints = comptime switch (in(Float, abi.registers.float.accept.variadic)) {
        true => abi.toInts(@as(i32, 7)),
        false => switch (Int == i64 and in(f32, abi.registers.int.accept.variadic)) {
            true => abi.toInts(@as(i32, 7)) ++ [1]Int{abi.packInt(.{ @as(f32, -5), @as(f32, -2) })},
            else => abi.toInts(@as(i32, 7)) ++ abi.toInts(@as(f32, -5)) ++ abi.toInts(@as(f32, -2)),
        },
    };
    const result2 = callWithArgs(
        f.return_type.?,
        f.calling_convention,
        @ptrCast(&ns.function),
        fixed_floats,
        fixed_ints,
        variadic_floats,
        variadic_ints,
    );
    //try expect(result1 == 1000);
    _ = result1;
    try expect(result2 == 1000);
}

test "callWithArgs (i64...i16, i16)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest;
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest;
    const abi = Abi.init(builtin.target.cpu.arch, builtin.target.os.tag);
    const ns = struct {
        fn function(arg0: i64, ...) callconv(.C) i64 {
            var va_list = @cVaStart();
            defer @cVaEnd(&va_list);
            const arg1 = @cVaArg(&va_list, i16);
            const arg2 = @cVaArg(&va_list, i16);
            return arg0 + arg1 + arg2;
        }
    };
    const result1 = ns.function(1000, @as(i16, 7), @as(i16, -5));
    const f = @typeInfo(@TypeOf(ns.function)).Fn;
    const Int = abi.registers.int.type;
    const Float = abi.registers.float.type;
    const fixed_floats = [_]Float{};
    const fixed_ints = abi.toInts(@as(i64, 1000));
    const variadic_floats = [_]Float{};
    const variadic_ints = comptime switch (in(i16, abi.registers.int.accept.variadic)) {
        true => [_]Int{abi.packInt(.{ @as(i16, 7), @as(i16, -5) })},
        false => abi.toInts(@as(i16, 7)) ++ abi.toInts(@as(i16, -5)),
    };
    const result2 = callWithArgs(
        f.return_type.?,
        f.calling_convention,
        @ptrCast(&ns.function),
        fixed_floats,
        fixed_ints,
        variadic_floats,
        variadic_ints,
    );
    //try expect(result1 == 1002);
    _ = result1;
    try expect(result2 == 1002);
}

test "callWithArgs (i64...i8, i8)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest;
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest;
    const abi = Abi.init(builtin.target.cpu.arch, builtin.target.os.tag);
    const ns = struct {
        fn function(arg0: i64, ...) callconv(.C) i64 {
            var va_list = @cVaStart();
            defer @cVaEnd(&va_list);
            const arg1 = @cVaArg(&va_list, i8);
            const arg2 = @cVaArg(&va_list, i8);
            return arg0 + arg1 + arg2;
        }
    };
    const result1 = ns.function(1000, @as(i8, 7), @as(i8, -5));
    const f = @typeInfo(@TypeOf(ns.function)).Fn;
    const Int = abi.registers.int.type;
    const Float = abi.registers.float.type;
    const fixed_floats = [_]Float{};
    const fixed_ints = abi.toInts(@as(i64, 1000));
    const variadic_floats = [_]Float{};
    const variadic_ints = comptime switch (in(i8, abi.registers.int.accept.variadic)) {
        true => [_]Int{abi.packInt(.{ @as(i8, 7), @as(i8, -5) })},
        false => abi.toInts(@as(i8, 7)) ++ abi.toInts(@as(i8, -5)),
    };
    const result2 = callWithArgs(
        f.return_type.?,
        f.calling_convention,
        @ptrCast(&ns.function),
        fixed_floats,
        fixed_ints,
        variadic_floats,
        variadic_ints,
    );
    //try expect(result1 == 1002);
    _ = result1;
    try expect(result2 == 1002);
}

test "callWithArgs (i64...i128)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest;
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest;
    const abi = Abi.init(builtin.target.cpu.arch, builtin.target.os.tag);
    const ns = struct {
        fn function(arg0: i64, ...) callconv(.C) i128 {
            var va_list = @cVaStart();
            defer @cVaEnd(&va_list);
            const arg1 = @cVaArg(&va_list, i128);
            return arg0 + arg1;
        }
    };
    const result1 = ns.function(1000, @as(i128, -2));
    const f = @typeInfo(@TypeOf(ns.function)).Fn;
    const Int = abi.registers.int.type;
    const Float = abi.registers.float.type;
    const fixed_floats = [_]Float{};
    const fixed_ints = abi.toInts(@as(i64, 1000));
    const variadic_floats = [_]Float{};
    const alignment_ints = comptime switch (in(i128, abi.registers.int.accept.variadic)) {
        true => [_]Int{0},
        false => [_]Int{},
    };
    const variadic_ints = alignment_ints ++ abi.toInts(@as(i128, -2));
    const result2 = callWithArgs(
        f.return_type.?,
        f.calling_convention,
        @ptrCast(&ns.function),
        fixed_floats,
        fixed_ints,
        variadic_floats,
        variadic_ints,
    );
    try expect(result1 == result2);
}

const ArgAttributes = extern struct {
    offset: u16,
    size: u16,
    alignment: u16,
    is_float: bool,
    is_signed: bool,
};

fn Allocation(comptime abi: Abi) type {
    return struct {
        const Destination = enum { int, float };
        const Int = abi.registers.int.type;
        const Float = abi.registers.float.type;
        const stack_counts = .{ 0, 8, 16, 32, 64, 128, 256 };
        const max_stack_count = stack_counts[stack_counts.len - 1];
        const int_byte_count = (abi.registers.int.count + max_stack_count) * @sizeOf(Int);
        const float_byte_count = abi.registers.float.count * @sizeOf(Float);
        const u_types = .{ u8, u16, u32, u64, u128 };
        const i_types = .{ i8, i16, i32, i64, i128 };
        const f_types = .{ f16, f32, f64, f80, f128 };

        float_offset: usize = 0,
        int_offset: usize = 0,
        float_bytes: [float_byte_count]u8 align(@alignOf(Float)) = undefined,
        int_bytes: [int_byte_count]u8 align(@alignOf(Int)) = undefined,

        fn init(arg_bytes: [*]const u8, arg_attrs: []const ArgAttributes, fixed_arg_count: usize) !@This() {
            var self: @This() = .{};
            var index: usize = 0;
            inline for (.{ "fixed", "variadic" }) |arg_type_name| {
                while (index < arg_attrs.len) : (index += 1) {
                    if (index == fixed_arg_count) {
                        break;
                    }
                    alloc: {
                        const a = arg_attrs[index];
                        const bytes = arg_bytes[a.offset .. a.offset + a.size];
                        if (a.is_float) {
                            const dest_types = @field(abi.registers.float.accept, arg_type_name);
                            for (1..3) |stage| {
                                inline for (dest_types) |T| {
                                    const use = switch (stage) {
                                        1 => isAligned(self.float_offset, @alignOf(T)) and a.size == @sizeOf(T),
                                        2 => a.size == @sizeOf(T),
                                        else => a.size < @sizeOf(T),
                                    };
                                    if (use) {
                                        const start = alignForward(usize, self.float_offset, @sizeOf(T));
                                        const end = start + bytes.len;
                                        if (end <= self.float_bytes.len) {
                                            const dest_ptr: *T = @ptrCast(&self.float_bytes[start]);
                                            inline for (f_types) |ArgT| {
                                                if (a.size == @sizeOf(ArgT)) {
                                                    const arg_value = bytesToValue(ArgT, bytes);
                                                    dest_ptr.* = abi.extend(T, arg_value);
                                                    break :alloc;
                                                }
                                            }
                                        } else {
                                            // need to place int on stack or int registers
                                        }
                                    }
                                }
                            }
                        }
                        const dest_types = @field(abi.registers.int.accept, arg_type_name);
                        for (1..3) |stage| {
                            inline for (dest_types) |T| {
                                const use = switch (stage) {
                                    1 => isAligned(self.int_offset, @alignOf(T)) and a.size == @sizeOf(T),
                                    2 => a.size == @sizeOf(T),
                                    else => true,
                                };
                                if (use) {
                                    const start = alignForward(usize, self.int_offset, @sizeOf(T));
                                    const end = start + bytes.len;
                                    if (end <= self.int_bytes.len) {
                                        const dest_ptr: *T = @ptrCast(&self.int_bytes[start]);
                                        inline for (u_types ++ i_types) |ArgT| {
                                            if (a.size == @sizeOf(ArgT)) {
                                                if (a.is_signed == (@typeInfo(ArgT).Int.signedness == .signed)) {
                                                    const arg_value = bytesToValue(ArgT, bytes);
                                                    dest_ptr.* = abi.extend(T, arg_value);
                                                    break :alloc;
                                                }
                                            }
                                        } else {
                                            const dest_bytes = self.int_bytes[start..end];
                                            @memcpy(dest_bytes, bytes);
                                            break :alloc;
                                        }
                                    } else {
                                        return Error.too_many_arguments;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    };
}
