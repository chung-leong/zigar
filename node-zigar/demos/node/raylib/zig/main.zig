const std = @import("std");

const c = @import("c");
const zigar = @import("zigar");

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
    c.InitWindow(800, 450, "raylib [core] example - basic window");
    defer c.CloseWindow();

    while (!c.WindowShouldClose()) {
        c.BeginDrawing();
        c.ClearBackground(c.RAYWHITE);
        c.DrawText("Congrats! You created your first window!", 190, 200, 20, c.LIGHTGRAY);
        c.EndDrawing();
    }
}
