const std = @import("std");
const E = std.os.wasi.errno_t;
const builtin = @import("builtin");

const ByteBuffer = @import("buffer.zig").ByteBuffer;
const interface = @import("module/native/interface.zig");
const Jscall = interface.Jscall;
const Syscall = interface.Syscall;
const ModuleHost = @import("host.zig").ModuleHost;
const php = @import("php.zig");
const HashTable = php.HashTable;
const Stream = php.Stream;
const Value = php.Value;
const redirection = @import("redirection.zig");
const ZigClass = @import("class.zig").ZigClass;

pub const CallDispatcher = struct {
    redirection_mask: Syscall.Mask = .{},
    stream_map: HashTable,
    host: *ModuleHost,
    hooks_installed: bool = false,
    syscall_trap_installed: bool = false,
    syscall_trap_count: usize = 0,
    thread_syscall_trap_list: std.ArrayList(*bool) = .{},
    thread_syscall_trap_list_mutex: std.Thread.Mutex = .{},
    env_variable_deferred: HookEntry.Deferred = .{},
    env_variable_list: ?[]?[*:0]const u8 = null,
    env_variable_bytes: ?[]const u8 = null,
    env_variable_ptr: *[*:null]?[*:0]const u8 = undefined,
    env_variable_original: *[*:null]?[*:0]const u8 = undefined,

    pub threadlocal var trapping_syscalls: bool = false;
    pub const HookEntry = interface.HookEntry;
    pub const HandlerVTable = interface.HandlerVTable;
    const redirection_controller = redirection.Controller(@This());

    pub fn init(host: *ModuleHost) !*@This() {
        const self = try php.allocator.create(@This());
        errdefer php.allocator.destroy(self);
        self.* = .{
            .host = host,
            .stream_map = php.createHashTable(php.destructor.value),
        };
        return self;
    }

    pub fn deinit(self: *@This()) void {
        php.destroyHashTable(&self.stream_map);
        php.allocator.destroy(self);
    }

    pub fn installHooks(self: *@This(), lib: *std.DynLib, lib_path: []const u8, redirect_syscalls: bool) !void {
        const pos = try redirection_controller.installHooks(self, lib, lib_path);
        if (redirect_syscalls) {
            if (self.getSyscallHook("__sc_vtable")) |hook| {
                const vtable: *const HandlerVTable = @ptrCast(@alignCast(hook.handler));
                try redirection_controller.addSyscallVtable(pos, vtable);
                errdefer redirection_controller.removeSyscallVtable(vtable) catch {};
                if (redirection_controller.installSyscallTrap(&trapping_syscalls)) {
                    self.syscall_trap_installed = true;
                } else |_| {}
            }
            self.hooks_installed = true;
        }
    }

    pub fn getSyscallHook(self: *@This(), name: [*:0]const u8) ?HookEntry {
        const module = self.host.module.?;
        var hook: HookEntry = undefined;
        return if (module.exports.get_syscall_hook(name, &hook) == .SUCCESS) .{
            .handler = hook.handler,
            .original = hook.original,
        } else if (std.mem.eql(u8, name[0..std.mem.len(name)], "environ")) .{
            // get the address to the pointer
            .handler = undefined,
            .original = undefined,
            .deferred = &self.env_variable_deferred,
        } else null;
    }

    pub fn handleJscall(self: *@This(), call: *Jscall) !E {
        _ = self;
        _ = call;
        unreachable;
    }

    pub fn handleSyscall(self: *@This(), call: *Syscall) !E {
        return switch (call.cmd) {
            .open => try self.handleOpen(&call.u.open),
            .close => try self.handleClose(&call.u.close),
            .read => try self.handleRead(&call.u.read),
            .readv => try self.handleVectorRead(&call.u.readv),
            .pread => try self.handlePositionalRead(&call.u.pread),
            .preadv => try self.handlePositionalVectorRead(&call.u.preadv),
            .write => try self.handleWrite(&call.u.write),
            .writev => try self.handleVectorWrite(&call.u.writev),
            .pwrite => try self.handlePositionalWrite(&call.u.pwrite),
            .pwritev => try self.handlePositionalVectorWrite(&call.u.pwritev),
            .seek => try self.handleSeek(&call.u.seek),
            .tell => try self.handleTell(&call.u.tell),
            .getfl => try self.handleGetDescriptorFlags(&call.u.getfl),
            .setfl => try self.handleSetDescriptorFlags(&call.u.setfl),
            .getlk => try self.handleGetLock(&call.u.getlk),
            .setlk => try self.handleSetLock(&call.u.setlk),
            .fstat => try self.handleStat(&call.u.fstat),
            .stat => try self.handleStat(&call.u.stat),
            .futimes => try self.handleSettimes(&call.u.futimes),
            .utimes => try self.handleSettimes(&call.u.utimes),
            .advise => try self.handleAdvise(&call.u.advise),
            .allocate => try self.handleAllocate(&call.u.allocate),
            .sync => try self.handleSync(&call.u.sync),
            .datasync => try self.handleDatasync(&call.u.datasync),
            .getdents => try self.handleGetdents(&call.u.getdents),
            .mkdir => try self.handleMkdir(&call.u.mkdir),
            .rmdir => try self.handleRmdir(&call.u.rmdir),
            .unlink => try self.handleUnlink(&call.u.unlink),
            .readlink => try self.handleReadlink(&call.u.readlink),
            .symlink => try self.handleSymlink(&call.u.symlink),
            .rename => try self.handleRename(&call.u.rename),
            .poll => try self.handlePoll(&call.u.poll),
            .sendfile => try self.handleSendFile(&call.u.sendfile),
            .environ => try self.handleGetEnvironmentStrings(&call.u.environ),
            .write_stderr => try self.handleWriteStderr(&call.u.write_stderr),
        };
    }

    pub fn getSyscallMask(self: *@This(), ptr: *Syscall.Mask) !void {
        var mask = self.redirection_mask;
        // a stat request can be handled by a 'stat' or an 'open' event handler
        if (mask.open) mask.stat = true;
        ptr.* = mask;
    }

    pub fn releaseFunction(self: *@This(), fn_id: usize) !void {
        _ = self;
        _ = fn_id;
    }

    pub fn redirectSyscalls(self: *@This(), ptr: *const anyopaque) !void {
        _ = self;
        _ = ptr;
    }

    pub fn enableMultithread(self: *@This()) !void {
        _ = self;
    }

    pub fn disableMultithread(self: *@This()) !void {
        _ = self;
    }

    pub fn initializeThread(self: *@This()) !void {
        _ = self;
    }

    pub fn deinitializeThread(self: *@This()) !void {
        _ = self;
    }

    fn getStream(self: *@This(), fd: c_long) !*Stream {
        if (php.getHashEntry(&self.stream_map, fd)) |value| {
            return try php.getValueStream(value);
        } else |err| {
            const path: [:0]const u8, const mode: [:0]const u8 = switch (fd) {
                0 => .{ "php://input", "r" },
                1, 2 => .{ "php://output", "w" },
                else => return err,
            };
            const strm = php.open(path, mode, 0) orelse return error.Unexpected;
            var strm_value = php.createValueStream(strm);
            php.setHashEntry(&self.stream_map, fd, &strm_value);
            return strm;
        }
    }

    fn handleOpen(self: *@This(), args: anytype) !E {
        _ = self;
        _ = args;
        unreachable;
        // const env = self.env;
        // const path_len: u32 = @truncate(std.mem.len(args.path));
        // return try self.callPosixFunction(self.js.path_open, &.{
        //     try env.createInt32(args.dirfd),
        //     try env.createUint32(@as(u32, @bitCast(args.lookup_flags))),
        //     try env.createUsize(@intFromPtr(args.path)),
        //     try env.createUint32(path_len),
        //     try env.createUint32(@as(u16, @bitCast(args.open_flags))),
        //     try env.createBigintUint64(@as(u64, @bitCast(args.rights))),
        //     try env.createBigintUint64(0),
        //     try env.createUint32(@as(u16, @bitCast(args.descriptor_flags))),
        //     try env.createUsize(@intFromPtr(&args.fd)),
        //     futex,
        // });
    }

    fn handleClose(self: *@This(), args: anytype) !E {
        _ = self;
        _ = args;
        unreachable;
        // const env = self.env;
        // return try self.callPosixFunction(self.js.fd_close, &.{
        //     try env.createInt32(args.fd),
        //     futex,
        // });
    }

    fn handleRead(self: *@This(), args: anytype) !E {
        _ = self;
        _ = args;
        unreachable;
        // const env = self.env;
        // const result = try self.callPosixFunction(self.js.fd_read1, &.{
        //     try env.createInt32(args.fd),
        //     try env.createUsize(@intFromPtr(args.bytes)),
        //     try env.createUint32(args.len),
        //     try env.createUsize(@intFromPtr(&args.read)),
        //     futex,
        // });
        // return result;
    }

    fn handleVectorRead(self: *@This(), args: anytype) !E {
        _ = self;
        _ = args;
        unreachable;
        // const env = self.env;
        // const result = try self.callPosixFunction(self.js.fd_read, &.{
        //     try env.createInt32(args.fd),
        //     try env.createUsize(@intFromPtr(args.iovs)),
        //     try env.createUint32(args.count),
        //     try env.createUsize(@intFromPtr(&args.read)),
        //     futex,
        // });
        // return result;
    }

    fn handlePositionalRead(self: *@This(), args: anytype) !E {
        _ = self;
        _ = args;
        unreachable;
        // const env = self.env;
        // return try self.callPosixFunction(self.js.fd_pread1, &.{
        //     try env.createInt32(args.fd),
        //     try env.createUsize(@intFromPtr(args.bytes)),
        //     try env.createUint32(args.len),
        //     try env.createBigintUint64(args.offset),
        //     try env.createUsize(@intFromPtr(&args.read)),
        //     futex,
        // });
    }

    fn handlePositionalVectorRead(self: *@This(), args: anytype) !E {
        _ = self;
        _ = args;
        unreachable;
        // const env = self.env;
        // return try self.callPosixFunction(self.js.fd_pread, &.{
        //     try env.createInt32(args.fd),
        //     try env.createUsize(@intFromPtr(args.iovs)),
        //     try env.createUint32(args.count),
        //     try env.createBigintUint64(args.offset),
        //     try env.createUsize(@intFromPtr(&args.read)),
        //     futex,
        // });
    }

    fn handleWrite(self: *@This(), args: anytype) !E {
        const strm = self.getStream(args.fd) catch return .BADF;
        const w = php.write(strm, args.bytes, args.len);
        if (w < 0) return .BADF;
        args.written = @intCast(w);
        return .SUCCESS;
    }

    fn handleWriteStderr(self: *@This(), args: anytype) !E {
        const strm = self.getStream(2) catch return .BADF;
        const w = php.write(strm, args.bytes, args.len);
        if (w < 0) return .BADF;
        return .SUCCESS;
    }

    fn handleVectorWrite(self: *@This(), args: anytype) !E {
        const strm = self.getStream(2) catch return .BADF;
        const len: usize = args.count;
        const iovs = args.iovs[0..len];
        var written: usize = 0;
        for (iovs) |iov| {
            const w = php.write(strm, iov.base, iov.len);
            if (w < 0) return .BADF;
            written += @intCast(w);
        }
        args.written = @intCast(written);
        return .SUCCESS;
    }

    fn handlePositionalWrite(self: *@This(), args: anytype) !E {
        _ = self;
        _ = args;
        unreachable;
        // const env = self.env;
        // return try self.callPosixFunction(self.js.fd_pwrite1, &.{
        //     try env.createInt32(args.fd),
        //     try env.createUsize(@intFromPtr(args.bytes)),
        //     try env.createUint32(args.len),
        //     try env.createBigintUint64(args.offset),
        //     try env.createUsize(@intFromPtr(&args.written)),
        //     futex,
        // });
    }

    fn handlePositionalVectorWrite(self: *@This(), args: anytype) !E {
        _ = self;
        _ = args;
        unreachable;
        // const env = self.env;
        // return try self.callPosixFunction(self.js.fd_pwrite, &.{
        //     try env.createInt32(args.fd),
        //     try env.createUsize(@intFromPtr(args.iovs)),
        //     try env.createUint32(args.count),
        //     try env.createBigintUint64(args.offset),
        //     try env.createUsize(@intFromPtr(&args.written)),
        //     futex,
        // });
    }

    fn handleSeek(self: *@This(), args: anytype) !E {
        _ = self;
        _ = args;
        unreachable;
        // const env = self.env;
        // return try self.callPosixFunction(self.js.fd_seek, &.{
        //     try env.createInt32(args.fd),
        //     try env.createBigintInt64(args.offset),
        //     try env.createUint32(args.whence),
        //     try env.createUsize(@intFromPtr(&args.position)),
        //     futex,
        // });
    }

    fn handleTell(self: *@This(), args: anytype) !E {
        _ = self;
        _ = args;
        unreachable;
        // const env = self.env;
        // return try self.callPosixFunction(self.js.fd_tell, &.{
        //     try env.createInt32(args.fd),
        //     try env.createUsize(@intFromPtr(&args.position)),
        //     futex,
        // });
    }

    fn handleSettimes(self: *@This(), args: anytype) !E {
        _ = self;
        _ = args;
        unreachable;
        // const env = self.env;
        // if (@hasField(@TypeOf(args.*), "fd")) {
        //     return try self.callPosixFunction(self.js.fd_filestat_set_times, &.{
        //         try env.createInt32(args.fd),
        //         try env.createBigintInt64(args.atime),
        //         try env.createBigintInt64(args.mtime),
        //         try env.createUint32(@as(u16, @bitCast(args.time_flags))),
        //         futex,
        //     });
        // } else {
        //     const path_len: u32 = @truncate(std.mem.len(args.path));
        //     return try self.callPosixFunction(self.js.path_filestat_set_times, &.{
        //         try env.createInt32(args.dirfd),
        //         try env.createUint32(@as(u32, @bitCast(args.lookup_flags))),
        //         try env.createUsize(@intFromPtr(args.path)),
        //         try env.createUint32(path_len),
        //         try env.createBigintInt64(args.atime),
        //         try env.createBigintInt64(args.mtime),
        //         try env.createUint32(@as(u16, @bitCast(args.time_flags))),
        //         futex,
        //     });
        // }
    }

    fn handleStat(self: *@This(), args: anytype) !E {
        _ = self;
        _ = args;
        unreachable;
        // const env = self.env;
        // if (@hasField(@TypeOf(args.*), "fd")) {
        //     return try self.callPosixFunction(self.js.fd_filestat_get, &.{
        //         try env.createInt32(args.fd),
        //         try env.createUsize(@intFromPtr(&args.stat)),
        //         futex,
        //     });
        // } else {
        //     const path_len: u32 = @truncate(std.mem.len(args.path));
        //     return try self.callPosixFunction(self.js.path_filestat_get, &.{
        //         try env.createInt32(args.dirfd),
        //         try env.createUint32(@as(u32, @bitCast(args.lookup_flags))),
        //         try env.createUsize(@intFromPtr(args.path)),
        //         try env.createUint32(path_len),
        //         try env.createUsize(@intFromPtr(&args.stat)),
        //         futex,
        //     });
        // }
    }

    fn handleGetDescriptorFlags(self: *@This(), args: anytype) !E {
        _ = self;
        _ = args;
        unreachable;
        // const env = self.env;
        // return try self.callPosixFunction(self.js.fd_fdstat_get, &.{
        //     try env.createInt32(args.fd),
        //     try env.createUsize(@intFromPtr(&args.fdstat)),
        //     futex,
        // });
    }

    fn handleSetDescriptorFlags(self: *@This(), args: anytype) !E {
        _ = self;
        _ = args;
        unreachable;
        // const env = self.env;
        // return try self.callPosixFunction(self.js.fd_fdstat_set_flags, &.{
        //     try env.createInt32(args.fd),
        //     try env.createUint32(@as(u16, @bitCast(args.fdflags))),
        //     futex,
        // });
    }

    fn handleSetLock(self: *@This(), args: anytype) !E {
        _ = self;
        _ = args;
        unreachable;
        // const env = self.env;
        // return try self.callPosixFunction(self.js.fd_lock_set, &.{
        //     try env.createInt32(args.fd),
        //     try env.createUsize(@intFromPtr(&args.lock)),
        //     try env.getBoolean(args.wait),
        //     futex,
        // });
    }

    fn handleGetLock(self: *@This(), args: anytype) !E {
        _ = self;
        _ = args;
        unreachable;
        // const env = self.env;
        // return try self.callPosixFunction(self.js.fd_lock_get, &.{
        //     try env.createInt32(args.fd),
        //     try env.createUsize(@intFromPtr(&args.lock)),
        //     futex,
        // });
    }

    fn handleAdvise(self: *@This(), args: anytype) !E {
        _ = self;
        _ = args;
        unreachable;
        // const env = self.env;
        // return try self.callPosixFunction(self.js.fd_advise, &.{
        //     try env.createInt32(args.fd),
        //     try env.createBigintUint64(args.offset),
        //     try env.createBigintUint64(args.len),
        //     try env.createInt32(@intFromEnum(args.advice)),
        //     futex,
        // });
    }

    fn handleAllocate(self: *@This(), args: anytype) !E {
        _ = self;
        _ = args;
        unreachable;
        // const env = self.env;
        // return try self.callPosixFunction(self.js.fd_allocate, &.{
        //     try env.createInt32(args.fd),
        //     try env.createBigintUint64(args.offset),
        //     try env.createBigintUint64(args.len),
        //     futex,
        // });
    }

    fn handleSync(self: *@This(), args: anytype) !E {
        _ = self;
        _ = args;
        unreachable;
        // const env = self.env;
        // return try self.callPosixFunction(self.js.fd_sync, &.{
        //     try env.createInt32(args.fd),
        //     futex,
        // });
    }

    fn handleDatasync(self: *@This(), args: anytype) !E {
        _ = self;
        _ = args;
        unreachable;
        // const env = self.env;
        // return try self.callPosixFunction(self.js.fd_datasync, &.{
        //     try env.createInt32(args.fd),
        //     futex,
        // });
    }

    fn handleMkdir(self: *@This(), args: anytype) !E {
        _ = self;
        _ = args;
        unreachable;
        // const env = self.env;
        // const path_len: u32 = @truncate(std.mem.len(args.path));
        // return try self.callPosixFunction(self.js.path_create_directory, &.{
        //     try env.createInt32(args.dirfd),
        //     try env.createUsize(@intFromPtr(args.path)),
        //     try env.createUint32(path_len),
        //     futex,
        // });
    }

    fn handleRmdir(self: *@This(), args: anytype) !E {
        _ = self;
        _ = args;
        unreachable;
        // const env = self.env;
        // const path_len: u32 = @truncate(std.mem.len(args.path));
        // return try self.callPosixFunction(self.js.path_remove_directory, &.{
        //     try env.createInt32(args.dirfd),
        //     try env.createUsize(@intFromPtr(args.path)),
        //     try env.createUint32(path_len),
        //     futex,
        // });
    }

    fn handleUnlink(self: *@This(), args: anytype) !E {
        _ = self;
        _ = args;
        unreachable;
        // const env = self.env;
        // const path_len: u32 = @truncate(std.mem.len(args.path));
        // return try self.callPosixFunction(self.js.path_unlink_file, &.{
        //     try env.createInt32(args.dirfd),
        //     try env.createUsize(@intFromPtr(args.path)),
        //     try env.createUint32(path_len),
        //     futex,
        // });
    }

    fn handleReadlink(self: *@This(), args: anytype) !E {
        _ = self;
        _ = args;
        unreachable;
        // const env = self.env;
        // const path_len: u32 = @truncate(std.mem.len(args.path));
        // return try self.callPosixFunction(self.js.path_readlink, &.{
        //     try env.createInt32(args.dirfd),
        //     try env.createUsize(@intFromPtr(args.path)),
        //     try env.createUint32(path_len),
        //     try env.createUsize(@intFromPtr(args.bytes)),
        //     try env.createUint32(args.len),
        //     try env.createUsize(@intFromPtr(&args.read)),
        //     futex,
        // });
    }

    fn handleSymlink(self: *@This(), args: anytype) !E {
        _ = self;
        _ = args;
        unreachable;
        // const env = self.env;
        // const target_len: u32 = @truncate(std.mem.len(args.target));
        // const path_len: u32 = @truncate(std.mem.len(args.path));
        // return try self.callPosixFunction(self.js.path_symlink, &.{
        //     try env.createUsize(@intFromPtr(args.target)),
        //     try env.createUint32(target_len),
        //     try env.createInt32(args.dirfd),
        //     try env.createUsize(@intFromPtr(args.path)),
        //     try env.createUint32(path_len),
        //     futex,
        // });
    }

    fn handleRename(self: *@This(), args: anytype) !E {
        _ = self;
        _ = args;
        unreachable;
        // const env = self.env;
        // const path_len: u32 = @truncate(std.mem.len(args.path));
        // const new_path_len: u32 = @truncate(std.mem.len(args.new_path));
        // return try self.callPosixFunction(self.js.path_rename, &.{
        //     try env.createInt32(args.dirfd),
        //     try env.createUsize(@intFromPtr(args.path)),
        //     try env.createUint32(path_len),
        //     try env.createInt32(args.new_dirfd),
        //     try env.createUsize(@intFromPtr(args.new_path)),
        //     try env.createUint32(new_path_len),
        //     futex,
        // });
    }

    fn handleGetdents(self: *@This(), args: anytype) !E {
        _ = self;
        _ = args;
        unreachable;
        // const env = self.env;
        // return try self.callPosixFunction(self.js.fd_readdir, &.{
        //     try env.createInt32(args.dirfd),
        //     try env.createUsize(@intFromPtr(args.buffer)),
        //     try env.createUint32(args.len),
        //     try env.createUint32(0),
        //     try env.createUsize(@intFromPtr(&args.read)),
        //     futex,
        // });
    }

    fn handlePoll(self: *@This(), args: anytype) !E {
        _ = self;
        _ = args;
        unreachable;
        // const env = self.env;
        // return try self.callPosixFunction(self.js.poll_oneoff, &.{
        //     try env.createUsize(@intFromPtr(args.subscriptions)),
        //     try env.createUsize(@intFromPtr(args.events)),
        //     try env.createUint32(args.subscription_count),
        //     try env.createUsize(@intFromPtr(&args.event_count)),
        //     futex,
        // });
    }

    fn handleSendFile(self: *@This(), args: anytype) !E {
        _ = self;
        _ = args;
        unreachable;
        // const env = self.env;
        // return try self.callPosixFunction(self.js.fd_sendfile, &.{
        //     try env.createInt32(args.out_fd),
        //     try env.createInt32(args.in_fd),
        //     try env.createBigintInt64(if (args.offset) |ptr| ptr.* else 0),
        //     try env.createUsize(@intFromPtr(args.offset)),
        //     try env.createUint32(args.len),
        //     try env.createUsize(@intFromPtr(&args.sent)),
        //     futex,
        // });
    }

    fn handleGetEnvironmentStrings(self: *@This(), args: anytype) !E {
        _ = self;
        _ = args;
        unreachable;
        // var result: E = undefined;
        // if (self.env_variable_list != null) {
        //     args.list = @ptrCast(self.env_variable_list.?.ptr);
        //     args.bytes = @ptrCast(self.env_variable_bytes.?.ptr);
        //     args.count = @intCast(self.env_variable_list.?.len);
        //     args.len = @intCast(self.env_variable_bytes.?.len);
        //     result = .SUCCESS;
        // } else {
        //     result = .OPNOTSUPP;
        // }
        // const env = self.env;
        // if (env.getValueUsize(futex)) |handle| {
        //     try Futex.wake(handle, result);
        // } else |_| {}
        // return result;
    }
};
