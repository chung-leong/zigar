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

pub const open = work_queue.promisify(ns.open);
pub const close = work_queue.promisify(ns.close);
pub const search = work_queue.promisify(ns.search);

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
    pub fn isFieldString(comptime T: type, comptime _: std.meta.FieldEnum(T)) bool {
        return true;
    }
};
