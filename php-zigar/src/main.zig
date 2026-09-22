const std = @import("std");
const builtin = @import("builtin");

const php_ng = @import("php/root.zig");
const Module = php_ng.Module;

comptime {
    Module.Custom(@import("extension.zig")).register(.{
        .name = "zigar",
        .version = "0.17.0",
    });
}

pub fn DllMain(
    _: std.os.windows.HINSTANCE,
    _: std.os.windows.DWORD,
    _: std.os.windows.LPVOID,
) std.os.windows.BOOL {
    php_ng.linkWindowsImports() catch return .FALSE;
    return .TRUE;
}
