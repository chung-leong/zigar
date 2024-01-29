const std = @import("std");
const sqlite = @import("sqlite");

pub fn run() !void {
    _ = try sqlite.Db.init(.{
        .mode = sqlite.Db.Mode{ .File = "./test.sqlite" },
        .open_flags = .{
            .write = true,
            .create = true,
        },
        .threading_mode = .MultiThread,
    });
}
