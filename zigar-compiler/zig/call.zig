const std = @import("std");
const builtin = @import("builtin");
const types = @import("./types.zig");
const expect = std.testing.expect;

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
        const abi = Abi.init(builtin.target.cpu.arch, builtin.target.os.tag);
        const Alloc = ArgAllocation(abi, function);
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
    const ArgStruct = types.ArgumentStruct(fn (@TypeOf(tuple[0]), ...) callconv(.C) RT);
    comptime var current_offset: u16 = @sizeOf(ArgStruct);
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

test "parameter passing (i8...)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest;
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest;
    try createTest(i32, .{
        @as(i8, -1),
    }).run();
}

test "parameter passing (i8...i8)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest;
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest;
    try createTest(i32, .{
        @as(i8, -1),
        @as(i8, -2),
    }).run();
}

test "parameter passing (i8...i8, i8, i8)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest;
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest;
    try createTest(i32, .{
        @as(i8, -1),
        @as(i8, -2),
        @as(i8, -3),
        @as(i8, -4),
    }).run();
}

test "parameter passing (u8...)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest;
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest;
    try createTest(i32, .{
        @as(u8, 122),
    }).run();
}

test "parameter passing (u8...u8)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest;
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest;
    try createTest(i32, .{
        @as(u8, 222),
        @as(u8, 111),
    }).run();
}

test "parameter passing (u8...u8, u8, u8)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest;
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest;
    try createTest(i32, .{
        @as(u8, 222),
        @as(u8, 111),
        @as(u8, 33),
        @as(u8, 44),
    }).run();
}

test "parameter passing (i16...)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest;
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest;
    try createTest(i32, .{
        @as(i16, -1),
    }).run();
}

test "parameter passing (i16...i16)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest;
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest;
    try createTest(i32, .{
        @as(i16, -1),
        @as(i16, -2),
    }).run();
}

test "parameter passing (i16...i16, i16, i16)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest;
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest;
    try createTest(i32, .{
        @as(i16, -1),
        @as(i16, -2),
        @as(i16, -3),
        @as(i16, -4),
    }).run();
}

test "parameter passing (u16...)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest;
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest;
    try createTest(i32, .{
        @as(u16, 122),
    }).run();
}

test "parameter passing (u16...u16)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest;
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest;
    try createTest(i32, .{
        @as(u16, 222),
        @as(u16, 111),
    }).run();
}

test "parameter passing (u16...u16, u16, u16)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest;
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest;
    try createTest(i32, .{
        @as(u16, 222),
        @as(u16, 111),
        @as(u16, 333),
        @as(u16, 444),
    }).run();
}

test "parameter passing (i32...)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest;
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest;
    try createTest(u32, .{
        @as(i32, -12345),
    }).run();
}

test "parameter passing (i32...i32)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest;
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest;
    try createTest(u32, .{
        @as(i32, -12345),
        @as(i32, 33333),
    }).run();
}

test "parameter passing (i32...i32, i32, i32)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest;
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest;
    try createTest(u32, .{
        @as(i32, -12345),
        @as(i32, 33333),
        @as(i32, 44444),
        @as(i32, 55555),
    }).run();
}

test "parameter passing (u32...)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest;
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest;
    try createTest(u32, .{
        @as(u32, 1234),
    }).run();
}

test "parameter passing (u32...u32)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest;
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest;
    try createTest(u32, .{
        @as(u32, 0xFFFF_FFFF),
        @as(u32, 0xAAAA_BBBB),
    }).run();
}

test "parameter passing (u32...u32, u32, u32)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest;
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest;
    try createTest(u32, .{
        @as(u32, 0xFFFF_FFFF),
        @as(u32, 0xAAAA_BBBB),
        @as(u32, 0xCCCC_DDDD),
        @as(u32, 0xFFFF_AAAA),
    }).run();
}

test "parameter passing (i64...)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest;
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest;
    try createTest(u32, .{
        @as(i64, -12345),
    }).run();
}

test "parameter passing (i64...i64)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest;
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest;
    try createTest(u32, .{
        @as(i64, 12345),
        @as(i64, 33333),
    }).run();
}

test "parameter passing (i64...i64, i64, i64)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest;
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest;
    try createTest(u32, .{
        @as(i64, -12345),
        @as(i64, -33333),
        @as(i64, -44444),
        @as(i64, -55555),
    }).run();
}

test "parameter passing (u64...)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest;
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest;
    try createTest(u32, .{
        @as(u64, 1234),
    }).run();
}

test "parameter passing (u64...u64)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest;
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest;
    try createTest(u32, .{
        @as(u64, 0xFFFF_FFFF_FFFF_FFFF),
        @as(u64, 0xAAAA_BBBB_CCCC_DDDD),
    }).run();
}

test "parameter passing (u64...u64, u64, u64)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest;
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest;
    try createTest(u32, .{
        @as(u64, 0xFFFF_FFFF_FFFF_FFFF),
        @as(u64, 0xAAAA_BBBB_CCCC_DDDD),
        @as(u64, 0xAAAA_FFFF_CCCC_DDDD),
        @as(u64, 0xAAAA_AAAA_CCCC_CCCC),
    }).run();
}

test "parameter passing (i128...)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest;
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest;
    try createTest(u32, .{
        @as(i128, -12345),
    }).run();
}

test "parameter passing (i128...i128)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest;
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest;
    try createTest(u32, .{
        @as(i128, 12345),
        @as(i128, 33333),
    }).run();
}

test "parameter passing (i128...i128, i128, i128)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest;
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest;
    try createTest(u32, .{
        @as(i128, 12345),
        @as(i128, 33333),
        @as(i128, -33333),
        @as(i128, -54321),
    }).run();
}

test "parameter passing (u128...)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest;
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest;
    try createTest(u32, .{
        @as(u128, 1234),
    }).run();
}

test "parameter passing (u128...u128)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest;
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest;
    try createTest(u32, .{
        @as(u128, 0xFFFF_FFFF_FFFF_FFFF_FFFF_FFFF),
        @as(u128, 0xAAAA_BBBB_CCCC_DDDD_EEEE_FFFF),
    }).run();
}

test "parameter passing (u128...u128, u128, u128)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest;
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest;
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
    try createTest(i32, .{
        @as(f16, -1.25),
    }).run();
}

test "parameter passing (f16...f16)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest;
    if (comptime is(.arm, .linux)) return error.SkipZigTest;
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest;
    try createTest(i32, .{
        @as(f16, 1.25),
        @as(f16, -2.5),
    }).run();
}

test "parameter passing (f16...f16, f16, f16)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest;
    if (comptime is(.arm, .linux)) return error.SkipZigTest;
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest;
    try createTest(i32, .{
        @as(f16, -1.25),
        @as(f16, -2.25),
        @as(f16, -3.25),
        @as(f16, -4.25),
    }).run();
}

test "parameter passing (f32...)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest;
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest;
    try createTest(i32, .{
        @as(f32, -1.2345),
    }).run();
}

test "parameter passing (f32...f32)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest;
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest;
    try createTest(i32, .{
        @as(f32, 1.2345),
        @as(f32, -2.555),
    }).run();
}

test "parameter passing (f32...f32, f32, f32)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest;
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest;
    try createTest(i32, .{
        @as(f32, -1.23333),
        @as(f32, -2.24444),
        @as(f32, -3.255555),
        @as(f32, -4.25123),
    }).run();
}

test "parameter passing (f64...)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest;
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest;
    try createTest(i32, .{
        @as(f64, -1.2345),
    }).run();
}

test "parameter passing (f64...f64)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest;
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest;
    try createTest(i32, .{
        @as(f64, 1.2345),
        @as(f64, -2.555),
    }).run();
}

test "parameter passing (f64...f64, f64, f64)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest;
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest;
    try createTest(i32, .{
        @as(f64, -1.23333),
        @as(f64, -2.24444),
        @as(f64, -3.255555),
        @as(f64, -4.25123),
    }).run();
}

test "parameter passing (f80...)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest;
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest;
    try createTest(i32, .{
        @as(f80, -1.2345),
    }).run();
}

test "parameter passing (f80...f80)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest;
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest;
    try createTest(i32, .{
        @as(f80, 1.2345),
        @as(f80, -2.555),
    }).run();
}

test "parameter passing (f80...f80, f80, f80)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest;
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest;
    try createTest(i32, .{
        @as(f80, -1.23333),
        @as(f80, -2.24444),
        @as(f80, -3.255555),
        @as(f80, -4.25123),
    }).run();
}

test "parameter passing (f128...)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest;
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest;
    try createTest(i32, .{
        @as(f128, -1.2345),
    }).run();
}

test "parameter passing (f128...f128)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest;
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest;
    try createTest(i32, .{
        @as(f128, 1.2345),
        @as(f128, -2.555),
    }).run();
}

test "parameter passing (f128...f128, f128, f128)" {
    if (comptime is(.aarch64, .linux)) return error.SkipZigTest;
    if (comptime is(.x86_64, .windows)) return error.SkipZigTest;
    try createTest(i32, .{
        @as(f128, -1.23333),
        @as(f128, -2.24444),
        @as(f128, -3.255555),
        @as(f128, -4.25123),
    }).run();
}

fn createSprintfTest(fmt: []const u8, tuple: anytype) type {
    const c = @cImport({
        @cInclude("stdio.h");
    });
    const FT = @TypeOf(c.sprintf);
    const f = @typeInfo(FT).Fn;
    const ArgStruct = types.ArgumentStruct(FT);
    comptime var current_offset: u16 = @sizeOf(ArgStruct);
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
    try createSprintfTest("%ld %d %f", .{
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

fn getRequiredCount(comptime T: type, comptime VT: type) usize {
    return switch (@sizeOf(VT) <= @sizeOf(T)) {
        true => 1,
        false => std.mem.alignForward(usize, @sizeOf(VT), @sizeOf(T)) / @sizeOf(T),
    };
}

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
                            .count = 8, // XMM0 - XMM7
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
                            .variadic = &.{ i64, i128, f128, f80, f64 },
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

    fn toInts(comptime self: @This(), comptime T: type, value: anytype) [getRequiredCount(T, @TypeOf(value))]T {
        const count = comptime getRequiredCount(T, @TypeOf(value));
        return switch (count) {
            1 => [1]T{self.extend(T, value)},
            else => split: {
                const size = @sizeOf(T);
                const bytes = std.mem.toBytes(value);
                var ints: [count]T = undefined;
                inline for (&ints, 0..) |*p, index| {
                    p.* = std.mem.bytesToValue(T, bytes[index * size .. index * size + size]);
                }
                break :split ints;
            },
        };
    }

    fn toFloats(comptime self: @This(), comptime T: type, value: anytype) [getRequiredCount(T, @TypeOf(value))]T {
        const count = comptime getRequiredCount(T, @TypeOf(value));
        return switch (count) {
            1 => [1]T{self.extend(T, value)},
            else => split: {
                const size = @sizeOf(T);
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
                var ints: [count]T = undefined;
                inline for (&ints, 0..) |*p, index| {
                    p.* = std.mem.bytesToValue(T, bytes[index * size .. index * size + size]);
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
    const a = abi1.toInts(i64, @as(i8, -2));
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
    const b = abi2.toInts(i32, @as(i64, -2));
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
    const a = abi1.toFloats(f64, @as(f64, -2));
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
    const b = abi2.toFloats(f64, @as(f128, -2));
    try expect(b.len == 2);
    const c = abi2.toFloats(f64, @as(f80, -2));
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
    // std.debug.print("\n{any}\n", .{fixed_ints});
    // std.debug.print("{any}\n", .{variadic_ints});
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
    const Int = abi.registers.int.type;
    const Float = abi.registers.float.type;
    const fixed_floats = [_]Float{};
    const fixed_ints = abi.toInts(Int, @as(i64, 1000));
    const variadic_floats = comptime switch (in(Float, abi.registers.float.accept.variadic)) {
        true => abi.toFloats(Float, @as(f64, 3.14)),
        false => [_]f64{},
    };
    const variadic_ints = comptime switch (in(Float, abi.registers.float.accept.variadic)) {
        true => abi.toInts(Int, @as(i64, 7)),
        false => abi.toInts(Int, @as(i64, 7)) ++ abi.toInts(Int, @as(f64, 3.14)),
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
        true => variadic_floats ++ abi.toFloats(Float, @as(f64, 34.32443)) ++ abi.toFloats(Float, @as(f64, 434343.3)),
        false => variadic_floats,
    };
    const variadic_ints_plus_garbage = variadic_ints ++ abi.toInts(Int, @as(i64, 1213)) ++ abi.toInts(Int, @as(i64, 324));
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
    const Int = abi.registers.int.type;
    const Float = abi.registers.float.type;
    const fixed_floats = [_]Float{};
    const fixed_ints = abi.toInts(Int, @as(i64, 1000));
    const variadic_floats = [_]Float{};
    const variadic_ints = abi.toInts(Int, @as(i64, 7)) ++ abi.toInts(Int, @as(i32, -5)) ++ abi.toInts(Int, @as(i32, -2));
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
    const Int = abi.registers.int.type;
    const Float = abi.registers.float.type;
    const fixed_floats = [_]Float{};
    const fixed_ints = abi.toInts(Int, @as(i64, 1000));
    const variadic_floats = [_]Float{};
    const variadic_ints = abi.toInts(Int, @as(i32, 7)) ++ abi.toInts(Int, @as(i32, -5)) ++ abi.toInts(Int, @as(i32, -2));
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
    const fixed_ints = abi.toInts(Int, @as(i64, 1000));
    const variadic_floats = comptime switch (in(Float, abi.registers.float.accept.variadic)) {
        true => abi.toFloats(Float, @as(f32, -5)) ++ abi.toFloats(Float, @as(f32, -2)),
        false => [_]Float{},
    };
    const variadic_ints = comptime switch (in(Float, abi.registers.float.accept.variadic)) {
        true => abi.toInts(Int, @as(i32, 7)),
        false => switch (Int == i64 and in(f32, abi.registers.int.accept.variadic)) {
            true => abi.toInts(Int, @as(i32, 7)) ++ [1]Int{abi.packInt(.{ @as(f32, -5), @as(f32, -2) })},
            else => abi.toInts(Int, @as(i32, 7)) ++ abi.toInts(Int, @as(f32, -5)) ++ abi.toInts(Int, @as(f32, -2)),
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
    const fixed_ints = abi.toInts(Int, @as(i64, 1000));
    const variadic_floats = [_]Float{};
    const variadic_ints = comptime switch (in(i16, abi.registers.int.accept.variadic)) {
        true => [_]Int{abi.packInt(.{ @as(i16, 7), @as(i16, -5) })},
        false => abi.toInts(Int, @as(i16, 7)) ++ abi.toInts(Int, @as(i16, -5)),
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
    const fixed_ints = abi.toInts(Int, @as(i64, 1000));
    const variadic_floats = [_]Float{};
    const variadic_ints = comptime switch (in(i8, abi.registers.int.accept.variadic)) {
        true => [_]Int{abi.packInt(.{ @as(i8, 7), @as(i8, -5) })},
        false => abi.toInts(Int, @as(i8, 7)) ++ abi.toInts(Int, @as(i8, -5)),
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
    const fixed_ints = abi.toInts(Int, @as(i64, 1000));
    const variadic_floats = [_]Float{};
    const alignment_ints = comptime switch (in(i128, abi.registers.int.accept.variadic)) {
        true => [_]Int{0},
        false => [_]Int{},
    };
    const variadic_ints = alignment_ints ++ abi.toInts(Int, @as(i128, -2));
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

    fn init(comptime Arg: type) [@typeInfo(Arg).Struct.fields.len - 1]@This() {
        const fields = @typeInfo(Arg).Struct.fields;
        var attrs: [fields.len - 1]@This() = undefined;
        inline for (fields, 0..) |field, index| {
            if (index == 0) {
                continue;
            }
            attrs[index - 1] = .{
                .offset = @offsetOf(Arg, field.name),
                .size = @sizeOf(field.type),
                .alignment = @alignOf(field.type),
                .is_float = switch (@typeInfo(field.type)) {
                    .Float => true,
                    else => false,
                },
                .is_signed = switch (@typeInfo(field.type)) {
                    .Int => |int| int.signedness == .signed,
                    else => false,
                },
            };
        }
        return attrs;
    }
};

fn ArgAllocation(comptime abi: Abi, comptime function: anytype) type {
    const f = @typeInfo(@TypeOf(function)).Fn;
    return struct {
        const Destination = enum { int, float };
        const Int = abi.registers.int.type;
        const Float = abi.registers.float.type;
        const stack_counts = .{ 0, 8, 16, 32, 64, 128, 256 };
        const max_stack_count = stack_counts[stack_counts.len - 1];
        const int_byte_count = (abi.registers.int.count + max_stack_count) * @sizeOf(Int);
        const float_byte_count = abi.registers.float.count * @sizeOf(Float);
        const i_types = .{ i64, i32, i16, i8, i128 };
        const u_types = .{ u64, u32, u16, u8, u128 };
        const f_types = .{ f64, f32, f16, f128, f80 };
        const fixed = calc: {
            var int_offset: usize = 0;
            var float_offset: usize = 0;
            for (f.params) |param| {
                const T = param.type.?;
                alloc: {
                    if (@typeInfo(T) == .Float and abi.registers.float.count > 0) {
                        const dest_types = abi.registers.float.accept.fixed;
                        for (1..4) |stage| {
                            for (dest_types) |DT| {
                                const use = switch (stage) {
                                    1 => std.mem.isAligned(float_offset, @alignOf(DT)) and @sizeOf(T) == @sizeOf(DT),
                                    2 => @sizeOf(T) == @sizeOf(DT),
                                    else => @sizeOf(T) <= @sizeOf(DT),
                                };
                                if (use) {
                                    const start = switch (stage) {
                                        1 => float_offset,
                                        else => std.mem.alignForward(usize, float_offset, @sizeOf(DT)),
                                    };
                                    float_offset = start + @sizeOf(DT) * getRequiredCount(DT, T);
                                    break :alloc;
                                }
                            }
                        }
                    }
                    const dest_types = abi.registers.int.accept.fixed;
                    for (1..4) |stage| {
                        for (dest_types) |DT| {
                            const use = switch (stage) {
                                1 => std.mem.isAligned(int_offset, @alignOf(DT)) and @sizeOf(T) == @sizeOf(DT),
                                2 => @sizeOf(T) == @sizeOf(DT),
                                else => true,
                            };
                            if (use) {
                                const start = switch (stage) {
                                    1 => int_offset,
                                    else => std.mem.alignForward(usize, int_offset, @sizeOf(DT)),
                                };
                                int_offset = start + @sizeOf(DT) * getRequiredCount(DT, T);
                                break :alloc;
                            }
                        }
                    }
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
        float_bytes: [float_byte_count]u8 align(@alignOf(Float)) = undefined,
        int_bytes: [int_byte_count]u8 align(@alignOf(Int)) = undefined,

        fn init(arg_bytes: [*]const u8, arg_attrs: []const ArgAttributes) !@This() {
            var self: @This() = .{};
            for (&self.int_bytes) |*p| p.* = 0;
            for (&self.float_bytes) |*p| p.* = 0;
            const sections = .{
                .{
                    .kind = "fixed",
                    .start = 0,
                    .end = f.params.len,
                },
                .{
                    .kind = "variadic",
                    .start = f.params.len,
                    .end = arg_attrs.len,
                },
            };
            inline for (sections) |s| {
                for (s.start..s.end) |index| {
                    const a = arg_attrs[index];
                    const bytes = arg_bytes[a.offset .. a.offset + a.size];
                    if (!self.processBytes(bytes, a, s.kind)) {
                        return Error.too_many_arguments;
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
            return switch (abi.registers.float.accept.variadic.len > 0 and abi.registers.float.count > fixed.float) {
                true => abi.registers.float.count - fixed.float,
                false => 0,
            };
        }

        fn getMaxVariadicIntCount() usize {
            return switch (abi.registers.int.accept.variadic.len > 0 and abi.registers.int.count > fixed.int) {
                true => abi.registers.int.count - fixed.int,
                false => 0,
            };
        }

        fn getVariadicIntCount(self: *const @This()) usize {
            return self.int_offset / @sizeOf(Int) - fixed.int;
        }

        fn processBytes(self: *@This(), bytes: []const u8, a: ArgAttributes, comptime kind: []const u8) bool {
            return inline for (i_types ++ u_types ++ f_types) |T| {
                const match = if (@sizeOf(T) == a.size) switch (@typeInfo(T)) {
                    .Float => a.is_float,
                    .Int => |int| (int.signedness == .signed) == a.is_signed,
                    else => unreachable,
                } else false;
                if (match) {
                    const value = std.mem.bytesToValue(T, bytes);
                    break self.processValue(value, kind);
                }
            } else false;
        }

        fn processValue(self: *@This(), value: anytype, comptime kind: []const u8) bool {
            const T = @TypeOf(value);
            if (@typeInfo(T) == .Float and abi.registers.float.count > 0) {
                const dest_types = @field(abi.registers.float.accept, kind);
                for (1..4) |stage| {
                    inline for (dest_types) |DT| {
                        const use = switch (stage) {
                            // at stage 1, require correct alignment at current offset and same size
                            1 => std.mem.isAligned(self.float_offset, @alignOf(DT)) and @sizeOf(T) == @sizeOf(DT),
                            // at stage 2, only require that the size matches
                            2 => @sizeOf(T) == @sizeOf(DT),
                            // finally, require only that it's smaller
                            else => @sizeOf(T) <= @sizeOf(DT),
                        };
                        if (use) {
                            const start = switch (stage) {
                                1 => self.float_offset,
                                else => std.mem.alignForward(usize, self.float_offset, @sizeOf(DT)),
                            };
                            const end = start + @sizeOf(DT) * getRequiredCount(DT, T);
                            if (end <= self.float_bytes.len) {
                                const src_words = abi.toFloats(DT, value);
                                const dest_words: [*]DT = @ptrCast(@alignCast(&self.float_bytes[start]));
                                inline for (src_words, 0..) |src_word, index| {
                                    dest_words[index] = src_word;
                                }
                                self.float_offset = end;
                                return true;
                            }
                        }
                    }
                }
                // need to place float on stack or int registers
            }
            const dest_types = @field(abi.registers.int.accept, kind);
            for (1..4) |stage| {
                inline for (dest_types) |DT| {
                    const use = switch (stage) {
                        1 => std.mem.isAligned(self.int_offset, @alignOf(DT)) and @sizeOf(T) == @sizeOf(DT),
                        2 => @sizeOf(T) == @sizeOf(DT),
                        else => true,
                    };
                    if (use) {
                        const start = switch (stage) {
                            1 => self.int_offset,
                            else => std.mem.alignForward(usize, self.int_offset, @sizeOf(DT)),
                        };
                        const end = start + @sizeOf(DT) * getRequiredCount(DT, T);
                        if (end <= self.int_bytes.len) {
                            const src_words = abi.toInts(DT, value);
                            const dest_words: [*]DT = @ptrCast(@alignCast(&self.int_bytes[start]));
                            inline for (src_words, 0..) |src_word, index| {
                                dest_words[index] = src_word;
                            }
                            self.int_offset = end;
                            return true;
                        }
                    }
                }
            }
            return false;
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
    const alloc = try ArgAllocation(abi, ns.f).init(&bytes, &attrs);
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
    const alloc = try ArgAllocation(abi, ns.f).init(&bytes, &attrs);
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
    const alloc = try ArgAllocation(abi, ns.f).init(&bytes, &attrs);
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
    const alloc = try ArgAllocation(abi, ns.f).init(&bytes, &attrs);
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
    const alloc = try ArgAllocation(abi, ns.f).init(&bytes, &attrs);
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
    const alloc = try ArgAllocation(abi, ns.f).init(&bytes, &attrs);
    const fixed_ints = alloc.getFixedInts();
    const variadic_ints = alloc.getVariadicInts(1);
    try expect(fixed_ints.len == 1);
    try expect(fixed_ints[0] == -88);
    try expect(variadic_ints[0] == 123);
}
