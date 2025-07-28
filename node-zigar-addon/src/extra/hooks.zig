const std = @import("std");
const c_allocator = std.heap.c_allocator;
const builtin = @import("builtin");

const fn_transform = @import("./fn-transform.zig");

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
        fcntl: extern struct {
            fd: i32,
            op: u32,
            arg: u32,
            result: extern union {
                getfl: std.os.wasi.fdstat_t,
            } = undefined,
        },
        fstat: extern struct {
            fd: i32,
            stat: std.os.wasi.filestat_t = undefined,
        },
        futimes: extern struct {
            fd: i32,
            times: [*]const std.posix.timespec,
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
        stat: extern struct {
            dirfd: i32,
            path: [*:0]const u8,
            flags: u32,
            stat: std.os.wasi.filestat_t = undefined,
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
            times: [*]const std.posix.timespec,
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
        fcntl,
        fstat,
        futimes,
        getdents,
        mkdir,
        open,
        read,
        rmdir,
        seek,
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
};

const fd_min = 0xfffff;

pub fn SyscallRedirector(comptime Host: type) type {
    return struct {
        pub fn access(path: [*:0]const u8, mode: c_int, result: *c_int) callconv(.c) bool {
            return faccessat(-1, path, mode, std.posix.AT.SYMLINK_FOLLOW, result);
        }

        pub fn close(fd: c_int, result: *c_int) callconv(.c) bool {
            if (isApplicableHandle(fd)) {
                var call: Syscall = .{ .cmd = .close, .u = .{
                    .close = .{
                        .fd = fd,
                    },
                } };
                const err = Host.redirectSyscall(&call);
                result.* = intFromError(err);
                return true;
            }
            return false;
        }

        pub fn faccessat(dirfd: c_int, path: [*:0]const u8, mode: c_int, flags: c_int, result: *c_int) callconv(.c) bool {
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
                        .fd = fd,
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
                std.debug.print("fallocate: {d} {d}\n", .{ offset, len });
                var call: Syscall = .{ .cmd = .allocate, .u = .{
                    .allocate = .{
                        .fd = fd,
                        .mode = mode,
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

        pub fn fcntl(fd: c_int, op: c_int, arg: c_int, result: *c_int) callconv(.c) bool {
            if (isApplicableHandle(fd)) {
                var call: Syscall = .{ .cmd = .fcntl, .u = .{
                    .fcntl = .{
                        .fd = fd,
                        .op = @intCast(op),
                        .arg = @intCast(arg),
                    },
                } };
                const err = Host.redirectSyscall(&call);
                if (err == .SUCCESS) {
                    switch (op) {
                        std.c.F.GETFL => {
                            const fdstat = call.u.fcntl.result.getfl;
                            var oflags: std.posix.O = .{};
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
                            }
                            const oflags_int: @typeInfo(std.posix.O).@"struct".backing_integer.? = @bitCast(oflags);
                            result.* = @intCast(oflags_int);
                        },
                        else => {},
                    }
                } else {
                    result.* = intFromError(err);
                }
                return true;
            }
            return false;
        }

        pub fn fdatasync(fd: c_int, result: *c_int) callconv(.c) bool {
            if (isApplicableHandle(fd)) {
                var call: Syscall = .{ .cmd = .datasync, .u = .{
                    .datasync = .{
                        .fd = fd,
                    },
                } };
                const err = Host.redirectSyscall(&call);
                result.* = intFromError(err);
                return true;
            }
            return false;
        }

        pub fn fstat(fd: c_int, buf: *std.posix.Stat, result: *c_int) callconv(.c) bool {
            if (isApplicableHandle(fd)) {
                var call: Syscall = .{ .cmd = .fstat, .u = .{
                    .fstat = .{
                        .fd = fd,
                    },
                } };
                const err = Host.redirectSyscall(&call);
                if (err == .SUCCESS) copyStat(buf, &call.u.fstat.stat);
                result.* = intFromError(err);
                return true;
            }
            return false;
        }

        pub fn fstatat64(dirfd: c_int, path: [*:0]const u8, buf: *std.posix.Stat, flags: c_int, result: *c_int) callconv(.c) bool {
            if (isApplicableHandle(dirfd) or (dirfd < 0 and Host.isRedirecting(.stat))) {
                var call: Syscall = .{ .cmd = .stat, .u = .{
                    .stat = .{
                        .dirfd = dirfd,
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

        pub fn fsync(fd: c_int, result: *c_int) callconv(.c) bool {
            if (isApplicableHandle(fd)) {
                var call: Syscall = .{ .cmd = .sync, .u = .{
                    .sync = .{
                        .fd = fd,
                    },
                } };
                const err = Host.redirectSyscall(&call);
                result.* = intFromError(err);
                return true;
            }
            return false;
        }

        pub fn futimens(fd: c_int, times: [*]const std.posix.timespec, result: *c_int) callconv(.c) bool {
            if (isApplicableHandle(fd)) {
                var call: Syscall = .{ .cmd = .futimes, .u = .{
                    .futimes = .{
                        .fd = fd,
                        .times = times,
                    },
                } };
                const err = Host.redirectSyscall(&call);
                result.* = intFromError(err);
                return true;
            }
            return false;
        }

        pub fn futimes(fd: c_int, tv: [*]const std.posix.timeval, result: *c_int) callconv(.c) bool {
            if (isApplicableHandle(fd)) {
                const times = convertTimeval(tv);
                return futimens(fd, &times, result);
            }
            return false;
        }

        pub fn futimesat(dirfd: c_int, path: [*:0]const u8, tv: [*]const std.posix.timeval, result: *c_int) callconv(.c) bool {
            if (isApplicableHandle(dirfd) or (dirfd < 0 and Host.isRedirecting(.set_times))) {
                const times = convertTimeval(tv);
                return utimensat(dirfd, path, &times, std.posix.AT.SYMLINK_FOLLOW, result);
            }
            return false;
        }

        pub fn getdents(dirfd: c_int, buffer: [*]u8, len: usize, result: *c_int) callconv(.c) bool {
            return getdents64(dirfd, buffer, len, result);
        }

        pub fn getdents64(dirfd: c_int, buffer: [*]u8, len: usize, result: *c_int) callconv(.c) bool {
            if (isApplicableHandle(dirfd)) {
                // get offset to name in the wasi struct and in the system struct
                const src_name_offset = @sizeOf(std.os.wasi.dirent_t);
                const name_offset = @offsetOf(std.c.dirent64, "name");
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
                        .dirfd = dirfd,
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
                        const entry: *align(1) std.c.dirent64 = @ptrCast(&buffer[offset]);
                        const name_len: usize = src_entry.namlen;
                        const reclen = name_offset + name_len + 1;
                        if (offset + reclen >= len) {
                            // retrieved too much data--reposition cursor before exiting
                            var seek_result: isize = undefined;
                            _ = lseek(dirfd, next_pos, std.posix.SEEK.SET, &seek_result);
                            break;
                        }
                        if (@hasField(std.c.dirent64, "ino")) {
                            entry.ino = @intCast(src_entry.ino);
                        } else if (@hasField(std.c.dirent64, "fileno")) {
                            entry.fileno = @intCast(src_entry.ino);
                        }
                        if (@hasField(std.c.dirent64, "off")) {
                            entry.off = @intCast(src_entry.next);
                        } else if (@hasField(std.c.dirent64, "seekoff")) {
                            entry.seekoff = @intCast(src_entry.next);
                        }
                        if (@hasField(std.c.dirent64, "reclen")) {
                            entry.reclen = @intCast(reclen);
                        }
                        if (@hasField(std.c.dirent64, "namlen")) {
                            entry.namlen = @intCast(name_len);
                        }
                        if (@hasField(std.c.dirent64, "type")) {
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
                const tell = offset == 0 and whence == std.posix.SEEK.CUR;
                var call: Syscall = switch (tell) {
                    true => .{ .cmd = .tell, .u = .{
                        .tell = .{
                            .fd = fd,
                        },
                    } },
                    false => .{ .cmd = .seek, .u = .{
                        .seek = .{
                            .fd = fd,
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

        pub fn lstat(path: [*:0]const u8, buf: *std.posix.Stat, result: *c_int) callconv(.c) bool {
            return fstatat64(-1, path, buf, std.posix.AT.SYMLINK_NOFOLLOW, result);
        }

        pub fn lutimes(path: [*:0]const u8, tv: [*]const std.posix.timeval, result: *c_int) callconv(.c) bool {
            const times = convertTimeval(tv);
            return utimensat(-1, path, &times, std.posix.AT.SYMLINK_NOFOLLOW, result);
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

        pub fn open(path: [*:0]const u8, oflags: c_int, mode: c_int, result: *c_int) callconv(.c) bool {
            return openat(-1, path, oflags, mode, result);
        }

        pub fn openat(dirfd: c_int, path: [*:0]const u8, oflags: c_int, mode: c_int, result: *c_int) callconv(.c) bool {
            if (isApplicableHandle(dirfd) or (dirfd < 0 and Host.isRedirecting(.open))) {
                const o: std.c.O = @bitCast(oflags);
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

        pub fn read(fd: c_int, buffer: [*]u8, len: isize, result: *isize) callconv(.c) bool {
            if (isApplicableHandle(fd)) {
                var call: Syscall = .{ .cmd = .read, .u = .{
                    .read = .{
                        .fd = fd,
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

        pub fn stat(path: [*:0]const u8, buf: *std.posix.Stat, result: *c_int) callconv(.c) bool {
            return fstatat64(-1, path, buf, 0, result);
        }

        pub fn unlink(path: [*:0]const u8, result: *c_int) callconv(.c) bool {
            return unlinkat(-1, path, 0, result);
        }

        pub fn unlinkat(dirfd: c_int, path: [*:0]const u8, flags: c_int, result: *c_int) callconv(.c) bool {
            if (isApplicableHandle(dirfd) or (dirfd < 0 and Host.isRedirecting(.unlink))) {
                var call: Syscall = .{ .cmd = .mkdir, .u = .{
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

        pub fn utimes(path: [*:0]const u8, tv: [*]const std.posix.timeval, result: *c_int) callconv(.c) bool {
            const times = convertTimeval(tv);
            return utimensat(-1, path, &times, std.posix.AT.SYMLINK_FOLLOW, result);
        }

        pub fn utimensat(dirfd: c_int, path: [*:0]const u8, times: [*]const std.posix.timespec, flags: c_int, result: *c_int) callconv(.c) bool {
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
                        .fd = fd,
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

        fn isApplicableHandle(fd: c_int) bool {
            return switch (fd) {
                0, 1, 2 => true,
                else => fd >= fd_min,
            };
        }

        fn remapDirFD(dirfd: c_int) c_int {
            return switch (dirfd) {
                -100 => -1,
                else => dirfd,
            };
        }

        fn convertTimeval(tv: [*]const std.posix.timeval) [2]std.posix.timespec {
            var times: [2]std.posix.timespec = undefined;
            for (&times, 0..) |*ptr, index| {
                ptr.* = .{
                    .sec = tv[index].sec,
                    .nsec = tv[index].usec * 1000,
                };
            }
            return times;
        }

        fn copyStat(dest: *std.posix.Stat, src: *const std.os.wasi.filestat_t) void {
            dest.* = std.mem.zeroes(std.c.Stat);
            dest.ino = src.ino;
            dest.size = @truncate(@as(i64, @intCast(src.size)));
            dest.mode = @intFromEnum(src.filetype);
            inline for (.{ "atim", "mtim", "ctim" }) |field_name| {
                const ns = @field(src, field_name);
                @field(dest, field_name) = .{
                    .sec = @truncate(@as(i64, @intCast(ns / 1_000_000_000))),
                    .nsec = @truncate(@as(i64, @intCast(ns % 1_000_000_000))),
                };
            }
        }
    };
}

pub fn PosixSubstitute(comptime redirector: type) type {
    return struct {
        pub const access = makeStdHook("access");
        pub const close = makeStdHook("close");
        pub const faccessat = makeStdHook("faccessat");
        pub const fallocate = makeStdHook("fallocate");
        pub const fcntl = makeStdHook("fcntl");
        pub const fdatasync = makeStdHook("fdatasync");
        pub const fstat = makeStdHook("fstat");
        pub const fstat64 = makeStdHookUsing("fstat64", "fstat");
        pub const fstatat = makeStdHookUsing("fstatat", "fstatat64");
        pub const fstatat64 = makeStdHook("fstatat64");
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
        pub const read = makeStdHook("read");
        pub const rmdir = makeStdHook("rmdir");
        pub const stat = makeStdHook("stat");
        pub const stat64 = makeStdHookUsing("stat64", "stat");
        pub const unlink = makeStdHook("unlink");
        pub const unlinkat = makeStdHook("unlinkat");
        pub const utimensat = makeStdHook("utimensat");
        pub const utimes = makeStdHook("utimes");
        pub const write = makeStdHook("write");

        pub fn __fxstat(ver: c_int, fd: c_int, buf: *std.posix.Stat) callconv(.c) c_int {
            var result: c_int = undefined;
            if (redirector.fstat(fd, buf, &result)) {
                return saveError(result);
            }
            return Original.__fxstat(ver, fd, buf);
        }

        pub fn __fxstatat(ver: c_int, dirfd: c_int, path: [*:0]const u8, buf: *std.posix.Stat) callconv(.c) c_int {
            var result: c_int = undefined;
            if (redirector.fstatat64(dirfd, path, buf, std.posix.AT.SYMLINK_FOLLOW, &result)) {
                return saveError(result);
            }
            return Original.__fxstatat(ver, dirfd, path, buf);
        }

        pub fn __lxstat(ver: c_int, path: [*:0]const u8, buf: *std.posix.Stat) callconv(.c) c_int {
            var result: c_int = undefined;
            if (redirector.lstat(path, buf, &result)) {
                return saveError(result);
            }
            return Original.__lxstat(ver, path, buf);
        }

        pub fn __xstat(ver: c_int, path: [*:0]const u8, buf: *std.posix.Stat) callconv(.c) c_int {
            var result: c_int = undefined;
            if (redirector.stat(path, buf, &result)) {
                return saveError(result);
            }
            return Original.__xstat(ver, path, buf);
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
            var fd: c_int = undefined;
            const flags: std.posix.O = .{ .DIRECTORY = true };
            const flags_int: @typeInfo(std.posix.O).@"struct".backing_integer.? = @bitCast(flags);
            if (redirector.open(path, flags_int, 0, &fd)) {
                if (fd > 0) {
                    if (c_allocator.create(RedirectedDir)) |dir| {
                        dir.* = .{ .fd = fd };
                        return @ptrCast(dir);
                    } else |_| {}
                }
                return null;
            }
            return Original.opendir(path);
        }

        pub fn readdir(d: *std.c.DIR) callconv(.c) ?*align(1) const std.c.dirent64 {
            if (RedirectedDir.cast(d)) |dir| {
                if (dir.data_next == dir.data_len) {
                    var result: c_int = undefined;
                    if (redirector.getdents(dir.fd, &dir.buffer, dir.buffer.len, &result) and result > 0) {
                        dir.data_next = 0;
                        dir.data_len = @intCast(result);
                    }
                }
                if (dir.data_next < dir.data_len) {
                    const dirent: *align(1) const std.c.dirent64 = @ptrCast(&dir.buffer[dir.data_next]);
                    if (@hasField(std.c.dirent64, "reclen")) {
                        dir.data_next += dirent.reclen;
                    } else if (@hasField(std.c.dirent64, "namlen")) {
                        dir.data_next += @offsetOf(std.c.dirent64, "name") + dirent.namlen;
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
                if (lseek(dir.fd, 0, std.posix.SEEK.SET) == 0) {
                    dir.cookie = 0;
                    dir.data_next = 0;
                    dir.data_len = 0;
                }
            }
            return Original.rewinddir(d);
        }

        pub fn seekdir(d: *std.c.DIR, offset: c_ulong) void {
            if (RedirectedDir.cast(d)) |dir| {
                if (lseek(dir.fd, @intCast(offset), std.posix.SEEK.SET) == 0) {
                    dir.cookie = offset;
                    dir.data_next = 0;
                    dir.data_len = 0;
                }
            }
            return Original.seekdir(d, offset);
        }

        pub fn telldir(d: *std.c.DIR) c_ulong {
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
            const ResultPtr = params[params.len - 1].type.?;
            const RT = @typeInfo(ResultPtr).pointer.child;
            var new_params: [params.len - 1]std.builtin.Type.Fn.Param = undefined;
            for (&new_params, 0..) |*ptr, index| ptr.* = params[index];
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

        const errno_h = @cImport({
            @cInclude("errno.h");
        });

        const Sub = @This();
        pub const Original = struct {
            pub var __fxstat: *const @TypeOf(Sub.__fxstat) = undefined;
            pub var __fxstatat: *const @TypeOf(Sub.__fxstatat) = undefined;
            pub var __lxstat: *const @TypeOf(Sub.__lxstat) = undefined;
            pub var __xstat: *const @TypeOf(Sub.__xstat) = undefined;
            pub var access: *const @TypeOf(Sub.access) = undefined;
            pub var close: *const @TypeOf(Sub.close) = undefined;
            pub var closedir: *const @TypeOf(Sub.closedir) = undefined;
            pub var faccessat: *const @TypeOf(Sub.faccessat) = undefined;
            pub var fallocate: *const @TypeOf(Sub.fallocate) = undefined;
            pub var fcntl: *const @TypeOf(Sub.fcntl) = undefined;
            pub var fdatasync: *const @TypeOf(Sub.fdatasync) = undefined;
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
            pub var posix_fadvise: *const @TypeOf(Sub.posix_fadvise) = undefined;
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

const RedirectedDir = extern struct {
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
const RedirectedFile = extern struct {
    sig: u64 = signature,
    fd: c_int,
    errno: c_int = 0,
    eof: bool = false,
    proxy: bool = false,

    pub const signature = 0x4C49_4652_4147_495A;

    pub fn cast(s: *std.c.FILE) ?*@This() {
        if (!std.mem.isAligned(@intFromPtr(s), @alignOf(u64))) return null;
        const sig: *u64 = @ptrCast(@alignCast(s));
        return if (sig.* == signature) @ptrCast(sig) else null;
    }
};

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

        pub fn fclose(s: *std.c.FILE) callconv(.c) c_int {
            if (getRedirectedFile(s)) |file| {
                const result = posix.close(file.fd);
                if (!file.proxy) c_allocator.destroy(file);
                return result;
            }
            return Original.fclose(s);
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

        pub fn fopen(path: [*:0]const u8, mode: [*:0]const u8) callconv(.c) ?*std.c.FILE {
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
            const oflags_int: u32 = @bitCast(oflags);
            var fd: c_int = undefined;
            if (redirector.open(path, @intCast(oflags_int), 0, &fd)) {
                if (fd > 0) {
                    if (c_allocator.create(RedirectedFile)) |file| {
                        file.* = .{ .fd = fd };
                        return @ptrCast(file);
                    } else |_| {}
                }
                return null;
            }
            return Original.fopen(path, mode);
        }

        pub fn fputc(c: c_int, s: *std.c.FILE) callconv(.c) c_int {
            if (getRedirectedFile(s)) |file| {
                if (c < 0 or c > 255) {
                    file.errno = @intFromEnum(std.posix.E.INVAL);
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
                if (result < 0) {
                    file.errno = posix.getError();
                    return 0;
                }
                if (result == 0) file.eof = true;
                return if (len == result) n else @as(usize, @intCast(result)) / size;
            }
            return Original.fread(buffer, size, n, s);
        }

        pub fn fseek(s: *std.c.FILE, offset: c_long, whence: c_int) callconv(.c) c_int {
            if (getRedirectedFile(s)) |file| {
                // TODO: flush buffer
                const result = posix.lseek(file.fd, offset, whence);
                if (result < 0) file.errno = posix.getError();
                return @intCast(result);
            }
            return Original.fseek(s, offset, whence);
        }

        pub fn fsetpos(s: *std.c.FILE, pos: *const stdio_h.fpos_t) callconv(.c) c_int {
            if (getRedirectedFile(s)) |file| {
                const offset = @field(pos, fpos_field_name);
                const result = posix.lseek64(file.fd, offset, std.c.SEEK.SET);
                if (result < 0) {
                    file.errno = posix.getError();
                    return -1;
                }
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
            const stderr = getStdProxy(2).?;
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
                    file.errno = @intFromEnum(std.posix.E.INVAL);
                    return -1;
                }
                const b: [1]u8 = .{@intCast(c)};
                return @intCast(write(file, &b, 1));
            }
            return Original.putc(c, s);
        }

        pub fn putchar(c: c_int) callconv(.c) c_int {
            const stdout = getStdProxy(1).?;
            if (c < 0 or c > 255) {
                stdout.errno = @intFromEnum(std.posix.E.INVAL);
                return -1;
            }
            const b: [1]u8 = .{@intCast(c)};
            return @intCast(write(stdout, b[0..1].ptr, 1));
        }

        pub fn puts(text: [*:0]const u8) callconv(.c) c_int {
            const stdout = getStdProxy(1).?;
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
                const result = posix.lseek(file.fd, 0, std.c.SEEK.SET);
                if (result == 0) {
                    file.errno = 0;
                    file.eof = false;
                } else {
                    file.errno = posix.getError();
                }
                return;
            }
            return Original.rewind(s);
        }

        // hooks implemented in C
        pub extern fn vfprintf_hook() callconv(.c) void;
        pub extern fn vprintf_hook() callconv(.c) void;
        pub extern fn fprintf_hook() callconv(.c) void;
        pub extern fn printf_hook() callconv(.c) void;
        pub extern fn vfprintf_s_hook() callconv(.c) void;
        pub extern fn vprintf_s_hook() callconv(.c) void;
        pub extern fn fprintf_s_hook() callconv(.c) void;
        pub extern fn printf_s_hook() callconv(.c) void;

        // function required by C hooks
        comptime {
            @export(&read, .{ .name = "redirected_read", .visibility = .hidden });
            @export(&write, .{ .name = "redirected_write", .visibility = .hidden });
            @export(&getRedirectedFile, .{ .name = "get_redirected_file", .visibility = .hidden });
        }

        fn read(file: *RedirectedFile, buffer: [*]u8, len: isize) callconv(.c) isize {
            const result = posix.read(file.fd, buffer, len);
            if (result < 0) file.errno = posix.getError();
            return result;
        }

        fn write(file: *RedirectedFile, buffer: [*]const u8, len: isize) callconv(.c) isize {
            const result = posix.write(file.fd, buffer, len);
            if (result < 0) file.errno = posix.getError();
            return result;
        }

        fn getRedirectedFile(s: *std.c.FILE) callconv(.c) ?*RedirectedFile {
            const sc: *stdio_h.FILE = @ptrCast(@alignCast(s));
            return RedirectedFile.cast(s) orelse getStdProxy(stdio_h.fileno(sc));
        }

        fn getStdProxy(fd: c_int) ?*RedirectedFile {
            if (fd < 0 or fd > 2) return null;
            const index: usize = @intCast(fd);
            const file = &std_proxies[index];
            return file;
        }

        var std_proxies: [3]RedirectedFile = .{
            .{ .fd = 0, .proxy = true },
            .{ .fd = 1, .proxy = true },
            .{ .fd = 2, .proxy = true },
        };

        const stdio_h = @cImport({
            @cInclude("stdio.h");
            @cInclude("string.h");
        });

        const Self = @This();
        pub const Original = struct {
            pub var clearerr: *const @TypeOf(Self.clearerr) = undefined;
            pub var fclose: *const @TypeOf(Self.fclose) = undefined;
            pub var feof: *const @TypeOf(Self.feof) = undefined;
            pub var ferror: *const @TypeOf(Self.ferror) = undefined;
            pub var fgetpos: *const @TypeOf(Self.fgetpos) = undefined;
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

            pub extern var vfprintf_orig: *const @TypeOf(Self.vfprintf_hook);
            pub extern var vprintf_orig: *const @TypeOf(Self.vprintf_hook);
            pub extern var fprintf_orig: *const @TypeOf(Self.fprintf_hook);
            pub extern var printf_orig: *const @TypeOf(Self.printf_hook);
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

        const Self = @This();
        pub const Original = struct {
            pub extern var __vfprintf_chk_orig: *const @TypeOf(Self.__vfprintf_chk_hook);
            pub extern var __vprintf_chk_orig: *const @TypeOf(Self.__vprintf_chk_hook);
            pub extern var __fprintf_chk_orig: *const @TypeOf(Self.__fprintf_chk_hook);
            pub extern var __printf_chk_orig: *const @TypeOf(Self.__printf_chk_hook);
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
            table[index] = .{ name, .{
                .handler = &@field(Sub, handler_name),
                .original = &@field(Sub.Original, decl.name),
            } };
            index += 1;
        }
    }
    return std.StaticStringMap(Entry).initComptime(table);
}

fn intFromError(err: std.posix.E) c_int {
    const value: c_int = @intFromEnum(err);
    return -value;
}
