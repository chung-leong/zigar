const std = @import("std");
const c_allocator = std.heap.c_allocator;
const POLL = std.c.POLL;
const pollfd = std.c.pollfd;
const nfds_t = std.c.nfds_t;
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
    syscall: bool = false,
};
pub const Syscall = extern struct {
    cmd: Command,
    u: extern union {
        advise: extern struct {
            fd: i32,
            offset: u64,
            len: u64,
            advice: std.os.wasi.advice_t,
        },
        allocate: extern struct {
            fd: i32,
            mode: i32,
            offset: u64,
            len: u64,
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
            lock: Lock,
        },
        fstat: extern struct {
            fd: i32,
            stat: Filestat = undefined,
        },
        futimes: extern struct {
            fd: i32,
            atime: i64,
            mtime: i64,
            time_flags: std.os.wasi.fstflags_t = .{ .ATIM = true, .MTIM = true },
        },
        getdents: extern struct {
            dirfd: i32,
            buffer: [*]u8,
            len: u32,
            read: u32 = undefined,
        },
        mkdir: extern struct {
            dirfd: i32,
            path: [*:0]const u8,
        },
        open: extern struct {
            dirfd: i32,
            path: [*:0]const u8,
            lookup_flags: std.os.wasi.lookupflags_t,
            descriptor_flags: std.os.wasi.fdflags_t,
            open_flags: std.os.wasi.oflags_t,
            rights: std.os.wasi.rights_t,
            fd: i32 = undefined,
        },
        poll: extern struct {
            subscriptions: [*]std.os.wasi.subscription_t,
            subscription_count: u32,
            events: [*]std.os.wasi.event_t,
            event_count: u32 = undefined,
        },
        pread: extern struct {
            fd: i32,
            bytes: [*]const u8,
            len: u32,
            offset: u64,
            read: u32 = undefined,
        },
        preadv: extern struct {
            fd: i32,
            iovs: [*]const std.os.wasi.iovec_t,
            count: u32,
            offset: u64,
            read: u32 = undefined,
        },
        pwrite: extern struct {
            fd: i32,
            bytes: [*]const u8,
            len: u32,
            offset: u64,
            written: u32 = undefined,
        },
        pwritev: extern struct {
            fd: i32,
            iovs: [*]const std.os.wasi.iovec_t,
            count: u32,
            offset: u64,
            written: u32 = undefined,
        },
        read: extern struct {
            fd: i32,
            bytes: [*]const u8,
            len: u32,
            read: u32 = undefined,
        },
        readv: extern struct {
            fd: i32,
            iovs: [*]const std.os.wasi.iovec_t,
            count: u32,
            read: u32 = undefined,
        },
        rmdir: extern struct {
            dirfd: i32,
            path: [*:0]const u8,
        },
        seek: extern struct {
            fd: i32,
            offset: i64,
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
            lock: Lock,
        },
        stat: extern struct {
            dirfd: i32,
            path: [*:0]const u8,
            lookup_flags: std.os.wasi.lookupflags_t,
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
            lookup_flags: std.os.wasi.lookupflags_t,
            time_flags: std.os.wasi.fstflags_t = .{ .ATIM = true, .MTIM = true },
            atime: i64,
            mtime: i64,
        },
        write: extern struct {
            fd: i32,
            bytes: [*]const u8,
            len: u32,
            written: u32 = undefined,
        },
        writev: extern struct {
            fd: i32,
            iovs: [*]const std.os.wasi.iovec_t,
            count: u32,
            written: u32 = undefined,
        },
    },
    futex_handle: usize = 0,

    pub const Command = enum(c_int) {
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
        poll,
        pread,
        preadv,
        pwrite,
        pwritev,
        read,
        readv,
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
        writev,
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
    pub const Lock = extern struct {
        type: i16,
        whence: i16,
        pid: i32,
        start: i64,
        len: u64,

        pub const RDLCK = 0;
        pub const WRLCK = 1;
        pub const UNLCK = 2;
    };
    pub const Fdstat = std.os.wasi.fdstat_t;
    pub const Filestat = std.os.wasi.filestat_t;
    pub const Fdflags = std.os.wasi.fdflags_t;
};
const ThreadInfo = struct {
    proc: *const anyopaque,
    arg: ?*anyopaque,
    instance: *anyopaque,
};
const ssize_t = c_long;
const off_t = c_long;
const off64_t = i64;
const Dirent = switch (os) {
    .windows => extern struct {
        ino: c_long,
        reclen: c_ushort,
        namlen: c_ushort,
        name: [260]u8,
    },
    .linux => std.c.dirent64, // as std.os.linux.dirent64 in 64-bit OS
    else => std.c.dirent,
};
const Dirent64 = switch (os) {
    .windows => Dirent,
    .linux => std.os.linux.dirent64,
    else => std.c.dirent,
};
const Stat = switch (os) {
    .windows => extern struct {
        dev: c_uint,
        ino: c_ushort,
        mode: c_ushort,
        nlink: c_ushort,
        uid: c_short,
        gid: c_short,
        rdev: c_uint,
        size: c_long,
        atime: c_longlong,
        mtime: c_longlong,
        ctime: c_longlong,
    },
    else => std.c.Stat,
};
const Stat64 = switch (os) {
    .windows => extern struct {
        dev: c_uint,
        ino: c_ushort,
        mode: c_ushort,
        nlink: c_ushort,
        uid: c_short,
        gid: c_short,
        rdev: c_uint,
        size: c_longlong,
        atime: c_longlong,
        mtime: c_longlong,
        ctime: c_longlong,
    },
    else => std.c.Stat,
};
const StatFs = switch (os) {
    .linux, .windows => extern struct {
        type: c_long,
        bsize: c_long,
        blocks: c_ulong,
        bfree: c_ulong,
        bavail: c_ulong,
        files: c_ulong,
        ffree: c_ulong,
        fsid: [2]i32,
        namelen: usize,
        frsize: usize,
        flags: usize,
        spare: [4]u8,
    },
    else => StatFs64,
};
const StatFs64 = switch (os) {
    .linux, .windows => extern struct {
        type: c_long,
        bsize: c_long,
        blocks: u64,
        bfree: u64,
        bavail: u64,
        files: u64,
        ffree: u64,
        fsid: [2]i32,
        namelen: usize,
        frsize: usize,
        flags: usize,
        spare: [4]u8,
    },
    .darwin => extern struct {
        bsize: u32,
        iosize: i32,
        blocks: u64,
        bfree: u64,
        bavail: u64,
        files: u64,
        ffree: i64,
        fsid: [2]i32,
        owner: u32,
        type: u32,
        flags: u32,
        fssubtype: u32,
        fstypename: [mfsyuprnamelen]u8,
        mntfromname: [maxpathlen]u8,
        mntonname: [maxpathlen]u8,
        flags_ext: u32,
        reserved: [7]u32,

        pub const mfsyuprnamelen = 15;
        pub const maxpathlen = 1024;
    },
    else => @compileError("Unsupported platform"),
};
const Flock = switch (os) {
    .windows => std.os.linux.Flock,
    else => std.c.Flock,
};
const AT = switch (os) {
    .windows => std.os.linux.AT,
    else => std.c.AT,
};
const DT = switch (os) {
    .windows => std.os.linux.DT,
    else => std.c.DT,
};
const F = switch (os) {
    .windows => std.os.linux.F,
    else => std.c.F,
};
const O = switch (os) {
    .windows => packed struct(u32) {
        ACCMODE: std.posix.ACCMODE = .RDONLY,
        _2: u2 = 0,
        RANDOM: bool = false,
        SEQUENTIAL: bool = false,
        TEMPORARY: bool = false,
        NOINHERIT: bool = false,
        CREAT: bool = false,
        TRUNC: bool = false,
        EXCL: bool = false,
        _3: u3 = 0,
        TEXT: bool = false,
        BINARY: bool = false,
        DIRECTORY: bool = false, // custom flags to match *nix
        APPEND: bool = false,
        SYNC: bool = false,
        DSYNC: bool = false,
        NONBLOCK: bool = false,
        NOFOLLOW: bool = false,
        _: u10 = 0,
    },
    else => std.c.O,
};
const S = switch (os) {
    .windows => struct {
        pub const IFMT = 0xf000;
        pub const IFDIR = 0x4000;
        pub const IFCHR = 0x2000;
        pub const IFREG = 0x8000;
        pub const IREAD = 0x0100;
        pub const IWRITE = 0x0080;
        pub const IEXEC = 0x0040;
        pub const IFIFO = 0x1000;
        pub const IFBLK = 0x3000;
        pub const IRWXU = 0x01c0;
        pub const IXUSR = 0x0040;
        pub const IWUSR = 0x0080;
        pub const IRUSR = 0x0100;
        pub const IRGRP = 0x0020;
        pub const IWGRP = 0x0010;
        pub const IXGRP = 0x0008;
        pub const IRWXG = 0x0038;
        pub const IROTH = 0x0004;
        pub const IWOTH = 0x0002;
        pub const IXOTH = 0x0001;
        pub const IRWXO = 0x0007;
    },
    else => std.c.S,
};
const fd_cwd = AT.FDCWD;
const fd_root = -1;
const fd_min = 0xfffff;

pub fn SyscallRedirector(comptime ModuleHost: type) type {
    return struct {
        pub fn access(path: [*:0]const u8, mode: c_int, result: *c_int) callconv(.c) bool {
            return faccessat(fd_cwd, path, mode, result);
        }

        pub fn close(fd: c_int, result: *c_int) callconv(.c) bool {
            if (isPrivateDescriptor(fd)) {
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
            if (isPrivateDescriptor(dirfd) or (dirfd == fd_cwd and Host.isRedirecting(.stat))) {
                var resolver = PathResolver.init(dirfd, path) catch {
                    result.* = intFromError(.NOMEM);
                    return true;
                };
                defer resolver.deinit();
                var call: Syscall = .{ .cmd = .stat, .u = .{
                    .stat = .{
                        .dirfd = resolver.dirfd,
                        .path = resolver.path,
                        .lookup_flags = convertLookupFlags(flags),
                    },
                } };
                const err = Host.redirectSyscall(&call);
                if (err == .SUCCESS) {
                    const implied_mode: c_int = switch (call.u.stat.stat.filetype) {
                        .DIRECTORY => std.c.X_OK | std.c.R_OK | std.c.W_OK,
                        else => std.c.R_OK | std.c.W_OK,
                    };
                    result.* = if ((mode & implied_mode) == mode) 0 else intFromError(.ACCES);
                    return true;
                } else if (err != .OPNOTSUPP or isPrivateDescriptor(dirfd)) {
                    result.* = intFromError(err);
                    return true;
                }
            }
            return false;
        }

        pub fn fadvise64(fd: c_int, offset: off64_t, len: off64_t, advice: c_int, result: *c_int) callconv(.c) bool {
            if (isPrivateDescriptor(fd)) {
                var call: Syscall = .{ .cmd = .advise, .u = .{
                    .advise = .{
                        .fd = @intCast(fd),
                        .offset = @intCast(offset),
                        .len = @intCast(len),
                        .advice = switch (advice) {
                            0 => .NORMAL,
                            1 => .RANDOM,
                            2 => .SEQUENTIAL,
                            3 => .WILLNEED,
                            4 => .DONTNEED,
                            5 => .NOREUSE,
                            else => .NORMAL,
                        },
                    },
                } };
                const err = Host.redirectSyscall(&call);
                result.* = intFromError(err);
                return true;
            }
            return false;
        }

        pub fn fallocate(fd: c_int, mode: c_int, offset: off_t, len: off_t, result: *c_int) callconv(.c) bool {
            if (isPrivateDescriptor(fd)) {
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
            // don't think we're handling cases where there's a difference between 32-bit and 64-bit
            return fcntl64(fd, op, arg, result);
        }

        pub fn fcntl64(fd: c_int, op: c_int, arg: usize, result: *c_int) callconv(.c) bool {
            if (isPrivateDescriptor(fd)) {
                switch (op) {
                    F.GETFL => {
                        var call: Syscall = .{ .cmd = .getfl, .u = .{
                            .getfl = .{
                                .fd = @intCast(fd),
                            },
                        } };
                        const err = Host.redirectSyscall(&call);
                        if (err == .SUCCESS) {
                            const fdstat = call.u.getfl.fdstat;
                            var oflags: O = .{};
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
                            const oflags_int: @typeInfo(O).@"struct".backing_integer.? = @bitCast(oflags);
                            result.* = @intCast(oflags_int);
                        } else {
                            result.* = intFromError(err);
                        }
                    },
                    F.SETFL => {
                        const oflags_int: @typeInfo(O).@"struct".backing_integer.? = @truncate(arg);
                        const oflags: O = @bitCast(oflags_int);
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
                    F.SETLK, F.SETLKW => {
                        const lock: *const Flock = @ptrFromInt(arg);
                        var call: Syscall = .{ .cmd = .setlk, .u = .{
                            .setlk = .{
                                .fd = @intCast(fd),
                                .wait = op == F.SETLKW,
                                .lock = .{
                                    .type = switch (lock.type) {
                                        F.RDLCK => Syscall.Lock.RDLCK,
                                        F.WRLCK => Syscall.Lock.WRLCK,
                                        F.UNLCK => Syscall.Lock.UNLCK,
                                        else => 0,
                                    },
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
                    F.GETLK => {
                        const lock: *Flock = @ptrFromInt(arg);
                        var call: Syscall = .{ .cmd = .getlk, .u = .{
                            .getlk = .{
                                .fd = @intCast(fd),
                                .lock = .{
                                    .type = lock.type,
                                    .whence = lock.whence,
                                    .start = @intCast(lock.start),
                                    .len = @intCast(lock.len),
                                    .pid = @intCast(lock.pid),
                                },
                            },
                        } };
                        const err = Host.redirectSyscall(&call);
                        lock.type = call.u.getlk.lock.type;
                        lock.whence = call.u.getlk.lock.whence;
                        lock.start = @intCast(call.u.getlk.lock.start);
                        lock.len = @intCast(call.u.getlk.lock.len);
                        lock.pid = @intCast(call.u.getlk.lock.pid);
                        result.* = intFromError(err);
                    },
                    else => result.* = intFromError(.INVAL),
                }
                return true;
            }
            return false;
        }

        pub fn fdatasync(fd: c_int, result: *c_int) callconv(.c) bool {
            if (isPrivateDescriptor(fd)) {
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
            if (isPrivateDescriptor(fd)) {
                var lock: Flock = undefined;
                lock.type = switch (op & ~@as(c_int, std.c.LOCK.NB)) {
                    std.c.LOCK.SH => F.RDLCK,
                    std.c.LOCK.EX => F.WRLCK,
                    std.c.LOCK.UN => F.UNLCK,
                    else => {
                        result.* = intFromError(std.c.E.INVAL);
                        return true;
                    },
                };
                lock.whence = std.c.SEEK.SET;
                lock.start = 0;
                lock.len = 0;
                lock.pid = 0;
                const fcntl_op: c_int = switch (op & std.c.LOCK.NB) {
                    0 => F.SETLKW,
                    else => F.SETLK,
                };
                return fcntl(fd, fcntl_op, @intFromPtr(&lock), result);
            }
            return false;
        }

        pub fn fstat(fd: c_int, buf: *Stat, result: *c_int) callconv(.c) bool {
            return fstatT(Stat, fd, buf, result);
        }

        pub fn fstat64(fd: c_int, buf: *Stat64, result: *c_int) callconv(.c) bool {
            return fstatT(Stat64, fd, buf, result);
        }

        fn fstatT(comptime T: type, fd: c_int, buf: *T, result: *c_int) bool {
            if (isPrivateDescriptor(fd)) {
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

        pub fn fstatat(dirfd: c_int, path: [*:0]const u8, buf: *Stat, flags: c_int, result: *c_int) callconv(.c) bool {
            return fstatatT(Stat, dirfd, path, buf, flags, result);
        }

        pub fn fstatat64(dirfd: c_int, path: [*:0]const u8, buf: *Stat64, flags: c_int, result: *c_int) callconv(.c) bool {
            return fstatatT(Stat64, dirfd, path, buf, flags, result);
        }

        fn fstatatT(comptime T: type, dirfd: c_int, path: [*:0]const u8, buf: *T, flags: c_int, result: *c_int) bool {
            if (isPrivateDescriptor(dirfd) or (dirfd == fd_cwd and Host.isRedirecting(.stat))) {
                var resolver = PathResolver.init(dirfd, path) catch {
                    result.* = intFromError(.NOMEM);
                    return true;
                };
                defer resolver.deinit();
                var call: Syscall = .{ .cmd = .stat, .u = .{
                    .stat = .{
                        .dirfd = resolver.dirfd,
                        .path = resolver.path,
                        .lookup_flags = convertLookupFlags(flags),
                    },
                } };
                const err = Host.redirectSyscall(&call);
                if (err == .SUCCESS) copyStat(buf, &call.u.stat.stat);
                if (err != .OPNOTSUPP or isPrivateDescriptor(dirfd)) {
                    result.* = intFromError(err);
                    return true;
                }
            }
            return false;
        }

        pub fn fstatfs(fd: c_int, buf: *StatFs, result: *c_int) callconv(.c) bool {
            return fstatfsT(StatFs, fd, buf, result);
        }

        pub fn fstatfs64(fd: c_int, buf: *StatFs64, result: *c_int) callconv(.c) bool {
            return fstatfsT(StatFs64, fd, buf, result);
        }

        fn fstatfsT(comptime T: type, fd: c_int, buf: *T, result: *c_int) bool {
            if (isPrivateDescriptor(fd)) {
                buf.* = std.mem.zeroes(T);
                buf.blocks = 1_000_000;
                buf.bavail = 1_000_000;
                buf.bfree = 1_000_000;
                buf.ffree = 1_000_000;
                buf.bsize = 8192;
                switch (os) {
                    .linux => {
                        buf.type = 0x01021994; // tmpfs
                    },
                    .darwin => {
                        buf.iosize = @intCast(buf.bsize);
                        @memcpy(buf.fstypename[0..5], "tmpfs");
                    },
                    else => {},
                }
                result.* = 0;
                return true;
            }
            return false;
        }

        pub fn fsync(fd: c_int, result: *c_int) callconv(.c) bool {
            if (isPrivateDescriptor(fd)) {
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
            if (isPrivateDescriptor(fd)) {
                var call: Syscall = .{ .cmd = .futimes, .u = .{
                    .futimes = .{
                        .fd = @intCast(fd),
                        .atime = getNanoseconds(times[0]),
                        .mtime = getNanoseconds(times[1]),
                    },
                } };
                const err = Host.redirectSyscall(&call);
                result.* = intFromError(err);
                return true;
            }
            return false;
        }

        pub fn futimes(fd: c_int, tv: [*]const std.c.timeval, result: *c_int) callconv(.c) bool {
            if (isPrivateDescriptor(fd)) {
                const times = convertTimeval(tv);
                return futimens(fd, &times, result);
            }
            return false;
        }

        pub fn futimesat(dirfd: c_int, path: [*:0]const u8, tv: [*]const std.c.timeval, result: *c_int) callconv(.c) bool {
            if (isPrivateDescriptor(dirfd) or (dirfd == fd_cwd and Host.isRedirecting(.set_times))) {
                const times = convertTimeval(tv);
                return utimensat(dirfd, path, &times, AT.SYMLINK_FOLLOW, result);
            }
            return false;
        }

        pub fn getdents(dirfd: c_int, buffer: [*]u8, len: c_uint, result: *c_int) callconv(.c) bool {
            return getdentsT(Dirent, dirfd, buffer, len, result);
        }

        pub fn getdents64(dirfd: c_int, buffer: [*]u8, len: c_uint, result: *c_int) callconv(.c) bool {
            return getdentsT(Dirent64, dirfd, buffer, len, result);
        }

        fn getdentsT(comptime T: type, dirfd: c_int, buffer: [*]u8, len: c_uint, result: *c_int) bool {
            if (isPrivateDescriptor(dirfd)) {
                if (T == std.os.wasi.dirent_t) {
                    var call: Syscall = .{ .cmd = .getdents, .u = .{
                        .getdents = .{
                            .dirfd = @intCast(dirfd),
                            .buffer = buffer,
                            .len = @intCast(len),
                        },
                    } };
                    const err = Host.redirectSyscall(&call);
                    result.* = if (err == .SUCCESS) @intCast(call.u.getdents.read) else intFromError(err);
                } else {
                    // get offset to name in the wasi struct and in the system struct
                    const src_name_offset = @sizeOf(std.os.wasi.dirent_t);
                    const name_offset = @offsetOf(T, "name");
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
                        var next_pos: off_t = 0;
                        while (src_offset + src_name_offset < src_used) {
                            const src_entry: *align(1) std.os.wasi.dirent_t = @ptrCast(&src_buffer[src_offset]);
                            const entry: *align(1) T = @ptrCast(&buffer[offset]);
                            const name_len: usize = src_entry.namlen;
                            const reclen = name_offset + name_len + 1;
                            if (offset + reclen >= len) {
                                // retrieved too much data--reposition cursor before exiting
                                var seek_result: off_t = undefined;
                                _ = lseek(dirfd, next_pos, std.c.SEEK.SET, &seek_result);
                                break;
                            }
                            if (@hasField(T, "ino")) {
                                entry.ino = @intCast(src_entry.ino);
                                if (os == .darwin and entry.ino == 0) entry.ino = 1;
                            } else if (@hasField(T, "fileno")) {
                                entry.fileno = @intCast(src_entry.ino);
                            }
                            if (@hasField(T, "off")) {
                                entry.off = @intCast(src_entry.next);
                            } else if (@hasField(T, "seekoff")) {
                                entry.seekoff = @intCast(src_entry.next);
                            }
                            if (@hasField(T, "reclen")) {
                                entry.reclen = @intCast(reclen);
                            }
                            if (@hasField(T, "namlen")) {
                                entry.namlen = @intCast(name_len);
                            }
                            if (@hasField(T, "type")) {
                                entry.type = switch (src_entry.type) {
                                    .BLOCK_DEVICE => DT.BLK,
                                    .CHARACTER_DEVICE => DT.CHR,
                                    .DIRECTORY => DT.DIR,
                                    .REGULAR_FILE => DT.REG,
                                    .SOCKET_DGRAM => DT.SOCK,
                                    .SOCKET_STREAM => DT.SOCK,
                                    .SYMBOLIC_LINK => DT.LNK,
                                    else => DT.UNKNOWN,
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
            }
            return false;
        }

        pub fn lseek(fd: c_int, offset: off_t, whence: c_int, result: *off_t) callconv(.c) bool {
            return lseekT(off_t, fd, offset, whence, result);
        }

        pub fn lseek64(fd: c_int, offset: off64_t, whence: c_int, result: *off64_t) callconv(.c) bool {
            return lseekT(off64_t, fd, offset, whence, result);
        }

        fn lseekT(comptime T: type, fd: c_int, offset: T, whence: c_int, result: *T) bool {
            if (isPrivateDescriptor(fd)) {
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
                result.* = if (err == .SUCCESS) switch (tell) {
                    true => @intCast(call.u.tell.position),
                    false => @intCast(call.u.seek.position),
                } else intFromError(err);
                return true;
            }
            return false;
        }

        pub fn lstat(path: [*:0]const u8, buf: *Stat, result: *c_int) callconv(.c) bool {
            return fstatat(fd_cwd, path, buf, AT.SYMLINK_NOFOLLOW, result);
        }

        pub fn lstat64(path: [*:0]const u8, buf: *Stat64, result: *c_int) callconv(.c) bool {
            return fstatat64(fd_cwd, path, buf, AT.SYMLINK_NOFOLLOW, result);
        }

        pub fn lutimes(path: [*:0]const u8, tv: [*]const std.c.timeval, result: *c_int) callconv(.c) bool {
            const times = convertTimeval(tv);
            return utimensat(fd_cwd, path, &times, AT.SYMLINK_NOFOLLOW, result);
        }

        pub fn mkdir(path: [*:0]const u8, mode: c_int, result: *c_int) callconv(.c) bool {
            return mkdirat(fd_cwd, path, mode, result);
        }

        pub fn mkdirat(dirfd: c_int, path: [*:0]const u8, _: c_int, result: *c_int) callconv(.c) bool {
            if (isPrivateDescriptor(dirfd) or (dirfd == fd_cwd and Host.isRedirecting(.mkdir))) {
                var resolver = PathResolver.init(dirfd, path) catch {
                    result.* = intFromError(.NOMEM);
                    return true;
                };
                defer resolver.deinit();
                var call: Syscall = .{ .cmd = .mkdir, .u = .{
                    .mkdir = .{
                        .dirfd = resolver.dirfd,
                        .path = resolver.path,
                    },
                } };
                const err = Host.redirectSyscall(&call);
                if (err != .OPNOTSUPP or isPrivateDescriptor(dirfd)) {
                    result.* = intFromError(err);
                    return true;
                }
            }
            return false;
        }

        pub const newfstatat = fstatat;

        pub fn open(path: [*:0]const u8, oflags: c_int, mode: c_int, result: *c_int) callconv(.c) bool {
            return openat(fd_cwd, path, oflags, mode, result);
        }

        pub fn openat(dirfd: c_int, path: [*:0]const u8, oflags: c_int, _: c_int, result: *c_int) callconv(.c) bool {
            if (isPrivateDescriptor(dirfd) or (dirfd == fd_cwd and Host.isRedirecting(.open))) {
                const o: O = @bitCast(@as(i32, @intCast(oflags)));
                var resolver = PathResolver.init(dirfd, path) catch {
                    result.* = intFromError(.NOMEM);
                    return true;
                };
                defer resolver.deinit();
                var call: Syscall = .{ .cmd = .open, .u = .{
                    .open = .{
                        .dirfd = resolver.dirfd,
                        .path = resolver.path,
                        .lookup_flags = .{ .SYMLINK_FOLLOW = !o.NOFOLLOW },
                        .descriptor_flags = .{
                            .APPEND = o.APPEND,
                            .DSYNC = o.DSYNC,
                            .NONBLOCK = o.NONBLOCK,
                            .SYNC = o.SYNC,
                        },
                        .open_flags = .{
                            .CREAT = o.CREAT,
                            .DIRECTORY = o.DIRECTORY,
                            .EXCL = o.EXCL,
                            .TRUNC = o.TRUNC,
                        },
                        .rights = if (o.DIRECTORY)
                            .{ .FD_READ = true, .FD_READDIR = true }
                        else if (o.ACCMODE == .RDWR)
                            .{ .FD_READ = true, .FD_WRITE = true }
                        else if (o.ACCMODE == .WRONLY)
                            .{ .FD_WRITE = true }
                        else
                            .{ .FD_READ = true, .FD_READDIR = true },
                    },
                } };
                const err = Host.redirectSyscall(&call);
                if (err != .OPNOTSUPP) {
                    result.* = if (err == .SUCCESS) call.u.open.fd else intFromError(err);
                    return true;
                }
            }
            return false;
        }

        pub fn poll(fds: [*]pollfd, nfds: nfds_t, timeout: c_int, result: *c_int) callconv(.c) bool {
            if (os == .windows) return false;
            const all_private = for (0..nfds) |i| {
                // negative descriptors are skipped over
                if (fds[i].fd >= 0) {
                    if (!isPrivateDescriptor(fds[i].fd)) break false;
                }
            } else true;
            if (all_private) {
                var stb = std.heap.stackFallback(1024, c_allocator);
                const allocator = stb.get();
                const timer_count: usize = if (timeout >= 0) 1 else 0;
                var actual_fd_count: usize = 0;
                for (0..nfds) |i| {
                    if (fds[i].fd >= 0) actual_fd_count += 1;
                }
                if (actual_fd_count == 0) {
                    result.* = intFromError(.NOSYS);
                    return true;
                }
                const sub_count = actual_fd_count + timer_count;
                const subs = allocator.alloc(std.os.wasi.subscription_t, sub_count) catch {
                    result.* = intFromError(.NOMEM);
                    return true;
                };
                defer allocator.free(subs);
                const events = allocator.alloc(std.os.wasi.event_t, sub_count) catch {
                    result.* = intFromError(.NOMEM);
                    return true;
                };
                defer allocator.free(events);
                var sub_index: usize = 0;
                for (0..nfds) |i| {
                    if (fds[i].fd >= 0) {
                        subs[sub_index] = .{
                            .userdata = @intFromPtr(&fds[i]),
                            .u = .{
                                .tag = if (fds[i].events & POLL.IN != 0) .FD_READ else .FD_WRITE,
                                .u = .{ .fd_read = .{ .fd = fds[i].fd } },
                            },
                        };
                        sub_index += 1;
                    }
                    fds[i].revents = 0;
                }
                if (timer_count != 0) {
                    subs[sub_index] = .{
                        .userdata = 0,
                        .u = .{
                            .tag = .CLOCK,
                            .u = .{
                                .clock = .{
                                    .flags = 0,
                                    .id = .REALTIME,
                                    .precision = 0,
                                    .timeout = @as(u64, @intCast(timeout)) * 1_000_000,
                                },
                            },
                        },
                    };
                }
                var call: Syscall = .{ .cmd = .poll, .u = .{
                    .poll = .{
                        .subscriptions = subs.ptr,
                        .subscription_count = @intCast(subs.len),
                        .events = events.ptr,
                    },
                } };
                const err = Host.redirectSyscall(&call);
                if (err == .SUCCESS) {
                    for (events[0..call.u.poll.event_count]) |evt| {
                        if (evt.type != .CLOCK) {
                            const fd_ptr: *pollfd = @ptrFromInt(evt.userdata);
                            if (evt.@"error" != .SUCCESS) {
                                fd_ptr.revents = switch (evt.@"error") {
                                    .INVAL => POLL.NVAL,
                                    .PIPE => POLL.HUP,
                                    else => POLL.ERR,
                                };
                            } else {
                                fd_ptr.revents = if (evt.type == .FD_READ) POLL.IN else POLL.OUT;
                                if (evt.fd_readwrite.flags & std.os.wasi.EVENT_FD_READWRITE_HANGUP != 0) {
                                    fd_ptr.revents |= POLL.HUP;
                                }
                            }
                        }
                    }
                    var event_count: c_int = 0;
                    for (0..nfds) |i| {
                        if (fds[i].revents != 0) event_count += 1;
                    }
                    result.* = event_count;
                } else {
                    result.* = intFromError(err);
                }
                return true;
            }
            return false;
        }

        pub fn pread(fd: c_int, buffer: [*]u8, len: off_t, offset: off_t, result: *off_t) callconv(.c) bool {
            return preadT(off_t, fd, buffer, len, offset, result);
        }

        pub fn pread64(fd: c_int, buffer: [*]u8, len: off64_t, offset: off64_t, result: *off64_t) callconv(.c) bool {
            return preadT(off64_t, fd, buffer, len, offset, result);
        }

        fn preadT(comptime T: type, fd: c_int, buffer: [*]u8, len: T, offset: T, result: *T) bool {
            if (isPrivateDescriptor(fd)) {
                var call: Syscall = .{ .cmd = .pread, .u = .{
                    .pread = .{
                        .fd = @intCast(fd),
                        .bytes = buffer,
                        .len = @intCast(len),
                        .offset = @intCast(offset),
                    },
                } };
                const err = Host.redirectSyscall(&call);
                result.* = if (err == .SUCCESS) @intCast(call.u.pread.read) else intFromError(err);
                return true;
            }
            return false;
        }

        pub fn preadv(fd: c_int, iovs: [*]const std.c.iovec, count: c_int, offset: off_t, result: *off_t) callconv(.c) bool {
            if (isPrivateDescriptor(fd)) {
                var call: Syscall = .{ .cmd = .preadv, .u = .{
                    .preadv = .{
                        .fd = @intCast(fd),
                        .iovs = @ptrCast(iovs),
                        .count = @intCast(count),
                        .offset = @intCast(offset),
                    },
                } };
                const err = Host.redirectSyscall(&call);
                result.* = if (err == .SUCCESS) @intCast(call.u.pread.read) else intFromError(err);
                return true;
            }
            return false;
        }

        pub fn pwrite(fd: c_int, buffer: [*]const u8, len: c_long, offset: c_long, result: *c_long) callconv(.c) bool {
            return pwriteT(c_long, fd, buffer, len, offset, result);
        }

        pub fn pwrite64(fd: c_int, buffer: [*]const u8, len: i64, offset: i64, result: *i64) callconv(.c) bool {
            return pwriteT(i64, fd, buffer, len, offset, result);
        }

        fn pwriteT(comptime T: type, fd: c_int, buffer: [*]const u8, len: T, offset: T, result: *T) bool {
            if (isPrivateDescriptor(fd)) {
                var call: Syscall = .{ .cmd = .pwrite, .u = .{
                    .pwrite = .{
                        .fd = @intCast(fd),
                        .bytes = buffer,
                        .len = @intCast(len),
                        .offset = @intCast(offset),
                    },
                } };
                const err = Host.redirectSyscall(&call);
                result.* = if (err == .SUCCESS) @intCast(call.u.pwrite.written) else intFromError(err);
                return true;
            }
            return false;
        }

        pub fn pwritev(fd: c_int, iovs: [*]const std.c.iovec_const, count: c_int, offset: off_t, result: *off_t) callconv(.c) bool {
            if (isPrivateDescriptor(fd)) {
                var call: Syscall = .{ .cmd = .pwritev, .u = .{
                    .pwritev = .{
                        .fd = @intCast(fd),
                        .iovs = @ptrCast(iovs),
                        .count = @intCast(count),
                        .offset = @intCast(offset),
                    },
                } };
                const err = Host.redirectSyscall(&call);
                result.* = if (err == .SUCCESS) @intCast(call.u.pwrite.written) else intFromError(err);
                return true;
            }
            return false;
        }

        pub fn read(fd: c_int, buffer: [*]u8, len: off_t, result: *off_t) callconv(.c) bool {
            if (isPrivateDescriptor(fd)) {
                var call: Syscall = .{ .cmd = .read, .u = .{
                    .read = .{
                        .fd = @intCast(fd),
                        .bytes = buffer,
                        .len = @intCast(len),
                    },
                } };
                const err = Host.redirectSyscall(&call);
                result.* = if (err == .SUCCESS) @intCast(call.u.read.read) else intFromError(err);
                return true;
            }
            return false;
        }

        pub fn readv(fd: c_int, iovs: [*]const std.c.iovec, count: c_int, result: *off_t) callconv(.c) bool {
            if (isPrivateDescriptor(fd)) {
                var call: Syscall = .{ .cmd = .readv, .u = .{
                    .readv = .{
                        .fd = @intCast(fd),
                        .iovs = @ptrCast(iovs),
                        .count = @intCast(count),
                    },
                } };
                const err = Host.redirectSyscall(&call);
                result.* = if (err == .SUCCESS) @intCast(call.u.readv.read) else intFromError(err);
                return true;
            }
            return false;
        }

        pub fn rmdir(path: [*:0]const u8, result: *c_int) callconv(.c) bool {
            return unlinkat(fd_cwd, path, AT.REMOVEDIR, result);
        }

        pub fn stat(path: [*:0]const u8, buf: *Stat, result: *c_int) callconv(.c) bool {
            return fstatat(fd_cwd, path, buf, 0, result);
        }

        pub fn stat64(path: [*:0]const u8, buf: *Stat64, result: *c_int) callconv(.c) bool {
            return fstatat64(fd_cwd, path, buf, 0, result);
        }

        pub fn statx(dirfd: c_int, path: [*:0]const u8, flags: c_int, mask: c_uint, buf: *std.os.linux.Statx, result: *c_int) callconv(.c) bool {
            if (isPrivateDescriptor(dirfd) or (dirfd == fd_cwd and Host.isRedirecting(.stat))) {
                var resolver = PathResolver.init(dirfd, path) catch {
                    result.* = intFromError(.NOMEM);
                    return true;
                };
                defer resolver.deinit();
                var call: Syscall = if (flags & std.os.linux.AT.EMPTY_PATH != 0 and std.mem.len(path) == 0)
                    .{ .cmd = .fstat, .u = .{
                        .fstat = .{
                            .fd = resolver.dirfd,
                        },
                    } }
                else
                    .{ .cmd = .stat, .u = .{
                        .stat = .{
                            .dirfd = resolver.dirfd,
                            .path = resolver.path,
                            .lookup_flags = convertLookupFlags(flags),
                        },
                    } };
                const err = Host.redirectSyscall(&call);
                if (err == .SUCCESS) copyStatx(buf, &call.u.fstat.stat, mask);
                if (err != .OPNOTSUPP or isPrivateDescriptor(dirfd)) {
                    result.* = intFromError(err);
                    return true;
                }
            }
            return false;
        }

        pub fn unlink(path: [*:0]const u8, result: *c_int) callconv(.c) bool {
            return unlinkat(fd_cwd, path, 0, result);
        }

        pub fn unlinkat(dirfd: c_int, path: [*:0]const u8, flags: c_int, result: *c_int) callconv(.c) bool {
            const rmdir_op = (flags & AT.REMOVEDIR) != 0;
            const redirecting = if (rmdir_op) Host.isRedirecting(.rmdir) else Host.isRedirecting(.unlink);
            if (isPrivateDescriptor(dirfd) or (dirfd == fd_cwd and redirecting)) {
                var resolver = PathResolver.init(dirfd, path) catch {
                    result.* = intFromError(.NOMEM);
                    return true;
                };
                defer resolver.deinit();
                var call: Syscall = if (rmdir_op)
                    .{ .cmd = .rmdir, .u = .{
                        .rmdir = .{
                            .dirfd = resolver.dirfd,
                            .path = resolver.path,
                        },
                    } }
                else
                    .{ .cmd = .unlink, .u = .{
                        .unlink = .{
                            .dirfd = resolver.dirfd,
                            .path = resolver.path,
                            .flags = @intCast(flags),
                        },
                    } };
                const err = Host.redirectSyscall(&call);
                if (err != .OPNOTSUPP) {
                    result.* = intFromError(err);
                    return true;
                }
            }
            return false;
        }

        pub fn utimes(path: [*:0]const u8, tv: [*]const std.c.timeval, result: *c_int) callconv(.c) bool {
            const times = convertTimeval(tv);
            return utimensat(fd_cwd, path, &times, AT.SYMLINK_FOLLOW, result);
        }

        pub fn utimensat(dirfd: c_int, path: [*:0]const u8, times: [*]const std.c.timespec, flags: c_int, result: *c_int) callconv(.c) bool {
            if (isPrivateDescriptor(dirfd) or (dirfd == fd_cwd and Host.isRedirecting(.set_times))) {
                var resolver = PathResolver.init(dirfd, path) catch {
                    result.* = intFromError(.NOMEM);
                    return true;
                };
                defer resolver.deinit();
                var call: Syscall = .{ .cmd = .utimes, .u = .{
                    .utimes = .{
                        .dirfd = resolver.dirfd,
                        .path = resolver.path,
                        .lookup_flags = convertLookupFlags(flags),
                        .atime = getNanoseconds(times[0]),
                        .mtime = getNanoseconds(times[1]),
                    },
                } };
                const err = Host.redirectSyscall(&call);
                if (err != .OPNOTSUPP or isPrivateDescriptor(dirfd)) {
                    result.* = intFromError(err);
                    return true;
                }
            }
            return false;
        }

        pub fn write(fd: c_int, buffer: [*]const u8, len: off_t, result: *off_t) callconv(.c) bool {
            if (isPrivateDescriptor(fd)) {
                var call: Syscall = .{ .cmd = .write, .u = .{
                    .write = .{
                        .fd = @intCast(fd),
                        .bytes = buffer,
                        .len = @intCast(len),
                    },
                } };
                const err = Host.redirectSyscall(&call);
                result.* = if (err == .SUCCESS) @intCast(call.u.write.written) else intFromError(err);
                return true;
            }
            return false;
        }

        pub fn writev(fd: c_int, iovs: [*]const std.c.iovec_const, count: c_int, result: *off_t) callconv(.c) bool {
            if (isPrivateDescriptor(fd)) {
                var call: Syscall = .{ .cmd = .writev, .u = .{
                    .writev = .{
                        .fd = @intCast(fd),
                        .iovs = @ptrCast(iovs),
                        .count = @intCast(count),
                    },
                } };
                const err = Host.redirectSyscall(&call);
                result.* = if (err == .SUCCESS) @intCast(call.u.write.written) else intFromError(err);
                return true;
            }
            return false;
        }

        const Host = ModuleHost;

        fn isPrivateDescriptor(fd: c_int) bool {
            return switch (fd) {
                0, 1, 2 => true,
                else => fd >= fd_min,
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

        fn getNanoseconds(ts: std.c.timespec) i64 {
            return ts.sec * 1_000_000_000 + ts.nsec;
        }

        fn convertLookupFlags(flags: c_int) std.os.wasi.lookupflags_t {
            return .{
                .SYMLINK_FOLLOW = (flags & AT.SYMLINK_NOFOLLOW) == 0,
            };
        }

        fn copyStat(dest: anytype, src: *const std.os.wasi.filestat_t) void {
            const T = @typeInfo(@TypeOf(dest)).pointer.child;
            if (T == std.os.wasi.filestat_t) {
                dest.* = src.*;
                return;
            }
            dest.* = std.mem.zeroes(T);
            dest.ino = @intCast(src.ino);
            dest.size = @intCast(src.size);
            dest.nlink = @intCast(src.nlink);
            const type_flags: u32 = switch (src.filetype) {
                .BLOCK_DEVICE => S.IFBLK,
                .CHARACTER_DEVICE => S.IFCHR,
                .DIRECTORY => S.IFDIR,
                .REGULAR_FILE => S.IFREG,
                .SOCKET_DGRAM, .SOCKET_STREAM => if (@hasDecl(S, "IFSOCK")) S.IFSOCK else 0,
                .SYMBOLIC_LINK => if (@hasDecl(S, "IFLNK")) S.IFLNK else 0,
                else => 0,
            };
            const rights: u32 = switch (src.filetype) {
                .DIRECTORY => std.c.R_OK | std.c.W_OK | std.c.X_OK,
                else => std.c.R_OK | std.c.W_OK,
            };
            dest.mode = @truncate(type_flags | rights);
            if (@hasField(T, "atim")) {
                copyTime(&dest.atim, src.atim);
                copyTime(&dest.mtim, src.mtim);
                copyTime(&dest.ctim, src.ctim);
            } else if (@hasField(T, "atimespec")) {
                // MacOS
                copyTime(&dest.atimespec, src.atim);
                copyTime(&dest.mtimespec, src.mtim);
                copyTime(&dest.ctimespec, src.ctim);
            } else if (@hasField(T, "atime")) {
                // Windows
                copyTime(&dest.atime, src.atim);
                copyTime(&dest.mtime, src.mtim);
                copyTime(&dest.ctime, src.ctim);
            }
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
            const T = @typeInfo(@TypeOf(dest)).pointer.child;
            switch (@typeInfo(T)) {
                .@"struct" => {
                    dest.sec = @intCast(ns / 1_000_000_000);
                    dest.nsec = @intCast(ns % 1_000_000_000);
                },
                .int => {
                    dest.* = @intCast(ns / 1_000_000_000);
                },
                else => @compileError("Unexpected"),
            }
        }

        const PathResolver = struct {
            sfa: std.heap.StackFallbackAllocator(max_buffer_size),
            allocator: std.mem.Allocator,
            dirfd: c_int,
            buffer: ?[]u8,
            path: [*:0]const u8,

            const max_buffer_size = 4096;

            pub inline fn init(dirfd: c_int, path: [*:0]const u8) !@This() {
                var self: @This() = undefined;
                const len = std.mem.len(path);
                const path_s = path[0..len];
                self.sfa = std.heap.stackFallback(max_buffer_size, c_allocator);
                self.allocator = self.sfa.get();
                try self._init(dirfd, @ptrCast(path_s));
                return self;
            }

            pub fn _init(self: *@This(), dirfd: c_int, path: [:0]const u8) !void {
                const absolute = std.fs.path.isAbsolute(path);
                const relative = dirfd == fd_cwd and !absolute;
                const backslashes = if (os != .windows) false else for (path) |c| {
                    if (c == '\\') break true;
                } else false;
                if (relative) {
                    self.dirfd = fd_root;
                    // resolve the path
                    const cwd = try std.process.getCwdAlloc(self.allocator);
                    defer self.allocator.free(cwd);
                    var buf = try std.fs.path.resolve(self.allocator, &.{ cwd, path });
                    // add sentinel
                    buf = try self.allocator.realloc(buf, buf.len + 1);
                    buf.len += 1;
                    buf[buf.len - 1] = 0;
                    self.buffer = buf;
                    self.path = @ptrCast(buf.ptr);
                } else {
                    self.dirfd = if (dirfd == fd_cwd) fd_root else dirfd;
                    if (backslashes) {
                        const buf = try self.allocator.dupeZ(u8, path);
                        self.buffer = buf;
                        self.path = buf.ptr;
                    } else {
                        self.buffer = null;
                        self.path = path.ptr;
                    }
                }
                if (os == .windows) {
                    if (self.buffer) |buf| {
                        // convert back-slashes to forward-slashes
                        for (buf, 0..) |c, i| {
                            if (c == '\\') buf[i] = '/';
                        }
                    }
                    if (std.ascii.isAlphabetic(self.path[0]) and self.path[1] == ':') {
                        // omit drive letter
                        self.path = self.path[2..];
                    } else if (self.path[0] == '/' and self.path[1] == '/') {
                        // omit server name and share name
                        var i: usize = 2;
                        var slash_count: usize = 0;
                        while (self.path[i] != 0) {
                            if (self.path[i] == '/') {
                                slash_count += 1;
                                if (slash_count == 2) break;
                            }
                            i += 1;
                        }
                        self.path = self.path[i..];
                    }
                }
            }

            pub fn deinit(self: *@This()) void {
                if (self.buffer) |buf| self.allocator.free(buf);
            }
        };
    };
}

pub fn PosixSubstitute(comptime redirector: type) type {
    return struct {
        pub const access = makeStdHook("access");
        pub const close = makeStdHook("close");
        pub const faccessat = makeStdHookUsing("faccessat", "faccessat2");
        pub const fallocate = makeStdHook("fallocate");
        pub const fcntl = makeStdHook("fcntl");
        pub const fcntl64 = makeStdHook("fcntl64");
        pub const fdatasync = makeStdHook("fdatasync");
        pub const flock = makeStdHook("flock");
        pub const fstat = makeStdHook("fstat");
        pub const fstat64 = makeStdHook("fstat64");
        pub const fstatat = makeStdHook("fstatat");
        pub const fstatat64 = makeStdHook("fstatat64");
        pub const fstatfs = makeStdHook("fstatfs");
        pub const fstatfs64 = makeStdHook("fstatfs64");
        pub const fsync = makeStdHook("fsync");
        pub const futimens = makeStdHook("futimens");
        pub const futimes = makeStdHook("futimes");
        pub const futimesat = makeStdHook("futimesat");
        pub const lseek = makeStdHook("lseek");
        pub const lseek64 = makeStdHook("lseek64");
        pub const lstat = makeStdHook("lstat");
        pub const lstat64 = makeStdHook("lstat64");
        pub const lutimes = makeStdHook("lutimes");
        pub const mkdir = makeStdHook("mkdir");
        pub const mkdirat = makeStdHook("mkdirat");
        pub const open = makeStdHook("open");
        pub const openat = makeStdHook("openat");
        pub const open64 = makeStdHookUsing("open64", "open");
        pub const openat64 = makeStdHookUsing("openat64", "openat");
        pub const poll = makeStdHook("poll");
        pub const posix_fadvise = makeStdHookUsing("posix_fadvise", "fadvise64");
        pub const pread = makeStdHook("pread");
        pub const pread64 = makeStdHook("pread64");
        pub const preadv = makeStdHook("preadv");
        pub const pwrite = makeStdHook("pwrite");
        pub const pwrite64 = makeStdHook("pwrite64");
        pub const pwritev = makeStdHook("pwritev");
        pub const read = makeStdHook("read");
        pub const readv = makeStdHook("readv");
        pub const rmdir = makeStdHook("rmdir");
        pub const stat = makeStdHook("stat");
        pub const stat64 = makeStdHook("stat64");
        pub const unlink = makeStdHook("unlink");
        pub const unlinkat = makeStdHook("unlinkat");
        pub const utimensat = makeStdHook("utimensat");
        pub const utimes = makeStdHook("utimes");
        pub const write = makeStdHook("write");
        pub const writev = makeStdHook("writev");

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

        pub fn __fxstatat(ver: c_int, dirfd: c_int, path: [*:0]const u8, buf: *Stat, flags: c_int) callconv(.c) c_int {
            var result: c_int = undefined;
            if (redirector.newfstatat(dirfd, path, buf, flags, &result)) {
                return saveError(result);
            }
            return Original.__fxstatat(ver, dirfd, path, buf, flags);
        }

        pub fn __fxstatat64(ver: c_int, dirfd: c_int, path: [*:0]const u8, buf: *Stat) callconv(.c) c_int {
            var result: c_int = undefined;
            if (redirector.newfstatat(dirfd, path, buf, AT.SYMLINK_FOLLOW, &result)) {
                return saveError(result);
            }
            return Original.__fxstatat64(ver, dirfd, path, buf);
        }

        pub fn __getdirentries64(dirfd: c_int, buffer: [*]u8, len: c_uint, basep: *i64) callconv(.c) off_t {
            var result: c_int = undefined;
            if (redirector.getdents64(dirfd, buffer, len, &result)) {
                return saveError(result);
            }
            return Original.__getdirentries64(dirfd, buffer, len, basep);
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

        pub fn futime(fd: c_int, tb: *const utimbuf) callconv(.c) c_int {
            const ts: [2]std.c.timespec = .{
                .{ .sec = tb.actime, .nsec = 0 },
                .{ .sec = tb.modtime, .nsec = 0 },
            };
            var result: c_int = undefined;
            if (redirector.futimens(fd, &ts, &result)) {
                return saveError(result);
            }
            return Original.futime(fd, tb);
        }

        pub fn futime64(fd: c_int, tb: *const utimbuf) callconv(.c) c_int {
            const ts: [2]std.c.timespec = .{
                .{ .sec = tb.actime, .nsec = 0 },
                .{ .sec = tb.modtime, .nsec = 0 },
            };
            var result: c_int = undefined;
            if (redirector.futimens(fd, &ts, &result)) {
                return saveError(result);
            }
            return Original.futime64(fd, tb);
        }

        pub fn opendir(path: [*:0]const u8) callconv(.c) ?*std.c.DIR {
            var result: c_int = undefined;
            const flags: O = .{ .DIRECTORY = true };
            const flags_int: @typeInfo(O).@"struct".backing_integer.? = @bitCast(flags);
            if (redirector.open(path, flags_int, 0, &result)) {
                if (result > 0) {
                    if (c_allocator.create(RedirectedDir)) |dir| {
                        dir.* = .{ .fd = result };
                        return @ptrCast(dir);
                    } else |_| {}
                }
                return null;
            }
            return Original.opendir(path);
        }

        pub fn posix_fallocate(fd: c_int, offset: off_t, len: off_t) callconv(.c) c_int {
            var result: c_int = undefined;
            if (redirector.fallocate(fd, 0, offset, len, &result)) {
                return saveError(result);
            }
            return Original.posix_fallocate(fd, offset, len);
        }

        pub fn pthread_create(thread: *std.c.pthread_t, attr: ?*const std.c.pthread_attr_t, start_routine: *const fn (?*anyopaque) callconv(.c) ?*anyopaque, arg: ?*anyopaque) callconv(.c) c_int {
            const instance = redirector.Host.getInstance();
            const info = c_allocator.create(ThreadInfo) catch return @intFromEnum(std.c.E.NOMEM);
            info.* = .{
                .proc = start_routine,
                .arg = arg,
                .instance = instance,
            };
            return Original.pthread_create(thread, attr, &setThreadContext, info);
        }

        pub fn readdir(d: *std.c.DIR) callconv(.c) ?*align(1) const Dirent {
            if (RedirectedDir.cast(d)) |dir| {
                return readdirT(Dirent, dir);
            }
            return Original.readdir(d);
        }

        pub fn readdir64(d: *std.c.DIR) callconv(.c) ?*align(1) const Dirent64 {
            if (RedirectedDir.cast(d)) |dir| {
                return readdirT(Dirent64, dir);
            }
            return Original.readdir64(d);
        }

        pub fn readdirT(comptime T: type, dir: *RedirectedDir) ?*align(1) const T {
            if (dir.data_next == dir.data_len) {
                var result: c_int = undefined;
                const f = if (T == Dirent) redirector.getdents else redirector.getdents64;
                _ = f(dir.fd, &dir.buffer, dir.buffer.len, &result);
                if (result > 0) {
                    dir.data_next = 0;
                    dir.data_len = @intCast(result);
                }
            }
            if (dir.data_next < dir.data_len) {
                const dirent: *align(1) const T = @ptrCast(&dir.buffer[dir.data_next]);
                if (@hasField(T, "reclen")) {
                    dir.data_next += dirent.reclen;
                } else if (@hasField(T, "namlen")) {
                    dir.data_next += @offsetOf(T, "name") + dirent.namlen;
                }
                if (@hasField(T, "off")) {
                    dir.cookie = dirent.off;
                } else if (@hasField(T, "seekoff")) {
                    dir.cookie = dirent.seekoff;
                }
                return dirent;
            }
            return null;
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
                return @intCast(dir.cookie);
            }
            return Original.telldir(d);
        }

        pub fn utime(path: [*:0]const u8, tb: *const utimbuf) callconv(.c) c_int {
            const ts: [2]std.c.timespec = .{
                .{ .sec = tb.actime, .nsec = 0 },
                .{ .sec = tb.modtime, .nsec = 0 },
            };
            var result: c_int = undefined;
            if (redirector.utimensat(fd_cwd, path, &ts, 0, &result)) {
                return saveError(result);
            }
            return Original.utime(path, tb);
        }

        pub fn utime64(path: [*:0]const u8, tb: *const utimbuf) callconv(.c) c_int {
            const ts: [2]std.c.timespec = .{
                .{ .sec = tb.actime, .nsec = 0 },
                .{ .sec = tb.modtime, .nsec = 0 },
            };
            var result: c_int = undefined;
            if (redirector.utimensat(fd_cwd, path, &ts, 0, &result)) {
                return saveError(result);
            }
            return Original.utime64(path, tb);
        }

        const utimbuf = extern struct {
            actime: c_longlong,
            modtime: c_longlong,
        };

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
                const value = std.math.cast(c_int, -result) orelse -1;
                setError(value);
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
            return errno_ptr orelse inline for (.{ "__errno_location", "__error", "_errno" }) |name| {
                if (@hasDecl(errno_h, name)) {
                    const func = @field(errno_h, name);
                    errno_ptr = func();
                    break errno_ptr.?;
                }
            } else @compileError("Unable to get error number pointer");
        }

        fn setThreadContext(ptr: ?*anyopaque) callconv(.c) ?*anyopaque {
            const info: *ThreadInfo = @ptrCast(@alignCast(ptr.?));
            const proc: *const fn (?*anyopaque) callconv(.c) ?*anyopaque = @ptrCast(@alignCast(info.proc));
            const arg = info.arg;
            const instance = info.instance;
            c_allocator.destroy(info);
            redirector.Host.initializeThread(instance) catch {};
            defer redirector.Host.deinitializeThread() catch {};
            return proc(arg);
        }

        const errno_h = @cImport({
            @cInclude("errno.h");
        });

        const Self = @This();
        pub const Original = struct {
            pub var __fxstat: *const @TypeOf(Self.__fxstat) = undefined;
            pub var __fxstat64: *const @TypeOf(Self.__fxstat64) = undefined;
            pub var __fxstatat: *const @TypeOf(Self.__fxstatat) = undefined;
            pub var __fxstatat64: *const @TypeOf(Self.__fxstatat64) = undefined;
            pub var __getdirentries64: *const @TypeOf(Self.__getdirentries64) = undefined;
            pub var __lxstat: *const @TypeOf(Self.__lxstat) = undefined;
            pub var __lxstat64: *const @TypeOf(Self.__lxstat64) = undefined;
            pub var __xstat: *const @TypeOf(Self.__xstat) = undefined;
            pub var __xstat64: *const @TypeOf(Self.__xstat64) = undefined;
            pub var access: *const @TypeOf(Self.access) = undefined;
            pub var close: *const @TypeOf(Self.close) = undefined;
            pub var closedir: *const @TypeOf(Self.closedir) = undefined;
            pub var faccessat: *const @TypeOf(Self.faccessat) = undefined;
            pub var fallocate: *const @TypeOf(Self.fallocate) = undefined;
            pub var fcntl: *const @TypeOf(Self.fcntl) = undefined;
            pub var fcntl64: *const @TypeOf(Self.fcntl64) = undefined;
            pub var fdatasync: *const @TypeOf(Self.fdatasync) = undefined;
            pub var flock: *const @TypeOf(Self.flock) = undefined;
            pub var fstat: *const @TypeOf(Self.fstat) = undefined;
            pub var fstat64: *const @TypeOf(Self.fstat64) = undefined;
            pub var fstatat: *const @TypeOf(Self.fstatat) = undefined;
            pub var fstatat64: *const @TypeOf(Self.fstatat64) = undefined;
            pub var fstatfs: *const @TypeOf(Self.fstatfs) = undefined;
            pub var fstatfs64: *const @TypeOf(Self.fstatfs64) = undefined;
            pub var fsync: *const @TypeOf(Self.fsync) = undefined;
            pub var futime: *const @TypeOf(Self.futime) = undefined;
            pub var futime64: *const @TypeOf(Self.futime64) = undefined;
            pub var futimes: *const @TypeOf(Self.futimes) = undefined;
            pub var futimens: *const @TypeOf(Self.futimens) = undefined;
            pub var futimesat: *const @TypeOf(Self.futimesat) = undefined;
            pub var lseek: *const @TypeOf(Self.lseek) = undefined;
            pub var lseek64: *const @TypeOf(Self.lseek64) = undefined;
            pub var lstat: *const @TypeOf(Self.lstat) = undefined;
            pub var lstat64: *const @TypeOf(Self.lstat64) = undefined;
            pub var lutimes: *const @TypeOf(Self.lutimes) = undefined;
            pub var mkdir: *const @TypeOf(Self.mkdir) = undefined;
            pub var mkdirat: *const @TypeOf(Self.mkdirat) = undefined;
            pub var open: *const @TypeOf(Self.open) = undefined;
            pub var open64: *const @TypeOf(Self.open64) = undefined;
            pub var openat: *const @TypeOf(Self.openat) = undefined;
            pub var openat64: *const @TypeOf(Self.openat64) = undefined;
            pub var opendir: *const @TypeOf(Self.opendir) = undefined;
            pub var poll: *const @TypeOf(Self.poll) = undefined;
            pub var posix_fadvise: *const @TypeOf(Self.posix_fadvise) = undefined;
            pub var posix_fallocate: *const @TypeOf(Self.posix_fallocate) = undefined;
            pub var pread: *const @TypeOf(Self.pread) = undefined;
            pub var pread64: *const @TypeOf(Self.pread64) = undefined;
            pub var preadv: *const @TypeOf(Self.preadv) = undefined;
            pub var pthread_create: *const @TypeOf(Self.pthread_create) = undefined;
            pub var pwrite: *const @TypeOf(Self.pwrite) = undefined;
            pub var pwritev: *const @TypeOf(Self.pwritev) = undefined;
            pub var pwrite64: *const @TypeOf(Self.pwrite64) = undefined;
            pub var read: *const @TypeOf(Self.read) = undefined;
            pub var readv: *const @TypeOf(Self.readv) = undefined;
            pub var readdir: *const @TypeOf(Self.readdir) = undefined;
            pub var readdir64: *const @TypeOf(Self.readdir64) = undefined;
            pub var rewinddir: *const @TypeOf(Self.rewinddir) = undefined;
            pub var rmdir: *const @TypeOf(Self.rmdir) = undefined;
            pub var seekdir: *const @TypeOf(Self.seekdir) = undefined;
            pub var stat: *const @TypeOf(Self.stat) = undefined;
            pub var stat64: *const @TypeOf(Self.stat64) = undefined;
            pub var telldir: *const @TypeOf(Self.telldir) = undefined;
            pub var unlink: *const @TypeOf(Self.unlink) = undefined;
            pub var unlinkat: *const @TypeOf(Self.unlinkat) = undefined;
            pub var utimensat: *const @TypeOf(Self.utimensat) = undefined;
            pub var utime: *const @TypeOf(Self.utime) = undefined;
            pub var utime64: *const @TypeOf(Self.utime64) = undefined;
            pub var utimes: *const @TypeOf(Self.utimes) = undefined;
            pub var write: *const @TypeOf(Self.write) = undefined;
            pub var writev: *const @TypeOf(Self.writev) = undefined;
        };
        pub const calling_convention = std.builtin.CallingConvention.c;
    };
}

const RedirectedDir = struct {
    sig: u64 = signature,
    fd: c_int = undefined,
    cookie: u64 = 0,
    data_next: usize = 0,
    data_len: usize = 0,
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
    flags: O,
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

pub fn LibcSubstitute(comptime redirector: type) type {
    return struct {
        const posix = PosixSubstitute(redirector);

        pub fn clearerr(s: *std.c.FILE) callconv(.c) void {
            if (getRedirectedFile(s)) |file| {
                file.errno = 0;
                return;
            }
            return Original.clearerr(s);
        }

        pub fn getc() callconv(.c) c_int {
            const stdin = getStdProxy(0);
            var buf: [1]u8 = undefined;
            if (read(stdin, &buf, 1) != 1) return -1;
            return buf[0];
        }

        pub fn getchar() callconv(.c) c_int {
            const stdin = getStdProxy(0);
            var buf: [1]u8 = undefined;
            if (read(stdin, &buf, 1) != 1) return -1;
            return buf[0];
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
            if (redirector.isPrivateDescriptor(fd)) {
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

        pub fn fgetpos(s: *std.c.FILE, pos: *stdio_h.fpos_t) callconv(.c) c_int {
            if (getRedirectedFile(s)) |file| {
                const result = posix.lseek64(file.fd, 0, std.c.SEEK.CUR);
                if (result < 0) {
                    file.errno = posix.getError();
                    return -1;
                }
                const offset_ptr: *off64_t = @ptrCast(pos);
                offset_ptr.* = result;
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
                const result = bufferUntil(file, '\n');
                if (result <= 0) return null;
                const end: usize = @intCast(result);
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
                const len: off_t = @intCast(std.mem.len(text));
                return @intCast(write(file, text, len));
            }
            return Original.fputs(text, s);
        }

        pub fn fread(buffer: [*]u8, size: usize, n: usize, s: *std.c.FILE) callconv(.c) usize {
            if (getRedirectedFile(s)) |file| {
                const len: off_t = @intCast(size * n);
                if (len == 0) return 0;
                const result = read(file, buffer, len);
                if (result < 0) return 0;
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
                const offset_ptr: *const off64_t = @ptrCast(pos);
                const offset = offset_ptr.*;
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
                const len: off_t = @intCast(size * n);
                if (len == 0) return 0;
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
                const len: off_t = @intCast(std.mem.len(s));
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
            var total: off_t = 0;
            for (strings) |s| {
                const len: off_t = @intCast(std.mem.len(s));
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

        // function required by C hooks
        comptime {
            @export(&getRedirectedFile, .{ .name = "get_redirected_file", .visibility = .protected });
            @export(&read, .{ .name = "redirected_read", .visibility = .protected });
            @export(&write, .{ .name = "redirected_write", .visibility = .protected });
            @export(&getLine, .{ .name = "get_line", .visibility = .protected });
        }

        fn read(file: *RedirectedFile, dest: [*]u8, len: off_t) callconv(.c) off_t {
            const len_u: usize = @intCast(len);
            if (setBufferMode(file, .read) < 0) return -1;
            var copied = file.consumeBuffer(dest, len_u);
            while (len_u - copied > 0) {
                var amount: usize = undefined;
                if (len_u >= 8192) {
                    // read directly into the destination when the amount is large
                    const result = readRaw(file, dest[copied..], @intCast(len_u - copied));
                    if (result < 0) return -1;
                    amount = @intCast(result);
                } else {
                    if (bufferMore(file) < 0) return -1;
                    amount = file.consumeBuffer(dest[copied..], len_u - copied);
                }
                if (amount == 0) break;
                copied += amount;
            }
            return @intCast(copied);
        }

        fn readRaw(file: *RedirectedFile, dest: [*]u8, len: off_t) callconv(.c) off_t {
            const result = posix.read(file.fd, dest, len);
            if (result < 0) return saveFileError(file, posix.getError());
            if (result == 0) file.eof = true;
            return result;
        }

        fn write(file: *RedirectedFile, src: [*]const u8, len: off_t) callconv(.c) off_t {
            if (setBufferMode(file, .write) < 0) return -1;
            const len_u: usize = @intCast(len);
            if (len_u >= 8192 or file.fd == 1 or file.fd == 2) {
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

        fn writeRaw(file: *RedirectedFile, src: [*]const u8, len: off_t) callconv(.c) off_t {
            const result = posix.write(file.fd, src, len);
            if (result < 0) return saveFileError(file, posix.getError());
            return result;
        }

        fn setBufferMode(file: *RedirectedFile, mode: RedirectedFile.BufferMode) off_t {
            if (file.buf_mode == mode) return 0;
            if (flush(file) < 0) return -1;
            file.buf_mode = mode;
            return 0;
        }

        fn flush(file: *RedirectedFile) off_t {
            const content = file.previewBuffer();
            if (content.len == 0) return 0;
            const result: off_t = switch (file.buf_mode) {
                .write => writeRaw(file, content.ptr, @intCast(content.len)),
                .read => @intCast(content.len),
            };
            file.clearBuffer();
            return result;
        }

        fn bufferUntil(file: *RedirectedFile, delimiter: u8) callconv(.c) off_t {
            if (setBufferMode(file, .read) < 0) return 0;
            var checked_len: usize = 0;
            while (true) {
                // look for delimiter
                const content = file.previewBuffer();
                for (checked_len..content.len) |i| {
                    if (content[i] == delimiter) {
                        return @intCast(i + 1);
                    }
                } else if (file.eof) {
                    return @intCast(content.len);
                } else {
                    checked_len = content.len;
                    // retrieve more data
                    if (bufferMore(file) < 0) return -1;
                }
            }
        }

        fn bufferMore(file: *RedirectedFile) callconv(.c) off_t {
            if (setBufferMode(file, .read) < 0) return 0;
            const buf = file.prepareBuffer() catch return 0;
            const result = readRaw(file, buf.ptr, @intCast(buf.len));
            if (result < 0) return -1;
            _ = file.replenishBuffer(null, @intCast(result));
            return result;
        }

        fn getLine(file: *RedirectedFile) callconv(.c) ?[*:0]u8 {
            const result = bufferUntil(file, '\n');
            if (result <= 0) return null;
            var buf = file.previewBuffer();
            const end: usize = @intCast(result);
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

        fn addRedirectedFile(fd: c_int, oflags: O) !*std.c.FILE {
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

        fn decodeOpenMode(mode: [*:0]const u8) O {
            var oflags: O = .{};
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
            pub var getc: *const @TypeOf(Self.getc) = undefined;
            pub var getchar: *const @TypeOf(Self.getchar) = undefined;
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
        };
        pub const calling_convention = std.builtin.CallingConvention.c;
    };
}

pub fn LinuxLibcSubstitute(comptime redirector: type) type {
    return struct {
        const libc = LibcSubstitute(redirector);

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
        pub const calling_convention = std.builtin.CallingConvention.c;
    };
}

pub fn Win32LibcSubsitute(comptime redirector: type) type {
    return struct {
        const posix = PosixSubstitute(redirector);
        const libc = LibcSubstitute(redirector);
        const win32 = Win32SubstituteS(redirector);

        pub const lseeki64 = posix.lseek64;

        pub fn _findclose(handle: isize) callconv(.c) c_int {
            const d: *std.c.DIR = @ptrFromInt(@as(usize, @bitCast(handle)));
            if (RedirectedDir.cast(d)) |dir| {
                _ = posix.close(dir.fd);
                c_allocator.destroy(dir);
                return 0;
            }
            return Original._findclose(handle);
        }

        pub fn _findfirst32(filespec: [*:0]const u8, info: *FindData32) callconv(.c) isize {
            const handle = opendir(filespec);
            if (handle < 0) return -1;
            if (handle > 0) {
                if (_findnext32(handle, info) != 0) {
                    _ = _findclose(handle);
                    return -1;
                }
                return handle;
            }
            return Original._findfirst32(filespec, info);
        }

        pub fn _findfirst64(filespec: [*:0]const u8, info: *FindData64) callconv(.c) isize {
            const handle = opendir(filespec);
            if (handle < 0) return -1;
            if (handle > 0) {
                if (_findnext64(handle, info) != 0) {
                    _ = _findclose(handle);
                    return -1;
                }
                return handle;
            }
            return Original._findfirst64(filespec, info);
        }

        pub fn _findnext32(handle: isize, info: *FindData32) callconv(.c) c_int {
            const dir: *std.c.DIR = @ptrFromInt(@as(usize, @bitCast(handle)));
            if (RedirectedDir.cast(dir)) |_| {
                return readdirT(FindData32, dir, info);
            }
            return Original._findnext32(handle, info);
        }

        pub fn _findnext64(handle: isize, info: *FindData64) callconv(.c) c_int {
            const dir: *std.c.DIR = @ptrFromInt(@as(usize, @bitCast(handle)));
            if (RedirectedDir.cast(dir)) |_| {
                return readdirT(FindData64, dir, info);
            }
            return Original._findnext64(handle, info);
        }

        pub fn _open_osfhandle(handle: win32.HANDLE) callconv(.c) c_int {
            const fd = win32.toDescriptor(handle);
            if (win32.isPrivateDescriptor(fd)) {
                return fd;
            }
            return Original._open_osfhandle(handle);
        }

        pub fn _get_osfhandle(fd: c_int) callconv(.c) win32.HANDLE {
            if (win32.isPrivateDescriptor(fd)) {
                return win32.fromDescriptor(fd);
            }
            return Original._get_osfhandle(fd);
        }

        pub extern fn __stdio_common_vfprintf_hook() callconv(.c) void;
        pub extern fn __stdio_common_vfscanf_hook() callconv(.c) void;

        fn getPath(filespec: [*:0]const u8) !?[:0]const u8 {
            const len = std.mem.len(filespec);
            if (std.mem.endsWith(u8, filespec[0..len], "\\*")) {
                return try c_allocator.dupeZ(u8, filespec[0 .. len - 2]);
            }
            return null;
        }

        fn opendir(filespec: [*:0]const u8) isize {
            if (redirector.Host.isRedirecting(.open)) {
                if (getPath(filespec) catch return -1) |path| {
                    defer c_allocator.free(path);
                    const flags: O = .{ .DIRECTORY = true };
                    const flags_int: @typeInfo(O).@"struct".backing_integer.? = @bitCast(flags);
                    var result: c_int = undefined;
                    if (redirector.open(path, flags_int, 0, &result)) {
                        if (result > 0) {
                            if (c_allocator.create(RedirectedDir)) |dir| {
                                dir.* = .{ .fd = result };
                                return @bitCast(@intFromPtr(dir));
                            } else |_| {}
                        }
                        return -1;
                    }
                }
            }
            return 0;
        }

        fn readdirT(comptime T: type, dir: *std.c.DIR, info: *T) c_int {
            if (posix.readdir(dir)) |dirent| {
                info.attributes = 0;
                info.time_create = 0;
                info.time_access = 0;
                info.time_write = 0;
                info.size = 0;
                const name: [*:0]const u8 = @ptrCast(&dirent.name[0]);
                const len = @min(std.mem.len(name), @sizeOf(@FieldType(T, "name")) - 1);
                @memcpy(info.name[0 .. len + 1], name[0 .. len + 1]);
                return 0;
            } else {
                return -1;
            }
        }

        const FindData32 = extern struct {
            attributes: u32,
            time_create: i32,
            time_access: i32,
            time_write: i32,
            size: u32,
            name: [260]u8,
        };
        const FindData64 = extern struct {
            attributes: u32,
            time_create: i64,
            time_access: i64,
            time_write: i64,
            size: u64,
            name: [260]u8,
        };

        const A_NORMAL = 0x00;
        const A_RDONLY = 0x01;
        const A_HIDDEN = 0x02;
        const A_SYSTEM = 0x04;
        const A_SUBDIR = 0x10;
        const A_ARCH = 0x20;

        const Self = @This();
        pub const Original = struct {
            pub var lseeki64: *const @TypeOf(Self.lseeki64) = undefined;
            pub var _findclose: *const @TypeOf(Self._findclose) = undefined;
            pub var _findfirst32: *const @TypeOf(Self._findfirst32) = undefined;
            pub var _findfirst64: *const @TypeOf(Self._findfirst64) = undefined;
            pub var _findnext32: *const @TypeOf(Self._findnext32) = undefined;
            pub var _findnext64: *const @TypeOf(Self._findnext64) = undefined;
            pub var _open_osfhandle: *const @TypeOf(Self._open_osfhandle) = undefined;
            pub var _get_osfhandle: *const @TypeOf(Self._get_osfhandle) = undefined;

            pub extern var __stdio_common_vfprintf_orig: *const @TypeOf(Self.__stdio_common_vfprintf_hook);
            pub extern var __stdio_common_vfscanf_orig: *const @TypeOf(Self.__stdio_common_vfscanf_hook);
        };
        pub const calling_convention = std.builtin.CallingConvention.c;
    };
}

pub fn Win32SubstituteS(comptime redirector: type) type {
    return struct {
        pub fn CloseHandle(handle: HANDLE) callconv(WINAPI) BOOL {
            if (handle == temporary_handle) return TRUE;
            const fd = toDescriptor(handle);
            var result: c_int = undefined;
            if (redirector.close(fd, &result)) {
                return saveError(result);
            }
            return Original.CloseHandle(handle);
        }

        pub fn CreateDirectoryA(
            path: LPCSTR,
            security_attributes: *SECURITY_ATTRIBUTES,
        ) callconv(WINAPI) BOOL {
            if (redirector.Host.isRedirecting(.mkdir)) {
                var result: c_int = undefined;
                if (redirector.mkdir(path, 0, &result)) {
                    return saveError(result);
                }
            }
            return Original.CreateDirectoryA(path, security_attributes);
        }

        pub fn CreateDirectoryW(
            path: LPCWSTR,
            security_attributes: *SECURITY_ATTRIBUTES,
        ) callconv(WINAPI) BOOL {
            if (redirector.Host.isRedirecting(.mkdir)) {
                var converter = Wtf8PathConverter.init(path, true) catch return FALSE;
                defer converter.deinit();
                return CreateDirectoryA(converter.path, security_attributes);
            }
            return Original.CreateDirectoryW(path, security_attributes);
        }

        pub fn CreateFileA(
            path: LPCSTR,
            desired_access: DWORD,
            share_mode: DWORD,
            security_attributes: *SECURITY_ATTRIBUTES,
            create_disposition: DWORD,
            flags_and_attributes: DWORD,
            template_file: HANDLE,
        ) callconv(WINAPI) ?HANDLE {
            if (redirector.Host.isRedirecting(.open)) {
                var oflags: O = switch (create_disposition) {
                    std.os.windows.CREATE_ALWAYS => .{ .CREAT = true, .TRUNC = true },
                    std.os.windows.CREATE_NEW => .{ .CREAT = true, .EXCL = true },
                    std.os.windows.OPEN_ALWAYS => .{ .CREAT = true },
                    std.os.windows.OPEN_EXISTING => .{},
                    std.os.windows.TRUNCATE_EXISTING => .{ .TRUNC = true },
                    else => .{},
                };
                const r_access = (desired_access & std.os.windows.GENERIC_READ) != 0;
                const w_access = (desired_access & std.os.windows.GENERIC_WRITE) != 0;
                if (r_access) {
                    oflags.ACCMODE = if (w_access) .RDWR else .RDONLY;
                } else if (w_access) {
                    oflags.ACCMODE = .WRONLY;
                }
                const oflags_int: u32 = @bitCast(oflags);
                const mode = 0;
                var fd: c_int = undefined;
                if (redirector.open(path, @intCast(oflags_int), mode, &fd)) {
                    if (fd < 0) {
                        _ = saveError(fd);
                        return null;
                    }
                    return fromDescriptor(fd);
                }
            }
            return Original.CreateFileA(path, desired_access, share_mode, security_attributes, create_disposition, flags_and_attributes, template_file);
        }

        pub fn CreateFileW(
            path: LPCWSTR,
            desired_access: DWORD,
            share_mode: DWORD,
            security_attributes: *SECURITY_ATTRIBUTES,
            create_disposition: DWORD,
            flags_and_attributes: DWORD,
            template_file: HANDLE,
        ) callconv(WINAPI) ?HANDLE {
            if (redirector.Host.isRedirecting(.mkdir)) {
                var converter = Wtf8PathConverter.init(path, true) catch return std.os.windows.INVALID_HANDLE_VALUE;
                defer converter.deinit();
                return CreateFileA(converter.path, desired_access, share_mode, security_attributes, create_disposition, flags_and_attributes, template_file);
            }
            return Original.CreateFileW(path, desired_access, share_mode, security_attributes, create_disposition, flags_and_attributes, template_file);
        }

        pub fn CreateThread(
            thread_attributes: ?*SECURITY_ATTRIBUTES,
            stack_size: SIZE_T,
            start_address: LPTHREAD_START_ROUTINE,
            parameter: ?LPVOID,
            creation_flags: DWORD,
            thread_id: ?*DWORD,
        ) callconv(WINAPI) ?HANDLE {
            const instance = redirector.Host.getInstance() catch {
                _ = saveError(std.c.E.FAULT);
                return null;
            };
            const info = c_allocator.create(ThreadInfo) catch {
                _ = saveError(std.c.E.NOMEM);
                return null;
            };
            info.* = .{ .proc = start_address, .arg = parameter, .instance = instance };
            return Original.CreateThread(thread_attributes, stack_size, &setThreadContext, info, creation_flags, thread_id);
        }

        pub fn DeleteFileA(path: LPCSTR) callconv(WINAPI) BOOL {
            var result: c_int = undefined;
            if (redirector.unlink(path, &result)) {
                return saveError(result);
            }
            return Original.DeleteFileA(path);
        }

        pub fn DeleteFileW(path: LPCWSTR) callconv(WINAPI) BOOL {
            if (redirector.Host.isRedirecting(.unlink)) {
                var converter = Wtf8PathConverter.init(path, true) catch return FALSE;
                defer converter.deinit();
                return DeleteFileA(converter.path);
            }
            return Original.DeleteFileW(path);
        }

        pub fn GetFileAttributesA(path: LPCSTR) callconv(WINAPI) DWORD {
            var result: c_int = undefined;
            var stat: Stat = undefined;
            if (redirector.stat(path, &stat, &result)) {
                if (result == 0) {
                    return inferAttributes(stat);
                } else {
                    return std.os.windows.INVALID_FILE_ATTRIBUTES;
                }
            }
            return Original.GetFileAttributesA(path);
        }

        pub fn GetFileAttributesW(path: LPCWSTR) callconv(WINAPI) DWORD {
            if (redirector.Host.isRedirecting(.stat)) {
                var converter = Wtf8PathConverter.init(path, true) catch return std.os.windows.INVALID_FILE_ATTRIBUTES;
                defer converter.deinit();
                return GetFileAttributesA(converter.path);
            }
            return Original.GetFileAttributesW(path);
        }

        pub fn GetFileInformationByHandle(
            handle: HANDLE,
            file_information: *BY_HANDLE_FILE_INFORMATION,
        ) callconv(WINAPI) BOOL {
            const fd = toDescriptor(handle);
            var stat: std.os.wasi.filestat_t = undefined;
            var result: c_int = undefined;
            if (redirector.fstatT(std.os.wasi.filestat_t, fd, &stat, &result)) {
                if (result < 0) return saveError(result);
                file_information.* = .{
                    .dwFileAttributes = switch (stat.filetype) {
                        .DIRECTORY => std.os.windows.FILE_ATTRIBUTE_DIRECTORY,
                        .SYMBOLIC_LINK => std.os.windows.FILE_ATTRIBUTE_REPARSE_POINT,
                        else => std.os.windows.FILE_ATTRIBUTE_NORMAL,
                    },
                    .nFileIndexLow = @truncate(stat.ino),
                    .nFileIndexHigh = @truncate(stat.ino >> 32),
                    .nFileSizeLow = @truncate(stat.size),
                    .nFileSizeHigh = @truncate(stat.size >> 32),
                    .nNumberOfLinks = @intCast(stat.nlink),
                    .ftCreationTime = std.os.windows.nanoSecondsToFileTime(stat.ctim),
                    .ftLastAccessTime = std.os.windows.nanoSecondsToFileTime(stat.atim),
                    .ftLastWriteTime = std.os.windows.nanoSecondsToFileTime(stat.mtim),
                    .dwVolumeSerialNumber = 0,
                };
                return TRUE;
            }
            return Original.GetFileInformationByHandle(handle, file_information);
        }

        pub fn GetFileSize(handle: HANDLE, size_high: ?*DWORD) callconv(WINAPI) DWORD {
            const fd = toDescriptor(handle);
            var stat: std.os.wasi.filestat_t = undefined;
            var result: c_int = undefined;
            if (redirector.fstatT(std.os.wasi.filestat_t, fd, &stat, &result)) {
                if (result < 0) {
                    _ = saveError(result);
                    return windows_h.INVALID_FILE_SIZE;
                }
                _ = windows_h.SetLastError(0);
                if (size_high) |ptr| ptr.* = @truncate(stat.size >> 32);
                return @truncate(stat.size);
            }
            return Original.GetFileSize(handle, size_high);
        }

        pub fn GetFileSizeEx(handle: HANDLE, size: *LARGE_INTEGER) callconv(WINAPI) BOOL {
            const fd = toDescriptor(handle);
            var stat: std.os.wasi.filestat_t = undefined;
            var result: c_int = undefined;
            if (redirector.fstatT(std.os.wasi.filestat_t, fd, &stat, &result)) {
                if (result < 0) return saveError(result);
                _ = windows_h.SetLastError(0);
                size.* = @intCast(stat.size);
                return TRUE;
            }
            return Original.GetFileSizeEx(handle, size);
        }

        pub fn GetHandleInformation(handle: HANDLE, flags: *DWORD) callconv(WINAPI) BOOL {
            if (isPrivateHandle(handle)) {
                flags.* = 0;
                return TRUE;
            }
            return Original.GetHandleInformation(handle, flags);
        }

        pub fn LockFile(
            handle: HANDLE,
            offset_low: DWORD,
            offset_high: DWORD,
            len_low: DWORD,
            len_high: DWORD,
        ) callconv(WINAPI) BOOL {
            const fd = toDescriptor(handle);
            const lock = createLockStruct(.{ offset_low, offset_high }, .{ len_low, len_high }, F.WRLCK);
            var result: c_int = undefined;
            if (redirector.fcntl(fd, F.SETLK, @intFromPtr(&lock), &result)) {
                return saveError(result);
            }
            return Original.LockFile(handle, offset_low, offset_high, len_low, len_high);
        }

        pub fn LockFileEx(
            handle: HANDLE,
            flags: DWORD,
            reserved: DWORD,
            len_low: DWORD,
            len_high: DWORD,
            overlapped: ?*OVERLAPPED,
        ) callconv(WINAPI) BOOL {
            const fd = toDescriptor(handle);
            if (isPrivateDescriptor(fd)) {
                signalBeginning(overlapped);
                defer signalCompletion(overlapped);
                const lock = createLockStruct(.{ 0, 0 }, .{ len_low, len_high }, if ((flags & windows_h.LOCKFILE_EXCLUSIVE_LOCK) != 0) F.WRLCK else F.RDLCK);
                var result: c_int = undefined;
                _ = redirector.fcntl(fd, F.SETLK, @intFromPtr(&lock), &result);
                return saveError(result);
            }
            return Original.LockFileEx(handle, flags, reserved, len_low, len_high, overlapped);
        }

        pub fn NtClose(handle: HANDLE) callconv(WINAPI) NTSTATUS {
            if (handle == temporary_handle) return .SUCCESS;
            const fd = toDescriptor(handle);
            var result: c_int = undefined;
            if (redirector.close(fd, &result)) {
                return if (result == 0) .SUCCESS else .INVALID_HANDLE;
            }
            return Original.NtClose(handle);
        }

        pub fn NtCreateFile(
            handle: *HANDLE,
            desired_access: ACCESS_MASK,
            object_attributes: *OBJECT_ATTRIBUTES,
            io_status_block: *IO_STATUS_BLOCK,
            allocation_size: ?*LARGE_INTEGER,
            file_attributes: ULONG,
            share_access: ULONG,
            create_disposition: ULONG,
            create_options: ULONG,
            ea_buffer: ?*anyopaque,
            ea_length: ULONG,
        ) callconv(WINAPI) NTSTATUS {
            const dirfd: c_int = if (object_attributes.RootDirectory) |dh| toDescriptor(dh) else fd_cwd;
            const delete_op = (desired_access & std.os.windows.DELETE) != 0;
            const dir_op = (create_options & std.os.windows.FILE_DIRECTORY_FILE) != 0;
            const redirecting = if (delete_op)
                if (dir_op) redirector.Host.isRedirecting(.rmdir) else redirector.Host.isRedirecting(.unlink)
            else
                redirector.Host.isRedirecting(.open);
            if (isPrivateDescriptor(dirfd) or (dirfd == fd_cwd and redirecting)) {
                const object_name = object_attributes.ObjectName;
                const name_len = @divExact(object_name.Length, 2);
                const path = object_name.Buffer.?[0..name_len];
                var converter = Wtf8PathConverter.init(path, false) catch return .NO_MEMORY;
                defer converter.deinit();
                converter.removeNtPrefix();
                if (delete_op) {
                    // an unlink or rmdir operation actually
                    var result: c_int = undefined;
                    const flags: c_int = if (dir_op) AT.REMOVEDIR else 0;
                    if (redirector.unlinkat(dirfd, converter.path, flags, &result)) {
                        if (result < 0) return .OBJECT_PATH_NOT_FOUND;
                        handle.* = temporary_handle;
                        io_status_block.Information = windows_h.FILE_CREATED;
                        return .SUCCESS;
                    }
                } else {
                    const mode = 0;
                    if (dir_op) {
                        if (create_disposition != std.os.windows.FILE_CREATE) return .ACCESS_DENIED;
                        var result: c_int = undefined;
                        if (redirector.mkdirat(dirfd, converter.path, mode, &result)) {
                            if (result < 0) return .ACCESS_DENIED;
                            handle.* = temporary_handle;
                            io_status_block.Information = windows_h.FILE_CREATED;
                            return .SUCCESS;
                        }
                    } else {
                        var oflags: O = switch (create_disposition) {
                            std.os.windows.FILE_SUPERSEDE => .{ .CREAT = true, .TRUNC = true },
                            std.os.windows.FILE_CREATE => .{ .CREAT = true },
                            std.os.windows.FILE_OPEN => .{},
                            std.os.windows.FILE_OPEN_IF => .{ .CREAT = true },
                            std.os.windows.FILE_OVERWRITE => .{ .CREAT = true, .TRUNC = true },
                            std.os.windows.FILE_OVERWRITE_IF => .{ .CREAT = true, .TRUNC = true },
                            else => .{},
                        };
                        const r_access = (desired_access & std.os.windows.GENERIC_READ) != 0;
                        const w_access = (desired_access & std.os.windows.GENERIC_WRITE) != 0;
                        if (r_access) {
                            oflags.ACCMODE = if (w_access) .RDWR else .RDONLY;
                        } else if (w_access) {
                            oflags.ACCMODE = .WRONLY;
                        }
                        const oflags_int: u32 = @bitCast(oflags);
                        var fd: c_int = undefined;
                        if (redirector.openat(dirfd, converter.path, @intCast(oflags_int), mode, &fd)) {
                            if (fd < 0) return .OBJECT_PATH_NOT_FOUND;
                            handle.* = fromDescriptor(fd);
                            io_status_block.Information = switch (create_disposition) {
                                std.os.windows.FILE_SUPERSEDE => windows_h.FILE_SUPERSEDED,
                                std.os.windows.FILE_CREATE => windows_h.FILE_CREATED,
                                std.os.windows.FILE_OPEN, std.os.windows.FILE_OPEN_IF => windows_h.FILE_OPENED,
                                std.os.windows.FILE_OVERWRITE, std.os.windows.FILE_OVERWRITE_IF => windows_h.FILE_OVERWRITTEN,
                                else => windows_h.FILE_OPENED,
                            };
                            return .SUCCESS;
                        }
                    }
                }
            }
            return Original.NtCreateFile(handle, desired_access, object_attributes, io_status_block, allocation_size, file_attributes, share_access, create_disposition, create_options, ea_buffer, ea_length);
        }

        pub fn NtLockFile(
            handle: HANDLE,
            event: ?HANDLE,
            apc_routine: ?*IO_APC_ROUTINE,
            apc_context: *anyopaque,
            io_status_block: *IO_STATUS_BLOCK,
            offset: *const LARGE_INTEGER,
            len: *const LARGE_INTEGER,
            key: ?*ULONG,
            fail_immediately: BOOLEAN,
            exclusive: BOOLEAN,
        ) callconv(WINAPI) NTSTATUS {
            const fd = toDescriptor(handle);
            const lock = createLockStruct(offset, len, if (exclusive != 0) F.WRLCK else F.RDLCK);
            var result: c_int = undefined;
            if (redirector.fcntl(fd, F.SETLK, @intFromPtr(&lock), &result)) {
                const status: NTSTATUS = if (result == 0) .SUCCESS else .LOCK_NOT_GRANTED;
                const status_int = @intFromEnum(status);
                io_status_block.Information = status_int;
                if (apc_routine) |f| {
                    f.*(apc_context, io_status_block, status_int);
                }
                return status;
            }
            return Original.NtLockFile(handle, event, apc_routine, apc_context, io_status_block, offset, len, key, fail_immediately, exclusive);
        }

        pub fn NtQueryDirectoryFile(
            handle: HANDLE,
            event: ?HANDLE,
            apc_routine: ?IO_APC_ROUTINE,
            apc_context: ?*anyopaque,
            io_status_block: *IO_STATUS_BLOCK,
            file_information: *anyopaque,
            length: ULONG,
            file_information_class: FILE_INFORMATION_CLASS,
            return_single_entry: BOOLEAN,
            file_name: ?*UNICODE_STRING,
            restart_scan: BOOLEAN,
        ) callconv(WINAPI) NTSTATUS {
            const dirfd = toDescriptor(handle);
            if (isPrivateDescriptor(dirfd)) {
                const file_information_classes: [3]struct { id: FILE_INFORMATION_CLASS, T: type } = .{
                    .{ .id = .FileDirectoryInformation, .T = std.os.windows.FILE_DIRECTORY_INFORMATION },
                    .{ .id = .FileBothDirectoryInformation, .T = std.os.windows.FILE_BOTH_DIR_INFORMATION },
                    .{ .id = .FileNamesInformation, .T = windows_h.FILE_NAMES_INFORMATION },
                };
                inline for (file_information_classes) |cls| {
                    if (cls.id == file_information_class) break;
                } else return .NOT_IMPLEMENTED;
                if (restart_scan == TRUE) {
                    var seek_result: off64_t = undefined;
                    _ = redirector.lseek64(dirfd, 0, std.c.SEEK.SET, &seek_result);
                    if (seek_result != 0) return .INVALID_HANDLE;
                }
                var stb = std.heap.stackFallback(1024 * 8, c_allocator);
                const allocator = stb.get();
                const src_buffer = allocator.alloc(u8, length) catch return .NO_MEMORY;
                defer allocator.free(src_buffer);
                var result: c_int = undefined;
                _ = redirector.getdentsT(std.os.wasi.dirent_t, dirfd, src_buffer.ptr, length, &result);
                if (result < 0) return .NO_MORE_FILES;
                const src_used: usize = @intCast(result);
                const src_name_offset = @sizeOf(std.os.wasi.dirent_t);
                const buffer: [*]u8 = @ptrCast(file_information);
                var src_offset: usize = 0;
                var offset: usize = 0;
                var next_pos: off64_t = 0;
                var more: bool = false;
                inline for (file_information_classes) |cls| {
                    if (cls.id == file_information_class) {
                        const NtDirent = cls.T;
                        var prev_entry: ?*align(2) NtDirent = null;
                        while (src_offset + src_name_offset < src_used) {
                            const src_entry: *align(1) std.os.wasi.dirent_t = @ptrCast(&src_buffer[src_offset]);
                            const entry: *align(2) NtDirent = @ptrCast(@alignCast(&buffer[offset]));
                            const wtf8_name_len: usize = src_entry.namlen;
                            const wtf8_name: [*]const u8 = @ptrCast(&src_buffer[src_offset + src_name_offset]);
                            const src_name = std.unicode.wtf8ToWtf16LeAlloc(allocator, wtf8_name[0..wtf8_name_len]) catch continue;
                            const reclen = @sizeOf(NtDirent) + src_name.len * 2;
                            if (offset + reclen >= length) {
                                // retrieved too much data--reposition cursor before exiting
                                var seek_result: off64_t = undefined;
                                _ = redirector.lseek64(dirfd, next_pos, std.c.SEEK.SET, &seek_result);
                                more = true;
                                break;
                            }
                            if (prev_entry) |ptr| ptr.NextEntryOffset = @intCast(@intFromPtr(entry) - @intFromPtr(ptr));
                            entry.* = std.mem.zeroes(NtDirent);
                            entry.FileIndex = @truncate(src_entry.next);
                            entry.FileNameLength = @intCast(src_name.len * 2);
                            const name: [*]u16 = @ptrCast(&entry.FileName[0]);
                            @memcpy(name[0..src_name.len], src_name);
                            name[src_name.len] = 0;
                            if (@hasField(NtDirent, "FileAttributes")) {
                                entry.FileAttributes = switch (src_entry.type) {
                                    .DIRECTORY => std.os.windows.FILE_ATTRIBUTE_DIRECTORY,
                                    .SYMBOLIC_LINK => std.os.windows.FILE_ATTRIBUTE_REPARSE_POINT,
                                    else => std.os.windows.FILE_ATTRIBUTE_NORMAL,
                                };
                            }
                            src_offset += src_name_offset + wtf8_name_len;
                            offset += reclen;
                            next_pos = @intCast(src_entry.next);
                            prev_entry = entry;
                        }
                        break;
                    }
                } else unreachable;
                const status: NTSTATUS = if (offset > 0) .SUCCESS else .NO_MORE_FILES;
                io_status_block.Information = offset;
                io_status_block.u.Status = status;
                return status;
            }
            return Original.NtQueryDirectoryFile(handle, event, apc_routine, apc_context, io_status_block, file_information, length, file_information_class, return_single_entry, file_name, restart_scan);
        }

        pub fn NtQueryInformationFile(
            handle: HANDLE,
            io_status_block: *IO_STATUS_BLOCK,
            file_information: *anyopaque,
            length: ULONG,
            file_information_class: FILE_INFORMATION_CLASS,
        ) callconv(WINAPI) NTSTATUS {
            const fd = toDescriptor(handle);
            var stat: std.os.wasi.filestat_t = undefined;
            var result: c_int = undefined;
            if (redirector.fstatT(std.os.wasi.filestat_t, fd, &stat, &result)) {
                const copy = struct {
                    fn basic(d: *std.os.windows.FILE_BASIC_INFORMATION, s: std.os.wasi.filestat_t) void {
                        d.* = .{
                            .FileAttributes = switch (s.filetype) {
                                .DIRECTORY => std.os.windows.FILE_ATTRIBUTE_DIRECTORY,
                                else => std.os.windows.FILE_ATTRIBUTE_NORMAL,
                            },
                            .LastAccessTime = std.os.windows.toSysTime(s.atim),
                            .LastWriteTime = std.os.windows.toSysTime(s.mtim),
                            .ChangeTime = std.os.windows.toSysTime(s.ctim),
                            .CreationTime = std.os.windows.toSysTime(s.ctim),
                        };
                    }

                    fn internal(d: *std.os.windows.FILE_INTERNAL_INFORMATION, s: std.os.wasi.filestat_t) void {
                        d.* = .{ .IndexNumber = @intCast(s.ino) };
                    }

                    fn name(d: *std.os.windows.FILE_NAME_INFORMATION, n: []const u8) void {
                        d.FileNameLength = @intCast(n.len);
                        const buf: [*]u16 = @ptrCast(&d.FileName[0]);
                        _ = std.unicode.wtf8ToWtf16Le(buf[0..n.len], n) catch unreachable;
                        buf[n.len] = 0;
                    }

                    fn standard(d: *std.os.windows.FILE_STANDARD_INFORMATION, s: std.os.wasi.filestat_t) void {
                        d.* = .{
                            .AllocationSize = @intCast(std.mem.alignForward(u64, s.size, 4096)),
                            .EndOfFile = @intCast(s.size),
                            .NumberOfLinks = @intCast(s.nlink),
                            .DeletePending = TRUE,
                            .Directory = if (s.filetype == .DIRECTORY) TRUE else FALSE,
                        };
                    }

                    fn unsupported(d: anytype) void {
                        d.* = std.mem.zeroes(@TypeOf(d.*));
                    }
                };
                switch (file_information_class) {
                    .FileAllInformation => {
                        const info: *std.os.windows.FILE_ALL_INFORMATION = @ptrCast(@alignCast(file_information));
                        copy.unsupported(&info.AccessInformation);
                        copy.unsupported(&info.AlignmentInformation);
                        copy.basic(&info.BasicInformation, stat);
                        copy.unsupported(&info.EaInformation);
                        copy.internal(&info.InternalInformation, stat);
                        copy.unsupported(&info.ModeInformation);
                        copy.unsupported(&info.PositionInformation);
                        copy.standard(&info.StandardInformation, stat);
                        const name: ?[]u8 = get: {
                            const struct_size = @sizeOf(@TypeOf(info.*));
                            if (length > struct_size) {
                                var wtf8_buf: [128]u8 = undefined;
                                const n = std.fmt.bufPrintZ(&wtf8_buf, fd_format_string, .{fd}) catch unreachable;
                                // copy it if it fits
                                if (n.len <= length - struct_size) break :get n;
                            }
                            break :get null;
                        };
                        if (name) |n| {
                            copy.name(&info.NameInformation, n);
                        } else {
                            copy.unsupported(&info.NameInformation);
                            return .BUFFER_OVERFLOW;
                        }
                    },
                    .FileBasicInformation => {
                        const info: *std.os.windows.FILE_BASIC_INFORMATION = @ptrCast(@alignCast(file_information));
                        copy.basic(info, stat);
                    },
                    .FileInternalInformation => {
                        const info: *std.os.windows.FILE_INTERNAL_INFORMATION = @ptrCast(@alignCast(file_information));
                        copy.internal(info, stat);
                    },
                    .FileNameInformation => {
                        const info: *std.os.windows.FILE_NAME_INFORMATION = @ptrCast(@alignCast(file_information));
                        const name: ?[]u8 = get: {
                            const struct_size = @sizeOf(@TypeOf(info.*));
                            if (length > struct_size) {
                                var wtf8_buf: [128]u8 = undefined;
                                const n = std.fmt.bufPrintZ(&wtf8_buf, fd_format_string, .{fd}) catch unreachable;
                                // copy it if it fits
                                if (n.len <= length - struct_size) break :get n;
                            }
                            break :get null;
                        };
                        if (name) |n| {
                            copy.name(info, n);
                        } else {
                            copy.unsupported(info);
                            return .BUFFER_OVERFLOW;
                        }
                    },
                    .FileStandardInformation => {
                        const info: *std.os.windows.FILE_STANDARD_INFORMATION = @ptrCast(@alignCast(file_information));
                        copy.standard(info, stat);
                    },
                    else => return .ACCESS_DENIED,
                }
                return .SUCCESS;
            }
            return Original.NtQueryInformationFile(handle, io_status_block, file_information, length, file_information_class);
        }

        pub fn NtQueryObject(
            handle: HANDLE,
            object_information_class: OBJECT_INFORMATION_CLASS,
            object_information: LPVOID,
            object_information_length: ULONG,
            return_length: ?*ULONG,
        ) callconv(WINAPI) NTSTATUS {
            const fd = toDescriptor(handle);
            if (isPrivateDescriptor(fd)) {
                switch (object_information_class) {
                    .ObjectNameInformation => {
                        var wtf8_buf: [128]u8 = undefined;
                        const name = std.fmt.bufPrintZ(&wtf8_buf, fd_format_string, .{fd}) catch unreachable;
                        const name_offset = @sizeOf(OBJECT_NAME_INFORMATION);
                        if (object_information_length > @sizeOf(OBJECT_NAME_INFORMATION)) {
                            const info: *OBJECT_NAME_INFORMATION = @ptrCast(@alignCast(object_information));
                            const info_bytes: [*]u8 = @ptrCast(object_information);
                            const name_buf: [*]WCHAR = @ptrCast(@alignCast(info_bytes[name_offset..]));
                            const max_len: usize = object_information_length - name_offset - 2;
                            if (name.len * 2 > max_len) return .BUFFER_OVERFLOW;
                            const len = @max(name.len * 2, max_len);
                            _ = std.unicode.wtf8ToWtf16Le(name_buf[0..name.len], name) catch unreachable;
                            name_buf[name.len] = 0;
                            info.Name = .{
                                .Buffer = name_buf,
                                .Length = @intCast(len),
                                .MaximumLength = @intCast(max_len),
                            };
                        }
                        if (return_length) |ptr| ptr.* = @intCast(name_offset + (name.len + 1) * 2);
                        return .SUCCESS;
                    },
                    else => return .INVALID_HANDLE,
                }
            }
            return Original.NtQueryObject(handle, object_information_class, object_information, object_information_length, return_length);
        }

        pub fn NtSetInformationFile(
            handle: HANDLE,
            io_status_block: *IO_STATUS_BLOCK,
            file_information: LPVOID,
            length: ULONG,
            file_information_class: FILE_INFORMATION_CLASS,
        ) callconv(WINAPI) NTSTATUS {
            if (handle == temporary_handle or isPrivateHandle(handle)) {
                return .SUCCESS;
            }
            return Original.NtSetInformationFile(handle, io_status_block, file_information, length, file_information_class);
        }

        pub fn NtUnlockFile(
            handle: HANDLE,
            io_status_block: *IO_STATUS_BLOCK,
            offset: *const LARGE_INTEGER,
            len: *const LARGE_INTEGER,
            key: ?*ULONG,
        ) callconv(WINAPI) NTSTATUS {
            const fd = toDescriptor(handle);
            const lock = createLockStruct(offset, len, F.UNLCK);
            var result: c_int = undefined;
            if (redirector.fcntl(fd, F.SETLK, @intFromPtr(&lock), &result)) {
                const status: NTSTATUS = if (result == 0) .SUCCESS else .LOCK_NOT_GRANTED;
                io_status_block.Information = @intFromEnum(status);
                return status;
            }
            return Original.NtUnlockFile(handle, io_status_block, offset, len, key);
        }

        pub fn ReadFile(
            handle: HANDLE,
            buffer: LPVOID,
            len: DWORD,
            read: *DWORD,
            overlapped: ?*OVERLAPPED,
        ) callconv(WINAPI) BOOL {
            const fd = toDescriptor(handle);
            if (isPrivateDescriptor(fd)) {
                const len_s = cast(off_t, len, true) catch return FALSE;
                var result: off_t = undefined;
                if (extractOffset(overlapped) catch return FALSE) |offset| {
                    signalBeginning(overlapped);
                    defer signalCompletion(overlapped);
                    var result64: off64_t = undefined;
                    _ = redirector.pread64(fd, @ptrCast(buffer), len_s, offset, &result64);
                    result = @intCast(result64);
                } else {
                    _ = redirector.read(fd, @ptrCast(buffer), len_s, &result);
                }
                if (result < 0) return saveError(result);
                read.* = cast(DWORD, result, true) catch return FALSE;
                return TRUE;
            }
            return Original.ReadFile(handle, buffer, len, read, overlapped);
        }

        pub fn RemoveDirectoryA(path: LPCSTR) callconv(WINAPI) BOOL {
            var result: c_int = undefined;
            if (redirector.rmdir(path, &result)) {
                return saveError(result);
            }
            return Original.RemoveDirectoryA(path);
        }

        pub fn RemoveDirectoryW(path: LPCWSTR) callconv(WINAPI) BOOL {
            if (redirector.Host.isRedirecting(.rmdir)) {
                var converter = Wtf8PathConverter.init(path, false) catch return FALSE;
                defer converter.deinit();
                return RemoveDirectoryA(converter.path);
            }
            return Original.RemoveDirectoryW(path);
        }

        pub fn SetFilePointer(
            handle: HANDLE,
            offset: LONG,
            offset_high: ?*LONG,
            method: DWORD,
        ) callconv(WINAPI) DWORD {
            const fd = toDescriptor(handle);
            var offset_long: off64_t = offset;
            if (offset_high) |ptr| offset_long |= @as(i64, ptr.*) << 32;
            var result: off64_t = undefined;
            const whence: c_int = @intCast(method);
            if (redirector.lseek64(fd, offset_long, whence, &result)) {
                if (result < 0) {
                    _ = saveError(result);
                    return windows_h.INVALID_SET_FILE_POINTER;
                }
                _ = windows_h.SetLastError(0);
                if (offset_high) |ptr| ptr.* = @truncate(result >> 32);
                return @truncate(@as(u64, @bitCast(result)));
            }
            return Original.SetFilePointer(handle, offset, offset_high, method);
        }

        pub fn SetFilePointerEx(
            handle: HANDLE,
            offset: LARGE_INTEGER,
            new_pos: ?*LARGE_INTEGER,
            method: DWORD,
        ) callconv(WINAPI) BOOL {
            const fd = toDescriptor(handle);
            const whence: c_int = @intCast(method);
            var result: off64_t = undefined;
            if (redirector.lseek64(fd, offset, whence, &result)) {
                if (result < 0) return saveError(result);
                if (new_pos) |ptr| ptr.* = result;
                return TRUE;
            }
            return Original.SetFilePointerEx(handle, offset, new_pos, method);
        }

        pub fn SetHandleInformation(handle: HANDLE, mask: DWORD, flags: DWORD) callconv(WINAPI) BOOL {
            if (handle == temporary_handle or isPrivateHandle(handle)) {
                return FALSE;
            }
            return Original.SetHandleInformation(handle, mask, flags);
        }

        pub fn UnlockFile(
            handle: HANDLE,
            offset_low: DWORD,
            offset_high: DWORD,
            len_low: DWORD,
            len_high: DWORD,
        ) callconv(WINAPI) BOOL {
            const fd = toDescriptor(handle);
            const lock = createLockStruct(.{ offset_low, offset_high }, .{ len_low, len_high }, F.UNLCK);
            var result: c_int = undefined;
            if (redirector.fcntl(fd, F.SETLK, @intFromPtr(&lock), &result)) {
                return saveError(result);
            }
            return Original.UnlockFile(handle, offset_low, offset_high, len_low, len_high);
        }

        pub fn UnlockFileEx(
            handle: HANDLE,
            flags: DWORD,
            len_low: DWORD,
            len_high: DWORD,
            overlapped: *OVERLAPPED,
        ) callconv(WINAPI) BOOL {
            const fd = toDescriptor(handle);
            if (isPrivateDescriptor(fd)) {
                signalBeginning(overlapped);
                defer signalCompletion(overlapped);
                const lock = createLockStruct(.{ 0, 0 }, .{ len_low, len_high }, F.UNLCK);
                var result: c_int = undefined;
                _ = redirector.fcntl(fd, F.SETLK, @intFromPtr(&lock), &result);
                return saveError(result);
            }
            return Original.UnlockFileEx(handle, flags, len_low, len_high, overlapped);
        }

        pub fn WriteFile(
            handle: HANDLE,
            buffer: LPCVOID,
            len: DWORD,
            written: *DWORD,
            overlapped: ?*OVERLAPPED,
        ) callconv(WINAPI) BOOL {
            const fd = toDescriptor(handle);
            if (isPrivateDescriptor(fd)) {
                const len_s = cast(off_t, len, true) catch return FALSE;
                var result: off_t = undefined;
                if (extractOffset(overlapped) catch return FALSE) |offset| {
                    signalBeginning(overlapped);
                    defer signalCompletion(overlapped);
                    var result64: off64_t = undefined;
                    _ = redirector.pwrite64(fd, @ptrCast(buffer), len_s, offset, &result64);
                    result = @intCast(result64);
                } else {
                    _ = redirector.write(fd, @ptrCast(buffer), len_s, &result);
                }
                if (result < 0) return saveError(result);
                written.* = cast(DWORD, result, true) catch return FALSE;
                return TRUE;
            }
            return Original.WriteFile(handle, buffer, len, written, overlapped);
        }

        fn toDescriptor(handle: HANDLE) c_int {
            if (handle == std.os.windows.INVALID_HANDLE_VALUE) return -1;
            return inline for (0..3) |i| {
                if (handle == std_stream.get(i)) break @intCast(i);
            } else std.math.cast(c_int, @intFromPtr(handle) >> 1) orelse -1;
        }

        fn fromDescriptor(fd: c_int) HANDLE {
            if (fd < 0) return std.os.windows.INVALID_HANDLE_VALUE;
            return inline for (0..3) |i| {
                if (fd == @as(c_int, @intCast(i))) break std_stream.get(i);
            } else @ptrFromInt(@as(usize, @intCast(fd << 1)));
        }

        fn isPrivateHandle(handle: HANDLE) bool {
            const fd = toDescriptor(handle);
            return isPrivateDescriptor(fd);
        }

        fn isPrivateDescriptor(fd: c_int) bool {
            return redirector.isPrivateDescriptor(fd);
        }

        fn cast(comptime T: type, value: anytype, comptime set_error: bool) !T {
            return std.math.cast(T, value) orelse fail: {
                if (set_error) {
                    _ = windows_h.SetLastError(windows_h.ERROR_INVALID_PARAMETER);
                }
                break :fail error.IntegerOverflow;
            };
        }

        fn saveError(result: anytype) BOOL {
            const code = translateError(result);
            if (code == 0) {
                return TRUE;
            } else {
                _ = windows_h.SetLastError(code);
                return FALSE;
            }
        }

        fn translateError(result: anytype) DWORD {
            const T = @TypeOf(result);
            const err: std.c.E = switch (@typeInfo(T)) {
                .@"enum" => result,
                .int => if (result >= 0) return 0 else convert: {
                    const num: u16 = @intCast(-result);
                    break :convert std.meta.intToEnum(std.c.E, num) catch .FAULT;
                },
                else => @compileError("Unexpected"),
            };
            return switch (err) {
                .SUCCESS => 0,
                .PERM => windows_h.ERROR_ACCESS_DENIED,
                .NOENT => windows_h.ERROR_FILE_NOT_FOUND,
                .BADF => windows_h.ERROR_INVALID_HANDLE,
                .NOMEM => windows_h.ERROR_NOT_ENOUGH_MEMORY,
                .ACCES => windows_h.ERROR_INVALID_ACCESS,
                .FAULT => windows_h.ERROR_INVALID_ADDRESS,
                .BUSY => windows_h.ERROR_BUSY,
                .NOTDIR => windows_h.ERROR_DIRECTORY,
                .NODEV => windows_h.ERROR_DEV_NOT_EXIST,
                .EXIST => windows_h.ERROR_FILE_EXISTS,
                .INVAL => windows_h.ERROR_BAD_ARGUMENTS,
                .NFILE, .MFILE => windows_h.ERROR_TOO_MANY_OPEN_FILES,
                .FBIG => windows_h.ERROR_FILE_TOO_LARGE,
                .NOSPC => windows_h.ERROR_DISK_FULL,
                .SPIPE => windows_h.ERROR_SEEK_ON_DEVICE,
                .NAMETOOLONG => windows_h.ERROR_INVALID_NAME,
                .NOLCK => windows_h.ERROR_LOCK_FAILED,
                .NOTEMPTY => windows_h.ERROR_DIR_NOT_EMPTY,
                else => windows_h.ERROR_BAD_ARGUMENTS,
            };
        }

        fn extractOffset(overlapped: ?*OVERLAPPED) !?off64_t {
            const ptr = overlapped orelse return null;
            const low = @as(u64, ptr.DUMMYUNIONNAME.DUMMYSTRUCTNAME.Offset);
            const high = @as(u64, ptr.DUMMYUNIONNAME.DUMMYSTRUCTNAME.OffsetHigh);
            return try cast(off64_t, low | high << 32, true);
        }

        fn signalBeginning(overlapped: ?*OVERLAPPED) void {
            if (overlapped) |o| {
                if (o.hEvent) |e| _ = windows_h.ResetEvent(e);
            }
        }

        fn signalCompletion(overlapped: ?*OVERLAPPED) void {
            if (overlapped) |o| {
                if (o.hEvent) |e| _ = windows_h.SetEvent(e);
            }
        }

        fn createLockStruct(offset: anytype, len: anytype, lock_type: i16) Flock {
            return .{
                .type = lock_type,
                .whence = std.c.SEEK.SET,
                .start = decodeOffset(offset),
                .len = decodeOffset(len),
                .pid = 0,
            };
        }

        fn decodeOffset(offset: anytype) i64 {
            const T = @TypeOf(offset);
            const value = switch (@typeInfo(T)) {
                .int => offset,
                .pointer => offset.*,
                .@"struct" => @as(u64, offset[0]) | @as(u64, offset[1]) << 32,
                else => @compileError("Unexpected: " ++ @typeName(T)),
            };
            return @intCast(value);
        }

        fn decodePath(path: []const u8) std.meta.Tuple(&.{ []const u8, c_int }) {
            if (std.mem.startsWith(u8, path, fd_path_prefix)) |index| {
                const subpath = path[index..];
                const slash_index = std.mem.indexOfScalar(u8, subpath, '\\') orelse subpath.len;
                const num_string = subpath[0..slash_index];
                const dirfd = std.fmt.parseInt(u8, num_string, 16) catch -1;
                return .{ subpath[slash_index..], dirfd };
            }
            return .{ path, -1 };
        }

        fn inferAttributes(stat: Stat) DWORD {
            var attributes: DWORD = 0;
            if ((stat.mode & std.c.W_OK) == 0) {
                attributes |= std.os.windows.FILE_ATTRIBUTE_READONLY;
            }
            if ((stat.mode & S.IFDIR) != 0) {
                attributes |= std.os.windows.FILE_ATTRIBUTE_DIRECTORY;
            }
            if (attributes == 0) {
                attributes = std.os.windows.FILE_ATTRIBUTE_NORMAL;
            }
            return attributes;
        }

        fn setThreadContext(ptr: LPVOID) callconv(WINAPI) DWORD {
            const info: *ThreadInfo = @ptrCast(@alignCast(ptr));
            const proc: *const fn (?LPVOID) callconv(WINAPI) DWORD = @ptrCast(info.proc);
            const arg = info.arg;
            const instance = info.instance;
            c_allocator.destroy(info);
            redirector.Host.initializeThread(instance) catch {
                @panic("Unable to initialize thread");
            };
            defer redirector.Host.deinitializeThread() catch {};
            return proc(arg);
        }

        const temporary_handle: HANDLE = @ptrFromInt(0x1fff_ffff);
        const fd_format_string = "\\\\??\\UNC\\@zigar\\fd\\{x}";
        const fd_path_prefix = fd_format_string[0 .. fd_format_string.len - 3];

        const std_stream = struct {
            var handles: [3]?HANDLE = .{ null, null, null };
            fn get(comptime index: usize) HANDLE {
                const ids = .{ std.os.windows.STD_INPUT_HANDLE, std.os.windows.STD_OUTPUT_HANDLE, std.os.windows.STD_ERROR_HANDLE };
                return handles[index] orelse find: {
                    const handle = std.os.windows.GetStdHandle(ids[index]) catch std.os.windows.INVALID_HANDLE_VALUE;
                    handles[index] = handle;
                    break :find handle;
                };
            }
        };
        const windows_h = @cImport({
            @cInclude("windows.h");
            @cInclude("winternl.h");
        });

        const ACCESS_MASK = std.os.windows.ACCESS_MASK;
        const BOOL = std.os.windows.BOOL;
        const BOOLEAN = std.os.windows.BOOLEAN;
        const BY_HANDLE_FILE_INFORMATION = std.os.windows.BY_HANDLE_FILE_INFORMATION;
        const DWORD = std.os.windows.DWORD;
        const FILE_INFORMATION_CLASS = std.os.windows.FILE_INFORMATION_CLASS;
        const HANDLE = std.os.windows.HANDLE;
        const IO_STATUS_BLOCK = std.os.windows.IO_STATUS_BLOCK;
        const IO_APC_ROUTINE = std.os.windows.IO_APC_ROUTINE;
        const LARGE_INTEGER = std.os.windows.LARGE_INTEGER;
        const LONG = std.os.windows.LONG;
        const LPCSTR = std.os.windows.LPCSTR;
        const LPCVOID = std.os.windows.LPCVOID;
        const LPCWSTR = std.os.windows.LPCWSTR;
        const LPOVERLAPPED_COMPLETION_ROUTINE = std.os.windows.LPOVERLAPPED_COMPLETION_ROUTINE;
        const LPTHREAD_START_ROUTINE = std.os.windows.LPTHREAD_START_ROUTINE;
        const LPVOID = std.os.windows.LPVOID;
        const NTSTATUS = std.os.windows.NTSTATUS;
        const OBJECT_ATTRIBUTES = std.os.windows.OBJECT_ATTRIBUTES;
        const OBJECT_NAME_INFORMATION = std.os.windows.OBJECT_NAME_INFORMATION;
        const OBJECT_INFORMATION_CLASS = std.os.windows.OBJECT_INFORMATION_CLASS;
        const OVERLAPPED = std.os.windows.OVERLAPPED;
        const SECURITY_ATTRIBUTES = std.os.windows.SECURITY_ATTRIBUTES;
        const SIZE_T = std.os.windows.SIZE_T;
        const ULONG = std.os.windows.ULONG;
        const UNICODE_STRING = std.os.windows.UNICODE_STRING;
        const WCHAR = std.os.windows.WCHAR;
        const FALSE = std.os.windows.FALSE;
        const TRUE = std.os.windows.TRUE;
        const WINAPI: std.builtin.CallingConvention = if (builtin.cpu.arch == .x86) .{ .x86_stdcall = .{} } else .c;

        const Wtf8PathConverter = struct {
            sfa: std.heap.StackFallbackAllocator(max_buffer_size),
            allocator: std.mem.Allocator,
            buffer: []u8,
            path: [*:0]const u8,

            const max_buffer_size = 1024;

            pub inline fn init(path: anytype, save_err: bool) !@This() {
                const T = @TypeOf(path);
                const path_s: []const u16 = switch (T) {
                    []const u16, []u16 => path,
                    [*:0]const u16, [*:0]u16 => path[0..std.mem.len(path)],
                    else => @compileError("Unexpected type: " ++ @typeName(T)),
                };
                var self: @This() = undefined;
                self.sfa = std.heap.stackFallback(max_buffer_size, c_allocator);
                try self._init(path_s, save_err);
                return self;
            }

            fn _init(self: *@This(), path: []const u16, save_err: bool) !void {
                self.allocator = self.sfa.get();
                const buf = std.unicode.wtf16LeToWtf8AllocZ(self.allocator, path) catch |err| {
                    if (save_err) _ = windows_h.SetLastError(windows_h.ERROR_NOT_ENOUGH_MEMORY);
                    return err;
                };
                self.buffer = buf;
                self.path = buf.ptr;
            }

            pub fn deinit(self: *@This()) void {
                self.allocator.free(self.buffer);
            }

            pub fn removeNtPrefix(self: *@This()) void {
                if (std.mem.startsWith(u8, self.buffer, "\\??\\")) {
                    const s = self.buffer[4..];
                    if (std.mem.startsWith(u8, s, "UNC\\")) {
                        s[2] = '\\';
                        self.path = @ptrCast(s[2..]);
                    } else {
                        self.path = @ptrCast(s);
                    }
                }
            }
        };

        const Self = @This();
        pub const Original = struct {
            pub var CloseHandle: *const @TypeOf(Self.CloseHandle) = undefined;
            pub var CreateDirectoryA: *const @TypeOf(Self.CreateDirectoryA) = undefined;
            pub var CreateDirectoryW: *const @TypeOf(Self.CreateDirectoryW) = undefined;
            pub var CreateFileA: *const @TypeOf(Self.CreateFileA) = undefined;
            pub var CreateFileW: *const @TypeOf(Self.CreateFileW) = undefined;
            pub var CreateThread: *const @TypeOf(Self.CreateThread) = undefined;
            pub var DeleteFileA: *const @TypeOf(Self.DeleteFileA) = undefined;
            pub var DeleteFileW: *const @TypeOf(Self.DeleteFileW) = undefined;
            pub var GetFileAttributesA: *const @TypeOf(Self.GetFileAttributesA) = undefined;
            pub var GetFileAttributesW: *const @TypeOf(Self.GetFileAttributesW) = undefined;
            pub var GetFileInformationByHandle: *const @TypeOf(Self.GetFileInformationByHandle) = undefined;
            pub var GetFileSize: *const @TypeOf(Self.GetFileSize) = undefined;
            pub var GetFileSizeEx: *const @TypeOf(Self.GetFileSizeEx) = undefined;
            pub var GetHandleInformation: *const @TypeOf(Self.GetHandleInformation) = undefined;
            pub var LockFile: *const @TypeOf(Self.LockFile) = undefined;
            pub var LockFileEx: *const @TypeOf(Self.LockFileEx) = undefined;
            pub var NtClose: *const @TypeOf(Self.NtClose) = undefined;
            pub var NtCreateFile: *const @TypeOf(Self.NtCreateFile) = undefined;
            pub var NtLockFile: *const @TypeOf(Self.NtLockFile) = undefined;
            pub var NtQueryDirectoryFile: *const @TypeOf(Self.NtQueryDirectoryFile) = undefined;
            pub var NtQueryInformationFile: *const @TypeOf(Self.NtQueryInformationFile) = undefined;
            pub var NtQueryObject: *const @TypeOf(Self.NtQueryObject) = undefined;
            pub var NtSetInformationFile: *const @TypeOf(Self.NtSetInformationFile) = undefined;
            pub var NtUnlockFile: *const @TypeOf(Self.NtUnlockFile) = undefined;
            pub var ReadFile: *const @TypeOf(Self.ReadFile) = undefined;
            pub var RemoveDirectoryA: *const @TypeOf(Self.RemoveDirectoryA) = undefined;
            pub var RemoveDirectoryW: *const @TypeOf(Self.RemoveDirectoryW) = undefined;
            pub var SetFilePointer: *const @TypeOf(Self.SetFilePointer) = undefined;
            pub var SetFilePointerEx: *const @TypeOf(Self.SetFilePointerEx) = undefined;
            pub var SetHandleInformation: *const @TypeOf(Self.SetHandleInformation) = undefined;
            pub var UnlockFile: *const @TypeOf(Self.UnlockFile) = undefined;
            pub var UnlockFileEx: *const @TypeOf(Self.UnlockFileEx) = undefined;
            pub var WriteFile: *const @TypeOf(Self.WriteFile) = undefined;
        };
        pub const calling_convention = WINAPI;
    };
}

pub const HandlerVTable = init: {
    const redirector = SyscallRedirector(void);
    const len = count: {
        var count: usize = 0;
        for (std.meta.declarations(redirector)) |decl| {
            const T = @TypeOf(@field(redirector, decl.name));
            if (@typeInfo(T) == .@"fn") count += 1;
        }
        break :count count;
    };
    var fields: [len]std.builtin.Type.StructField = undefined;
    var index: usize = 0;
    for (std.meta.declarations(redirector)) |decl| {
        const T = @TypeOf(@field(redirector, decl.name));
        if (@typeInfo(T) == .@"fn") {
            fields[index] = .{
                .name = decl.name,
                .type = *const T,
                .default_value_ptr = null,
                .is_comptime = false,
                .alignment = @alignOf(T),
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
        const T = @TypeOf(@field(redirector, decl.name));
        if (@typeInfo(T) == .@"fn") {
            @field(vtable, decl.name) = &@field(redirector, decl.name);
        }
    }
    return vtable;
}

pub fn getHookTable(comptime Host: type) std.StaticStringMap(Entry) {
    const redirector = SyscallRedirector(Host);
    const list = switch (os) {
        .linux => .{
            PosixSubstitute(redirector),
            LibcSubstitute(redirector),
            LinuxLibcSubstitute(redirector),
        },
        .darwin => .{
            PosixSubstitute(redirector),
            LibcSubstitute(redirector),
        },
        .windows => .{
            PosixSubstitute(redirector),
            LibcSubstitute(redirector),
            Win32LibcSubsitute(redirector),
            Win32SubstituteS(redirector),
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
            const handle_cc = @typeInfo(HandlerType).@"fn".calling_convention;
            if (!std.meta.eql(handle_cc, Sub.calling_convention)) {
                @compileError("Handler with wrong calling convention: " ++ handler_name);
            }
            if (Sub.Original == *const anyopaque) {
                @compileLog(name);
            }
            table[index] = .{ name, .{
                .handler = &@field(Sub, handler_name),
                .original = @ptrCast(&@field(Sub.Original, decl.name)),
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
