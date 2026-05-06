const std = @import("std");

const ZipFileIterator = std.zip.Iterator(std.fs.File.SeekableStream);

pub fn scanZip(path: []const u8) !ZipFileIterator {
    const file = try std.fs.openFileAbsolute(path, .{});
    const stream = file.seekableStream();
    return ZipFileIterator.init(stream);
}
