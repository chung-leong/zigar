const std = @import("std");

const sqlite = @import("sqlite");

var database: ?sqlite.Db = null;
var database_id: usize = 0;
var temp_database: ?sqlite.Db = null;
var temp_database_id: usize = 0;

pub fn open(path: [:0]const u8) !void {
    if (database != null) return;
    database = try sqlite.Db.init(.{
        .mode = .{ .File = path },
        .open_flags = .{},
        .threading_mode = .SingleThread,
    });
    database_id += 1;
}

pub fn close() void {
    if (database != null) {
        database.?.deinit();
        database = null;
    }
    if (temp_database != null) {
        temp_database.?.deinit();
        temp_database = null;
    }
}

fn SQL(comptime path: []const u8, comptime params: anytype) type {
    return struct {
        const sql_templ = @embedFile(path);
        const sql = std.fmt.comptimePrint(sql_templ, params);
        const StatementType = sqlite.StatementType(.{}, sql);
        var statement: ?StatementType = null;
        var for_database_id: usize = 0;

        pub fn prepare() !*StatementType {
            if (database == null) return error.NoDatabaseConnection;
            // free the statement if it's not from the current connection
            if (statement != null and for_database_id != database_id) {
                statement.?.deinit();
                statement = null;
            }
            // prepare the statement if it hasn't been prepared already
            if (statement == null) {
                statement = try database.?.prepare(sql);
                for_database_id = database_id;
            }
            return &statement.?;
        }
    };
}

const Post = struct {
    slug: []const u8,
    date: f64,
    title: []const u8,
    excerpt: []const u8,
    content: ?[]const u8 = null,
    author: []const u8,
    tags: []const u8,
    categories: []const u8,
};

pub fn getPosts(allocator: std.mem.Allocator, offset: usize, limit: usize) ![]Post {
    var stmt = try SQL("sql/get-posts.sql", .{}).prepare();
    defer stmt.reset();
    return try stmt.all(Post, allocator, .{}, .{ limit, offset });
}

pub fn getPost(allocator: std.mem.Allocator, slug: []const u8) !Post {
    var stmt = try SQL("sql/get-post.sql", .{}).prepare();
    defer stmt.reset();
    return try stmt.oneAlloc(Post, allocator, .{}, .{slug}) orelse error.NotFound;
}

const Order = enum { rank, @"date asc", @"date desc" };

pub fn findPosts(allocator: std.mem.Allocator, search: []const u8, order: Order, offset: usize, limit: usize) ![]Post {
    switch (order) {
        inline else => |o| {
            var stmt = try SQL("sql/find-posts.sql", .{@tagName(o)}).prepare();
            defer stmt.reset();
            return try stmt.all(Post, allocator, .{}, .{ search, limit, offset });
        },
    }
}

const Count = struct { count: u32 };

pub fn findPostCount(search: []const u8) !u32 {
    var stmt = try SQL("sql/find-post-count.sql", .{}).prepare();
    defer stmt.reset();
    const result = try stmt.one(Count, .{}, .{search}) orelse return error.NotFound;
    return result.count;
}

fn getTemp() !*sqlite.Db {
    if (temp_database == null) {
        temp_database = try sqlite.Db.init(.{
            .open_flags = .{},
            .threading_mode = .SingleThread,
        });
        const create_sql = @embedFile("sql/create-temp.sql");
        try temp_database.?.exec(create_sql, .{}, .{});
        temp_database_id += 1;
    }
    return &temp_database.?;
}

pub fn checkSearch(search: []const u8) !bool {
    const check_search = struct {
        const sql = @embedFile("sql/check-search.sql");
        const StatementType = sqlite.StatementType(.{}, sql);
        var statement: ?StatementType = null;
        var for_database_id: usize = 0;

        fn prepare() !*StatementType {
            if (statement != null and for_database_id != temp_database_id) {
                statement.?.deinit();
                statement = null;
            }
            if (statement == null) {
                const db = try getTemp();
                statement = try db.prepare(sql);
                for_database_id = temp_database_id;
            }
            return &statement.?;
        }
    };
    var stmt = try check_search.prepare();
    defer stmt.reset();
    return if (stmt.exec(.{}, .{search})) true else |_| false;
}
