const std = @import("std");
const zigar = @import("zigar");
const r = @cImport(@cInclude("raylib.h"));

pub fn run(promise: zigar.function.Promise(void)) !void {
    try zigar.thread.use();
    errdefer zigar.thread.end();
    const thread = try std.Thread.spawn(.{}, main, .{promise});
    thread.detach();
}

fn main(promise: zigar.function.Promise(void)) void {
    defer zigar.thread.end();
    defer promise.resolve({});

    r.InitWindow(800, 450, "raylib [core] example - basic window");
    defer r.CloseWindow();

    while (!r.WindowShouldClose()) {
        r.BeginDrawing();
        r.ClearBackground(r.RAYWHITE);
        r.DrawText("Congrats! You created your first window!", 190, 200, 20, r.LIGHTGRAY);
        r.EndDrawing();
    }
}
