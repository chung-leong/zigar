const std = @import("std");
const allocator = std.heap.c_allocator;
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
            dirfd: c_int,
            path: [*:0]const u8,
            mode: c_int,
        },
        advise: extern struct {
            fd: c_int,
            offset: isize,
            len: isize,
            advice: c_int,
        },
        allocate: extern struct {
            fd: c_int,
            offset: isize,
            len: isize,
        },
        close: extern struct {
            fd: c_int,
        },
        datasync: extern struct {
            fd: c_int,
        },
        fcntl: extern struct {
            fd: c_int,
            op: c_int,
            arg: c_int,
            result: c_int = undefined,
        },
        fstat: extern struct {
            fd: c_int,
            stat: *std.posix.Stat,
        },
        futimes: extern struct {
            fd: c_int,
            times: [*]const std.posix.timespec,
        },
        getdents: extern struct {
            dirfd: c_int,
            buffer: [*]u8,
            len: usize,
            read: c_int = undefined,
        },
        mkdir: extern struct {
            dirfd: c_int,
            path: [*:0]const u8,
            mode: c_int,
        },
        open: extern struct {
            dirfd: c_int,
            path: [*:0]const u8,
            oflags: c_int,
            mode: c_int,
            fd: c_int = undefined,
        },
        read: extern struct {
            fd: c_int,
            bytes: [*]const u8,
            len: isize,
            read: isize = undefined,
        },
        rmdir: extern struct {
            dirfd: c_int,
            path: [*:0]const u8,
        },
        seek: extern struct {
            fd: c_int,
            offset: isize,
            whence: c_int,
            position: i64 = undefined,
        },
        stat: extern struct {
            dirfd: c_int,
            path: [*:0]const u8,
            flags: c_int,
            stat: *std.posix.Stat,
        },
        sync: extern struct {
            fd: c_int,
        },
        tell: extern struct {
            fd: c_int,
            position: i64 = undefined,
        },
        unlink: extern struct {
            dirfd: c_int,
            path: [*:0]const u8,
            flags: c_int,
        },
        utimes: extern struct {
            dirfd: c_int,
            path: [*:0]const u8,
            flags: c_int,
            times: [*]const std.posix.timespec,
        },
        write: extern struct {
            fd: c_int,
            bytes: [*]const u8,
            len: isize,
            written: isize = undefined,
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

pub fn Syscallredirector(comptime Host: type) type {
    return struct {
        pub fn access(path: [*:0]const u8, mode: c_int, result: *c_int) callconv(.c) bool {
            return faccessat(-1, path, mode, result);
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

        pub fn faccessat(dirfd: c_int, path: [*:0]const u8, mode: c_int, result: *c_int) callconv(.c) bool {
            if (isApplicableHandle(dirfd) or (dirfd < 0 and Host.isRedirecting(.open))) {
                var call: Syscall = .{ .cmd = .access, .u = .{
                    .access = .{
                        .dirfd = checkDirFD(dirfd),
                        .path = path,
                        .mode = mode,
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
                var call: Syscall = .{ .cmd = .access, .u = .{
                    .advise = .{
                        .fd = fd,
                        .offset = offset,
                        .len = len,
                        .advice = advice,
                    },
                } };
                const err = Host.redirectSyscall(&call);
                result.* = intFromError(err);
                return true;
            }
            return false;
        }

        pub fn fallocate(fd: c_int, offset: isize, len: isize, result: *c_int) callconv(.c) bool {
            if (isApplicableHandle(fd)) {
                var call: Syscall = .{ .cmd = .allocate, .u = .{
                    .allocate = .{
                        .fd = fd,
                        .offset = offset,
                        .len = len,
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
                        .op = op,
                        .arg = arg,
                    },
                } };
                const err = Host.redirectSyscall(&call);
                result.* = intFromError(err);
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
                        .stat = buf,
                    },
                } };
                const err = Host.redirectSyscall(&call);
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
                        .flags = flags,
                        .stat = buf,
                    },
                } };
                const err = Host.redirectSyscall(&call);
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

        pub fn futimes(fd: c_int, tv: [*]std.posix.timeval, result: *c_int) callconv(.c) bool {
            if (isApplicableHandle(fd)) {
                var call: Syscall = .{ .cmd = .futimes, .u = .{
                    .futimes = .{
                        .fd = fd,
                        .times = &.{
                            .{ .sec = tv[0].sec, .nsec = tv[0].usec * 1000 },
                            .{ .sec = tv[1].sec, .nsec = tv[1].usec * 1000 },
                        },
                    },
                } };
                const err = Host.redirectSyscall(&call);
                result.* = intFromError(err);
                return true;
            }
            return false;
        }

        pub fn futimesat(dirfd: c_int, path: [*:0]const u8, tv: [*]std.posix.timeval, result: *c_int) callconv(.c) bool {
            const times = convertTimeval(tv);
            return utimensat(dirfd, path, std.posix.AT.SYMLINK_FOLLOW, &times, result);
        }

        pub fn getdents(dirfd: c_int, buffer: [*]u8, len: usize, result: *c_int) callconv(.c) bool {
            return getdents64(dirfd, buffer, len, result);
        }

        pub fn getdents64(dirfd: c_int, buffer: [*]u8, len: usize, result: *c_int) callconv(.c) bool {
            if (isApplicableHandle(dirfd)) {
                var call: Syscall = .{ .cmd = .getdents, .u = .{
                    .getdents = .{
                        .dirfd = dirfd,
                        .buffer = buffer,
                        .len = len,
                    },
                } };
                const err = Host.redirectSyscall(&call);
                if (err == .SUCCESS) {
                    result.* = call.u.getdents.read;
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
                            .offset = offset,
                            .whence = whence,
                        },
                    } },
                };
                const err = Host.redirectSyscall(&call);
                if (err == .SUCCESS) {
                    result.* = switch (tell) {
                        true => @truncate(call.u.tell.position),
                        false => @truncate(call.u.seek.position),
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

        pub fn lutimes(path: [*:0]const u8, tv: [*]std.posix.timeval, result: *c_int) callconv(.c) bool {
            const times = convertTimeval(tv);
            return utimensat(-1, path, std.posix.AT.SYMLINK_NOFOLLOW, &times, result);
        }

        pub fn mkdir(path: [*:0]const u8, mode: c_int, result: *c_int) callconv(.c) bool {
            return mkdirat(-1, path, mode, result);
        }

        pub fn mkdirat(dirfd: c_int, path: [*:0]const u8, mode: c_int, result: *c_int) callconv(.c) bool {
            if (isApplicableHandle(dirfd) or (dirfd < 0 and Host.isRedirecting(.mkdir))) {
                var call: Syscall = .{ .cmd = .mkdir, .u = .{
                    .mkdir = .{
                        .dirfd = checkDirFD(dirfd),
                        .path = path,
                        .mode = mode,
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
                var call: Syscall = .{ .cmd = .open, .u = .{
                    .open = .{
                        .dirfd = checkDirFD(dirfd),
                        .path = path,
                        .oflags = oflags,
                        .mode = mode,
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

        pub fn read(fd: c_int, buffer: [*]u8, len: isize, result: *isize) callconv(.c) bool {
            if (isApplicableHandle(fd)) {
                var call: Syscall = .{ .cmd = .read, .u = .{
                    .read = .{
                        .fd = fd,
                        .bytes = buffer,
                        .len = len,
                    },
                } };
                const err = Host.redirectSyscall(&call);
                if (err == .SUCCESS) {
                    result.* = call.u.read.read;
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
                        .dirfd = checkDirFD(dirfd),
                        .path = path,
                        .flags = flags,
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

        pub fn utimes(path: [*:0]const u8, tv: [*]std.posix.timeval, result: *c_int) callconv(.c) bool {
            const times = convertTimeval(tv);
            return utimensat(-1, path, std.posix.AT.SYMLINK_FOLLOW, &times, result);
        }

        pub fn utimensat(dirfd: c_int, path: [*:0]const u8, flags: c_int, times: [*]const std.posix.timespec, result: *c_int) callconv(.c) bool {
            if (isApplicableHandle(dirfd) or (dirfd < 0 and Host.isRedirecting(.set_times))) {
                var call: Syscall = .{ .cmd = .utimes, .u = .{
                    .utimes = .{
                        .dirfd = checkDirFD(dirfd),
                        .path = path,
                        .flags = flags,
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
                        .len = len,
                    },
                } };
                const err = Host.redirectSyscall(&call);
                if (err == .SUCCESS) {
                    result.* = call.u.write.written;
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

        fn checkDirFD(dirfd: c_int) c_int {
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
    };
}

pub fn PosixSubstitute(comptime redirector: type) type {
    return struct {
        pub const access = makeStdHook("access");
        pub const close = makeStdHook("close");
        pub const faccessat = makeStdHook("faccessat");
        pub const fadvise = makeStdHook("fadvise");
        pub const fadvise64 = makeStdHook("fadvise64");
        pub const fallocate = makeStdHook("fallocate");
        pub const fcntl = makeStdHook("fcntl");
        pub const fdatasync = makeStdHook("fdatasync");
        pub const fstat = makeStdHook("fstat");
        pub const fstatat64 = makeStdHook("fstatat64");
        pub const fsync = makeStdHook("fsync");
        pub const futimes = makeStdHook("futimes");
        pub const futimesat = makeStdHook("futimesat");
        pub const lseek = makeStdHook("lseek");
        pub const lstat = makeStdHook("lstat");
        pub const lutimes = makeStdHook("lutimes");
        pub const mkdir = makeStdHook("mkdir");
        pub const mkdirat = makeStdHook("mkdirat");
        pub const open = makeStdHook("open");
        pub const openat = makeStdHook("openat");
        pub const read = makeStdHook("read");
        pub const rmdir = makeStdHook("rmdir");
        pub const stat = makeStdHook("stat");
        pub const unlink = makeStdHook("unlink");
        pub const unlinkat = makeStdHook("unlinkat");
        pub const utimes = makeStdHook("utimes");
        pub const utimensat = makeStdHook("utimensat");
        pub const write = makeStdHook("write");

        pub fn closedir(d: *std.c.DIR) callconv(.c) void {
            // if (is_redirected_object(d)) {
            //     redirected_DIR* dir = (redirected_DIR*) d;
            //     uint16_t err;
            //     redirect_close(dir->fd, &err);
            //     free(dir);
            //     if (!err) {
            //         return 0;
            //     } else {
            //         errno = err;
            //         return -1;
            //     }
            // }
            // return closedir_orig(d);
            return Original.closedir(d);
        }

        pub fn opendir(path: [*:0]const u8) callconv(.c) ?*std.c.DIR {
            // if (is_redirecting(mask_open)) {
            //     uint16_t err;
            //     int fd;
            //     if (redirect_open(-1, name, O_DIRECTORY, &fd, &err)) {
            //         redirected_DIR* dir;
            //         if (!err) {
            //             dir = malloc(sizeof(redirected_DIR));
            //             if (!dir) {
            //                 err = ENOMEM;
            //             }
            //         }
            //         if (!err) {
            //             dir->signature = REDIRECTED_OBJECT_SIGNATURE;
            //             dir->fd = fd;
            //             dir->cookie = 0;
            //             dir->data_len = 0;
            //             dir->data_next = 0;
            //             memset(&dir->entry, 0, sizeof(struct dirent));
            //             return dir;
            //         } else {
            //             return NULL;
            //         }
            //     }
            // }
            // return opendir_orig(name);
            return Original.opendir(path);
        }

        pub fn readdir(d: *std.c.DIR) callconv(.c) ?*std.c.DIR {
            // if (is_redirected_object(d)) {
            //     redirected_DIR* dir = (redirected_DIR*) d;
            //     struct dirent* entry;
            //     uint16_t err;
            //     redirect_readdir(d, &entry, &err);
            //     if (!err) {
            //         return entry;
            //     } else {
            //         errno = err;
            //         return NULL;
            //     }
            // }
            // return readdir_orig(d);
            return Original.readdir(d);
        }

        fn makeStdHook(comptime name: []const u8) StdHook(@TypeOf(@field(redirector, name))) {
            const handler = @field(redirector, name);
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
                    const original = @field(Original, name);
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
                errno_ptr = errno.__errno_location();
                break :get errno_ptr.?;
            };
        }

        const errno = @cImport({
            @cInclude("errno.h");
        });

        const Sub = @This();
        pub const Original = struct {
            pub var access: *const @TypeOf(Sub.access) = undefined;
            pub var close: *const @TypeOf(Sub.close) = undefined;
            pub var closedir: *const @TypeOf(Sub.closedir) = undefined;
            pub var faccessat: *const @TypeOf(Sub.faccessat) = undefined;
            pub var fadvise: *const @TypeOf(Sub.fadvise) = undefined;
            pub var fadvise64: *const @TypeOf(Sub.fadvise64) = undefined;
            pub var fallocate: *const @TypeOf(Sub.fallocate) = undefined;
            pub var fcntl: *const @TypeOf(Sub.fcntl) = undefined;
            pub var fdatasync: *const @TypeOf(Sub.fdatasync) = undefined;
            pub var fstat: *const @TypeOf(Sub.fstat) = undefined;
            pub var fstatat64: *const @TypeOf(Sub.fstatat64) = undefined;
            pub var fsync: *const @TypeOf(Sub.fsync) = undefined;
            pub var futimes: *const @TypeOf(Sub.futimes) = undefined;
            pub var futimesat: *const @TypeOf(Sub.futimesat) = undefined;
            pub var lseek: *const @TypeOf(Sub.lseek) = undefined;
            pub var lstat: *const @TypeOf(Sub.lstat) = undefined;
            pub var lutimes: *const @TypeOf(Sub.lutimes) = undefined;
            pub var mkdir: *const @TypeOf(Sub.mkdir) = undefined;
            pub var mkdirat: *const @TypeOf(Sub.mkdirat) = undefined;
            pub var open: *const @TypeOf(Sub.open) = undefined;
            pub var opendir: *const @TypeOf(Sub.opendir) = undefined;
            pub var openat: *const @TypeOf(Sub.openat) = undefined;
            pub var read: *const @TypeOf(Sub.read) = undefined;
            pub var readdir: *const @TypeOf(Sub.readdir) = undefined;
            pub var rmdir: *const @TypeOf(Sub.rmdir) = undefined;
            pub var stat: *const @TypeOf(Sub.stat) = undefined;
            pub var unlink: *const @TypeOf(Sub.unlink) = undefined;
            pub var unlinkat: *const @TypeOf(Sub.unlinkat) = undefined;
            pub var utimes: *const @TypeOf(Sub.utimes) = undefined;
            pub var utimensat: *const @TypeOf(Sub.utimensat) = undefined;
            pub var write: *const @TypeOf(Sub.write) = undefined;
        };
    };
}

const RedirectedDir = extern struct {
    sig: u64 = signature,
    fd: c_int,
    data_next: usize,
    data_len: usize,
    buffer: [4096]u8,

    pub const signature = 0x5249_4452_4147_495B;

    pub fn cast(s: *std.c.FILE) ?*@This() {
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
                if (!file.proxy) allocator.destroy(file);
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

        pub fn fgetpos(s: *std.c.FILE, pos: *stdio.fpos_t) callconv(.c) c_int {
            // if (is_redirected_object(s)) {
            //     redirected_FILE* file = (redirected_FILE*) s;
            //     uint16_t err;
            //     redirect_getpos(file->fd, pos, &err);
            //     if (!err) {
            //         return 0;
            //     } else {
            //         errno = file->error = err;
            //         return -1;
            //     }
            // }
            // return fgetpos_orig(s, pos);
            return Original.fgetpos(s, pos);
        }

        pub fn fopen(path: [*:0]const u8, mode: [*:0]const u8) callconv(.c) ?*std.c.FILE {
            var oflags: std.c.O = .{};
            if (mode[0] == 'r') {
                oflags.ACCMODE = if (mode[1] == '+') .RDONLY else .RDWR;
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
                var file: *RedirectedFile = undefined;
                if (fd > 0) {
                    file = allocator.create(RedirectedFile) catch return null;
                    file.fd = fd;
                    return @ptrCast(file);
                } else {
                    return null;
                }
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
                if (result < 0) return 0;
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

        pub fn fsetpos(s: *std.c.FILE, pos: *const stdio.fpos_t) callconv(.c) c_int {
            // if (is_redirected_object(s)) {
            //     redirected_FILE* file = (redirected_FILE*) s;
            //     uint16_t err;
            //     redirect_setpos(file->fd, pos, &err);
            //     if (!err) {
            //         file->eof = false;
            //         return 0;
            //     } else {
            //         errno = file->error = err;
            //         return -1;
            //     }
            // }
            // return fsetpos_orig(s, pos);
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
                if (result < 0) return 0;
                return if (len == result) n else @as(usize, @intCast(result)) / size;
            }
            return Original.fwrite(buffer, size, n, s);
        }

        pub fn perror(text: [*:0]const u8) callconv(.c) void {
            const msg = stdio.strerror(posix.getError());
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
                const result = posix.lseek(file.fd, 0, std.c.SEEK.CUR);
                if (result == 0) {
                    file.errno = 0;
                    file.eof = false;
                } else {
                    file.errno = posix.getError();
                }
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
            const sc: *stdio.FILE = @ptrCast(@alignCast(s));
            return RedirectedFile.cast(s) orelse getStdProxy(stdio.fileno(sc));
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

        const stdio = @cImport({
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
    const redirector = Syscallredirector(void);
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
    const redirector = Syscallredirector(Host);
    inline for (std.meta.declarations(redirector)) |decl| {
        const DT = @TypeOf(@field(redirector, decl.name));
        if (@typeInfo(DT) == .@"fn") {
            @field(vtable, decl.name) = &@field(redirector, decl.name);
        }
    }
    return vtable;
}

pub fn getHookTable(comptime Host: type) std.StaticStringMap(Entry) {
    const redirector = Syscallredirector(Host);
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
