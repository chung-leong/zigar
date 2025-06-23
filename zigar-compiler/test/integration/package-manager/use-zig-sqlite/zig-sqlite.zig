const std = @import("std");

const sqlite = @import("sqlite");

var gpa = std.heap.GeneralPurposeAllocator(.{}){};
const allocator = gpa.allocator();

pub const Album = struct {
    AlbumId: ?u32 = null,
    Title: []const u8,
    ArtistId: ?u32 = null,
    Artist: []const u8,
};

pub fn search(keyword: []const u8) !void {
    const path = "chinook.db";
    var db = try sqlite.Db.init(.{
        .mode = .{ .File = path },
        .open_flags = .{},
        .threading_mode = .SingleThread,
    });
    defer db.deinit();
    const sql =
        \\SELECT a.AlbumId, a.Title, b.ArtistId, b.Name AS Artist
        \\FROM albums a
        \\INNER JOIN artists b ON a.ArtistId = b.ArtistId
        \\WHERE a.Title LIKE '%' || ? || '%'
    ;
    var stmt = try db.prepare(sql);
    defer stmt.deinit();
    var iterator = try stmt.iteratorAlloc(Album, allocator, .{keyword});
    while (try iterator.nextAlloc(allocator, .{})) |album| {
        std.debug.print("{}\n", .{album});
    }
}
