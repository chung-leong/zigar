const std = @import("std");

const c = @import("c");
const zigar = @import("zigar");

var gpa = std.heap.GeneralPurposeAllocator(.{}){};

pub fn print(file: std.fs.File, promise: zigar.function.Promise(void)) !void {
    const fd = switch (@typeInfo(@TypeOf(file.handle))) {
        .pointer => c._open_osfhandle(@bitCast(@intFromPtr(file.handle)), c.O_RDONLY),
        .int => file.handle,
        else => @compileError("Unexpected"),
    };
    const thread = try std.Thread.spawn(.{
        .allocator = gpa.allocator(),
    }, run, .{ fd, promise });
    thread.detach();
}

fn run(fd: c_int, promise: zigar.function.Promise(void)) !void {
    const file = c.fdopen(fd, "r") orelse return error.UnableToCreateFile;
    var buffer: [128]u8 = undefined;
    while (true) {
        const result = c.fgets(&buffer, @intCast(buffer.len), file);
        if (result == null) break;
        const line: [*:0]const u8 = @ptrCast(result);
        std.debug.print("> {s}", .{line});
    }
    promise.resolve({});
}

pub fn startup() !void {
    try zigar.thread.use();
}

pub fn shutdown() void {
    zigar.thread.end();
}
