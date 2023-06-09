const std = @import("std");

const UnionTag = enum {
    cat,
    dog,
    monkey,
};

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
};

pub fn main() !void {
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
            try stdout.print("{s} ({d}): \n\n", .{ @typeName(T), @sizeOf(T) });
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
