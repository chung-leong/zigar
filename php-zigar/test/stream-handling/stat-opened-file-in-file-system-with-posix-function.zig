const std = @import("std");
const builtin = @import("builtin");

const c = @cImport({
    @cInclude("sys/stat.h");
    @cInclude("unistd.h");
    @cInclude("fcntl.h");
});

const darwin = struct {
    // translate-c currently doesn't handle the __DARWIN_INODE64 macro
    extern fn @"fstat$INODE64"(c_int, [*c]c.struct_stat) c_int;
};

const fstat = if (builtin.target.os.tag.isDarwin()) darwin.@"fstat$INODE64" else c.fstat;

pub fn print(path: [*:0]const u8) !void {
    const fd = c.open(path, c.O_RDONLY);
    if (fd < 0) return error.UnableToOpenFile;
    defer _ = c.close(fd);
    var info: c.struct_stat = undefined;
    const result = fstat(fd, &info);
    if (result != 0) return error.UnableToGetStat;
    std.debug.print("size = {d}\n", .{info.st_size});
}
