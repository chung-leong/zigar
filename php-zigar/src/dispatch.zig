const std = @import("std");
const E = std.os.wasi.errno_t;
const builtin = @import("builtin");

const ByteBuffer = @import("buffer.zig").ByteBuffer;
const EventLoop = @import("event-loop.zig").EventLoop;
const failure = @import("failure.zig");
const interface = @import("module/native/interface.zig");
const Jscall = interface.Jscall;
const Syscall = interface.Syscall;
const ModuleHost = @import("host.zig").ModuleHost;
const php = @import("php.zig");
const ArgumentIterator = php.ArgumentIterator;
const ExecuteData = php.ExecuteData;
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
    multithread_enabled: bool = false,
    pipe_ptr: [*]std.posix.fd_t,

    pub threadlocal var trapping_syscalls: bool = true;
    pub threadlocal var event_loop: EventLoop(runScheduledTask) = .{};

    threadlocal var thread_initialized: bool = false;
    threadlocal var in_main_thread: bool = false;
    threadlocal var pipes: [2]std.posix.fd_t = undefined;
    threadlocal var multithread_count: usize = 0;

    var pipe_list_mutex: std.Thread.Mutex = .{};
    var pipe_list: std.ArrayList(std.posix.fd_t) = .empty;

    pub const HookEntry = interface.HookEntry;
    pub const HandlerVTable = interface.HandlerVTable;

    const redirection_controller = redirection.Controller(@This());
    const CallbackEntry = struct {
        id: usize,
        class: *ZigClassEntry,
        callable: Value,

        pub fn deinit(self: *@This()) void {
            php.release(self.class.object);
            php.release(&self.callable);
        }
    };
    const StreamEntry = struct {
        fd: c_long,
        stream: *Stream,
        path: *String,
        fd_stat: std.os.wasi.fdstat_t,
        dir_entry: ?*php.DirEntry = null,
        flags: packed struct {
            close: bool = false,
            populated: bool = false,
        } = .{},

        pub fn deinit(self: *@This()) void {
            php.release(self.path);
            if (self.dir_entry) |de| php.allocator.destroy(de);
            if (self.flags.close) _ = php.close(self.stream);
        }
    };
    const ScheduledTask = struct {
        self: *CallDispatcher,
        operation: Operation,

        pub const Operation = union(enum) {
            jscall: *Jscall,
            syscall: *Syscall,
            disable: void,
        };
    };
    const Futex = struct {
        const initial_value = 0xffff_ffff;

        value: std.atomic.Value(u32) = .init(initial_value),
        handle: usize,
        timeout: usize = 0,

        pub fn init(self: *@This()) usize {
            self.* = .{ .handle = @intFromPtr(self) };
            return self.handle;
        }

        pub fn wait(self: *@This()) E {
            if (self.timeout != 0) {
                std.Thread.Futex.timedWait(&self.value, initial_value, self.timeout) catch {
                    return E.SUCCESS;
                };
            } else {
                std.Thread.Futex.wait(&self.value, initial_value);
            }
            const final_value = self.value.load(.acquire);
            return std.meta.intToEnum(E, final_value) catch E.FAULT;
        }

        pub fn wake(handle: usize, result: E) !void {
            const ptr: *Futex = @ptrFromInt(handle);
            if (ptr.handle != handle) return error.Unexpected;
            ptr.value.store(@intFromEnum(result), .release);
            std.Thread.Futex.wake(&ptr.value, 1);
        }
    };
    const fd_min = 0x00f0_0000;
    const fd_max = 0x00ff_ffff;

    pub fn init(host: *ModuleHost) !*@This() {
        const self = try php.allocator.create(@This());
        errdefer php.allocator.destroy(self);
        self.* = .{ .host = host, .pipe_ptr = &pipes };
        return self;
    }

    pub fn deinit(self: *@This()) void {
        self.disableMultithread() catch {};
        if (self.syscall_trap_installed) {
            if (self.getSyscallHook("__sc_vtable")) |hook| {
                const vtable: *const HandlerVTable = @ptrCast(@alignCast(hook.handler));
                redirection_controller.removeSyscallVtable(vtable) catch {};
            }
        }
        for (self.function_list.items) |*ptr| ptr.deinit();
        self.function_list.deinit(php.allocator);
        for (self.stream_list.items) |*ptr| ptr.deinit();
        self.stream_list.deinit(php.allocator);
        php.allocator.destroy(self);
    }

    pub fn installHandler() !void {
        if (!thread_initialized) {
            in_main_thread = true;
            redirection_controller.installSignalHandler() catch {};
            if (php.pipe(&pipes) < 0) return error.UnableToOpenPipe;
            pipe_list_mutex.lock();
            defer pipe_list_mutex.unlock();
            for (pipes) |fd| try pipe_list.append(std.heap.c_allocator, fd);
        }
    }

    pub fn uninstallHandlers() void {
        for (pipes) |fd| _ = std.c.close(fd);
    }

    pub fn createJsThunk(self: *@This(), class: *ZigClassEntry, callable: *Value) !usize {
        const fn_static = class.getStaticData(structure.Function);
        const controller_address = fn_static.controller_address;
        if (controller_address == 0) return error.Unexpected;
        var thunk_address: usize = 0;
        const module = self.host.module orelse return error.Unexpected;
        const fn_id = try self.saveCallback(class, callable);
        _ = module.exports.create_js_thunk(controller_address, fn_id, &thunk_address);
        return thunk_address;
    }

    pub fn destroyJsThunk(self: *@This(), class: *ZigClassEntry, thunk_address: usize) !void {
        const fn_static = class.getStaticData(structure.Function);
        const controller_address = fn_static.controller_address;
        var fn_id: usize = 0;
        const module = self.host.module orelse return error.Unexpected;
        if (module.exports.destroy_js_thunk(controller_address, thunk_address, &fn_id) == .SUCCESS) {
            self.deleteCallback(fn_id);
        }
    }

    fn saveCallback(self: *@This(), class: *ZigClassEntry, callable: *Value) !usize {
        const fn_id = self.next_function_id;
        self.next_function_id +%= 1;
        try self.function_list.append(php.allocator, .{
            .id = fn_id,
            .class = class,
            .callable = callable.*,
        });
        php.addRef(callable);
        php.addRef(class.object);
        return fn_id;
    }

    fn findCallback(self: *@This(), fn_id: usize) ?*CallbackEntry {
        return for (self.function_list.items) |*item| {
            if (item.id == fn_id) break item;
        } else null;
    }

    fn deleteCallback(self: *@This(), fn_id: usize) void {
        for (self.function_list.items, 0..) |*ptr, i| {
            if (ptr.id == fn_id) {
                ptr.deinit();
                _ = self.function_list.swapRemove(i);
                break;
            }
        }
    }

    fn scheduleTask(self: *@This(), operation: ScheduledTask.Operation) !void {
        const fd = self.pipe_ptr[1];
        const task: ScheduledTask = .{ .self = self, .operation = operation };
        const written = std.c.write(fd, @ptrCast(&task), @sizeOf(ScheduledTask));
        // std.debug.print("CallDispatcher.scheduleTask() called\n", .{});
        if (written < 0) return error.Unexpected;
    }

    pub fn handleJscall(self: *@This(), call: *Jscall) !E {
        if (in_main_thread) {
            // std.debug.print("handleJscall, fd_id = {d}\n", .{call.fn_id});
            const cb = self.findCallback(call.fn_id) orelse return .FAULT;
            const arg_ptr: [*]u8 = @ptrFromInt(call.arg_address);
            const arg_bytes = arg_ptr[0..call.arg_size];
            // use the function structure's static method to run the callback
            const fn_static = cb.class.getStaticData(structure.Function);
            try fn_static.runCallback(&cb.callable, arg_bytes);
            return .SUCCESS;
        } else {
            var futex: Futex = undefined;
            call.futex_handle = futex.init();
            try self.scheduleTask(.{ .jscall = call });
            return futex.wait();
        }
    }

    pub fn handleSyscall(self: *@This(), call: *Syscall) !E {
        if (in_main_thread) {
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
        } else {
            var futex: Futex = undefined;
            call.futex_handle = futex.init();
            try self.scheduleTask(.{ .syscall = call });
            return futex.wait();
        }
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
        if (in_main_thread) {
            if (self.multithread_enabled) return;
            self.multithread_enabled = true;
            multithread_count += 1;
            if (multithread_count > 1) return;
            const strm_obj = try php.openDescriptor(pipes[0], "r");
            php.preserveStream(strm_obj);
            errdefer php.close(strm_obj);
            try php.setBlocking(strm_obj, false);
            const strm = php.createValueStream(strm_obj);
            try event_loop.init(&strm);
            defer php.release(&strm);
        } else {
            return error.NotInMainThread;
        }
    }

    pub fn disableMultithread(self: *@This()) !void {
        if (in_main_thread) {
            if (!self.multithread_enabled) return;
            self.multithread_enabled = false;
            multithread_count -= 1;
            if (multithread_count > 0) return;
            event_loop.deinit();
        } else {
            try self.scheduleTask(.{ .disable = {} });
        }
    }

    fn runScheduledTask() void {
        const fd = pipes[0];
        var task: ScheduledTask = undefined;
        while (true) {
            const read = std.c.read(fd, @ptrCast(&task), @sizeOf(ScheduledTask));
            if (read != @sizeOf(ScheduledTask)) break;
            const self = task.self;
            // std.debug.print("runScheduledTask\n", .{});
            switch (task.operation) {
                .jscall => |call| {
                    const err = self.handleJscall(call) catch .FAULT;
                    Futex.wake(call.futex_handle, err) catch {};
                },
                .syscall => |call| {
                    const err = self.handleSyscall(call) catch .FAULT;
                    Futex.wake(call.futex_handle, err) catch {};
                },
                .disable => {
                    self.disableMultithread() catch {};
                },
            }
            event_loop.resumePendingFiber();
        }
    }

    pub fn initializeThread(self: *@This()) !void {
        in_main_thread = false;
        if (self.syscall_trap_installed) {
            try redirection_controller.installSyscallTrap(&trapping_syscalls);
            self.thread_syscall_trap_list_mutex.lock();
            defer self.thread_syscall_trap_list_mutex.unlock();
            try self.thread_syscall_trap_list.append(std.heap.c_allocator, &trapping_syscalls);
            if (self.syscall_trap_count > 0) {
                trapping_syscalls = true;
            }
        }
        if (self.host.module) |m| {
            _ = m.exports.set_host_instance(@ptrCast(self.host));
        }
    }

    pub fn deinitializeThread(self: *@This()) !void {
        if (self.syscall_trap_installed) {
            self.thread_syscall_trap_list_mutex.lock();
            defer self.thread_syscall_trap_list_mutex.unlock();
            const index = for (self.thread_syscall_trap_list.items, 0..) |ptr, i| {
                if (ptr == &trapping_syscalls) break i;
            } else return;
            _ = self.thread_syscall_trap_list.swapRemove(index);
        }
    }

    pub fn addStream(self: *@This(), strm: *Stream, is_dir: bool) !c_long {
        const fd = try self.createDescriptor();
        const filetype: std.os.wasi.filetype_t = get: {
            var stat: std.os.wasi.filestat_t = undefined;
            break :get if (php.fstat(strm, &stat))
                stat.filetype
            else |_| if (is_dir) .DIRECTORY else .REGULAR_FILE;
        };
        const path = find: {
            if (php.getStreamPath(strm)) |path_sc| {
                break :find php.createString(path_sc);
            } else if (php.getStreamWrapperProperty(strm, "path") catch null) |path_v| {
                if (php.getValueString(path_v) catch null) |path| {
                    break :find path;
                }
            }
            return failure.report("stream wrapper does not have the property 'path'", .{});
        };
        var fdstat: std.os.wasi.fdstat_t = .{
            .fs_filetype = filetype,
            .fs_flags = .{},
            .fs_rights_base = .{},
            .fs_rights_inheriting = .{},
        };
        const mode = php.getStreamMode(strm);
        for (mode) |c| {
            switch (c) {
                'r' => fdstat.fs_rights_base.FD_READ = true,
                'w' => fdstat.fs_rights_base.FD_WRITE = true,
                '+' => {
                    fdstat.fs_rights_base.FD_READ = true;
                    fdstat.fs_rights_base.FD_WRITE = true;
                },
                'a' => {
                    fdstat.fs_flags.APPEND = true;
                },
                else => {},
            }
        }
        _ = try self.addStreamEntry(fd, path, strm, &fdstat);
        return fd;
    }

    pub fn removeStream(self: *@This(), fd: c_long) !void {
        if (fd < fd_min or fd > fd_max) return;
        const entry = try self.findStream(fd);
        entry.deinit();
        const index = (@intFromPtr(entry) - @intFromPtr(self.stream_list.items.ptr)) / @sizeOf(StreamEntry);
        _ = self.stream_list.swapRemove(index);
    }

    fn findStream(self: *@This(), fd: c_long) !*StreamEntry {
        for (self.stream_list.items) |*entry| {
            if (entry.fd == fd) return entry;
        } else {
            const path_sc: []const u8, const mode: [*:0]const u8 = switch (fd) {
                0 => .{ "php://input", "r" },
                1, 2 => .{ "php://output", "w" },
                else => return error.Unexpected,
            };
            const path = php.createString(path_sc);
            defer php.release(path);
            const strm = php.open(path, mode, 0) catch return error.Unexpected;
            const stat: std.os.wasi.fdstat_t = .{
                .fs_filetype = .REGULAR_FILE,
                .fs_flags = .{},
                .fs_rights_base = .{
                    .FD_READ = mode[0] == 'r',
                    .FD_WRITE = mode[0] == 'w',
                },
                .fs_rights_inheriting = .{},
            };
            return try self.addStreamEntry(fd, path, strm, &stat);
        }
    }

    fn useStream(self: *@This(), fd: c_long, mode: [*c]const u8) !std.meta.Tuple(&.{ *Stream, bool }) {
        switch (fd) {
            0, 1, 2, fd_min...fd_max => {
                const entry = try self.findStream(fd);
                return .{ entry.stream, false };
            },
            else => {
                const strm = try php.openDescriptor(@intCast(fd), mode);
                return .{ strm, true };
            },
        }
    }

    fn addStreamEntry(self: *@This(), fd: c_long, path: *String, strm: *Stream, stat: *const std.os.wasi.fdstat_t) !*StreamEntry {
        const entry = try self.stream_list.addOne(php.allocator);
        entry.* = .{
            .fd = fd,
            .path = path,
            .stream = strm,
            .fd_stat = stat.*,
        };
        php.addRef(path);
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

    fn getWrapperUrl(path: [*:0]const u8) ?*String {
        var start: usize = 0;
        var index: usize = 0;
        while (true) : (index += 1) {
            const c = path[index];
            if (c == ':') {
                const s = path[start..];
                const len = std.mem.len(s);
                return php.createString(s[0..len]);
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
            return .{ .url = url };
        } else if (dirfd == -1) {
            return null;
        } else {
            const parent = try self.findStream(dirfd);
            const name = path[0..std.mem.len(path)];
            const parent_path = php.getStringContent(parent.path);
            return .{
                .url = joinPath(parent_path, name),
                .context = php.getStreamContext(parent.stream),
            };
        }
    }

    fn joinPath(parent_path: []const u8, path: []const u8) *String {
        const slash_count: usize = if (parent_path[parent_path.len - 1] != '/') 1 else 0;
        const len = parent_path.len + slash_count + path.len;
        const str = php.createStringWithLength(len);
        const sc: [*]u8 = @ptrCast(&str.val[0]);
        @memcpy(sc[0..parent_path.len], parent_path);
        if (slash_count == 1) sc[parent_path.len] = '/';
        @memcpy(sc[parent_path.len + slash_count .. len], path);
        sc[len] = 0;
        return str;
    }

    fn handleOpen(self: *@This(), args: anytype) !E {
        const loc = (self.resolvePath(args.dirfd, args.path) catch return .BADF) orelse return .OPNOTSUPP;
        defer loc.deinit();
        const strm, const file_type: std.os.wasi.filetype_t = open: {
            if (args.rights.FD_READDIR) {
                // opening a directory
                const strm = php.opendir(loc.url, 0, null) catch return .NOENT;
                break :open .{ strm, .DIRECTORY };
            } else {
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
                const strm = php.open(loc.url, mode, 0) catch return .NOENT;
                break :open .{ strm, .REGULAR_FILE };
            }
        };
        errdefer php.close(strm);
        const stat: std.os.wasi.fdstat_t = .{
            .fs_filetype = file_type,
            .fs_flags = args.descriptor_flags,
            .fs_rights_base = args.rights,
            .fs_rights_inheriting = .{},
        };
        const fd = self.createDescriptor() catch return .MFILE;
        const entry = self.addStreamEntry(fd, loc.url, strm, &stat) catch return .MFILE;
        entry.flags.close = true;
        if (file_type == .DIRECTORY) {
            if (php.allocator.create(php.DirEntry) catch null) |de| {
                entry.dir_entry = de;
            }
        }
        args.fd = @intCast(fd);
        return .SUCCESS;
    }

    fn handleClose(self: *@This(), args: anytype) !E {
        self.removeStream(args.fd) catch return .BADF;
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
        const loc: PathInfo = get: {
            if (@hasField(@TypeOf(args.*), "fd")) {
                const entry = self.findStream(args.fd) catch return .BADF;
                php.addRef(entry.path);
                break :get .{
                    .url = entry.path,
                    .context = php.getStreamContext(entry.stream),
                };
            } else {
                break :get (self.resolvePath(args.dirfd, args.path) catch return .BADF) orelse return .OPNOTSUPP;
            }
        };
        defer loc.deinit();
        const buf: php.utimbuf = .{
            .actime = @divTrunc(args.atime, 1_000_000),
            .modtime = @divTrunc(args.mtime, 1_000_000),
        };
        php.touch(loc.url, &buf, loc.context) catch return .INVAL;
        return .SUCCESS;
    }

    fn handleStat(self: *@This(), args: anytype) !E {
        if (@hasField(@TypeOf(args.*), "fd")) {
            const entry = self.findStream(args.fd) catch return .BADF;
            php.fstat(entry.stream, &args.stat) catch return .BADF;
            return .SUCCESS;
        } else {
            const loc = (self.resolvePath(args.dirfd, args.path) catch return .BADF) orelse return .OPNOTSUPP;
            defer loc.deinit();
            php.stat(loc.url, loc.context, args.lookup_flags, &args.stat) catch return .NOENT;
            return .SUCCESS;
        }
    }

    fn handleGetDescriptorFlags(self: *@This(), args: anytype) !E {
        const entry = self.findStream(args.fd) catch return .BADF;
        args.fdstat = entry.fd_stat;
        return .SUCCESS;
    }

    fn handleSetDescriptorFlags(self: *@This(), args: anytype) !E {
        const entry = self.findStream(args.fd) catch return .BADF;
        php.setBlocking(entry.stream, args.fdflags.NONBLOCK) catch return .FAULT;
        php.setSync(entry.stream, args.fdflags.SYNC, args.fdflags.DSYNC) catch return .FAULT;
        return .SUCCESS;
    }

    fn handleSetLock(self: *@This(), args: anytype) !E {
        const entry = self.findStream(args.fd) catch return .BADF;
        php.setLock(entry.stream, args.lock.type) catch return .FAULT;
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
        php.rename(loc.url, new_loc.url, loc.context) catch return .NOENT;
        return .SUCCESS;
    }

    fn handleGetdents(self: *@This(), args: anytype) !E {
        const entry = self.findStream(args.dirfd) catch return .BADF;
        const dir_entry = entry.dir_entry orelse return .NOMEM;
        var index: usize = 0;
        var remaining: usize = args.len;
        while (true) {
            if (!entry.flags.populated) {
                if (php.readdir(entry.stream, dir_entry)) {
                    entry.flags.populated = true;
                } else break;
            }
            const name_ptr: [*:0]u8 = @ptrCast(&dir_entry.d_name);
            const name = name_ptr[0..std.mem.len(name_ptr)];
            if (name.len + @sizeOf(std.os.wasi.dirent_t) > remaining) {
                break;
            }
            const dir_path = php.getStringContent(entry.path);
            const path = joinPath(dir_path, name);
            defer php.release(path);
            var info: std.os.wasi.filestat_t = undefined;
            php.stat(path, null, .{}, &info) catch {
                info.ino = 0;
                info.filetype = .UNKNOWN;
            };
            const out_dirent: *align(1) std.os.wasi.dirent_t = @ptrCast(&args.buffer[index]);
            out_dirent.next = @intFromPtr(dir_entry);
            out_dirent.ino = info.ino;
            out_dirent.namlen = @intCast(name.len);
            out_dirent.type = info.filetype;
            const si = index + @sizeOf(std.os.wasi.dirent_t);
            const ei = si + name.len;
            const out_name = args.buffer[si..ei];
            @memcpy(out_name, name);
            entry.flags.populated = false;
            index += name.len + @sizeOf(std.os.wasi.dirent_t);
            remaining -= name.len + @sizeOf(std.os.wasi.dirent_t);
        }
        args.read = @intCast(index);
        return .SUCCESS;
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
        const out_strm, const close_out_strm = self.useStream(args.out_fd, "w") catch return .BADF;
        defer if (close_out_strm) php.close(out_strm);
        const in_strm, const close_in_strm = self.useStream(args.in_fd, "r") catch return .BADF;
        defer if (close_in_strm) php.close(in_strm);
        args.sent = php.sendfile(out_strm, in_strm, args.offset, args.len) catch return .EIO;
        return .SUCCESS;
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
