const std = @import("std");
const log = std.log.scoped(.@"examples/basic");

const zzz = @import("zzz");
const http = zzz.HTTP;

const tardy = zzz.tardy;
const Tardy = tardy.Tardy(.auto);
const Runtime = tardy.Runtime;
const Socket = tardy.Socket;

const Server = http.Server;
const Router = http.Router;
const Context = http.Context;
const Route = http.Route;
const Respond = http.Respond;

const zigar = @import("zigar");

pub fn startServer(host: []const u8, port: u16, promise: zigar.function.PromiseOf(main)) !void {
    try zigar.thread.use();
    const thread = try std.Thread.spawn(.{}, main, .{ host, port, promise.any() });
    thread.detach();
}

const ContentFn = fn (std.mem.Allocator, []const u8) error{Unexpected}![]u8;
var base_content_fn: ?*const ContentFn = null;

fn base_handler(ctx: *const Context, _: void) !Respond {
    if (base_content_fn) |f| {
        if (f(ctx.allocator, ctx.request.uri orelse "")) |body| {
            return ctx.response.apply(.{
                .status = .OK,
                .mime = http.Mime.HTML,
                .body = body,
            });
        } else |_| {}
    }
    return ctx.response.apply(.{
        .status = .@"Service Unavailable",
        .mime = http.Mime.TEXT,
        .body = "Service Unavailable",
    });
}

pub fn setBaseHandler(f: ?*const ContentFn) void {
    if (base_content_fn) |ex_f| zigar.function.release(ex_f);
    base_content_fn = f;
}

var cat_content_fn: ?*const ContentFn = null;

fn cat_handler(ctx: *const Context, _: void) !Respond {
    if (cat_content_fn) |f| {
        if (f(ctx.allocator, ctx.request.uri orelse "")) |body| {
            return ctx.response.apply(.{
                .status = .OK,
                .mime = http.Mime.HTML,
                .body = body,
            });
        } else |_| {}
    }
    return ctx.response.apply(.{
        .status = .@"Service Unavailable",
        .mime = http.Mime.TEXT,
        .body = "Service Unavailable",
    });
}

pub fn setCatHandler(f: ?*const ContentFn) void {
    if (cat_content_fn) |ex_f| zigar.function.release(ex_f);
    cat_content_fn = f;
}

fn main(host: []const u8, port: u16, promise: zigar.function.Promise(anyerror!void)) !void {
    errdefer |err| promise.resolve(err);

    var gpa = std.heap.GeneralPurposeAllocator(.{ .thread_safe = true }){};
    const allocator = gpa.allocator();
    defer _ = gpa.deinit();

    var t = try Tardy.init(allocator, .{ .threading = .auto });
    defer t.deinit();

    var router = try Router.init(allocator, &.{
        Route.init("/").get({}, base_handler).layer(),
        Route.init("/cat").get({}, cat_handler).layer(),
    }, .{});
    defer router.deinit(allocator);

    // create socket for tardy
    var socket = try Socket.init(.{ .tcp = .{ .host = host, .port = port } });
    defer socket.close_blocking();
    try socket.bind();
    try socket.listen(4096);

    const EntryParams = struct {
        router: *const Router,
        socket: Socket,
        promise: zigar.function.Promise(anyerror!void),
    };

    t.entry(
        EntryParams{ .router = &router, .socket = socket, .promise = promise },
        struct {
            fn entry(rt: *Runtime, p: EntryParams) !void {
                var server = Server.init(.{
                    .stack_size = 1024 * 1024 * 4,
                    .socket_buffer_bytes = 1024 * 2,
                    .keepalive_count_max = null,
                    .connection_count_max = 1024,
                });
                p.promise.resolve(
                    server.serve(rt, p.router, .{ .normal = p.socket }),
                );
            }
        }.entry,
    ) catch {};
}
