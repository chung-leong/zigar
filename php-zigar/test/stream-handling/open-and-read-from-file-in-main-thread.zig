const std = @import("std");
var threaded_io = std.Io.Threaded.init_single_threaded;

const io = threaded_io.io();

pub fn hash(path: []const u8) ![std.crypto.hash.Sha1.digest_length * 2]u8 {
    var file = try std.Io.Dir.openFileAbsolute(io, path, .{});
    defer file.close(io);
    var buffer: [128]u8 = undefined;
    var sha1: std.crypto.hash.Sha1 = .init(.{});
    while (true) {
        const slices: [1][]u8 = .{&buffer};
        const read = file.readStreaming(io, slices[0..]) catch |err| switch (err) {
            error.EndOfStream => break,
            else => return err,
        };
        if (read == 0) break;
        sha1.update(buffer[0..read]);
    }
    const digest = sha1.finalResult();
    return std.fmt.bytesToHex(digest, .lower);
}
