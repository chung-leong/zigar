const std = @import("std");

const zigar = @import("zigar");

var work_queue: zigar.thread.WorkQueue(worker) = .{};

pub const shutdown = work_queue.promisify(.shutdown);
pub const extract = work_queue.asyncify(worker.extract);

const worker = struct {
    pub fn extract(file: std.fs.File) !Iterator {
        return .{ .file = file };
    }

    const Iterator = struct {
        file: std.fs.File,
        started: bool = false,
        reader: std.fs.File.Reader = undefined,
        read_buffer: [4096]u8 = undefined,
        decompressor: std.compress.flate.Decompress = undefined,
        decompress_buffer: [std.compress.flate.max_window_len]u8 = undefined,
        file_name_buffer: [std.fs.max_path_bytes]u8 = undefined,
        link_name_buffer: [std.fs.max_path_bytes]u8 = undefined,
        tar_iter: std.tar.Iterator = undefined,

        pub fn next(self: *@This(), allocator: std.mem.Allocator) !?File {
            if (!self.started) {
                // create file reader
                self.reader = self.file.reader(&self.read_buffer);
                // create decompressor
                self.decompressor = .init(&self.reader.interface, .gzip, &self.decompress_buffer);
                // obtain the tar iterator
                self.tar_iter = .init(&self.decompressor.reader, .{
                    .file_name_buffer = &self.file_name_buffer,
                    .link_name_buffer = &self.link_name_buffer,
                });
                self.started = true;
            }
            // get next item
            const f = try self.tar_iter.next() orelse return null;
            const name = try allocator.dupe(u8, f.name);
            errdefer allocator.free(name);
            const link_name = try allocator.dupe(u8, f.link_name);
            errdefer allocator.free(link_name);
            // read file content
            const len: usize = @intCast(f.size);
            const data = try allocator.alloc(u8, len);
            errdefer allocator.free(data);
            var data_writer: std.Io.Writer = .fixed(data);
            try self.tar_iter.streamRemaining(f, &data_writer);
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
