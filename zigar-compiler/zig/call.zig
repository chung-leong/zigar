const std = @import("std");
const builtin = @import("builtin");
const expect = std.testing.expect;

const ArgDestination = enum { float, int, stack };
const SignExtender = enum { callee, caller };
const Abi = struct {
    Ints: []const type, // integer types that the CPU can address naturally
    Floats: []const type, // float types that the CPU can address naturally

    registers: struct { // number of registers
        int: comptime_int = 0,
        float: comptime_int = 0,
    } = .{},
    variadic: struct { // how variadic arguments are passed
        int: ArgDestination = .stack,
        float: ArgDestination = .stack,
    } = .{},
    misfitting: struct { // where arguments not
        int: ArgDestination = .stack,
        float: ArgDestination = .stack,
    } = .{},
    sign_extender: SignExtender = .callee,

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
        const Int = self.Ints[0];
        return switch (@sizeOf(T) <= @sizeOf(Int)) {
            true => 1,
            false => @sizeOf(T) / @sizeOf(Int),
        };
    }

    fn getFloatCount(comptime self: @This(), comptime T: type) usize {
        const Float = self.Floats[0];
        return switch (@sizeOf(T) <= @sizeOf(Float)) {
            true => 1,
            false => std.mem.alignForward(usize, @sizeOf(T), @sizeOf(Float)) / @sizeOf(Float),
        };
    }

    fn toInts(comptime self: @This(), value: anytype) [self.getIntCount(@TypeOf(value))]self.Ints[0] {
        const Int = self.Ints[0];
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

    fn toFloats(comptime self: @This(), value: anytype) [self.getFloatCount(@TypeOf(value))]self.Floats[0] {
        const Float = self.Floats[0];
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

    fn hasType(comptime self: @This(), comptime T: type) bool {
        return inline for (self.Ints) |Int| {
            if (Int == T) break true;
        } else inline for (self.Floats) |Float| {
            if (Float == T) break true;
        } else false;
    }
};

test "Abi.extend" {
    const abi1: Abi = .{
        .Ints = &.{i64},
        .Floats = &.{f64},
        .sign_extender = .caller,
    };
    const a = abi1.extend(u64, @as(u8, 233));
    try expect(a == 233);
    const b = abi1.extend(i64, @as(i8, -1));
    try expect(b == -1);
    const abi2: Abi = .{
        .Ints = &.{i64},
        .Floats = &.{f64},
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
        .Ints = &.{i64},
        .Floats = &.{f64},
        .sign_extender = .caller,
    };
    const a = abi1.toInts(@as(i8, -2));
    try expect(a.len == 1);
    try expect(a[0] == -2);
    const abi2: Abi = .{
        .Ints = &.{i32},
        .Floats = &.{f64},
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
        .Ints = &.{i64},
        .Floats = &.{f64},
        .sign_extender = .caller,
    };
    const a = abi1.toFloats(@as(f64, -2));
    try expect(a.len == 1);
    try expect(a[0] == -2);
    const abi2: Abi = .{
        .Ints = &.{i32},
        .Floats = &.{f64},
        .sign_extender = .caller,
    };
    const b = abi2.toFloats(@as(f128, -2));
    try expect(b.len == 2);
    const c = abi2.toFloats(@as(f80, -2));
    try expect(c.len == 2);
}

const abi: Abi = switch (builtin.target.cpu.arch) {
    .x86_64 => switch (builtin.target.os.tag) {
        .windows => .{
            .Ints = &.{i64},
            .Floats = &.{f128},
            .registers = .{
                // RCX, RDX, R8, R9
                .int = 4,
                // XMM0, XMM1, XMM2, XMM3
                .float = 4,
            },
            .variadic = .{
                .int = .int,
                .float = .int,
            },
        },
        else => .{
            .Ints = &.{i64},
            .Floats = &.{f128},
            .registers = .{
                // RDI, RSI, RDX, RCX, R8, R9
                .int = 6,
                // XMM0 - XMM7
                .float = 8,
            },
            .variadic = .{
                .int = .int,
                .float = .float,
            },
        },
    },
    .aarch64 => switch (builtin.target.os.tag) {
        .macos, .ios, .tvos, .watchos => .{
            .Ints = &.{i64},
            .Floats = &.{f128},
            .registers = .{
                // x0 - x7
                .int = 8,
                // v0 - v7
                .float = 8,
            },
            .sign_extender = .caller,
        },
        else => .{
            .Ints = &.{ i64, i128 },
            .Floats = &.{f128},
            .registers = .{
                // x0 - x7
                .int = 8,
                // v0 - v7
                .float = 8,
            },
            .variadic = .{
                .int = .int,
                .float = .float,
            },
        },
    },
    .riscv64 => .{
        .Ints = &.{i64},
        .Floats = &.{f64},
        .registers = .{
            // a0 - a7
            .int = 8,
            .float = 8,
        },
        .variadic = .{
            .float = .int,
        },
        .misfitting = .{
            .float = .int,
        },
    },
    .powerpc64le => .{
        .Ints = &.{i64},
        .Floats = &.{f64},
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
        .sign_extender = .caller,
    },
    .x86 => .{
        .Ints = &.{ i32, i16, i8 },
        .Floats = &.{f64},
    },
    .arm => .{
        .Ints = &.{i32},
        .Floats = &.{f64},
    },
    else => @compileError("Variadic functions not supported on this architecture: " ++ @tagName(builtin.target.cpu.arch)),
};

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

test "callArgs (i64...i64, f64)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest;
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest;
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
    const Float = abi.Floats[0];
    const f = @typeInfo(@TypeOf(ns.function)).Fn;
    const fixed_floats = [_]Float{};
    const fixed_ints = abi.toInts(@as(i64, 1000));
    const variadic_floats = switch (abi.variadic.float) {
        .float => abi.toFloats(@as(f64, 3.14)),
        else => [_]f64{},
    };
    const variadic_ints = switch (abi.variadic.float) {
        .float => abi.toInts(@as(i64, 7)),
        else => abi.toInts(@as(i64, 7)) ++ abi.toInts(@as(f64, 3.14)),
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
    try expect(result1 == result2);
    // extra args
    // const result3 = callWithArgs(
    //     f.return_type.?,
    //     f.calling_convention,
    //     @ptrCast(&ns.function),
    //     [_]f64{},
    //     [_]i64{1000},
    //     if (variadic_floats.len > 0) variadic_floats ++ [_]f64{ 34.32443, 434343.3, 32e9 } else variadic_floats,
    //     variadic_ints ++ [_]i64{ 1213, 324, 234324, 32434 },
    // );
    // try expect(result1 == result3);
}

// test "callArgs (i64...i32, i32, i32)" {
//     if (comptime is(.aarch64, .linux)) return error.SkipZigTest;
//     if (comptime is(.x86_64, .windows)) return error.SkipZigTest;
//     const ns = struct {
//         fn function(arg0: i64, ...) callconv(.C) i64 {
//             var va_list = @cVaStart();
//             defer @cVaEnd(&va_list);
//             const arg1 = @cVaArg(&va_list, i64);
//             const arg2 = @cVaArg(&va_list, i32);
//             const arg3 = @cVaArg(&va_list, i32);
//             return arg0 + arg1 + arg2 + arg3;
//         }
//     };
//     const result1 = ns.a(1000, @as(i64, 7), @as(i32, -5), @as(i32, -2));
//     const f = @typeInfo(@TypeOf(ns.function)).Fn;
//     const fixed_floats = [_]f64{};
//     const fixed_ints = [_]i64{1000};
//     const variadic_floats = [_]f64{};
//     const variadic_ints = switch (abi.Ints[0]) {
//         i64 => [_]i64{7, abi.expand(i64, @as(i32, -5)), abi.expand(i64, @as(i32, -2)) },
//         else => [_]i64{ 7, @bitCast(@as(f64, 3.14)) },
//     };
//     const result2 = callWithArgs(
//         f.return_type.?,
//         f.calling_convention,
//         @ptrCast(&ns.function),
//         fixed_floats,
//         fixed_ints,
//         variadic_floats,
//         variadic_ints,
//     );
//     try expect(result1 == result2);
//     // extra args
//     const result3 = callWithArgs(
//         f.return_type.?,
//         f.calling_convention,
//         @ptrCast(&function),
//         [_]f64{},
//         [_]i64{1000},
//         if (variadic_floats.len > 0) variadic_floats ++ [_]f64{ 34.32443, 434343.3, 32e9 } else variadic_floats,
//         variadic_ints ++ [_]i64{ 1213, 324, 234324, 32434 },
//     );
//     try expect(result1 == result3);
// }
