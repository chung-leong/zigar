const std = @import("std");

const zigar = @import("zigar");

var gpa = std.heap.GeneralPurposeAllocator(.{}){};

var work_queue: zigar.thread.WorkQueue(ns) = .{};

pub fn startup(thread_count: usize) !void {
    try work_queue.init(.{
        .allocator = gpa.allocator(),
        .stack_size = 65536,
        .n_jobs = thread_count,
    });
}

pub fn shutdown(promise: zigar.function.Promise(void)) void {
    work_queue.deinitAsync(promise);
}

pub fn readBoth(path1: [*:0]const u8, path2: [*:0]const u8, promise: zigar.function.PromiseOf(ns.readBoth)) !void {
    try work_queue.push(ns.readBoth, .{ path1, path2 }, promise);
}

const ns = struct {
    pub fn readBoth(path1: [*:0]const u8, path2: [*:0]const u8) !void {
        const oflags: std.c.O = if (@hasField(std.c.O, "ACCMODE"))
            .{ .ACCMODE = .RDONLY, .NONBLOCK = true }
        else
            .{ .read = true, .NONBLOCK = true };
        const fd1 = std.c.open(path1, oflags);
        if (fd1 < 0) return error.UnableToOpenFile;
        defer _ = std.c.close(fd1);
        const fd2 = std.c.open(path2, oflags);
        if (fd2 < 0) return error.UnableToOpenFile;
        defer _ = std.c.close(fd2);
        var files: [2]std.c.pollfd = .{
            .{ .fd = fd1, .events = std.c.POLL.RDNORM, .revents = 0 },
            .{ .fd = fd2, .events = std.c.POLL.RDNORM, .revents = 0 },
        };
        var hup_count: usize = 0;
        while (true) {
            const count = std.c.poll(&files, files.len, 1000);
            if (count < 0) {
                break;
            }
            var buffer: [4096]u8 = undefined;
            for (&files, 0..) |*file, i| {
                if (file.revents & std.c.POLL.HUP != 0) {
                    hup_count += 1;
                    file.fd = -1;
                } else if (file.revents & std.c.POLL.RDNORM != 0) {
                    const read = std.c.read(file.fd, &buffer, buffer.len);
                    std.debug.print("read {d} bytes from file {d}\n", .{ read, i + 1 });
                }
            }
            if (hup_count >= files.len) break;
        }
    }
};
