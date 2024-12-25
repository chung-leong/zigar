const std = @import("std");
const zigar = @import("zigar");

const zzz = @import("zzz");
const http = zzz.HTTP;

const tardy = zzz.tardy;
const Tardy = tardy.Tardy(.io_uring);
const Runtime = tardy.Runtime;

const Server = http.Server;
const Router = http.Router;
const Context = http.Context;
const Route = http.Route;

const allocator = zigar.mem.getDefaultAllocator();

fn root_handler(ctx: *Context, _: void) !void {
    const body_fmt =
        \\ <!DOCTYPE html>
        \\ <html>
        \\ <body>
        \\ <h1>Hello, World!</h1>
        \\ </body>
        \\ </html>
    ;
    const body = try std.fmt.allocPrint(ctx.allocator, body_fmt, .{});
    return try ctx.respond(.{
        .status = .OK,
        .mime = http.Mime.HTML,
        .body = body,
    });
}

fn runServer(host: []const u8, port: u16) !void {
    var t = try Tardy.init(.{
        .allocator = allocator,
        .threading = .auto,
    });
    defer t.deinit();
    var router = try Router.init(allocator, &.{
        Route.init("/").get({}, root_handler).layer(),
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
    try t.entry(
        &config,
        struct {
            fn entry(rt: *Runtime, cfg: *const ServerConfig) !void {
                var server = Server.init(rt.allocator, .{});
                try server.bind(.{ .ip = .{ .host = cfg.host, .port = cfg.port } });
                try server.serve(cfg.router, rt);
            }
        }.entry,
        {},
        struct {
            fn exit(rt: *Runtime, _: void) !void {
                try Server.clean(rt);
            }
        }.exit,
    );
}

pub fn startServer(host: []const u8, port: u16) !void {
    try zigar.thread.use(true);
    _ = try std.Thread.spawn(.{
        .allocator = allocator,
    }, runServer, .{ host, port });
}

