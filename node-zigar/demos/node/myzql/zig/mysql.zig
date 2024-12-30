const std = @import("std");
const zigar = @import("zigar");
const myzql = @import("myzql");

const DatabaseParams = struct {
    host: []const u8,
    port: u16 = 3306,
    username: []const u8,
    password: []const u8,
    database: []const u8,
    threads: usize = 1,
};

var job_queue: JobQueue(.{
    .open = openDatabaseInThread,
    .close = closeDatabaseInThread,
}) = .{};
var initialized = false;
var client: ?myzql.conn.Conn = null;
var thread_pool: std.Thread.Pool = undefined;

pub fn openDatabase(
    promise: zigar.function.PromiseOf(openDatabaseInThread),
    params: DatabaseParams,
) !void {
    if (!job_queue.initialized) {
        const allocator = zigar.mem.getDefaultAllocator();
        try thread_pool.init(.{ .n_jobs = params.threads, .allocator = allocator });
        try job_queue.init(allocator);
        try job_queue.push(.open, promise, .{ params });
    }
}

fn openDatabaseInThread(params: DatabaseParams) !void {
    const address = try std.net.Address.parseIp(params.host, params.port);
    var client = try Conn.init(
        allocator,
        &.{
            .username = params.username,
            .password = params.password,
            .database = params.database,
            .address = address,
        },
    );
    try client.ping();
}