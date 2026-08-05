// Adopted from https://github.com/tiehuis/zig-benchmarks-game/blob/master/src/mandelbrot.zig

const std = @import("std");

var buffer: [256]u8 = undefined;
var fixed_allocator = std.heap.FixedBufferAllocator.init(buffer[0..]);
var allocator = fixed_allocator.allocator();

pub fn mandelbrot(w: usize) !void {
    var stdout_buffer: [1024]u8 = undefined;
    var stdout_writer = std.fs.File.stdout().writer(&stdout_buffer);
    const stdout = &stdout_writer.interface;
    defer stdout.flush() catch {};
    const h = w;

    const iterations = 50;
    const limit = 2.0;

    try stdout.print("P4\n{} {}\n", .{ w, h });

    var ba: u8 = 0;
    var bn: u8 = 0;
    var y: usize = 0;
    while (y < h) : (y += 1) {
        var x: usize = 0;
        while (x < w) : (x += 1) {
            const cr = 2.0 * @as(f64, @floatFromInt(x)) / @as(f64, @floatFromInt(w)) - 1.5;
            const ci = 2.0 * @as(f64, @floatFromInt(y)) / @as(f64, @floatFromInt(h)) - 1.0;

            var zr: f64 = 0.0;
            var zi: f64 = 0.0;
            var tr: f64 = 0.0;
            var ti: f64 = 0.0;

            var i: usize = 0;
            while (i < iterations and (tr + ti <= limit * limit)) : (i += 1) {
                zi = 2.0 * zr * zi + ci;
                zr = tr - ti + cr;
                tr = zr * zr;
                ti = zi * zi;
            }

            ba <<= 1;
            if (tr + ti <= limit * limit) {
                ba |= 1;
            }

            bn += 1;
            if (bn == 8) {
                try stdout.print("{c}", .{ba});
                ba = 0;
                bn = 0;
            } else if (x == w - 1) {
                ba = std.math.shr(u8, ba, 8 - w % 8);
                try stdout.print("{c}", .{ba});
                ba = 0;
                bn = 0;
            }
        }
    }
}
