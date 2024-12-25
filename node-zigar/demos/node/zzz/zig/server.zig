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

pub const JSResponse = struct {
    mime: []u8,
    data: []u8,

    fn deinit(self: *const @This(), allocator: std.mem.Allocator) void {
        allocator.free(self.mime);
        allocator.free(self.data);
    }
};
pub const JSError = error{Unexpected};
pub const JSResponder = fn (std.mem.Allocator) JSError!JSResponse;

var js_func: ?*const JSResponder = null;

fn root_handler(ctx: *Context, _: void) !void {
    if (js_func) |f| {
        if (f(ctx.allocator)) |r| {
            defer r.deinit(ctx.allocator);
            return try ctx.respond(.{
                .status = .OK,
                .mime = http.Mime.from_content_type(r.mime),
                .body = r.data,
            });
        } else |_| {
            std.debug.print("JavaScript handler failed\n", .{});
        }
    }
    try ctx.respond(.{ .status = .@"Service Unavailable" });
}

fn runServer(host: []const u8, port: u16) !void {
    const allocator = zigar.mem.getDefaultAllocator();
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
        .allocator = zigar.mem.getDefaultAllocator(),
    }, runServer, .{ host, port });
}

pub fn setResponder(f: *const JSResponder) void {
    js_func = f;
}