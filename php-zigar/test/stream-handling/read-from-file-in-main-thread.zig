const std = @import("std");
var threaded_io = std.Io.Threaded.init_single_threaded;

const io = threaded_io.io();

pub fn hash(file: std.Io.File) ![std.crypto.hash.Sha1.digest_length * 2]u8 {
    var buffer: [128]u8 = undefined;
    var sha1: std.crypto.hash.Sha1 = .init(.{});
    var count: u32 = 0;
    while (true) {
        const slices: [1][]u8 = .{&buffer};
        const read = file.readStreaming(io, slices[0..]) catch |err| switch (err) {
            error.EndOfStream => break,
            else => return err,
        };
        sha1.update(buffer[0..read]);
        count += 1;
    }
    const digest = sha1.finalResult();
    return std.fmt.bytesToHex(digest, .lower);
}
