const std = @import("std");
const c_allocator = std.heap.c_allocator;

const zigar = @import("zigar");

var work_queue: zigar.thread.WorkQueue(worker) = .{};

pub fn startup(thread_count: usize) !void {
    try work_queue.init(.{
        .allocator = c_allocator,
        .n_jobs = thread_count,
    });
}

pub fn shutdown(promise: zigar.function.Promise(void)) void {
    work_queue.deinitAsync(promise);
}

pub const tar = work_queue.promisify(worker.tar);

const worker = struct {
    pub fn tar(
        writer: std.io.AnyWriter,
        root_path: []const u8,
        src_paths: []const []const u8,
    ) !void {
        // buffer output to destination stream
        var buffer = std.io.bufferedWriter(writer);
        // create gzip compressor
        var compressor = try std.compress.gzip.compressor(buffer.writer(), .{ .level = .best });
        // create tar writer
        var tar_writer = std.tar.writer(compressor.writer().any());
        try tar_writer.setRoot(root_path);
        for (src_paths) |src_path| {
            const sub_path = std.fs.path.basename(src_path);
            if (std.fs.openDirAbsolute(src_path, .{ .iterate = true })) |dir| {
                // add the directory
                try tar_writer.writeDir(sub_path, .{});
                // then its content
                var iter = try dir.walk(c_allocator);
                defer iter.deinit();
                while (try iter.next()) |entry| {
                    if (std.fs.path.sep == '\\') {
                        // convert backslash to forward slash
                        const ptr: []u8 = @constCast(entry.path);
                        for (ptr) |*p| {
                            if (p.* == '\\') p.* = '/';
                        }
                    }
                    switch (entry.kind) {
                        .directory => {
                            try tar_writer.writeDir(entry.path, .{});
                        },
                        .file => {
                            var file = try entry.dir.openFile(entry.basename, .{});
                            defer file.close();
                            try tar_writer.writeFile(entry.path, file);
                        },
                        .sym_link => {
                            var link_name_buffer: [std.fs.max_path_bytes]u8 = undefined;
                            const link_name = try entry.dir.readLink(entry.basename, &link_name_buffer);
                            try tar_writer.writeLink(entry.path, link_name, .{});
                        },
                        else => {},
                    }
                }
            } else |dir_err| {
                if (dir_err != error.NotDir) return dir_err;
                // if not a directory, then it's a file
                if (std.fs.openFileAbsolute(src_path, .{})) |file| {
                    try tar_writer.writeFile(sub_path, file);
                } else |file_err| return file_err;
            }
        }
        try tar_writer.finish();
        try compressor.finish();
        try compressor.flush();
        try buffer.flush();
    }
};
