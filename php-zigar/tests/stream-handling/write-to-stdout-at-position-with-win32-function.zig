const std = @import("std");
const c = @cImport({
    @cInclude("windows.h");
});

pub fn write() !void {
    const stdout = c.GetStdHandle(c.STD_OUTPUT_HANDLE);
    var written: c.DWORD = undefined;
    var overlapped: c.OVERLAPPED = .{
        .unnamed_0 = .{ .unnamed_0 = .{ .Offset = 1234, .OffsetHigh = 4567 } },
    };
    const result = c.WriteFile(stdout, "Hello world\n", 12, &written, &overlapped);
    if (result != c.TRUE) return error.CannotWriteToStream;
}
