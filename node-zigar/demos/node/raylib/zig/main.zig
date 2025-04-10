const std = @import("std");
const zigar = @import("zigar");
const r = @cImport(@cInclude("raylib.h"));

pub fn launch(promise: zigar.function.Promise(void)) !void {
    try zigar.thread.use();
    errdefer zigar.thread.end();
    const thread = try std.Thread.spawn(.{}, run_main, .{promise});
    thread.detach();
}

fn run_main(promise: zigar.function.Promise(void)) void {
    main();
    promise.resolve({});
    zigar.thread.end();
}

pub fn main() void {
    r.InitWindow(800, 450, "raylib [core] example - basic window");
    defer r.CloseWindow();

    while (!r.WindowShouldClose()) {
        r.BeginDrawing();
        r.ClearBackground(r.RAYWHITE);
        r.DrawText("Congrats! You created your first window!", 190, 200, 20, r.LIGHTGRAY);
        r.EndDrawing();
    }
}
