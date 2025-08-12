const std = @import("std");
const c_allocator = std.heap.c_allocator;
const builtin = @import("builtin");

const fn_transform = @import("./fn-transform.zig");

const os = switch (builtin.target.os.tag) {
    .linux => .linux,
    .driverkit, .ios, .macos, .tvos, .visionos, .watchos => .darwin,
    .windows => .windows,
    else => .unknown,
};

pub const Entry = extern struct {
    handler: *const anyopaque,
    original: **const anyopaque,
};
pub const Mask = packed struct {
    open: bool = false,
    mkdir: bool = false,
    rmdir: bool = false,
    set_times: bool = false,
    stat: bool = false,
    unlink: bool = false,
};
pub const Syscall = extern struct {
    cmd: Command,
    u: extern union {
        access: extern struct {
            dirfd: i32,
            path: [*:0]const u8,
            mode: u32,
            flags: u32,
        },
        advise: extern struct {
            fd: i32,
            offset: usize,
            len: usize,
            advice: u32,
        },
        allocate: extern struct {
            fd: i32,
            mode: i32,
            offset: usize,
            len: usize,
        },
        close: extern struct {
            fd: i32,
        },
        datasync: extern struct {
            fd: i32,
        },
        getfl: extern struct {
            fd: i32,
            fdstat: Fdstat = undefined,
        },
        getlk: extern struct {
            fd: i32,
            flock: Flock,
        },
        fstat: extern struct {
            fd: i32,
            stat: Filestat = undefined,
        },
        futimes: extern struct {
            fd: i32,
            times: [*]const Timespec,
        },
        getdents: extern struct {
            dirfd: i32,
            buffer: [*]u8,
            len: usize,
            read: usize = undefined,
        },
        mkdir: extern struct {
            dirfd: i32,
            path: [*:0]const u8,
            mode: u32,
        },
        open: extern struct {
            dirfd: i32,
            path: [*:0]const u8,
            oflags: u32,
            mode: u32,
            fd: i32 = undefined,
        },
        pread: extern struct {
            fd: i32,
            bytes: [*]const u8,
            len: usize,
            offset: usize,
            read: usize = undefined,
        },
        pwrite: extern struct {
            fd: i32,
            bytes: [*]const u8,
            len: usize,
            offset: usize,
            written: usize = undefined,
        },
        read: extern struct {
            fd: i32,
            bytes: [*]const u8,
            len: usize,
            read: usize = undefined,
        },
        rmdir: extern struct {
            dirfd: i32,
            path: [*:0]const u8,
        },
        seek: extern struct {
            fd: i32,
            offset: isize,
            whence: u32,
            position: u64 = undefined,
        },
        setfl: extern struct {
            fd: i32,
            fdflags: Fdflags = undefined,
        },
        setlk: extern struct {
            fd: i32,
            wait: bool,
            flock: Flock,
        },
        stat: extern struct {
            dirfd: i32,
            path: [*:0]const u8,
            flags: u32,
            stat: Filestat = undefined,
        },
        sync: extern struct {
            fd: i32,
        },
        tell: extern struct {
            fd: i32,
            position: u64 = undefined,
        },
        unlink: extern struct {
            dirfd: i32,
            path: [*:0]const u8,
            flags: u32,
        },
        utimes: extern struct {
            dirfd: i32,
            path: [*:0]const u8,
            flags: u32,
            times: [*]const Timespec,
        },
        write: extern struct {
            fd: i32,
            bytes: [*]const u8,
            len: usize,
            written: usize = undefined,
        },
    },
    futex_handle: usize = 0,

    pub const Command = enum(c_int) {
        access,
        advise,
        allocate,
        close,
        datasync,
        fstat,
        futimes,
        getdents,
        getfl,
        getlk,
        mkdir,
        open,
        pread,
        pwrite,
        read,
        rmdir,
        seek,
        setfl,
        setlk,
        stat,
        sync,
        tell,
        unlink,
        utimes,
        write,
    };
    pub const Mask = packed struct(u8) {
        mkdir: bool = false,
        open: bool = false,
        rmdir: bool = false,
        set_times: bool = false,
        stat: bool = false,
        unlink: bool = false,
        _: u2 = 0,
    };
    pub const Flock = extern struct {
        type: i16,
        whence: i16,
        pid: i32,
        start: i64,
        len: u64,
    };
    pub const Timespec = std.c.timespec;
    pub const Fdstat = std.os.wasi.fdstat_t;
    pub const Filestat = std.os.wasi.filestat_t;
    pub const Fdflags = std.os.wasi.fdflags_t;
};
const Dirent = switch (os) {
    .windows => std.os.wasi.dirent_t,
    .linux => std.c.dirent64,
    else => std.c.dirent,
};
const Stat = switch (os) {
    .windows => std.os.wasi.filestat_t,
    else => std.c.Stat,
};

const fd_min = 0xfffff;

pub fn SyscallRedirector(comptime ModuleHost: type) type {
    return struct {
        pub fn access(path: [*:0]const u8, mode: c_int, result: *c_int) callconv(.c) bool {
            return faccessat(-1, path, mode, result);
        }

        pub fn close(fd: c_int, result: *c_int) callconv(.c) bool {
            if (isApplicableHandle(fd)) {
                var call: Syscall = .{ .cmd = .close, .u = .{
                    .close = .{
                        .fd = @intCast(fd),
                    },
                } };
                const err = Host.redirectSyscall(&call);
                result.* = intFromError(err);
                return true;
            }
            return false;
        }

        pub fn faccessat(dirfd: c_int, path: [*:0]const u8, mode: c_int, result: *c_int) callconv(.c) bool {
            return faccessat2(dirfd, path, mode, 0, result);
        }

        pub fn faccessat2(dirfd: c_int, path: [*:0]const u8, mode: c_int, flags: c_int, result: *c_int) callconv(.c) bool {
            if (isApplicableHandle(dirfd) or (dirfd < 0 and Host.isRedirecting(.open))) {
                var call: Syscall = .{ .cmd = .access, .u = .{
                    .access = .{
                        .dirfd = remapDirFD(dirfd),
                        .path = path,
                        .mode = @intCast(mode),
                        .flags = @intCast(flags),
                    },
                } };
                const err = Host.redirectSyscall(&call);
                if (err == .SUCCESS or err == .ACCES) {
                    result.* = intFromError(err);
                    return true;
                }
            }
            return false;
        }

        pub fn fadvise(fd: c_int, offset: isize, len: isize, advice: c_int, result: *c_int) callconv(.c) bool {
            return fadvise64(fd, offset, len, advice, result);
        }

        pub fn fadvise64(fd: c_int, offset: isize, len: isize, advice: c_int, result: *c_int) callconv(.c) bool {
            if (isApplicableHandle(fd)) {
                var call: Syscall = .{ .cmd = .advise, .u = .{
                    .advise = .{
                        .fd = @intCast(fd),
                        .offset = @intCast(offset),
                        .len = @intCast(len),
                        .advice = @intCast(advice),
                    },
                } };
                const err = Host.redirectSyscall(&call);
                result.* = intFromError(err);
                return true;
            }
            return false;
        }

        pub fn fallocate(fd: c_int, mode: c_int, offset: isize, len: isize, result: *c_int) callconv(.c) bool {
            if (isApplicableHandle(fd)) {
                var call: Syscall = .{ .cmd = .allocate, .u = .{
                    .allocate = .{
                        .fd = @intCast(fd),
                        .mode = @intCast(mode),
                        .offset = @intCast(offset),
                        .len = @intCast(len),
                    },
                } };
                const err = Host.redirectSyscall(&call);
                result.* = intFromError(err);
                return true;
            }
            return false;
        }

        pub fn fcntl(fd: c_int, op: c_int, arg: usize, result: *c_int) callconv(.c) bool {
            if (isApplicableHandle(fd)) {
                switch (op) {
                    std.c.F.GETFL => {
                        var call: Syscall = .{ .cmd = .getfl, .u = .{
                            .getfl = .{
                                .fd = @intCast(fd),
                            },
                        } };
                        const err = Host.redirectSyscall(&call);
                        if (err == .SUCCESS) {
                            const fdstat = call.u.getfl.fdstat;
                            var oflags: std.c.O = .{};
                            if (fdstat.fs_rights_base.FD_READ) {
                                if (fdstat.fs_rights_base.FD_WRITE) {
                                    oflags.ACCMODE = .RDWR;
                                } else {
                                    oflags.ACCMODE = .RDONLY;
                                }
                            } else if (fdstat.fs_rights_base.FD_WRITE) {
                                oflags.ACCMODE = .WRONLY;
                            } else if (fdstat.fs_rights_base.FD_READDIR) {
                                oflags.DIRECTORY = true;
                                oflags.ACCMODE = .RDONLY;
                            }
                            const oflags_int: @typeInfo(std.c.O).@"struct".backing_integer.? = @bitCast(oflags);
                            result.* = @intCast(oflags_int);
                        } else {
                            result.* = intFromError(err);
                        }
                    },
                    std.c.F.SETFL => {
                        const oflags_int: @typeInfo(std.c.O).@"struct".backing_integer.? = @truncate(arg);
                        const oflags: std.c.O = @bitCast(oflags_int);
                        var call: Syscall = .{ .cmd = .setfl, .u = .{
                            .setfl = .{
                                .fd = @intCast(fd),
                                .fdflags = .{
                                    .NONBLOCK = oflags.NONBLOCK,
                                    .APPEND = oflags.APPEND,
                                },
                            },
                        } };
                        const err = Host.redirectSyscall(&call);
                        result.* = intFromError(err);
                    },
                    std.c.F.SETLK, std.c.F.SETLKW => {
                        const lock: *const std.c.Flock = @ptrFromInt(arg);
                        var call: Syscall = .{ .cmd = .setlk, .u = .{
                            .setlk = .{
                                .fd = @intCast(fd),
                                .wait = op == std.c.F.SETLKW,
                                .flock = .{
                                    .type = lock.type,
                                    .whence = lock.whence,
                                    .start = @intCast(lock.start),
                                    .len = @intCast(lock.len),
                                    .pid = @intCast(lock.pid),
                                },
                            },
                        } };
                        const err = Host.redirectSyscall(&call);
                        result.* = intFromError(err);
                    },
                    std.c.F.GETLK => {
                        const lock: *std.c.Flock = @ptrFromInt(arg);
                        var call: Syscall = .{ .cmd = .getlk, .u = .{
                            .getlk = .{
                                .fd = @intCast(fd),
                                .flock = .{
                                    .type = lock.type,
                                    .whence = lock.whence,
                                    .start = @intCast(lock.start),
                                    .len = @intCast(lock.len),
                                    .pid = @intCast(lock.pid),
                                },
                            },
                        } };
                        const err = Host.redirectSyscall(&call);
                        lock.type = call.u.getlk.flock.type;
                        lock.whence = call.u.getlk.flock.whence;
                        lock.start = @intCast(call.u.getlk.flock.start);
                        lock.len = @intCast(call.u.getlk.flock.len);
                        lock.pid = @intCast(call.u.getlk.flock.pid);
                        result.* = intFromError(err);
                    },
                    else => result.* = intFromError(.INVAL),
                }
                return true;
            }
            return false;
        }

        pub fn fdatasync(fd: c_int, result: *c_int) callconv(.c) bool {
            if (isApplicableHandle(fd)) {
                var call: Syscall = .{ .cmd = .datasync, .u = .{
                    .datasync = .{
                        .fd = @intCast(fd),
                    },
                } };
                const err = Host.redirectSyscall(&call);
                result.* = intFromError(err);
                return true;
            }
            return false;
        }

        pub fn flock(fd: c_int, op: c_int, result: *c_int) callconv(.c) bool {
            if (isApplicableHandle(fd)) {
                const lock: std.c.Flock = .{
                    .type = switch (op & ~@as(c_int, std.c.LOCK.NB)) {
                        std.c.LOCK.SH => std.c.F.RDLCK,
                        std.c.LOCK.EX => std.c.F.WRLCK,
                        std.c.LOCK.UN => std.c.F.UNLCK,
                        else => {
                            result.* = intFromError(std.c.E.INVAL);
                            return true;
                        },
                    },
                    .whence = std.c.SEEK.SET,
                    .start = 0,
                    .len = 0,
                    .pid = 0,
                };
                const fcntl_op: c_int = switch (op & std.c.LOCK.NB) {
                    0 => std.c.F.SETLKW,
                    else => std.c.F.SETLK,
                };
                return fcntl(fd, fcntl_op, @intFromPtr(&lock), result);
            }
            return false;
        }

        pub fn fstat(fd: c_int, buf: *Stat, result: *c_int) callconv(.c) bool {
            if (isApplicableHandle(fd)) {
                var call: Syscall = .{ .cmd = .fstat, .u = .{
                    .fstat = .{
                        .fd = @intCast(fd),
                    },
                } };
                const err = Host.redirectSyscall(&call);
                if (err == .SUCCESS) copyStat(buf, &call.u.fstat.stat);
                result.* = intFromError(err);
                return true;
            }
            return false;
        }

        pub fn fsync(fd: c_int, result: *c_int) callconv(.c) bool {
            if (isApplicableHandle(fd)) {
                var call: Syscall = .{ .cmd = .sync, .u = .{
                    .sync = .{
                        .fd = @intCast(fd),
                    },
                } };
                const err = Host.redirectSyscall(&call);
                result.* = intFromError(err);
                return true;
            }
            return false;
        }

        pub fn futimens(fd: c_int, times: [*]const std.c.timespec, result: *c_int) callconv(.c) bool {
            if (isApplicableHandle(fd)) {
                var call: Syscall = .{ .cmd = .futimes, .u = .{
                    .futimes = .{
                        .fd = @intCast(fd),
                        .times = times,
                    },
                } };
                const err = Host.redirectSyscall(&call);
                result.* = intFromError(err);
                return true;
            }
            return false;
        }

        pub fn futimes(fd: c_int, tv: [*]const std.c.timeval, result: *c_int) callconv(.c) bool {
            if (isApplicableHandle(fd)) {
                const times = convertTimeval(tv);
                return futimens(fd, &times, result);
            }
            return false;
        }

        pub fn futimesat(dirfd: c_int, path: [*:0]const u8, tv: [*]const std.c.timeval, result: *c_int) callconv(.c) bool {
            if (isApplicableHandle(dirfd) or (dirfd < 0 and Host.isRedirecting(.set_times))) {
                const times = convertTimeval(tv);
                return utimensat(dirfd, path, &times, std.c.AT.SYMLINK_FOLLOW, result);
            }
            return false;
        }

        pub fn getdents(dirfd: c_int, buffer: [*]u8, len: c_uint, result: *c_int) callconv(.c) bool {
            return getdents64(dirfd, buffer, len, result);
        }

        pub fn getdents64(dirfd: c_int, buffer: [*]u8, len: c_uint, result: *c_int) callconv(.c) bool {
            if (isApplicableHandle(dirfd)) {
                // get offset to name in the wasi struct and in the system struct
                const src_name_offset = @sizeOf(std.os.wasi.dirent_t);
                const name_offset = @offsetOf(Dirent, "name");
                // adjust the amount of data to retrieve if the posix struct is bigger than the wasi struct
                const diff = switch (name_offset > src_name_offset) {
                    true => (name_offset - src_name_offset) * (len / 64),
                    false => 0,
                };
                var stb = std.heap.stackFallback(1024 * 8, c_allocator);
                const allocator = stb.get();
                const src_buffer = allocator.alloc(u8, len - diff) catch {
                    result.* = intFromError(.NOMEM);
                    return true;
                };
                defer allocator.free(src_buffer);
                var call: Syscall = .{ .cmd = .getdents, .u = .{
                    .getdents = .{
                        .dirfd = @intCast(dirfd),
                        .buffer = src_buffer.ptr,
                        .len = @intCast(src_buffer.len),
                    },
                } };
                const err = Host.redirectSyscall(&call);
                if (err == .SUCCESS) {
                    // translate wasi dirents to system dirents
                    const src_used = call.u.getdents.read;
                    var src_offset: usize = 0;
                    var offset: usize = 0;
                    var next_pos: isize = 0;
                    while (src_offset + src_name_offset < src_used) {
                        const src_entry: *align(1) std.os.wasi.dirent_t = @ptrCast(&src_buffer[src_offset]);
                        const entry: *align(1) Dirent = @ptrCast(&buffer[offset]);
                        const name_len: usize = src_entry.namlen;
                        const reclen = name_offset + name_len + 1;
                        if (offset + reclen >= len) {
                            // retrieved too much data--reposition cursor before exiting
                            var seek_result: isize = undefined;
                            _ = lseek(dirfd, next_pos, std.c.SEEK.SET, &seek_result);
                            break;
                        }
                        if (@hasField(Dirent, "ino")) {
                            entry.ino = @intCast(src_entry.ino);
                        } else if (@hasField(Dirent, "fileno")) {
                            entry.fileno = @intCast(src_entry.ino);
                        }
                        if (@hasField(Dirent, "off")) {
                            entry.off = @intCast(src_entry.next);
                        } else if (@hasField(Dirent, "seekoff")) {
                            entry.seekoff = @intCast(src_entry.next);
                        }
                        if (@hasField(Dirent, "reclen")) {
                            entry.reclen = @intCast(reclen);
                        }
                        if (@hasField(Dirent, "namlen")) {
                            entry.namlen = @intCast(name_len);
                        }
                        if (@hasField(Dirent, "type")) {
                            entry.type = switch (src_entry.type) {
                                .BLOCK_DEVICE => std.c.DT.BLK,
                                .CHARACTER_DEVICE => std.c.DT.CHR,
                                .DIRECTORY => std.c.DT.DIR,
                                .REGULAR_FILE => std.c.DT.REG,
                                .SOCKET_DGRAM => std.c.DT.SOCK,
                                .SOCKET_STREAM => std.c.DT.SOCK,
                                .SYMBOLIC_LINK => std.c.DT.LNK,
                                else => std.c.DT.UNKNOWN,
                            };
                        }
                        const src_name: [*]const u8 = @ptrCast(&src_buffer[src_offset + src_name_offset]);
                        const name: [*]u8 = @ptrCast(&buffer[offset + name_offset]);
                        @memcpy(name[0..name_len], src_name[0..name_len]);
                        name[name_len] = 0;
                        src_offset += src_name_offset + name_len;
                        offset += reclen;
                        next_pos = @intCast(src_entry.next);
                    }
                    result.* = @intCast(offset);
                } else {
                    result.* = intFromError(err);
                }
                return true;
            }
            return false;
        }

        pub fn lseek(fd: c_int, offset: isize, whence: c_int, result: *isize) callconv(.c) bool {
            if (isApplicableHandle(fd)) {
                const tell = offset == 0 and whence == std.c.SEEK.CUR;
                var call: Syscall = switch (tell) {
                    true => .{ .cmd = .tell, .u = .{
                        .tell = .{
                            .fd = @intCast(fd),
                        },
                    } },
                    false => .{ .cmd = .seek, .u = .{
                        .seek = .{
                            .fd = @intCast(fd),
                            .offset = @intCast(offset),
                            .whence = @intCast(whence),
                        },
                    } },
                };
                const err = Host.redirectSyscall(&call);
                if (err == .SUCCESS) {
                    result.* = switch (tell) {
                        true => @intCast(call.u.tell.position),
                        false => @intCast(call.u.seek.position),
                    };
                } else {
                    result.* = intFromError(err);
                }
                return true;
            }
            return false;
        }

        pub fn lstat(path: [*:0]const u8, buf: *Stat, result: *c_int) callconv(.c) bool {
            return newfstatat(-1, path, buf, std.c.AT.SYMLINK_NOFOLLOW, result);
        }

        pub fn lutimes(path: [*:0]const u8, tv: [*]const std.c.timeval, result: *c_int) callconv(.c) bool {
            const times = convertTimeval(tv);
            return utimensat(-1, path, &times, std.c.AT.SYMLINK_NOFOLLOW, result);
        }

        pub fn mkdir(path: [*:0]const u8, mode: c_int, result: *c_int) callconv(.c) bool {
            return mkdirat(-1, path, mode, result);
        }

        pub fn mkdirat(dirfd: c_int, path: [*:0]const u8, mode: c_int, result: *c_int) callconv(.c) bool {
            if (isApplicableHandle(dirfd) or (dirfd < 0 and Host.isRedirecting(.mkdir))) {
                var call: Syscall = .{ .cmd = .mkdir, .u = .{
                    .mkdir = .{
                        .dirfd = remapDirFD(dirfd),
                        .path = path,
                        .mode = @intCast(mode),
                    },
                } };
                const err = Host.redirectSyscall(&call);
                if (err == .SUCCESS or err == .EXIST or isApplicableHandle(dirfd)) {
                    result.* = intFromError(err);
                    return true;
                }
            }
            return false;
        }

        pub fn newfstatat(dirfd: c_int, path: [*:0]const u8, buf: *Stat, flags: c_int, result: *c_int) callconv(.c) bool {
            if (isApplicableHandle(dirfd) or (dirfd < 0 and Host.isRedirecting(.stat))) {
                var call: Syscall = .{ .cmd = .stat, .u = .{
                    .stat = .{
                        .dirfd = @intCast(dirfd),
                        .path = path,
                        .flags = @intCast(flags),
                    },
                } };
                const err = Host.redirectSyscall(&call);
                if (err == .SUCCESS) copyStat(buf, &call.u.stat.stat);
                result.* = intFromError(err);
                return true;
            }
            return false;
        }

        pub fn open(path: [*:0]const u8, oflags: c_int, mode: c_int, result: *c_int) callconv(.c) bool {
            return openat(-1, path, oflags, mode, result);
        }

        pub fn openat(dirfd: c_int, path: [*:0]const u8, oflags: c_int, mode: c_int, result: *c_int) callconv(.c) bool {
            if (isApplicableHandle(dirfd) or (dirfd < 0 and Host.isRedirecting(.open))) {
                const o: std.c.O = @bitCast(@as(i32, @intCast(oflags)));
                var call: Syscall = .{ .cmd = .open, .u = .{
                    .open = .{
                        .dirfd = remapDirFD(dirfd),
                        .path = path,
                        .oflags = @intCast(oflags),
                        .mode = if (o.CREAT) @intCast(mode) else 0,
                    },
                } };
                const err = Host.redirectSyscall(&call);
                if (err == .SUCCESS) {
                    result.* = call.u.open.fd;
                    return true;
                } else if (err != .NOENT) {
                    result.* = intFromError(err);
                    return true;
                }
            }
            return false;
        }

        pub fn pread(fd: c_int, buffer: [*]u8, len: isize, offset: isize, result: *isize) callconv(.c) bool {
            if (isApplicableHandle(fd)) {
                var call: Syscall = .{ .cmd = .pread, .u = .{
                    .pread = .{
                        .fd = @intCast(fd),
                        .bytes = buffer,
                        .len = @intCast(len),
                        .offset = @intCast(offset),
                    },
                } };
                const err = Host.redirectSyscall(&call);
                if (err == .SUCCESS) {
                    result.* = @intCast(call.u.pread.read);
                } else {
                    result.* = intFromError(err);
                }
                return true;
            }
            return false;
        }

        pub fn pwrite(fd: c_int, buffer: [*]const u8, len: isize, offset: isize, result: *isize) callconv(.c) bool {
            if (isApplicableHandle(fd)) {
                var call: Syscall = .{ .cmd = .pwrite, .u = .{
                    .pwrite = .{
                        .fd = @intCast(fd),
                        .bytes = buffer,
                        .len = @intCast(len),
                        .offset = @intCast(offset),
                    },
                } };
                const err = Host.redirectSyscall(&call);
                if (err == .SUCCESS) {
                    result.* = @intCast(call.u.pwrite.written);
                } else {
                    result.* = intFromError(err);
                }
                return true;
            }
            return false;
        }

        pub fn read(fd: c_int, buffer: [*]u8, len: isize, result: *isize) callconv(.c) bool {
            if (isApplicableHandle(fd)) {
                var call: Syscall = .{ .cmd = .read, .u = .{
                    .read = .{
                        .fd = @intCast(fd),
                        .bytes = buffer,
                        .len = @intCast(len),
                    },
                } };
                const err = Host.redirectSyscall(&call);
                if (err == .SUCCESS) {
                    result.* = @intCast(call.u.read.read);
                } else {
                    result.* = intFromError(err);
                }
                return true;
            }
            return false;
        }

        pub fn rmdir(path: [*:0]const u8, result: *c_int) callconv(.c) bool {
            if (Host.isRedirecting(.rmdir)) {
                var call: Syscall = .{ .cmd = .rmdir, .u = .{
                    .rmdir = .{
                        .dirfd = -1,
                        .path = path,
                    },
                } };
                const err = Host.redirectSyscall(&call);
                if (err == .SUCCESS or err != .NOENT) {
                    result.* = intFromError(err);
                    return true;
                }
            }
            return false;
        }

        pub fn stat(path: [*:0]const u8, buf: *Stat, result: *c_int) callconv(.c) bool {
            return newfstatat(-1, path, buf, 0, result);
        }

        pub fn statx(dirfd: c_int, path: [*:0]const u8, flags: c_int, mask: c_uint, buf: *std.os.linux.Statx, result: *c_int) callconv(.c) bool {
            if (isApplicableHandle(dirfd) or (dirfd < 0 and Host.isRedirecting(.stat))) {
                if (flags & std.os.linux.AT.EMPTY_PATH != 0 and std.mem.len(path) == 0) {
                    var call: Syscall = .{ .cmd = .fstat, .u = .{
                        .fstat = .{
                            .fd = remapDirFD(dirfd),
                        },
                    } };
                    const err = Host.redirectSyscall(&call);
                    if (err == .SUCCESS) copyStatx(buf, &call.u.fstat.stat, mask);
                    result.* = intFromError(err);
                } else {
                    var call: Syscall = .{ .cmd = .stat, .u = .{
                        .stat = .{
                            .dirfd = remapDirFD(dirfd),
                            .path = path,
                            .flags = @intCast(flags),
                        },
                    } };
                    const err = Host.redirectSyscall(&call);
                    if (err == .SUCCESS) copyStatx(buf, &call.u.stat.stat, mask);
                    result.* = intFromError(err);
                }
                return true;
            }
            return false;
        }

        pub fn unlink(path: [*:0]const u8, result: *c_int) callconv(.c) bool {
            return unlinkat(-1, path, 0, result);
        }

        pub fn unlinkat(dirfd: c_int, path: [*:0]const u8, flags: c_int, result: *c_int) callconv(.c) bool {
            if (isApplicableHandle(dirfd) or (dirfd < 0 and Host.isRedirecting(.unlink))) {
                var call: Syscall = .{ .cmd = .unlink, .u = .{
                    .unlink = .{
                        .dirfd = remapDirFD(dirfd),
                        .path = path,
                        .flags = @intCast(flags),
                    },
                } };
                const err = Host.redirectSyscall(&call);
                if (err == .SUCCESS or isApplicableHandle(dirfd)) {
                    result.* = intFromError(err);
                    return true;
                }
            }
            return false;
        }

        pub fn utimes(path: [*:0]const u8, tv: [*]const std.c.timeval, result: *c_int) callconv(.c) bool {
            const times = convertTimeval(tv);
            return utimensat(-1, path, &times, std.c.AT.SYMLINK_FOLLOW, result);
        }

        pub fn utimensat(dirfd: c_int, path: [*:0]const u8, times: [*]const std.c.timespec, flags: c_int, result: *c_int) callconv(.c) bool {
            if (isApplicableHandle(dirfd) or (dirfd < 0 and Host.isRedirecting(.set_times))) {
                var call: Syscall = .{ .cmd = .utimes, .u = .{
                    .utimes = .{
                        .dirfd = remapDirFD(dirfd),
                        .path = path,
                        .flags = @intCast(flags),
                        .times = times,
                    },
                } };
                const err = Host.redirectSyscall(&call);
                if (err == .SUCCESS or isApplicableHandle(dirfd)) {
                    result.* = intFromError(err);
                    return true;
                }
            }
            return false;
        }

        pub fn write(fd: c_int, buffer: [*]const u8, len: isize, result: *isize) callconv(.c) bool {
            if (isApplicableHandle(fd)) {
                var call: Syscall = .{ .cmd = .write, .u = .{
                    .write = .{
                        .fd = @intCast(fd),
                        .bytes = buffer,
                        .len = @intCast(len),
                    },
                } };
                const err = Host.redirectSyscall(&call);
                if (err == .SUCCESS) {
                    result.* = @intCast(call.u.write.written);
                } else {
                    result.* = intFromError(err);
                }
                return true;
            }
            return false;
        }

        const Host = ModuleHost;

        fn isApplicableHandle(fd: isize) bool {
            return switch (fd) {
                0, 1, 2 => true,
                else => fd >= fd_min,
            };
        }

        fn remapDirFD(dirfd: isize) i32 {
            return switch (dirfd) {
                -100 => -1,
                else => @intCast(dirfd),
            };
        }

        fn convertTimeval(tv: [*]const std.c.timeval) [2]std.c.timespec {
            var times: [2]std.c.timespec = undefined;
            for (&times, 0..) |*ptr, index| {
                ptr.* = .{
                    .sec = tv[index].sec,
                    .nsec = tv[index].usec * 1000,
                };
            }
            return times;
        }

        fn copyStat(dest: *Stat, src: *const std.os.wasi.filestat_t) void {
            dest.* = std.mem.zeroes(Stat);
            dest.ino = src.ino;
            dest.size = @truncate(@as(i64, @intCast(src.size)));
            dest.mode = @intFromEnum(src.filetype);
            copyTime(&dest.atim, src.atim);
            copyTime(&dest.mtim, src.mtim);
            copyTime(&dest.ctim, src.ctim);
        }

        fn copyStatx(dest: *std.os.linux.Statx, src: *const std.os.wasi.filestat_t, mask: c_uint) void {
            dest.* = std.mem.zeroes(std.os.linux.Statx);
            dest.mask = @intCast(mask);
            dest.ino = src.ino;
            dest.size = src.size;
            if (mask & std.os.linux.STATX_MODE != 0) {}
            if (mask & std.os.linux.STATX_TYPE != 0) {
                dest.mode |= switch (src.filetype) {
                    .BLOCK_DEVICE => std.os.linux.S.IFBLK,
                    .CHARACTER_DEVICE => std.os.linux.S.IFCHR,
                    .DIRECTORY => std.os.linux.S.IFDIR,
                    .REGULAR_FILE => std.os.linux.S.IFREG,
                    .SOCKET_DGRAM, .SOCKET_STREAM => std.os.linux.S.IFSOCK,
                    .SYMBOLIC_LINK => std.os.linux.S.IFLNK,
                    else => 0,
                };
            }
            if (mask & std.os.linux.STATX_NLINK != 0) {
                dest.nlink = @intCast(src.nlink);
            }
            if (mask & std.os.linux.STATX_ATIME != 0) {
                copyTime(&dest.atime, src.atim);
            }
            if (mask & std.os.linux.STATX_BTIME != 0) {
                copyTime(&dest.btime, src.ctim);
            }
            if (mask & std.os.linux.STATX_CTIME != 0) {
                copyTime(&dest.ctime, src.ctim);
            }
            if (mask & std.os.linux.STATX_MTIME != 0) {
                copyTime(&dest.mtime, src.mtim);
            }
        }

        fn copyTime(dest: anytype, ns: u64) void {
            dest.sec = @intCast(ns / 1_000_000_000);
            dest.nsec = @intCast(ns % 1_000_000_000);
        }
    };
}

pub fn PosixSubstitute(comptime redirector: type) type {
    return struct {
        pub const access = makeStdHook("access");
        pub const close = makeStdHook("close");
        pub const faccessat = makeStdHookUsing("faccessat", "faccessat2");
        pub const fallocate = makeStdHook("fallocate");
        pub const fcntl = makeStdHook("fcntl");
        pub const fcntl64 = makeStdHookUsing("fcntl64", "fcntl");
        pub const fdatasync = makeStdHook("fdatasync");
        pub const flock = makeStdHook("flock");
        pub const fstat = makeStdHook("fstat");
        pub const fstat64 = makeStdHookUsing("fstat64", "fstat");
        pub const fstatat = makeStdHookUsing("fstatat", "newfstatat");
        pub const fstatat64 = makeStdHookUsing("fstatat64", "newfstatat");
        pub const fsync = makeStdHook("fsync");
        pub const futimens = makeStdHook("futimens");
        pub const futimes = makeStdHook("futimes");
        pub const futimesat = makeStdHook("futimesat");
        pub const lseek = makeStdHook("lseek");
        pub const lseek64 = makeStdHookUsing("lseek64", "lseek");
        pub const lstat = makeStdHook("lstat");
        pub const lstat64 = makeStdHookUsing("lstat64", "lstat");
        pub const lutimes = makeStdHook("lutimes");
        pub const mkdir = makeStdHook("mkdir");
        pub const mkdirat = makeStdHook("mkdirat");
        pub const open = makeStdHook("open");
        pub const openat = makeStdHook("openat");
        pub const open64 = makeStdHookUsing("open64", "open");
        pub const openat64 = makeStdHookUsing("openat64", "openat");
        pub const posix_fadvise = makeStdHookUsing("posix_fadvise", "fadvise64");
        pub const pread = makeStdHook("pread");
        pub const pread64 = makeStdHookUsing("pread64", "pread");
        pub const pwrite = makeStdHook("pwrite");
        pub const pwrite64 = makeStdHookUsing("pwrite64", "pwrite");
        pub const read = makeStdHook("read");
        pub const rmdir = makeStdHook("rmdir");
        pub const stat = makeStdHook("stat");
        pub const stat64 = makeStdHookUsing("stat64", "stat");
        pub const unlink = makeStdHook("unlink");
        pub const unlinkat = makeStdHook("unlinkat");
        pub const utimensat = makeStdHook("utimensat");
        pub const utimes = makeStdHook("utimes");
        pub const write = makeStdHook("write");

        pub fn __fxstat(ver: c_int, fd: c_int, buf: *Stat) callconv(.c) c_int {
            var result: c_int = undefined;
            if (redirector.fstat(fd, buf, &result)) {
                return saveError(result);
            }
            return Original.__fxstat(ver, fd, buf);
        }

        pub fn __fxstat64(ver: c_int, fd: c_int, buf: *Stat) callconv(.c) c_int {
            var result: c_int = undefined;
            if (redirector.fstat(fd, buf, &result)) {
                return saveError(result);
            }
            return Original.__fxstat64(ver, fd, buf);
        }

        pub fn __fxstatat(ver: c_int, dirfd: c_int, path: [*:0]const u8, buf: *Stat) callconv(.c) c_int {
            var result: c_int = undefined;
            if (redirector.newfstatat(dirfd, path, buf, std.c.AT.SYMLINK_FOLLOW, &result)) {
                return saveError(result);
            }
            return Original.__fxstatat(ver, dirfd, path, buf);
        }

        pub fn __fxstatat64(ver: c_int, dirfd: c_int, path: [*:0]const u8, buf: *Stat) callconv(.c) c_int {
            var result: c_int = undefined;
            if (redirector.newfstatat(dirfd, path, buf, std.c.AT.SYMLINK_FOLLOW, &result)) {
                return saveError(result);
            }
            return Original.__fxstatat64(ver, dirfd, path, buf);
        }

        pub fn __lxstat(ver: c_int, path: [*:0]const u8, buf: *Stat) callconv(.c) c_int {
            var result: c_int = undefined;
            if (redirector.lstat(path, buf, &result)) {
                return saveError(result);
            }
            return Original.__lxstat(ver, path, buf);
        }

        pub fn __lxstat64(ver: c_int, path: [*:0]const u8, buf: *Stat) callconv(.c) c_int {
            var result: c_int = undefined;
            if (redirector.lstat(path, buf, &result)) {
                return saveError(result);
            }
            return Original.__lxstat64(ver, path, buf);
        }

        pub fn __xstat(ver: c_int, path: [*:0]const u8, buf: *Stat) callconv(.c) c_int {
            var result: c_int = undefined;
            if (redirector.stat(path, buf, &result)) {
                return saveError(result);
            }
            return Original.__xstat(ver, path, buf);
        }

        pub fn __xstat64(ver: c_int, path: [*:0]const u8, buf: *Stat) callconv(.c) c_int {
            var result: c_int = undefined;
            if (redirector.stat(path, buf, &result)) {
                return saveError(result);
            }
            return Original.__xstat64(ver, path, buf);
        }

        pub fn closedir(d: *std.c.DIR) callconv(.c) void {
            if (RedirectedDir.cast(d)) |dir| {
                _ = close(dir.fd);
                c_allocator.destroy(dir);
                return;
            }
            return Original.closedir(d);
        }

        pub fn opendir(path: [*:0]const u8) callconv(.c) ?*std.c.DIR {
            var result: c_int = undefined;
            const flags: std.c.O = .{ .DIRECTORY = true };
            const flags_int: @typeInfo(std.c.O).@"struct".backing_integer.? = @bitCast(flags);
            if (redirector.open(path, flags_int, 0, &result)) {
                if (result > 0) {
                    if (c_allocator.create(RedirectedDir)) |dir| {
                        dir.* = .{ .fd = @intCast(result) };
                        return @ptrCast(dir);
                    } else |_| {}
                }
                return null;
            }
            return Original.opendir(path);
        }

        pub fn pthread_create(thread: *std.c.pthread_t, attr: ?*const std.c.pthread_attr_t, start_routine: *const fn (?*anyopaque) callconv(.c) ?*anyopaque, arg: ?*anyopaque) callconv(.c) c_int {
            const info = c_allocator.create(ThreadInfo) catch return @intFromEnum(std.c.E.NOMEM);
            info.* = .{
                .proc = start_routine,
                .arg = arg,
                .instance = redirector.Host.getInstance() catch return @intFromEnum(std.c.E.FAULT),
            };
            return Original.pthread_create(thread, attr, &setThreadContext, info);
        }

        pub fn readdir(d: *std.c.DIR) callconv(.c) ?*align(1) const Dirent {
            if (RedirectedDir.cast(d)) |dir| {
                if (dir.data_next == dir.data_len) {
                    var result: c_int = undefined;
                    if (redirector.getdents(dir.fd, &dir.buffer, dir.buffer.len, &result) and result > 0) {
                        dir.data_next = 0;
                        dir.data_len = @intCast(result);
                    }
                }
                if (dir.data_next < dir.data_len) {
                    const dirent: *align(1) const Dirent = @ptrCast(&dir.buffer[dir.data_next]);
                    if (@hasField(Dirent, "reclen")) {
                        dir.data_next += dirent.reclen;
                    } else if (@hasField(Dirent, "namlen")) {
                        dir.data_next += @offsetOf(Dirent, "name") + dirent.namlen;
                    }
                    dir.cookie = dirent.off;
                    return dirent;
                }
                return null;
            }
            return Original.readdir(d);
        }

        pub fn rewinddir(d: *std.c.DIR) callconv(.c) void {
            if (RedirectedDir.cast(d)) |dir| {
                if (lseek(dir.fd, 0, std.c.SEEK.SET) == 0) {
                    dir.cookie = 0;
                    dir.data_next = 0;
                    dir.data_len = 0;
                }
            }
            return Original.rewinddir(d);
        }

        pub fn seekdir(d: *std.c.DIR, offset: c_ulong) callconv(.c) void {
            if (RedirectedDir.cast(d)) |dir| {
                if (lseek(dir.fd, @intCast(offset), std.c.SEEK.SET) == 0) {
                    dir.cookie = offset;
                    dir.data_next = 0;
                    dir.data_len = 0;
                }
            }
            return Original.seekdir(d, offset);
        }

        pub fn telldir(d: *std.c.DIR) callconv(.c) c_ulong {
            if (RedirectedDir.cast(d)) |dir| {
                return dir.cookie;
            }
            return Original.telldir(d);
        }

        fn makeStdHook(comptime name: []const u8) StdHook(@TypeOf(@field(redirector, name))) {
            // default case where the name of the handler matches the name of the function being hooked
            return makeStdHookUsing(name, name);
        }

        fn makeStdHookUsing(comptime original_name: []const u8, comptime handler_name: []const u8) StdHook(@TypeOf(@field(redirector, handler_name))) {
            const handler = @field(redirector, handler_name);
            const Handler = @TypeOf(handler);
            const HandlerArgs = std.meta.ArgsTuple(Handler);
            const Hook = StdHook(Handler);
            const HookArgs = std.meta.ArgsTuple(Hook);
            const RT = @typeInfo(Hook).@"fn".return_type.?;
            const ns = struct {
                fn hook(hook_args: HookArgs) RT {
                    var handler_args: HandlerArgs = undefined;
                    inline for (hook_args, 0..) |arg, index| {
                        handler_args[index] = arg;
                    }
                    var result: RT = undefined;
                    handler_args[handler_args.len - 1] = &result;
                    if (@call(.auto, handler, handler_args)) {
                        return saveError(result);
                    }
                    const original = @field(Original, original_name);
                    return @call(.auto, original, hook_args);
                }
            };
            return fn_transform.spreadArgs(ns.hook, .c);
        }

        fn StdHook(comptime Func: type) type {
            const params = @typeInfo(Func).@"fn".params;
            var new_params: [params.len - 1]std.builtin.Type.Fn.Param = undefined;
            for (&new_params, 0..) |*ptr, index| ptr.* = params[index];
            const RPtrT = params[params.len - 1].type.?;
            const RT = @typeInfo(RPtrT).pointer.child;
            return @Type(.{
                .@"fn" = .{
                    .params = &new_params,
                    .return_type = RT,
                    .is_generic = false,
                    .is_var_args = false,
                    .calling_convention = .c,
                },
            });
        }

        fn saveError(result: anytype) @TypeOf(result) {
            if (result < 0) {
                setError(@intCast(-result));
                return -1;
            }
            return result;
        }

        fn setError(err: c_int) void {
            const ptr = getErrnoPtr();
            ptr.* = err;
        }

        fn getError() c_int {
            const ptr = getErrnoPtr();
            return ptr.*;
        }

        var errno_ptr: ?*c_int = null;

        fn getErrnoPtr() *c_int {
            return errno_ptr orelse get: {
                errno_ptr = errno_h.__errno_location();
                break :get errno_ptr.?;
            };
        }

        const ThreadInfo = struct {
            proc: *const fn (?*anyopaque) callconv(.c) ?*anyopaque,
            arg: ?*anyopaque,
            instance: *anyopaque,
        };

        fn setThreadContext(ptr: ?*anyopaque) callconv(.c) ?*anyopaque {
            const info: *ThreadInfo = @ptrCast(@alignCast(ptr.?));
            const proc = info.proc;
            const arg = info.arg;
            const instance = info.instance;
            c_allocator.destroy(info);
            redirector.Host.initializeThread(instance) catch {};
            return proc(arg);
        }

        const errno_h = @cImport({
            @cInclude("errno.h");
        });

        const Sub = @This();
        pub const Original = struct {
            pub var __fxstat: *const @TypeOf(Sub.__fxstat) = undefined;
            pub var __fxstat64: *const @TypeOf(Sub.__fxstat64) = undefined;
            pub var __fxstatat: *const @TypeOf(Sub.__fxstatat) = undefined;
            pub var __fxstatat64: *const @TypeOf(Sub.__fxstatat64) = undefined;
            pub var __lxstat: *const @TypeOf(Sub.__lxstat) = undefined;
            pub var __lxstat64: *const @TypeOf(Sub.__lxstat64) = undefined;
            pub var __xstat: *const @TypeOf(Sub.__xstat) = undefined;
            pub var __xstat64: *const @TypeOf(Sub.__xstat64) = undefined;
            pub var access: *const @TypeOf(Sub.access) = undefined;
            pub var close: *const @TypeOf(Sub.close) = undefined;
            pub var closedir: *const @TypeOf(Sub.closedir) = undefined;
            pub var faccessat: *const @TypeOf(Sub.faccessat) = undefined;
            pub var fallocate: *const @TypeOf(Sub.fallocate) = undefined;
            pub var fcntl: *const @TypeOf(Sub.fcntl) = undefined;
            pub var fcntl64: *const @TypeOf(Sub.fcntl64) = undefined;
            pub var fdatasync: *const @TypeOf(Sub.fdatasync) = undefined;
            pub var flock: *const @TypeOf(Sub.flock) = undefined;
            pub var fstat: *const @TypeOf(Sub.fstat) = undefined;
            pub var fstat64: *const @TypeOf(Sub.fstat64) = undefined;
            pub var fstatat: *const @TypeOf(Sub.fstatat) = undefined;
            pub var fstatat64: *const @TypeOf(Sub.fstatat64) = undefined;
            pub var fsync: *const @TypeOf(Sub.fsync) = undefined;
            pub var futimes: *const @TypeOf(Sub.futimes) = undefined;
            pub var futimens: *const @TypeOf(Sub.futimens) = undefined;
            pub var futimesat: *const @TypeOf(Sub.futimesat) = undefined;
            pub var lseek: *const @TypeOf(Sub.lseek) = undefined;
            pub var lseek64: *const @TypeOf(Sub.lseek64) = undefined;
            pub var lstat: *const @TypeOf(Sub.lstat) = undefined;
            pub var lstat64: *const @TypeOf(Sub.lstat64) = undefined;
            pub var lutimes: *const @TypeOf(Sub.lutimes) = undefined;
            pub var mkdir: *const @TypeOf(Sub.mkdir) = undefined;
            pub var mkdirat: *const @TypeOf(Sub.mkdirat) = undefined;
            pub var open: *const @TypeOf(Sub.open) = undefined;
            pub var open64: *const @TypeOf(Sub.open64) = undefined;
            pub var openat: *const @TypeOf(Sub.openat) = undefined;
            pub var openat64: *const @TypeOf(Sub.openat64) = undefined;
            pub var opendir: *const @TypeOf(Sub.opendir) = undefined;
            pub var pread: *const @TypeOf(Sub.pread) = undefined;
            pub var pread64: *const @TypeOf(Sub.pread64) = undefined;
            pub var pwrite: *const @TypeOf(Sub.pwrite) = undefined;
            pub var pwrite64: *const @TypeOf(Sub.pwrite64) = undefined;
            pub var posix_fadvise: *const @TypeOf(Sub.posix_fadvise) = undefined;
            pub var pthread_create: *const @TypeOf(Sub.pthread_create) = undefined;
            pub var read: *const @TypeOf(Sub.read) = undefined;
            pub var readdir: *const @TypeOf(Sub.readdir) = undefined;
            pub var rewinddir: *const @TypeOf(Sub.rewinddir) = undefined;
            pub var rmdir: *const @TypeOf(Sub.rmdir) = undefined;
            pub var seekdir: *const @TypeOf(Sub.seekdir) = undefined;
            pub var stat: *const @TypeOf(Sub.stat) = undefined;
            pub var stat64: *const @TypeOf(Sub.stat64) = undefined;
            pub var telldir: *const @TypeOf(Sub.telldir) = undefined;
            pub var unlink: *const @TypeOf(Sub.unlink) = undefined;
            pub var unlinkat: *const @TypeOf(Sub.unlinkat) = undefined;
            pub var utimensat: *const @TypeOf(Sub.utimensat) = undefined;
            pub var utimes: *const @TypeOf(Sub.utimes) = undefined;
            pub var write: *const @TypeOf(Sub.write) = undefined;
        };
    };
}

const RedirectedDir = struct {
    sig: u64 = signature,
    fd: c_int = undefined,
    cookie: u64 = 0,
    data_next: usize = 0,
    data_len: usize = 0,
    dirent: dirent_h.struct_dirent = undefined,
    buffer: [4096]u8 = undefined,

    const dirent_h = @cImport({
        @cInclude("dirent.h");
    });

    pub const signature = 0x5249_4452_4147_495B;

    pub fn cast(s: *std.c.DIR) ?*@This() {
        if (!std.mem.isAligned(@intFromPtr(s), @alignOf(u64))) return null;
        const sig: *u64 = @ptrCast(@alignCast(s));
        return if (sig.* == signature) @ptrCast(sig) else null;
    }
};
comptime {
    if (@offsetOf(RedirectedDir, "sig") != 0) @compileError("Signature is not at offset 0");
}
const RedirectedFile = struct {
    sig: u64 = signature,
    fd: c_int,
    errno: c_int = 0,
    buffer: ?[]u8 = null,
    buf_start: usize = 0,
    buf_end: usize = 0,
    buf_mode: BufferMode = .read,
    flags: std.c.O,
    eof: bool = false,
    proxy: bool = false,

    pub const signature = 0x4C49_4652_4147_495A;
    pub const BufferMode = enum { read, write };
    pub var list = std.ArrayList(*@This()).init(c_allocator);

    pub fn cast(s: *std.c.FILE) ?*@This() {
        if (!std.mem.isAligned(@intFromPtr(s), @alignOf(u64))) return null;
        const sig: *u64 = @ptrCast(@alignCast(s));
        return if (sig.* == signature) @ptrCast(sig) else null;
    }

    pub fn consumeBuffer(self: *@This(), dest: ?[*]u8, desired_amount: usize) usize {
        const buf = self.buffer orelse return 0;
        const amount = @min(desired_amount, self.buf_end - self.buf_start);
        if (dest) |ptr| {
            @memcpy(ptr[0..amount], buf[self.buf_start .. self.buf_start + amount]);
        }
        self.buf_start += amount;
        return amount;
    }

    pub fn replenishBuffer(self: *@This(), src: ?[*]const u8, desired_amount: usize) usize {
        const buf = self.buffer orelse return 0;
        const amount = @min(desired_amount, buf.len - self.buf_end);
        if (src) |ptr| {
            @memcpy(buf[self.buf_end .. self.buf_end + amount], ptr[0..amount]);
        }
        self.buf_end += amount;
        return amount;
    }

    pub fn previewBuffer(self: *@This()) []u8 {
        var buf = self.buffer orelse return &.{};
        return buf[self.buf_start..self.buf_end];
    }

    pub fn prepareBuffer(self: *@This()) ![]u8 {
        errdefer self.errno = @intFromEnum(std.c.E.NOMEM);
        var buf = self.buffer orelse create: {
            self.buffer = try c_allocator.alloc(u8, 8192);
            break :create self.buffer.?;
        };
        const remaining = self.buf_end - self.buf_start;
        if (self.buf_start > 0) {
            // shift remaining data to the beginning of the buffer
            if (remaining > 0) {
                std.mem.copyBackwards(u8, buf[0..remaining], buf[self.buf_start..self.buf_end]);
            }
            self.buf_start = 0;
            self.buf_end = remaining;
        }
        if (self.buf_mode == .read) {
            const space = buf.len - self.buf_end;
            if (space < 1024) {
                // enlarge buffer
                buf = try c_allocator.realloc(buf, buf.len * 2);
                self.buffer = buf;
            }
        }
        return buf[self.buf_end..];
    }

    pub fn clearBuffer(self: *@This()) void {
        self.buf_start = 0;
        self.buf_end = 0;
    }

    pub fn unconsumeBuffer(self: *@This(), c: u8) !void {
        const buf = self.buffer orelse try self.prepareBuffer();
        if (self.buf_start > 0) {
            self.buf_start -= 1;
            buf[self.buf_start] = c;
        } else if (self.buf_end == self.buf_start) {
            buf[0] = c;
            self.buf_start = 0;
            self.buf_end = 1;
        } else {
            const len = self.buf_end - self.buf_start;
            std.mem.copyBackwards(u8, buf[1 .. 1 + len], buf[0..len]);
            self.buf_end += 1;
            buf[0] = c;
        }
    }

    pub fn freeBuffer(self: *@This()) void {
        if (self.buffer) |buf| c_allocator.free(buf);
    }
};
comptime {
    if (@offsetOf(RedirectedFile, "sig") != 0) @compileError("Signature is not at offset 0");
}

pub fn LibCSubstitute(comptime redirector: type) type {
    return struct {
        const posix = PosixSubstitute(redirector);

        pub fn clearerr(s: *std.c.FILE) callconv(.c) void {
            if (getRedirectedFile(s)) |file| {
                file.errno = 0;
                return;
            }
            return Original.clearerr(s);
        }

        pub fn getchar() callconv(.c) c_int {
            const stdin = getStdProxy(0);
            var buf: [1]u8 = undefined;
            if (read(stdin, &buf, 1) != 1) return -1;
            return buf[0];
        }

        pub fn gets_s(buf: [*]u8, len: usize) callconv(.c) ?[*:0]u8 {
            const stdin = getStdProxy(0);
            const end = bufferUntil(stdin, '\n');
            if (end == 0) return null;
            const used = stdin.consumeBuffer(buf, @max(end, len - 1));
            buf[used] = 0;
            return @ptrCast(buf);
        }

        pub fn fclose(s: *std.c.FILE) callconv(.c) c_int {
            if (getRedirectedFile(s)) |file| {
                if (flush(file) < 0) return -1;
                const result = posix.close(file.fd);
                removeRedirectedFile(file);
                return result;
            }
            return Original.fclose(s);
        }

        pub fn fdopen(fd: c_int, mode: [*:0]const u8) callconv(.c) ?*std.c.FILE {
            if (redirector.isApplicableHandle(fd)) {
                const oflags = decodeOpenMode(mode);
                return addRedirectedFile(fd, oflags) catch null;
            }
            return Original.fdopen(fd, mode);
        }

        pub fn feof(s: *std.c.FILE) callconv(.c) c_int {
            if (getRedirectedFile(s)) |file| {
                return if (file.eof) 1 else 0;
            }
            return Original.feof(s);
        }

        pub fn ferror(s: *std.c.FILE) callconv(.c) c_int {
            if (getRedirectedFile(s)) |file| {
                return file.errno;
            }
            return Original.ferror(s);
        }

        pub fn fflush(arg: ?*std.c.FILE) callconv(.c) c_int {
            if (arg) |s| {
                if (getRedirectedFile(s)) |file| {
                    return if (flush(file) < 0) -1 else 0;
                }
                return Original.ferror(s);
            } else {
                const stdin = getStdProxy(0);
                const stdout = getStdProxy(1);
                if (flush(stdin) < 0) return -1;
                if (flush(stdout) < 0) return -1;
                for (RedirectedFile.list.items) |file| {
                    if (flush(file) < 0) return -1;
                }
                return Original.fflush(null);
            }
        }

        const fpos_field_name = for (.{"pos"}) |substring| {
            const name: ?[:0]const u8 = for (std.meta.fields(stdio_h.fpos_t)) |field| {
                if (std.mem.containsAtLeast(u8, field.name, 1, substring)) break field.name;
            } else null;
            if (name) |n| break n;
        } else @compileError("Unable to find position field inside fpos_t");

        pub fn fgetpos(s: *std.c.FILE, pos: *stdio_h.fpos_t) callconv(.c) c_int {
            if (getRedirectedFile(s)) |file| {
                const result = posix.lseek64(file.fd, 0, std.c.SEEK.CUR);
                if (result < 0) {
                    file.errno = posix.getError();
                    return -1;
                }
                @field(pos, fpos_field_name) = result;
                return 0;
            }
            return Original.fgetpos(s, pos);
        }

        pub fn fgetc(s: *std.c.FILE) callconv(.c) c_int {
            if (getRedirectedFile(s)) |file| {
                var buf: [1]u8 = undefined;
                if (read(file, &buf, 1) != 1) return -1;
                return buf[0];
            }
            return Original.fgetc(s);
        }

        pub fn fgets(buf: [*]u8, num: c_int, s: *std.c.FILE) callconv(.c) ?[*:0]u8 {
            if (getRedirectedFile(s)) |file| {
                if (num < 0) {
                    _ = saveFileError(file, .INVAL);
                    return null;
                }
                const end = bufferUntil(file, '\n');
                if (end == 0) return null;
                const len: usize = @intCast(num - 1);
                const used = file.consumeBuffer(buf, @min(len, end));
                buf[used] = 0;
                return @ptrCast(buf);
            }
            return Original.fgets(buf, num, s);
        }

        pub fn fopen(path: [*:0]const u8, mode: [*:0]const u8) callconv(.c) ?*std.c.FILE {
            const oflags = decodeOpenMode(mode);
            const oflags_int: u32 = @bitCast(oflags);
            var fd: c_int = undefined;
            if (redirector.open(path, @intCast(oflags_int), 0, &fd)) {
                return addRedirectedFile(fd, oflags) catch close: {
                    var result: c_int = undefined;
                    _ = redirector.close(fd, &result);
                    break :close null;
                };
            }
            return Original.fopen(path, mode);
        }

        pub fn fputc(c: c_int, s: *std.c.FILE) callconv(.c) c_int {
            if (getRedirectedFile(s)) |file| {
                if (c < 0 or c > 255) {
                    file.errno = @intFromEnum(std.c.E.INVAL);
                    return -1;
                }
                const b: [1]u8 = .{@intCast(c)};
                return @intCast(write(file, &b, 1));
            }
            return Original.fputc(c, s);
        }

        pub fn fputs(text: [*:0]const u8, s: *std.c.FILE) callconv(.c) c_int {
            if (getRedirectedFile(s)) |file| {
                const len: isize = @intCast(std.mem.len(text));
                return @intCast(write(file, text, len));
            }
            return Original.fputs(text, s);
        }

        pub fn fread(buffer: [*]u8, size: usize, n: usize, s: *std.c.FILE) callconv(.c) usize {
            if (getRedirectedFile(s)) |file| {
                const len: isize = @intCast(size * n);
                const result = read(file, buffer, len);
                if (result < 0) return 0;
                if (result == 0) file.eof = true;
                return if (len == result) n else @as(usize, @intCast(result)) / size;
            }
            return Original.fread(buffer, size, n, s);
        }

        pub fn fseek(s: *std.c.FILE, offset: c_long, whence: c_int) callconv(.c) c_int {
            if (getRedirectedFile(s)) |file| {
                if (flush(file) < 0) return -1;
                const result = posix.lseek(file.fd, offset, whence);
                if (result < 0) return saveFileError(file, posix.getError());
                return @intCast(result);
            }
            return Original.fseek(s, offset, whence);
        }

        pub fn fsetpos(s: *std.c.FILE, pos: *const stdio_h.fpos_t) callconv(.c) c_int {
            if (getRedirectedFile(s)) |file| {
                if (flush(file) < 0) return -1;
                const offset = @field(pos, fpos_field_name);
                const result = posix.lseek64(file.fd, offset, std.c.SEEK.SET);
                if (result < 0) return saveFileError(file, posix.getError());
                return 0;
            }
            return Original.fsetpos(s, pos);
        }

        pub fn ftell(s: *std.c.FILE) callconv(.c) c_int {
            if (getRedirectedFile(s)) |file| {
                const result = posix.lseek(file.fd, 0, std.c.SEEK.CUR);
                if (result < 0) file.errno = posix.getError();
                return @intCast(result);
            }
            return Original.ftell(s);
        }

        pub fn fwrite(buffer: [*]const u8, size: usize, n: usize, s: *std.c.FILE) callconv(.c) usize {
            if (getRedirectedFile(s)) |file| {
                const len: isize = @intCast(size * n);
                const result = write(file, buffer, len);
                if (result < 0) {
                    file.errno = posix.getError();
                    return 0;
                }
                return if (len == result) n else @as(usize, @intCast(result)) / size;
            }
            return Original.fwrite(buffer, size, n, s);
        }

        pub fn perror(text: [*:0]const u8) callconv(.c) void {
            const msg = stdio_h.strerror(posix.getError());
            const stderr = getStdProxy(2);
            const strings: [4][*:0]const u8 = .{ text, ": ", msg, "\n" };
            for (strings) |s| {
                const len: isize = @intCast(std.mem.len(s));
                const result = write(stderr, s, len);
                if (result < 0) {
                    break;
                }
            }
        }

        pub fn putc(c: c_int, s: *std.c.FILE) callconv(.c) c_int {
            if (getRedirectedFile(s)) |file| {
                if (c < 0 or c > 255) {
                    file.errno = @intFromEnum(std.c.E.INVAL);
                    return -1;
                }
                const b: [1]u8 = .{@intCast(c)};
                return @intCast(write(file, &b, 1));
            }
            return Original.putc(c, s);
        }

        pub fn putchar(c: c_int) callconv(.c) c_int {
            const stdout = getStdProxy(1);
            if (c < 0 or c > 255) {
                stdout.errno = @intFromEnum(std.c.E.INVAL);
                return -1;
            }
            const b: [1]u8 = .{@intCast(c)};
            return @intCast(write(stdout, b[0..1].ptr, 1));
        }

        pub fn puts(text: [*:0]const u8) callconv(.c) c_int {
            const stdout = getStdProxy(1);
            const strings: [2][*:0]const u8 = .{
                text,
                "\n",
            };
            var total: isize = 0;
            for (strings) |s| {
                const len: isize = @intCast(std.mem.len(s));
                const result = write(stdout, s, len);
                if (result < 0) return @intCast(result);
                total += result;
            }
            return @intCast(total);
        }

        pub fn rewind(s: *std.c.FILE) callconv(.c) void {
            if (getRedirectedFile(s)) |file| {
                if (flush(file) < 0) return;
                const result = posix.lseek(file.fd, 0, std.c.SEEK.SET);
                if (result != 0) {
                    _ = saveFileError(file, posix.getError());
                    return;
                }
                file.errno = 0;
                file.eof = false;
                return;
            }
            return Original.rewind(s);
        }

        pub fn setbuf(s: *std.c.FILE, buffer: [*]u8) callconv(.c) void {
            if (getRedirectedFile(s)) |_| {
                return; // ignore call
            }
            return Original.setbuf(s, buffer);
        }

        pub fn setvbuf(s: *std.c.FILE, buffer: [*]u8, mode: c_int, size: usize) callconv(.c) void {
            if (getRedirectedFile(s)) |_| {
                return; // ignore call
            }
            return Original.setvbuf(s, buffer, mode, size);
        }

        pub fn ungetc(c: c_int, s: *std.c.FILE) callconv(.c) c_int {
            if (getRedirectedFile(s)) |file| {
                if (c < 0 or c > 255) return -1;
                file.unconsumeBuffer(@intCast(c)) catch return -1;
                return c;
            }
            return Original.ungetc(c, s);
        }

        // hooks implemented in C
        pub extern fn vfprintf_hook() callconv(.c) void;
        pub extern fn vprintf_hook() callconv(.c) void;
        pub extern fn fprintf_hook() callconv(.c) void;
        pub extern fn printf_hook() callconv(.c) void;
        pub extern fn vfscanf_hook() callconv(.c) void;
        pub extern fn vscanf_hook() callconv(.c) void;
        pub extern fn fscanf_hook() callconv(.c) void;
        pub extern fn scanf_hook() callconv(.c) void;
        pub extern fn vfprintf_s_hook() callconv(.c) void;
        pub extern fn vprintf_s_hook() callconv(.c) void;
        pub extern fn fprintf_s_hook() callconv(.c) void;
        pub extern fn printf_s_hook() callconv(.c) void;

        // function required by C hooks
        comptime {
            @export(&getRedirectedFile, .{ .name = "get_redirected_file", .visibility = .hidden });
            @export(&read, .{ .name = "redirected_read", .visibility = .hidden });
            @export(&write, .{ .name = "redirected_write", .visibility = .hidden });
            @export(&getLine, .{ .name = "get_line", .visibility = .hidden });
        }

        fn read(file: *RedirectedFile, dest: [*]u8, len: isize) callconv(.c) isize {
            const len_u: usize = @intCast(len);
            if (setBufferMode(file, .read) < 0) return -1;
            var copied = file.consumeBuffer(dest, len_u);
            if (len_u - copied >= 8192) {
                // read directly into the destination when the amount is large
                const result = readRaw(file, dest[copied..], @intCast(len_u - copied));
                if (result < 0) return -1;
                return @as(isize, @intCast(copied)) + result;
            } else {
                while (len_u - copied > 0) {
                    if (bufferMore(file) < 0) return -1;
                    const amount = file.consumeBuffer(dest[copied..], len_u - copied);
                    if (amount == 0) break;
                    copied += amount;
                }
                return @intCast(copied);
            }
        }

        fn readRaw(file: *RedirectedFile, dest: [*]u8, len: isize) callconv(.c) isize {
            const result = posix.read(file.fd, dest, len);
            if (result < 0) return saveFileError(file, posix.getError());
            return result;
        }

        fn write(file: *RedirectedFile, src: [*]const u8, len: isize) callconv(.c) isize {
            if (setBufferMode(file, .write) < 0) return -1;
            const len_u: usize = @intCast(len);
            if (len_u >= 8192 or file.fd == 2) {
                // don't bother buffering when the amount is large
                if (flush(file) < 0) return -1;
                return writeRaw(file, src, len);
            } else {
                _ = file.prepareBuffer() catch -1;
                var copied: usize = 0;
                while (true) {
                    copied += file.replenishBuffer(src[copied..], len_u - copied);
                    if (copied < len_u) {
                        if (flush(file) < 0) return -1;
                    } else {
                        break;
                    }
                }
                return len;
            }
        }

        fn writeRaw(file: *RedirectedFile, src: [*]const u8, len: isize) callconv(.c) isize {
            const result = posix.write(file.fd, src, len);
            if (result < 0) return saveFileError(file, posix.getError());
            return result;
        }

        fn setBufferMode(file: *RedirectedFile, mode: RedirectedFile.BufferMode) isize {
            if (file.buf_mode == mode) return 0;
            if (flush(file) < 0) return -1;
            file.buf_mode = mode;
            return 0;
        }

        fn flush(file: *RedirectedFile) isize {
            const content = file.previewBuffer();
            if (content.len == 0) return 0;
            const result: isize = switch (file.buf_mode) {
                .write => writeRaw(file, content.ptr, @intCast(content.len)),
                .read => @intCast(content.len),
            };
            file.clearBuffer();
            return result;
        }

        fn bufferUntil(file: *RedirectedFile, delimiter: u8) callconv(.c) usize {
            if (setBufferMode(file, .read) < 0) return 0;
            var checked_len: usize = 0;
            while (true) {
                // look for delimiter
                const content = file.previewBuffer();
                for (checked_len..content.len) |i| {
                    if (content[i] == delimiter) {
                        return i + 1;
                    }
                } else if (file.eof) {
                    return content.len;
                } else {
                    checked_len = content.len;
                    // retrieve more data
                    if (bufferMore(file) < 0) return 0;
                }
            }
        }

        fn bufferMore(file: *RedirectedFile) callconv(.c) isize {
            if (setBufferMode(file, .read) < 0) return -1;
            // first try to get one character in blocking mode
            const buf = file.prepareBuffer() catch return 0;
            const result1 = readRaw(file, buf.ptr, 1);
            var len: usize = 0;
            if (result1 < 0) return -1;
            if (result1 > 0) {
                _ = file.replenishBuffer(null, 1);
                len += 1;
                // switch into non-blocking mode and read the rest of the available bytes
                const in_non_blocking_mode = setNonBlocking(file, true) != 0;
                defer if (in_non_blocking_mode) {
                    _ = setNonBlocking(file, false);
                };
                const buf2 = buf[1..];
                const result2 = readRaw(file, buf2.ptr, @intCast(buf2.len));
                if (result2 < 0) return -1;
                _ = file.replenishBuffer(null, @intCast(result2));
                len += @intCast(result2);
            } else {
                file.eof = true;
            }
            return @intCast(len);
        }

        fn getLine(file: *RedirectedFile) callconv(.c) ?[*:0]u8 {
            const end = bufferUntil(file, '\n');
            if (end == 0) return null;
            var buf = file.previewBuffer();
            _ = file.consumeBuffer(null, end);
            if (end == buf.len) {
                // end of file
                buf.len += 1;
                buf[end] = 0;
            } else {
                buf[end - 1] = 0;
            }
            return @ptrCast(buf.ptr);
        }

        fn setNonBlocking(file: *RedirectedFile, nonblocking: bool) callconv(.c) c_int {
            const oflags: std.c.O = .{ .NONBLOCK = nonblocking };
            const oflags_int: @typeInfo(std.c.O).@"struct".backing_integer.? = @bitCast(oflags);
            if (posix.fcntl(file.fd, std.c.F.SETFL, oflags_int) != 0) {
                return saveFileError(file, posix.getError());
            }
            return 0;
        }

        fn addRedirectedFile(fd: c_int, oflags: std.c.O) !*std.c.FILE {
            if (fd <= 0) return error.InvalidFileDescriptor;
            const file = try c_allocator.create(RedirectedFile);
            errdefer c_allocator.destroy(file);
            file.* = .{
                .fd = fd,
                .flags = oflags,
            };
            try RedirectedFile.list.append(file);
            return @ptrCast(file);
        }

        fn removeRedirectedFile(file: *RedirectedFile) void {
            file.freeBuffer();
            if (!file.proxy) {
                for (RedirectedFile.list.items, 0..) |item, i| {
                    if (item == file) {
                        _ = RedirectedFile.list.orderedRemove(i);
                        break;
                    }
                }
                c_allocator.destroy(file);
            }
        }

        fn getRedirectedFile(s: *std.c.FILE) callconv(.c) ?*RedirectedFile {
            const sc: *stdio_h.FILE = @ptrCast(@alignCast(s));
            return RedirectedFile.cast(s) orelse findStdProxy(stdio_h.fileno(sc));
        }

        fn findStdProxy(fd: c_int) callconv(.c) ?*RedirectedFile {
            if (fd < 0 or fd > 2) return null;
            return getStdProxy(fd);
        }

        fn getStdProxy(fd: c_int) callconv(.c) *RedirectedFile {
            const index: usize = @intCast(fd);
            const file = &std_proxies[index];
            return file;
        }

        fn saveFileError(file: *RedirectedFile, err: anytype) c_int {
            const T = @TypeOf(err);
            switch (@typeInfo(T)) {
                .int => file.errno = err,
                .@"enum" => file.errno = @intFromEnum(err),
                .enum_literal => {
                    const err_enum = @as(std.c.E, err);
                    file.errno = @intFromEnum(err_enum);
                },
                else => @compileError("Unexpected"),
            }
            return -1;
        }

        fn decodeOpenMode(mode: [*:0]const u8) std.c.O {
            var oflags: std.c.O = .{};
            if (mode[0] == 'r') {
                oflags.ACCMODE = if (mode[1] == '+') .RDWR else .RDONLY;
            } else if (mode[0] == 'w') {
                oflags.ACCMODE = if (mode[1] == '+') .RDWR else .WRONLY;
                oflags.CREAT = true;
                oflags.TRUNC = true;
            } else if (mode[0] == 'a') {
                oflags.ACCMODE = if (mode[1] == '+') .RDWR else .WRONLY;
                oflags.CREAT = true;
                oflags.APPEND = true;
            }
            return oflags;
        }

        var std_proxies: [3]RedirectedFile = .{
            .{ .fd = 0, .proxy = true, .flags = .{ .ACCMODE = .RDONLY } },
            .{ .fd = 1, .proxy = true, .flags = .{ .ACCMODE = .WRONLY } },
            .{ .fd = 2, .proxy = true, .flags = .{ .ACCMODE = .WRONLY } },
        };

        const stdio_h = @cImport({
            @cInclude("stdio.h");
            @cInclude("string.h");
        });

        const Self = @This();
        pub const Original = struct {
            pub var clearerr: *const @TypeOf(Self.clearerr) = undefined;
            pub var getchar: *const @TypeOf(Self.getchar) = undefined;
            pub var gets_s: *const @TypeOf(Self.gets_s) = undefined;
            pub var fclose: *const @TypeOf(Self.fclose) = undefined;
            pub var fdopen: *const @TypeOf(Self.fdopen) = undefined;
            pub var feof: *const @TypeOf(Self.feof) = undefined;
            pub var ferror: *const @TypeOf(Self.ferror) = undefined;
            pub var fflush: *const @TypeOf(Self.fflush) = undefined;
            pub var fgetc: *const @TypeOf(Self.fgetc) = undefined;
            pub var fgetpos: *const @TypeOf(Self.fgetpos) = undefined;
            pub var fgets: *const @TypeOf(Self.fgets) = undefined;
            pub var fopen: *const @TypeOf(Self.fopen) = undefined;
            pub var fputc: *const @TypeOf(Self.fputc) = undefined;
            pub var fputs: *const @TypeOf(Self.fputs) = undefined;
            pub var fread: *const @TypeOf(Self.fread) = undefined;
            pub var fseek: *const @TypeOf(Self.fseek) = undefined;
            pub var fsetpos: *const @TypeOf(Self.fsetpos) = undefined;
            pub var ftell: *const @TypeOf(Self.ftell) = undefined;
            pub var fwrite: *const @TypeOf(Self.fwrite) = undefined;
            pub var perror: *const @TypeOf(Self.perror) = undefined;
            pub var putc: *const @TypeOf(Self.putc) = undefined;
            pub var putchar: *const @TypeOf(Self.putchar) = undefined;
            pub var puts: *const @TypeOf(Self.puts) = undefined;
            pub var rewind: *const @TypeOf(Self.rewind) = undefined;
            pub var setbuf: *const @TypeOf(Self.setbuf) = undefined;
            pub var setvbuf: *const @TypeOf(Self.setvbuf) = undefined;
            pub var ungetc: *const @TypeOf(Self.ungetc) = undefined;

            pub extern var vfprintf_orig: *const @TypeOf(Self.vfprintf_hook);
            pub extern var vprintf_orig: *const @TypeOf(Self.vprintf_hook);
            pub extern var fprintf_orig: *const @TypeOf(Self.fprintf_hook);
            pub extern var printf_orig: *const @TypeOf(Self.printf_hook);
            pub extern var vfscanf_orig: *const @TypeOf(Self.vfscanf_hook);
            pub extern var vscanf_orig: *const @TypeOf(Self.vscanf_hook);
            pub extern var fscanf_orig: *const @TypeOf(Self.fscanf_hook);
            pub extern var scanf_orig: *const @TypeOf(Self.scanf_hook);
            pub extern var vfprintf_s_orig: *const @TypeOf(Self.vfprintf_s_hook);
            pub extern var vprintf_s_orig: *const @TypeOf(Self.vprintf_s_hook);
            pub extern var fprintf_s_orig: *const @TypeOf(Self.fprintf_s_hook);
            pub extern var printf_s_orig: *const @TypeOf(Self.printf_s_hook);
        };
    };
}

pub fn GNUSubstitute(comptime redirector: type) type {
    return struct {
        const libc = LibCSubstitute(redirector);

        // hooks implemented in C
        pub extern fn __vfprintf_chk_hook() callconv(.c) void;
        pub extern fn __vprintf_chk_hook() callconv(.c) void;
        pub extern fn __fprintf_chk_hook() callconv(.c) void;
        pub extern fn __printf_chk_hook() callconv(.c) void;
        pub extern fn __isoc99_vfscanf_hook() callconv(.c) void;
        pub extern fn __isoc99_vscanf_hook() callconv(.c) void;
        pub extern fn __isoc99_fscanf_hook() callconv(.c) void;
        pub extern fn __isoc99_scanf_hook() callconv(.c) void;

        const Self = @This();
        pub const Original = struct {
            pub extern var __vfprintf_chk_orig: *const @TypeOf(Self.__vfprintf_chk_hook);
            pub extern var __vprintf_chk_orig: *const @TypeOf(Self.__vprintf_chk_hook);
            pub extern var __fprintf_chk_orig: *const @TypeOf(Self.__fprintf_chk_hook);
            pub extern var __printf_chk_orig: *const @TypeOf(Self.__printf_chk_hook);
            pub extern var __isoc99_vfscanf_orig: *const @TypeOf(Self.__isoc99_vfscanf_hook);
            pub extern var __isoc99_vscanf_orig: *const @TypeOf(Self.__isoc99_vscanf_hook);
            pub extern var __isoc99_fscanf_orig: *const @TypeOf(Self.__isoc99_fscanf_hook);
            pub extern var __isoc99_scanf_orig: *const @TypeOf(Self.__isoc99_scanf_hook);
        };
    };
}

pub fn Win32SubstituteS(comptime redirector: type) type {
    _ = redirector;
    return struct {
        pub fn WriteFile(handle: HANDLE, buffer: LPCVOID, len: DWORD, written: *DWORD, overlapped: *OVERLAPPED) callconv(.c) c_int {
            // if (is_applicable_handle(handle)) {
            //     if (redirect_write(handle, buffer, len)) {
            //         *written = len;
            //         if (overlapped) {
            //             SetEvent(overlapped->hEvent);
            //         }
            //         return TRUE;
            //     }
            // }
            // return write_file_orig(handle, buffer, len, written, overlapped);
            return Original.WriteFile(handle, buffer, len, written, overlapped);
        }

        const DWORD = std.os.windows.DWORD;
        const HANDLE = std.os.windows.HANDLE;
        const LPCVOID = std.os.windows.LPCVOID;
        const OVERLAPPED = std.os.windows.OVERLAPPED;

        const Self = @This();
        pub const Original = struct {
            pub var WriteFile: *const @TypeOf(Self.WriteFile) = undefined;
        };
    };
}

pub const HandlerVTable = init: {
    const redirector = SyscallRedirector(void);
    const len = count: {
        var count: usize = 0;
        for (std.meta.declarations(redirector)) |decl| {
            const DT = @TypeOf(@field(redirector, decl.name));
            if (@typeInfo(DT) == .@"fn") count += 1;
        }
        break :count count;
    };
    var fields: [len]std.builtin.Type.StructField = undefined;
    var index: usize = 0;
    for (std.meta.declarations(redirector)) |decl| {
        const DT = @TypeOf(@field(redirector, decl.name));
        if (@typeInfo(DT) == .@"fn") {
            fields[index] = .{
                .name = decl.name,
                .type = *const DT,
                .default_value_ptr = null,
                .is_comptime = false,
                .alignment = @alignOf(DT),
            };
            index += 1;
        }
    }
    break :init @Type(.{
        .@"struct" = .{
            .layout = .@"extern",
            .fields = &fields,
            .decls = &.{},
            .is_tuple = false,
        },
    });
};

pub fn getHandlerVtable(comptime Host: type) HandlerVTable {
    var vtable: HandlerVTable = undefined;
    const redirector = SyscallRedirector(Host);
    inline for (std.meta.declarations(redirector)) |decl| {
        const DT = @TypeOf(@field(redirector, decl.name));
        if (@typeInfo(DT) == .@"fn") {
            @field(vtable, decl.name) = &@field(redirector, decl.name);
        }
    }
    return vtable;
}

pub fn getHookTable(comptime Host: type) std.StaticStringMap(Entry) {
    const redirector = SyscallRedirector(Host);
    const list = switch (builtin.target.os.tag) {
        .linux => .{
            PosixSubstitute(redirector),
            LibCSubstitute(redirector),
            GNUSubstitute(redirector),
        },
        else => .{},
    };
    const len = init: {
        var total: usize = 1;
        inline for (list) |Sub| {
            const decls = std.meta.declarations(Sub.Original);
            total += decls.len;
        }
        break :init total;
    };
    var table: [len]std.meta.Tuple(&.{ []const u8, Entry }) = undefined;
    // make vtable available through the hook table
    table[0] = .{ "__syscall", .{
        .handler = &getHandlerVtable(Host),
        .original = undefined,
    } };
    var index: usize = 1;
    inline for (list) |Sub| {
        const decls = std.meta.declarations(Sub.Original);
        inline for (decls) |decl| {
            const w_suffix = std.mem.endsWith(u8, decl.name, "_orig");
            const name = if (w_suffix) decl.name[0 .. decl.name.len - 5] else decl.name;
            const handler_name = if (w_suffix) name ++ "_hook" else name;
            const HandlerType = @TypeOf(@field(Sub, handler_name));
            if (!std.meta.eql(@typeInfo(HandlerType).@"fn".calling_convention, std.builtin.CallingConvention.c)) {
                @compileError("Handler with wrong calling convention: " ++ handler_name);
            }
            table[index] = .{ name, .{
                .handler = &@field(Sub, handler_name),
                .original = &@field(Sub.Original, decl.name),
            } };
            index += 1;
        }
    }
    return std.StaticStringMap(Entry).initComptime(table);
}

fn intFromError(err: std.c.E) c_int {
    const value: c_int = @intFromEnum(err);
    return -value;
}
