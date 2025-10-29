const std = @import("std");

const sqlite = @import("sqlite");

var gpa = std.heap.GeneralPurposeAllocator(.{}){};

const SqliteOpaquePtr = *align(@alignOf(sqlite.Db)) opaque {};

pub fn openDb(path: [:0]const u8) !SqliteOpaquePtr {
    const allocator = gpa.allocator();
    const db_ptr = try allocator.create(sqlite.Db);
    errdefer allocator.destroy(db_ptr);
    db_ptr.* = try sqlite.Db.init(.{
        .mode = .{ .File = path },
        .open_flags = .{ .write = true },
        .threading_mode = .MultiThread,
    });
    return @ptrCast(db_ptr);
}

pub fn closeDb(db_op: SqliteOpaquePtr) void {
    const db_ptr: *sqlite.Db = @ptrCast(db_op);
    db_ptr.deinit();
    const allocator = gpa.allocator();
    allocator.destroy(db_ptr);
}

const Album = struct {
    AlbumId: ?u32 = null,
    Title: []const u8,
    ArtistId: ?u32 = null,
    Artist: []const u8,
};

pub fn findAlbums(allocator: std.mem.Allocator, db_op: SqliteOpaquePtr, search_str: []const u8) ![]Album {
    const db_ptr: *sqlite.Db = @ptrCast(db_op);
    const sql =
        \\SELECT a.AlbumId, a.Title, b.ArtistId, b.Name AS Artist
        \\FROM albums a
        \\INNER JOIN artists b ON a.ArtistId = b.ArtistId
        \\WHERE a.Title LIKE '%' || ? || '%'
    ;
    var stmt = try db_ptr.prepare(sql);
    defer stmt.deinit();
    return try stmt.all(Album, allocator, .{}, .{search_str});
}

pub fn addAlbum(db_op: SqliteOpaquePtr, album: *Album) !void {
    const db_ptr: *sqlite.Db = @ptrCast(db_op);
    if (album.ArtistId == null) {
        const sql_find_ = "SELECT ArtistId FROM artists WHERE Name = ?";
        if (try db_ptr.one(u32, sql_find_, .{}, .{album.Artist})) |id| {
            album.ArtistId = id;
        } else {
            const sql_insert = "INSERT INTO artists (Name) VALUES (?)";
            try db_ptr.exec(sql_insert, .{}, .{album.Artist});
            album.ArtistId = @intCast(db_ptr.getLastInsertRowID());
        }
    }
    const sql_insert_album = "INSERT INTO albums (Title, ArtistId) VALUES (?, ?)";
    try db_ptr.exec(sql_insert_album, .{}, .{ album.Title, album.ArtistId });
    album.AlbumId = @intCast(db_ptr.getLastInsertRowID());
}

pub const Track = struct {
    TrackId: u32,
    Name: []const u8,
    Milliseconds: u32,
    GenreId: u32,
    Genre: []const u8,
};

pub fn getTracks(allocator: std.mem.Allocator, db_op: SqliteOpaquePtr, album_id: u32) ![]Track {
    const db_ptr: *sqlite.Db = @ptrCast(db_op);
    const sql =
        \\SELECT a.TrackId, a.Name, a.Milliseconds, b.GenreId, b.Name as Genre
        \\FROM tracks a
        \\INNER JOIN genres b ON a.GenreId = b.GenreId
        \\WHERE a.AlbumId = ?
        \\ORDER BY a.TrackId
    ;
    var stmt = try db_ptr.prepare(sql);
    defer stmt.deinit();
    return try stmt.all(Track, allocator, .{}, .{album_id});
}

pub const @"meta(zigar)" = struct {
    pub fn isFieldString(T: type, _: std.meta.FieldEnum(T)) bool {
        return true;
    }

    pub fn isDeclPlain(T: type, _: std.meta.DeclEnum(T)) bool {
        return true;
    }
};
