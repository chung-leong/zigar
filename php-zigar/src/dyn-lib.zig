const std = @import("std");
const builtin = @import("builtin");

const dlfcn_h = @cImport({
    @cDefine("_GNU_SOURCE", {});
    @cInclude("dlfcn.h");
});

const windows_h = @cImport({
    @cInclude("windows.h");
});

pub const DynLib = struct {
    handle: *anyopaque,
    path: [:0]const u8,

    const Handle = switch (builtin.target.os.tag) {
        .windows => *anyopaque,
        else => windows_h.HMODULE,
    };

    pub fn open(path: []const u8) !@This() {
        switch (builtin.target.os.tag) {
            .windows => @panic("TODO"),
            else => {
                const path_copy = try std.heap.c_allocator.dupeZ(u8, path);
                var flags: u32 = dlfcn_h.RTLD_LAZY;
                if (@hasDecl(dlfcn_h, "RTLD_DEEPBIND")) {
                    flags |= dlfcn_h.RTLD_DEEPBIND;
                }
                const handle = std.c.dlopen(path_copy, @bitCast(flags)) orelse return error.FileNotFound;
                return .{ .handle = handle, .path = path_copy };
            },
        }
    }

    pub fn openBySymbol(ptr: *const anyopaque) !@This() {
        switch (builtin.target.os.tag) {
            .windows => {
                var handle: windows_h.HMODULE = undefined;
                if (windows_h.GetModuleHandleExA(windows_h.GET_MODULE_HANDLE_EX_FLAG_FROM_ADDRESS, @ptrCast(ptr), &handle) == 0) {
                    return error.UnableToGetLibraryInfo;
                }
                const len = windows_h.GetModuleFileNameA(handle, null, 0);
                const path_copy = try std.heap.c_allocator.alloc(u8, len + 1);
                _ = windows_h.GetModuleFileNameA(handle, null, 0);
                return .{ .handle = handle, .path = path_copy };
            },
            else => {
                var info: dlfcn_h.Dl_info = undefined;
                if (dlfcn_h.dladdr(ptr, &info) == 0) return error.UnableToGetLibraryInfo;
                const path = std.mem.sliceTo(info.dli_fname, 0);
                return try open(path);
            },
        }
    }

    pub fn close(self: *@This()) void {
        _ = switch (builtin.target.os.tag) {
            .windows => @panic("TODO"),
            else => std.c.dlclose(self.handle),
        };
        std.heap.c_allocator.free(self.path);
    }

    pub fn lookup(self: *@This(), comptime T: type, name: [:0]const u8) ?T {
        const ptr = switch (builtin.target.os.tag) {
            .windows => @panic("TODO"),
            else => std.c.dlsym(self.handle, name),
        };
        return @ptrCast(@alignCast(ptr));
    }
};

pub fn fixEnvironment() void {
    if (builtin.target.os.tag != .windows) {
        if (@hasDecl(dlfcn_h, "RTLD_DEEPBIND")) {
            if (@intFromPtr(std.c.environ) == 0) {
                // fix missing environ due to RTLD_DEEPBIND option given to dlopen()
                if (std.c.dlopen(null, .{ .LAZY = true, .NOLOAD = true })) |handle| {
                    defer _ = std.c.dlclose(handle);
                    if (std.c.dlsym(handle, "environ")) |symbol| {
                        const environ_ptr: @TypeOf(&std.c.environ) = @ptrCast(@alignCast(symbol));
                        std.c.environ = environ_ptr.*;
                    }
                }
            }
        }
    }
}
