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
    const sql_fields = std.meta.fields(@TypeOf(sql));
    var fields: [sql_fields.len]std.builtin.Type.StructField = undefined;
    for (sql_fields, 0..) |sql_field, i| {
        const T = sqlite.StatementType(.{}, @field(sql, sql_field.name));
        fields[i] = .{
            .name = sql_field.name,
            .type = T,
            .default_value_ptr = null,
            .is_comptime = false,
            .alignment = @alignOf(T),
        };
    }
    break :define @Type(.{
        .@"struct" = .{
            .layout = .auto,
            .fields = &fields,
            .decls = &.{},
            .is_tuple = false,
        },
    });
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
        inline for (std.meta.fields(@TypeOf(sql)), 0..) |field, i| {
            if (i < initialized) @field(stmt, field.name).deinit();
        }
    }
    inline for (std.meta.fields(@TypeOf(sql))) |field| {
        @field(stmt, field.name) = try db.prepare(@field(sql, field.name));
        initialized += 1;
    }
    database = db;
}

pub fn closeDb() void {
    if (database) |db| {
        inline for (std.meta.fields(@TypeOf(sql))) |field| {
            @field(stmt, field.name).deinit();
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
