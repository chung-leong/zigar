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

fn Iterator(comptime T: type, query: []const u8) type {
    const IteratorData = struct {
        stmt: sqlite.StatementType(.{}, query),
        iterator: sqlite.Iterator(T),
        arena: std.heap.ArenaAllocator,
    };
    const IteratorDataOpaquePtr = *align(@alignOf(IteratorData)) opaque {};
    return struct {
        data_ptr: IteratorDataOpaquePtr,

        fn init(db_op: SqliteOpaquePtr, params: anytype) !@This() {
            // allocate data for fields used by iterator
            const allocator = gpa.allocator();
            const data_ptr = try allocator.create(IteratorData);
            errdefer allocator.destroy(data_ptr);
            // prepare sql query
            const db_ptr: *sqlite.Db = @ptrCast(db_op);
            data_ptr.stmt = try db_ptr.prepare(query);
            errdefer data_ptr.stmt.deinit();
            // create arena allocator
            data_ptr.arena = std.heap.ArenaAllocator.init(allocator);
            errdefer data_ptr.arena.deinit();
            // create iterator
            data_ptr.iterator = try data_ptr.stmt.iteratorAlloc(T, data_ptr.arena.allocator(), params);
            return .{ .data_ptr = @ptrCast(data_ptr) };
        }

        fn deinit(self: *@This()) void {
            const data_ptr: *IteratorData = @ptrCast(self.data_ptr);
            data_ptr.stmt.deinit();
            data_ptr.arena.deinit();
            const allocator = gpa.allocator();
            errdefer allocator.destroy(data_ptr);
        }

        pub fn next(self: *@This(), allocator: std.mem.Allocator) !?T {
            errdefer self.deinit();
            const data_ptr: *IteratorData = @ptrCast(self.data_ptr);
            // return row if there's one, otherwise deinit the iterator
            if (try data_ptr.iterator.nextAlloc(allocator, .{})) |row| {
                return row;
            } else {
                self.deinit();
                return null;
            }
        }
    };
}

pub const Album = struct {
    AlbumId: ?u32 = null,
    Title: []const u8,
    ArtistId: ?u32 = null,
    Artist: []const u8,
};

const FindAlbumsIterator = Iterator(Album,
    \\SELECT a.AlbumId, a.Title, b.ArtistId, b.Name AS Artist
    \\FROM albums a
    \\INNER JOIN artists b ON a.ArtistId = b.ArtistId
    \\WHERE a.Title LIKE '%' || ? || '%'
);

pub fn findAlbums(db_op: SqliteOpaquePtr, search_str: []const u8) !FindAlbumsIterator {
    return try FindAlbumsIterator.init(db_op, .{search_str});
}

pub fn addAlbum(db_op: SqliteOpaquePtr, album: *Album) !void {
    const db_ptr: *sqlite.Db = @ptrCast(db_op);
    if (album.ArtistId == null) {
        const find_artist = "SELECT ArtistId FROM artists WHERE Name = ?";
        if (try db_ptr.one(u32, find_artist, .{}, .{album.Artist})) |id| {
            album.ArtistId = id;
        } else {
            const insert_artist = "INSERT INTO artists (Name) VALUES (?)";
            try db_ptr.exec(insert_artist, .{}, .{album.Artist});
            album.ArtistId = @intCast(db_ptr.getLastInsertRowID());
        }
    }
    const insert_album = "INSERT INTO albums (Title, ArtistId) VALUES (?, ?)";
    try db_ptr.exec(insert_album, .{}, .{ album.Title, album.ArtistId });
    album.AlbumId = @intCast(db_ptr.getLastInsertRowID());
}

pub const Track = struct {
    TrackId: u32,
    Name: []const u8,
    Milliseconds: u32,
    GenreId: u32,
    Genre: []const u8,
};

const GetTracksIterator = Iterator(Track,
    \\SELECT a.TrackId, a.Name, a.Milliseconds, b.GenreId, b.Name as Genre
    \\FROM tracks a
    \\INNER JOIN genres b ON a.GenreId = b.GenreId
    \\WHERE a.AlbumId = ?
    \\ORDER BY a.TrackId
);

pub fn getTracks(db_op: SqliteOpaquePtr, album_id: u32) !GetTracksIterator {
    return try GetTracksIterator.init(db_op, .{album_id});
}
