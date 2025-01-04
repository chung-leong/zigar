const std = @import("std");
const zigar = @import("zigar");
const myzql = @import("myzql");
const Conn = myzql.conn.Conn;

const DatabaseParams = struct {
    host: []const u8,
    port: u16 = 3306,
    username: [:0]const u8,
    password: [:0]const u8,
    database: [:0]const u8,
    threads: usize = 1,
};

var work_queue: zigar.thread.WorkQueue(thread_ns) = .{};

pub fn openDatabase(params: DatabaseParams) !void {
    try work_queue.init(.{
        .allocator = zigar.mem.getDefaultAllocator(),
        .n_jobs = params.threads,
        .thread_enter_params = .{params},
    });
    try work_queue.wait();
}

pub fn closeDatabase() void {
    work_queue.deinit();
}

const thread_ns = struct {
    threadlocal var client: Conn = undefined;

    pub fn onThreadEnter(params: DatabaseParams) !void {
        const address = try std.net.Address.parseIp(params.host, params.port);
        client = try Conn.init(
            zigar.mem.getDefaultAllocator(),
            &.{
                .username = params.username,
                .password = params.password,
                .database = params.database,
                .address = address,
            },
        );
        errdefer client.deinit();
        try client.ping();
    }

    pub fn onThreadExit() void {
        client.deinit();
    }
};
