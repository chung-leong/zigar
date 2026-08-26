const std = @import("std");
const builtin = @import("builtin");

const c = @import("c");

const zigar = @import("zigar");

pub fn use(path: [:0]const u8) !void {
    if (builtin.target.os.tag == .windows) {
        const handle = c.LoadLibraryA(path.ptr);
        defer _ = c.FreeLibrary(handle);
        const proc_ptr = c.GetProcAddress(handle, "print") orelse return error.UnableToFindFunction;
        const print = @as(*const fn () callconv(.c) void, @ptrCast(proc_ptr));
        try zigar.io.redirect(print);
        print();
    } else {
        var lib = try std.DynLib.open(path);
        defer lib.close();
        const print = lib.lookup(*const fn () callconv(.c) void, "print") orelse return error.UnableToFindFunction;
        try zigar.io.redirect(print);
        print();
    }
}
