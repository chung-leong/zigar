const std = @import("std");

const Structs = struct {
    pub const Vector4 = @Vector(4, f32);

    pub const StructWithI16 = struct {
        number1: i16,
        number2: i16,
    };

    pub const StructWithI32 = struct {
        number1: i32,
        number2: i32,
    };

    pub const StructWithI64 = struct {
        number1: i64,
        number2: i64,
    };

    pub const StructWithI256 = struct {
        number1: i256,
        number2: i256,
    };

    pub const StructWithf16 = struct {
        number1: f16,
        number2: f16,
    };

    pub const StructWithf32 = struct {
        number1: f32,
        number2: f32,
    };

    pub const StructWithf128 = struct {
        number1: f128,
        number2: f128,
    };

    pub const StructWithVector4 = struct {
        vector1: Vector4,
        vector2: Vector4,
    };

    pub const BareUnionWithSlice = struct {
        string: []const u8,
        integer: u32,
        float: f64,
    };
};

pub fn main() !void {
    const stdout_file = std.io.getStdOut().writer();
    var bw = std.io.bufferedWriter(stdout_file);
    const stdout = bw.writer();
    const decls = @typeInfo(Structs).Struct.decls;
    inline for (decls) |decl| {
        const T = @field(Structs, decl.name);
        try stdout.print("{s}: align = {d}, size = {d}\n", .{ decl.name, @alignOf(T), @sizeOf(T) });
    }
    try bw.flush();
}
