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
const Object = php.Object;
const Stream = php.Stream;
const StreamContext = php.StreamContext;
const String = php.String;
const Value = php.Value;
const redirection = @import("redirection.zig");
const structure = @import("structure.zig");
const ZigClassEntry = @import("class-entry.zig").ZigClassEntry;

pub const CallDispatcher = struct {
    redirection_mask: Syscall.Mask = .{
        .open = true,
        .mkdir = true,
        .readlink = true,
        .rename = true,
        .rmdir = true,
        .stat = true,
        .symlink = true,
        .unlink = true,
        .utimes = true,
    },
    function_list: std.ArrayList(CallbackEntry) = .empty,
    next_function_id: c_ulong = 1,
    stream_list: std.ArrayList(StreamEntry) = .empty,
    host: *ModuleHost,
    hooks_installed: bool = false,
    syscall_trap_installed: bool = false,
    syscall_trap_count: usize = 0,
    thread_syscall_trap_list: std.ArrayList(*bool) = .empty,
    thread_syscall_trap_list_mutex: std.Thread.Mutex = .{},
    env_variable_deferred: HookEntry.Deferred = .{},
    env_variable_list: ?[]?[*:0]const u8 = null,
    env_variable_bytes: ?[]const u8 = null,
    env_variable_ptr: *[*:null]?[*:0]const u8 = undefined,
    env_variable_original: *[*:null]?[*:0]const u8 = undefined,

    pub threadlocal var trapping_syscalls: bool = true;
    pub const HookEntry = interface.HookEntry;
    pub const HandlerVTable = interface.HandlerVTable;
    const redirection_controller = redirection.Controller(@This());
    const CallbackEntry = struct {
        id: usize,
        class: *Object,
        callable: *Value,
    };
    const StreamEntry = struct {
        fd: c_long,
        url: *String,
        stream: *Stream,
        fd_stat: std.os.wasi.fdstat_t,
    };
    const fd_min = 0x00f0_0000;
    const fd_max = 0x00ff_ffff;

    pub fn init(host: *ModuleHost) !*@This() {
        const self = try php.allocator.create(@This());
        errdefer php.allocator.destroy(self);
        self.* = .{ .host = host };
        return self;
    }

    pub fn deinit(self: *@This()) void {
        for (self.function_list.items) |entry| php.release(entry.callable);
        self.function_list.deinit(php.allocator);
        for (self.stream_list.items) |entry| _ = php.close(entry.stream);
        self.stream_list.deinit(php.allocator);
        php.allocator.destroy(self);
    }

    pub fn installHandler() void {
        CallDispatcher.redirection_controller.installSignalHandler() catch {};
    }

    pub fn uninstallHandler() void {
        CallDispatcher.redirection_controller.uninstallSignalHandler();
    }

    pub fn createJsThunk(self: *@This(), class_obj: *Object, callable: *Value) !usize {
        const class = ZigClassEntry.fromObject(class_obj);
        const fn_static = class.getStaticData(structure.Function);
        const controller_address = fn_static.controller_address;
        if (controller_address == 0) return error.Unexpected;
        var thunk_address: usize = 0;
        const module = self.host.module orelse return error.Unexpected;
        const fn_id = try self.saveCallback(class_obj, callable);
        _ = module.exports.create_js_thunk(controller_address, fn_id, &thunk_address);
        return thunk_address;
    }

    pub fn destroyJsThunk(self: *@This(), controller_address: usize, thunk_address: usize) !void {
        var fn_id: usize = 0;
        const module = self.host.module orelse return error.Unexpected;
        _ = module.exports.destroy_js_thunk(controller_address, thunk_address, &fn_id);
        try self.deleteCallback(fn_id);
    }

    fn saveCallback(self: *@This(), class_obj: *Object, callable: *Value) !usize {
        const fn_id = self.next_function_id;
        self.next_function_id +%= 1;
        php.addRef(callable);
        php.addRef(class_obj);
        try self.function_list.append(php.allocator, .{
            .id = fn_id,
            .class = class_obj,
            .callable = callable,
        });
        return fn_id;
    }

    fn findCallback(self: *@This(), fn_id: usize) ?*CallbackEntry {
        return for (self.function_list.items) |*item| {
            if (item.id == fn_id) break item;
        } else null;
    }

    fn deleteCallback(self: *@This(), fn_id: usize) void {
        for (self.function_list.items, 0..) |item, i| {
            if (item.id == fn_id) {
                php.release(item.callable);
                php.release(item.class);
                _ = self.function_list.swapRemove(i);
                break;
            }
        }
    }

    pub fn handleJscall(self: *@This(), call: *Jscall) !E {
        const cb = self.findCallback(call.fn_id) orelse return .FAULT;
        const arg_ptr: [*]u8 = @ptrFromInt(call.arg_address);
        const arg_bytes = arg_ptr[0..call.arg_size];
        const class = ZigClassEntry.fromObject(cb.class);
        const fn_static = class.getStaticData(structure.Function);
        try fn_static.runCallback(cb.callable, arg_bytes);
        return .SUCCESS;
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
        self.deleteCallback(fn_id);
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

    fn findStream(self: *@This(), fd: c_long) !*StreamEntry {
        for (self.stream_list.items) |*entry| {
            if (entry.fd == fd) return entry;
        } else {
            const path: []const u8, const mode: [*:0]const u8 = switch (fd) {
                0 => .{ "php://input", "r" },
                1, 2 => .{ "php://output", "w" },
                else => return error.Unexpected,
            };
            const url = php.createString(path);
            defer php.release(url);
            const strm = php.open(url, mode, 0) catch return error.Unexpected;
            const stat: std.os.wasi.fdstat_t = .{
                .fs_filetype = .REGULAR_FILE,
                .fs_flags = .{},
                .fs_rights_base = .{
                    .FD_READ = mode[0] == 'r',
                    .FD_WRITE = mode[0] == 'w',
                },
                .fs_rights_inheriting = .{},
            };
            return try self.addStreamEntry(fd, url, strm, &stat);
        }
    }

    fn addStreamEntry(self: *@This(), fd: c_long, url: *String, strm: *Stream, stat: *const std.os.wasi.fdstat_t) !*StreamEntry {
        const entry = try self.stream_list.addOne(php.allocator);
        entry.fd = fd;
        entry.url = url;
        entry.stream = strm;
        entry.fd_stat = stat.*;
        php.addRef(url);
        return entry;
    }

    fn createDescriptor(self: *@This()) !c_long {
        var fd: c_long = fd_min;
        return while (fd < fd_max) : (fd += 1) {
            for (self.stream_list.items) |item| {
                if (item.fd == fd) break;
            } else return fd;
        } else error.OutOfDescriptor;
    }

    fn getWrapperUrl(path: [*:0]const u8) ?[]const u8 {
        var start: usize = 0;
        var index: usize = 0;
        while (true) : (index += 1) {
            const c = path[index];
            if (c == ':') {
                const s = path[start..];
                const len = std.mem.len(s);
                return s[0..len];
            } else if (index == 0 and (c == '/' or c == '\\')) {
                start += 1;
            } else if (!std.ascii.isAlphanumeric(c)) {
                break;
            }
        }
        return null;
    }

    const PathInfo = struct {
        url: *String,
        context: ?*StreamContext = null,

        pub fn deinit(self: *const @This()) void {
            php.release(self.url);
        }
    };

    fn resolvePath(self: *@This(), dirfd: c_long, path: [*:0]const u8) !?PathInfo {
        if (getWrapperUrl(path)) |url| {
            return .{ .url = php.createString(url) };
        } else if (dirfd == -1) {
            return null;
        } else {
            const parent = try self.findStream(dirfd);
            const name = path[0..std.mem.len(path)];
            return .{
                .url = try php.resolve(name, parent.url),
                .context = php.getStreamContext(parent.stream),
            };
        }
    }

    fn handleOpen(self: *@This(), args: anytype) !E {
        const loc = (self.resolvePath(args.dirfd, args.path) catch return .BADF) orelse return .OPNOTSUPP;
        defer loc.deinit();
        const mode = if (args.rights.FD_WRITE)
            if (args.open_flags.CREAT)
                if (args.descriptor_flags.APPEND)
                    if (args.rights.FD_READ) "a+" else "a"
                else if (args.open_flags.EXCL)
                    if (args.rights.FD_READ) "x+" else "x"
                else if (args.open_flags.TRUNC)
                    if (args.rights.FD_READ) "w+" else "w"
                else if (args.rights.FD_READ) "c+" else "c"
            else
                "r+"
        else
            "r";
        const fd = self.createDescriptor() catch return .MFILE;
        const strm = php.open(loc.url, mode, 0) catch return .NOENT;
        const stat: std.os.wasi.fdstat_t = .{
            .fs_filetype = .REGULAR_FILE,
            .fs_flags = args.descriptor_flags,
            .fs_rights_base = args.rights,
            .fs_rights_inheriting = .{},
        };
        errdefer php.close(strm);
        _ = self.addStreamEntry(fd, loc.url, strm, &stat) catch return .MFILE;
        args.fd = @intCast(fd);
        return .SUCCESS;
    }

    fn handleClose(self: *@This(), args: anytype) !E {
        const entry = self.findStream(args.fd) catch return .BADF;
        php.close(entry.stream);
        const index = (@intFromPtr(entry) - @intFromPtr(self.stream_list.items.ptr)) / @sizeOf(StreamEntry);
        _ = self.stream_list.swapRemove(index);
        return .SUCCESS;
    }

    fn handleRead(self: *@This(), args: anytype) !E {
        const entry = self.findStream(args.fd) catch return .BADF;
        const read = php.read(entry.stream, args.bytes, args.len) catch return .BADF;
        args.read = @intCast(read);
        return .SUCCESS;
    }

    fn handleVectorRead(self: *@This(), args: anytype) !E {
        const entry = self.findStream(args.fd) catch return .BADF;
        const len: usize = args.count;
        const iovs = args.iovs[0..len];
        var total: usize = 0;
        for (iovs) |iov| {
            total += php.read(entry.stream, iov.base, iov.len) catch return .BADF;
        }
        args.read = @intCast(total);
        return .SUCCESS;
    }

    fn handlePositionalRead(self: *@This(), args: anytype) !E {
        const entry = self.findStream(args.fd) catch return .BADF;
        const pos = php.tell(entry.stream) catch return .BADF;
        defer php.seek(entry.stream, @intCast(pos), 0) catch {};
        php.seek(entry.stream, @intCast(args.offset), 0) catch return .INVAL;
        const read = php.read(entry.stream, args.bytes, args.len) catch return .IO;
        args.read = @intCast(read);
        return .SUCCESS;
    }

    fn handlePositionalVectorRead(self: *@This(), args: anytype) !E {
        const entry = self.findStream(args.fd) catch return .BADF;
        const pos = php.tell(entry.stream) catch return .BADF;
        defer php.seek(entry.stream, @intCast(pos), 0) catch {};
        php.seek(entry.stream, @intCast(args.offset), 0) catch return .INVAL;
        const len: usize = args.count;
        const iovs = args.iovs[0..len];
        var total: usize = 0;
        for (iovs) |iov| {
            total += php.read(entry.stream, iov.base, iov.len) catch return .BADF;
        }
        args.read = @intCast(total);
        return .SUCCESS;
    }

    fn handleWrite(self: *@This(), args: anytype) !E {
        const entry = self.findStream(args.fd) catch return .BADF;
        const written = php.write(entry.stream, args.bytes, args.len) catch return .BADF;
        args.written = @intCast(written);
        return .SUCCESS;
    }

    fn handleWriteStderr(self: *@This(), args: anytype) !E {
        const entry = self.findStream(2) catch return .BADF;
        _ = php.write(entry.stream, args.bytes, args.len) catch return .BADF;
        return .SUCCESS;
    }

    fn handleVectorWrite(self: *@This(), args: anytype) !E {
        const entry = self.findStream(args.fd) catch return .BADF;
        const len: usize = args.count;
        const iovs = args.iovs[0..len];
        var total: usize = 0;
        for (iovs) |iov| {
            total += php.write(entry.stream, iov.base, iov.len) catch return .BADF;
        }
        args.written = @intCast(total);
        return .SUCCESS;
    }

    fn handlePositionalWrite(self: *@This(), args: anytype) !E {
        const entry = self.findStream(args.fd) catch return .BADF;
        const pos = php.tell(entry.stream) catch return .BADF;
        defer php.seek(entry.stream, @intCast(pos), 0) catch {};
        php.seek(entry.stream, @intCast(args.offset), 0) catch return .INVAL;
        const written = php.write(entry.stream, args.bytes, args.len) catch return .BADF;
        args.written = @intCast(written);
        return .SUCCESS;
    }

    fn handlePositionalVectorWrite(self: *@This(), args: anytype) !E {
        const entry = self.findStream(args.fd) catch return .BADF;
        const pos = php.tell(entry.stream) catch return .BADF;
        defer php.seek(entry.stream, @intCast(pos), 0) catch {};
        php.seek(entry.stream, @intCast(args.offset), 0) catch return .INVAL;
        const len: usize = args.count;
        const iovs = args.iovs[0..len];
        var total: usize = 0;
        for (iovs) |iov| {
            total += php.write(entry.stream, iov.base, iov.len) catch return .BADF;
        }
        args.written = @intCast(total);
        return .SUCCESS;
    }

    fn handleSeek(self: *@This(), args: anytype) !E {
        const entry = self.findStream(args.fd) catch return .BADF;
        php.seek(entry.stream, args.offset, args.whence) catch return .INVAL;
        args.position = php.tell(entry.stream) catch return .BADF;
        return .SUCCESS;
    }

    fn handleTell(self: *@This(), args: anytype) !E {
        const entry = self.findStream(args.fd) catch return .BADF;
        args.position = php.tell(entry.stream) catch return .BADF;
        return .SUCCESS;
    }

    fn handleSettimes(self: *@This(), args: anytype) !E {
        _ = self;
        _ = args;
        return .OPNOTSUPP;
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
        return .OPNOTSUPP;
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
        const entry = self.findStream(args.fd) catch return .BADF;
        args.fdstat = entry.fd_stat;
        return .SUCCESS;
    }

    fn handleSetDescriptorFlags(self: *@This(), args: anytype) !E {
        const entry = self.findStream(args.fd) catch return .BADF;
        const blocking: c_int = if (args.fdflags.NONBLOCK) 0 else 1;
        php.setOption(entry.stream, .blocking, blocking, null) catch return .FAULT;
        const sync = if (args.fdflags.SYNC) php.FSYNC else if (args.fdflags.DSYNC) php.FDSYNC else 0;
        php.setOption(entry.stream, .sync_api, sync, null) catch return .FAULT;
        return .SUCCESS;
    }

    fn handleSetLock(self: *@This(), args: anytype) !E {
        const entry = self.findStream(args.fd) catch return .BADF;
        php.setOption(entry.stream, .locking, args.lock.type, null) catch return .FAULT;
        return .SUCCESS;
    }

    fn handleGetLock(self: *@This(), args: anytype) !E {
        const entry = self.findStream(args.fd) catch return .BADF;
        _ = entry;
        return .OPNOTSUPP;
    }

    fn handleAdvise(self: *@This(), args: anytype) !E {
        const entry = self.findStream(args.fd) catch return .BADF;
        _ = entry;
        return .SUCCESS;
    }

    fn handleAllocate(self: *@This(), args: anytype) !E {
        const entry = self.findStream(args.fd) catch return .BADF;
        _ = entry;
        return .NOSYS;
    }

    fn handleSync(self: *@This(), args: anytype) !E {
        const entry = self.findStream(args.fd) catch return .BADF;
        php.flush(entry.stream);
        return .SUCCESS;
    }

    fn handleDatasync(self: *@This(), args: anytype) !E {
        const entry = self.findStream(args.fd) catch return .BADF;
        php.flush(entry.stream);
        return .SUCCESS;
    }

    fn handleMkdir(self: *@This(), args: anytype) !E {
        const loc = (self.resolvePath(args.dirfd, args.path) catch return .BADF) orelse return .OPNOTSUPP;
        defer loc.deinit();
        php.mkdir(loc.url, args.mode, loc.context) catch return .NOENT;
        return .SUCCESS;
    }

    fn handleRmdir(self: *@This(), args: anytype) !E {
        const loc = (self.resolvePath(args.dirfd, args.path) catch return .BADF) orelse return .OPNOTSUPP;
        defer loc.deinit();
        php.rmdir(loc.url, loc.context) catch return .NOENT;
        return .SUCCESS;
    }

    fn handleUnlink(self: *@This(), args: anytype) !E {
        const loc = (self.resolvePath(args.dirfd, args.path) catch return .BADF) orelse return .OPNOTSUPP;
        defer loc.deinit();
        php.unlink(loc.url, loc.context) catch return .NOENT;
        return .SUCCESS;
    }

    fn handleReadlink(self: *@This(), args: anytype) !E {
        const loc = (self.resolvePath(args.dirfd, args.path) catch return .BADF) orelse return .OPNOTSUPP;
        defer loc.deinit();
        return .INVAL;
    }

    fn handleSymlink(self: *@This(), args: anytype) !E {
        const loc = (self.resolvePath(args.dirfd, args.path) catch return .BADF) orelse return .OPNOTSUPP;
        defer loc.deinit();
        return .INVAL;
    }

    fn handleRename(self: *@This(), args: anytype) !E {
        const loc = (self.resolvePath(args.dirfd, args.path) catch return .BADF) orelse return .OPNOTSUPP;
        defer loc.deinit();
        const new_loc = (self.resolvePath(args.new_dirfd, args.new_path) catch return .BADF) orelse return .OPNOTSUPP;
        defer new_loc.deinit();
        php.rename(loc.url, new_loc.url, new_loc.context) catch return .NOENT;
        return .SUCCESS;
    }

    fn handleGetdents(self: *@This(), args: anytype) !E {
        _ = self;
        _ = args;
        return .OPNOTSUPP;
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
        return .OPNOTSUPP;
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
        return .OPNOTSUPP;
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
        if (self.env_variable_list != null) {
            args.list = @ptrCast(self.env_variable_list.?.ptr);
            args.bytes = @ptrCast(self.env_variable_bytes.?.ptr);
            args.count = @intCast(self.env_variable_list.?.len);
            args.len = @intCast(self.env_variable_bytes.?.len);
            return .SUCCESS;
        } else {
            return .OPNOTSUPP;
        }
    }
};
