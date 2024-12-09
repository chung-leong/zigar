const std = @import("std");
const builtin = @import("builtin");
const types = @import("types.zig");
const expect = std.testing.expect;

const is_wasm = switch (builtin.target.cpu.arch) {
    .wasm32, .wasm64 => true,
    else => false,
};

pub const Error = error{
    TooManyArguments,
    UnsupportedArgumentType,
    InvalidArgumentAttributes,
};

pub fn call(
    comptime FT: type,
    fn_ptr: *const anyopaque,
    arg_ptr: *anyopaque,
    attr_ptr: *const anyopaque,
    arg_count: usize,
) !void {
    const function: *const FT = @ptrCast(fn_ptr);
    const f = @typeInfo(FT).@"fn";
    const Args = types.ArgumentStruct(FT);
    const arg_struct: *Args = @ptrCast(@alignCast(arg_ptr));
    const arg_bytes: [*]u8 = @ptrCast(arg_ptr);
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
            .@"fn" = .{
                .calling_convention = f.calling_convention,
                .is_generic = false,
                .is_var_args = false,
                .return_type = f.return_type,
                .params = &params,
            },
        });
        var args: std.meta.ArgsTuple(F) = undefined;
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
        // use a variable here, so that Zig doesn't try to call it as a vararg function
        // despite the cast to a non-vararg one
        var not_vararg_func: *const F = @ptrCast(function);
        std.mem.doNotOptimizeAway(&not_vararg_func);
        arg_struct.retval = @call(.auto, not_vararg_func, args);
    } else {
        const abi = Abi.init(builtin.target.cpu.arch, builtin.target.os.tag);
        const Alloc = ArgAllocation(abi, FT);
        const alloc = try Alloc.init(arg_bytes, arg_attrs);
        const fixed_ints = alloc.getFixedInts();
        const fixed_floats = alloc.getFixedFloats();
        // always call using all available registers
        const max_variadic_float_count = comptime Alloc.getMaxVariadicFloatCount();
        const max_variadic_int_count = comptime Alloc.getMaxVariadicIntCount();
        const variadic_floats = alloc.getVariadicFloats(max_variadic_float_count);
        arg_struct.retval = inline for (Alloc.stack_counts) |stack_count| {
            // keep increasing number of stack variables until we've enough
            if (alloc.getVariadicIntCount() <= max_variadic_int_count + stack_count) {
                const variadic_ints = alloc.getVariadicInts(max_variadic_int_count + stack_count);
                break callWithArgs(
                    f.return_type.?,
                    f.calling_convention,
                    function,
                    fixed_floats.*,
                    fixed_ints.*,
                    variadic_floats.*,
                    variadic_ints.*,
                );
            }
        } else unreachable;
    }
}

fn createTest(RT: type, tuple: anytype) type {
    const Args = types.ArgumentStruct(fn (@TypeOf(tuple[0]), ...) callconv(.C) RT);
    comptime var current_offset: u16 = @sizeOf(Args);
    comptime var offsets: [tuple.len]u16 = undefined;
    inline for (tuple, 0..) |value, index| {
        const T = @TypeOf(value);
        const alignment: u16 = @alignOf(T);
        const offset = std.mem.alignForward(usize, current_offset, alignment);
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

        pub fn run() !void {
            var arg_bytes: [arg_size]u8 align(@alignOf(Args)) = undefined;
            var attrs: [tuple.len]ArgAttributes = undefined;
            inline for (&attrs, 0..) |*p, index| {
                const offset = offsets[index];
                const value = tuple[index];
                const T = @TypeOf(value);
                p.* = .{
                    .offset = offset,
                    .bit_size = @bitSizeOf(T),
                    .alignment = @alignOf(T),
                    .is_float = @typeInfo(T) == .float,
                    .is_signed = @typeInfo(T) == .int and @typeInfo(T).int.signedness == .signed,
                };
                const bytes = std.mem.toBytes(value);
                @memcpy(arg_bytes[offset .. offset + bytes.len], &bytes);
            }
            try call(@TypeOf(check), &check, &arg_bytes, @ptrCast(&attrs), attrs.len);
            const arg_struct = @as(*Args, @ptrCast(@alignCast(&arg_bytes)));
            if (arg_struct.retval != 777) {
                return error.TestUnexpectedResult;
            }
        }
    };
}

test "parameter passing (i8...)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest; // missing support
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest; // missing support
    try createTest(i32, .{
        @as(i8, -1),
    }).run();
}

test "parameter passing (i8...i8)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest; // missing support
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest; // missing support
    try createTest(i32, .{
        @as(i8, -1),
        @as(i8, -2),
    }).run();
}

test "parameter passing (i8...i8, i8, i8)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest; // missing support
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest; // missing support
    if (comptime is(.x86, .linux)) return error.SkipZigTest; // likely a compiler bug
    try createTest(i32, .{
        @as(i8, -1),
        @as(i8, -2),
        @as(i8, -3),
        @as(i8, -4),
    }).run();
}

test "parameter passing (u8...)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest; // missing support
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest; // missing support
    try createTest(i32, .{
        @as(u8, 122),
    }).run();
}

test "parameter passing (u8...u8)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest; // missing support
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest; // missing support
    try createTest(i32, .{
        @as(u8, 222),
        @as(u8, 111),
    }).run();
}

test "parameter passing (u8...u8, u8, u8)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest; // missing support
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest; // missing support
    if (comptime is(.x86, .linux)) return error.SkipZigTest; // likely a compiler bug
    try createTest(i32, .{
        @as(u8, 222),
        @as(u8, 111),
        @as(u8, 33),
        @as(u8, 44),
    }).run();
}

test "parameter passing (i16...)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest; // missing support
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest; // missing support
    if (comptime is(.x86, .linux)) return error.SkipZigTest; // likely a compiler bug
    try createTest(i32, .{
        @as(i16, -1),
    }).run();
}

test "parameter passing (i16...i16)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest; // missing support
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest; // missing support
    try createTest(i32, .{
        @as(i16, -1),
        @as(i16, -2),
    }).run();
}

test "parameter passing (i16...i16, i16, i16)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest; // missing support
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest; // missing support
    if (comptime is(.x86, .linux)) return error.SkipZigTest; // likely a compiler bug
    try createTest(i32, .{
        @as(i16, -1),
        @as(i16, -2),
        @as(i16, -3),
        @as(i16, -4),
    }).run();
}

test "parameter passing (u16...)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest; // missing support
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest; // missing support
    try createTest(i32, .{
        @as(u16, 122),
    }).run();
}

test "parameter passing (u16...u16)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest; // missing support
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest; // missing support
    try createTest(i32, .{
        @as(u16, 222),
        @as(u16, 111),
    }).run();
}

test "parameter passing (u16...u16, u16, u16)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest; // missing support
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest; // missing support
    if (comptime is(.x86, .linux)) return error.SkipZigTest; // likely a compiler bug
    try createTest(i32, .{
        @as(u16, 222),
        @as(u16, 111),
        @as(u16, 333),
        @as(u16, 444),
    }).run();
}

test "parameter passing (i32...)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest; // missing support
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest; // missing support
    try createTest(u32, .{
        @as(i32, -12345),
    }).run();
}

test "parameter passing (i32...i32)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest; // missing support
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest; // missing support
    try createTest(u32, .{
        @as(i32, -12345),
        @as(i32, 33333),
    }).run();
}

test "parameter passing (i32...i32, i32, i32)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest; // missing support
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest; // missing support
    try createTest(u32, .{
        @as(i32, -12345),
        @as(i32, 33333),
        @as(i32, 44444),
        @as(i32, 55555),
    }).run();
}

test "parameter passing (u32...)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest; // missing support
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest; // missing support
    try createTest(u32, .{
        @as(u32, 1234),
    }).run();
}

test "parameter passing (u32...u32)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest; // missing support
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest; // missing support
    try createTest(u32, .{
        @as(u32, 0xFFFF_FFFF),
        @as(u32, 0xAAAA_BBBB),
    }).run();
}

test "parameter passing (u32...u32, u32, u32)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest; // missing support
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest; // missing support
    try createTest(u32, .{
        @as(u32, 0xFFFF_FFFF),
        @as(u32, 0xAAAA_BBBB),
        @as(u32, 0xCCCC_DDDD),
        @as(u32, 0xFFFF_AAAA),
    }).run();
}

test "parameter passing (i64...)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest; // missing support
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest; // missing support
    try createTest(u32, .{
        @as(i64, -12345),
    }).run();
}

test "parameter passing (i64...i64)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest; // missing support
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest; // missing support
    try createTest(u32, .{
        @as(i64, 12345),
        @as(i64, 33333),
    }).run();
}

test "parameter passing (i64...i64, i64, i64)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest; // missing support
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest; // missing support
    try createTest(u32, .{
        @as(i64, -12345),
        @as(i64, -33333),
        @as(i64, -44444),
        @as(i64, -55555),
    }).run();
}

test "parameter passing (u64...)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest; // missing support
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest; // missing support
    try createTest(u32, .{
        @as(u64, 1234),
    }).run();
}

test "parameter passing (u64...u64)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest; // missing support
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest; // missing support
    try createTest(u32, .{
        @as(u64, 0xFFFF_FFFF_FFFF_FFFF),
        @as(u64, 0xAAAA_BBBB_CCCC_DDDD),
    }).run();
}

test "parameter passing (u64...u64, u64, u64)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest; // missing support
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest; // missing support
    try createTest(u32, .{
        @as(u64, 0xFFFF_FFFF_FFFF_FFFF),
        @as(u64, 0xAAAA_BBBB_CCCC_DDDD),
        @as(u64, 0xAAAA_FFFF_CCCC_DDDD),
        @as(u64, 0xAAAA_AAAA_CCCC_CCCC),
    }).run();
}

test "parameter passing (i128...)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest; // missing support
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest; // missing support
    try createTest(u32, .{
        @as(i128, -12345),
    }).run();
}

test "parameter passing (i128...i128)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest; // missing support
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest; // missing support
    try createTest(u32, .{
        @as(i128, 12345),
        @as(i128, 33333),
    }).run();
}

test "parameter passing (i128...i128, i128, i128)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest; // missing support
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest; // missing support
    if (comptime is(.x86_64, .linux)) return error.SkipZigTest; // compiler bug
    try createTest(u32, .{
        @as(i128, 12345),
        @as(i128, 33333),
        @as(i128, -33333),
        @as(i128, -54321),
    }).run();
}

test "parameter passing (u128...)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest; // missing support
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest; // missing support
    try createTest(u32, .{
        @as(u128, 1234),
    }).run();
}

test "parameter passing (u128...u128)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest; // missing support
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest; // missing support
    try createTest(u32, .{
        @as(u128, 0xFFFF_FFFF_FFFF_FFFF_FFFF_FFFF),
        @as(u128, 0xAAAA_BBBB_CCCC_DDDD_EEEE_FFFF),
    }).run();
}

test "parameter passing (u128...u128, u128, u128)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest; // missing support
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest; // missing support
    if (comptime is(.x86_64, .linux)) return error.SkipZigTest; // compiler bug
    try createTest(u32, .{
        @as(u128, 0xFFFF_FFFF_FFFF_FFFF_FFFF_FFFF),
        @as(u128, 0xAAAA_BBBB_CCCC_DDDD_EEEE_FFFF),
        @as(u128, 0xAAAA_AAAA_BBBB_CCCC_DDDD_EEEE_FFFF),
        @as(u128, 0xBBBB_AAAA_AAAA_BBBB_CCCC_DDDD_EEEE_FFFF),
    }).run();
}

test "parameter passing (f16...)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest;
    if (comptime is(.arm, .linux)) return error.SkipZigTest;
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest;
    // if (comptime is(.riscv64, .linux)) return error.SkipZigTest;
    try createTest(i32, .{
        @as(f16, -1.25),
    }).run();
}

test "parameter passing (f16...f16)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest;
    if (comptime is(.arm, .linux)) return error.SkipZigTest;
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest;
    if (comptime is(.riscv64, .linux)) return error.SkipZigTest;
    try createTest(i32, .{
        @as(f16, 1.25),
        @as(f16, -2.5),
    }).run();
}

test "parameter passing (f16...f16, f16, f16)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest; // missing support
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest; // missing support
    if (comptime is(.x86, .linux)) return error.SkipZigTest; // likely a compiler bug
    if (comptime is(.arm, .linux)) return error.SkipZigTest; // likely a compiler bug
    if (comptime is(.riscv64, .linux)) return error.SkipZigTest; // likely a compiler bug
    try createTest(i32, .{
        @as(f16, -1.25),
        @as(f16, -2.25),
        @as(f16, -3.25),
        @as(f16, -4.25),
    }).run();
}

test "parameter passing (f32...)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest; // missing support
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest; // missing support
    try createTest(i32, .{
        @as(f32, -1.2345),
    }).run();
}

test "parameter passing (f32...f32)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest; // missing support
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest; // missing support
    try createTest(i32, .{
        @as(f32, 1.2345),
        @as(f32, -2.555),
    }).run();
}

test "parameter passing (f32...f32, f32, f32)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest; // missing support
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest; // missing support
    try createTest(i32, .{
        @as(f32, -1.23333),
        @as(f32, -2.24444),
        @as(f32, -3.255555),
        @as(f32, -4.25123),
    }).run();
}

test "parameter passing (f64...)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest; // missing support
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest; // missing support
    try createTest(i32, .{
        @as(f64, -1.2345),
    }).run();
}

test "parameter passing (f64...f64)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest; // missing support
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest; // missing support
    try createTest(i32, .{
        @as(f64, 1.2345),
        @as(f64, -2.555),
    }).run();
}

test "parameter passing (f64...f64, f64, f64)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest; // missing support
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest; // missing support
    try createTest(i32, .{
        @as(f64, -1.23333),
        @as(f64, -2.24444),
        @as(f64, -3.255555),
        @as(f64, -4.25123),
    }).run();
}

test "parameter passing (f80...)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest; // missing support
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest; // missing support
    if (comptime is(.x86_64, .linux)) return error.SkipZigTest; // seems to be a compiler bug
    try createTest(i32, .{
        @as(f80, -1.2345),
    }).run();
}

test "parameter passing (f80...f80)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest; // missing support
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest; // missing support
    if (comptime is(.x86_64, .linux)) return error.SkipZigTest; // seems to be a compiler bug
    if (comptime is(.arm, .linux)) return error.SkipZigTest; // might be a compiler bug
    try createTest(i32, .{
        @as(f80, 1.2345),
        @as(f80, -2.555),
    }).run();
}

test "parameter passing (f80...f80, f80, f80)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest; // missing support
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest; // missing support
    if (comptime is(.x86_64, .linux)) return error.SkipZigTest; // seems to be a compiler bug
    if (comptime is(.arm, .linux)) return error.SkipZigTest; // might be a compiler bug
    try createTest(i32, .{
        @as(f80, -1.23333),
        @as(f80, -2.24444),
        @as(f80, -3.255555),
        @as(f80, -4.25123),
    }).run();
}

test "parameter passing (f128...)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest; // missing support
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest; // missing support
    try createTest(i32, .{
        @as(f128, -1.2345),
    }).run();
}

test "parameter passing (f128...f128)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest; // missing support
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest; // missing support
    if (comptime is(.arm, .linux)) return error.SkipZigTest; // might be a compiler bug
    try createTest(i32, .{
        @as(f128, 1.2345),
        @as(f128, -2.555),
    }).run();
}

test "parameter passing (f128...f128, f128, f128)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest; // missing support
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest; // missing support
    try createTest(i32, .{
        @as(f128, -1.23333),
        @as(f128, -2.24444),
        @as(f128, -3.255555),
        @as(f128, -4.25123),
    }).run();
}

test "parameter passing (i32, f32)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest; // missing support
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest; // missing support
    try createTest(u32, .{
        @as(i32, 1234),
        @as(f32, 1.2345),
    }).run();
}

test "parameter passing (i32, f64)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest; // missing support
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest; // missing support
    try createTest(u32, .{
        @as(i32, 1000),
        @as(f64, 1.23),
    }).run();
}

test "parameter passing (i32, i32, f64)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest; // missing support
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest; // missing support
    try createTest(u32, .{
        @as(i32, 1000),
        @as(i32, 2000),
        @as(f64, 3.14),
    }).run();
}

test "parameter passing (f64, f32)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest; // missing support
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest; // missing support
    try createTest(u32, .{
        @as(f64, 1.234),
        @as(f32, 4.5678),
    }).run();
}

test "parameter passing (i64, f64)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest; // missing support
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest; // missing support
    try createTest(u32, .{
        @as(i64, 1000),
        @as(f64, 4.5678),
    }).run();
}

test "parameter passing (u8, usize, f16, f16, f16)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest; // missing support
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest; // missing support
    if (comptime is(.x86, .linux)) return error.SkipZigTest; // likely a compiler bug
    if (comptime is(.arm, .linux)) return error.SkipZigTest; // likely a compiler bug
    if (comptime is(.riscv64, .linux)) return error.SkipZigTest;
    try createTest(u32, .{
        @as(u8, 16),
        @as(usize, 2),
        @as(f16, -1),
        @as(f16, -2),
        @as(f16, -3),
    }).run();
}

test "parameter passing (i32, f32, f32)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest; // missing support
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest; // missing support
    try createTest(u32, .{
        @as(i32, 1234),
        @as(f32, 1.234),
        @as(f32, 4.567),
    }).run();
}

test "parameter passing (u64, f32, f64)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest; // missing support
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest; // missing support
    try createTest(u32, .{
        @as(u64, 1234),
        @as(f32, 1.234),
        @as(f64, 4.567),
    }).run();
}

test "parameter passing (f128, f64, f32)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest; // missing support
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest; // missing support
    try createTest(u32, .{
        @as(f128, 1234),
        @as(f64, 1.234),
        @as(f32, 4.567),
    }).run();
}

test "parameter passing (i32, f32, i32, f32)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest; // missing support
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest; // missing support
    try createTest(u32, .{
        @as(i32, 1234),
        @as(f32, 1.234),
        @as(i32, 4567),
        @as(f32, 4.567),
    }).run();
}

test "parameter passing (i32, f32, i32, f32, i32, f32)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest; // missing support
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest; // missing support
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
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest; // missing support
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest; // missing support
    try createTest(u32, .{
        @as(i32, 1234),
        @as(f64, 1.234),
        @as(i32, 4567),
        @as(f64, 4.567),
    }).run();
}

test "parameter passing (f32, i32, f32, i32)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest; // missing support
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest; // missing support
    try createTest(u32, .{
        @as(f32, 1.234),
        @as(i32, 4567),
        @as(f32, 4.567),
        @as(i32, 1234),
    }).run();
}

test "parameter passing (f64, f64, f64, f64, f64, f64, f64, f64)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest; // missing support
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest; // missing support
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
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest; // missing support
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest; // missing support
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
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest; // missing support
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest; // missing support
    if (comptime is(.arm, .linux)) return error.SkipZigTest; // compiler bug perhaps
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
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest; // missing support
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest; // missing support
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
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest; // missing support
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest; // missing support
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
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest; // missing support
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest; // missing support
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

fn createSprintfTest(fmt: []const u8, tuple: anytype) type {
    const c = @cImport({
        @cInclude("stdio.h");
    });
    const FT = @TypeOf(c.sprintf);
    const f = @typeInfo(FT).@"fn";
    const Args = types.ArgumentStruct(FT);
    comptime var current_offset: u16 = @sizeOf(Args);
    comptime var offsets: [f.params.len + tuple.len]u16 = undefined;
    inline for (f.params, 0..) |param, index| {
        const offset = std.mem.alignForward(usize, current_offset, @alignOf(param.type.?));
        offsets[index] = offset;
        current_offset = offset + @sizeOf(param.type.?);
    }
    inline for (tuple, 0..) |value, index| {
        const T = @TypeOf(value);
        const offset = std.mem.alignForward(usize, current_offset, @alignOf(T));
        offsets[f.params.len + index] = offset;
        current_offset = offset + @sizeOf(T);
    }
    const arg_size = current_offset;
    return struct {
        pub fn run() !void {
            var arg_bytes: [arg_size]u8 align(@alignOf(Args)) = undefined;
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
                    .bit_size = @bitSizeOf(T),
                    .alignment = @alignOf(T),
                    .is_float = @typeInfo(T) == .float,
                    .is_signed = @typeInfo(T) == .int and @typeInfo(T).int.signedness == .signed,
                };
                const bytes = std.mem.toBytes(value);
                @memcpy(arg_bytes[offset .. offset + bytes.len], &bytes);
            }
            try call(@TypeOf(c.sprintf), &c.sprintf, &arg_bytes, @ptrCast(&attrs), attrs.len);
            const arg_struct = @as(*Args, @ptrCast(@alignCast(&arg_bytes)));
            if (arg_struct.retval < 0) {
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
            const len1: usize = @intCast(arg_struct.retval);
            const len2: usize = @intCast(retval2);
            const s1 = buffer1[0..len1];
            const s2 = buffer2[0..len2];
            if (s1.len != s2.len or !std.mem.eql(u8, s1, s2)) {
                std.debug.print("\nMismatch: {s} != {s}\n", .{ s1, s2 });
                return error.TestUnexpectedResult;
            }
        }
    };
}

test "sprintf (i8, i8)" {
    if (!builtin.link_libc) return error.SkipZigTest;
    try createSprintfTest("%hhd %hhd", .{
        @as(i8, -123),
        @as(i8, -124),
    }).run();
}

test "sprintf (u8, u8, u8, u8)" {
    if (!builtin.link_libc) return error.SkipZigTest;
    try createSprintfTest("%hhu %hhu %hhu %hhu", .{
        @as(u8, 12),
        @as(u8, 23),
        @as(u8, 34),
        @as(u8, 45),
    }).run();
}

test "sprintf (i16, i16)" {
    if (!builtin.link_libc) return error.SkipZigTest;
    try createSprintfTest("%hd %hd", .{
        @as(i16, -123),
        @as(i16, -124),
    }).run();
}

test "sprintf (u16, u16, u16, u16)" {
    if (!builtin.link_libc) return error.SkipZigTest;
    try createSprintfTest("%hu %hu %hu %hu", .{
        @as(u16, 12),
        @as(u16, 23),
        @as(u16, 34),
        @as(u16, 45),
    }).run();
}

test "sprintf (i32, i32)" {
    if (!builtin.link_libc) return error.SkipZigTest;
    try createSprintfTest("%d %d", .{
        @as(i32, -1230),
        @as(i32, -1240),
    }).run();
}

test "sprintf (u32, u32, u32, u32)" {
    if (!builtin.link_libc) return error.SkipZigTest;
    try createSprintfTest("%u %u %u %u", .{
        @as(u32, 10012),
        @as(u32, 20023),
        @as(u32, 30034),
        @as(u32, 40045),
    }).run();
}

test "sprintf (i64, i64)" {
    if (!builtin.link_libc) return error.SkipZigTest;
    try createSprintfTest("%ld %ld", .{
        @as(i64, -1234),
        @as(i64, -4567),
    }).run();
}

test "sprintf (u64, u64, u64, u64)" {
    if (!builtin.link_libc) return error.SkipZigTest;
    try createSprintfTest("%lu %lu %lu %lu", .{
        @as(i64, 12340),
        @as(i64, 45670),
        @as(i64, 77777),
        @as(i64, 88888),
    }).run();
}

test "sprintf (i64)" {
    if (!builtin.link_libc) return error.SkipZigTest;
    try createSprintfTest("%ld", .{
        @as(i64, 1234),
    }).run();
}

test "sprintf (i64, i32)" {
    if (!builtin.link_libc) return error.SkipZigTest;
    try createSprintfTest("%ld %d", .{
        @as(i64, 1234),
        @as(i32, 4567),
    }).run();
}

test "sprintf (i64, i32, i64)" {
    if (!builtin.link_libc) return error.SkipZigTest;
    try createSprintfTest("%ld %d %ld", .{
        @as(i64, 1234),
        @as(i32, 4567),
        @as(i64, -314),
    }).run();
}

test "sprintf (i64, i32, f64)" {
    if (!builtin.link_libc) return error.SkipZigTest;
    if (comptime is(.arm, .linux)) return error.SkipZigTest; // both result and control are wrong
    try createSprintfTest("%ld %d %f", .{
        @as(i64, 1234),
        @as(i32, 4567),
        @as(f64, -3.14),
    }).run();
}

test "sprintf (i64, i32, f64, [*:0]const u8)" {
    if (!builtin.link_libc) return error.SkipZigTest;
    if (comptime is(.arm, .linux)) return error.SkipZigTest; // both result and control are wrong
    try createSprintfTest("%s, %ld %d %f", .{
        @as([*:0]const u8, "Hello world"),
        @as(i64, 1234),
        @as(i32, 4567),
        @as(f64, 3.14),
    }).run();
}

test "sprintf (i64, i64, i64, i64, i64, i64, i64, i64, i64, i64, i64, i64, i64, i64, i64, i64)" {
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

// test "sprintf (i64, c_longdouble, i64, c_longdouble)" {
//     if (!builtin.link_libc) return error.SkipZigTest;
//     try createSprintfTest("%ld %lf %ld %lf", .{
//         @as(i64, -123),
//         @as(c_longdouble, 3.14),
//         @as(i64, -235),
//         @as(c_longdouble, 7.77),
//     }).run();
// }

// test "sprintf (c_longdouble, c_longdouble)" {
//     if (!builtin.link_libc) return error.SkipZigTest;
//     try createSprintfTest("%lf %lf", .{
//         @as(c_longdouble, 3.14),
//         @as(c_longdouble, 7.77),
//     }).run();
// }

fn getWordCount(comptime T: type, comptime VT: type) usize {
    return switch (@sizeOf(VT) <= @sizeOf(T)) {
        true => 1,
        false => std.mem.alignForward(usize, @sizeOf(VT), @sizeOf(T)) / @sizeOf(T),
    };
}

const SignExtender = enum { callee, caller };
const Abi = struct {
    int: struct {
        type: type,
        acceptable_types: []const type = &.{},
        available_registers: comptime_int = 0,
        float_in_registers: bool = true,
    },
    float: struct {
        type: type,
        acceptable_types: []const type = &.{},
        available_registers: comptime_int = 0,
        accept_variadic: bool = false,
    },
    sign_extender: SignExtender = .callee,

    fn init(arch: std.Target.Cpu.Arch, os_tag: std.Target.Os.Tag) @This() {
        return switch (arch) {
            .x86_64 => switch (os_tag) {
                .windows => .{
                    .int = .{
                        .type = i64,
                        .acceptable_types = &.{ f128, f80, f64 },
                        .available_registers = 4, // RCX, RDX, R8, R9
                    },
                    .float = .{
                        .type = f128,
                        .available_registers = 4, // XMM0, XMM1, XMM2, XMM3
                    },
                },
                else => .{
                    .int = .{
                        .type = i64,
                        .acceptable_types = &.{ f128, f80, f64 },
                        .available_registers = 6, // RDI, RSI, RDX, RCX, R8, R9
                        .float_in_registers = false,
                    },
                    .float = .{
                        .type = f128,
                        .available_registers = 8, // XMM0 - XMM7
                        .accept_variadic = true,
                    },
                },
            },
            .aarch64 => switch (builtin.target.os.tag) {
                .macos, .ios, .tvos, .watchos => .{
                    .int = .{
                        .type = i64,
                        .available_registers = 8, // x0 - x7
                        .float_in_registers = true,
                    },
                    .float = .{
                        .type = f128,
                        .available_registers = 8, // v0 - v7
                    },
                    .sign_extender = .caller,
                },
                else => .{
                    .int = .{
                        .type = i64,
                        .available_registers = 8, // x0 - x7
                        .acceptable_types = &.{ i128, u128, f128 },
                        .float_in_registers = false,
                    },
                    .float = .{
                        .type = f128,
                        .available_registers = 8, // v0 - v7
                        .accept_variadic = true,
                    },
                },
            },
            .riscv64 => .{
                .int = .{
                    .type = i64,
                    .available_registers = 8, // a0 - a7
                    .acceptable_types = &.{ i128, u128, f128, f80, f32 },
                },
                .float = .{
                    .type = f64,
                    .available_registers = 8, // fa0 - fa7
                },
            },
            .powerpc64le => .{
                .int = .{
                    .type = i64,
                    .available_registers = 8, // r3 - r10
                    .acceptable_types = &.{f32},
                },
                .float = .{
                    .type = f64,
                    .available_registers = 13, // f1 - f13
                },
                .sign_extender = .caller,
            },
            .x86 => .{
                .int = .{
                    .type = i32,
                },
                .float = .{
                    .type = f64,
                },
            },
            .arm => .{
                .int = .{
                    .type = i32,
                    .acceptable_types = &.{f64},
                },
                .float = .{
                    .type = f64,
                },
            },
            else => @compileError("Variadic functions not supported on this architecture: " ++ @tagName(builtin.target.cpu.arch)),
        };
    }

    fn extend(comptime self: @This(), comptime T: type, value: anytype) T {
        const ValueType = @TypeOf(value);
        if (ValueType == T) {
            return value;
        }
        const signed = switch (@typeInfo(ValueType)) {
            .int => |int| int.signedness == .signed,
            .float => true,
            else => false,
        };
        const value_bits = switch (@typeInfo(ValueType)) {
            .int => |int| int.bits,
            .float => |float| float.bits,
            else => @sizeOf(ValueType) * 8,
        };
        const signedness = if (signed) switch (self.sign_extender) {
            .callee => .unsigned,
            .caller => .signed,
        } else .unsigned;
        const IntType = @Type(.{ .int = .{
            .bits = value_bits,
            .signedness = signedness,
        } });
        const retval_bits = switch (@typeInfo(T)) {
            .int => |int| int.bits,
            .float => |float| float.bits,
            else => @sizeOf(T) * 8,
        };
        const BigIntType = @Type(.{ .int = .{
            .bits = retval_bits,
            .signedness = signedness,
        } });
        const int_value: IntType = @bitCast(value);
        const big_int_value: BigIntType = @intCast(int_value);
        return @bitCast(big_int_value);
    }

    fn toWords(comptime self: @This(), comptime T: type, value: anytype) [getWordCount(T, @TypeOf(value))]T {
        const count = comptime getWordCount(T, @TypeOf(value));
        return switch (count) {
            1 => [1]T{self.extend(T, value)},
            else => split: {
                const size = @sizeOf(T);
                const bytes = get: {
                    if (@sizeOf(@TypeOf(value)) == size * count) {
                        break :get std.mem.toBytes(value);
                    } else {
                        const BigInt = @Type(.{
                            .int = .{
                                .bits = size * count * 8,
                                .signedness = .signed,
                            },
                        });
                        const big_int_value = self.extend(BigInt, value);
                        break :get std.mem.toBytes(big_int_value);
                    }
                };
                var ints: [count]T = undefined;
                inline for (&ints, 0..) |*p, index| {
                    p.* = std.mem.bytesToValue(T, bytes[index * size .. index * size + size]);
                }
                break :split ints;
            },
        };
    }

    fn packInt(comptime self: @This(), values: anytype) self.int.type {
        const Int = self.int.type;
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
        .int = .{
            .type = i64,
        },
        .float = .{
            .type = f64,
        },
        .sign_extender = .caller,
    };
    const a = abi1.extend(u64, @as(u8, 233));
    try expect(a == 233);
    const b = abi1.extend(i64, @as(i8, -1));
    try expect(b == -1);
    const abi2: Abi = .{
        .int = .{
            .type = i64,
        },
        .float = .{
            .type = f64,
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

test "Abi.toWords" {
    const abi1: Abi = .{
        .int = .{
            .type = i64,
        },
        .float = .{
            .type = f64,
        },
        .sign_extender = .caller,
    };
    const a = abi1.toWords(i64, @as(i8, -2));
    try expect(a.len == 1);
    try expect(a[0] == -2);
    const abi2: Abi = .{
        .int = .{
            .type = i32,
        },
        .float = .{
            .type = f64,
        },
        .sign_extender = .caller,
    };
    const b = abi2.toWords(i32, @as(i64, -2));
    try expect(b.len == 2);
    // assuming little endian
    try expect(b[0] == -2);
    try expect(b[1] == -1);
    const c = abi1.toWords(f64, @as(f64, -2));
    try expect(c.len == 1);
    try expect(c[0] == -2);
    const d = abi2.toWords(f64, @as(f128, -2));
    try expect(d.len == 2);
    const e = abi2.toWords(f64, @as(f80, -2));
    try expect(e.len == 2);
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
    const Float = @typeInfo(@TypeOf(fixed_floats)).array.child;
    const Int = @typeInfo(@TypeOf(fixed_ints)).array.child;
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
        .@"fn" = .{
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
        .@"struct" = .{
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
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest; // missing support
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest; // missing support
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
    const f = @typeInfo(@TypeOf(ns.function)).@"fn";
    const Int = abi.int.type;
    const Float = abi.float.type;
    const fixed_floats = [_]Float{};
    const fixed_ints = abi.toWords(Int, @as(i64, 1000));
    const variadic_floats = comptime switch (abi.float.accept_variadic) {
        true => abi.toWords(Float, @as(f64, 3.14)),
        false => [_]f64{},
    };
    const variadic_ints = comptime switch (abi.float.accept_variadic) {
        true => abi.toWords(Int, @as(i64, 7)),
        false => abi.toWords(Int, @as(i64, 7)) ++ abi.toWords(Int, @as(f64, 3.14)),
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
    const variadic_floats_plus_garbage = comptime switch (abi.float.accept_variadic) {
        true => variadic_floats ++ abi.toWords(Float, @as(f64, 34.32443)) ++ abi.toWords(Float, @as(f64, 434343.3)),
        false => variadic_floats,
    };
    const variadic_ints_plus_garbage = variadic_ints ++ abi.toWords(Int, @as(i64, 1213)) ++ abi.toWords(Int, @as(i64, 324));
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
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest; // missing support
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest; // missing support
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
    const f = @typeInfo(@TypeOf(ns.function)).@"fn";
    const Int = abi.int.type;
    const Float = abi.float.type;
    const fixed_floats = [_]Float{};
    const fixed_ints = abi.toWords(Int, @as(i64, 1000));
    const variadic_floats = [_]Float{};
    const variadic_ints = abi.toWords(Int, @as(i64, 7)) ++ abi.toWords(Int, @as(i32, -5)) ++ abi.toWords(Int, @as(i32, -2));
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
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest; // missing support
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest; // missing support
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
    const f = @typeInfo(@TypeOf(ns.function)).@"fn";
    const Int = abi.int.type;
    const Float = abi.float.type;
    const fixed_floats = [_]Float{};
    const fixed_ints = abi.toWords(Int, @as(i64, 1000));
    const variadic_floats = [_]Float{};
    const variadic_ints = abi.toWords(Int, @as(i32, 7)) ++ abi.toWords(Int, @as(i32, -5)) ++ abi.toWords(Int, @as(i32, -2));
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
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest; // missing support
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest; // missing support
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
    const f = @typeInfo(@TypeOf(ns.function)).@"fn";
    const Int = abi.int.type;
    const Float = abi.float.type;
    const fixed_floats = [_]Float{};
    const fixed_ints = abi.toWords(Int, @as(i64, 1000));
    const variadic_floats = comptime switch (abi.float.accept_variadic) {
        true => abi.toWords(Float, @as(f32, -5)) ++ abi.toWords(Float, @as(f32, -2)),
        false => [_]Float{},
    };
    const variadic_ints = comptime switch (abi.float.accept_variadic) {
        true => abi.toWords(Int, @as(i32, 7)),
        false => switch (Int == i64 and in(f32, abi.int.acceptable_types)) {
            true => abi.toWords(Int, @as(i32, 7)) ++ [1]Int{abi.packInt(.{ @as(f32, -5), @as(f32, -2) })},
            else => abi.toWords(Int, @as(i32, 7)) ++ abi.toWords(Int, @as(f32, -5)) ++ abi.toWords(Int, @as(f32, -2)),
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
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest; // missing support
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest; // missing support
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
    const f = @typeInfo(@TypeOf(ns.function)).@"fn";
    const Int = abi.int.type;
    const Float = abi.float.type;
    const fixed_floats = [_]Float{};
    const fixed_ints = abi.toWords(Int, @as(i64, 1000));
    const variadic_floats = [_]Float{};
    const variadic_ints = comptime switch (in(i16, abi.int.acceptable_types)) {
        true => [_]Int{abi.packInt(.{ @as(i16, 7), @as(i16, -5) })},
        false => abi.toWords(Int, @as(i16, 7)) ++ abi.toWords(Int, @as(i16, -5)),
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
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest; // missing support
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest; // missing support
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
    const f = @typeInfo(@TypeOf(ns.function)).@"fn";
    const Int = abi.int.type;
    const Float = abi.float.type;
    const fixed_floats = [_]Float{};
    const fixed_ints = abi.toWords(Int, @as(i64, 1000));
    const variadic_floats = [_]Float{};
    const variadic_ints = comptime switch (in(i8, abi.int.acceptable_types)) {
        true => [_]Int{abi.packInt(.{ @as(i8, 7), @as(i8, -5) })},
        false => abi.toWords(Int, @as(i8, 7)) ++ abi.toWords(Int, @as(i8, -5)),
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
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest; // missing support
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest; // missing support
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
    const f = @typeInfo(@TypeOf(ns.function)).@"fn";
    const Int = abi.int.type;
    const Float = abi.float.type;
    const fixed_floats = [_]Float{};
    const fixed_ints = abi.toWords(Int, @as(i64, 1000));
    const variadic_floats = [_]Float{};
    const alignment_ints = comptime switch (in(i128, abi.int.acceptable_types)) {
        true => [_]Int{0},
        false => [_]Int{},
    };
    const variadic_ints = alignment_ints ++ abi.toWords(Int, @as(i128, -2));
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

const ArgKind = enum { fixed, variadic };
const ArgAttributes = extern struct {
    offset: u16,
    bit_size: u16,
    alignment: u16,
    is_float: bool,
    is_signed: bool,

    fn init(comptime Arg: type) [@typeInfo(Arg).@"struct".fields.len - 1]@This() {
        const fields = @typeInfo(Arg).@"struct".fields;
        var attrs: [fields.len - 1]@This() = undefined;
        inline for (fields, 0..) |field, index| {
            if (index == 0) {
                continue;
            }
            attrs[index - 1] = .{
                .offset = @offsetOf(Arg, field.name),
                .bit_size = @bitSizeOf(field.type),
                .alignment = @alignOf(field.type),
                .is_float = switch (@typeInfo(field.type)) {
                    .float => true,
                    else => false,
                },
                .is_signed = switch (@typeInfo(field.type)) {
                    .int => |int| int.signedness == .signed,
                    else => false,
                },
            };
        }
        return attrs;
    }
};

fn ArgAllocation(comptime abi: Abi, comptime FT: type) type {
    const f = @typeInfo(FT).@"fn";
    return struct {
        const Destination = enum { int, float };
        const Int = abi.int.type;
        const Float = abi.float.type;
        const stack_counts = .{ 0, 8, 16, 32, 64, 128, 256 };
        const max_stack_count = stack_counts[stack_counts.len - 1];
        const int_byte_count = (abi.int.available_registers + max_stack_count) * @sizeOf(Int);
        const float_byte_count = abi.float.available_registers * @sizeOf(Float);
        const stack_initial_offset = abi.int.available_registers * @sizeOf(Int);
        const i_types = .{ i64, i32, i16, i8, i128 };
        const u_types = .{ u64, u32, u16, u8, u128 };
        const f_types = .{ f64, f32, f16, f128, f80 };
        const fixed = calc: {
            var int_offset: usize = 0;
            var float_offset: usize = 0;
            for (f.params) |param| {
                const T = param.type.?;
                alloc: {
                    if (@typeInfo(T) == .float and abi.float.available_registers > 0) {
                        const DT = if (in(T, abi.float.acceptable_types)) T else abi.float.type;
                        const start = std.mem.alignForward(usize, float_offset, @sizeOf(DT));
                        const end = start + @sizeOf(DT) * getWordCount(DT, T);
                        if (end <= float_byte_count) {
                            float_offset = end;
                            break :alloc;
                        }
                    }
                    const DT = if (in(T, abi.int.acceptable_types)) T else abi.int.type;
                    const start = std.mem.alignForward(usize, int_offset, @sizeOf(DT));
                    const end = start + @sizeOf(DT) * getWordCount(DT, T);
                    int_offset = end;
                }
            }
            int_offset = std.mem.alignForward(usize, int_offset, @sizeOf(Int));
            float_offset = std.mem.alignForward(usize, float_offset, @sizeOf(Float));
            break :calc .{
                .int = int_offset / @sizeOf(Int),
                .float = float_offset / @sizeOf(Float),
            };
        };

        float_offset: usize = 0,
        int_offset: usize = 0,
        stack_offset: usize = stack_initial_offset,
        float_bytes: [float_byte_count]u8 align(@alignOf(f128)) = undefined,
        int_bytes: [int_byte_count]u8 align(@alignOf(i128)) = undefined,

        fn init(arg_bytes: [*]const u8, arg_attrs: []const ArgAttributes) !@This() {
            var self: @This() = .{};
            for (&self.int_bytes) |*p| p.* = 0;
            for (&self.float_bytes) |*p| p.* = 0;
            const sections = .{
                .{
                    .kind = .fixed,
                    .start = 0,
                    .end = f.params.len,
                },
                .{
                    .kind = .variadic,
                    .start = f.params.len,
                    .end = arg_attrs.len,
                },
            };
            inline for (sections) |s| {
                for (s.start..s.end) |index| {
                    const a = arg_attrs[index];
                    const bytes = arg_bytes[a.offset .. a.offset + a.bit_size / 8];
                    try self.processBytes(bytes, a, s.kind);
                }
                if (!abi.int.float_in_registers) {
                    // can't put floats in int registers--see if some have gone into the stack
                    if (self.stack_offset != stack_initial_offset and self.stack_offset > self.int_offset) {
                        // there are floats that need to go into the stack and some int registers are
                        // unused--we need to pretend that they're used some the float values get push
                        // onto the stack
                        self.int_offset = self.stack_offset;
                    }
                }
                self.int_offset = std.mem.alignForward(usize, self.int_offset, @sizeOf(Int));
                self.float_offset = std.mem.alignForward(usize, self.float_offset, @sizeOf(Float));
            }
            return self;
        }

        fn getFixedInts(self: *const @This()) *const [fixed.int]Int {
            return @ptrCast(&self.int_bytes[0]);
        }

        fn getVariadicInts(self: *const @This(), comptime count: usize) *const [count]Int {
            return @ptrCast(&self.int_bytes[fixed.int * @sizeOf(Int)]);
        }

        fn getFixedFloats(self: *const @This()) *const [fixed.float]Float {
            return if (float_byte_count > 0) @ptrCast(&self.float_bytes[0]) else &.{};
        }

        fn getVariadicFloats(self: *const @This(), comptime count: usize) *const [count]Float {
            return if (float_byte_count > 0) @ptrCast(&self.float_bytes[fixed.float * @sizeOf(Float)]) else &.{};
        }

        fn getMaxVariadicFloatCount() usize {
            return switch (abi.float.accept_variadic and abi.float.available_registers > fixed.float) {
                true => abi.float.available_registers - fixed.float,
                false => 0,
            };
        }

        fn getMaxVariadicIntCount() usize {
            return switch (abi.int.available_registers > fixed.int) {
                true => abi.int.available_registers - fixed.int,
                false => 0,
            };
        }

        fn getVariadicIntCount(self: *const @This()) usize {
            return self.int_offset / @sizeOf(Int) - fixed.int;
        }

        fn getVariadicFloatCount(self: *const @This()) usize {
            return self.float_offset / @sizeOf(Float) - fixed.float;
        }

        fn processBytes(self: *@This(), bytes: []const u8, a: ArgAttributes, comptime kind: ArgKind) !void {
            return inline for (i_types ++ u_types ++ f_types) |T| {
                const match = if (@bitSizeOf(T) == a.bit_size) switch (@typeInfo(T)) {
                    .float => a.is_float,
                    .int => |int| !a.is_float and (int.signedness == .signed) == a.is_signed,
                    else => unreachable,
                } else false;
                if (match) {
                    const value = std.mem.bytesToValue(T, bytes);
                    break self.processValue(value, kind);
                }
            } else Error.UnsupportedArgumentType;
        }

        fn processValue(self: *@This(), value: anytype, comptime kind: ArgKind) !void {
            const T = @TypeOf(value);
            const has_float_reg = abi.float.available_registers > 0;
            const using_float_reg = (kind == .fixed) or abi.float.accept_variadic;
            if (@typeInfo(T) == .float and has_float_reg and using_float_reg) {
                const DT = comptime if (in(T, abi.float.acceptable_types)) T else abi.float.type;
                const start = std.mem.alignForward(usize, self.float_offset, @sizeOf(DT));
                const end = start + @sizeOf(DT) * getWordCount(DT, T);
                if (end <= self.float_bytes.len) {
                    const src_words = abi.toWords(DT, value);
                    const dest_words: [*]DT = @ptrCast(@alignCast(&self.float_bytes[start]));
                    inline for (src_words, 0..) |src_word, index| {
                        dest_words[index] = src_word;
                    }
                    self.float_offset = end;
                    return;
                }
                // need to place float on stack or int registers
            }
            const DT = comptime if (in(T, abi.int.acceptable_types)) T else abi.int.type;
            if (!abi.int.float_in_registers and self.int_offset < stack_initial_offset) {
                // float need to go into the stack and not all int registers are used
                if (@typeInfo(T) == .float) {
                    const start = std.mem.alignForward(usize, self.stack_offset, @sizeOf(DT));
                    const end = start + @sizeOf(DT) * getWordCount(DT, T);
                    if (end <= self.int_bytes.len) {
                        const src_words = abi.toWords(DT, value);
                        const dest_words: [*]DT = @ptrCast(@alignCast(&self.int_bytes[start]));
                        inline for (src_words, 0..) |src_word, index| {
                            dest_words[index] = src_word;
                        }
                        return;
                    } else {
                        return Error.TooManyArguments;
                    }
                } else {
                    if (self.stack_offset != stack_initial_offset) {
                        // we've started using the stack already (to store floats)
                        // check if there's enough register space remaining for this int value
                        const start = std.mem.alignForward(usize, self.int_offset, @sizeOf(DT));
                        const end = start + @sizeOf(DT) * getWordCount(DT, T);
                        if (end > stack_initial_offset) {
                            // nope
                            self.int_offset = self.stack_offset;
                        }
                    }
                }
            }
            const start = std.mem.alignForward(usize, self.int_offset, @sizeOf(DT));
            const end = start + @sizeOf(DT) * getWordCount(DT, T);
            if (end <= self.int_bytes.len) {
                const src_words = abi.toWords(DT, value);
                const dest_words: [*]DT = @ptrCast(@alignCast(&self.int_bytes[start]));
                inline for (src_words, 0..) |src_word, index| {
                    dest_words[index] = src_word;
                }
                self.int_offset = end;
                return;
            } else {
                return Error.TooManyArguments;
            }
        }
    };
}

test "ArgAllocation(x86) (i8...i8)" {
    const abi = Abi.init(.x86, .linux);
    const ns = struct {
        fn f(_: i8) void {}
    };
    const Args = extern struct {
        retval: i32 = undefined,
        arg0: i8 = -88,
        arg1: i8 = 123,
    };
    const args: Args = .{};
    const bytes = std.mem.toBytes(args);
    const attrs = ArgAttributes.init(Args);
    const alloc = try ArgAllocation(abi, @TypeOf(ns.f)).init(&bytes, &attrs);
    const fixed_ints = alloc.getFixedInts();
    try expect(fixed_ints.len == 1);
    try expect(fixed_ints[0] == 256 - 88); // unsigned here, as callee extends sign
    const variadic_ints = alloc.getVariadicInts(1);
    try expect(variadic_ints[0] == 123);
}

test "ArgAllocation(x86) (i8...i8, i8, i8)" {
    const abi = Abi.init(.x86, .linux);
    const ns = struct {
        fn f(_: i8) void {}
    };
    const Args = extern struct {
        retval: i32 = undefined,
        arg0: i8 = -88,
        arg1: i8 = 123,
        arg2: i8 = 124,
        arg3: i8 = 125,
    };
    const args: Args = .{};
    const bytes = std.mem.toBytes(args);
    const attrs = ArgAttributes.init(Args);
    const alloc = try ArgAllocation(abi, @TypeOf(ns.f)).init(&bytes, &attrs);
    const fixed_ints = alloc.getFixedInts();
    try expect(fixed_ints.len == 1);
    try expect(fixed_ints[0] == 256 - 88);
    const variadic_int_count = alloc.getVariadicIntCount();
    try expect(variadic_int_count == 3);
    const variadic_ints = alloc.getVariadicInts(3);
    try expect(variadic_ints[0] == 123);
    try expect(variadic_ints[1] == 124);
    try expect(variadic_ints[2] == 125);
}

test "ArgAllocation(x86) (i64...i64)" {
    const abi = Abi.init(.x86, .linux);
    const ns = struct {
        fn f(_: i64) void {}
    };
    const Args = extern struct {
        retval: i32 = undefined,
        arg0: i64 = -88,
        arg1: i64 = 123,
    };
    const args: Args = .{};
    const bytes = std.mem.toBytes(args);
    const attrs = ArgAttributes.init(Args);
    const alloc = try ArgAllocation(abi, @TypeOf(ns.f)).init(&bytes, &attrs);
    const fixed_ints = alloc.getFixedInts();
    try expect(fixed_ints.len == 2);
    try expect(fixed_ints[0] == -88);
    try expect(fixed_ints[1] == -1);
    const variadic_int_count = alloc.getVariadicIntCount();
    try expect(variadic_int_count == 2);
    const variadic_ints = alloc.getVariadicInts(2);
    try expect(variadic_ints[0] == 123);
    try expect(variadic_ints[1] == 0);
}

test "ArgAllocation(riscv64) (i64, i64...i8, i8)" {
    const abi = Abi.init(.riscv64, .linux);
    const ns = struct {
        fn f(_: i64, _: i64) void {}
    };
    const Args = extern struct {
        retval: i32 = undefined,
        arg0: i64 = 1000,
        arg1: i64 = 2000,
        arg2: i8 = -8,
        arg3: i8 = -1,
    };
    const args: Args = .{};
    const bytes = std.mem.toBytes(args);
    const attrs = ArgAttributes.init(Args);
    const alloc = try ArgAllocation(abi, @TypeOf(ns.f)).init(&bytes, &attrs);
    const fixed_ints = alloc.getFixedInts();
    try expect(fixed_ints.len == 2);
    try expect(fixed_ints[0] == 1000);
    try expect(fixed_ints[1] == 2000);
    const variadic_int_count = alloc.getVariadicIntCount();
    try expect(variadic_int_count == 2);
    const variadic_ints = alloc.getVariadicInts(2);
    try expect(variadic_ints[0] == 256 - 8);
    try expect(variadic_ints[1] == 256 - 1);
}

test "ArgAllocation(riscv64) (i64, i64...i16, i16)" {
    const abi = Abi.init(.riscv64, .linux);
    const ns = struct {
        fn f(_: i64, _: i64) void {}
    };
    const Args = extern struct {
        retval: i32 = undefined,
        arg0: i64 = 1000,
        arg1: i64 = 2000,
        arg2: i16 = -8,
        arg3: i16 = -1,
    };
    const args: Args = .{};
    const bytes = std.mem.toBytes(args);
    const attrs = ArgAttributes.init(Args);
    const alloc = try ArgAllocation(abi, @TypeOf(ns.f)).init(&bytes, &attrs);
    const fixed_ints = alloc.getFixedInts();
    try expect(fixed_ints.len == 2);
    try expect(fixed_ints[0] == 1000);
    try expect(fixed_ints[1] == 2000);
    const variadic_int_count = alloc.getVariadicIntCount();
    try expect(variadic_int_count == 2);
    const variadic_ints = alloc.getVariadicInts(2);
    try expect(variadic_ints[0] == 65536 - 8);
    try expect(variadic_ints[1] == 65536 - 1);
}

test "ArgAllocation(powerpc64le) (i8...i8)" {
    const abi = Abi.init(.powerpc64le, .linux);
    const ns = struct {
        fn f(_: i8) void {}
    };
    const Args = extern struct {
        retval: i32 = undefined,
        arg0: i8 = -88,
        arg1: i8 = 123,
    };
    const args: Args = .{};
    const bytes = std.mem.toBytes(args);
    const attrs = ArgAttributes.init(Args);
    const alloc = try ArgAllocation(abi, @TypeOf(ns.f)).init(&bytes, &attrs);
    const fixed_ints = alloc.getFixedInts();
    const variadic_ints = alloc.getVariadicInts(1);
    try expect(fixed_ints.len == 1);
    try expect(fixed_ints[0] == -88);
    try expect(variadic_ints[0] == 123);
}

test "ArgAllocation(arm) (i32, i32...i64, i32, f64)" {
    const abi = Abi.init(.arm, .linux);
    const ns = struct {
        fn f(_: i32, _: i32) void {}
    };
    const Args = extern struct {
        retval: i32 = undefined,
        arg0: i32 = 1000,
        arg1: i32 = 2000,
        arg2: i64 = 3000,
        arg3: i32 = 4000,
        arg4: f64 = -256.5,
    };
    const args: Args = .{};
    const bytes = std.mem.toBytes(args);
    const attrs = ArgAttributes.init(Args);
    const alloc = try ArgAllocation(abi, @TypeOf(ns.f)).init(&bytes, &attrs);
    const fixed_ints = alloc.getFixedInts();
    try expect(fixed_ints.len == 2);
    try expect(fixed_ints[0] == 1000);
    try expect(fixed_ints[1] == 2000);
    const variadic_int_count = alloc.getVariadicIntCount();
    try expect(variadic_int_count == 6);
    const variadic_ints = alloc.getVariadicInts(6);
    try expect(variadic_ints[0] == 3000);
    try expect(variadic_ints[1] == 0);
    try expect(variadic_ints[2] == 4000);
    try expect(variadic_ints[3] == 0);
    const float_bytes1 = std.mem.toBytes(variadic_ints[4]);
    const float_bytes2 = std.mem.toBytes(variadic_ints[5]);
    const float_bytes3 = std.mem.toBytes(args.arg4);
    try expect(std.mem.eql(u8, &float_bytes1, float_bytes3[0..4]));
    try expect(std.mem.eql(u8, &float_bytes2, float_bytes3[4..8]));
}

test "ArgAllocation(arm) (i32, i32...i32, f64)" {
    const abi = Abi.init(.arm, .linux);
    const ns = struct {
        fn f(_: i32, _: i32) void {}
    };
    const Args = extern struct {
        retval: i32 = undefined,
        arg0: i32 = 1000,
        arg1: i32 = 2000,
        arg2: i32 = 3000,
        arg3: f64 = 256.5,
    };
    const args: Args = .{};
    const bytes = std.mem.toBytes(args);
    const attrs = ArgAttributes.init(Args);
    const alloc = try ArgAllocation(abi, @TypeOf(ns.f)).init(&bytes, &attrs);
    const fixed_ints = alloc.getFixedInts();
    try expect(fixed_ints.len == 2);
    try expect(fixed_ints[0] == 1000);
    try expect(fixed_ints[1] == 2000);
    const variadic_int_count = alloc.getVariadicIntCount();
    try expect(variadic_int_count == 4);
    const variadic_ints = alloc.getVariadicInts(4);
    try expect(variadic_ints[0] == 3000);
    try expect(variadic_ints[2] == 0);
    try expect(variadic_ints[3] == 0x4070_0800);
}

test "ArgAllocation(x86_64) (f64...f64)" {
    const abi = Abi.init(.x86_64, .linux);
    const ns = struct {
        fn f(_: f64) void {}
    };
    const Args = extern struct {
        retval: i32 = undefined,
        arg0: f64 = 1.234,
        arg1: f64 = 2.345,
    };
    const args: Args = .{};
    const bytes = std.mem.toBytes(args);
    const attrs = ArgAttributes.init(Args);
    const alloc = try ArgAllocation(abi, @TypeOf(ns.f)).init(&bytes, &attrs);
    const fixed_floats = alloc.getFixedFloats();
    try expect(fixed_floats.len == 1);
    const float_bytes1 = std.mem.toBytes(fixed_floats[0]);
    const float_bytes2 = std.mem.toBytes(args.arg0) ++ [8]u8{ 0, 0, 0, 0, 0, 0, 0, 0 };
    try expect(std.mem.eql(u8, &float_bytes1, &float_bytes2));
    const variadic_float_count = alloc.getVariadicFloatCount();
    try expect(variadic_float_count == 1);
    const variadic_floats = alloc.getVariadicFloats(1);
    const float_bytes3 = std.mem.toBytes(variadic_floats[0]);
    const float_bytes4 = std.mem.toBytes(args.arg1) ++ [8]u8{ 0, 0, 0, 0, 0, 0, 0, 0 };
    try expect(std.mem.eql(u8, &float_bytes3, &float_bytes4));
}

test "ArgAllocation(x86_64) (f80...f80)" {
    const abi = Abi.init(.x86_64, .linux);
    const ns = struct {
        fn f(_: f80) void {}
    };
    const Args = extern struct {
        retval: i32 = undefined,
        arg0: f80 = 1.2345,
        arg1: f80 = -2.555,
    };
    const args: Args = .{};
    const bytes = std.mem.toBytes(args);
    const attrs = ArgAttributes.init(Args);
    const alloc = try ArgAllocation(abi, @TypeOf(ns.f)).init(&bytes, &attrs);
    const fixed_floats = alloc.getFixedFloats();
    try expect(fixed_floats.len == 1);
    const float_bytes1 = std.mem.toBytes(fixed_floats[0]);
    const float_bytes2 = std.mem.toBytes(args.arg0);
    try expect(std.mem.eql(u8, &float_bytes1, &float_bytes2));
    const variadic_float_count = alloc.getVariadicFloatCount();
    try expect(variadic_float_count == 1);
    const variadic_floats = alloc.getVariadicFloats(1);
    const float_bytes3 = std.mem.toBytes(variadic_floats[0]);
    const float_bytes4 = std.mem.toBytes(args.arg1);
    try expect(std.mem.eql(u8, &float_bytes3, &float_bytes4));
}

test "ArgAllocation(x86_64) (f64...f64, f64, f64, f64, f64, f64, f64, i64)" {
    const abi = Abi.init(.x86_64, .linux);
    const ns = struct {
        fn f(_: f64) void {}
    };
    const Args = extern struct {
        retval: i32 = undefined,
        arg0: f64 = 1.234,
        arg1: f64 = 2.345,
        arg2: f64 = 3.14,
        arg3: f64 = 3.14,
        arg4: f64 = 3.14,
        arg5: f64 = 3.14,
        arg6: f64 = 3.14,
        arg7: f64 = 3.14,
        arg8: f64 = 3.14,
        arg9: i64 = 1000,
    };
    const args: Args = .{};
    const bytes = std.mem.toBytes(args);
    const attrs = ArgAttributes.init(Args);
    const alloc = try ArgAllocation(abi, @TypeOf(ns.f)).init(&bytes, &attrs);
    const fixed_floats = alloc.getFixedFloats();
    try expect(fixed_floats.len == 1);
    const variadic_float_count = alloc.getVariadicFloatCount();
    try expect(variadic_float_count == 7);
    const variadic_int_count = alloc.getVariadicIntCount();
    try expect(variadic_int_count == 7); // 5 registers containing garbage push 2 variables in the stack
    const variadic_ints = alloc.getVariadicInts(7);
    std.debug.print("{any}\n", .{variadic_ints});
    try expect(variadic_ints[0] == 1000); // first integer registers
    const float_bytes1 = std.mem.toBytes(variadic_ints[6]);
    const float_bytes2 = std.mem.toBytes(args.arg8);
    try expect(std.mem.eql(u8, &float_bytes1, &float_bytes2));
}
