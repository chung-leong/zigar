const std = @import("std");

const sqlite = @import("sqlite");
const zigar = @import("zigar");

var gpa = std.heap.GeneralPurposeAllocator(.{}){};

var work_queue: zigar.thread.WorkQueue(ns) = .{};
var db: sqlite.Db = undefined;

pub fn startup() !void {
    try work_queue.init(.{
        .allocator = gpa.allocator(),
        .stack_size = 65536,
        .n_jobs = 1,
    });
}

pub fn shutdown(promise: zigar.function.Promise(void)) void {
    work_queue.deinitAsync(promise);
}

pub const Album = struct {
    AlbumId: ?u32 = null,
    Title: []const u8,
    ArtistId: ?u32 = null,
    Artist: []const u8,
};

pub fn open(promise: zigar.function.PromiseOf(ns.open)) !void {
    try work_queue.push(ns.open, .{}, promise);
}

pub fn close(promise: zigar.function.PromiseOf(ns.close)) !void {
    try work_queue.push(ns.close, .{}, promise);
}

pub fn search(allocator: std.mem.Allocator, keyword: []const u8, promise: zigar.function.PromiseOf(ns.search)) !void {
    try work_queue.push(ns.search, .{ allocator, keyword }, promise);
}

const ns = struct {
    pub fn open() !void {
        const path = "/zig/chinook.db";
        db = try sqlite.Db.init(.{
            .mode = .{ .File = path },
            .open_flags = .{},
            .threading_mode = .SingleThread,
        });
    }

    pub fn close() !void {
        defer db.deinit();
    }

    pub fn search(allocator: std.mem.Allocator, keyword: []const u8) ![]Album {
        const sql =
            \\SELECT a.AlbumId, a.Title, b.ArtistId, b.Name AS Artist
            \\FROM albums a
            \\INNER JOIN artists b ON a.ArtistId = b.ArtistId
            \\WHERE a.Title LIKE '%' || ? || '%'
            \\ORDER BY a.Title
        ;
        var stmt = try db.prepare(sql);
        defer stmt.deinit();
        return try stmt.all(Album, allocator, .{}, .{keyword});
    }
};

pub const @"meta(zigar)" = struct {
    pub fn isFieldString(comptime _: type, comptime _: []const u8) bool {
        return true;
    }
};
