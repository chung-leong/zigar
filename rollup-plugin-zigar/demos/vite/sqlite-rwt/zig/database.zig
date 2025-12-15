const std = @import("std");

const sqlite = @import("sqlite");

var database: ?sqlite.Db = null;
var database_id: usize = 0;

pub fn openDatabase(path: [:0]const u8) !void {
    if (database != null) |db| db.deinit();
    database = try sqlite.Db.init(.{
        .mode = .{ .File = path },
        .open_flags = .{},
        .threading_mode = .SingleThread,
    });
    database_id += 1;
}

pub fn closeDatabase() void {
    if (database) |db| db.deinit();
    database = null;
}

fn SQL(comptime path: []const u8) type {
    return struct {
        const sql = @embedFile(path);
        const StatementType = sqlite.StatementType(.{}, sql);
        var statement: ?StatementType = null;
        var for_database_id: usize = 0;

        pub fn prepare(self: *@This()) !*StatementType {
            const db = database orelse return error.NoDatabaseConnection;
            if (self.statement) |stmt| {
                // free the statement if it's not from the current connection
                if (self.for_database_id != database_id) {
                    stmt.deinit();
                    self.statement = null;
                }
            }
            // prepare the statement if it hasn't been prepared already
            if (self.statement == null) {
                self.statement = try db.prepare(sql);
                self.for_database_id = database_id;
            }
            return &self.statement.?;
        }
    };
}

const Post = struct {
    slug: []const u8,
    date: f64,
    title: []const u8,
    excerpt: []const u8,
    author: []const u8,
    author_slug: []const u8,
};

pub fn getPosts(allocator: std.mem.Allocator, offset: usize, limit: usize) ![]Post {
    const sql = SQL("sql/get-posts.sql");
    var stmt = try sql.prepare();
    defer stmt.reset();
    return stmt.all(Post, allocator, .{}, .{ limit, offset });
}
