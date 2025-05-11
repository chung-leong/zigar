const std = @import("std");
const zigar = @import("zigar");
const r = @cImport(@cInclude("raylib.h"));

pub fn launch(promise: zigar.function.Promise(void)) !void {
    try zigar.thread.use();
    errdefer zigar.thread.end();
    const thread = try std.Thread.spawn(.{}, runMain, .{promise});
    thread.detach();
}

fn runMain(promise: zigar.function.Promise(void)) void {
    main();
    promise.resolve({});
    zigar.thread.end();
}

const Settings = struct {
    x: c_int = 190,
    y: c_int = 200,
    font_size: c_int = 20,
    text_color: r.Color = r.LIGHTGRAY,
    background_color: r.Color = r.RAYWHITE,
};
const allocator = std.heap.c_allocator;
const default_text: [:0]const u8 = "Congrats! You created your first window!";
var text: [:0]const u8 = default_text;
var settings: Settings = .{};
const KeyReporter = *const fn (c_int) void;
var key_reporter: ?KeyReporter = null;

pub fn getText() []const u8 {
    std.debug.print("getText()\n", .{});
    return text;
}

pub fn getSettings() Settings {
    return settings;
}

pub fn setText(arg: []const u8) !void {
    if (text.ptr != default_text.ptr) allocator.free(text);
    text = try allocator.dupeZ(u8, arg);
}

pub fn setSettings(arg: Settings) void {
    settings = arg;
}

pub fn setKeyReporter(fn_ptr: ?KeyReporter) void {
    key_reporter = fn_ptr;
}

pub fn main() void {
    r.InitWindow(800, 450, "raylib [core] example - basic window");
    defer r.CloseWindow();

    while (!r.WindowShouldClose()) {
        const key_code = r.GetKeyPressed();
        if (key_code != 0) if (key_reporter) |f| f(key_code);

        r.BeginDrawing();
        r.ClearBackground(settings.background_color);
        r.DrawText(text, settings.x, settings.y, settings.font_size, settings.text_color);
        r.EndDrawing();
    }
}
