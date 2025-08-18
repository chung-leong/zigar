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
        advise: extern struct {
            fd: i32,
            offset: usize,
            len: usize,
            advice: std.os.wasi.advice_t,
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
            lock: Lock,
        },
        fstat: extern struct {
            fd: i32,
            stat: Filestat = undefined,
        },
        futimes: extern struct {
            fd: i32,
            atime: u64,
            mtime: u64,
            time_flags: std.os.wasi.fstflags_t = .{ .ATIM = true, .MTIM = true },
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
            atime: u64,
            mtime: u64,
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

const fd_min = 0xfffff;

pub fn SyscallRedirector(comptime ModuleHost: type) type {
    return struct {
        pub fn access(path: [*:0]const u8, mode: c_int, result: *c_int) callconv(.c) bool {
            return faccessat(-1, path, mode, result);
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
            if (isPrivateDescriptor(dirfd) or (dirfd < 0 and Host.isRedirecting(.stat))) {
                var call: Syscall = .{ .cmd = .stat, .u = .{
                    .stat = .{
                        .dirfd = remapDirFD(dirfd),
                        .path = path,
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
                const lock: Flock = .{
                    .type = switch (op & ~@as(c_int, std.c.LOCK.NB)) {
                        std.c.LOCK.SH => F.RDLCK,
                        std.c.LOCK.EX => F.WRLCK,
                        std.c.LOCK.UN => F.UNLCK,
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
            if (isPrivateDescriptor(dirfd) or (dirfd < 0 and Host.isRedirecting(.stat))) {
                var call: Syscall = .{ .cmd = .stat, .u = .{
                    .stat = .{
                        .dirfd = remapDirFD(dirfd),
                        .path = path,
                        .lookup_flags = convertLookupFlags(flags),
                    },
                } };
                const err = Host.redirectSyscall(&call);
                if (err == .SUCCESS) copyStat(buf, &call.u.stat.stat);
                result.* = intFromError(err);
                return true;
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
            if (isPrivateDescriptor(dirfd) or (dirfd < 0 and Host.isRedirecting(.set_times))) {
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
            return fstatat(-1, path, buf, AT.SYMLINK_NOFOLLOW, result);
        }

        pub fn lstat64(path: [*:0]const u8, buf: *Stat64, result: *c_int) callconv(.c) bool {
            return fstatat64(-1, path, buf, AT.SYMLINK_NOFOLLOW, result);
        }

        pub fn lutimes(path: [*:0]const u8, tv: [*]const std.c.timeval, result: *c_int) callconv(.c) bool {
            const times = convertTimeval(tv);
            return utimensat(-1, path, &times, AT.SYMLINK_NOFOLLOW, result);
        }

        pub fn mkdir(path: [*:0]const u8, mode: c_int, result: *c_int) callconv(.c) bool {
            return mkdirat(-1, path, mode, result);
        }

        pub fn mkdirat(dirfd: c_int, path: [*:0]const u8, _: c_int, result: *c_int) callconv(.c) bool {
            if (isPrivateDescriptor(dirfd) or (dirfd < 0 and Host.isRedirecting(.mkdir))) {
                var call: Syscall = .{ .cmd = .mkdir, .u = .{
                    .mkdir = .{
                        .dirfd = remapDirFD(dirfd),
                        .path = path,
                    },
                } };
                const err = Host.redirectSyscall(&call);
                if (err == .SUCCESS or err == .EXIST or isPrivateDescriptor(dirfd)) {
                    result.* = intFromError(err);
                    return true;
                }
            }
            return false;
        }

        pub const newfstatat = fstatat;

        pub fn open(path: [*:0]const u8, oflags: c_int, mode: c_int, result: *c_int) callconv(.c) bool {
            return openat(-1, path, oflags, mode, result);
        }

        pub fn openat(dirfd: c_int, path: [*:0]const u8, oflags: c_int, _: c_int, result: *c_int) callconv(.c) bool {
            if (isPrivateDescriptor(dirfd) or (dirfd < 0 and Host.isRedirecting(.open))) {
                const o: O = @bitCast(@as(i32, @intCast(oflags)));
                var call: Syscall = .{ .cmd = .open, .u = .{
                    .open = .{
                        .dirfd = remapDirFD(dirfd),
                        .path = path,
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
                            .{ .FD_READDIR = true }
                        else if (o.ACCMODE == .RDWR)
                            .{ .FD_READ = true, .FD_WRITE = true }
                        else if (o.ACCMODE == .WRONLY)
                            .{ .FD_WRITE = true }
                        else
                            .{ .FD_READ = true },
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
                if (err == .SUCCESS) {
                    result.* = @intCast(call.u.pread.read);
                } else {
                    result.* = intFromError(err);
                }
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
                if (err == .SUCCESS) {
                    result.* = @intCast(call.u.pwrite.written);
                } else {
                    result.* = intFromError(err);
                }
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
            return fstatat(-1, path, buf, 0, result);
        }

        pub fn stat64(path: [*:0]const u8, buf: *Stat64, result: *c_int) callconv(.c) bool {
            return fstatat64(-1, path, buf, 0, result);
        }

        pub fn statx(dirfd: c_int, path: [*:0]const u8, flags: c_int, mask: c_uint, buf: *std.os.linux.Statx, result: *c_int) callconv(.c) bool {
            if (isPrivateDescriptor(dirfd) or (dirfd < 0 and Host.isRedirecting(.stat))) {
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
                            .lookup_flags = convertLookupFlags(flags),
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
            if (isPrivateDescriptor(dirfd) or (dirfd < 0 and Host.isRedirecting(.unlink))) {
                var call: Syscall = if ((flags & AT.REMOVEDIR) != 0)
                    .{ .cmd = .rmdir, .u = .{
                        .rmdir = .{
                            .dirfd = remapDirFD(dirfd),
                            .path = path,
                        },
                    } }
                else
                    .{ .cmd = .unlink, .u = .{
                        .unlink = .{
                            .dirfd = remapDirFD(dirfd),
                            .path = path,
                            .flags = @intCast(flags),
                        },
                    } };
                const err = Host.redirectSyscall(&call);
                if (err == .SUCCESS or isPrivateDescriptor(dirfd)) {
                    result.* = intFromError(err);
                    return true;
                }
            }
            return false;
        }

        pub fn utimes(path: [*:0]const u8, tv: [*]const std.c.timeval, result: *c_int) callconv(.c) bool {
            const times = convertTimeval(tv);
            return utimensat(-1, path, &times, AT.SYMLINK_FOLLOW, result);
        }

        pub fn utimensat(dirfd: c_int, path: [*:0]const u8, times: [*]const std.c.timespec, flags: c_int, result: *c_int) callconv(.c) bool {
            if (isPrivateDescriptor(dirfd) or (dirfd < 0 and Host.isRedirecting(.set_times))) {
                var call: Syscall = .{ .cmd = .utimes, .u = .{
                    .utimes = .{
                        .dirfd = remapDirFD(dirfd),
                        .path = path,
                        .lookup_flags = convertLookupFlags(flags),
                        .atime = getNanoseconds(times[0]),
                        .mtime = getNanoseconds(times[1]),
                    },
                } };
                const err = Host.redirectSyscall(&call);
                if (err == .SUCCESS or isPrivateDescriptor(dirfd)) {
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

        fn isPrivateDescriptor(fd: c_int) bool {
            return switch (fd) {
                0, 1, 2 => true,
                else => fd >= fd_min,
            };
        }

        fn remapDirFD(dirfd: c_int) i32 {
            return switch (dirfd) {
                AT.FDCWD => -1,
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

        fn getNanoseconds(ts: std.c.timespec) u64 {
            return @as(u64, @intCast(ts.sec)) * 1_000_000_000 + @as(u64, @intCast(ts.nsec));
        }

        fn convertLookupFlags(flags: c_int) std.os.wasi.lookupflags_t {
            return .{
                .SYMLINK_FOLLOW = (flags & AT.SYMLINK_NOFOLLOW) == 0,
            };
        }

        fn copyStat(dest: anytype, src: *const std.os.wasi.filestat_t) void {
            const T = @typeInfo(@TypeOf(dest)).pointer.child;
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
        pub const posix_fadvise = makeStdHookUsing("posix_fadvise", "fadvise64");
        pub const pread = makeStdHook("pread");
        pub const pread64 = makeStdHook("pread64");
        pub const pwrite = makeStdHook("pwrite");
        pub const pwrite64 = makeStdHook("pwrite64");
        pub const read = makeStdHook("read");
        pub const rmdir = makeStdHook("rmdir");
        pub const stat = makeStdHook("stat");
        pub const stat64 = makeStdHook("stat64");
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
            if (redirector.newfstatat(dirfd, path, buf, AT.SYMLINK_FOLLOW, &result)) {
                return saveError(result);
            }
            return Original.__fxstatat(ver, dirfd, path, buf);
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

        pub fn opendir(path: [*:0]const u8) callconv(.c) ?*std.c.DIR {
            var result: c_int = undefined;
            const flags: O = .{ .DIRECTORY = true };
            const flags_int: @typeInfo(O).@"struct".backing_integer.? = @bitCast(flags);
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
                    if (@hasField(Dirent, "off")) {
                        dir.cookie = dirent.off;
                    } else if (@hasField(Dirent, "seekoff")) {
                        dir.cookie = dirent.seekoff;
                    }
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
                return @intCast(dir.cookie);
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
            return errno_ptr orelse inline for (.{ "__errno_location", "__error", "_errno" }) |name| {
                if (@hasDecl(errno_h, name)) {
                    const func = @field(errno_h, name);
                    errno_ptr = func();
                    break errno_ptr.?;
                }
            } else @compileError("Unable to get error number pointer");
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
            pub var pread: *const @TypeOf(Self.pread) = undefined;
            pub var pread64: *const @TypeOf(Self.pread64) = undefined;
            pub var pwrite: *const @TypeOf(Self.pwrite) = undefined;
            pub var pwrite64: *const @TypeOf(Self.pwrite64) = undefined;
            pub var posix_fadvise: *const @TypeOf(Self.posix_fadvise) = undefined;
            pub var pthread_create: *const @TypeOf(Self.pthread_create) = undefined;
            pub var read: *const @TypeOf(Self.read) = undefined;
            pub var readdir: *const @TypeOf(Self.readdir) = undefined;
            pub var rewinddir: *const @TypeOf(Self.rewinddir) = undefined;
            pub var rmdir: *const @TypeOf(Self.rmdir) = undefined;
            pub var seekdir: *const @TypeOf(Self.seekdir) = undefined;
            pub var stat: *const @TypeOf(Self.stat) = undefined;
            pub var stat64: *const @TypeOf(Self.stat64) = undefined;
            pub var telldir: *const @TypeOf(Self.telldir) = undefined;
            pub var unlink: *const @TypeOf(Self.unlink) = undefined;
            pub var unlinkat: *const @TypeOf(Self.unlinkat) = undefined;
            pub var utimensat: *const @TypeOf(Self.utimensat) = undefined;
            pub var utimes: *const @TypeOf(Self.utimes) = undefined;
            pub var write: *const @TypeOf(Self.write) = undefined;
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

        pub fn getchar() callconv(.c) c_int {
            const stdin = getStdProxy(0);
            var buf: [1]u8 = undefined;
            if (read(stdin, &buf, 1) != 1) return -1;
            return buf[0];
        }

        pub fn gets_s(buf: [*]u8, len: usize) callconv(.c) ?[*:0]u8 {
            const stdin = getStdProxy(0);
            const result = bufferUntil(stdin, '\n');
            if (result <= 0) return null;
            const end: usize = @intCast(result);
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
                switch (@typeInfo(stdio_h.fpos_t)) {
                    .int => pos.* = result,
                    .@"struct" => if (@hasField(stdio_h.fpos_t, "__pos")) {
                        @field(pos, "__pos") = result;
                    },
                    else => @compileError("Unexpected fpos_t type"),
                }
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
                const offset = switch (@typeInfo(stdio_h.fpos_t)) {
                    .int => pos.*,
                    .@"struct" => if (@hasField(stdio_h.fpos_t, "__pos"))
                        @field(pos, "__pos"),
                    else => @compileError("Unexpected fpos_t type"),
                };
                const result = posix.lseek64(file.fd, @intCast(offset), std.c.SEEK.SET);
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
        pub extern fn vfprintf_s_hook() callconv(.c) void;
        pub extern fn vprintf_s_hook() callconv(.c) void;
        pub extern fn fprintf_s_hook() callconv(.c) void;
        pub extern fn printf_s_hook() callconv(.c) void;

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
            if (len_u - copied >= 8192) {
                // read directly into the destination when the amount is large
                const result = readRaw(file, dest[copied..], @intCast(len_u - copied));
                if (result < 0) return -1;
                return @as(off_t, @intCast(copied)) + result;
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

        fn readRaw(file: *RedirectedFile, dest: [*]u8, len: off_t) callconv(.c) off_t {
            const result = posix.read(file.fd, dest, len);
            if (result < 0) return saveFileError(file, posix.getError());
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
                const in_non_blocking_mode = setNonBlocking(file, true) == 0;
                defer if (in_non_blocking_mode) {
                    _ = setNonBlocking(file, false);
                };
                const buf2 = buf[1..];
                const result2 = readRaw(file, buf2.ptr, @intCast(buf2.len));
                if (result2 < 0) {
                    if (posix.getError() != @intFromEnum(std.c.E.AGAIN)) return -1;
                }
                _ = file.replenishBuffer(null, @intCast(result2));
                len += @intCast(result2);
            } else {
                file.eof = true;
            }
            return @intCast(len);
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

        fn setNonBlocking(file: *RedirectedFile, nonblocking: bool) callconv(.c) c_int {
            const oflags: O = .{ .NONBLOCK = nonblocking };
            const oflags_int: @typeInfo(O).@"struct".backing_integer.? = @bitCast(oflags);
            if (posix.fcntl(file.fd, F.SETFL, oflags_int) != 0) {
                return saveFileError(file, posix.getError());
            }
            return 0;
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

        pub const lseeki64 = posix.lseek64;

        pub extern fn __stdio_common_vfprintf_hook() callconv(.c) void;

        const Self = @This();
        pub const Original = struct {
            pub var lseeki64: *const @TypeOf(Self.lseeki64) = undefined;

            pub extern var __stdio_common_vfprintf_orig: *const @TypeOf(Self.__stdio_common_vfprintf_hook);
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
            var result: c_int = undefined;
            if (redirector.mkdir(path, 0, &result)) {
                return saveError(result);
            }
            return Original.CreateDirectoryA(path, security_attributes);
        }

        pub fn CreateDirectoryW(
            path: LPCWSTR,
            security_attributes: *SECURITY_ATTRIBUTES,
        ) callconv(WINAPI) BOOL {
            if (redirector.Host.isRedirecting(.mkdir)) {
                const path_wtf8 = allocWtf8(path, true) catch return FALSE;
                defer freeWtf8(path_wtf8);
                return CreateDirectoryA(path_wtf8, security_attributes);
            }
            return Original.CreateDirectoryW(path, security_attributes);
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
                const path_wtf8 = allocWtf8(path, true) catch return FALSE;
                defer freeWtf8(path_wtf8);
                return DeleteFileA(path_wtf8);
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
                const path_wtf8 = allocWtf8(path, true) catch return std.os.windows.INVALID_FILE_ATTRIBUTES;
                defer freeWtf8(path_wtf8);
                return GetFileAttributesA(path_wtf8);
            }
            return Original.GetFileAttributesW(path);
        }

        pub fn GetFileSize(handle: HANDLE, size_high: *DWORD) callconv(WINAPI) DWORD {
            return Original.GetFileSize(handle, size_high);
        }

        pub fn GetFileSizeEx(handle: HANDLE, size: *LARGE_INTEGER) callconv(WINAPI) BOOL {
            return Original.GetFileSizeEx(handle, size);
        }

        pub fn GetHandleInformation(handle: HANDLE, flags: *DWORD) callconv(WINAPI) BOOL {
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
            overlapped: *OVERLAPPED,
        ) callconv(WINAPI) BOOL {
            const fd = toDescriptor(handle);
            const lock = createLockStruct(.{ 0, 0 }, .{ len_low, len_high }, if ((flags & windows_h.LOCKFILE_EXCLUSIVE_LOCK) != 0) F.WRLCK else F.RDLCK);
            var result: c_int = undefined;
            if (redirector.fcntl(fd, F.SETLK, @intFromPtr(&lock), &result)) {
                signalCompletion(overlapped);
                return saveError(result);
            }
            return Original.LockFileEx(handle, flags, reserved, len_low, len_high, overlapped);
        }

        fn NtClose(handle: HANDLE) callconv(WINAPI) NTSTATUS {
            if (handle == temporary_handle) return .SUCCESS;
            const fd = toDescriptor(handle);
            var result: c_int = undefined;
            if (redirector.close(fd, &result)) {
                return if (result == 0) .SUCCESS else .INVALID_HANDLE;
            }
            return Original.NtClose(handle);
        }

        fn NtCreateFile(
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
            const dirfd: c_int = if (object_attributes.RootDirectory) |dh| toDescriptor(dh) else -1;
            const delete_op = (desired_access & std.os.windows.DELETE) != 0;
            const dir_op = (create_options & std.os.windows.FILE_DIRECTORY_FILE) != 0;
            const redirecting = if (delete_op) redirector.Host.isRedirecting(.unlink) else redirector.Host.isRedirecting(.open);
            if (redirector.isPrivateDescriptor(dirfd) or (dirfd < 0 and redirecting)) {
                const object_name = object_attributes.ObjectName;
                const name_len = @divExact(object_name.Length, 2);
                const path = object_name.Buffer.?[0..name_len];
                const path_wtf8 = allocWtf8(path, false) catch return .NO_MEMORY;
                defer freeWtf8(path_wtf8);
                if (delete_op) {
                    // an unlink or rmdir operation actually
                    var result: c_int = undefined;
                    const flags: c_int = if (dir_op) AT.REMOVEDIR else 0;
                    if (redirector.unlinkat(dirfd, path_wtf8, flags, &result)) {
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
                        if (redirector.mkdirat(dirfd, path_wtf8, mode, &result)) {
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
                        if (redirector.openat(dirfd, path_wtf8, @intCast(oflags_int), mode, &fd)) {
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

        pub fn NtQueryObject(
            handle: HANDLE,
            object_information_class: OBJECT_INFORMATION_CLASS,
            object_information: LPVOID,
            object_information_length: ULONG,
            return_length: ?*ULONG,
        ) callconv(WINAPI) NTSTATUS {
            const fd = toDescriptor(handle);
            if (redirector.isPrivateDescriptor(fd)) {
                switch (object_information_class) {
                    .ObjectNameInformation => {
                        var wtf8_buf: [128]u8 = undefined;
                        const name = std.fmt.bufPrintZ(&wtf8_buf, "\\\\??\\UNC\\@zigar\\fd\\{d}", .{fd}) catch unreachable;
                        const name_offset = @sizeOf(OBJECT_NAME_INFORMATION);
                        if (object_information_length > @sizeOf(OBJECT_NAME_INFORMATION)) {
                            const info: *OBJECT_NAME_INFORMATION = @ptrCast(@alignCast(object_information));
                            const info_bytes: [*]u8 = @ptrCast(object_information);
                            const name_buf: [*]WCHAR = @ptrCast(@alignCast(info_bytes[name_offset..]));
                            const max_len: usize = object_information_length - name_offset - 2;
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
            overlapped: *OVERLAPPED,
        ) callconv(WINAPI) BOOL {
            const fd = toDescriptor(handle);
            var result: off_t = undefined;
            if (redirector.read(fd, @ptrCast(buffer), @intCast(len), &result)) {
                if (result < 0) return saveError(result);
                read.* = @intCast(result);
                signalCompletion(overlapped);
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
                const path_wtf8 = allocWtf8(path, true) catch return FALSE;
                defer freeWtf8(path_wtf8);
                return RemoveDirectoryA(path_wtf8);
            }
            return Original.RemoveDirectoryW(path);
        }

        pub fn SetFilePointer(
            handle: HANDLE,
            offset: LONG,
            offset_high: *LONG,
            method: DWORD,
        ) callconv(WINAPI) DWORD {
            return Original.SetFilePointer(handle, offset, offset_high, method);
        }

        pub fn SetFilePointerEx(
            handle: HANDLE,
            offset: LARGE_INTEGER,
            new_pos: *LARGE_INTEGER,
            method: DWORD,
        ) callconv(WINAPI) DWORD {
            return Original.SetFilePointerEx(handle, offset, new_pos, method);
        }

        pub fn SetHandleInformation(handle: HANDLE, mask: DWORD, flags: DWORD) callconv(WINAPI) BOOL {
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
            reserved: DWORD,
            len_low: DWORD,
            len_high: DWORD,
            overlapped: *OVERLAPPED,
        ) callconv(WINAPI) BOOL {
            const fd = toDescriptor(handle);
            const lock = createLockStruct(.{ 0, 0 }, .{ len_low, len_high }, F.UNLCK);
            var result: c_int = undefined;
            if (redirector.fcntl(fd, F.SETLK, @intFromPtr(&lock), &result)) {
                signalCompletion(overlapped);
                return saveError(result);
            }
            return Original.UnlockFileEx(handle, flags, reserved, len_low, len_high, overlapped);
        }

        pub fn WriteFile(
            handle: HANDLE,
            buffer: LPCVOID,
            len: DWORD,
            written: *DWORD,
            overlapped: ?*OVERLAPPED,
        ) callconv(WINAPI) BOOL {
            const fd = toDescriptor(handle);
            var result: off_t = undefined;
            if (redirector.write(fd, @ptrCast(buffer), @intCast(len), &result)) {
                if (result < 0) return saveError(result);
                written.* = @intCast(result);
                signalCompletion(overlapped);
                return TRUE;
            }
            return Original.WriteFile(handle, buffer, len, written, overlapped);
        }

        fn toDescriptor(handle: HANDLE) c_int {
            if (handle == std.os.windows.INVALID_HANDLE_VALUE) return -1;
            return inline for (0..3) |i| {
                if (handle == std_stream.get(i)) break @intCast(i);
            } else @intCast(@intFromPtr(handle) >> 1);
        }

        fn fromDescriptor(fd: c_int) HANDLE {
            if (fd < 0) return std.os.windows.INVALID_HANDLE_VALUE;
            return inline for (0..3) |i| {
                if (fd == @as(c_int, @intCast(i))) break std_stream.get(i);
            } else @ptrFromInt(@as(usize, @intCast(fd)) << 1);
        }

        fn isPrivateHandle(handle: HANDLE) bool {
            const fd = toDescriptor(handle);
            return redirector.isPrivateDescriptor(fd);
        }

        fn allocWtf8(string: anytype, save_err: bool) ![:0]u8 {
            const T = @TypeOf(string);
            const s: []const u16 = switch (T) {
                [*:0]u16, [*:0]const u16 => string[0..std.mem.len(string)],
                []u16, []const u16 => string,
                else => @compileError("Unexpected: " ++ @typeName(T)),
            };
            return std.unicode.wtf16LeToWtf8AllocZ(c_allocator, s) catch |err| {
                if (save_err) _ = windows_h.SetLastError(windows_h.ERROR_NOT_ENOUGH_MEMORY);
                return err;
            };
        }

        fn freeWtf8(string: [:0]u8) void {
            c_allocator.free(string);
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

        fn signalCompletion(overlapped: ?*OVERLAPPED) void {
            if (overlapped) |o| _ = windows_h.SetEvent(o.hEvent);
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

        const temporary_handle: HANDLE = @ptrFromInt(0x1fff_ffff);

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
        const DWORD = std.os.windows.DWORD;
        const FILE_INFORMATION_CLASS = std.os.windows.FILE_INFORMATION_CLASS;
        const HANDLE = std.os.windows.HANDLE;
        const IO_STATUS_BLOCK = std.os.windows.IO_STATUS_BLOCK;
        const IO_APC_ROUTINE = std.os.windows.IO_APC_ROUTINE;
        const LARGE_INTEGER = std.os.windows.LARGE_INTEGER;
        const LONG = std.os.windows.LONG;
        const LPCSTR = std.os.windows.LPCSTR;
        const LPCVOID = std.os.windows.LPCVOID;
        const LPOVERLAPPED_COMPLETION_ROUTINE = std.os.windows.LPOVERLAPPED_COMPLETION_ROUTINE;
        const LPCWSTR = std.os.windows.LPCWSTR;
        const LPVOID = std.os.windows.LPVOID;
        const NTSTATUS = std.os.windows.NTSTATUS;
        const OBJECT_ATTRIBUTES = std.os.windows.OBJECT_ATTRIBUTES;
        const OBJECT_NAME_INFORMATION = std.os.windows.OBJECT_NAME_INFORMATION;
        const OBJECT_INFORMATION_CLASS = std.os.windows.OBJECT_INFORMATION_CLASS;
        const OVERLAPPED = std.os.windows.OVERLAPPED;
        const SECURITY_ATTRIBUTES = std.os.windows.SECURITY_ATTRIBUTES;
        const ULONG = std.os.windows.ULONG;
        const WCHAR = std.os.windows.WCHAR;
        const FALSE = std.os.windows.FALSE;
        const TRUE = std.os.windows.TRUE;
        const WINAPI: std.builtin.CallingConvention = if (builtin.cpu.arch == .x86) .{ .x86_stdcall = .{} } else .c;

        const Self = @This();
        pub const Original = struct {
            pub var CloseHandle: *const @TypeOf(Self.CloseHandle) = undefined;
            pub var CreateDirectoryA: *const @TypeOf(Self.CreateDirectoryA) = undefined;
            pub var CreateDirectoryW: *const @TypeOf(Self.CreateDirectoryW) = undefined;
            pub var DeleteFileA: *const @TypeOf(Self.DeleteFileA) = undefined;
            pub var DeleteFileW: *const @TypeOf(Self.DeleteFileW) = undefined;
            pub var GetFileAttributesA: *const @TypeOf(Self.GetFileAttributesA) = undefined;
            pub var GetFileAttributesW: *const @TypeOf(Self.GetFileAttributesW) = undefined;
            pub var GetFileSize: *const @TypeOf(Self.GetFileSize) = undefined;
            pub var GetFileSizeEx: *const @TypeOf(Self.GetFileSizeEx) = undefined;
            pub var GetHandleInformation: *const @TypeOf(Self.GetHandleInformation) = undefined;
            pub var LockFile: *const @TypeOf(Self.LockFile) = undefined;
            pub var LockFileEx: *const @TypeOf(Self.LockFileEx) = undefined;
            pub var NtClose: *const @TypeOf(Self.NtClose) = undefined;
            pub var NtCreateFile: *const @TypeOf(Self.NtCreateFile) = undefined;
            pub var NtLockFile: *const @TypeOf(Self.NtLockFile) = undefined;
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
