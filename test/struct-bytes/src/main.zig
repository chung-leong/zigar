const std = @import("std");

const UnionTag = enum {
    cat,
    dog,
    monkey,
};

const Error = error{UnknownError};

const Structs = struct {
    const SingleInt32 = struct {
        number: i32 = 1234,
    };
    const MisalignedInt64 = packed struct {
        flag1: bool = true,
        flag2: bool = false,
        number: i64 = 1234567890,
    };
    const BasicUnion = union(UnionTag) {
        cat: i32,
        dog: i32,
        monkey: i64,
    };
    const BigInt1 = struct {
        number: u128 = 0x0_1FFF_FFFF_FFFF_FFFF,
    };
    const BigInt2 = struct {
        number: u128 = std.mem.nativeToBig(u128, 0x0_1FFF_FFFF_FFFF_FFFF),
    };
    const BigInt3 = struct {
        number: u72 = 0x0_1FFF_FFFF_FFFF_FFFF,
    };
    const BigInt4 = struct {
        number: u72 = std.mem.nativeToBig(u72, 0x0_1FFF_FFFF_FFFF_FFFF),
    };
    const BigInt5 = struct {
        number: i65 = -0xFFFF_FFFF_FFFF_FFFF,
    };
    const Float16 = struct {
        number1: f16 = 3.141592653589793238462643383279502884197169399375105820974,
        number2: f16 = 0.0,
        number3: f16 = -0.0,
        number4: f16 = std.math.inf(f16),
        number5: f16 = -std.math.inf(f16),
        number6: f16 = std.math.nan(f16),
    };
    const Float80 = struct {
        number1: f80 = 3.141592653589793238462643383279502884197169399375105820974,
        number2: f80 = 0.0,
        number3: f80 = -0.0,
        number4: f80 = std.math.inf(f80),
        number5: f80 = -std.math.inf(f80),
        number6: f80 = std.math.nan(f80),
    };
    const Float128 = struct {
        number1: f128 = 3.141592653589793238462643383279502884197169399375105820974,
        number2: f128 = 0.0,
        number3: f128 = -0.0,
        number4: f128 = std.math.inf(f128),
        number5: f128 = -std.math.inf(f128),
        number6: f128 = std.math.nan(f128),
    };
    const OverflowFloat80 = struct {
        max: f80 = std.math.floatMax(f64),
        maxx2: f80 = @floatCast(f80, std.math.floatMax(f64)) * 2,
        minusMaxx2: f80 = -@floatCast(f80, std.math.floatMax(f64)) * 2,
    };
    const OverflowFloat128 = struct {
        max: f128 = std.math.floatMax(f64),
        maxx2: f128 = @floatCast(f128, std.math.floatMax(f64)) * 2,
        minusMaxx2: f128 = -@floatCast(f128, std.math.floatMax(f64)) * 2,
    };
    const OptionalIntSet = struct {
        number: ?i64 = 0x00000FFFF,
    };
    const OptionalIntEmpty = struct {
        number: ?i64 = null,
    };
    const IntNoError = struct {
        number: anyerror!i8 = 0x1F,
    };
    const IntWithError = struct {
        number: anyerror!i8 = Error.UnknownError,
    };
    const OptionalIntSetNoError = struct {
        number: anyerror!?i64 = 0x00000FFFF,
    };
    const OptionalIntWithError = struct {
        number: anyerror!?i64 = Error.UnknownError,
    };
};

pub fn main() !void {
    std.debug.print("{d}\n", .{std.math.floatMax(f16)});
    var args = std.process.args();
    _ = args.next() orelse return;
    const arg1 = args.next() orelse {
        std.debug.print("Available structs:\n\n", .{});
        inline for (@typeInfo(Structs).Struct.decls) |decl| {
            std.debug.print("{s}\n", .{decl.name});
        }
        std.debug.print("\n", .{});
        return;
    };
    const stdout_file = std.io.getStdOut().writer();
    var bw = std.io.bufferedWriter(stdout_file);
    const stdout = bw.writer();
    var found = false;
    inline for (@typeInfo(Structs).Struct.decls) |decl| {
        if (std.mem.eql(u8, arg1, decl.name)) {
            const T = @field(Structs, decl.name);
            try stdout.print("{s} ({d} bytes): \n\n", .{ @typeName(T), @sizeOf(T) });
            var s: T = switch (T) {
                Structs.BasicUnion => .{ .dog = 17 },
                else => .{},
            };
            const ptr = @ptrCast([*]u8, &s);
            const len = @sizeOf(T);
            var i: usize = 0;
            try stdout.print("[ ", .{});
            while (i < len) : (i += 1) {
                try stdout.print("{d}, ", .{ptr[i]});
            }
            try stdout.print("]", .{});
            try stdout.print("\n\n", .{});
            found = true;
            break;
        }
    }
    if (!found) {
        std.debug.print("Unknown type: {s}\n", .{arg1});
    }
    try bw.flush();
}
