const std = @import("std");

const zigar = @import("zigar");

var gpa = std.heap.GeneralPurposeAllocator(.{}){};

pub fn print(file: std.fs.File, promise: zigar.function.Promise(void)) !void {
    const thread = try std.Thread.spawn(.{
        .allocator = gpa.allocator(),
    }, run, .{ file, promise });
    thread.detach();
}

pub fn run(file: std.fs.File, promise: zigar.function.Promise(void)) !void {
    const fd = file.handle;
    var buffer: [4096]u8 = undefined;
    var start: usize = 0;
    var end: usize = 0;
    var last_checked: usize = start;
    var eof = false;
    while (true) {
        // look for newline character
        const line_end: ?usize = for (last_checked..end) |i| {
            if (buffer[i] == '\n') break i + 1;
        } else if (eof) end else null;
        if (line_end) |le| {
            if (start < le) {
                std.debug.print("> {s}", .{buffer[start..le]});
                start = le;
                last_checked = le;
            }
            if (eof) break;
        } else {
            // retrieve more data, moving remaining bytes to the front first
            const remaining = end - start;
            std.mem.copyBackwards(u8, buffer[0..remaining], buffer[start..end]);
            start = 0;
            end = remaining;
            last_checked = remaining;
            if (try std.c.read(fd, buffer[end .. end + 1]) != 0) {
                end += 1;
                // switch into non-blocking mode and read the rest of the available bytes
                try setNonBlocking(fd, true);
                const read = std.c.read(fd, buffer[end..]) catch |err|
                    if (err == error.WouldBlock) 0 else return err;
                try setNonBlocking(fd, false);
                end += read;
            } else {
                eof = true;
            }
        }
    }
    promise.resolve({});
}

fn setNonBlocking(fd: c_int, nonblocking: bool) !void {
    const oflags: std.c.O = .{ .NONBLOCK = nonblocking };
    const oflags_int: @typeInfo(std.c.O).@"struct".backing_integer.? = @bitCast(oflags);
    _ = try std.c.fcntl(fd, std.c.F.SETFL, oflags_int);
}

pub fn startup() !void {
    try zigar.thread.use();
}

pub fn shutdown() void {
    zigar.thread.end();
}
