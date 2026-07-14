const std = @import("std");
const c_allocator = std.heap.c_allocator;
const builtin = @import("builtin");

const c = @import("c");

pub const DynLib = struct {
    handle: Handle,
    path: [:0]const u8,
    is_handle_owner: bool,

    const Handle = switch (builtin.target.os.tag) {
        .windows => std.os.windows.HMODULE,
        else => *anyopaque,
    };

    pub fn open(path: []const u8) !@This() {
        const path_copy = try std.heap.c_allocator.dupeZ(u8, path);
        const handle = switch (builtin.target.os.tag) {
            .windows => load: {
                const path_space = std.os.windows.sliceToPrefixedFileW(null, path) catch return error.InvalidPath;
                const path_w = path_space.span().ptr;
                var offset: usize = 0;
                if (path_w[0] == '\\' and path_w[1] == '?' and path_w[2] == '?' and path_w[3] == '\\') {
                    // + 4 to skip over the \??\
                    offset = 4;
                }
                break :load try std.os.windows.LoadLibraryExW(path_w + offset, .none);
            },
            else => load: {
                var flags: u32 = c.RTLD_LAZY;
                if (@hasDecl(c, "RTLD_DEEPBIND")) {
                    flags |= c.RTLD_DEEPBIND;
                }
                break :load std.c.dlopen(path_copy, @bitCast(flags)) orelse return error.FileNotFound;
            },
        };
        return .{ .handle = handle, .path = path_copy, .is_handle_owner = true };
    }

    pub fn openBySymbol(ptr: *const anyopaque) !@This() {
        switch (builtin.target.os.tag) {
            .windows => {
                var handle: c.HMODULE = undefined;
                if (c.GetModuleHandleExA(c.GET_MODULE_HANDLE_EX_FLAG_FROM_ADDRESS, @ptrCast(ptr), &handle) == 0) {
                    return error.UnableToGetLibraryInfo;
                }
                const len = c.GetModuleFileNameA(handle, null, 0);
                const path_copy = try std.heap.c_allocator.alloc(u8, len + 1);
                _ = c.GetModuleFileNameA(handle, null, 0);
                return .{ .handle = @ptrCast(handle), .path = @ptrCast(path_copy), .is_handle_owner = false };
            },
            else => {
                var info: c.Dl_info = undefined;
                if (c.dladdr(ptr, &info) == 0) return error.UnableToGetLibraryInfo;
                const path = std.mem.sliceTo(info.dli_fname, 0);
                return try open(path);
            },
        }
    }

    pub fn close(self: *@This()) void {
        if (self.is_handle_owner) {
            _ = switch (builtin.target.os.tag) {
                .windows => std.os.windows.CloseHandle(self.handle),
                else => std.c.dlclose(self.handle),
            };
        }
        std.heap.c_allocator.free(self.path);
    }

    pub fn lookup(self: *@This(), comptime T: type, name: [:0]const u8) ?T {
        const ptr = switch (builtin.target.os.tag) {
            .windows => std.os.windows.kernel32.GetProcAddress(self.handle, name),
            else => std.c.dlsym(self.handle, name),
        };
        return @ptrCast(@alignCast(ptr));
    }
};

pub fn fixEnvironment() void {
    if (builtin.target.os.tag != .windows) {
        if (@hasDecl(c, "RTLD_DEEPBIND")) {
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
