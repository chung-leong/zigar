const std = @import("std");

const windows_h = @cImport({
    @cInclude("windows.h");
});

pub fn save(path: [*:0]const u8, data: []const u8) !usize {
    const handle = windows_h.CreateFileA(path, windows_h.GENERIC_WRITE, 0, null, windows_h.CREATE_ALWAYS, 0, null);
    if (handle == null) return error.UnableToCreateFile;
    defer _ = windows_h.CloseHandle(handle);
    var written: windows_h.DWORD = undefined;
    if (windows_h.WriteFile(handle, data.ptr, @intCast(data.len), &written, null) != windows_h.TRUE)
        return error.UnableToWriteToFile;
    return written;
}
