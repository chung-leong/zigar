const std = @import("std");

const zigar = @import("zigar");

var work_queue: zigar.thread.WorkQueue(worker) = .{};

pub const save = work_queue.promisify(worker.save);

const worker = struct {
    pub fn save(file: std.fs.File) !void {
        var buffer: [4096]u8 = undefined;
        var writer = file.writer(&buffer);
        const interface = &writer.interface;
        for (0..100000) |i| {
            try interface.print("Hello world {d}\n", .{i});
        }
        try interface.flush();
    }
};
