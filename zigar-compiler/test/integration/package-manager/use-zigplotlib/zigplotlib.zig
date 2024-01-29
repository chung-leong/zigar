const std = @import("std");
const plotlib = @import("plotlib");

const Figure = plotlib.Figure;
const Line = plotlib.Line;
const Area = plotlib.Area;
const Scatter = plotlib.Scatter;

/// The function for the 1st plot (area - blue)
fn f(x: f32) f32 {
    if (x > 10.0) {
        return 20 - (2 * (x - 10.0));
    }
    return 2 * x;
}

/// The function for the 2nd plot (scatter - red)
fn f2(x: f32) f32 {
    if (x > 10.0) {
        return 10.0;
    }
    return x;
}

/// The function for the 3rd plot (line - green)
fn f3(x: f32) f32 {
    if (x < 8.0) {
        return 0.0;
    }
    return 0.5 * (x - 8.0);
}

pub fn run() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();

    var points: [25]f32 = undefined;
    var points2: [25]f32 = undefined;
    var points3: [25]f32 = undefined;
    for (0..25) |i| {
        points[i] = f(@floatFromInt(i));
        points2[i] = f2(@floatFromInt(i));
        points3[i] = f3(@floatFromInt(i));
    }

    var figure = Figure.init(allocator, .{});
    defer figure.deinit();

    try figure.addPlot(Area{ .y = &points, .style = .{
        .color = 0x0000FF,
    } });
    try figure.addPlot(Scatter{ .y = &points2, .style = .{
        .shape = .plus,
        .color = 0xFF0000,
    } });
    try figure.addPlot(Line{ .y = &points3, .style = .{
        .color = 0x00FF00,
    } });
    try figure.addPlot(Area{ .x = &[_]f32{ -5.0, 0.0, 5.0 }, .y = &[_]f32{ 5.0, 3.0, 5.0 }, .style = .{
        .color = 0xFF00FF,
    } });
    try figure.addPlot(Area{ .x = &[_]f32{ -5.0, 0.0, 5.0 }, .y = &[_]f32{ -5.0, -3.0, -5.0 }, .style = .{
        .color = 0xFFFF00,
    } });

    var svg = try figure.show();
    defer svg.deinit();

    // Write to an output file (out.svg)
    var file = try std.fs.cwd().createFile("out.svg", .{});
    defer file.close();

    try svg.writeTo(file.writer());
}
