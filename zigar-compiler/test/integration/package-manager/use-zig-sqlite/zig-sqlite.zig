const std = @import("std");
const sqlite = @import("sqlite");

pub fn open(path: [:0]const u8, open_flags: sqlite.Db.OpenFlags) !sqlite.Db {
    return try sqlite.Db.init(.{
        .mode = sqlite.Db.Mode{ .File = path },
        .open_flags = open_flags,
        .threading_mode = .MultiThread,
    });
}

pub fn close(db: *sqlite.Db) void {
    db.deinit();
}
