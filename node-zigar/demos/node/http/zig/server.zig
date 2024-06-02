const std = @import("std");

const ServerThread = struct {
    address: std.net.Address,
    listen_options: std.net.Address.ListenOptions,
    thread: ?std.Thread = null,
    server: ?*std.net.Server = null,
    connection: ?*std.net.Server.Connection = null,
    last_error: ?(std.net.Address.ListenError || std.net.Server.AcceptError) = null,
    storage: *ServerStorage,
    request_count: u64 = 0,

    pub fn init(
        address: std.net.Address,
        listen_options: std.net.Address.ListenOptions,
        storage: *ServerStorage,
    ) @This() {
        return .{
            .address = address,
            .listen_options = listen_options,
            .storage = storage,
        };
    }

    pub fn spawn(self: *@This()) !void {
        var futex_val = std.atomic.Value(u32).init(0);
        self.thread = try std.Thread.spawn(.{}, run, .{ self, &futex_val });
        std.Thread.Futex.wait(&futex_val, 0);
        if (self.last_error) |err| {
            return err;
        }
    }

    fn run(self: *@This(), futex_ptr: *std.atomic.Value(u32)) void {
        var listen_result = self.address.listen(self.listen_options);
        if (listen_result) |*server| {
            self.server = server;
        } else |err| {
            self.last_error = err;
        }
        futex_ptr.store(1, .release);
        std.Thread.Futex.wake(futex_ptr, 1);
        const server = self.server orelse return;
        while (true) {
            var connection = server.accept() catch |err| {
                self.last_error = switch (err) {
                    std.net.Server.AcceptError.SocketNotListening => null,
                    else => err,
                };
                break;
            };
            self.handleConnection(&connection);
        }
        self.server = null;
    }

    pub fn stop(self: *@This()) void {
        if (self.connection) |c| {
            std.posix.shutdown(c.stream.handle, .both) catch {};
        }
        if (self.server) |s| {
            std.posix.shutdown(s.stream.handle, .both) catch {};
        }
    }

    pub fn join(self: *@This()) void {
        if (self.thread) |thread| {
            thread.join();
            self.thread = null;
        }
    }

    pub fn getStats(self: *const @This()) ServerThreadStats {
        return .{ .request_count = self.request_count };
    }

    fn handleConnection(self: *@This(), connection: *std.net.Server.Connection) void {
        var read_buffer: [4096]u8 = undefined;
        var http = std.http.Server.init(connection.*, &read_buffer);
        self.connection = connection;
        while (true) {
            var request = http.receiveHead() catch {
                break;
            };
            self.handleRequest(&request) catch |err| {
                std.debug.print("{any}\n", .{err});
            };
        }
        self.connection = null;
    }

    fn handleRequest(self: *@This(), request: *std.http.Server.Request) !void {
        self.request_count += 1;
        if (self.storage.get(request.head.target)) |text| {
            try request.respond(text, .{});
        } else {
            try request.respond("Not found", .{ .status = .not_found });
        }
    }
};
const ServerThreadStats = struct {
    request_count: u64,
};
const Server = struct {
    threads: []ServerThread,
    allocator: std.mem.Allocator,
    storage: *ServerStorage,

    pub fn init(allocator: std.mem.Allocator, options: ServerOptions) !Server {
        const address = try std.net.Address.resolveIp(options.ip, options.port);
        const threads = try allocator.alloc(ServerThread, options.thread_count);
        errdefer allocator.free(threads);
        const listen_options = .{ .reuse_address = true };
        const storage = try allocator.create(ServerStorage);
        storage.* = ServerStorage.init(allocator);
        for (threads) |*thread| {
            thread.* = ServerThread.init(address, listen_options, storage);
        }
        return .{ .threads = threads, .storage = storage, .allocator = allocator };
    }

    pub fn deinit(self: @This()) void {
        self.allocator.free(self.threads);
        self.storage.deinit();
        self.allocator.destroy(self.storage);
    }

    pub fn start(self: *@This()) !void {
        errdefer self.stop();
        for (self.threads) |*thread| {
            try thread.spawn();
        }
    }

    pub fn stop(self: *@This()) void {
        for (self.threads) |*thread| {
            thread.stop();
        }
        for (self.threads) |*thread| {
            thread.join();
        }
    }

    pub fn getStats(self: *@This(), allocator: std.mem.Allocator) !ServerStats {
        const thread_stats = try allocator.alloc(ServerThreadStats, self.threads.len);
        for (self.threads, 0..) |thread, index| {
            thread_stats[index] = thread.getStats();
        }
        const request_count: u64 = sum: {
            var n: u64 = 0;
            for (thread_stats) |stats| {
                n += stats.request_count;
            }
            break :sum n;
        };
        return .{ .request_count = request_count, .threads = thread_stats };
    }
};
const ServerStats = struct {
    request_count: u64,
    threads: []const ServerThreadStats,
};
const ServerStorage = struct {
    const AtomicU32 = std.atomic.Value(u32);
    const Map = std.hash_map.StringHashMap([]const u8);

    map: Map,
    allocator: std.mem.Allocator,
    reader_count: AtomicU32 = AtomicU32.init(0),
    writer_count: AtomicU32 = AtomicU32.init(0),

    pub fn init(allocator: std.mem.Allocator) @This() {
        const map = Map.init(allocator);
        return .{ .allocator = allocator, .map = map };
    }

    pub fn deinit(self: *@This()) void {
        var it = self.map.iterator();
        while (it.next()) |kv| {
            self.allocator.free(kv.key_ptr.*);
            self.allocator.free(kv.value_ptr.*);
        }
        self.map.deinit();
    }

    pub fn get(self: *@This(), uri: []const u8) ?[]const u8 {
        std.Thread.Futex.wait(&self.writer_count, 1);
        _ = self.reader_count.fetchAdd(1, .acquire);
        defer {
            const count = self.reader_count.fetchSub(1, .release);
            if (count == 0) {
                std.Thread.Futex.wake(&self.reader_count, 1);
            }
        }
        return self.map.get(uri);
    }

    pub fn put(self: *@This(), uri: []const u8, text: []const u8) !void {
        // create copies
        const key = try self.allocator.dupe(u8, uri);
        errdefer self.allocator.free(key);
        const value = try self.allocator.dupe(u8, text);
        errdefer self.allocator.free(value);
        // prevent reading until operation finishes
        _ = self.writer_count.store(1, .release);
        while (true) {
            // make sure server threads are done reading
            const reader_count = self.reader_count.load(.acquire);
            if (reader_count == 0) {
                break;
            }
            std.Thread.Futex.wait(&self.reader_count, reader_count);
        }
        defer {
            _ = self.writer_count.store(0, .release);
            std.Thread.Futex.wake(&self.writer_count, std.math.maxInt(u32));
        }
        try self.map.put(key, value);
    }
};
const ServerOpaque = opaque {};
const ServerOpaquePointer = *align(@alignOf(Server)) ServerOpaque;
const ServerOptions = struct {
    ip: []const u8,
    port: u16 = 80,
    thread_count: usize = 1,
};

var gpa = std.heap.GeneralPurposeAllocator(.{}){};

pub fn startServer(options: ServerOptions) !ServerOpaquePointer {
    const allocator = gpa.allocator();
    const server = try allocator.create(Server);
    errdefer allocator.destroy(server);
    server.* = try Server.init(allocator, options);
    errdefer server.deinit();
    try server.start();
    return @ptrCast(server);
}

pub fn stopServer(opaque_ptr: ServerOpaquePointer) void {
    const allocator = gpa.allocator();
    const server: *Server = @ptrCast(opaque_ptr);
    server.stop();
    server.deinit();
    allocator.destroy(server);
}

pub fn storeText(opaque_ptr: ServerOpaquePointer, uri: []const u8, text: []const u8) !void {
    const server: *Server = @ptrCast(opaque_ptr);
    return server.storage.put(uri, text);
}

pub fn getServerStats(allocator: std.mem.Allocator, opaque_ptr: ServerOpaquePointer) !ServerStats {
    const server: *Server = @ptrCast(opaque_ptr);
    return server.getStats(allocator);
}
