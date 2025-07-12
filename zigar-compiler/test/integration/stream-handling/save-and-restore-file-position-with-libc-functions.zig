const std = @import("std");
const allocator = std.heap.c_allocator;

const c = @cImport({
    @cInclude("stdio.h");
});

pub fn printTwice(path: [*:0]const u8, offset: isize, len: usize) !void {
    const file = c.fopen(path, "r") orelse return error.UnableToOpenFile;
    defer _ = c.fclose(file);
    _ = c.fseek(file, offset, c.SEEK_SET);
    var pos: c.fpos_t = undefined;
    _ = c.fgetpos(file, &pos);
    var buffer: []u8 = try allocator.alloc(u8, len);
    defer allocator.free(buffer);
    const bytes_read1 = c.fread(buffer.ptr, 1, len, file);
    std.debug.print("{s}\n", .{buffer[0..bytes_read1]});
    _ = c.fsetpos(file, &pos);
    const bytes_read2 = c.fread(buffer.ptr, 1, len, file);
    std.debug.print("{s}\n", .{buffer[0..bytes_read2]});
}
