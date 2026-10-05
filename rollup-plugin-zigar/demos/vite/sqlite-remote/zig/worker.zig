const std = @import("std");
const wasm_allocator = std.heap.wasm_allocator;

const sqlite = @import("sqlite");

var database: ?*sqlite.Db = null;

const sql = .{
    .album_search =
    \\SELECT a.AlbumId, a.Title, b.ArtistId, b.Name AS Artist
    \\FROM albums a
    \\INNER JOIN artists b ON a.ArtistId = b.ArtistId
    \\WHERE a.Title LIKE '%' || ? || '%'
    \\ORDER BY a.Title
    ,
    .track_retrieval =
    \\SELECT a.TrackId, a.Name, a.Milliseconds, b.GenreId, b.Name as Genre
    \\FROM tracks a
    \\INNER JOIN genres b ON a.GenreId = b.GenreId
    \\WHERE a.AlbumId = ?
    \\ORDER BY a.TrackId
    ,
};
var stmt: define: {
    const field_names = std.meta.fieldNames(@TypeOf(sql));
    var field_types: [field_names.len]type = undefined;
    var field_attrs: [field_names.len]std.lang.Type.Struct.FieldAttributes = undefined;
    for (field_names, 0..) |field_name, i| {
        field_types[i] = sqlite.StatementType(.{}, @field(sql, field_name));
        field_attrs[i] = .{};
    }
    break :define @Struct(.auto, null, field_names, &field_types, &field_attrs);
} = undefined;

pub fn openDb(path: [:0]const u8) !void {
    if (database != null) closeDb();
    const db = try wasm_allocator.create(sqlite.Db);
    errdefer wasm_allocator.destroy(db);
    db.* = try sqlite.Db.init(.{
        .mode = .{ .File = path },
        .open_flags = .{},
        .threading_mode = .SingleThread,
    });
    errdefer db.deinit();
    var initialized: usize = 0;
    errdefer {
        inline for (std.meta.fieldNames(@TypeOf(sql)), 0..) |field_name, i| {
            if (i < initialized) @field(stmt, field_name).deinit();
        }
    }
    inline for (std.meta.fieldNames(@TypeOf(sql))) |field_name| {
        @field(stmt, field_name) = try db.prepare(@field(sql, field_name));
        initialized += 1;
    }
    database = db;
}

pub fn closeDb() void {
    if (database) |db| {
        inline for (std.meta.fieldNames(@TypeOf(sql))) |field_name| {
            @field(stmt, field_name).deinit();
        }
        db.deinit();
        wasm_allocator.destroy(db);
        database = null;
    }
}

const Album = struct {
    AlbumId: u32,
    Title: []const u8,
    ArtistId: u32,
    Artist: []const u8,
};

pub fn findAlbums(allocator: std.mem.Allocator, keyword: []const u8) ![]Album {
    defer stmt.album_search.reset();
    return try stmt.album_search.all(Album, allocator, .{}, .{keyword});
}

const Track = struct {
    TrackId: u32,
    Name: []const u8,
    Milliseconds: u32,
    GenreId: u32,
    Genre: []const u8,
};

pub fn getTracks(allocator: std.mem.Allocator, track_id: u32) ![]Track {
    defer stmt.track_retrieval.reset();
    return try stmt.track_retrieval.all(Track, allocator, .{}, .{track_id});
}

pub const @"meta(zigar)" = struct {
    pub fn isFieldString(comptime T: type, comptime _: std.meta.FieldEnum(T)) bool {
        return true;
    }

    pub fn isDeclPlain(comptime T: type, comptime _: std.meta.DeclEnum(T)) bool {
        return true;
    }
};
