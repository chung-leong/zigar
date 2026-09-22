pub const std = @import("std");

const php = @import("root.zig");
const c = php.c;
const pi = php.imports;
const argCount = php.argCount;
const deref = php.deref;
const Object = php.Object;
const Resource = php.Resource;
const String = php.String;
const Value = php.Value;

pub const Stream = opaque {
    pub fn isStdIo(strm: *const @This()) bool {
        const ops = c.get_stream_handlers(@ptrCast(strm));
        return ops == deref(&pi.php_stream_stdio_ops);
    }

    pub fn wrapper(self: *const @This()) *Wrapper {
        const pwrapper = c.get_stream_wrapper(@ptrCast(self));
        return @ptrCast(pwrapper);
    }

    pub fn resource(self: *const @This()) *Resource {
        return c.get_stream_resource(@ptrCast(self));
    }

    pub fn getPath(self: *const @This()) ?[]const u8 {
        const ptr = c.get_stream_path(@ptrCast(self)) orelse return null;
        const len = std.mem.len(ptr);
        return ptr[0..len];
    }

    pub fn getContext(self: *const @This()) ?*Context {
        const pctx = c.get_stream_context(@ptrCast(self)) orelse return null;
        return @ptrCast(pctx);
    }

    pub fn getMode(self: *const @This()) ?[]const u8 {
        const mode = c.get_stream_mode(@ptrCast(self)) orelse return null;
        return std.mem.sliceTo(mode, 0);
    }

    pub fn getDescriptor(self: *const @This()) ?c_int {
        if (!self.isStdIo()) return null;
        return inline for (.{ c.PHP_STREAM_AS_FD_FOR_SELECT, c.PHP_STREAM_AS_FD }) |as| {
            var fd: c_int align(@alignOf(*anyopaque)) = undefined;
            const result = switch (@hasDecl(c, "_php_stream_cast")) {
                false => pi.php_stream_cast(@ptrCast(self), as, @ptrCast(&fd), 0),
                true => pi._php_stream_cast(@ptrCast(self), as, @ptrCast(&fd), 0),
            };
            if (result == c.SUCCESS) break fd;
        } else null;
    }

    pub fn getWrapperData(self: *const @This()) ?*Object {
        const zval = c.get_stream_wrapper_data(@ptrCast(self));
        const value: *const Value = @ptrCast(zval);
        return value.getObject() catch null;
    }

    pub fn getWrapperProperty(self: *const @This(), name: anytype) !Value {
        const data = self.getWrapperData() orelse return error.Missing;
        return try data.getProperty(name);
    }

    pub fn setWrapper(self: *@This(), wpr: *const Wrapper) void {
        return c.set_stream_wrapper(@ptrCast(self), @ptrCast(wpr));
    }

    pub fn toValue(self: *const @This()) Value {
        var result: Value = undefined;
        c.set_zval_stream(@ptrCast(&result), @ptrCast(self));
        return result;
    }

    pub fn open(path: *const String, mode: [*c]const u8, context: ?*Context, options: c_int) !*Stream {
        const p = path.slice();
        const src = @src();
        const pctx: ?*c.php_stream_context = if (context) |ctx| @ptrCast(ctx) else null;
        const pstrm = switch (comptime argCount(@TypeOf(pi._php_stream_open_wrapper_ex))) {
            10 => pi._php_stream_open_wrapper_ex(p.ptr, mode, options, null, pctx, 1, src.file, src.line, src.file, src.line),
            5 => pi._php_stream_open_wrapper_ex(p.ptr, mode, options, null, pctx),
            else => @compileError("Unexpected _php_stream_open_wrapper_ex argument count"),
        } orelse return error.Failure;
        return @ptrCast(pstrm);
    }

    pub fn openDirectory(path: *String, options: c_int, context: ?*Context) !*Stream {
        const p = path.slice();
        const src = @src();
        const pctx: ?*c.php_stream_context = if (context) |ctx| @ptrCast(ctx) else null;
        const pstrm = switch (comptime argCount(@TypeOf(c._php_stream_opendir))) {
            8 => pi._php_stream_opendir(p.ptr, options, pctx, 1, src.file, src.line, src.file, src.line),
            3 => pi._php_stream_opendir(p.ptr, options, pctx),
            else => @compileError("Unexpected _php_stream_opendir argument count"),
        } orelse return error.Failure;
        return @ptrCast(pstrm);
    }

    pub fn openDescriptor(fd: c_int, mode: [*c]const u8) !*Stream {
        const src = @src();
        // arg count varies depending on PHP version and whether debug is enabled
        const pstrm = switch (comptime argCount(@TypeOf(pi._php_stream_fopen_from_fd))) {
            3 => pi._php_stream_fopen_from_fd(fd, mode, null), // function in PHP 8.1 doesn't have zero_position
            4 => pi._php_stream_fopen_from_fd(fd, mode, null, false),
            8 => pi._php_stream_fopen_from_fd(fd, mode, null, 1, src.file, src.line, src.file, src.line),
            9 => pi._php_stream_fopen_from_fd(fd, mode, null, false, 1, src.file, src.line, src.file, src.line),
            else => @compileError("Unexpected _php_stream_fopen_from_fd argument count"),
        } orelse return error.Failure;
        c.set_stream_no_close(pstrm);
        return @ptrCast(pstrm);
    }

    pub fn close(self: *@This(), destroy: bool) void {
        const options = switch (destroy) {
            true => c.PHP_STREAM_FREE_CLOSE,
            false => c.PHP_STREAM_FREE_KEEP_RSRC | c.PHP_STREAM_FREE_CALL_DTOR | c.PHP_STREAM_FREE_RELEASE_STREAM,
        };
        const pstrm: *c.php_stream = @ptrCast(self);
        _ = switch (@hasDecl(c, "_php_stream_free")) {
            false => pi.php_stream_free(pstrm, options), // 8.6
            true => pi._php_stream_free(pstrm, options),
        };
    }

    pub fn flush(self: *@This()) !void {
        const pstrm: *c.php_stream = @ptrCast(self);
        const result = switch (@hasDecl(c, "_php_stream_flush")) {
            false => pi.php_stream_flush(pstrm), // 8.6
            true => pi._php_stream_flush(pstrm, 0),
        };
        if (result != c.SUCCESS) return error.Failure;
    }

    pub fn read(self: *@This(), buf: []u8) !usize {
        const pstrm: *c.php_stream = @ptrCast(self);
        const result = switch (@hasDecl(c, "_php_stream_read")) {
            false => pi.php_stream_read(pstrm, buf.ptr, buf.len), // 8.6
            true => pi._php_stream_read(pstrm, buf.ptr, buf.len),
        };
        if (result < 0) return error.Failure;
        return @intCast(result);
    }

    pub fn readDirectory(self: *@This(), ent: *DirectoryEntry) bool {
        const pstrm: *c.php_stream = @ptrCast(self);
        const result = switch (@hasDecl(c, "_php_stream_readdir")) {
            false => pi.php_stream_readdir(pstrm, ent), // 8.6
            true => pi._php_stream_readdir(pstrm, ent),
        };
        return result != null;
    }

    pub fn write(self: *@This(), buf: []const u8) !usize {
        const pstrm: *c.php_stream = @ptrCast(self);
        const result = switch (@hasDecl(c, "_php_stream_write")) {
            false => pi.php_stream_write(pstrm, buf.ptr, buf.len), // 8.6
            true => pi._php_stream_write(pstrm, buf.ptr, buf.len),
        };
        if (result < 0) return error.Failure;
        return @intCast(result);
    }

    pub fn seek(self: *@This(), offset: i64, whence: u32) !void {
        const pstrm: *c.php_stream = @ptrCast(self);
        const ops = c.get_stream_handlers(pstrm);
        const flags = c.get_stream_flags(pstrm);
        if (ops.*.seek == null) return error.Unseekable;
        if (flags & c.PHP_STREAM_FLAG_NO_SEEK != 0) return error.Unseekable;
        const pos = switch (@hasDecl(c, "_php_stream_seek")) {
            false => pi.php_stream_seek(pstrm, offset, @intCast(whence)), // 8.6
            true => pi._php_stream_seek(pstrm, offset, @intCast(whence)),
        };
        if (pos < 0) return error.InvalidOffset;
    }

    pub fn tell(self: *@This()) !u64 {
        const pstrm: *c.php_stream = @ptrCast(self);
        const pos = switch (@hasDecl(c, "_php_stream_tell")) {
            false => pi.php_stream_tell(pstrm), // 8.6
            true => pi._php_stream_tell(pstrm),
        };
        if (pos < 0) return error.Failure;
        return @intCast(pos);
    }

    pub fn stat(self: *@This(), out: *Stat) !void {
        const pstrm: *c.php_stream = @ptrCast(self);
        var stat_buf: c.php_stream_statbuf = undefined;
        const result = switch (@hasDecl(c, "_php_stream_stat")) {
            false => pi.php_stream_stat(pstrm, &stat_buf), // 8.6
            true => pi._php_stream_stat(pstrm, &stat_buf),
        };
        if (result != c.SUCCESS) return error.Failure;
        copyStat(&stat_buf.sb, out);
    }

    pub fn truncate(self: *@This(), len: u64) !void {
        const pstrm: *c.php_stream = @ptrCast(self);
        const result = switch (@hasDecl(c, "_php_stream_truncate_set_size")) {
            false => pi.php_stream_truncate_set_size(pstrm, @intCast(len)), // 8.6
            true => pi._php_stream_truncate_set_size(pstrm, @intCast(len)),
        };
        if (result != 0) return error.Failure;
    }

    pub fn setBlocking(self: *@This(), set: bool) !void {
        const id = c.PHP_STREAM_OPTION_BLOCKING;
        const value: c_int = if (set) 1 else 0;
        const pstrm: *c.php_stream = @ptrCast(self);
        const result = switch (@hasDecl(c, "_php_stream_set_option")) {
            false => pi.php_stream_set_option(pstrm, id, value, null), // 8.6
            true => pi._php_stream_set_option(pstrm, id, value, null),
        };
        if (result < 0) return error.Failure;
    }

    pub fn setLock(self: *@This(), lock_type: c_int) !void {
        const id = c.PHP_STREAM_OPTION_LOCKING;
        const pstrm: *c.php_stream = @ptrCast(self);
        const result = switch (@hasDecl(c, "_php_stream_set_option")) {
            false => pi.php_stream_set_option(pstrm, id, lock_type, null), // 8.6
            true => pi._php_stream_set_option(pstrm, id, lock_type, null),
        };
        if (result != c.SUCCESS) return error.Failure;
    }

    pub fn copyRange(self: *@This(), offset: ?*i64, in_strm: *@This(), in_offset: ?*i64, len: u64) !u32 {
        var original_in_pos: u64 = 0;
        var original_out_pos: u64 = 0;
        var copied: usize = 0;
        if (in_offset) |ptr| {
            const new_in_pos = ptr.*;
            original_in_pos = try in_strm.tell();
            if (original_in_pos < 0) return error.Failure;
            if (original_in_pos != new_in_pos) {
                try seek(in_strm, new_in_pos, c.SEEK_SET);
            }
        }
        if (offset) |ptr| {
            const new_out_pos = ptr.*;
            original_out_pos = try self.tell();
            if (original_out_pos < 0) return error.Failure;
            if (original_out_pos != new_out_pos) {
                try seek(self, new_out_pos, c.SEEK_SET);
            }
        }
        var buf: [8192]u8 = undefined;
        var remaining = len;
        while (remaining > 0) {
            const bytes_read = try read(in_strm, buf[0..@min(remaining, buf.len)]);
            if (bytes_read == 0) break;
            const written = try write(self, buf[0..bytes_read]);
            if (written < 0) return error.Failure;
            copied += bytes_read;
            remaining -= @intCast(bytes_read);
        }
        if (in_offset) |ptr| {
            ptr.* += @intCast(copied);
            try seek(in_strm, @intCast(original_in_pos), c.SEEK_SET);
        }
        if (offset) |ptr| {
            ptr.* += @intCast(copied);
            try seek(self, @intCast(original_out_pos), c.SEEK_SET);
        }
        return @intCast(copied);
    }

    pub fn statPath(path: *const String, context: ?*Context, _: LookupFlags, out: *Stat) !void {
        const p = path.slice();
        var stat_buf: c.php_stream_statbuf = undefined;
        const zctx: ?*c.php_stream_context = if (context) |ctx| @ptrCast(ctx) else null;
        const result = switch (@hasDecl(c, "_php_stream_stat_path")) {
            false => pi.php_stream_stat_path_ex(p.ptr, 0, &stat_buf, zctx),
            true => pi._php_stream_stat_path(p.ptr, 0, &stat_buf, zctx),
        };
        if (result != c.SUCCESS) return error.Failure;
        copyStat(&stat_buf.sb, out);
    }

    pub fn unlink(path: *const String, context: ?*Context) !void {
        const p = path.slice();
        const zctx: ?*c.php_stream_context = if (context) |ctx| @ptrCast(ctx) else null;
        const w, const f = try Wrapper.getOp(p, "unlink");
        const result = f.?(w, p.ptr, 0, zctx);
        if (result == 0) return error.Failure;
    }

    pub fn rename(path: *const String, new_path: *const String, context: ?*Context) !void {
        const p = path.slice();
        const np = new_path.slice();
        const zctx: ?*c.php_stream_context = if (context) |ctx| @ptrCast(ctx) else null;
        const w, const f = try Wrapper.getOp(p, "rename");
        const nw, _ = try Wrapper.getOp(np, "rename");
        if (w != nw) return error.Failure;
        if (f.?(w, p.ptr, np.ptr, 0, zctx) == 0) return error.Failure;
    }

    pub fn touch(path: *String, timebuf: *const c.utimbuf, context: ?*Context) !void {
        const zctx: ?*c.php_stream_context = if (context) |ctx| @ptrCast(ctx) else null;
        const p = path.slice();
        const w, const f = try Wrapper.getOp(p, "stream_metadata");
        const result = f.?(w, p.ptr, c.PHP_STREAM_META_TOUCH, @constCast(timebuf), zctx);
        if (result != c.SUCCESS) return error.Failure;
    }

    pub fn makeDirectory(path: *const String, mode: u32, context: ?*Context) !void {
        const path_s = path.slice();
        const zctx: ?*c.php_stream_context = if (context) |ctx| @ptrCast(ctx) else null;
        const result = switch (@hasDecl(c, "_php_stream_mkdir")) {
            false => pi.php_stream_mkdir(path_s.ptr, @intCast(mode), 0, zctx), // 8.6
            true => pi._php_stream_mkdir(path_s.ptr, @intCast(mode), 0, zctx),
        };
        if (result == 0) return error.Failure;
    }

    pub fn removeDirectory(path: *const String, context: ?*Context) !void {
        const path_s = path.slice();
        const zctx: ?*c.php_stream_context = if (context) |ctx| @ptrCast(ctx) else null;
        const result = switch (@hasDecl(c, "_php_stream_rmdir")) {
            false => pi.php_stream_rmdir(path_s.ptr, 0, zctx), // 8.6
            true => pi._php_stream_rmdir(path_s.ptr, 0, zctx),
        };
        if (result == 0) return error.Failure;
    }

    pub const Context = struct {
        pub fn resource(self: *const @This()) *Resource {
            return @ptrCast(self.impl.res);
        }

        impl: c.php_stream_context,
    };
    pub const Wrapper = struct {
        pub fn getOp(path: []const u8, comptime name: []const u8) !@Tuple(&.{ *c.php_stream_wrapper, @FieldType(Wrapper.Ops, name) }) {
            const w = pi.php_stream_locate_url_wrapper(path.ptr, null, 0);
            if (w == null or w.*.wops == null or @field(w.*.wops.*, name) == null) {
                return error.Failure;
            }
            return .{ w, @field(w.*.wops.*, name) };
        }

        pub const Ops = c.php_stream_wrapper_ops;

        impl: c.php_stream_wrapper,
    };
    pub const LookupFlags = std.os.wasi.lookupflags_t;
    pub const Stat = std.os.wasi.filestat_t;
    pub const DirectoryEntry = c.php_stream_dirent;

    // since opaque can't have any field, the last public decl provides the implementation type
    pub const Impl = c.php_stream;
};

fn copyStat(in: *c.zend_stat_t, out: *std.os.wasi.filestat_t) void {
    out.size = convertSize(in.st_size);
    if (@hasField(c.zend_stat_t, "st_atim")) {
        out.atim = convertTimespec(in.st_atim);
        out.ctim = convertTimespec(in.st_ctim);
        out.mtim = convertTimespec(in.st_mtim);
    } else if (@hasField(c.zend_stat_t, "st_atimespec")) {
        // MacOS
        out.atim = convertTimespec(in.st_atimespec);
        out.ctim = convertTimespec(in.st_ctimespec);
        out.mtim = convertTimespec(in.st_mtimespec);
    } else if (@hasField(c.zend_stat_t, "st_atime")) {
        // Windows
        out.atim = convertTimespec(in.st_atime);
        out.ctim = convertTimespec(in.st_ctime);
        out.mtim = convertTimespec(in.st_mtime);
    } else {
        @compileError("Unsupported stat struct");
    }
    if (@hasDecl(c, "S_IFSOCK")) {
        out.filetype = switch (in.st_mode & c.S_IFMT) {
            c.S_IFSOCK => .SOCKET_STREAM,
            c.S_IFLNK => .SYMBOLIC_LINK,
            c.S_IFREG => .REGULAR_FILE,
            c.S_IFBLK => .BLOCK_DEVICE,
            c.S_IFDIR => .DIRECTORY,
            c.S_IFCHR => .CHARACTER_DEVICE,
            else => .UNKNOWN,
        };
    } else {
        // Windows
        out.filetype = switch (in.st_mode & c.S_IFMT) {
            c.S_IFLNK => .SYMBOLIC_LINK,
            c.S_IFREG => .REGULAR_FILE,
            c.S_IFBLK => .BLOCK_DEVICE,
            c.S_IFDIR => .DIRECTORY,
            c.S_IFCHR => .CHARACTER_DEVICE,
            else => .UNKNOWN,
        };
    }
    out.ino = @intCast(in.st_ino);
    out.dev = @intCast(in.st_dev);
    out.nlink = if (@hasField(c.zend_stat_t, "nlink")) in.nlink else 0;
}

fn convertSize(value: anytype) usize {
    if (value < 0) return 0;
    return @intCast(value);
}

fn convertTimespec(value: anytype) u64 {
    const T = @TypeOf(value);
    return switch (@typeInfo(T)) {
        .int => @intCast(value),
        .@"struct" => calc: {
            const s: i64 = value.tv_sec;
            if (s < 0) return 0;
            const ns: i64 = value.tv_nsec;
            break :calc @bitCast(s * 1_000_000_000 + ns);
        },
        else => @compileError("Unknown time format"),
    };
}
