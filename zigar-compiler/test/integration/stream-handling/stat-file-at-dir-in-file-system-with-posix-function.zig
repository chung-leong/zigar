const std = @import("std");
const builtin = @import("builtin");

const c = @cImport({
    @cInclude("unistd.h");
    @cInclude("fcntl.h");
    @cInclude("sys/stat.h");
});

const darwin = struct {
    // translate-c currently doesn't handle the __DARWIN_INODE64 macro
    extern fn @"fstatat$INODE64"(c_int, [*c]const u8, [*c]c.struct_stat, c_int) c_int;
};

const fstatat = if (builtin.target.os.tag.isDarwin()) darwin.@"fstatat$INODE64" else c.fstatat;

pub fn stat(dir_path: [*:0]const u8, path: [*:0]const u8) !void {
    const dirfd = c.openat(c.AT_FDCWD, dir_path, c.O_DIRECTORY | c.O_RDONLY);
    if (dirfd < 0) return error.UnableToOpenDirectory;
    var info: c.struct_stat = undefined;
    if (fstatat(dirfd, path, &info, 0) != 0) return error.UnableToGetStat;
    std.debug.print("size = {d}\n", .{info.st_size});
}
