const c = @cImport({
    @cInclude("stdio.h");
    @cInclude("fcntl.h");
    @cInclude("unistd.h");
});

pub fn renameat(
    dir_path: [*:0]const u8,
    name: [*:0]const u8,
    new_dir_path: [*:0]const u8,
    new_name: [*:0]const u8,
) !void {
    const dirfd = c.openat(c.AT_FDCWD, dir_path, c.O_DIRECTORY | c.O_RDONLY);
    if (dirfd < 0) return error.UnableToOpenDirectory;
    defer _ = c.close(dirfd);
    const new_dirfd = c.openat(c.AT_FDCWD, new_dir_path, c.O_DIRECTORY | c.O_RDONLY);
    if (new_dirfd < 0) return error.UnableToOpenDirectory;
    defer _ = c.close(new_dirfd);
    const result = c.renameat(dirfd, name, new_dirfd, new_name);
    if (result < 0) return error.UnableToRenameFile;
}
