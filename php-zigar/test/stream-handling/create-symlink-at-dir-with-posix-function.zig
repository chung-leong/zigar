const c = @cImport({
    @cInclude("stdio.h");
    @cInclude("fcntl.h");
    @cInclude("unistd.h");
});

pub fn symlinkat(
    target: [*:0]const u8,
    dir_path: [*:0]const u8,
    name: [*:0]const u8,
) !void {
    const dirfd = c.openat(c.AT_FDCWD, dir_path, c.O_DIRECTORY | c.O_RDONLY);
    if (dirfd < 0) return error.UnableToOpenDirectory;
    defer _ = c.close(dirfd);
    const result = c.symlinkat(target, dirfd, name);
    if (result < 0) return error.UnableToCreateSymlinkFile;
}
