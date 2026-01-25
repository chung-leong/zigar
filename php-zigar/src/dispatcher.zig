const std = @import("std");
const E = std.os.wasi.errno_t;
const builtin = @import("builtin");

const ByteBuffer = @import("buffer.zig").ByteBuffer;
const Syscall = @import("module/native/interface.zig").Syscall;
const Jscall = @import("module/native/interface.zig").Jscall;
const ModuleHost = @import("host.zig").ModuleHost;
const php = @import("php.zig");
const HashTable = php.HashTable;
const HashPosition = php.HashPosition;
const String = php.String;
const Value = php.Value;
const StructureImporter = @import("importer.zig").StructureImporter;
const ZigClass = @import("class.zig").ZigClass;

pub const CallDispatcher = struct {
    redirection_mask: Syscall.Mask = .{},
    host: *ModuleHost,

    pub fn init(host: *ModuleHost) !*@This() {
        const self = try php.allocator.create(@This());
        errdefer php.allocator.destroy(self);
        self.* = .{
            .host = host,
        };
        return self;
    }

    pub fn deinit(self: *@This()) void {
        php.allocator.destroy(self);
    }

    pub fn handleJscall(self: *@This(), call: *Jscall) !E {
        _ = self;
        _ = call;
        unreachable;
    }

    pub fn handleSyscall(self: *@This(), call: *Syscall) !E {
        _ = self;
        _ = call;
        unreachable;
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
};
