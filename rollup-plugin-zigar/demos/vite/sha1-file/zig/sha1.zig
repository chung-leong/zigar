const std = @import("std");

const zigar = @import("zigar");

var work_queue: zigar.thread.WorkQueue(worker) = .{};

pub fn startup() !void {
    try work_queue.init(.{
        .allocator = std.heap.wasm_allocator,
        .n_jobs = 1,
    });
}

pub const sha1 = work_queue.promisify(worker.sha1);

const worker = struct {
    pub fn sha1(file: std.fs.File) ![std.crypto.hash.Sha1.digest_length * 2]u8 {
        defer file.close();
        var hash: std.crypto.hash.Sha1 = .init(.{});
        var buffer: [1024 * 4]u8 = undefined;
        while (true) {
            const len = try file.read(&buffer);
            if (len == 0) break;
            hash.update(buffer[0..len]);
        }
        var digest: [std.crypto.hash.Sha1.digest_length]u8 = undefined;
        hash.final(&digest);
        return std.fmt.bytesToHex(digest, .lower);
    }
};

pub const @"meta(zigar)" = struct {
    pub fn isDeclString(comptime T: type, comptime _: std.meta.DeclEnum(T)) bool {
        return true;
    }
};
