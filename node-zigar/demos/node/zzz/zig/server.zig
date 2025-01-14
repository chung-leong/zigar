const std = @import("std");
const builtin = @import("builtin");
const zigar = @import("zigar");

const zzz = @import("zzz");
const http = zzz.HTTP;

const tardy = zzz.tardy;
const Tardy = tardy.Tardy(switch (builtin.target.os.tag) {
    .linux => .io_uring,
    .windows => .busy_loop,
    else => .kqueue,
});
const Runtime = tardy.Runtime;

const Server = http.Server;
const Router = http.Router;
const Context = http.Context;
const Route = http.Route;

const Responder = *const fn (std.mem.Allocator, []const u8) error{Unexpected}![]u8;

var responders: [4]?Responder = .{ null, null, null, null };

fn page_handler(ctx: *Context, id: usize) !void {
    if (responders[id]) |f| {
        if (f(ctx.allocator, ctx.request.uri orelse "")) |data| {
            return try ctx.respond(.{
                .status = .OK,
                .mime = http.Mime.HTML,
                .body = data,
            });
        } else |_| {
            std.debug.print("Responder failed\n", .{});
        }
    }
    try ctx.respond(.{ .status = .@"Service Unavailable" });
}

fn runServer(host: []const u8, port: u16) !void {
    const allocator = zigar.mem.getDefaultAllocator();
    defer allocator.free(host);
    var t = try Tardy.init(.{
        .allocator = allocator,
        .threading = .auto,
    });
    defer t.deinit();
    var router = try Router.init(allocator, &.{
        Route.init("/").get(@as(usize, 0), page_handler).layer(),
        Route.init("/cat").get(@as(usize, 1), page_handler).layer(),
    }, .{});
    defer router.deinit(allocator);
    const ServerConfig = struct {
        host: []const u8,
        port: u16,
        router: *Router,
    };
    const config: ServerConfig = .{
        .host = host,
        .port = port,
        .router = &router,
    };
    const task = struct {
        fn entry(rt: *Runtime, cfg: *const ServerConfig) !void {
            var server = Server.init(rt.allocator, .{});
            try server.bind(.{ .ip = .{ .host = cfg.host, .port = cfg.port } });
            try server.serve(cfg.router, rt);
        }

        fn exit(rt: *Runtime, _: void) !void {
            try Server.clean(rt);
        }
    };
    try t.entry(&config, task.entry, void{}, task.exit);
}

pub fn startServer(host: []const u8, port: u16) !void {
    const allocator = zigar.mem.getDefaultAllocator();
    const host_copy = try allocator.dupe(u8, host);
    try zigar.thread.use();
    _ = try std.Thread.spawn(.{ .allocator = allocator }, runServer, .{ host_copy, port });
}

pub fn setResponder(id: usize, f: ?Responder) void {
    if (id < responders.len) {
        if (responders[id]) |previous| {
            zigar.function.release(previous);
        }
        responders[id] = f;
    }
}
