const sqlite = @import("sqlite");

pub fn openDb(path: []const u8) sqlite.Db {
    return sqlite.Db.init(.{
        .mode = .{ .File = path },
        .open_flags = .{},
        .threading_mode = .MultiThread,
    });
}

pub fn closeDb(db: sqlite.Db) void {
    db.deinit();
}

fn Iterator(comptime T: type) type {
    return struct {
        stmt: sqlite.Statement,
        iterator: sqlite.Iterator(T),

        fn init(stmt: sqlite.Statement, params: anytype) !@This() {
            errdefer stmt.deinit();
            const iterator = try stmt.iterator(T, params);
            return .{ .stmt = stmt, .iterator = iterator };
        }

        fn next(self: *@This(), allocator: std.mem.Allocator) !?T {
            errdefer self.stmt.deinit();
            if (try self.iterator.nextAlloc(allocator, .{})) |row| {
                return row;
            } else {
                self.stmt.deinit();
                return null;
            }
        }
    };
}

pub const Album = struct {
    AlbumId: u32,
    Title: []const u8,
    ArtistId: u32,
    Artist: []const u8,
};

pub fn findAlbums(db: sqlite.Db, title: []const u8) Iterator(Album) {
    const sql =
        \\SELECT a.AlbumId, a.Title, b.ArtistId, b.Name AS Artist\
        \\FROM albums a\
        \\INNER JOIN artists b ON a.ArtistId = b.ArtistId\
        \\ WHERE a.Title LIKE '%' || ? || '%'
    ;
    const stmt = try db.prepare(sql);
    return try Iterator(Album).init(stmt, .{title});
}
