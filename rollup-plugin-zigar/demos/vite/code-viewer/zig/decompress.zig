const std = @import("std");
const zigar = @import("zigar");

var gpa: std.heap.DebugAllocator(.{}) = .init;
var work_queue: zigar.thread.WorkQueue(thread_ns) = .{};

pub fn startup() !void {
    try work_queue.init(.{ .allocator = gpa.allocator() });
}

pub fn shutdown(promise: zigar.function.Promise(void)) void {
    work_queue.deinitAsync(promise);
}

pub fn extract(
    reader: std.io.AnyReader,
    generator: zigar.function.GeneratorOf(thread_ns.extract),
) !void {
    try work_queue.push(thread_ns.extract, .{reader}, generator);
}

const thread_ns = struct {
    pub fn extract(reader: std.io.AnyReader) !Iterator {
        return .{
            .reader = reader,
        };
    }

    const Iterator = struct {
        const Decompressor = std.compress.gzip.Decompressor(Buffer.Reader);
        const TarIterator = std.tar.Iterator(Decompressor.Reader);
        const Buffer = std.io.BufferedReader(1024 * 16, std.io.AnyReader);

        reader: std.io.AnyReader,
        started: bool = false,
        decompressor: Decompressor = undefined,
        buffer: Buffer = undefined,
        file_name_buffer: [std.fs.max_path_bytes]u8 = undefined,
        link_name_buffer: [std.fs.max_path_bytes]u8 = undefined,
        tar_iter: TarIterator = undefined,

        pub fn next(self: *@This(), allocator: std.mem.Allocator) !?File {
            if (!self.started) {
                // create buffered reader
                self.buffer = .{ .unbuffered_reader = self.reader };
                // create decompressor
                self.decompressor = std.compress.gzip.decompressor(self.buffer.reader());
                // obtain the tar iterator
                self.tar_iter = std.tar.iterator(self.decompressor.reader(), .{
                    .file_name_buffer = &self.file_name_buffer,
                    .link_name_buffer = &self.link_name_buffer,
                });
                self.started = true;
            }
            // get next item
            const f = try self.tar_iter.next() orelse return null;
            const reader = f.reader();
            // read data
            const correct_len: usize = @intCast(f.size);
            const data = try allocator.alloc(u8, correct_len);
            errdefer allocator.free(data);
            const len = try reader.readAll(data);
            if (len != correct_len) return error.SizeMismatch;
            const name = try allocator.dupe(u8, f.name);
            errdefer allocator.free(name);
            const link_name = try allocator.dupe(u8, f.link_name);
            errdefer allocator.free(link_name);
            return .{
                .name = name,
                .link_name = link_name,
                .size = f.size,
                .mode = f.mode,
                .kind = f.kind,
                .data = data,
            };
        }
    };

    const File = struct {
        name: []const u8,
        link_name: []const u8,
        size: u64,
        mode: u32,
        kind: std.tar.FileKind,
        data: []const u8,
    };
};
