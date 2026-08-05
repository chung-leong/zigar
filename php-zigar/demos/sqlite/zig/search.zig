const std = @import("std");

const sqlite = @import("sqlite");

pub const Album = struct {
    AlbumId: ?u32 = null,
    Title: []const u8,
    ArtistId: ?u32 = null,
    Artist: []const u8,
};

pub fn search(allocator: std.mem.Allocator, path: [:0]const u8, keyword: []const u8) ![]Album {
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
    return try stmt.all(Album, allocator, .{}, .{keyword});
}

pub const @"meta(zigar)" = struct {
    pub fn isFieldString(comptime T: type, comptime _: std.meta.FieldEnum(T)) bool {
        return true;
    }
};
