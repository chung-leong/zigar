const std = @import("std");

const c = @import("c");

pub fn save(path: [*:0]const u8, data: []const u8) !usize {
    const handle = c.CreateFileA(path, c.GENERIC_WRITE, 0, null, c.CREATE_ALWAYS, 0, null);
    if (handle == null) return error.UnableToCreateFile;
    defer _ = c.CloseHandle(handle);
    var written: c.DWORD = undefined;
    if (c.WriteFile(handle, data.ptr, @intCast(data.len), &written, null) != c.TRUE)
        return error.UnableToWriteToFile;
    return written;
}
