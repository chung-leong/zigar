const std = @import("std");
const c_allocator = std.heap.c_allocator;
const builtin = @import("builtin");

const c = @import("c");

pub const DynLib = struct {
    handle: Handle,
    path: [:0]const u8,
    is_handle_owner: bool,

    const Handle = switch (builtin.target.os.tag) {
        .windows => c.HMODULE,
        else => *anyopaque,
    };

    pub fn open(path: []const u8) !@This() {
        const offset: usize = switch (builtin.target.os.tag) {
            .windows => if (std.mem.eql(u8, path[0..4], "\\??\\")) 4 else 0,
            else => 0,
        };
        const path_copy = try std.heap.c_allocator.dupeZ(u8, path[offset..]);
        const handle = switch (builtin.target.os.tag) {
            .windows => load: {
                break :load c.LoadLibraryA(path_copy.ptr) orelse return error.FileNotFound;
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
                .windows => c.FreeLibrary(self.handle),
                else => std.c.dlclose(self.handle),
            };
        }
        std.heap.c_allocator.free(self.path);
    }

    pub fn lookup(self: *@This(), comptime T: type, name: [:0]const u8) ?T {
        const ptr = switch (builtin.target.os.tag) {
            .windows => c.GetProcAddress(self.handle, name),
            else => std.c.dlsym(self.handle, name),
        };
        return @ptrCast(@alignCast(@constCast(ptr)));
    }

    pub fn retain(self: *@This()) !void {
        const success = switch (builtin.target.os.tag) {
            .windows => set: {
                var unused: c.HMODULE = undefined;
                const result = c.GetModuleHandleExA(c.GET_MODULE_HANDLE_EX_FLAG_PIN, self.path, &unused);
                break :set result == c.TRUE;
            },
            else => set: {
                var flags: u32 = c.RTLD_LAZY | c.RTLD_NODELETE | c.RTLD_NOLOAD;
                if (@hasDecl(c, "RTLD_DEEPBIND")) {
                    flags |= c.RTLD_DEEPBIND;
                }
                const result = std.c.dlopen(self.path, @bitCast(flags));
                break :set result != null;
            },
        };
        if (!success) return error.UnableToRetainLibrary;
    }
};

pub fn fixEnvironment() void {
    if (builtin.target.os.tag != .windows) {
        if (@hasDecl(c, "RTLD_DEEPBIND")) {
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
