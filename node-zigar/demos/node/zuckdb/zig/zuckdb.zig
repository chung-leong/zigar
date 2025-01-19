const std = @import("std");
const zuckdb = @import("zuckdb");

pub fn run() !void {
    const db = try zuckdb.DB.init(allocator, "/tmp/db.duck", .{});
    defer db.deinit();

    var conn = try db.conn();
    defer conn.deinit();

    // for insert/update/delete returns the # changed rows
    // returns 0 for other statements
    _ = try conn.exec("create table users(id int)", .{});

    var rows = try conn.query("select * from users", .{});
    defer rows.deinit();

    while (try rows.next()) |row| {
        // get the 0th column of the current row
        const id = row.get(i32, 0);
        std.debug.print("The id is: {d}", .{id});
    }
}
